import { randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import {
  contarLineas,
  estadoPasoLetra,
  letraSchema,
  type EdicionLetraIpc,
  type ElementoLetra,
  type Letra
} from '../../shared'
import {
  MAX_BYTES_LETRA,
  aplicarTextoEditado,
  esLrc,
  lrcALetra,
  normalizarLetra,
  textoPlanoALetra
} from '../../shared/letras'
import {
  sincroniaDe,
  type ArchivoLetraLeido,
  type EditarTextoLetra,
  type GuardarTiempos,
  type GuardarLetra
} from '../../shared/letrasBusqueda'
import { ErrorBiblioteca } from '../biblioteca/operaciones'
import type { ServicioBiblioteca } from '../biblioteca/servicio'
import type { ResumenCancion } from '../biblioteca/resumen'
import type { DialogoArchivos } from '../fuente/archivo'

/** Espera para agrupar las ediciones de texto seguidas (ADR 0006: ~1 s). */
export const DEBOUNCE_EDICION_MS = 1000

export interface OpcionesServicioLetras {
  biblioteca: ServicioBiblioteca
  /** Selector nativo de archivos (con el doble de pruebas ya aplicado). */
  dialogo: DialogoArchivos
  ahora?: () => Date
  debounceEdicionMs?: number
}

const sinLetra = (mensaje: string): ErrorBiblioteca =>
  new ErrorBiblioteca('ARCHIVO_SIN_LETRA', mensaje)
const noValido = (mensaje: string): ErrorBiblioteca =>
  new ErrorBiblioteca('ARGUMENTOS_NO_VALIDOS', mensaje)

/**
 * Decodifica el archivo: BOM UTF-8 o UTF-16 LE/BE; si no, UTF-8 estricto y, si falla, Windows-1252
 * (ADR 0005, Revisión 2026-11-05). Devuelve null si parece binario (bytes NUL sin BOM UTF-16).
 */
export function decodificarTextoLetra(bytes: Uint8Array): string | null {
  const b = bytes
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(b.subarray(2))
  }
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(b.subarray(2))
  }
  if (b.includes(0)) return null
  const inicio = b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(inicio))
  } catch {
    return new TextDecoder('windows-1252').decode(b.subarray(inicio))
  }
}

/**
 * Único escritor de `letra`: guardar, editarTexto, guardarTiempos (ADR 0006 y 0010).
 * Escribe siempre con `ServicioBiblioteca.actualizar`, que emite `evento:cancion`.
 */
export class ServicioLetras {
  private readonly biblioteca: ServicioBiblioteca
  private readonly dialogo: DialogoArchivos
  private readonly ahora: () => Date
  private readonly debounceMs: number
  private visita: { id: string; cancionId: string; referencia: Letra | null } | null = null
  private readonly escriturasTiempos = new Map<string, Promise<ResumenCancion>>()

  constructor(opciones: OpcionesServicioLetras) {
    this.biblioteca = opciones.biblioteca
    this.dialogo = opciones.dialogo
    this.ahora = opciones.ahora ?? (() => new Date())
    this.debounceMs = opciones.debounceEdicionMs ?? DEBOUNCE_EDICION_MS
  }

  /** Sustituye la letra entera. */
  async guardar(peticion: GuardarLetra): Promise<ResumenCancion> {
    const cancion = this.biblioteca.obtener(peticion.cancionId)
    if (!cancion) throw noValido('La canción no existe o está dañada.')
    let lineas: ElementoLetra[]
    let letra: Letra
    try {
      lineas = normalizarLetra(peticion.lineas)
      letra = letraSchema.parse({
        origen: peticion.origen,
        lrclib_id: peticion.lrclib_id,
        offset_ms: 0,
        lineas
      })
    } catch {
      throw noValido('La letra no es válida.')
    }
    if (contarLineas(letra) < 1) throw noValido('La letra necesita al menos una línea.')
    this.invalidarEdicionDe(peticion.cancionId)
    return this.escribir(peticion.cancionId, letra, 0)
  }

  /** Aplica el texto editado sobre la letra guardada en este momento (conserva ids y tiempos). */
  async editarTexto(peticion: EditarTextoLetra): Promise<ResumenCancion> {
    // Todo el cálculo es síncrono hasta `actualizar`: dos llamadas seguidas se aplican en orden.
    const cancion = this.biblioteca.obtener(peticion.cancionId)
    if (!cancion) throw noValido('La canción no existe o está dañada.')
    const previa: Letra = cancion.letra ?? {
      origen: 'manual',
      lrclib_id: null,
      offset_ms: 0,
      lineas: []
    }
    let nueva: Letra
    try {
      nueva = letraSchema.parse(aplicarTextoEditado(previa, peticion.texto))
    } catch {
      throw noValido('El texto de la letra no es válido.')
    }
    const resumenActual = this.biblioteca.obtenerResumen(peticion.cancionId)
    if (JSON.stringify(nueva.lineas) === JSON.stringify(previa.lineas)) {
      if (resumenActual) return resumenActual
    }
    if (contarLineas(nueva) === 0 && cancion.estado === 'lista') {
      throw noValido('Una canción lista necesita al menos una línea de letra.')
    }
    this.invalidarEdicionDe(peticion.cancionId)
    return this.escribir(peticion.cancionId, nueva, this.debounceMs)
  }

  /** Elige y lee un `.lrc`/`.txt`. No escribe nada; la ruta no sale de aquí. */
  async leerArchivo(): Promise<ArchivoLetraLeido> {
    const r = await this.dialogo.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Letra (.lrc, .txt)', extensions: ['lrc', 'txt'] }]
    })
    const ruta = r.canceled ? undefined : r.filePaths[0]
    if (!ruta) return { cancelado: true }

    let bytes: Uint8Array
    try {
      if ((await stat(ruta)).size > MAX_BYTES_LETRA)
        throw sinLetra('El archivo es demasiado grande.')
      bytes = await readFile(ruta)
    } catch (e) {
      if (e instanceof ErrorBiblioteca) throw e
      throw sinLetra('No se pudo leer el archivo.')
    }
    if (bytes.length > MAX_BYTES_LETRA) throw sinLetra('El archivo es demasiado grande.')
    const texto = decodificarTextoLetra(bytes)
    if (texto === null) throw sinLetra('El archivo no contiene texto.')

    let lineas: ElementoLetra[]
    let ignoradas = 0
    try {
      if (esLrc(texto)) {
        const l = lrcALetra(texto)
        lineas = l.lineas
        ignoradas = l.ignoradas
      } else {
        lineas = textoPlanoALetra(texto)
      }
    } catch {
      throw sinLetra('El archivo no contiene letra legible.')
    }
    if (!lineas.some((l) => l.tipo === 'linea')) throw sinLetra('El archivo no contiene letra.')
    return {
      cancelado: false,
      nombre: basename(ruta),
      lineas,
      sincronia: sincroniaDe(lineas),
      ignoradas
    }
  }

  abrirEdicion(cancionId: string): EdicionLetraIpc | null {
    this.liberarEdicion()
    const cancion = this.biblioteca.obtener(cancionId)
    if (!cancion) return null
    const sesionId = randomUUID()
    this.visita = { id: sesionId, cancionId, referencia: structuredClone(cancion.letra) }
    return { cancion, sesionId }
  }

  cerrarEdicion(sesionId: string): void {
    if (this.visita?.id === sesionId) this.liberarEdicion()
  }

  liberarEdicion(): void {
    this.visita = null
  }

  private invalidarEdicionDe(cancionId: string): void {
    if (this.visita?.cancionId === cancionId) this.liberarEdicion()
  }

  /** Valida la visita y encola la escritura sin ceder el turno entre lectura y actualización. */
  async guardarTiempos(peticion: GuardarTiempos, sesionId: string): Promise<ResumenCancion> {
    const { cancionId, offset_ms, tiempos } = peticion
    const cancion = this.biblioteca.obtener(cancionId)
    if (!cancion) throw noValido('La canción no existe o está dañada.')
    const { letra } = cancion
    const visita = this.visita
    const referencia = visita?.referencia
    if (
      visita?.id !== sesionId ||
      visita.cancionId !== cancionId ||
      !letra ||
      !referencia ||
      letra.lineas.length !== tiempos.length ||
      referencia.lineas.length !== tiempos.length ||
      letra.lineas.some(
        (linea, i) => linea.id !== tiempos[i]?.id || linea.id !== referencia.lineas[i]?.id
      )
    ) {
      throw new ErrorBiblioteca(
        'LETRA_DESACTUALIZADA',
        'La letra ha cambiado desde que se abrió el editor.'
      )
    }

    const lineas = letra.lineas.map((linea, i): ElementoLetra => {
      const inicial = referencia.lineas[i]!
      const { inicio_ms, fin_ms, palabras } = tiempos[i]!
      if (linea.tipo === 'pausa') {
        if (
          palabras !== null ||
          (inicio_ms !== null && inicio_ms !== inicial.inicio_ms) ||
          (fin_ms !== null && fin_ms !== inicial.fin_ms)
        )
          throw noValido('Los tiempos de la pausa no coinciden con la letra guardada.')
        return { ...linea, inicio_ms, fin_ms, palabras: null }
      }
      if (palabras === null) return { ...linea, inicio_ms, fin_ms, palabras }
      const originales = inicial.palabras
      if (
        !originales ||
        originales.length !== palabras.length ||
        inicio_ms === null ||
        inicial.inicio_ms === null
      ) {
        throw noValido('Las palabras no coinciden con la letra guardada.')
      }
      const delta = inicio_ms - inicial.inicio_ms
      const validadas = originales.map((original, j) => {
        const nueva = palabras[j]!
        if (
          nueva.texto !== original.texto ||
          nueva.inicio_ms !== original.inicio_ms + delta ||
          nueva.fin_ms !== original.fin_ms + delta
        ) {
          throw noValido('Las palabras no coinciden con la letra guardada.')
        }
        return { texto: original.texto, inicio_ms: nueva.inicio_ms, fin_ms: nueva.fin_ms }
      })
      return { ...linea, inicio_ms, fin_ms, palabras: validadas }
    })

    const nueva = letraSchema.safeParse({ ...letra, offset_ms, lineas })
    if (!nueva.success) throw noValido('Los tiempos no son válidos.')
    const resumen = this.biblioteca.obtenerResumen(cancionId)
    if (resumen && JSON.stringify(nueva.data) === JSON.stringify(letra)) {
      return this.escriturasTiempos.get(cancionId) ?? resumen
    }
    const escritura = this.escribir(cancionId, nueva.data, 0)
    this.escriturasTiempos.set(cancionId, escritura)
    try {
      return await escritura
    } finally {
      if (this.escriturasTiempos.get(cancionId) === escritura)
        this.escriturasTiempos.delete(cancionId)
    }
  }

  private escribir(id: string, letra: Letra, debounceMs: number): Promise<ResumenCancion> {
    return this.biblioteca.actualizar(
      id,
      {
        letra,
        pasos: {
          letra: {
            estado: estadoPasoLetra(letra),
            actualizado: this.ahora().toISOString(),
            error: null
          }
        }
      },
      { debounceMs }
    )
  }
}
