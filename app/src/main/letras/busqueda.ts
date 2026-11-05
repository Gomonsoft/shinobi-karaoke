import type { ElementoLetra } from '../../shared'
import { lrcALetra, textoPlanoALetra } from '../../shared/letras'
import {
  sincroniaDe,
  type BusquedaLetra,
  type CandidatoLetra,
  type ResultadoBusquedaLetra,
  type Sincronia
} from '../../shared/letrasBusqueda'
import type { ServicioBiblioteca } from '../biblioteca/servicio'
import type { RegistroApp } from '../registro'
import {
  ErrorLrclib,
  PRESUPUESTO_BUSQUEDA_MS,
  type ClienteLrclib,
  type RegistroLrclib
} from './lrclib'
import { convertirLyricsfile } from './lyricsfile'

/** Búsqueda de letras en LRCLIB y conversión a candidatos (0082; ADR 0005, Revisión 2026-11-05). */

export const MAX_CANDIDATOS = 20
/** Los resultados de la última búsqueda de cada canción se guardan 10 min, solo en memoria. */
export const CACHE_BUSQUEDA_MS = 10 * 60 * 1000

export interface OpcionesBusquedaLetras {
  biblioteca: Pick<ServicioBiblioteca, 'obtener' | 'actualizar'>
  cliente: Pick<ClienteLrclib, 'get' | 'buscar'>
  registro: RegistroApp
  /** Reloj en ms (mismo que el del cliente). */
  ahora?: () => number
  presupuestoMs?: number
  cacheMs?: number
}

const RANGO: Record<Sincronia, number> = { palabra: 0, linea: 1, texto: 2 }

const tieneLinea = (lineas: readonly ElementoLetra[]): boolean =>
  lineas.some((l) => l.tipo === 'linea')

/** Convierte un registro a líneas internas: Lyricsfile > LRC > texto plano; `null` si no hay letra. */
export function convertirRegistro(r: RegistroLrclib): ElementoLetra[] | null {
  if (r.instrumental) return null
  if (r.hasWordSync && r.lyricsfile) {
    try {
      const l = convertirLyricsfile(r.lyricsfile)
      if (l && tieneLinea(l)) return l
    } catch {
      // Demasiado grande o ilegible: se pasa a `syncedLyrics`.
    }
  }
  if (r.syncedLyrics?.trim()) {
    try {
      const l = lrcALetra(r.syncedLyrics).lineas
      if (tieneLinea(l)) return l
    } catch {
      // Se pasa al texto plano.
    }
  }
  if (r.plainLyrics?.trim()) {
    try {
      const l = textoPlanoALetra(r.plainLyrics)
      if (tieneLinea(l)) return l
    } catch {
      // Sin letra utilizable.
    }
  }
  return null
}

interface EntradaCache {
  titulo: string
  artista: string
  resultado: ResultadoBusquedaLetra
  hasta: number
}

export class BusquedaLetras {
  private readonly o: OpcionesBusquedaLetras
  private readonly ahora: () => number
  private readonly cache = new Map<string, EntradaCache>()
  private enCurso: AbortController | null = null

  constructor(opciones: OpcionesBusquedaLetras) {
    this.o = opciones
    this.ahora = opciones.ahora ?? Date.now
  }

  /** Aborta la búsqueda en curso (cierre de la app). */
  cerrar(): void {
    this.enCurso?.abort()
    this.enCurso = null
  }

  async buscar(p: BusquedaLetra): Promise<ResultadoBusquedaLetra> {
    // Una búsqueda nueva (una sola ventana) cancela la anterior.
    this.enCurso?.abort()
    const ctl = new AbortController()
    this.enCurso = ctl
    const inicio = this.ahora()
    let candidatos = 0
    let codigo = '-'
    try {
      const r = await this.ejecutar(p, ctl.signal, inicio)
      candidatos = r.candidatos.length
      return r
    } catch (e) {
      codigo = e instanceof ErrorLrclib ? e.codigo : 'ERROR_INTERNO'
      throw e
    } finally {
      if (this.enCurso === ctl) this.enCurso = null
      this.o.registro.escribir(
        'info',
        'letras',
        `búsqueda cancion=${p.cancionId} candidatos=${candidatos} duracion_ms=${this.ahora() - inicio} error=${codigo}`
      )
    }
  }

  private async ejecutar(
    p: BusquedaLetra,
    usuario: AbortSignal,
    inicio: number
  ): Promise<ResultadoBusquedaLetra> {
    const cancelada = (): ErrorLrclib => new ErrorLrclib('CANCELADO', 'Búsqueda cancelada')
    const cancion = this.o.biblioteca.obtener(p.cancionId)
    if (!cancion) throw new ErrorLrclib('ARGUMENTOS_NO_VALIDOS', 'La canción no existe.')
    const titulo = p.titulo.trim()
    const artista = p.artista.trim()

    // Mismos metadatos que `biblioteca.actualizarMetadatos` (ux/05, criterio 8).
    const m = cancion.metadatos
    if (m.titulo !== titulo || m.artista !== artista) {
      await this.o.biblioteca.actualizar(p.cancionId, {
        metadatos: { titulo, artista, album: m.album }
      })
      if (usuario.aborted) throw cancelada()
    }

    const previa = this.cache.get(p.cancionId)
    if (
      p.usarCache &&
      previa &&
      previa.hasta > this.ahora() &&
      previa.titulo === titulo &&
      previa.artista === artista
    ) {
      return structuredClone(previa.resultado)
    }

    // Presupuesto total de la búsqueda: al agotarse se aborta lo pendiente.
    const presupuesto = this.o.presupuestoMs ?? PRESUPUESTO_BUSQUEDA_MS
    const limite = new AbortController()
    const t = setTimeout(() => limite.abort(), presupuesto)
    const señal = AbortSignal.any([usuario, limite.signal])
    const op = { vencimiento: inicio + presupuesto }

    const registros: { r: RegistroLrclib; deGet: boolean }[] = []
    const ids = new Set<number>()
    let instrumental = false
    let instrumentalGet = false
    let primerError: ErrorLrclib | null = null
    let agotado = false

    const anadir = (lista: RegistroLrclib[], deGet: boolean): number => {
      let utiles = 0
      for (const r of lista) {
        if (r.instrumental) instrumental = true
        if (convertirRegistro(r)) utiles++
        if (ids.has(r.id)) continue
        ids.add(r.id)
        registros.push({ r, deGet })
      }
      return utiles
    }
    /** Ejecuta un paso; los errores del cliente se anotan y la búsqueda sigue con el siguiente. */
    const paso = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      if (agotado) return undefined
      try {
        return await fn()
      } catch (e) {
        if (usuario.aborted) throw cancelada()
        if (!(e instanceof ErrorLrclib)) throw e
        if (e.codigo === 'CANCELADO') agotado = true
        else primerError ??= e
        return undefined
      }
    }

    try {
      if (artista) {
        const g = await paso(() =>
          this.o.cliente.get(
            {
              titulo,
              artista,
              album: m.album,
              duracionS: m.duracion_ms / 1000
            },
            señal,
            op
          )
        )
        if (g) {
          if (g.instrumental) instrumentalGet = true
          anadir([g], true)
        }
        const s = await paso(() => this.o.cliente.buscar({ titulo, artista }, señal, op))
        const utiles = s ? anadir(s, false) : 0
        if (utiles === 0 && !agotado) {
          const q = await paso(() =>
            this.o.cliente.buscar({ q: `${titulo} ${artista}` }, señal, op)
          )
          if (q) anadir(q, false)
        }
      } else {
        const q = await paso(() => this.o.cliente.buscar({ q: titulo }, señal, op))
        if (q) anadir(q, false)
      }
    } finally {
      clearTimeout(t)
    }
    if (usuario.aborted) throw cancelada()

    const candidatos = this.ordenar(registros, m.duracion_ms)
    if (candidatos.length === 0) {
      if (instrumentalGet || instrumental) {
        throw new ErrorLrclib('INSTRUMENTAL', 'La canción es instrumental.')
      }
      if (primerError) throw primerError
      if (agotado) throw new ErrorLrclib('SERVICIO_NO_DISPONIBLE', 'Presupuesto agotado')
      throw new ErrorLrclib('LETRA_NO_ENCONTRADA', 'Sin resultados')
    }
    const resultado: ResultadoBusquedaLetra = { candidatos, instrumental: instrumentalGet }
    this.cache.set(p.cancionId, {
      titulo,
      artista,
      resultado: structuredClone(resultado),
      hasta: this.ahora() + (this.o.cacheMs ?? CACHE_BUSQUEDA_MS)
    })
    return resultado
  }

  private ordenar(
    registros: { r: RegistroLrclib; deGet: boolean }[],
    duracionMs: number
  ): CandidatoLetra[] {
    const lista: CandidatoLetra[] = []
    for (const { r } of registros) {
      const lineas = convertirRegistro(r)
      if (!lineas) continue
      const dur = r.duration == null ? 0 : Math.round(r.duration * 1000)
      lista.push({
        lrclib_id: r.id,
        titulo: r.trackName ?? '',
        artista: r.artistName ?? '',
        album: r.albumName ?? null,
        duracion_ms: Math.max(0, dur),
        sincronia: sincroniaDe(lineas),
        diferencia_ms: Math.max(0, dur) - duracionMs,
        lineas
      })
    }
    // `sort` es estable: a igualdad queda el orden de entrada (`get` primero, luego LRCLIB).
    lista.sort(
      (a, b) =>
        RANGO[a.sincronia] - RANGO[b.sincronia] ||
        Math.abs(a.diferencia_ms) - Math.abs(b.diferencia_ms)
    )
    return lista.slice(0, MAX_CANDIDATOS)
  }
}
