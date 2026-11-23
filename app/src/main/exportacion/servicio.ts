import { randomUUID } from 'node:crypto'
import { access } from 'node:fs/promises'
import { dirname, basename, isAbsolute, join, relative, resolve } from 'node:path'
import type { Writable } from 'node:stream'
import { modalidadEfectiva, type Cancion } from '../../shared/cancion'
import type { Config } from '../../shared/config'
import { esCodigoError, type CodigoError } from '../../shared/errores'
import type { Estilo } from '../../shared/estilo'
import {
  FORMATOS,
  FORMATOS_ID,
  RESOLUCIONES,
  FPS,
  PROPORCIONES,
  acotarFactorCorrector,
  esCombinacionValida,
  estimarBytes,
  estimarSegundos,
  memoriaMinimaDe,
  nombrePropuesto,
  parametrosDe,
  perfilCompatibleConSesion,
  totalFotogramas,
  type AudioExportacion,
  type AvisoExportacionIpc,
  type DestinoIpc,
  type DetalleErrorExportacion,
  type EstimacionExportacionIpc,
  type ExportacionIpc,
  type FaseExportacion,
  type FormatoId,
  type InstantaneaExportacion,
  type PerfilesIpc,
  type Proporcion,
  type ProgresoExportacionIpc,
  type PerfilIpc
} from '../../shared/exportacion'
import type {
  CarpetaDestinoIpc,
  IniciarExportacion,
  IniciarLoteExportacion,
  ResultadoLoteExportacionIpc
} from '../../shared/ipc'
import type { MensajeWorker } from '../../shared/protocolo'
import type { ConfigParcial } from '../configuracion'
import { EstimadorProgreso } from '../trabajos/progreso'
import type { OpcionesEjecucion } from '../trabajos/worker'
import { ejecutarBucle } from './bucle'
import { ErrorDestino, type Destinos } from './destinos'
import type { DiarioExportacion } from './diario'
import type { OpcionesExportacion, VentanaExportacion } from './ventana'

/** Error del servicio con código estable de la IPC (`aErrorIpc` lo traduce). */
export class ErrorExportacion extends Error {
  readonly detalles: string | undefined

  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
    detalles?: string,
    /** 0.2.1: `{ trabajoId }` de `CANCION_EXPORTANDOSE`, `{ causa, reintentable }` de la captura. */
    readonly detalle?: DetalleErrorExportacion
  ) {
    super(mensaje)
    this.name = 'ErrorExportacion'
    // `aErrorIpc` solo transporta `detalles` (texto): el `detalle` viaja serializado (pregunta 0151).
    this.detalles = detalles ?? (detalle ? JSON.stringify(detalle) : undefined)
  }
}

/** Textos de la notificación del sistema (los de `exp.toast.ok` y `exp.toast.error` de la spec 10). */
export const AVISOS_EXPORTACION = {
  ok: (titulo: string): string => `«${titulo}»: video exportado.`,
  error: (titulo: string): string => `«${titulo}»: no se pudo exportar el video.`,
  /** Los de `exp.lote.toast`: uno por lote, no uno por video. */
  lote: (hechos: number, total: number): string =>
    hechos === 0
      ? 'No se pudo exportar ningún video.'
      : hechos === total
        ? `${total} videos exportados.`
        : `Se exportaron ${hechos} de ${total} videos.`
} as const

/** Eventos de progreso: como mucho 4 por segundo y al menos 1 cada 2 s (ADR 0019 §11). */
export const INTERVALO_MIN_PROGRESO_MS = 250
export const INTERVALO_MAX_PROGRESO_MS = 2000
/** Plazo para que el documento de la ventana offscreen pida su instantánea. */
export const PLAZO_VENTANA_LISTA_MS = 30_000
/** Terminadas que se recuerdan para `estado()` y «Reintentar». */
export const MAX_TERMINADAS = 50
const MAX_AVISOS = 20
/** Lotes recordados para `reintentarLote`. */
const MAX_LOTES = 20

/** Subconjunto de `ServicioBiblioteca` que usa el servicio. */
export interface BibliotecaExportacion {
  obtener(id: string): Cancion | null
  /** Estilo resuelto con su procedencia y los reemplazos de espera (ADR 0016, fase 5). */
  estiloDe(cancion: Cancion): Estilo
}

export interface BloqueadorSuspension {
  start(tipo: 'prevent-app-suspension'): number
  stop(id: number): void
  isStarted(id: number): boolean
}

type EjecutarWorker = (
  comando: string,
  args: Record<string, unknown>,
  opciones?: OpcionesEjecucion
) => Promise<Record<string, unknown>>

export interface DependenciasServicioExportacion<V = unknown> {
  biblioteca: BibliotecaExportacion
  /** Directorio de datos: las pistas cuelgan de `biblioteca/<id>/`. */
  dirDatos: string
  config: { obtener(): Config; actualizar(parcial: ConfigParcial): Promise<unknown> }
  destinos: Pick<
    Destinos<V>,
    | 'destinoPropuesto'
    | 'destinoDesdeRuta'
    | 'elegirDestino'
    | 'consumir'
    | 'rutaDe'
    | 'carpetaPropuesta'
    | 'elegirCarpeta'
    | 'rutaDeCarpeta'
    | 'consumirCarpeta'
    | 'rutaTemporal'
    | 'sustituir'
    | 'limpiar'
  >
  diario: Pick<DiarioExportacion, 'escribir' | 'borrar' | 'recuperarAlArrancar'>
  ejecutar: EjecutarWorker
  /** Ventana offscreen (0234). */
  crearVentana(opciones: OpcionesExportacion): Promise<VentanaExportacion>
  /**
   * ¿Puede el equipo capturar una ventana de ese tamaño? (`probarCaptura` de `ventana.ts`, 0260).
   * Rechaza con una excepción si el sondeo falla; sin esta dependencia no se sondea.
   */
  probarCaptura?(ancho: number, alto: number): Promise<boolean>
  /** Tope del sondeo de captura al pedir los perfiles (10 s por omisión; V32). */
  plazoSondeoCapturaMs?: number
  /** Ventana principal, para el diálogo «Guardar». */
  ventanaPrincipal(): V
  /** `fs.access`; por defecto el real. */
  existe?(ruta: string): Promise<boolean>
  /** Espacio libre de la carpeta de un lote, en bytes; `null` si no se sabe (por omisión no se comprueba). */
  libreBytes?(carpeta: string): Promise<number | null>
  /** `shell.showItemInFolder`. */
  mostrarEnCarpeta(ruta: string): void
  /** Notificación del sistema con la principal sin foco (`ServicioAvisos.avisarSistema`). */
  avisarSistema?(texto: string): void
  bloqueador?: BloqueadorSuspension
  /** `os.totalmem()`. */
  memoriaTotal(): number
  /** `os.cpus().length`. */
  nucleos(): number
  plataforma?: NodeJS.Platform
  ahora?: () => number
  uuid?: () => string
  registrar?(nivel: 'info' | 'aviso' | 'error', mensaje: string): void
}

interface CapacidadFormato {
  disponible: boolean
  max_16_9: boolean
  max_4_3: boolean
}
type Capacidades = Record<FormatoId, CapacidadFormato>

/** Un lote de exportación (ADR 0026 §5): las opciones y la carpeta, para reintentarlo. */
interface Lote {
  id: string
  perfil: { formato: FormatoId; ancho: number; alto: number; fps: 24 | 30 | 60 }
  audio: AudioExportacion
  siExiste: IniciarLoteExportacion['siExiste']
  carpeta: string
  /** Último destino de cada canción en este lote. */
  destinos: Map<string, string>
  /** Fallidas o no intentadas: lo que `reintentarLote` vuelve a encolar. */
  fallidas: Set<string>
  cancionIds: string[]
  /** Aún no se notificó su fin (una sola notificación del sistema por tanda). */
  abierto: boolean
  /** Encoladas y completadas de esta tanda (para el aviso del sistema). */
  total: number
  completadas: number
}

interface Trabajo {
  id: string
  cancionId: string
  titulo: string
  artista: string
  formato: FormatoId
  ancho: number
  alto: number
  fps: 24 | 30 | 60
  audio: AudioExportacion
  destino: string
  temporal: string
  instantanea: InstantaneaExportacion
  rutas: { instrumental: string; voz: string | null }
  total: number
  estado: ExportacionIpc['estado']
  resultado: ExportacionIpc['resultado']
  error: ExportacionIpc['error']
  progreso: ProgresoExportacionIpc | null
  bytes: number | null
  fotogramas: number | null
  destinoExistia: boolean
  iniciadaEn: string | null
  iniciadaMs: number | null
  terminadaEn: string | null
  limpiezaFallida: boolean
  /** Temporal que no se pudo borrar (para `mostrarEnCarpeta`). */
  temporalPendiente: string | null
  posicion: number | null
  /** Solo en las de un lote. */
  loteId: string | null
  control: AbortController
  fin: Promise<void>
  cerrarFin: () => void
}

const existeReal = (ruta: string): Promise<boolean> =>
  access(ruta).then(
    () => true,
    () => false
  )

const codigoDe = (e: unknown): string | undefined =>
  typeof e === 'object' && e !== null ? (e as { codigo?: string }).codigo : undefined

const mensajeDe = (e: unknown): string =>
  typeof e === 'object' && e !== null && typeof (e as { mensaje?: unknown }).mensaje === 'string'
    ? (e as { mensaje: string }).mensaje
    : e instanceof Error
      ? e.message
      : String(e)

/** Un error cualquiera, ya con el catálogo de la IPC. `PROCESO_TERMINADO` y `ENTRADA_INCOMPLETA` se traducen (spec 10). */
function traducirError(e: unknown): { codigo: CodigoError; mensaje: string; detalles?: string } {
  let codigo = codigoDe(e)
  if (codigo === 'PROCESO_TERMINADO') codigo = 'MEMORIA_INSUFICIENTE'
  if (codigo === 'ENTRADA_INCOMPLETA') codigo = 'ERROR_INTERNO'
  const final: CodigoError = esCodigoError(codigo) ? codigo : 'ERROR_INTERNO'
  const detalles = (e as { detalles?: unknown } | null)?.detalles
  return {
    codigo: final,
    mensaje: mensajeDe(e),
    ...(typeof detalles === 'string' && detalles ? { detalles } : {})
  }
}

function esperarCon<T>(promesa: Promise<T>, ms: number, error: () => Error): Promise<T> {
  return new Promise<T>((resolver, rechazar) => {
    const t = setTimeout(() => rechazar(error()), ms)
    promesa.then(
      (v) => {
        clearTimeout(t)
        resolver(v)
      },
      (e: unknown) => {
        clearTimeout(t)
        rechazar(e)
      }
    )
  })
}

/**
 * Servicio de exportación de video (0237, ADR 0019): cola de concurrencia 1, perfiles, destinos,
 * instantánea y orquestación del worker `exportar`, la ventana offscreen y el bucle de fotogramas.
 */
export class ServicioExportacion<V = unknown> {
  private readonly cola: Trabajo[] = []
  private actual: Trabajo | null = null
  private readonly terminadas = new Map<string, Trabajo>()
  /** Canciones y destinos con un `iniciar` en vuelo (antes de estar en la cola). */
  private readonly reservasCancion = new Map<string, string>()
  private readonly reservasDestino = new Set<string>()
  /** Lotes de esta sesión (para reintentarlos); los más viejos se olvidan. */
  private readonly lotes = new Map<string, Lote>()
  private sondeo: Promise<Capacidades> | null = null
  /** Sondeo de captura de este arranque (una vez); las proporciones ya resueltas y su alto máximo. */
  private sondeoCaptura: Promise<void> | null = null
  private readonly proporcionesSondeadas = new Set<Proporcion>()
  private readonly altoMaximoCaptura = new Map<Proporcion, number>()
  /** Tamaños que una recomprobación dio por no capturables hasta reiniciar. */
  private readonly noCapturables = new Set<string>()
  private avisosPendientes_: AvisoExportacionIpc[] = []
  private readonly rutasAviso = new Map<string, string>()
  private bloqueo: number | null = null
  private readonly oyentesCambio = new Set<(e: ExportacionIpc) => void>()
  private readonly oyentesProgreso = new Set<(p: ProgresoExportacionIpc) => void>()
  private readonly oyentesAviso = new Set<(a: AvisoExportacionIpc) => void>()
  private readonly plataforma: NodeJS.Platform
  private readonly ahora: () => number
  private readonly uuid: () => string
  private readonly existe: (ruta: string) => Promise<boolean>

  constructor(private readonly deps: DependenciasServicioExportacion<V>) {
    this.plataforma = deps.plataforma ?? process.platform
    this.ahora = deps.ahora ?? Date.now
    this.uuid = deps.uuid ?? randomUUID
    this.existe = deps.existe ?? existeReal
  }

  // --- Suscripciones -----------------------------------------------------------------

  suscribir(cb: (e: ExportacionIpc) => void): () => void {
    this.oyentesCambio.add(cb)
    return () => this.oyentesCambio.delete(cb)
  }

  suscribirProgreso(cb: (p: ProgresoExportacionIpc) => void): () => void {
    this.oyentesProgreso.add(cb)
    return () => this.oyentesProgreso.delete(cb)
  }

  suscribirAviso(cb: (a: AvisoExportacionIpc) => void): () => void {
    this.oyentesAviso.add(cb)
    return () => this.oyentesAviso.delete(cb)
  }

  // --- Perfiles y estimaciones ------------------------------------------------------------

  /** Lanza el sondeo la primera vez y guarda el resultado; un fallo no se recuerda. */
  private capacidades(): Promise<Capacidades> {
    if (!this.sondeo) {
      const p = this.deps.ejecutar('capacidades-exportacion', {}).then((r) => leerCapacidades(r))
      this.sondeo = p
      p.catch(() => {
        if (this.sondeo === p) this.sondeo = null
      })
    }
    return this.sondeo
  }

  /** Las 48 combinaciones con `soportado` y `motivo`. Rechaza con `RUNTIME_NO_DISPONIBLE` si falta el motor. */
  async perfiles(): Promise<PerfilesIpc> {
    let capacidades: Capacidades | null = null
    try {
      const [c] = await Promise.all([this.capacidades(), this.esperarSondeoCaptura()])
      capacidades = c
    } catch (e) {
      if (codigoDe(e) === 'RUNTIME_NO_DISPONIBLE') {
        throw new ErrorExportacion('RUNTIME_NO_DISPONIBLE', 'El motor de audio no está instalado.')
      }
      this.deps.registrar?.('aviso', `exportación: falló el sondeo de capacidades: ${String(e)}`)
    }
    const memoria = this.deps.memoriaTotal()
    const perfiles: PerfilIpc[] = FORMATOS_ID.flatMap((formato) =>
      RESOLUCIONES.flatMap((r) =>
        FPS.map((fps): PerfilIpc => {
          const base = { formato, proporcion: r.proporcion, ancho: r.ancho, alto: r.alto, fps }
          if (!capacidades) return { ...base, soportado: false, motivo: 'no_comprobado' }
          const c = capacidades[formato]
          const abre = r.proporcion === '16:9' ? c.max_16_9 : c.max_4_3
          if (!c.disponible || !abre) return { ...base, soportado: false, motivo: 'codificador' }
          const minima = memoriaMinimaDe(r.ancho, r.alto)
          if (minima !== null && memoria < minima) {
            return { ...base, soportado: false, motivo: 'memoria' }
          }
          if (this.noCapturables.has(`${r.ancho}x${r.alto}`)) {
            return { ...base, soportado: false, motivo: 'captura' }
          }
          if (this.deps.probarCaptura) {
            if (!this.proporcionesSondeadas.has(r.proporcion)) {
              return { ...base, soportado: false, motivo: 'no_comprobado' }
            }
            const maximo = this.altoMaximoCaptura.get(r.proporcion)
            if (maximo !== undefined && r.alto > maximo) {
              return { ...base, soportado: false, motivo: 'captura' }
            }
          }
          return { ...base, soportado: true, motivo: null }
        })
      )
    )
    return {
      formatos: FORMATOS_ID.map((id) => ({ id, extension: FORMATOS[id].extension })),
      perfiles
    }
  }

  /**
   * Lanza el sondeo de captura la primera vez (una ventana a la vez; por proporción, de la
   * resolución mayor a la menor) y espera como mucho 10 s: lo no comprobado sale `no_comprobado`.
   * Una excepción no marca nada y se registra; el resultado dura todo el arranque.
   */
  private esperarSondeoCaptura(): Promise<void> {
    const probar = this.deps.probarCaptura
    if (!probar) return Promise.resolve()
    this.sondeoCaptura ??= (async () => {
      for (const proporcion of PROPORCIONES) {
        const negados: string[] = []
        try {
          for (const r of RESOLUCIONES.filter((x) => x.proporcion === proporcion).reverse()) {
            const capturable = await probar(r.ancho, r.alto)
            this.deps.registrar?.(
              'info',
              `exportación: sondeo de captura ${r.ancho}×${r.alto}: ${capturable ? 'sí' : 'no'}`
            )
            if (capturable) {
              this.altoMaximoCaptura.set(proporcion, r.alto)
              break
            }
            negados.push(`${r.ancho}x${r.alto}`)
          }
        } catch (e) {
          // Los «no» ya obtenidos son firmes aunque falle el sondeo de un tamaño menor. Si todos
          // responden «no» sin error no se marca nada: sería más bien un sondeo averiado.
          for (const clave of negados) this.noCapturables.add(clave)
          this.deps.registrar?.(
            'aviso',
            `exportación: falló el sondeo de captura de ${proporcion}: ${String(e)}`
          )
        }
        this.proporcionesSondeadas.add(proporcion)
      }
    })()
    let temporizador: NodeJS.Timeout | undefined
    const plazo = new Promise<void>((res) => {
      temporizador = setTimeout(res, this.deps.plazoSondeoCapturaMs ?? 10_000)
    })
    return Promise.race([this.sondeoCaptura, plazo]).finally(() => clearTimeout(temporizador))
  }

  estimar(p: {
    cancionId: string
    formato: FormatoId
    alto: number
    fps: number
  }): EstimacionExportacionIpc {
    const cancion = this.deps.biblioteca.obtener(p.cancionId)
    const duracionMs = cancion?.metadatos.duracion_ms ?? 0
    if (!cancion || duracionMs <= 0) return { bytes: null, segundos: null }
    const estilo = this.deps.biblioteca.estiloDe(cancion)
    const entrada = {
      formato: p.formato,
      alto: p.alto,
      fps: p.fps,
      duracionMs,
      fondoMovil: estilo.fondo.tipo === 'degradado' && Boolean(estilo.fondo.movimiento)
    }
    return {
      bytes: estimarBytes(entrada),
      segundos: estimarSegundos({
        ...entrada,
        factorCorrector: this.deps.config.obtener().exportacion.factor_corrector
      })
    }
  }

  // --- Destinos ------------------------------------------------------------------------

  async destinoPropuesto(p: {
    cancionId: string
    formato: FormatoId
    desdeDestinoId?: string | undefined
    desdeTrabajoId?: string | undefined
  }): Promise<DestinoIpc> {
    const cancion = this.deps.biblioteca.obtener(p.cancionId)
    if (!cancion) {
      throw new ErrorExportacion('CANCION_NO_DISPONIBLE', 'La canción ya no está disponible.')
    }
    const datos = { titulo: cancion.metadatos.titulo, artista: cancion.metadatos.artista }
    const carpeta = this.deps.config.obtener().exportacion.carpeta
    if (p.desdeTrabajoId !== undefined) {
      const previo = this.trabajo(p.desdeTrabajoId)
      if (previo)
        return this.deps.destinos.destinoDesdeRuta(previo.destino, datos, p.formato, carpeta)
    }
    return this.deps.destinos.destinoPropuesto(datos, p.formato, carpeta, p.desdeDestinoId)
  }

  elegirDestino(destinoId: string): Promise<DestinoIpc | null> {
    return this.deps.destinos.elegirDestino(destinoId, this.deps.ventanaPrincipal())
  }

  // --- Iniciar y cancelar -------------------------------------------------------------------

  async iniciar(p: IniciarExportacion): Promise<{ trabajoId: string }> {
    await this.exigirPerfil({ formato: p.formato, ancho: p.ancho, alto: p.alto, fps: p.fps })
    const exportable = await this.leerCancion(p.cancionId, p.audio)
    const destinoRuta = this.deps.destinos.rutaDe(p.destinoId)
    if (destinoRuta === null) {
      throw new ErrorDestino('DESTINO_NO_DISPONIBLE', 'El destino caducó o ya se usó.')
    }
    const clave = this.claveDestino(destinoRuta)
    // Sin esperas desde aquí hasta reservar: dos `iniciar` seguidos no se cuelan.
    const existente = this.activaDe(p.cancionId)?.id ?? this.reservasCancion.get(p.cancionId)
    if (existente !== undefined) {
      throw new ErrorExportacion(
        'CANCION_EXPORTANDOSE',
        'La canción ya tiene una exportación en marcha.',
        undefined,
        { trabajoId: existente }
      )
    }
    if (this.destinoEnUso(clave) || this.reservasDestino.has(clave)) {
      throw new ErrorExportacion('DESTINO_OCUPADO', 'Otra exportación usa ese archivo.')
    }
    const id = this.uuid()
    this.reservasCancion.set(p.cancionId, id)
    this.reservasDestino.add(clave)
    try {
      // Solo ahora se gasta el `destinoId`: un rechazo anterior lo deja vigente.
      const destino = await this.deps.destinos.consumir(p.destinoId)
      const t = await this.crearTrabajo(p, destino, exportable, id, null)
      this.cola.push(t)
      await this.guardarOpciones(p)
      this.avanzar()
      if (t.estado === 'en_cola') {
        this.renumerar(false)
        this.emitir(t)
      }
      return { trabajoId: id }
    } finally {
      this.reservasCancion.delete(p.cancionId)
      this.reservasDestino.delete(clave)
    }
  }

  /** Construye el trabajo en cola (sin lanzarlo): el temporal, si ya había archivo y la instantánea. */
  private async crearTrabajo(
    p: Pick<IniciarExportacion, 'cancionId' | 'formato' | 'ancho' | 'alto' | 'fps' | 'audio'>,
    destino: string,
    exportable: { instantanea: InstantaneaExportacion; rutas: Trabajo['rutas'] },
    id: string,
    loteId: string | null
  ): Promise<Trabajo> {
    const temporal = this.deps.destinos.rutaTemporal(destino, id)
    const destinoExistia = await this.existe(destino)
    let cerrar: () => void = () => undefined
    const fin = new Promise<void>((res) => {
      cerrar = res
    })
    return {
      id,
      cancionId: p.cancionId,
      titulo: exportable.instantanea.titulo,
      artista: exportable.instantanea.artista,
      formato: p.formato,
      ancho: p.ancho,
      alto: p.alto,
      fps: p.fps,
      audio: p.audio,
      destino,
      temporal,
      instantanea: exportable.instantanea,
      rutas: exportable.rutas,
      total: totalFotogramas(exportable.instantanea.duracionMs, p.fps),
      estado: 'en_cola',
      resultado: null,
      error: null,
      progreso: null,
      bytes: null,
      fotogramas: null,
      destinoExistia,
      iniciadaEn: null,
      iniciadaMs: null,
      terminadaEn: null,
      limpiezaFallida: false,
      temporalPendiente: null,
      posicion: null,
      loteId,
      control: new AbortController(),
      fin,
      cerrarFin: cerrar
    }
  }

  /** Perfil soportado por este equipo y compatible con la sesión (lo mismo para una o para un lote). */
  private async exigirPerfil(perfil: {
    formato: FormatoId
    ancho: number
    alto: number
    fps: 24 | 30 | 60
  }): Promise<void> {
    if (!esCombinacionValida(perfil)) {
      throw new ErrorExportacion('ARGUMENTOS_NO_VALIDOS', 'La combinación no es válida.')
    }
    const perfiles = await this.perfiles()
    const soportado = perfiles.perfiles.find(
      (x) =>
        x.formato === perfil.formato &&
        x.ancho === perfil.ancho &&
        x.alto === perfil.alto &&
        x.fps === perfil.fps
    )
    if (!soportado?.soportado) {
      throw new ErrorExportacion(
        'PERFIL_NO_SOPORTADO',
        'Este equipo no puede crear el video con ese perfil.'
      )
    }
    if (!perfilCompatibleConSesion(perfil, this.plataforma)) {
      throw new ErrorExportacion(
        'PERFIL_NO_SOPORTADO',
        'Ese perfil no es compatible con la sesión.'
      )
    }
  }

  // --- Lotes (ADR 0026 §5) -------------------------------------------------------------------

  /**
   * Sin `desdeCarpetaId`: la carpeta que se propone (la última usada, Vídeos o la personal), sin diálogo.
   * Con él: el selector de carpetas del sistema, que empieza ahí; `null` si se cancela.
   */
  async destinoCarpeta(desdeCarpetaId?: string): Promise<CarpetaDestinoIpc | null> {
    const recordada = this.deps.config.obtener().exportacion.carpeta
    if (desdeCarpetaId === undefined) return this.deps.destinos.carpetaPropuesta(recordada)
    return this.deps.destinos.elegirCarpeta(desdeCarpetaId, recordada, this.deps.ventanaPrincipal())
  }

  /**
   * Una exportación por canción en la cola de siempre, con las mismas opciones y una carpeta. Toma la
   * instantánea de cada una ahora, resuelve los nombres (repetidos dentro del lote y `siExiste`) y
   * comprueba el espacio total antes de encolar nada.
   */
  async iniciarLote(p: IniciarLoteExportacion): Promise<ResultadoLoteExportacionIpc> {
    const perfil = { formato: p.formato, ancho: p.ancho, alto: p.alto, fps: p.fps }
    await this.exigirPerfil(perfil)
    const carpeta = this.deps.destinos.rutaDeCarpeta(p.carpetaId)
    if (carpeta === null) {
      throw new ErrorDestino('DESTINO_NO_DISPONIBLE', 'La carpeta caducó o ya se usó.', undefined, {
        campo: 'destino'
      })
    }
    const lote: Lote = {
      id: this.uuid(),
      perfil,
      audio: p.audio,
      siExiste: p.siExiste,
      carpeta,
      destinos: new Map(),
      fallidas: new Set(),
      cancionIds: [...p.cancionIds],
      abierto: true,
      total: 0,
      completadas: 0
    }
    const r = await this.planificarLote(lote, p.cancionIds, p.carpetaId)
    this.lotes.set(lote.id, lote)
    // Los lotes viejos se olvidan: ya no se pueden reintentar.
    for (const id of this.lotes.keys()) {
      if (this.lotes.size <= MAX_LOTES) break
      this.lotes.delete(id)
    }
    await this.guardarOpciones({ ...perfil, audio: p.audio } as IniciarExportacion)
    return r
  }

  /** Cancela las que faltan del lote (la que está en curso, con limpieza, y las que esperan). */
  async cancelarLote(loteId: string): Promise<void> {
    const ids = this.todasActivas()
      .filter((t) => t.loteId === loteId)
      .map((t) => t.id)
    await this.cancelarVarias(ids)
  }

  /**
   * Vuelve a encolar las fallidas y las que no se intentaron, con las mismas opciones, la misma carpeta
   * y una instantánea nueva. Las canceladas por el usuario y las omitidas no se reintentan.
   */
  async reintentarLote(loteId: string): Promise<ResultadoLoteExportacionIpc> {
    const lote = this.lotes.get(loteId)
    if (!lote) throw new ErrorExportacion('ARGUMENTOS_NO_VALIDOS', 'El lote ya no existe.')
    const ids = lote.cancionIds.filter((id) => lote.fallidas.has(id))
    lote.fallidas.clear()
    lote.abierto = true
    lote.total = 0
    lote.completadas = 0
    return this.planificarLote(lote, ids, null)
  }

  /**
   * Núcleo de `iniciarLote` y `reintentarLote`. Sin esperas entre reservar y encolar que dejen colarse a
   * otra exportación de las mismas canciones o nombres.
   */
  private async planificarLote(
    lote: Lote,
    cancionIds: readonly string[],
    carpetaId: string | null
  ): Promise<ResultadoLoteExportacionIpc> {
    const extension = FORMATOS[lote.perfil.formato].extension
    const reservadasCanciones: string[] = []
    const reservadasDestinos: string[] = []
    const encoladas: { cancionId: string; trabajoId: string }[] = []
    const omitidas: { id: string; motivo: string }[] = []
    try {
      type Plan = {
        cancionId: string
        destino: string
        exportable: { instantanea: InstantaneaExportacion; rutas: Trabajo['rutas'] }
        audio: AudioExportacion
      }
      const plan: Plan[] = []
      for (const cancionId of cancionIds) {
        if (this.activaDe(cancionId) || this.reservasCancion.has(cancionId)) {
          omitidas.push({ id: cancionId, motivo: 'YA_EN_COLA' })
          continue
        }
        let audio: AudioExportacion = lote.audio
        let exportable: Plan['exportable']
        try {
          // «Instrumental y voz» sin pista de voz utilizable: esa canción sale solo con instrumental.
          try {
            exportable = await this.leerCancion(cancionId, lote.audio)
          } catch (e) {
            if (lote.audio === 'instrumental') throw e
            exportable = await this.leerCancion(cancionId, 'instrumental')
            audio = 'instrumental'
          }
        } catch (e) {
          omitidas.push({ id: cancionId, motivo: codigoDe(e) ?? 'CANCION_NO_DISPONIBLE' })
          continue
        }
        this.reservasCancion.set(cancionId, lote.id)
        reservadasCanciones.push(cancionId)
        const destino = await this.nombreEnLote(
          lote,
          cancionId,
          exportable.instantanea,
          extension,
          reservadasDestinos
        )
        if (destino === null) {
          omitidas.push({ id: cancionId, motivo: 'YA_EXISTE' })
          continue
        }
        plan.push({ cancionId, destino, exportable, audio })
      }
      if (plan.length === 0) return { loteId: lote.id, encoladas, omitidas }

      // Espacio: la suma de las estimaciones frente al libre de la carpeta, antes de encolar nada.
      const libre = (await this.deps.libreBytes?.(lote.carpeta)) ?? null
      if (libre !== null) {
        const necesarios = plan.reduce(
          (suma, x) => suma + (this.estimar({ cancionId: x.cancionId, ...lote.perfil }).bytes ?? 0),
          0
        )
        if (necesarios > libre) {
          throw new ErrorExportacion('SIN_ESPACIO', 'No hay espacio para todo el lote.')
        }
      }
      // La carpeta se valida una sola vez, ya con todo planificado, y se gasta el `carpetaId`.
      if (carpetaId !== null) await this.deps.destinos.consumirCarpeta(carpetaId)

      const nuevos: Trabajo[] = []
      for (const x of plan) {
        const t = await this.crearTrabajo(
          { cancionId: x.cancionId, ...lote.perfil, audio: x.audio },
          x.destino,
          x.exportable,
          this.uuid(),
          lote.id
        )
        this.cola.push(t)
        nuevos.push(t)
        lote.destinos.set(x.cancionId, x.destino)
        encoladas.push({ cancionId: x.cancionId, trabajoId: t.id })
      }
      lote.total = nuevos.length
      lote.completadas = 0
      lote.abierto = true
      this.avanzar()
      this.renumerar(false)
      for (const t of nuevos) if (t.estado === 'en_cola') this.emitir(t)
      return { loteId: lote.id, encoladas, omitidas }
    } finally {
      for (const id of reservadasCanciones) this.reservasCancion.delete(id)
      for (const clave of reservadasDestinos) this.reservasDestino.delete(clave)
    }
  }

  /**
   * Ruta de la canción en la carpeta del lote, o `null` si se omite (`siExiste: "omitir"`). Nunca
   * coincide con otra del lote ni con un archivo de otra exportación en marcha; un archivo que ya está en
   * la carpeta cuenta según `siExiste`.
   */
  private async nombreEnLote(
    lote: Lote,
    cancionId: string,
    cancion: InstantaneaExportacion,
    extension: string,
    reservadas: string[]
  ): Promise<string | null> {
    // Un reintento conserva el nombre que ya tenía la canción en este lote.
    const previo = lote.destinos.get(cancionId)
    const base = previo
      ? basename(previo)
      : nombrePropuesto(cancion.titulo, cancion.artista, extension)
    const punto = base.lastIndexOf('.')
    const raiz = base.slice(0, punto)
    const ext = base.slice(punto)
    for (let n = 1; n < 10_000; n++) {
      const ruta = join(lote.carpeta, n === 1 ? base : `${raiz} (${n})${ext}`)
      const clave = this.claveDestino(ruta)
      if (this.reservasDestino.has(clave) || this.destinoEnUso(clave)) continue
      const existe = await this.existe(ruta)
      if (existe && n === 1 && lote.siExiste === 'omitir') return null
      // «Sustituir» solo pisa lo que ya había con ese nombre exacto, nunca un « (2)» que no es suyo.
      if (existe && !(n === 1 && lote.siExiste === 'sustituir')) continue
      this.reservasDestino.add(clave)
      reservadas.push(clave)
      return ruta
    }
    throw new ErrorExportacion('DESTINO_NO_DISPONIBLE', 'No se encontró un nombre libre.')
  }

  /** Cancela una exportación en curso o en cola (con limpieza) y espera a que termine. */
  async cancelar(trabajoId: string): Promise<void> {
    const t = this.activo(trabajoId)
    if (!t) return
    if (t.estado === 'en_cola') {
      this.cola.splice(this.cola.indexOf(t), 1)
      this.terminar(t, { resultado: 'cancelada' })
      this.renumerar(true)
      return
    }
    t.control.abort()
    await t.fin
  }

  cancelarDeCancion(cancionId: string): Promise<void> {
    const ids = this.todasActivas()
      .filter((t) => t.cancionId === cancionId)
      .map((t) => t.id)
    return this.cancelarVarias(ids)
  }

  /** Cierre de la app y «Reparar el motor»: cancela todas con limpieza. */
  cancelarTodas(): Promise<void> {
    return this.cancelarVarias(this.todasActivas().map((t) => t.id))
  }

  /** Antes de salir: cancela todo y suelta el bloqueo de suspensión. */
  async cerrar(): Promise<void> {
    await this.cancelarTodas()
    this.liberarBloqueo()
  }

  /** Hay una exportación en curso o en cola (`hayAlgoEnCurso`). */
  hayEnCurso(): boolean {
    return this.actual !== null || this.cola.length > 0
  }

  estado(): ExportacionIpc[] {
    return [...this.terminadas.values(), ...(this.actual ? [this.actual] : []), ...this.cola].map(
      (t) => this.aIpc(t)
    )
  }

  // --- Avisos y «Mostrar en la carpeta» ---------------------------------------------------------

  /**
   * Arranque (antes de crear la principal): resuelve el diario de una caída en un aviso.
   * Nunca lanza.
   */
  async recuperarAlArrancar(): Promise<void> {
    try {
      const r = await this.deps.diario.recuperarAlArrancar()
      if (!r) return
      const aviso: AvisoExportacionIpc = {
        avisoId: this.uuid(),
        tipo: r.limpiezaFallida ? 'limpieza_fallida' : 'interrumpida',
        cancionId: r.cancionId,
        titulo: r.titulo
      }
      if (r.limpiezaFallida) this.rutasAviso.set(aviso.avisoId, r.temporal)
      this.avisosPendientes_.push(aviso)
      if (this.avisosPendientes_.length > MAX_AVISOS) this.avisosPendientes_.shift()
      this.oyentesAviso.forEach((cb) => cb(aviso))
    } catch (e) {
      this.deps.registrar?.('error', `exportación: no se pudo recuperar el diario: ${String(e)}`)
    }
  }

  /** Entrega los avisos que aún no se dieron; cada uno una sola vez. */
  avisosPendientes(): AvisoExportacionIpc[] {
    const lista = this.avisosPendientes_
    this.avisosPendientes_ = []
    return lista
  }

  async mostrarEnCarpeta(ref: { trabajoId: string } | { avisoId: string }): Promise<void> {
    let ruta: string | null = null
    if ('avisoId' in ref) {
      ruta = this.rutasAviso.get(ref.avisoId) ?? null
    } else {
      const t = this.trabajo(ref.trabajoId)
      if (t?.limpiezaFallida && t.temporalPendiente) ruta = t.temporalPendiente
      else if (t?.resultado === 'completada') ruta = t.destino
    }
    if (ruta === null || !(await this.existe(ruta))) {
      throw new ErrorExportacion('DESTINO_NO_DISPONIBLE', 'El archivo ya no está en esa carpeta.')
    }
    this.deps.mostrarEnCarpeta(ruta)
  }

  // --- Cola ---------------------------------------------------------------------------------

  private todasActivas(): Trabajo[] {
    return [...(this.actual ? [this.actual] : []), ...this.cola]
  }

  private activo(id: string): Trabajo | undefined {
    return this.todasActivas().find((t) => t.id === id)
  }

  private trabajo(id: string): Trabajo | undefined {
    return this.activo(id) ?? this.terminadas.get(id)
  }

  private activaDe(cancionId: string): Trabajo | undefined {
    return this.todasActivas().find((t) => t.cancionId === cancionId)
  }

  private claveDestino(ruta: string): string {
    const r = resolve(ruta)
    return this.plataforma === 'win32' || this.plataforma === 'darwin' ? r.toLowerCase() : r
  }

  private destinoEnUso(clave: string): boolean {
    return this.todasActivas().some((t) => this.claveDestino(t.destino) === clave)
  }

  private cancelarVarias(ids: string[]): Promise<void> {
    return Promise.all(ids.map((id) => this.cancelar(id))).then(() => undefined)
  }

  /** Empieza la siguiente de la cola si no hay ninguna en curso. */
  private avanzar(): void {
    if (this.actual) return
    const t = this.cola.shift()
    if (!t) return
    this.actual = t
    this.renumerar(true)
    void this.correr(t).finally(() => {
      this.actual = null
      this.avanzar()
    })
  }

  /** Recalcula `posicion` de las que esperan; con `emitirCambios`, avisa de las que cambiaron. */
  private renumerar(emitirCambios: boolean): void {
    this.cola.forEach((t, i) => {
      const nueva = i + 1
      if (t.posicion === nueva) return
      t.posicion = nueva
      if (emitirCambios) this.emitir(t)
    })
  }

  private async guardarOpciones(p: IniciarExportacion): Promise<void> {
    try {
      await this.deps.config.actualizar({
        exportacion: {
          formato: p.formato,
          audio: p.audio,
          ancho: p.ancho,
          alto: p.alto,
          fps: p.fps
        }
      })
    } catch (e) {
      this.deps.registrar?.(
        'aviso',
        `exportación: no se pudieron guardar las opciones: ${String(e)}`
      )
    }
  }

  // --- Canción e instantánea ------------------------------------------------------------------

  /** Valida la canción y toma la instantánea de lo guardado (ADR 0019 §3). */
  private async leerCancion(
    cancionId: string,
    audio: AudioExportacion
  ): Promise<{ instantanea: InstantaneaExportacion; rutas: Trabajo['rutas'] }> {
    const noDisponible = (mensaje: string): ErrorExportacion =>
      new ErrorExportacion('CANCION_NO_DISPONIBLE', mensaje)
    const cancion = this.deps.biblioteca.obtener(cancionId)
    if (!cancion) throw noDisponible('La canción no existe o su archivo está dañado.')
    const letra = cancion.letra
    if (!cancion.pistas) throw noDisponible('La canción no tiene pistas separadas.')
    if (!letra?.lineas.some((l) => l.tipo === 'linea' && l.inicio_ms !== null)) {
      throw noDisponible('La canción no tiene ninguna línea sincronizada.')
    }
    if (cancion.metadatos.duracion_ms <= 0) throw noDisponible('La canción no tiene duración.')
    const carpeta = join(this.deps.dirDatos, 'biblioteca', cancionId)
    const dentro = (rel: string): string | null => {
      const ruta = resolve(carpeta, rel)
      const r = relative(carpeta, ruta)
      return r !== '' && !r.startsWith('..') && !isAbsolute(r) ? ruta : null
    }
    const instrumental = dentro(cancion.pistas.instrumental)
    const voz = dentro(cancion.pistas.voz)
    if (!instrumental || !(await this.existe(instrumental))) {
      throw noDisponible('Falta la pista instrumental.')
    }
    const vozDisponible = voz !== null && (await this.existe(voz))
    if (audio === 'instrumental_voz' && !vozDisponible) {
      throw noDisponible('Falta la pista de voz.')
    }
    const instantanea: InstantaneaExportacion = {
      titulo: cancion.metadatos.titulo,
      artista: cancion.metadatos.artista,
      duracionMs: cancion.metadatos.duracion_ms,
      letra: structuredClone(letra),
      estilo: structuredClone(this.deps.biblioteca.estiloDe(cancion)),
      modalidad: modalidadEfectiva(cancion),
      gananciaDb: Math.min(60, Math.max(-60, cancion.fuente.ganancia_db)),
      vozDisponible
    }
    return {
      instantanea,
      rutas: { instrumental, voz: audio === 'instrumental_voz' ? voz : null }
    }
  }

  // --- Ejecución ------------------------------------------------------------------------------

  /** Nunca rechaza: cualquier fallo queda en el estado del trabajo. */
  private async correr(t: Trabajo): Promise<void> {
    t.estado = 'en_curso'
    t.posicion = null
    t.iniciadaMs = this.ahora()
    t.iniciadaEn = new Date(t.iniciadaMs).toISOString()
    t.progreso = this.progresoInicial(t)
    this.emitir(t)
    this.retenerBloqueo()
    try {
      const salida = await this.ejecutarTrabajo(t)
      await this.cerrarTrabajo(t, salida)
    } catch (e) {
      this.terminar(t, { resultado: 'error', error: await this.errorDe(t, e) })
    } finally {
      this.liberarBloqueo()
    }
  }

  private progresoInicial(t: Trabajo): ProgresoExportacionIpc {
    return {
      trabajoId: t.id,
      fase: 'preparando',
      valor: null,
      fotograma: 0,
      total: t.total,
      posicionMs: 0,
      duracionMs: t.instantanea.duracionMs,
      etaSegundos: null
    }
  }

  /**
   * Diario, worker, ventana y bucle. Devuelve el resultado del worker o el error que lo impidió;
   * deja el worker terminado y la ventana destruida.
   */
  private async ejecutarTrabajo(t: Trabajo): Promise<SalidaTrabajo> {
    const { deps } = this
    // Se rellena desde callbacks: un objeto evita que TypeScript estreche los campos a `null`.
    const s: EstadoEjecucion = {
      ventana: null,
      stdin: null,
      primerError: null,
      errorWorker: null,
      resultado: null,
      codificados: 0,
      escritos: 0,
      noAsentados: 0
    }
    let ultimaEmision = 0
    let ultimoProgreso: ProgresoExportacionIpc = t.progreso ?? this.progresoInicial(t)
    const estimador = new EstimadorProgreso()
    // Cortan el bucle (cancelación, fallo propio o fin del worker) y matan al worker (cancelación o fallo propio).
    const bucle = new AbortController()
    const worker = new AbortController()
    const alCancelar = (): void => {
      bucle.abort()
      worker.abort()
      // Una captura o un fotograma pendientes no deben retrasar la cancelación.
      s.ventana?.destruir()
    }
    if (t.control.signal.aborted) alCancelar()
    else t.control.signal.addEventListener('abort', alCancelar, { once: true })
    const fallar = (e: unknown): void => {
      s.primerError ??= e
      bucle.abort()
      worker.abort()
      s.ventana?.destruir()
    }

    const emitirProgreso = (p: ProgresoExportacionIpc, forzar: boolean): void => {
      const ahora = this.ahora()
      if (!forzar && ahora - ultimaEmision < INTERVALO_MIN_PROGRESO_MS) return
      ultimaEmision = ahora
      ultimoProgreso = p
      t.progreso = p
      this.oyentesProgreso.forEach((cb) => cb(p))
    }
    const alProgreso = (m: Extract<MensajeWorker, { tipo: 'progreso' }>): void => {
      const fase = m.fase as FaseExportacion
      if (fase !== 'preparando' && fase !== 'codificando' && fase !== 'finalizando') return
      const detalle = m.detalle ?? {}
      const fotograma = typeof detalle.fotograma === 'number' ? detalle.fotograma : s.codificados
      const total = typeof detalle.total === 'number' ? detalle.total : t.total
      if (fase === 'codificando') s.codificados = Math.max(s.codificados, fotograma)
      const suave = estimador.registrar(fase, m.valor, this.ahora())
      const faseAnterior = t.progreso?.fase
      emitirProgreso(
        {
          trabajoId: t.id,
          fase,
          valor: suave.valor,
          fotograma,
          total,
          posicionMs: (fotograma * 1000) / t.fps,
          duracionMs: t.instantanea.duracionMs,
          etaSegundos: suave.etaSegundos
        },
        faseAnterior !== fase || fotograma >= total
      )
    }
    // Al menos un evento cada 2 s aunque el worker tarde en dar señales.
    const latido = setInterval(() => {
      if (this.ahora() - ultimaEmision >= INTERVALO_MAX_PROGRESO_MS) {
        emitirProgreso(ultimoProgreso, true)
      }
    }, INTERVALO_MAX_PROGRESO_MS)

    try {
      await deps.diario.escribir({
        trabajoId: t.id,
        cancionId: t.cancionId,
        titulo: t.titulo,
        temporal: t.temporal,
        destino: t.destino,
        inicio: t.iniciadaMs ?? this.ahora()
      })
      const args = {
        temporal: t.temporal,
        formato: t.formato,
        ancho: t.ancho,
        alto: t.alto,
        fps: t.fps,
        total_fotogramas: t.total,
        duracion_ms: t.instantanea.duracionMs,
        audio: {
          instrumental: t.rutas.instrumental,
          voz: t.rutas.voz,
          ganancia_db: t.instantanea.gananciaDb
        },
        parametros: parametrosDe(t.formato, t.alto),
        hilos: Math.max(1, deps.nucleos() - 1)
      }
      const terminadoWorker = deps
        .ejecutar('exportar', args, {
          señal: worker.signal,
          entrada: 'tuberia',
          prioridad: 'baja',
          alEntrada: (stdin) => {
            s.stdin = stdin
          },
          alProgreso
        })
        .then(
          (r) => {
            s.resultado = r
          },
          (e: unknown) => {
            s.errorWorker = e
            // El worker cae por su cuenta: si no es una cancelación nuestra, es el primer error.
            if (codigoDe(e) !== 'CANCELADO') s.primerError ??= e
          }
        )
        .finally(() => {
          // Sin worker no hay a quién dar fotogramas: se corta el bucle y se libera la captura pendiente.
          bucle.abort()
          s.ventana?.destruir()
        })

      // El worker prepara el audio mientras la ventana carga: la tubería frena al bucle hasta
      // que el worker empieza a leer (ADR 0019 §7), así que no hace falta una señal de fin de «preparando».
      const flujo = (async (): Promise<void> => {
        const v = await deps.crearVentana({
          ancho: t.ancho,
          alto: t.alto,
          trabajoId: t.id,
          inicial: { instantanea: t.instantanea, fps: t.fps, total: t.total },
          alCaer: fallar
        })
        s.ventana = v
        if (bucle.signal.aborted) return
        await esperarCon(
          Promise.race([
            v.lista,
            new Promise<void>((res) => bucle.signal.addEventListener('abort', () => res()))
          ]),
          PLAZO_VENTANA_LISTA_MS,
          () => new ErrorExportacion('ERROR_INTERNO', 'La ventana de exportación no arrancó.')
        )
        const destino = s.stdin
        if (bucle.signal.aborted || !destino) return
        const r = await ejecutarBucle({
          total: t.total,
          ancho: t.ancho,
          alto: t.alto,
          pintar: (n) => v.pintar(n),
          capturar: async () => {
            const c = await v.capturar()
            if (!c.asentada) s.noAsentados++
            return c.imagen
          },
          destino,
          señal: bucle.signal,
          alFotograma: () => {
            s.escritos++
          }
        })
        // Cierra stdin: el worker termina de codificar y responde.
        if (r.estado === 'completo') destino.end()
      })().catch(fallar)

      await Promise.all([terminadoWorker, flujo])
    } catch (e) {
      fallar(e)
    } finally {
      clearInterval(latido)
      t.control.signal.removeEventListener('abort', alCancelar)
      if (s.noAsentados > 0) {
        deps.registrar?.(
          'aviso',
          `exportación ${t.id} (${t.formato} ${t.ancho}×${t.alto} a ${t.fps} fps): ${s.noAsentados} de ${t.total} fotogramas no se asentaron tras 5 capturas`
        )
      }
      // Antes de tocar el temporal: sin proceso vivo y sin la ventana (en Windows no se borra un archivo abierto).
      s.ventana?.destruir()
      if (s.stdin && !s.stdin.writableEnded) s.stdin.destroy()
    }
    return {
      resultado: s.resultado,
      error: s.primerError ?? (s.resultado === null ? s.errorWorker : null),
      alcanzados: Math.max(s.codificados, s.escritos)
    }
  }

  private async cerrarTrabajo(t: Trabajo, salida: SalidaTrabajo): Promise<void> {
    const cancelada = t.control.signal.aborted
    if (!cancelada && salida.error === null && salida.resultado !== null) {
      try {
        await this.deps.destinos.sustituir(t.temporal, t.destino)
      } catch (e) {
        await this.limpiarTemporal(t)
        await this.borrarDiario()
        this.terminar(t, {
          resultado: 'error',
          error: await this.errorDe(t, e, salida.alcanzados)
        })
        return
      }
      await this.borrarDiario()
      const r = salida.resultado
      t.bytes = typeof r.bytes === 'number' ? r.bytes : null
      t.fotogramas = typeof r.fotogramas === 'number' ? r.fotogramas : null
      await this.aprender(t)
      this.terminar(t, { resultado: 'completada' })
      return
    }
    await this.limpiarTemporal(t)
    await this.borrarDiario()
    if (cancelada) {
      this.terminar(t, { resultado: 'cancelada' })
      return
    }
    this.terminar(t, {
      resultado: 'error',
      error: await this.errorDe(
        t,
        salida.error ?? new Error('El worker terminó sin resultado.'),
        salida.alcanzados
      )
    })
  }

  /** Borra el temporal; si no puede, lo anota para `mostrarEnCarpeta` y `limpiezaFallida`. */
  private async limpiarTemporal(t: Trabajo): Promise<void> {
    try {
      await this.deps.destinos.limpiar(t.temporal)
    } catch (e) {
      t.limpiezaFallida = true
      t.temporalPendiente = e instanceof ErrorDestino && e.detalles ? e.detalles : t.temporal
      this.deps.registrar?.(
        'aviso',
        `exportación ${t.id}: no se pudo borrar el temporal: ${String(e)}`
      )
    }
  }

  private async borrarDiario(): Promise<void> {
    try {
      await this.deps.diario.borrar()
    } catch (e) {
      this.deps.registrar?.('aviso', `exportación: no se pudo borrar el diario: ${String(e)}`)
    }
  }

  /** Factor corrector (media móvil de real / estimado) y última carpeta usada. */
  private async aprender(t: Trabajo): Promise<void> {
    try {
      const config = this.deps.config.obtener().exportacion
      const realS = (this.ahora() - (t.iniciadaMs ?? this.ahora())) / 1000
      const base = estimarSegundos({
        formato: t.formato,
        alto: t.alto,
        fps: t.fps,
        duracionMs: t.instantanea.duracionMs,
        factorCorrector: 1
      })
      const factor =
        base > 0 && realS > 0
          ? acotarFactorCorrector(0.5 * config.factor_corrector + 0.5 * (realS / base))
          : config.factor_corrector
      await this.deps.config.actualizar({
        exportacion: { carpeta: dirname(t.destino), factor_corrector: factor }
      })
    } catch (e) {
      this.deps.registrar?.('aviso', `exportación: no se pudo guardar el factor: ${String(e)}`)
    }
  }

  private async errorDe(
    t: Trabajo,
    e: unknown,
    alcanzados?: number
  ): Promise<NonNullable<ExportacionIpc['error']>> {
    const traducido = traducirError(e)
    const fotograma = alcanzados ?? t.progreso?.fotograma ?? 0
    const detalle: DetalleErrorExportacion | null =
      traducido.codigo === 'PERFIL_NO_SOPORTADO' &&
      (e as { causa?: unknown } | null)?.causa === 'captura'
        ? { causa: 'captura', reintentable: await this.recomprobarCaptura(t) }
        : null
    return {
      codigo: traducido.codigo,
      mensaje: traducido.mensaje,
      posicionMs: fotograma > 0 ? (fotograma * 1000) / t.fps : null,
      ...(traducido.detalles ? { detalles: traducido.detalles } : {}),
      ...(detalle ? { detalle } : {})
    }
  }

  /**
   * Fallo de captura en un trabajo: vuelve a sondear ese tamaño antes de cerrarlo. `true` = ahora
   * sí se puede (fallo pasajero); `false` = no, y el perfil queda `captura` hasta reiniciar. Si
   * no se puede comprobar, no se marca nada y se deja reintentar.
   */
  private async recomprobarCaptura(t: Trabajo): Promise<boolean> {
    try {
      if (!this.deps.probarCaptura) return true
      const posible = await this.deps.probarCaptura(t.ancho, t.alto)
      if (!posible) this.noCapturables.add(`${t.ancho}x${t.alto}`)
      return posible
    } catch (e) {
      this.deps.registrar?.(
        'aviso',
        `exportación: falló la recomprobación de captura: ${String(e)}`
      )
      return true
    }
  }

  /** Una línea en `app.log` por fallo (`error`) o cancelación (`info`); las completadas no escriben. */
  private registrarFin(
    t: Trabajo,
    r: { resultado: 'completada' | 'error' | 'cancelada'; error?: ExportacionIpc['error'] }
  ): void {
    if (r.resultado === 'completada') return
    const alcanzados = (ms: number | null | undefined): number =>
      ms ? Math.round((ms * t.fps) / 1000) : 0
    if (r.resultado === 'cancelada') {
      const n = alcanzados(t.progreso?.posicionMs)
      this.deps.registrar?.(
        'info',
        `exportación ${t.id} cancelada en el fotograma ${n} de ${t.total}`
      )
      return
    }
    const e = r.error
    const perfil = `${t.formato.replace('_', ' ').toUpperCase()} ${t.ancho}×${t.alto} a ${t.fps} fps, audio ${t.audio}`
    const detalles = e?.detalles ? ` · ${e.detalles}` : ''
    this.deps.registrar?.(
      'error',
      `exportación ${t.id} falló: ${e?.codigo}: ${e?.mensaje} · ${perfil} · ${alcanzados(e?.posicionMs)} de ${t.total} fotogramas${detalles}`
    )
  }

  /** Estado final: emite el cambio, avisa al sistema y despierta a quien espera. */
  private terminar(
    t: Trabajo,
    r: { resultado: 'completada' | 'error' | 'cancelada'; error?: ExportacionIpc['error'] }
  ): void {
    this.registrarFin(t, r) // antes de vaciar `progreso`
    t.estado = 'terminada'
    t.resultado = r.resultado
    t.error = r.error ?? null
    t.progreso = null
    t.posicion = null
    t.terminadaEn = new Date(this.ahora()).toISOString()
    this.terminadas.set(t.id, t)
    for (const id of this.terminadas.keys()) {
      if (this.terminadas.size <= MAX_TERMINADAS) break
      this.terminadas.delete(id)
    }
    this.emitir(t)
    if (t.loteId) this.terminarDeLote(t, r)
    else if (r.resultado === 'completada') {
      this.deps.avisarSistema?.(AVISOS_EXPORTACION.ok(t.titulo))
    } else if (r.resultado === 'error') {
      this.deps.avisarSistema?.(AVISOS_EXPORTACION.error(t.titulo))
    }
    t.cerrarFin()
  }

  /**
   * Una exportación de un lote terminó: apunta lo que `reintentarLote` repetirá, detiene el lote si la
   * causa fallaría igual para las demás (`SIN_ESPACIO`, `DESTINO_NO_DISPONIBLE`) y, al acabar la última,
   * da **un** aviso del sistema por el lote (no uno por video).
   */
  private terminarDeLote(
    t: Trabajo,
    r: { resultado: 'completada' | 'error' | 'cancelada'; error?: ExportacionIpc['error'] }
  ): void {
    const lote = t.loteId ? this.lotes.get(t.loteId) : undefined
    if (!lote) return
    if (r.resultado === 'completada') {
      lote.completadas++
      lote.fallidas.delete(t.cancionId)
    } else if (r.resultado === 'error' || r.error) {
      lote.fallidas.add(t.cancionId)
    } else {
      lote.fallidas.delete(t.cancionId)
    }
    const error = r.resultado === 'error' ? r.error : null
    if (error && (error.codigo === 'SIN_ESPACIO' || error.codigo === 'DESTINO_NO_DISPONIBLE')) {
      const restantes = this.cola.filter((x) => x.loteId === lote.id)
      for (const x of restantes) {
        this.cola.splice(this.cola.indexOf(x), 1)
        this.terminar(x, {
          resultado: 'cancelada',
          error: { codigo: error.codigo, mensaje: error.mensaje, posicionMs: null }
        })
      }
      this.renumerar(true)
    }
    if (lote.abierto && !this.todasActivas().some((x) => x !== t && x.loteId === lote.id)) {
      lote.abierto = false
      this.deps.avisarSistema?.(AVISOS_EXPORTACION.lote(lote.completadas, lote.total))
    }
  }

  private emitir(t: Trabajo): void {
    const e = this.aIpc(t)
    this.oyentesCambio.forEach((cb) => cb(e))
  }

  private aIpc(t: Trabajo): ExportacionIpc {
    return {
      trabajoId: t.id,
      cancionId: t.cancionId,
      titulo: t.titulo,
      artista: t.artista,
      formato: t.formato,
      ancho: t.ancho,
      alto: t.alto,
      fps: t.fps,
      audio: t.audio,
      estado: t.estado,
      posicion: t.posicion,
      resultado: t.resultado,
      error: t.error,
      progreso: t.progreso,
      archivo: basename(t.destino),
      carpeta: dirname(t.destino),
      bytes: t.bytes,
      fotogramas: t.fotogramas,
      duracionMs: t.instantanea.duracionMs,
      destinoExistia: t.destinoExistia,
      iniciadaEn: t.iniciadaEn,
      terminadaEn: t.terminadaEn,
      limpiezaFallida: t.limpiezaFallida,
      ...(t.loteId ? { loteId: t.loteId } : {})
    }
  }

  // --- Suspensión -----------------------------------------------------------------------------

  private retenerBloqueo(): void {
    const b = this.deps.bloqueador
    if (!b || (this.bloqueo !== null && b.isStarted(this.bloqueo))) return
    this.bloqueo = b.start('prevent-app-suspension')
  }

  private liberarBloqueo(): void {
    const b = this.deps.bloqueador
    if (b && this.bloqueo !== null && b.isStarted(this.bloqueo)) b.stop(this.bloqueo)
    this.bloqueo = null
  }
}

interface EstadoEjecucion {
  ventana: VentanaExportacion | null
  stdin: Writable | null
  primerError: unknown
  errorWorker: unknown
  resultado: Record<string, unknown> | null
  codificados: number
  escritos: number
  /** Fotogramas cuya captura no se asentó (ADR 0019 §2). */
  noAsentados: number
}

interface SalidaTrabajo {
  resultado: Record<string, unknown> | null
  error: unknown
  alcanzados: number
}

function leerCapacidades(r: Record<string, unknown>): Capacidades {
  const formatos = r.formatos as Record<string, Partial<CapacidadFormato>> | undefined
  const salida = {} as Capacidades
  for (const id of FORMATOS_ID) {
    const f = formatos?.[id]
    if (!f || typeof f.disponible !== 'boolean') {
      throw new ErrorExportacion('ERROR_INTERNO', 'Respuesta de capacidades no válida.')
    }
    salida[id] = {
      disponible: f.disponible,
      max_16_9: f.max_16_9 === true,
      max_4_3: f.max_4_3 === true
    }
  }
  return salida
}
