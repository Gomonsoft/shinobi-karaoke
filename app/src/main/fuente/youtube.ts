import { access, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  analizarUrlYoutube,
  esCodigoError,
  metadatosEditablesSchema,
  resultadoDescargarYoutubeSchema,
  resultadoInfoYoutubeSchema,
  type Cancion,
  type CodigoError,
  type MetadatosEditables,
  type ResultadoInfoYoutube
} from '../../shared'
import type { CambioCancion, DatosNuevaCancion, ResumenCancion } from '../biblioteca'
import {
  esperarCancelable,
  type ErrorTrabajo,
  type OpcionesEjecucion,
  type PeticionTrabajo,
  type PoliticaReintento
} from '../trabajos'

/**
 * Módulo desactivable (ADR 0003, mitigación 5): `SHINOBI_SIN_YOUTUBE=1` al compilar lo desactiva
 * (electron-vite lo inyecta como `__SHINOBI_YOUTUBE__`). Sin definir (pruebas, `dev`), está activo.
 */
declare const __SHINOBI_YOUTUBE__: boolean | undefined
export const YOUTUBE_ACTIVO: boolean =
  typeof __SHINOBI_YOUTUBE__ === 'undefined' ? true : __SHINOBI_YOUTUBE__

/** Máximo de consultas guardadas en main y su vida máxima. */
export const MAX_CONSULTAS = 5
export const VIDA_CONSULTA_MS = 30 * 60_000

const MEZCLA = 'fuente/mezcla.flac'
const MINIATURA = 'fuente/miniatura.jpg'

/** Error de la fuente YouTube con código estable y, si viene del worker, sus últimas líneas. */
export class ErrorYoutube extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
    readonly detalles?: string,
    readonly reintentable = false
  ) {
    super(mensaje)
    this.name = 'ErrorYoutube'
  }
}

const argumentos = (mensaje: string): ErrorYoutube =>
  new ErrorYoutube('ARGUMENTOS_NO_VALIDOS', mensaje)

/**
 * Cerrojo de lectura de yt-dlp (ADR 0009 Revisiones §1). Cada proceso `info-youtube` o
 * `descargar-youtube` es un lector; la actualización (0050) es el escritor.
 */
export interface OpcionesLecturaCerrojo {
  /** Se llama si la lectura tiene que esperar a una actualización (0050). */
  alEsperar?: () => void
  /** Abortar mientras espera rechaza con `CANCELADO` sin entrar. */
  señal?: AbortSignal
}

export interface CerrojoYtdlp {
  conLectura<T>(fn: () => Promise<T>, opciones?: OpcionesLecturaCerrojo): Promise<T>
}

/** Cerrojo que no espera a nadie (pruebas). */
export const cerrojoTrivial: CerrojoYtdlp = { conLectura: (fn) => fn() }

/** Opciones del cliente del worker más el aviso de espera por mantenimiento (0050). */
export type OpcionesConCerrojo = OpcionesEjecucion & { alEsperar?: () => void }

type Ejecutar = (
  comando: string,
  args: Record<string, unknown>,
  opciones?: OpcionesConCerrojo
) => Promise<Record<string, unknown>>

const COMANDOS_YTDLP = new Set(['info-youtube', 'descargar-youtube'])

/** Envuelve el cliente del worker: los comandos de yt-dlp pasan por el cerrojo de lectura. */
export function ejecutarConCerrojo(ejecutar: Ejecutar, cerrojo: CerrojoYtdlp): Ejecutar {
  return (comando, args, opciones) =>
    COMANDOS_YTDLP.has(comando)
      ? cerrojo.conLectura(() => ejecutar(comando, args, opciones), {
          ...(opciones?.alEsperar ? { alEsperar: opciones.alEsperar } : {}),
          ...(opciones?.señal ? { señal: opciones.señal } : {})
        })
      : ejecutar(comando, args, opciones)
}

/**
 * Entorno extra del worker (ADR 0009 §8): `SHINOBI_YTDLP_FALSO` solo se pasa sin empaquetar.
 * Empaquetada, el llamador debe además quitarlo de `process.env` (ver `index.ts`).
 */
export function entornoYtdlpFalso(
  env: Record<string, string | undefined>,
  empaquetada: boolean
): Record<string, string> {
  const valor = env.SHINOBI_YTDLP_FALSO
  return !empaquetada && valor ? { SHINOBI_YTDLP_FALSO: valor } : {}
}

/** Subconjunto de la biblioteca que usa el servicio. */
export interface BibliotecaYoutube {
  crear(datos: DatosNuevaCancion): Promise<ResumenCancion>
  obtener(id: string): Cancion | null
  actualizar(id: string, cambio: CambioCancion): Promise<ResumenCancion>
}

/** Subconjunto del gestor de trabajos. */
export interface GestorYoutube {
  encolar(peticion: PeticionTrabajo): unknown
  listar(): { cancionId: string }[]
}

export interface DependenciasYoutube {
  biblioteca: BibliotecaYoutube
  gestor: GestorYoutube
  /** Cliente del worker (0013), ya con el cerrojo aplicado (`ejecutarConCerrojo`). */
  ejecutar: Ejecutar
  config: { obtener(): { aviso_youtube_aceptado: string | null } }
  /** Directorio de datos de la app (contiene `biblioteca/`). */
  dirDatos: string
  ahora?: () => Date
  registrar?: (nivel: 'aviso' | 'error', mensaje: string) => void
  /** Actualiza yt-dlp (0050); si falta, un bloqueo no se reintenta. */
  actualizarYtDlp?: () => Promise<unknown>
  /** Avisa al renderer de que la consulta espera o provoca una actualización (`fuente.estadoInfo`). */
  alEstadoInfo?: (evento: { consultaId: string; fase: 'actualizando' }) => void
}

/** Lo que recibe el renderer tras consultar. La URL canónica y los bytes se quedan en main. */
export interface InfoYoutube {
  consultaId: string
  idVideo: string
  tituloOriginal: string
  canal: string
  duracionS: number
  metadatos: { titulo: string; artista: string; album: string }
  miniaturaDataUrl: string | null
}

interface Consulta {
  id: string
  urlCanonica: string
  info: ResultadoInfoYoutube
  miniatura: Buffer | null
  creada: number
  confirmando: boolean
}

/** Esperas de los reintentos de red de la descarga: 5, 15 y 45 s (arquitectura.md §6; 0063). */
export const ESPERAS_REINTENTO_RED_MS = [5000, 15_000, 45_000] as const

/**
 * Política de reintento de `descargar-youtube`: solo los errores de red (`SIN_CONEXION`,
 * `SERVICIO_NO_DISPONIBLE`) se repiten, hasta 3 veces con espera exponencial. `YOUTUBE_BLOQUEADO`
 * sigue su flujo propio (actualizar yt-dlp, 0050) y el resto falla sin reintento.
 */
export const politicaReintentoDescarga: PoliticaReintento = (error, intento, args) => {
  const espera = ESPERAS_REINTENTO_RED_MS[intento - 1]
  if (espera === undefined) return null
  if (error.codigo !== 'SIN_CONEXION' && error.codigo !== 'SERVICIO_NO_DISPONIBLE') return null
  return { args, esperaMs: espera, motivo: 'red' }
}

const rutaRelativaSegura = (ruta: string): boolean =>
  !isAbsolute(ruta) && !/^[A-Za-z]:/.test(ruta) && !ruta.split(/[\\/]/).some((p) => p === '..')

/**
 * Servicio de YouTube (0049): consulta interactiva fuera de las colas, creación del borrador al
 * confirmar, descarga en la cola `ligera`, sustitución de la fuente y reintento.
 */
export class ServicioYoutube {
  private readonly consultas = new Map<string, Consulta>()
  private lectura: { controlador: AbortController; fin: Promise<void> } | null = null
  private readonly ocupadas = new Set<string>()

  constructor(private readonly deps: DependenciasYoutube) {}

  private ahora(): Date {
    return this.deps.ahora?.() ?? new Date()
  }

  /** `fuente.infoYoutube`: valida, exige el aviso aceptado y ejecuta `info-youtube`. */
  async info(url: string): Promise<InfoYoutube> {
    const analisis = analizarUrlYoutube(url)
    if (!analisis.ok) {
      throw new ErrorYoutube(
        analisis.codigo,
        analisis.codigo === 'URL_NO_VALIDA'
          ? 'El enlace no es de un vídeo de YouTube.'
          : 'Ese enlace no es de un vídeo individual.'
      )
    }
    if (this.deps.config.obtener().aviso_youtube_aceptado === null) {
      throw argumentos('Falta aceptar el aviso legal de YouTube.')
    }
    // Una consulta nueva cancela la anterior (y espera a que su proceso muera).
    await this.cancelarLectura()
    const controlador = new AbortController()
    let terminar = (): void => undefined
    const fin = new Promise<void>((r) => (terminar = r))
    const propia = { controlador, fin }
    this.lectura = propia
    const consultaId = randomUUID()
    const avisarActualizando = (): void => {
      if (controlador.signal.aborted) return
      try {
        this.deps.alEstadoInfo?.({ consultaId, fase: 'actualizando' })
      } catch (e) {
        this.deps.registrar?.('aviso', `estadoInfo falló: ${String(e)}`)
      }
    }
    const lanzar = (): Promise<Record<string, unknown>> =>
      this.deps.ejecutar(
        'info-youtube',
        { url: analisis.urlCanonica },
        { señal: controlador.signal, alEsperar: avisarActualizando }
      )
    try {
      let bruto: Record<string, unknown>
      try {
        bruto = await lanzar()
      } catch (e) {
        // YouTube bloqueó la consulta: se actualiza yt-dlp y se repite una sola vez (0050).
        const actualizar = this.deps.actualizarYtDlp
        if (!actualizar || (e as { codigo?: unknown } | null)?.codigo !== 'YOUTUBE_BLOQUEADO') {
          throw e
        }
        avisarActualizando()
        // Cancelar la consulta no aborta la actualización: sigue en silencio.
        await esperarCancelable(actualizar(), controlador.signal, e)
        bruto = await lanzar()
      }
      if (controlador.signal.aborted) throw new ErrorYoutube('CANCELADO', 'Consulta cancelada.')
      const r = resultadoInfoYoutubeSchema.safeParse(bruto)
      if (!r.success || r.data.id_video !== analisis.idVideo) {
        throw new ErrorYoutube('ERROR_INTERNO', 'El worker devolvió un resultado no válido.')
      }
      const miniatura = r.data.miniatura_jpeg_base64
        ? Buffer.from(r.data.miniatura_jpeg_base64, 'base64')
        : null
      const consulta: Consulta = {
        id: consultaId,
        urlCanonica: analisis.urlCanonica,
        info: r.data,
        miniatura: miniatura && miniatura.length > 0 ? miniatura : null,
        creada: this.ahora().getTime(),
        confirmando: false
      }
      this.guardarConsulta(consulta)
      return {
        consultaId: consulta.id,
        idVideo: r.data.id_video,
        tituloOriginal: r.data.titulo_original,
        canal: r.data.canal,
        duracionS: r.data.duracion_s,
        metadatos: r.data.metadatos,
        miniaturaDataUrl: consulta.miniatura
          ? `data:image/jpeg;base64,${consulta.miniatura.toString('base64')}`
          : null
      }
    } catch (e) {
      throw this.aErrorYoutube(e, 'info-youtube')
    } finally {
      terminar()
      if (this.lectura === propia) this.lectura = null
    }
  }

  /**
   * `fuente.cancelarInfo`: sin id cancela la consulta en curso (el renderer aún no conoce su id);
   * con id descarta la consulta guardada (id desconocido: `ARGUMENTOS_NO_VALIDOS`).
   */
  async cancelarInfo(consultaId?: string): Promise<void> {
    if (consultaId === undefined) {
      await this.cancelarLectura()
      return
    }
    this.purgar()
    const c = this.consultas.get(consultaId)
    if (!c || c.confirmando) throw argumentos(`No hay una consulta con id ${consultaId}.`)
    this.consultas.delete(consultaId)
  }

  /**
   * `fuente.confirmarYoutube`: crea el borrador (o sustituye la fuente de `cancionId`) y encola
   * la descarga. El renderer nunca envía la URL: sale de la consulta guardada en main.
   */
  async confirmar(
    consultaId: string,
    metadatos: MetadatosEditables,
    opciones?: { cancionId: string }
  ): Promise<ResumenCancion> {
    this.purgar()
    const consulta = this.consultas.get(consultaId)
    if (!consulta || consulta.confirmando) {
      throw argumentos(`No hay una consulta con id ${consultaId}.`)
    }
    const m = metadatosEditablesSchema.safeParse(metadatos)
    if (!m.success) throw argumentos('Los metadatos no son válidos.')
    const datos = {
      titulo: m.data.titulo.trim(),
      artista: m.data.artista.trim(),
      album: (m.data.album?.trim() ?? '') === '' ? null : (m.data.album?.trim() ?? null),
      duracion_ms: Math.max(1, Math.round(consulta.info.duracion_s * 1000))
    }
    consulta.confirmando = true
    try {
      const resumen = opciones
        ? await this.sustituir(opciones.cancionId, consulta, datos)
        : await this.crear(consulta, datos)
      this.consultas.delete(consultaId)
      return resumen
    } catch (e) {
      consulta.confirmando = false
      throw this.aErrorYoutube(e, 'confirmar-youtube')
    }
  }

  /** `fuente.reintentar`: vuelve a encolar la descarga con la URL guardada en `cancion.json`. */
  async reintentar(cancionId: string): Promise<void> {
    const c = this.deps.biblioteca.obtener(cancionId)
    if (
      !c ||
      c.fuente.tipo !== 'youtube' ||
      !['pendiente', 'error', 'interrumpido'].includes(c.pasos.fuente.estado) ||
      this.hayTrabajoVivo(cancionId)
    ) {
      throw argumentos('No se puede reintentar la descarga de esta canción.')
    }
    const analisis = analizarUrlYoutube(c.fuente.url ?? '')
    if (!analisis.ok) throw argumentos('La canción no tiene un enlace de YouTube válido.')
    this.reservar(cancionId)
    try {
      await this.borrarRestos(cancionId)
      // El paso vuelve a `pendiente` ya: si la cola está ocupada, la UI ve una descarga en espera.
      await this.deps.biblioteca.actualizar(cancionId, {
        pasos: {
          fuente: {
            estado: 'pendiente',
            actualizado: this.ahora().toISOString(),
            error: null,
            progreso: null
          }
        }
      })
      this.encolar(cancionId, analisis.urlCanonica)
    } catch (e) {
      throw this.aErrorYoutube(e, 'reintentar')
    } finally {
      this.ocupadas.delete(cancionId)
    }
  }

  /** Cierre de la app: aborta la consulta en curso y olvida las guardadas. */
  async cerrar(): Promise<void> {
    await this.cancelarLectura()
    this.consultas.clear()
  }

  // --- internos ---

  private async crear(
    consulta: Consulta,
    metadatos: DatosNuevaCancion['metadatos']
  ): Promise<ResumenCancion> {
    const { biblioteca } = this.deps
    let resumen = await biblioteca.crear({
      metadatos,
      fuente: {
        tipo: 'youtube',
        nombre_original: null,
        url: consulta.urlCanonica,
        youtube_id: consulta.info.id_video,
        mezcla: MEZCLA,
        miniatura: null,
        ganancia_db: 0
      },
      pasos: {
        fuente: { estado: 'pendiente', actualizado: this.ahora().toISOString(), error: null }
      }
    })
    const id = resumen.id
    if (consulta.miniatura) {
      try {
        const dir = join(this.carpeta(id), 'fuente')
        await mkdir(dir, { recursive: true })
        await writeFile(join(dir, 'miniatura.jpg'), consulta.miniatura)
        resumen = await biblioteca.actualizar(id, { fuente: { miniatura: MINIATURA } })
      } catch (e) {
        this.deps.registrar?.('aviso', `no se pudo guardar la miniatura de ${id}: ${String(e)}`)
      }
    }
    this.encolar(id, consulta.urlCanonica)
    return resumen
  }

  /** Sustitución de la fuente de la misma canción (preguntas/0014 §3, ADR 0006 Revisiones). */
  private async sustituir(
    cancionId: string,
    consulta: Consulta,
    metadatos: DatosNuevaCancion['metadatos']
  ): Promise<ResumenCancion> {
    const previa = this.deps.biblioteca.obtener(cancionId)
    if (
      !previa ||
      !['pendiente', 'error', 'interrumpido'].includes(previa.pasos.fuente.estado) ||
      this.hayTrabajoVivo(cancionId)
    ) {
      throw argumentos('La fuente de esta canción no se puede sustituir.')
    }
    this.reservar(cancionId)
    try {
      const dir = join(this.carpeta(cancionId), 'fuente')
      if (await existe(join(dir, 'mezcla.flac'))) {
        throw argumentos('La canción ya tiene audio.')
      }
      // 1. Miniatura nueva (tmp + rename) o se borra la anterior.
      let miniatura: string | null = null
      if (consulta.miniatura) {
        try {
          await mkdir(dir, { recursive: true })
          await writeFile(join(dir, 'miniatura.jpg.tmp'), consulta.miniatura)
          await rename(join(dir, 'miniatura.jpg.tmp'), join(dir, 'miniatura.jpg'))
          miniatura = MINIATURA
        } catch (e) {
          await rm(join(dir, 'miniatura.jpg.tmp'), { force: true })
          this.deps.registrar?.('aviso', `no se pudo guardar la miniatura: ${String(e)}`)
        }
      }
      if (miniatura === null) await rm(join(dir, 'miniatura.jpg'), { force: true })
      // 2. Borra la descarga anterior.
      await borrarDescargas(dir)
      // 3. Una escritura atómica de cancion.json.
      const resumen = await this.deps.biblioteca.actualizar(cancionId, {
        metadatos,
        fuente: {
          tipo: 'youtube',
          nombre_original: null,
          url: consulta.urlCanonica,
          youtube_id: consulta.info.id_video,
          mezcla: MEZCLA,
          miniatura,
          ganancia_db: 0
        },
        pasos: {
          fuente: {
            estado: 'pendiente',
            actualizado: this.ahora().toISOString(),
            error: null,
            progreso: null
          }
        }
      })
      // 4. Encola la descarga.
      this.encolar(cancionId, consulta.urlCanonica)
      return resumen
    } finally {
      this.ocupadas.delete(cancionId)
    }
  }

  private encolar(cancionId: string, url: string): void {
    const carpeta = this.carpeta(cancionId)
    this.deps.gestor.encolar({
      cancionId,
      paso: 'fuente',
      cola: 'ligera',
      comando: 'descargar-youtube',
      args: { url, salida: carpeta },
      politicaReintento: politicaReintentoDescarga,
      alResultado: (bruto) => {
        const r = resultadoDescargarYoutubeSchema.safeParse(bruto)
        if (!r.success || r.data.mezcla !== MEZCLA || !rutaRelativaSegura(r.data.mezcla)) {
          throw new ErrorYoutube('ERROR_INTERNO', 'El worker devolvió un resultado no válido.')
        }
        return {
          fuente: { mezcla: r.data.mezcla, ganancia_db: r.data.ganancia_db },
          ...(r.data.duracion_ms > 0 ? { metadatos: { duracion_ms: r.data.duracion_ms } } : {})
        }
      },
      alDescartar: async () => {
        await borrarDescargas(join(carpeta, 'fuente'))
        await rm(join(carpeta, 'fuente', 'mezcla.flac.tmp'), { force: true })
      }
    })
  }

  private async borrarRestos(cancionId: string): Promise<void> {
    const dir = join(this.carpeta(cancionId), 'fuente')
    await borrarDescargas(dir)
    await rm(join(dir, 'mezcla.flac.tmp'), { force: true })
  }

  private carpeta(id: string): string {
    return join(this.deps.dirDatos, 'biblioteca', id)
  }

  private hayTrabajoVivo(cancionId: string): boolean {
    return (
      this.ocupadas.has(cancionId) ||
      this.deps.gestor.listar().some((t) => t.cancionId === cancionId)
    )
  }

  /** Evita dos operaciones simultáneas sobre la misma canción (doble clic, dos ventanas). */
  private reservar(cancionId: string): void {
    if (this.ocupadas.has(cancionId)) throw argumentos('La canción tiene una operación en marcha.')
    this.ocupadas.add(cancionId)
  }

  private async cancelarLectura(): Promise<void> {
    const l = this.lectura
    if (!l) return
    this.lectura = null
    l.controlador.abort()
    await l.fin
  }

  private guardarConsulta(c: Consulta): void {
    this.purgar()
    while (this.consultas.size >= MAX_CONSULTAS) {
      const mas = this.consultas.keys().next().value
      if (mas === undefined) break
      this.consultas.delete(mas)
    }
    this.consultas.set(c.id, c)
  }

  /** Descarta las consultas de más de 30 min. */
  private purgar(): void {
    const limite = this.ahora().getTime() - VIDA_CONSULTA_MS
    for (const [id, c] of this.consultas)
      if (c.creada < limite && !c.confirmando) this.consultas.delete(id)
  }

  private aErrorYoutube(e: unknown, contexto: string): Error {
    if (e instanceof ErrorYoutube) return e
    if (e instanceof Error && esCodigoError((e as { codigo?: unknown }).codigo)) return e
    const t = e as Partial<ErrorTrabajo> | null
    if (t && typeof t.codigo === 'string' && typeof t.mensaje === 'string') {
      const codigo = esCodigoError(t.codigo) ? t.codigo : 'ERROR_INTERNO'
      return new ErrorYoutube(codigo, t.mensaje, t.detalles, t.reintentable ?? false)
    }
    this.deps.registrar?.('error', `${contexto}: ${String(e)}`)
    return new ErrorYoutube('ERROR_INTERNO', 'Algo salió mal.')
  }
}

async function existe(ruta: string): Promise<boolean> {
  try {
    await access(ruta)
    return true
  } catch {
    return false
  }
}

/** Borra `fuente/descarga.*` (restos de una descarga anterior o cancelada). */
async function borrarDescargas(dirFuente: string): Promise<void> {
  for (const nombre of await readdir(dirFuente).catch(() => [] as string[])) {
    if (nombre.startsWith('descarga.')) await rm(join(dirFuente, nombre), { force: true })
  }
}
