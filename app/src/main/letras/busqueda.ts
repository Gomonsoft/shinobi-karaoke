import type { ElementoLetra, Preparacion } from '../../shared'
import { MAX_IDS_BUSQUEDA } from '../../shared'
import { evaluarEncajeConPicos, type VeredictoEncaje } from '../../shared/encaje'
import { lrcALetra, textoPlanoALetra } from '../../shared/letras'
import {
  sincroniaDe,
  type BusquedaLetra,
  type CandidatoLetra,
  type EncajeCandidato,
  type EventoEncajeLetras,
  type ResultadoBusquedaLetra,
  type Sincronia
} from '../../shared/letrasBusqueda'
import type { ServicioBiblioteca } from '../biblioteca/servicio'
import type { NivelBase } from '../picos/formato'
import type { RegistroApp } from '../registro'
import {
  ErrorLrclib,
  PRESUPUESTO_BUSQUEDA_MS,
  type ClienteLrclib,
  type OpcionesOperacion,
  type RegistroLrclib
} from './lrclib'
import { convertirLyricsfile } from './lyricsfile'

/** Búsqueda de letras en LRCLIB y conversión a candidatos (0082; ADR 0005, Revisión 2026-11-05). */

export const MAX_CANDIDATOS = 20
/** Los resultados de la última búsqueda de cada canción se guardan 10 min, solo en memoria. */
export const CACHE_BUSQUEDA_MS = 10 * 60 * 1000

export interface OpcionesBusquedaLetras {
  biblioteca: Pick<ServicioBiblioteca, 'obtener' | 'actualizar'>
  cliente: Pick<ClienteLrclib, 'get' | 'buscar'> & Partial<Pick<ClienteLrclib, 'porId'>>
  registro: RegistroApp
  /** Reloj en ms (mismo que el del cliente). */
  ahora?: () => number
  presupuestoMs?: number
  cacheMs?: number
  /** Picos de la voz separada (ADR 0024 §2); sin ellos los candidatos salen sin encaje. */
  picos?: { nivelBase(cancionId: string): Promise<NivelBase | null> }
  /** Evento `letras:encaje` cuando los picos terminan después de buscar. */
  emitirEncaje?: (evento: EventoEncajeLetras) => void
  /**
   * `config.preparacion.automatica` (ADR 0025 §4): las búsquedas automáticas solo salen con el
   * interruptor activo. Sin él, siempre (pruebas). Una búsqueda explícita («Preparar») lo ignora.
   */
  automaticaActiva?: () => boolean
}

/** Cómo se lanza una búsqueda: desde la vista Letra (por defecto) o desde la preparación desatendida. */
export interface OpcionesBuscar {
  /** Va por la cola automática de LRCLIB: sin presupuesto de 10 s y detrás de las interactivas. */
  automatica?: boolean
  /** Iniciada por el usuario («Preparar»): funciona aunque el interruptor esté apagado. */
  explicita?: boolean
}

/** Lo que se guarda de una búsqueda en `cancion.preparacion.busqueda`: sin ninguna letra. */
export type BusquedaGuardada = NonNullable<Preparacion['busqueda']>

/**
 * Resumen guardable de una búsqueda (ADR 0025 §1, opción 3A): recuento, motivo y como mucho 10 ids de
 * LRCLIB para volver a pedir los textos. Nunca incluye texto ni líneas. `CANCELADO` y los errores
 * internos no son un resultado: se relanzan.
 */
export function aBusquedaGuardada(r: ResultadoBusquedaLetra | Error): BusquedaGuardada {
  if (!(r instanceof Error)) {
    return {
      resultado: 'elige',
      candidatas: r.candidatos.length,
      motivo: null,
      ids: r.candidatos.slice(0, MAX_IDS_BUSQUEDA).map((c) => c.lrclib_id)
    }
  }
  if (r instanceof ErrorLrclib) {
    if (r.codigo === 'LETRA_NO_ENCONTRADA') {
      return { resultado: 'sin_letra', candidatas: 0, motivo: r.codigo, ids: [] }
    }
    if (r.codigo === 'INSTRUMENTAL') {
      return { resultado: 'instrumental', candidatas: 0, motivo: r.codigo, ids: [] }
    }
    if (r.codigo === 'SIN_CONEXION' || r.codigo === 'SERVICIO_NO_DISPONIBLE') {
      return { resultado: 'pendiente', candidatas: 0, motivo: r.codigo, ids: [] }
    }
  }
  throw r
}

/** Orden por veredicto (ADR 0024 §2): `coincide` = `desfasada` > `dudosa` > `no_comprobable` > `no_coincide`. */
const RANGO_VEREDICTO: Record<VeredictoEncaje, number> = {
  coincide: 0,
  desfasada: 0,
  dudosa: 1,
  no_comprobable: 2,
  no_coincide: 3
}

const RANGO: Record<Sincronia, number> = { palabra: 0, linea: 1, texto: 2 }

/**
 * Sincronía para ordenar los candidatos: un registro con tiempos por palabra sigue yendo primero
 * (trae fines de línea) aunque ya no se importen las palabras (ADR 0021 §5).
 */
const sincroniaOrden = (r: RegistroLrclib, lineas: readonly ElementoLetra[]): Sincronia => {
  const s = sincroniaDe(lineas)
  return s === 'linea' && r.hasWordSync ? 'palabra' : s
}

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
  /** Búsquedas automáticas vivas: no se cancelan entre sí ni a la interactiva. */
  private readonly automaticas = new Set<AbortController>()

  constructor(opciones: OpcionesBusquedaLetras) {
    this.o = opciones
    this.ahora = opciones.ahora ?? Date.now
  }

  /** Aborta la búsqueda en curso (cierre de la app). */
  cerrar(): void {
    this.enCurso?.abort()
    this.enCurso = null
    for (const c of this.automaticas) c.abort()
    this.automaticas.clear()
  }

  /** Cancela las búsquedas automáticas de una canción (o de todas): detenerla, eliminarla, apagar el interruptor. */
  cancelarAutomaticas(cancionId?: string): void {
    for (const [c, id] of this.idsAutomaticas) {
      if (cancionId === undefined || id === cancionId) c.abort()
    }
  }
  private readonly idsAutomaticas = new Map<AbortController, string>()

  /**
   * Búsqueda de la preparación desatendida: devuelve el resultado completo (que vive en memoria) y lo
   * que se guarda en disco, sin letras. Un fallo de red o del servicio no lanza: queda `pendiente`.
   */
  async buscarParaPreparacion(
    cancionId: string,
    opciones: { explicita?: boolean } = {}
  ): Promise<{ resultado: ResultadoBusquedaLetra | null; busqueda: BusquedaGuardada }> {
    const cancion = this.o.biblioteca.obtener(cancionId)
    if (!cancion) throw new ErrorLrclib('ARGUMENTOS_NO_VALIDOS', 'La canción no existe.')
    try {
      const resultado = await this.buscar(
        { cancionId, titulo: cancion.metadatos.titulo, artista: cancion.metadatos.artista },
        { automatica: true, explicita: opciones.explicita === true }
      )
      return { resultado, busqueda: aBusquedaGuardada(resultado) }
    } catch (e) {
      if (!(e instanceof Error)) throw e
      return { resultado: null, busqueda: aBusquedaGuardada(e) }
    }
  }

  async buscar(p: BusquedaLetra, opciones: OpcionesBuscar = {}): Promise<ResultadoBusquedaLetra> {
    const automatica = opciones.automatica === true
    const ctl = new AbortController()
    if (automatica) {
      // Interruptor apagado: ni siquiera se encola (privacidad, ADR 0005 revisado).
      if (!opciones.explicita && this.o.automaticaActiva && !this.o.automaticaActiva()) {
        throw new ErrorLrclib('CANCELADO', 'La búsqueda automática está desactivada.')
      }
      this.automaticas.add(ctl)
      this.idsAutomaticas.set(ctl, p.cancionId)
    } else {
      // Una búsqueda interactiva nueva (una sola ventana) cancela la anterior.
      this.enCurso?.abort()
      this.enCurso = ctl
    }
    const inicio = this.ahora()
    let candidatos = 0
    let codigo = '-'
    try {
      const r = await this.conEncaje(
        p.cancionId,
        await this.ejecutar(p, ctl.signal, inicio, automatica ? opciones : null)
      )
      candidatos = r.candidatos.length
      return r
    } catch (e) {
      codigo = e instanceof ErrorLrclib ? e.codigo : 'ERROR_INTERNO'
      throw e
    } finally {
      if (this.enCurso === ctl) this.enCurso = null
      this.automaticas.delete(ctl)
      this.idsAutomaticas.delete(ctl)
      this.o.registro.escribir(
        'info',
        'letras',
        `búsqueda${automatica ? ' automática' : ''} cancion=${p.cancionId} candidatos=${candidatos} duracion_ms=${this.ahora() - inicio} error=${codigo}`
      )
    }
  }

  /** Encaje de cada candidato con tiempos; null si aún no hay picos. Un candidato solo texto da null. */
  private async encajes(
    cancionId: string,
    candidatos: readonly CandidatoLetra[]
  ): Promise<(EncajeCandidato | null)[] | null> {
    const nivel = await this.o.picos?.nivelBase(cancionId)
    if (!nivel) return null
    const voz = { pasoMs: nivel.pasoMs, pares: nivel.pares }
    return candidatos.map((c) => {
      if (c.sincronia === 'texto') return null
      const r = evaluarEncajeConPicos({ lineas: c.lineas, offset_ms: 0 }, voz, {
        duracionMs: nivel.duracionMs
      })
      return { veredicto: r.veredicto, desfaseMs: r.desfaseMs }
    })
  }

  /** Añade `encaje` a cada candidato y ordena por veredicto (estable: dentro, el orden de ADR 0005). */
  private async conEncaje(
    cancionId: string,
    r: ResultadoBusquedaLetra
  ): Promise<ResultadoBusquedaLetra> {
    const encajes = await this.encajes(cancionId, r.candidatos)
    if (!encajes) return r
    const conEncaje = r.candidatos.map((c, i) => ({ ...c, encaje: encajes[i] ?? null }))
    conEncaje.sort(
      (a, b) =>
        RANGO_VEREDICTO[a.encaje?.veredicto ?? 'no_comprobable'] -
        RANGO_VEREDICTO[b.encaje?.veredicto ?? 'no_comprobable']
    )
    return { ...r, candidatos: conEncaje }
  }

  /** Los picos acaban de terminar: si hay una búsqueda reciente, se emiten sus encajes. */
  async alPicosListos(cancionId: string): Promise<void> {
    const previa = this.cache.get(cancionId)
    if (!previa || previa.hasta <= this.ahora() || !this.o.emitirEncaje) return
    const candidatos = previa.resultado.candidatos
    const encajes = await this.encajes(cancionId, candidatos)
    if (!encajes) return
    this.o.emitirEncaje({
      cancionId,
      encajes: candidatos.map((c, i) => ({ lrclib_id: c.lrclib_id, encaje: encajes[i] ?? null }))
    })
  }

  private async ejecutar(
    p: BusquedaLetra,
    usuario: AbortSignal,
    inicio: number,
    automatica: OpcionesBuscar | null
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
    // La automática no tiene presupuesto de 10 s: espera su turno y los `Retry-After` en la cola.
    const presupuesto = this.o.presupuestoMs ?? PRESUPUESTO_BUSQUEDA_MS
    const limite = new AbortController()
    const t = automatica ? undefined : setTimeout(() => limite.abort(), presupuesto)
    const señal = AbortSignal.any([usuario, limite.signal])
    const op: OpcionesOperacion = automatica
      ? {
          prioridad: 'automatica',
          ...(automatica.explicita ? {} : { permitida: () => this.o.automaticaActiva?.() ?? true })
        }
      : { vencimiento: inicio + presupuesto }

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
        if (e.codigo === 'CANCELADO') {
          // En la cola automática es una parada (interruptor apagado o canción detenida), no un agotamiento.
          if (automatica) throw cancelada()
          agotado = true
        } else primerError ??= e
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
      if (t) clearTimeout(t)
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

  /**
   * Texto de un candidato guardado por su id (`letras.candidatoPorId`, opción 3A de ADR 0025): de la
   * caché en memoria si sigue viva y, si no, `GET /api/get/{id}`. Solo se piden ids que la preparación
   * guardó para esa canción (`preparacion.busqueda.ids`) o que están en la búsqueda reciente. Es una
   * petición interactiva (adelanta a la cola automática). `null` si el registro ya no existe o no
   * tiene letra utilizable.
   */
  async candidatoPorId(cancionId: string, lrclibId: number): Promise<CandidatoLetra | null> {
    const cancion = this.o.biblioteca.obtener(cancionId)
    if (!cancion) throw new ErrorLrclib('ARGUMENTOS_NO_VALIDOS', 'La canción no existe.')
    const previa = this.cache.get(cancionId)
    const vivo = previa && previa.hasta > this.ahora() ? previa.resultado.candidatos : []
    const enCache = vivo.find((c) => c.lrclib_id === lrclibId)
    if (enCache) return structuredClone(enCache)
    if (!cancion.preparacion?.busqueda?.ids.includes(lrclibId)) {
      throw new ErrorLrclib('ARGUMENTOS_NO_VALIDOS', 'Ese candidato no es de esta canción.')
    }
    const porId = this.o.cliente.porId?.bind(this.o.cliente)
    if (!porId) throw new ErrorLrclib('ERROR_INTERNO', 'El cliente no admite pedir por id.')
    const ctl = new AbortController()
    const limite = setTimeout(() => ctl.abort(), this.o.presupuestoMs ?? PRESUPUESTO_BUSQUEDA_MS)
    try {
      const r = await porId(lrclibId, ctl.signal, {
        vencimiento: this.ahora() + (this.o.presupuestoMs ?? PRESUPUESTO_BUSQUEDA_MS)
      })
      const c = r ? this.aCandidato(r, cancion.metadatos.duracion_ms) : null
      if (!c) return null
      const encajes = await this.encajes(cancionId, [c])
      return encajes?.[0] ? { ...c, encaje: encajes[0] } : c
    } finally {
      clearTimeout(limite)
    }
  }

  private aCandidato(r: RegistroLrclib, duracionMs: number): CandidatoLetra | null {
    const lineas = convertirRegistro(r)
    if (!lineas) return null
    const dur = r.duration == null ? 0 : Math.round(r.duration * 1000)
    return {
      lrclib_id: r.id,
      titulo: r.trackName ?? '',
      artista: r.artistName ?? '',
      album: r.albumName ?? null,
      duracion_ms: Math.max(0, dur),
      sincronia: sincroniaOrden(r, lineas),
      diferencia_ms: Math.max(0, dur) - duracionMs,
      lineas
    }
  }

  private ordenar(
    registros: { r: RegistroLrclib; deGet: boolean }[],
    duracionMs: number
  ): CandidatoLetra[] {
    const lista: CandidatoLetra[] = []
    for (const { r } of registros) {
      const c = this.aCandidato(r, duracionMs)
      if (c) lista.push(c)
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
