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
  acotarFactorCorrector,
  esCombinacionValida,
  estimarBytes,
  estimarSegundos,
  memoriaMinimaDe,
  parametrosDe,
  perfilCompatibleConSesion,
  totalFotogramas,
  type AudioExportacion,
  type AvisoExportacionIpc,
  type DestinoIpc,
  type EstimacionExportacionIpc,
  type ExportacionIpc,
  type FaseExportacion,
  type FormatoId,
  type InstantaneaExportacion,
  type PerfilesIpc,
  type ProgresoExportacionIpc,
  type PerfilIpc
} from '../../shared/exportacion'
import type { IniciarExportacion } from '../../shared/ipc'
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
  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
    readonly detalles?: string
  ) {
    super(mensaje)
    this.name = 'ErrorExportacion'
  }
}

/** Textos de la notificación del sistema (los de `exp.toast.ok` y `exp.toast.error` de la spec 10). */
export const AVISOS_EXPORTACION = {
  ok: (titulo: string): string => `«${titulo}»: video exportado.`,
  error: (titulo: string): string => `«${titulo}»: no se pudo exportar el video.`
} as const

/** Eventos de progreso: como mucho 4 por segundo y al menos 1 cada 2 s (ADR 0019 §11). */
export const INTERVALO_MIN_PROGRESO_MS = 250
export const INTERVALO_MAX_PROGRESO_MS = 2000
/** Plazo para que el documento de la ventana offscreen pida su instantánea. */
export const PLAZO_VENTANA_LISTA_MS = 30_000
/** Terminadas que se recuerdan para `estado()` y «Reintentar». */
export const MAX_TERMINADAS = 50
const MAX_AVISOS = 20

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
    | 'rutaTemporal'
    | 'sustituir'
    | 'limpiar'
  >
  diario: Pick<DiarioExportacion, 'escribir' | 'borrar' | 'recuperarAlArrancar'>
  ejecutar: EjecutarWorker
  /** Ventana offscreen (0234). */
  crearVentana(opciones: OpcionesExportacion): Promise<VentanaExportacion>
  /** Ventana principal, para el diálogo «Guardar». */
  ventanaPrincipal(): V
  /** `fs.access`; por defecto el real. */
  existe?(ruta: string): Promise<boolean>
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
  private readonly reservasCancion = new Set<string>()
  private readonly reservasDestino = new Set<string>()
  private sondeo: Promise<Capacidades> | null = null
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
      capacidades = await this.capacidades()
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
          return { ...base, soportado: true, motivo: null }
        })
      )
    )
    return {
      formatos: FORMATOS_ID.map((id) => ({ id, extension: FORMATOS[id].extension })),
      perfiles
    }
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
    const perfil = { formato: p.formato, ancho: p.ancho, alto: p.alto, fps: p.fps }
    if (!esCombinacionValida(perfil)) {
      throw new ErrorExportacion('ARGUMENTOS_NO_VALIDOS', 'La combinación no es válida.')
    }
    const perfiles = await this.perfiles()
    const soportado = perfiles.perfiles.find(
      (x) => x.formato === p.formato && x.ancho === p.ancho && x.alto === p.alto && x.fps === p.fps
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
    const exportable = await this.leerCancion(p.cancionId, p.audio)
    const destinoRuta = this.deps.destinos.rutaDe(p.destinoId)
    if (destinoRuta === null) {
      throw new ErrorDestino('DESTINO_NO_DISPONIBLE', 'El destino caducó o ya se usó.')
    }
    const clave = this.claveDestino(destinoRuta)
    // Sin esperas desde aquí hasta reservar: dos `iniciar` seguidos no se cuelan.
    if (this.activaDe(p.cancionId) || this.reservasCancion.has(p.cancionId)) {
      throw new ErrorExportacion(
        'ARGUMENTOS_NO_VALIDOS',
        'La canción ya tiene una exportación en marcha.'
      )
    }
    if (this.destinoEnUso(clave) || this.reservasDestino.has(clave)) {
      throw new ErrorExportacion('DESTINO_OCUPADO', 'Otra exportación usa ese archivo.')
    }
    this.reservasCancion.add(p.cancionId)
    this.reservasDestino.add(clave)
    try {
      // Solo ahora se gasta el `destinoId`: un rechazo anterior lo deja vigente.
      const destino = await this.deps.destinos.consumir(p.destinoId)
      const id = this.uuid()
      const temporal = this.deps.destinos.rutaTemporal(destino, id)
      const destinoExistia = await this.existe(destino)
      let cerrar: () => void = () => undefined
      const fin = new Promise<void>((res) => {
        cerrar = res
      })
      const t: Trabajo = {
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
        control: new AbortController(),
        fin,
        cerrarFin: cerrar
      }
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

  private activaDe(cancionId: string): boolean {
    return this.todasActivas().some((t) => t.cancionId === cancionId)
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
      this.terminar(t, { resultado: 'error', error: this.errorDe(t, e) })
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
          error: this.errorDe(t, e, salida.alcanzados)
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
      error: this.errorDe(
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

  private errorDe(
    t: Trabajo,
    e: unknown,
    alcanzados?: number
  ): NonNullable<ExportacionIpc['error']> {
    const traducido = traducirError(e)
    const fotograma = alcanzados ?? t.progreso?.fotograma ?? 0
    return {
      codigo: traducido.codigo,
      mensaje: traducido.mensaje,
      posicionMs: fotograma > 0 ? (fotograma * 1000) / t.fps : null,
      ...(traducido.detalles ? { detalles: traducido.detalles } : {})
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
    if (r.resultado === 'completada') this.deps.avisarSistema?.(AVISOS_EXPORTACION.ok(t.titulo))
    else if (r.resultado === 'error') this.deps.avisarSistema?.(AVISOS_EXPORTACION.error(t.titulo))
    t.cerrarFin()
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
      limpiezaFallida: t.limpiezaFallida
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
