import { access, constants, realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  esCodigoError,
  metadatosEditablesSchema,
  resultadoImportarArchivoSchema,
  type CodigoError,
  type MetadatosEditables,
  type ResultadoImportarArchivo
} from '../../shared'
import type {
  DatosNuevaCancion,
  DatosSustitucionFuente,
  ImportacionPreparada,
  ResumenCancion
} from '../biblioteca'
import type { ErrorTrabajo, OpcionesEjecucion } from '../trabajos'

/** Extensiones anunciadas en `add.formatos` (ux/03), para el filtro "Audio y vídeo". */
export const EXTENSIONES_AUDIO_VIDEO = [
  'mp3',
  'm4a',
  'flac',
  'wav',
  'ogg',
  'opus',
  'webm',
  'mp4',
  'mkv',
  'mov'
] as const

/** Más de 10 min: la UI muestra el aviso `add.aviso.larga` (no es un error). */
export const UMBRAL_LARGA_MS = 600_000

/** Error de la importación con código estable y, si viene del worker, las últimas líneas de su salida. */
export class ErrorImportacion extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
    readonly detalles?: string,
    readonly reintentable = false
  ) {
    super(mensaje)
    this.name = 'ErrorImportacion'
  }
}

/** Lo que recibe el renderer tras leer el audio. El resultado completo se queda en main. */
export interface ImportacionLeida {
  importacionId: string
  nombre: string
  duracionMs: number
  metadatos: { titulo: string; artista: string; album: string }
  gananciaDb: number
  larga: boolean
}

/** Subconjunto del servicio de biblioteca que usa la importación. */
export interface BibliotecaImportacion {
  prepararImportacion(): Promise<ImportacionPreparada>
  materializar(id: string, datos: DatosNuevaCancion): Promise<ResumenCancion>
  descartarImportacion(id: string): Promise<void>
  sustituirFuente(id: string, datos: DatosSustitucionFuente): Promise<ResumenCancion>
}

export interface DependenciasImportacion {
  biblioteca: BibliotecaImportacion
  /** Cliente del worker (0013). */
  ejecutar: (
    comando: string,
    args: Record<string, unknown>,
    opciones?: OpcionesEjecucion
  ) => Promise<Record<string, unknown>>
  /** Directorio de datos de la app: no se importa nada desde dentro. */
  dirDatos: string
  /** ¿Hay un trabajo vivo (en cola o en curso) de esa canción? (gestor de trabajos). */
  hayTrabajoVivo?: (cancionId: string) => boolean
  /** Se llama tras crear la canción con la fuente completada (encadena la separación, 0065). */
  alFuenteLista?: (cancionId: string) => void
  ahora?: () => Date
  registrar?: (nivel: 'aviso' | 'error', mensaje: string) => void
}

interface Importacion {
  id: string
  ruta: string
  controlador: AbortController
  estado: 'leyendo' | 'lista' | 'confirmando'
  resultado?: ResultadoImportarArchivo
  /** Se resuelve cuando el proceso del worker ha terminado (nunca rechaza). */
  fin: Promise<void>
  /** Marca `fin` como resuelto. */
  terminar: () => void
}

const desconocida = (id: string): ErrorImportacion =>
  new ErrorImportacion('ARGUMENTOS_NO_VALIDOS', `No hay una importación con id ${id}.`)

/** La mezcla debe ser una ruta relativa dentro de la carpeta de la canción. */
function rutaRelativaSegura(ruta: string): boolean {
  if (isAbsolute(ruta) || /^[A-Za-z]:/.test(ruta)) return false
  return !ruta.split(/[\\/]/).some((p) => p === '..')
}

/**
 * Importación de un archivo local (0042, ADR 0009 §7): consulta interactiva fuera de las colas,
 * como mucho una a la vez. La canción solo se crea al confirmar.
 */
export class ServicioImportacionArchivo {
  private actual: Importacion | null = null
  /** Serializa el arranque de importaciones (cancelar la anterior y preparar la carpeta). */
  private arranque: Promise<unknown> = Promise.resolve()

  constructor(private readonly deps: DependenciasImportacion) {}

  /** Lee el archivo: normaliza el audio en `.importando/<id>/` y devuelve los datos para el formulario. */
  async importar(rutaEntrada: string): Promise<ImportacionLeida> {
    const entrada = await this.comprobarEntrada(rutaEntrada)
    const imp = await this.enSerieArranque(async () => {
      await this.liberarActual()
      const { id, ruta } = await this.deps.biblioteca.prepararImportacion()
      const controlador = new AbortController()
      let terminar = (): void => undefined
      const fin = new Promise<void>((r) => (terminar = r))
      const nueva: Importacion = { id, ruta, controlador, estado: 'leyendo', fin, terminar }
      this.actual = nueva
      return nueva
    })

    try {
      const bruto = await this.deps
        .ejecutar(
          'importar-archivo',
          { entrada, salida: imp.ruta, borrar_entrada: false },
          { señal: imp.controlador.signal }
        )
        .finally(() => imp.terminar())
      const r = resultadoImportarArchivoSchema.safeParse(bruto)
      if (!r.success || !rutaRelativaSegura(r.data.mezcla)) {
        throw new ErrorImportacion('ERROR_INTERNO', 'El worker devolvió un resultado no válido.')
      }
      if (imp.controlador.signal.aborted)
        throw new ErrorImportacion('CANCELADO', 'Importación cancelada.')
      imp.resultado = r.data
      imp.estado = 'lista'
      return {
        importacionId: imp.id,
        nombre: r.data.nombre_original,
        duracionMs: r.data.duracion_ms,
        metadatos: {
          titulo: r.data.metadatos.titulo,
          artista: r.data.metadatos.artista,
          album: r.data.metadatos.album
        },
        gananciaDb: r.data.ganancia_db,
        larga: r.data.duracion_ms > UMBRAL_LARGA_MS
      }
    } catch (e) {
      imp.terminar()
      if (this.actual === imp) this.actual = null
      await this.borrarCarpeta(imp.id)
      throw this.aErrorImportacion(e)
    }
  }

  /**
   * Cancela la lectura en curso y borra su carpeta. Sin `id` cancela la que esté leyendo (el renderer
   * aún no conoce el id mientras lee); con `id` desconocido falla con `ARGUMENTOS_NO_VALIDOS`.
   */
  async cancelar(id?: string): Promise<void> {
    if (id === undefined) {
      if (this.actual?.estado === 'leyendo') await this.liberarActual()
      return
    }
    await this.descartar(id)
  }

  /** Aborta (si hace falta) y borra la carpeta de la importación: Cancelar, ‹ Biblioteca, Esc. */
  async descartar(id: string): Promise<void> {
    const imp = this.actual
    if (!imp || imp.id !== id || imp.estado === 'confirmando') throw desconocida(id)
    await this.liberarActual()
  }

  /** Crea la canción con los metadatos revisados y los datos del worker guardados en main. */
  async confirmar(
    id: string,
    metadatos: MetadatosEditables,
    opciones?: { cancionId: string }
  ): Promise<ResumenCancion> {
    const imp = this.actual
    if (!imp || imp.id !== id || imp.estado !== 'lista' || !imp.resultado) throw desconocida(id)
    const m = metadatosEditablesSchema.safeParse(metadatos)
    if (!m.success) {
      throw new ErrorImportacion('ARGUMENTOS_NO_VALIDOS', 'Los metadatos no son válidos.')
    }
    const r = imp.resultado
    const album = m.data.album?.trim() ?? ''
    if (opciones && this.deps.hayTrabajoVivo?.(opciones.cancionId)) {
      throw new ErrorImportacion('ARGUMENTOS_NO_VALIDOS', 'La canción tiene un trabajo en marcha.')
    }
    imp.estado = 'confirmando'
    try {
      if (opciones) {
        // Sustitución de la fuente de la misma canción (preguntas/0014 §3): conserva id, estilo y letra.
        const resumen = await this.deps.biblioteca.sustituirFuente(opciones.cancionId, {
          mezclaOrigen: join(imp.ruta, r.mezcla),
          metadatos: {
            titulo: m.data.titulo.trim(),
            artista: m.data.artista.trim(),
            album: album === '' ? null : album,
            duracion_ms: r.duracion_ms
          },
          fuente: {
            tipo: 'archivo',
            nombre_original: r.nombre_original,
            url: null,
            youtube_id: null,
            mezcla: r.mezcla,
            miniatura: null,
            ganancia_db: r.ganancia_db
          }
        })
        this.actual = null
        await this.borrarCarpeta(id)
        return resumen
      }
      const resumen = await this.deps.biblioteca.materializar(id, {
        metadatos: {
          titulo: m.data.titulo.trim(),
          artista: m.data.artista.trim(),
          album: album === '' ? null : album,
          duracion_ms: r.duracion_ms
        },
        fuente: {
          tipo: 'archivo',
          nombre_original: r.nombre_original,
          url: null,
          youtube_id: null,
          mezcla: r.mezcla,
          miniatura: null,
          ganancia_db: r.ganancia_db
        },
        pasos: {
          fuente: {
            estado: 'completado',
            actualizado: (this.deps.ahora?.() ?? new Date()).toISOString(),
            error: null
          }
        }
      })
      this.actual = null
      this.deps.alFuenteLista?.(id)
      return resumen
    } catch (e) {
      // Si no se pudo materializar, la importación sigue viva para reintentar o descartar.
      imp.estado = 'lista'
      throw e
    }
  }

  /** Cierre de la app: aborta el proceso y borra la carpeta de una importación sin confirmar. */
  async cerrar(): Promise<void> {
    await this.arranque.catch(() => undefined)
    if (this.actual && this.actual.estado !== 'confirmando') await this.liberarActual()
  }

  // --- internos ---

  private enSerieArranque<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.arranque.then(fn, fn)
    this.arranque = p.catch(() => undefined)
    return p
  }

  private async liberarActual(): Promise<void> {
    const imp = this.actual
    if (!imp) return
    this.actual = null
    imp.controlador.abort()
    await imp.fin
    await this.borrarCarpeta(imp.id)
  }

  private async borrarCarpeta(id: string): Promise<void> {
    try {
      await this.deps.biblioteca.descartarImportacion(id)
    } catch (e) {
      this.deps.registrar?.('aviso', `no se pudo borrar la importación ${id}: ${String(e)}`)
    }
  }

  private aErrorImportacion(e: unknown): Error {
    if (e instanceof ErrorImportacion) return e
    const t = e as Partial<ErrorTrabajo> | null
    if (t && typeof t.codigo === 'string' && typeof t.mensaje === 'string') {
      const codigo = esCodigoError(t.codigo) ? t.codigo : 'ERROR_INTERNO'
      return new ErrorImportacion(codigo, t.mensaje, t.detalles, t.reintentable ?? false)
    }
    this.deps.registrar?.('error', `importar-archivo: ${String(e)}`)
    return new ErrorImportacion('ERROR_INTERNO', 'Algo salió mal.')
  }

  /** Archivo regular, legible y fuera del directorio de datos (resolviendo enlaces simbólicos). */
  private async comprobarEntrada(ruta: string): Promise<string> {
    if (!isAbsolute(ruta)) {
      throw new ErrorImportacion('ARGUMENTOS_NO_VALIDOS', 'La ruta debe ser absoluta.')
    }
    let real: string
    try {
      real = await realpath(ruta)
      const info = await stat(real)
      if (!info.isFile()) {
        throw new ErrorImportacion('ARGUMENTOS_NO_VALIDOS', 'La ruta no es un archivo.')
      }
      await access(real, constants.R_OK)
    } catch (e) {
      if (e instanceof ErrorImportacion) throw e
      throw new ErrorImportacion('FORMATO_NO_SOPORTADO', 'No se puede leer el archivo.')
    }
    let datos: string
    try {
      datos = await realpath(this.deps.dirDatos)
    } catch {
      datos = resolve(this.deps.dirDatos)
    }
    const rel = relative(datos, real)
    if (rel === '' || (rel.split(sep)[0] !== '..' && !isAbsolute(rel))) {
      throw new ErrorImportacion(
        'ARGUMENTOS_NO_VALIDOS',
        'No se pueden importar archivos del directorio de datos de la aplicación.'
      )
    }
    return real
  }
}

/** Subconjunto de `electron.dialog` que usa el selector. */
export interface DialogoArchivos {
  showOpenDialog(opciones: {
    properties: 'openFile'[]
    filters: { name: string; extensions: string[] }[]
  }): Promise<{ canceled: boolean; filePaths: string[] }>
}

/** `sistema.elegirArchivoAudio()`: ruta elegida o `null` si se cancela. */
export async function elegirArchivoAudio(dialogo: DialogoArchivos): Promise<string | null> {
  const r = await dialogo.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Audio y vídeo', extensions: [...EXTENSIONES_AUDIO_VIDEO] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ]
  })
  return r.canceled || r.filePaths.length === 0 ? null : (r.filePaths[0] ?? null)
}
