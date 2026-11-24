import type { z } from 'zod'
import {
  CANALES,
  CONTRATO,
  type CanalInvocable,
  type ErrorIpc,
  type EventoCancionIpc,
  type EventoProgresoIpc,
  type TandaPreparacionIpc,
  type TrabajoIpc,
  type InfoSistema,
  type TextoLegal,
  type RespuestaIpc,
  type ResumenCancionIpc,
  type ImportacionLeidaIpc,
  type LecturaLoteIpc,
  type ListaYoutubeIpc,
  type LoteIpc,
  type resultadoLoteSchema,
  type InfoYoutubeIpc,
  type EstadoRuntimeIpc,
  type ErrorRendererIpc,
  type OrigenRapido,
  type EstimacionSeparacion,
  type EstimacionCancion,
  type ProgresoRuntimeIpc,
  type RequisitosRuntimeIpc,
  type MetadatosEditables,
  type OrigenMetadatos,
  type ValoresDatosIpc,
  type BusquedaLetra,
  type ResultadoBusquedaLetra,
  type CandidatoLetra,
  type GuardarLetra,
  type GuardarTiempos,
  type EdicionLetraIpc,
  type EditarTextoLetra,
  type EditarTextoLinea,
  type ArchivoLetraLeido,
  CODIGOS_ERROR,
  ErrorDatosInvalidos,
  type Cancion,
  type CancionIpc,
  type Config,
  type CatalogoIpc,
  type CrearTema,
  type DuplicarTema,
  type ImpactoIpc,
  type OperacionTema,
  type RenombrarTema,
  type ResultadoOperacionIpc,
  type OpcionesMarcarLista,
  type SeleccionApariencia,
  type RevisionResumenIpc,
  type TemaIpc
} from '../../shared'
import type { InicialExportacionIpc } from '../../shared/exportacion'
import type { RolVentana } from '../../shared/canales'
import type { ConfigParcial } from '../configuracion'
import {
  origenTrasEdicion,
  type EventoCancion,
  type ResumenCancion,
  type ServicioLotes
} from '../biblioteca'
import { resueltaDeResolucion, revisionDeResumen } from '../biblioteca/resumen'
import type { ResolucionCancion } from '../temas'
import { ESQUEMA_MEDIOS } from '../medios'
import type { ServicioPicos } from '../picos/servicio'
import type { ServicioSesion } from '../sesion/servicio'
import type { ServicioExportacion } from '../exportacion/servicio'
import type { ServicioActualizaciones } from '../actualizaciones'
import type { ExportadorLrc } from '../letras/exportarLrc'
import type { ServicioCopias } from '../copias'

/** Subconjuntos de los servicios que usa la IPC (se simulan en los tests). */
export interface BibliotecaIpc {
  listar(): ResumenCancion[]
  obtener(id: string): Cancion | null
  /** Artistas y álbumes existentes con su número de canciones (índice en memoria). */
  valoresDatos(): ValoresDatosIpc
  actualizar(
    id: string,
    cambio: {
      metadatos: {
        titulo: string
        artista: string
        album: string | null
        origen?: OrigenMetadatos
      }
    }
  ): Promise<ResumenCancion>
  guardarApariencia(id: string, seleccion: SeleccionApariencia): Promise<ResumenCancion>
  /** Resolución de la canción con el catálogo vigente (`biblioteca.obtener`). */
  resolver(cancion: Cancion): ResolucionCancion
  marcarLista(id: string, opciones?: OpcionesMarcarLista): Promise<ResumenCancion>
  comprobarPistas(id: string): Promise<ResumenCancion | null>
  volverABorrador(id: string): Promise<ResumenCancion>
  marcarPreparacionRevisada(id: string): Promise<ResumenCancion | null>
  eliminar(id: string): Promise<void>
  mostrarEnCarpeta(id: string): Promise<void>
  suscribir(cb: (evento: EventoCancion) => void): () => void
}

/** Subconjunto de `ServicioTemas` (0165–0167) que usa la IPC. */
export interface TemasIpc {
  catalogo(): CatalogoIpc
  previsualizar(op: OperacionTema): Promise<ImpactoIpc>
  ejecutar(op: OperacionTema, ficha: string): Promise<ResultadoOperacionIpc>
  crear(datos: CrearTema): Promise<TemaIpc>
  renombrar(datos: RenombrarTema): Promise<TemaIpc>
  duplicar(datos: DuplicarTema): Promise<TemaIpc>
  reanudarBorrado(): Promise<ResultadoOperacionIpc>
  cancelarBorrado(): Promise<void>
  descartarAvisoApartado(): Promise<void>
}

export interface ConfigIpc {
  obtener(): Config
  actualizar(parcial: ConfigParcial): Promise<Config>
  suscribir(cb: (config: Config) => void): () => void
}

/** Subconjunto del gestor de trabajos (0014) que usa la IPC. */
export interface TrabajosIpc {
  listar(): TrabajoIpc[]
  cancelar(id: string): Promise<boolean>
  hayPendientes(): boolean
  suscribir(cb: (trabajo: TrabajoIpc) => void): () => void
  suscribirProgreso(cb: (progreso: EventoProgresoIpc) => void): () => void
}

/** Subconjunto del servicio de importación de archivo (0042) que usa la IPC. */
export interface FuenteIpc {
  importar(ruta: string): Promise<ImportacionLeidaIpc>
  cancelar(id?: string): Promise<void>
  confirmar(
    id: string,
    metadatos: MetadatosEditables,
    opciones?: { cancionId: string }
  ): Promise<ResumenCancion>
  descartar(id: string): Promise<void>
}

/** Importación por lotes (ADR 0026, tarea 0314): lecturas, confirmación y reintento de las fuentes de archivo. */
export interface FuenteLoteIpc {
  leerArchivos(rutas?: string[]): Promise<LecturaLoteIpc | null>
  leerCarpeta(ruta?: string): Promise<LecturaLoteIpc | null>
  /** Ruta de una fila de la lectura (`ARGUMENTOS_NO_VALIDOS` si caducó o no existe). */
  rutaDeRef(ref: string): string
  infoLista(url: string): Promise<ListaYoutubeIpc>
  lote(peticion: LoteIpc): Promise<z.output<typeof resultadoLoteSchema>>
  espacioLibre(): Promise<{ libreBytes: number | null; factorMinutos: number | null }>
  /** `false` si la canción no es de un lote de archivos (el llamador prueba con YouTube). */
  reintentar(cancionId: string): Promise<boolean>
  cancelarLectura(): void
}

/** Subconjunto del servicio de YouTube (0049) que usa la IPC. Ausente con el módulo desactivado. */
export interface YoutubeIpc {
  info(url: string): Promise<InfoYoutubeIpc>
  cancelarInfo(consultaId?: string): Promise<void>
  confirmar(
    consultaId: string,
    metadatos: MetadatosEditables,
    opciones?: { cancionId: string }
  ): Promise<ResumenCancion>
  reintentar(cancionId: string): Promise<void>
}

/** Subconjunto del servicio de runtime (0036) que usa la IPC. */
export interface RuntimeIpc {
  estado(): Promise<EstadoRuntimeIpc>
  requisitos(recalcularEspacio: boolean): Promise<RequisitosRuntimeIpc>
  instalar(): void
  pausar(): Promise<void>
  detalles(): Promise<string>
  estimarSeparacion(duracionMs: number, modelo?: 'calidad' | 'rapido'): EstimacionSeparacion
  aceptarYUsarRapido(origen: OrigenRapido): Promise<void>
  volverACalidad(): Promise<void>
  cancelarVolverACalidad(): void
  alProgreso(cb: (progreso: ProgresoRuntimeIpc) => void): () => void
  alCambiar(cb: (estado: EstadoRuntimeIpc) => void): () => void
}

/** Servicio de separación (0065); mientras no exista, los canales responden `ERROR_INTERNO`. */
export interface SeparacionIpc {
  separar(cancionId: string): Promise<void>
  estimar(cancionId: string): EstimacionCancion
}

/** Servicio de letras (0082 y 0083); mientras no exista, los canales responden `ERROR_INTERNO`. */
export interface LetrasIpc {
  buscar(peticion: BusquedaLetra): Promise<ResultadoBusquedaLetra>
  /** Texto de un candidato guardado por su id de LRCLIB (ADR 0025 §7). */
  candidatoPorId(cancionId: string, lrclibId: number): Promise<CandidatoLetra | null>
  guardar(letra: GuardarLetra): Promise<ResumenCancion>
  editarTexto(peticion: EditarTextoLetra): Promise<ResumenCancion>
  editarTextoLinea(peticion: EditarTextoLinea, sesionId: string): Promise<ResumenCancion>
  guardarTiempos(peticion: GuardarTiempos, sesionId: string): Promise<ResumenCancion>
  abrirEdicion(id: string): EdicionLetraIpc | null
  cerrarEdicion(sesionId: string): void
  leerArchivo(): Promise<ArchivoLetraLeido>
}

export interface VentanaIpc {
  modoReproductor(activo: boolean): void
  fijarPantallaCompleta(activa: boolean): void
  estaEnPantallaCompleta(): boolean
  evitarReposo(activo: boolean): void
  suscribir(cb: (activa: boolean) => void): () => void
}

/** Subconjunto de `ServicioSesion` (0181) que usa la IPC; ausente, sus canales responden `ERROR_INTERNO`. */
export type SesionIpc = Pick<
  ServicioSesion,
  | 'edicionBloqueada'
  | 'cancionActiva'
  | 'esSecundariaVigente'
  | 'pantallas'
  | 'estadoPrincipal'
  | 'estadoDelRol'
  | 'abrir'
  | 'mostrar'
  | 'moverAPantalla'
  | 'fijarPantallaCompleta'
  | 'estaEnPantallaCompleta'
  | 'transporte'
  | 'siguiente'
  | 'empezar'
  | 'detenerTransicion'
  | 'repetir'
  | 'forzarCierre'
  | 'solicitarCierre'
  | 'confirmarCierre'
  | 'cancelarCierre'
  | 'inicial'
  | 'informar'
  | 'agregar'
  | 'mover'
  | 'quitar'
  | 'vaciar'
>

/** Subconjunto de `ServicioExportacion` (0237) que usa la IPC; ausente, sus canales responden `ERROR_INTERNO`. */
export type ExportacionServicioIpc = Pick<
  ServicioExportacion,
  | 'perfiles'
  | 'estimar'
  | 'destinoPropuesto'
  | 'elegirDestino'
  | 'iniciar'
  | 'destinoCarpeta'
  | 'iniciarLote'
  | 'previsualizarLote'
  | 'mostrarCarpetaLote'
  | 'cancelarLote'
  | 'reintentarLote'
  | 'cancelar'
  | 'cancelarTodas'
  | 'estado'
  | 'mostrarEnCarpeta'
  | 'avisosPendientes'
  | 'suscribir'
  | 'suscribirProgreso'
  | 'suscribirAviso'
>

/** Lo que la ventana offscreen de exportación (0234) ofrece a sus dos canales. */
export interface VentanaExportacionIpc {
  inicial(): InicialExportacionIpc
  confirmarListo(carga: { trabajoId: string; n: number }): void
}

/** Aviso de versión nueva (ADR 0023). */
export type ActualizacionesIpc = Pick<
  ServicioActualizaciones,
  'estado' | 'comprobar' | 'marcarVista' | 'suscribir'
>

interface ResultadoPrepararMain {
  aceptadas: string[]
  omitidas: { id: string; motivo: string }[]
  fines?: Record<string, number>
}

/** Subconjunto de `ServicioPreparacion` (0308) que usa la IPC. La tanda y la pausa son de la 0309. */
export interface PreparacionIpc {
  previsualizar(ids: string[]): {
    id: string
    aplica: boolean
    pasos: string[]
    confirmar?: 'finesSinMarca'
    motivo?: string
  }[]
  preparar(
    ids: string[],
    opciones?: { finesSinMarca?: boolean }
  ): ResultadoPrepararMain | Promise<ResultadoPrepararMain>
  cancelar(id: string): Promise<void>
}

/** Subconjunto de `ColaPreparacion` (0309): la tanda, la pausa y «Reintentar las fallidas». */
export interface ColaPreparacionIpc {
  pausar(): Promise<void>
  reanudar(): Promise<void>
  reintentarFallidas(): Promise<void>
  estado(): TandaPreparacionIpc | null
}

/** Exportar la letra a `.lrc` (ADR 0027 §4); ausente, sus canales responden `ERROR_INTERNO`. */
export type LrcIpc = Pick<ExportadorLrc, 'exportarUna' | 'exportarVarias' | 'mostrarEnCarpeta'>

/** Paquetes y copias de seguridad (ADR 0027); ausente, sus canales responden `ERROR_INTERNO`. */
export type CopiasIpc = Pick<
  ServicioCopias,
  | 'destinoPropuesto'
  | 'elegirDestino'
  | 'exportarCanciones'
  | 'exportarBiblioteca'
  | 'elegirOrigen'
  | 'leer'
  | 'importar'
  | 'origenDesdeRuta'
  | 'cancelar'
>

/** Recuento de líneas por revisar en memoria (`RecuentoRevision`). */
export interface RecuentoRevisionIpc {
  valor(id: string, modificada: string): RevisionResumenIpc | null | undefined
  calcular(id: string): Promise<RevisionResumenIpc | null>
  suscribir(cb: (id: string) => void): () => void
}

/** Subconjunto de `ServicioLotes` que usa la IPC. */
export type LotesIpc = Pick<
  ServicioLotes,
  | 'previsualizarDatos'
  | 'ejecutarDatos'
  | 'previsualizarEliminar'
  | 'ejecutarEliminar'
  | 'agregarACola'
  | 'quitarDeCola'
>

export interface DependenciasIpc {
  recuentoRevision?: RecuentoRevisionIpc
  lrc?: LrcIpc
  /** Acciones por lotes de la Biblioteca (0318); ausente, sus canales responden `ERROR_INTERNO`. */
  lotes?: LotesIpc
  copias?: CopiasIpc
  /** Solicitud de cierre sin responder (la pregunta el renderer al montar su diálogo de cierre). */
  solicitudCierrePendiente?(): import('../../shared/sesion').SolicitudCierreIpc | null
  preparacion?: PreparacionIpc
  /** Importación por lotes (0314); ausente, sus canales responden «no implementado». */
  lote?: FuenteLoteIpc
  colaPreparacion?: ColaPreparacionIpc
  actualizaciones?: ActualizacionesIpc
  /** Exportación de video (ADR 0019). */
  exportacion?: ExportacionServicioIpc
  /** Ventana offscreen vigente (0234). */
  ventanaExportacion?: () => VentanaExportacionIpc | null
  /** Sesión en vivo y cola (ADR 0017). */
  sesion?: SesionIpc
  /** El editor tiene un guardado que termina tarde (`app.guardadoPendiente`). */
  guardadoPendiente?(): boolean
  /** Lleva un error de la interfaz a `app.log` (0396); ausente, se ignora. */
  registrarErrorRenderer?(error: ErrorRendererIpc): void
  ventana?: VentanaIpc
  letras?: LetrasIpc
  /** Catálogo de temas (ADR 0016); ausente, los canales `temas.*` responden `ERROR_INTERNO`. */
  temas?: TemasIpc
  separacion?: SeparacionIpc
  picos?: Pick<ServicioPicos, 'solicitar' | 'leer' | 'duranteCambio'>
  runtime: RuntimeIpc
  /** Respuesta del renderer a la solicitud de cierre (`cierre.ts`). */
  fijarGuardadoPendiente?(pendiente: boolean): void
  confirmarCierre(): Promise<void>
  /** Sale de la aplicación (`app.quit()`). */
  salir(): void
  biblioteca: BibliotecaIpc
  fuente: FuenteIpc
  youtube?: YoutubeIpc
  elegirArchivoAudio(): Promise<string | null>
  trabajos: TrabajosIpc
  config: ConfigIpc
  infoSistema(): InfoSistema | Promise<InfoSistema>
  abrirExterno(url: string): Promise<void>
  textoLegal(tipo: TextoLegal): Promise<string>
  abrirCarpetaDatos(): Promise<void>
  registrar?(nivel: 'aviso' | 'error', mensaje: string): void
}

const ID_MEDIOS = /^[a-z0-9][a-z0-9-]{0,63}$/

/** La ruta absoluta de la miniatura no sale de main: el renderer recibe una URL de medios. */
export function resumenParaRenderer(
  r: ResumenCancion,
  memoria?: RevisionResumenIpc | null
): ResumenCancionIpc {
  const miniatura =
    r.miniatura !== null && ID_MEDIOS.test(r.id)
      ? `${ESQUEMA_MEDIOS}://${r.id}/fuente/miniatura.jpg`
      : null
  return { ...r, miniatura, revision: revisionDeResumen(r, memoria) }
}

export function eventoParaRenderer(
  e: EventoCancion,
  recuento?: RecuentoRevisionIpc
): EventoCancionIpc {
  return e.eliminada === true
    ? { id: e.id, eliminada: true }
    : {
        id: e.id,
        resumen: resumenParaRenderer(e.resumen, recuento?.valor(e.id, e.resumen.modificada))
      }
}

const esCodigo = (c: unknown): c is ErrorIpc['codigo'] =>
  typeof c === 'string' && (CODIGOS_ERROR as readonly string[]).includes(c)

/** Convierte cualquier excepción en `{ codigo, mensaje }` sin filtrar detalles internos. */
export function aErrorIpc(e: unknown): ErrorIpc {
  if (e instanceof ErrorDatosInvalidos) {
    return { codigo: 'ARGUMENTOS_NO_VALIDOS', mensaje: 'Los datos no son válidos.' }
  }
  if (e instanceof Error && esCodigo((e as { codigo?: unknown }).codigo)) {
    const { codigo, detalles } = e as unknown as { codigo: ErrorIpc['codigo']; detalles?: unknown }
    // `CONFIRMACION_OBSOLETA` lleva el impacto nuevo serializado (ADR 0016 §7, §11).
    const texto =
      typeof detalles === 'string'
        ? detalles
        : codigo === 'CONFIRMACION_OBSOLETA' && detalles !== undefined
          ? JSON.stringify(detalles)
          : ''
    return { codigo, mensaje: e.message, ...(texto ? { detalles: texto } : {}) }
  }
  return { codigo: 'ERROR_INTERNO', mensaje: 'Algo salió mal.' }
}

/** Quién llama: lo fija main a partir del registro de ventanas, nunca el renderer. */
export interface ContextoIpc {
  rol: RolVentana | null
  /** `webContents` remitente (para comprobar que es el de la sesión vigente). */
  sender: unknown
}

export type ManejadorIpc = (args: unknown[], ctx?: ContextoIpc) => Promise<RespuestaIpc<unknown>>

const CONTEXTO_PRINCIPAL: ContextoIpc = { rol: 'principal', sender: null }

/** Error con código estable para la IPC (`aErrorIpc` lo traduce). */
const errorConCodigo = (codigo: ErrorIpc['codigo'], mensaje: string): Error =>
  Object.assign(new Error(mensaje), { codigo })

/** Canales de 0.2.2 aún sin servicio (tarea 0339); cada tarea de feature saca el suyo de esta lista. */
const CANALES_NO_IMPLEMENTADOS = [
  CANALES.alineacion.estado,
  CANALES.alineacion.descargarModelo,
  CANALES.alineacion.cancelarDescarga,
  CANALES.alineacion.quitarModelo,
  CANALES.alineacion.previsualizar,
  CANALES.alineacion.alinear,
  CANALES.alineacion.cancelar
] as const satisfies readonly CanalInvocable[]

/** Un manejador por canal invocable: valida argumentos, ejecuta y envuelve el resultado. */
export function crearManejadores(deps: DependenciasIpc): Record<CanalInvocable, ManejadorIpc> {
  const { biblioteca, config, trabajos, fuente, runtime } = deps
  const aRenderer = (r: ResumenCancion): ResumenCancionIpc =>
    resumenParaRenderer(r, deps.recuentoRevision?.valor(r.id, r.modificada))
  /** Módulo desactivado: los canales de YouTube responden `ARGUMENTOS_NO_VALIDOS`. */
  const youtube = (): YoutubeIpc => {
    if (!deps.youtube) {
      throw Object.assign(new Error('YouTube no está disponible en esta versión.'), {
        codigo: 'ARGUMENTOS_NO_VALIDOS'
      })
    }
    return deps.youtube
  }

  const envolverCtx =
    <C extends CanalInvocable>(
      canal: C,
      fn: (ctx: ContextoIpc, ...args: z.output<(typeof CONTRATO)[C]['args']>) => unknown
    ): ManejadorIpc =>
    async (crudos, ctx = CONTEXTO_PRINCIPAL) => {
      const parseo = CONTRATO[canal].args.safeParse(crudos)
      if (!parseo.success) {
        return {
          ok: false,
          error: { codigo: 'ARGUMENTOS_NO_VALIDOS', mensaje: 'Los argumentos no son válidos.' }
        }
      }
      try {
        const valor = await fn(ctx, ...(parseo.data as never))
        return { ok: true, valor }
      } catch (e) {
        const error = aErrorIpc(e)
        if (error.codigo === 'ERROR_INTERNO') deps.registrar?.('error', `${canal}: ${String(e)}`)
        return { ok: false, error }
      }
    }

  const envolver = <C extends CanalInvocable>(
    canal: C,
    fn: (...args: z.output<(typeof CONTRATO)[C]['args']>) => unknown
  ): ManejadorIpc => envolverCtx(canal, (_ctx, ...args) => fn(...(args as never)))

  /** Sin servicio (hasta 0065) el canal falla con `ERROR_INTERNO`. */
  const separacion = (): SeparacionIpc => {
    if (!deps.separacion) throw new Error('El servicio de separación no está disponible.')
    return deps.separacion
  }

  const letras = (): LetrasIpc => {
    if (!deps.letras) throw new Error('El servicio de letras no está disponible.')
    return deps.letras
  }

  const temas = (): TemasIpc => {
    if (!deps.temas) throw new Error('El servicio de temas no está disponible.')
    return deps.temas
  }

  const lotes = (): LotesIpc => {
    if (!deps.lotes) throw new Error('Las acciones por lotes no están disponibles.')
    return deps.lotes
  }

  const sesion = (): SesionIpc => {
    if (!deps.sesion) throw new Error('El servicio de sesión no está disponible.')
    return deps.sesion
  }

  const actualizaciones = (): ActualizacionesIpc => {
    if (!deps.actualizaciones) throw new Error('El servicio de actualizaciones no está disponible.')
    return deps.actualizaciones
  }

  const lote = (): FuenteLoteIpc => {
    if (!deps.lote) throw new Error('La importación por lotes no está disponible.')
    return deps.lote
  }

  const preparacion = (): PreparacionIpc => {
    if (!deps.preparacion) throw new Error('El servicio de preparación no está disponible.')
    return deps.preparacion
  }

  const colaPreparacion = (): ColaPreparacionIpc => {
    if (!deps.colaPreparacion) throw new Error('La cola de preparación no está disponible.')
    return deps.colaPreparacion
  }

  const lrc = (): LrcIpc => {
    if (!deps.lrc) throw new Error('La exportación de letras no está disponible.')
    return deps.lrc
  }

  const copias = (): CopiasIpc => {
    if (!deps.copias) throw new Error('El servicio de copias no está disponible.')
    return deps.copias
  }

  const exportacion = (): ExportacionServicioIpc => {
    if (!deps.exportacion) throw new Error('El servicio de exportación no está disponible.')
    return deps.exportacion
  }

  /** Remitente por rol (ADR 0019 §10): la principal usa los canales de exportación; la ventana offscreen, solo los suyos. */
  const exigirRol = (ctx: ContextoIpc, rol: RolVentana): void => {
    if (ctx.rol !== rol) throw errorConCodigo('ARGUMENTOS_NO_VALIDOS', 'Origen no permitido.')
  }

  const ventanaExportacion = (): VentanaExportacionIpc => {
    const ventana = deps.ventanaExportacion?.()
    if (!ventana) throw new Error('No hay ventana de exportación.')
    return ventana
  }

  /** Defensa de ADR 0017 §9: durante la sesión no se edita la lista. */
  const sinSesion = (): void => {
    if (deps.sesion?.edicionBloqueada()) {
      throw errorConCodigo(
        'EDICION_BLOQUEADA',
        'No se puede editar mientras el reproductor está abierto en otra ventana.'
      )
    }
  }
  /** La canción activa de la sesión no se elimina ni vuelve a borrador. */
  const noActiva = (id: string): void => {
    if (deps.sesion?.cancionActiva(id)) {
      throw errorConCodigo('CANCION_EN_REPRODUCCION', 'La canción está en reproducción.')
    }
  }
  /** Un `webContents` de otra sesión (ya cerrada) no puede actuar. */
  const vigente = (ctx: ContextoIpc): void => {
    if (ctx.rol === 'secundaria' && !sesion().esSecundariaVigente(ctx.sender)) {
      throw errorConCodigo('SESION_NO_ACTIVA', 'No hay una sesión activa.')
    }
  }
  /** Rol de sesión de quien llama; la ventana de exportación no llama a canales de sesión. */
  const rolDe = (ctx: ContextoIpc): 'principal' | 'secundaria' =>
    ctx.rol === 'secundaria' ? 'secundaria' : 'principal'

  /** `obtener` con la apariencia resuelta con el catálogo vigente (ADR 0016 §9). */
  const cancionParaRenderer = (id: string): CancionIpc | null => {
    const cancion = biblioteca.obtener(id)
    if (!cancion) return null
    return { ...cancion, resuelta: resueltaDeResolucion(biblioteca.resolver(cancion)) }
  }

  /**
   * Canales de 0.2.2 declarados en la tarea 0339: validan argumentos y rol como cualquier canal y
   * responden `ERROR_INTERNO` «no implementado» hasta que la tarea de su feature sustituya el manejador
   * (cada una solo cambia su entrada de este objeto, no el registro).
   */
  const noImplementado =
    (canal: CanalInvocable): ManejadorIpc =>
    async (crudos, ctx = CONTEXTO_PRINCIPAL) => {
      if (!CONTRATO[canal].args.safeParse(crudos).success) {
        return {
          ok: false,
          error: { codigo: 'ARGUMENTOS_NO_VALIDOS', mensaje: 'Los argumentos no son válidos.' }
        }
      }
      try {
        exigirRol(ctx, 'principal')
      } catch (e) {
        return { ok: false, error: aErrorIpc(e) }
      }
      return { ok: false, error: { codigo: 'ERROR_INTERNO', mensaje: 'No implementado.' } }
    }
  const noImplementados = Object.fromEntries(
    CANALES_NO_IMPLEMENTADOS.map((canal) => [canal, noImplementado(canal)])
  ) as Record<(typeof CANALES_NO_IMPLEMENTADOS)[number], ManejadorIpc>

  return {
    [CANALES.actualizaciones.estado]: envolver(CANALES.actualizaciones.estado, () =>
      actualizaciones().estado()
    ),
    [CANALES.actualizaciones.comprobar]: envolver(CANALES.actualizaciones.comprobar, () =>
      actualizaciones().comprobar()
    ),
    [CANALES.actualizaciones.marcarVista]: envolver(
      CANALES.actualizaciones.marcarVista,
      ({ version }) => actualizaciones().marcarVista(version)
    ),
    [CANALES.preparacion.previsualizar]: envolver(CANALES.preparacion.previsualizar, ({ ids }) =>
      preparacion().previsualizar(ids)
    ),
    [CANALES.preparacion.preparar]: envolver(CANALES.preparacion.preparar, ({ ids }, opciones) =>
      preparacion().preparar(ids, opciones)
    ),
    [CANALES.preparacion.pausar]: envolver(CANALES.preparacion.pausar, () =>
      colaPreparacion().pausar()
    ),
    [CANALES.preparacion.reanudar]: envolver(CANALES.preparacion.reanudar, () =>
      colaPreparacion().reanudar()
    ),
    [CANALES.preparacion.reintentarFallidas]: envolver(CANALES.preparacion.reintentarFallidas, () =>
      colaPreparacion().reintentarFallidas()
    ),
    [CANALES.preparacion.tanda]: envolver(CANALES.preparacion.tanda, () =>
      colaPreparacion().estado()
    ),
    [CANALES.preparacion.cancelar]: envolver(CANALES.preparacion.cancelar, ({ id }) =>
      preparacion().cancelar(id)
    ),
    [CANALES.temas.catalogo]: envolver(CANALES.temas.catalogo, () => temas().catalogo()),
    [CANALES.temas.previsualizar]: envolver(CANALES.temas.previsualizar, (op) =>
      temas().previsualizar(op)
    ),
    [CANALES.temas.ejecutar]: envolver(CANALES.temas.ejecutar, (op, ficha) =>
      temas().ejecutar(op, ficha)
    ),
    [CANALES.temas.crear]: envolver(CANALES.temas.crear, (datos) => temas().crear(datos)),
    [CANALES.temas.renombrar]: envolver(CANALES.temas.renombrar, (datos) =>
      temas().renombrar(datos)
    ),
    [CANALES.temas.duplicar]: envolver(CANALES.temas.duplicar, (datos) => temas().duplicar(datos)),
    [CANALES.temas.reanudarBorrado]: envolver(CANALES.temas.reanudarBorrado, () =>
      temas().reanudarBorrado()
    ),
    [CANALES.temas.cancelarBorrado]: envolver(CANALES.temas.cancelarBorrado, () =>
      temas().cancelarBorrado()
    ),
    [CANALES.temas.descartarAvisoApartado]: envolver(CANALES.temas.descartarAvisoApartado, () =>
      temas().descartarAvisoApartado()
    ),
    [CANALES.letras.buscar]: envolver(CANALES.letras.buscar, (p) => letras().buscar(p)),
    [CANALES.letras.candidatoPorId]: envolver(
      CANALES.letras.candidatoPorId,
      ({ cancionId, lrclibId }) => letras().candidatoPorId(cancionId, lrclibId)
    ),
    [CANALES.letras.guardar]: envolver(CANALES.letras.guardar, async (p) => {
      sinSesion()
      return aRenderer(await letras().guardar(p))
    }),
    [CANALES.letras.editarTexto]: envolver(CANALES.letras.editarTexto, async (p) => {
      sinSesion()
      return aRenderer(await letras().editarTexto(p))
    }),
    [CANALES.letras.editarTextoLinea]: envolver(
      CANALES.letras.editarTextoLinea,
      async (p, sesionId) => {
        sinSesion()
        return aRenderer(await letras().editarTextoLinea(p, sesionId))
      }
    ),
    [CANALES.letras.guardarTiempos]: envolver(
      CANALES.letras.guardarTiempos,
      async (p, sesionId) => {
        sinSesion()
        return aRenderer(await letras().guardarTiempos(p, sesionId))
      }
    ),
    [CANALES.letras.abrirEdicion]: envolver(CANALES.letras.abrirEdicion, (id) => {
      sinSesion()
      return letras().abrirEdicion(id)
    }),
    [CANALES.letras.cerrarEdicion]: envolver(CANALES.letras.cerrarEdicion, (id) =>
      letras().cerrarEdicion(id)
    ),
    [CANALES.letras.exportarLrc]: envolver(CANALES.letras.exportarLrc, ({ cancionId }) =>
      lrc().exportarUna(cancionId)
    ),
    [CANALES.letras.exportarLrcVarias]: envolver(CANALES.letras.exportarLrcVarias, ({ ids }) =>
      lrc().exportarVarias(ids)
    ),
    [CANALES.letras.mostrarEnCarpeta]: envolver(
      CANALES.letras.mostrarEnCarpeta,
      ({ ubicacionId }) => lrc().mostrarEnCarpeta(ubicacionId)
    ),
    [CANALES.copias.destinoPropuesto]: envolver(CANALES.copias.destinoPropuesto, (p) =>
      copias().destinoPropuesto(p)
    ),
    [CANALES.copias.elegirDestino]: envolver(CANALES.copias.elegirDestino, ({ destinoId }) =>
      copias().elegirDestino(destinoId)
    ),
    [CANALES.copias.exportarCanciones]: envolver(CANALES.copias.exportarCanciones, (p) =>
      copias().exportarCanciones(p)
    ),
    [CANALES.copias.exportarBiblioteca]: envolver(CANALES.copias.exportarBiblioteca, (p) =>
      copias().exportarBiblioteca(p)
    ),
    [CANALES.copias.elegirOrigen]: envolver(CANALES.copias.elegirOrigen, () =>
      copias().elegirOrigen()
    ),
    [CANALES.copias.leer]: envolver(CANALES.copias.leer, ({ origenId }) => copias().leer(origenId)),
    [CANALES.copias.importar]: envolver(CANALES.copias.importar, (p) => copias().importar(p)),
    [CANALES.copias.origenDesdeRuta]: envolver(CANALES.copias.origenDesdeRuta, ({ ruta }) =>
      copias().origenDesdeRuta(ruta)
    ),
    [CANALES.copias.cancelar]: envolver(CANALES.copias.cancelar, ({ trabajoId }) =>
      copias().cancelar(trabajoId)
    ),
    [CANALES.letras.leerArchivo]: envolver(CANALES.letras.leerArchivo, () => {
      sinSesion()
      return letras().leerArchivo()
    }),
    [CANALES.ventana.modoReproductor]: envolver(CANALES.ventana.modoReproductor, (activo) => {
      if (activo && deps.sesion?.edicionBloqueada()) {
        throw errorConCodigo('SESION_EN_CURSO', 'Hay un reproductor abierto en otra ventana.')
      }
      return deps.ventana?.modoReproductor(activo)
    }),
    // Cada ventana actúa sobre la suya: la secundaria, sobre la de la sesión.
    [CANALES.ventana.fijarPantallaCompleta]: envolverCtx(
      CANALES.ventana.fijarPantallaCompleta,
      (ctx, activa) => {
        if (ctx.rol !== 'secundaria') return deps.ventana?.fijarPantallaCompleta(activa)
        vigente(ctx)
        return sesion().fijarPantallaCompleta(activa)
      }
    ),
    [CANALES.ventana.estaEnPantallaCompleta]: envolverCtx(
      CANALES.ventana.estaEnPantallaCompleta,
      (ctx) => {
        if (ctx.rol !== 'secundaria') return deps.ventana?.estaEnPantallaCompleta() ?? false
        vigente(ctx)
        return sesion().estaEnPantallaCompleta()
      }
    ),
    [CANALES.ventana.evitarReposo]: envolver(CANALES.ventana.evitarReposo, (activo) =>
      deps.ventana?.evitarReposo(activo)
    ),
    [CANALES.biblioteca.comprobarPistas]: envolver(
      CANALES.biblioteca.comprobarPistas,
      async (id) => {
        const resumen = await biblioteca.comprobarPistas(id)
        return resumen ? aRenderer(resumen) : null
      }
    ),
    [CANALES.biblioteca.recuentoRevision]: envolver(
      CANALES.biblioteca.recuentoRevision,
      (id) => deps.recuentoRevision?.calcular(id) ?? Promise.resolve(null)
    ),
    [CANALES.biblioteca.listar]: envolver(CANALES.biblioteca.listar, () =>
      biblioteca.listar().map(aRenderer)
    ),
    [CANALES.biblioteca.obtener]: envolver(CANALES.biblioteca.obtener, (id) =>
      cancionParaRenderer(id)
    ),
    [CANALES.biblioteca.valoresDatos]: envolver(CANALES.biblioteca.valoresDatos, () =>
      biblioteca.valoresDatos()
    ),
    [CANALES.biblioteca.actualizarMetadatos]: envolver(
      CANALES.biblioteca.actualizarMetadatos,
      async (id, metadatos) => {
        // «Editar datos»: lo que el usuario cambia pasa a ser suyo y nada lo sustituye solo (ADR 0025 §6).
        const origen = origenTrasEdicion(biblioteca.obtener(id)?.metadatos, metadatos)
        return aRenderer(
          await biblioteca.actualizar(id, {
            metadatos: { ...metadatos, ...(origen ? { origen } : {}) }
          })
        )
      }
    ),
    [CANALES.biblioteca.guardarApariencia]: envolver(
      CANALES.biblioteca.guardarApariencia,
      async (id, seleccion) => {
        sinSesion()
        return aRenderer(await biblioteca.guardarApariencia(id, seleccion))
      }
    ),
    [CANALES.biblioteca.marcarLista]: envolver(
      CANALES.biblioteca.marcarLista,
      async (id, opciones) => {
        sinSesion()
        return aRenderer(
          await (opciones ? biblioteca.marcarLista(id, opciones) : biblioteca.marcarLista(id))
        )
      }
    ),
    [CANALES.biblioteca.volverABorrador]: envolver(
      CANALES.biblioteca.volverABorrador,
      async (id) => {
        noActiva(id)
        return aRenderer(await biblioteca.volverABorrador(id))
      }
    ),
    [CANALES.biblioteca.marcarPreparacionRevisada]: envolver(
      CANALES.biblioteca.marcarPreparacionRevisada,
      async (id) => {
        const resumen = await biblioteca.marcarPreparacionRevisada(id)
        return resumen ? aRenderer(resumen) : null
      }
    ),
    [CANALES.biblioteca.editarDatosVariasPrevisualizar]: envolver(
      CANALES.biblioteca.editarDatosVariasPrevisualizar,
      ({ ids, artista, album }) => lotes().previsualizarDatos(ids, { artista, album })
    ),
    [CANALES.biblioteca.editarDatosVariasEjecutar]: envolver(
      CANALES.biblioteca.editarDatosVariasEjecutar,
      ({ ids, artista, album, version }) => lotes().ejecutarDatos(ids, { artista, album }, version)
    ),
    [CANALES.biblioteca.eliminarVariasPrevisualizar]: envolver(
      CANALES.biblioteca.eliminarVariasPrevisualizar,
      ({ ids }) => lotes().previsualizarEliminar(ids)
    ),
    [CANALES.biblioteca.eliminarVariasEjecutar]: envolver(
      CANALES.biblioteca.eliminarVariasEjecutar,
      ({ ids, version }) => lotes().ejecutarEliminar(ids, version)
    ),
    [CANALES.cola.agregarVarias]: envolver(CANALES.cola.agregarVarias, ({ ids }) =>
      lotes().agregarACola(ids)
    ),
    [CANALES.cola.quitarVarias]: envolver(CANALES.cola.quitarVarias, ({ entradaIds }) =>
      lotes().quitarDeCola(entradaIds)
    ),
    [CANALES.biblioteca.eliminar]: envolver(CANALES.biblioteca.eliminar, (id) => {
      noActiva(id)
      return deps.picos?.duranteCambio(id, () => biblioteca.eliminar(id)) ?? biblioteca.eliminar(id)
    }),
    [CANALES.picos.solicitar]: envolver(
      CANALES.picos.solicitar,
      (id, reintentar) => deps.picos?.solicitar(id, reintentar) ?? { estado: 'no_disponible' }
    ),
    [CANALES.picos.leer]: envolver(
      CANALES.picos.leer,
      (peticion) => deps.picos?.leer(peticion) ?? null
    ),
    [CANALES.biblioteca.mostrarEnCarpeta]: envolver(CANALES.biblioteca.mostrarEnCarpeta, (id) =>
      biblioteca.mostrarEnCarpeta(id)
    ),
    [CANALES.trabajos.listar]: envolver(CANALES.trabajos.listar, () => trabajos.listar()),
    [CANALES.trabajos.cancelar]: envolver(CANALES.trabajos.cancelar, (id) => trabajos.cancelar(id)),
    [CANALES.trabajos.hayPendientes]: envolver(CANALES.trabajos.hayPendientes, () =>
      trabajos.hayPendientes()
    ),
    [CANALES.config.obtener]: envolver(CANALES.config.obtener, () => config.obtener()),
    [CANALES.config.actualizar]: envolver(CANALES.config.actualizar, (parcial) =>
      config.actualizar(parcial as ConfigParcial)
    ),
    [CANALES.sistema.info]: envolver(CANALES.sistema.info, () => deps.infoSistema()),
    [CANALES.sistema.abrirEnlace]: envolver(CANALES.sistema.abrirEnlace, (url) =>
      deps.abrirExterno(url)
    ),
    [CANALES.sistema.textoLegal]: envolver(CANALES.sistema.textoLegal, (tipo) =>
      deps.textoLegal(tipo)
    ),
    [CANALES.sistema.abrirCarpetaDatos]: envolver(CANALES.sistema.abrirCarpetaDatos, () =>
      deps.abrirCarpetaDatos()
    ),
    [CANALES.sistema.elegirArchivoAudio]: envolver(CANALES.sistema.elegirArchivoAudio, () =>
      deps.elegirArchivoAudio()
    ),
    [CANALES.fuente.importarArchivo]: envolver(CANALES.fuente.importarArchivo, (entrada) =>
      fuente.importar(typeof entrada === 'string' ? entrada : lote().rutaDeRef(entrada.ref))
    ),
    [CANALES.fuente.cancelarImportacion]: envolver(CANALES.fuente.cancelarImportacion, (...ids) => {
      if (ids[0] === undefined) deps.lote?.cancelarLectura()
      return fuente.cancelar(ids[0])
    }),
    [CANALES.fuente.leerArchivos]: envolver(CANALES.fuente.leerArchivos, ({ rutas }) =>
      lote().leerArchivos(rutas)
    ),
    [CANALES.fuente.leerCarpeta]: envolver(CANALES.fuente.leerCarpeta, ({ ruta }) =>
      lote().leerCarpeta(ruta)
    ),
    [CANALES.fuente.infoLista]: envolver(CANALES.fuente.infoLista, ({ url }) =>
      lote().infoLista(url)
    ),
    [CANALES.fuente.lote]: envolver(CANALES.fuente.lote, (peticion) => lote().lote(peticion)),
    [CANALES.fuente.espacioLibre]: envolver(CANALES.fuente.espacioLibre, () =>
      lote().espacioLibre()
    ),
    [CANALES.fuente.confirmarArchivo]: envolver(
      CANALES.fuente.confirmarArchivo,
      async (id, metadatos, opciones?: { cancionId: string }) =>
        aRenderer(await fuente.confirmar(id, metadatos, opciones))
    ),
    [CANALES.fuente.descartarImportacion]: envolver(CANALES.fuente.descartarImportacion, (id) =>
      fuente.descartar(id)
    ),
    [CANALES.fuente.infoYoutube]: envolver(CANALES.fuente.infoYoutube, (url) =>
      youtube().info(url)
    ),
    [CANALES.fuente.cancelarInfo]: envolver(CANALES.fuente.cancelarInfo, (...ids) =>
      youtube().cancelarInfo(ids[0])
    ),
    [CANALES.fuente.confirmarYoutube]: envolver(
      CANALES.fuente.confirmarYoutube,
      async (id, metadatos, opciones?: { cancionId: string }) =>
        aRenderer(await youtube().confirmar(id, metadatos, opciones))
    ),
    [CANALES.fuente.reintentar]: envolver(CANALES.fuente.reintentar, async (id) => {
      // Una canción de un lote de archivos reintenta su importación; el resto, la descarga.
      if (deps.lote && (await deps.lote.reintentar(id))) return
      await youtube().reintentar(id)
    }),
    [CANALES.runtime.estado]: envolver(CANALES.runtime.estado, () => runtime.estado()),
    [CANALES.runtime.requisitos]: envolver(CANALES.runtime.requisitos, (opciones) =>
      runtime.requisitos(opciones.recalcularEspacio)
    ),
    // «Reparar el motor» cancela antes las exportaciones, como un trabajo más (ADR 0019 §8).
    [CANALES.runtime.instalar]: envolver(CANALES.runtime.instalar, async () => {
      await deps.exportacion?.cancelarTodas()
      runtime.instalar()
    }),
    [CANALES.runtime.pausar]: envolver(CANALES.runtime.pausar, () => runtime.pausar()),
    [CANALES.runtime.detalles]: envolver(CANALES.runtime.detalles, () => runtime.detalles()),
    [CANALES.runtime.estimarSeparacion]: envolver(CANALES.runtime.estimarSeparacion, (ms, modelo) =>
      runtime.estimarSeparacion(ms, modelo)
    ),
    [CANALES.separacion.separar]: envolver(CANALES.separacion.separar, (id) =>
      separacion().separar(id)
    ),
    [CANALES.separacion.estimar]: envolver(CANALES.separacion.estimar, (id) =>
      separacion().estimar(id)
    ),
    [CANALES.runtime.aceptarYUsarRapido]: envolver(CANALES.runtime.aceptarYUsarRapido, (origen) =>
      runtime.aceptarYUsarRapido(origen)
    ),
    [CANALES.runtime.volverACalidad]: envolver(CANALES.runtime.volverACalidad, () =>
      runtime.volverACalidad()
    ),
    [CANALES.runtime.cancelarVolverACalidad]: envolver(CANALES.runtime.cancelarVolverACalidad, () =>
      runtime.cancelarVolverACalidad()
    ),
    // --- Fase 4: pantallas, sesión y cola (ADR 0017 §11) ---
    [CANALES.pantallas.listar]: envolver(CANALES.pantallas.listar, () => sesion().pantallas()),
    [CANALES.sesion.estado]: envolver(CANALES.sesion.estado, () => sesion().estadoPrincipal()),
    [CANALES.sesion.abrir]: envolver(CANALES.sesion.abrir, (peticion) => {
      if (deps.guardadoPendiente?.()) {
        throw errorConCodigo('GUARDADO_PENDIENTE', 'El editor todavía está guardando.')
      }
      return sesion().abrir(peticion)
    }),
    [CANALES.sesion.mostrar]: envolver(CANALES.sesion.mostrar, () => sesion().mostrar()),
    [CANALES.sesion.moverAPantalla]: envolver(CANALES.sesion.moverAPantalla, (p) =>
      sesion().moverAPantalla(p.pantallaId)
    ),
    [CANALES.sesion.fijarPantallaCompleta]: envolver(
      CANALES.sesion.fijarPantallaCompleta,
      (activa) => sesion().fijarPantallaCompleta(activa)
    ),
    [CANALES.sesion.transporte]: envolver(CANALES.sesion.transporte, (p) =>
      sesion().transporte(p.accion, p.entradaId)
    ),
    [CANALES.sesion.siguiente]: envolverCtx(CANALES.sesion.siguiente, async (ctx, p) => {
      vigente(ctx)
      await sesion().siguiente(p.desdeEntradaId)
      return sesion().estadoDelRol(rolDe(ctx))
    }),
    [CANALES.sesion.empezar]: envolverCtx(CANALES.sesion.empezar, async (ctx, p) => {
      vigente(ctx)
      await sesion().empezar(p.candidataId)
      return sesion().estadoDelRol(rolDe(ctx))
    }),
    [CANALES.sesion.detenerTransicion]: envolverCtx(
      CANALES.sesion.detenerTransicion,
      async (ctx, p) => {
        vigente(ctx)
        await sesion().detenerTransicion(p.transicionId)
        return sesion().estadoDelRol(rolDe(ctx))
      }
    ),
    [CANALES.sesion.repetir]: envolverCtx(CANALES.sesion.repetir, async (ctx, p) => {
      vigente(ctx)
      await sesion().repetir(p.entradaId)
      return sesion().estadoDelRol(rolDe(ctx))
    }),
    [CANALES.sesion.forzarCierre]: envolver(CANALES.sesion.forzarCierre, () =>
      sesion().forzarCierre()
    ),
    [CANALES.sesion.solicitarCierre]: envolverCtx(CANALES.sesion.solicitarCierre, async (ctx) => {
      vigente(ctx)
      await sesion().solicitarCierre(rolDe(ctx))
      return sesion().estadoDelRol(rolDe(ctx))
    }),
    [CANALES.sesion.confirmarCierre]: envolverCtx(
      CANALES.sesion.confirmarCierre,
      async (ctx, p) => {
        vigente(ctx)
        await sesion().confirmarCierre(p.cola, p.revision)
      }
    ),
    [CANALES.sesion.cancelarCierre]: envolverCtx(CANALES.sesion.cancelarCierre, async (ctx) => {
      vigente(ctx)
      await sesion().cancelarCierre()
    }),
    [CANALES.sesion.inicial]: envolverCtx(CANALES.sesion.inicial, (ctx) =>
      sesion().inicial(ctx.sender)
    ),
    // Un `webContents` ajeno (de otra sesión) recibe `{ aplicado: false }`, sin error.
    [CANALES.sesion.informar]: envolverCtx(CANALES.sesion.informar, (ctx, informe) =>
      sesion().informar(informe, ctx.sender)
    ),
    [CANALES.sesion.preferencias]: envolverCtx(CANALES.sesion.preferencias, (ctx) => {
      vigente(ctx)
      return config.obtener().reproductor
    }),
    [CANALES.sesion.guardarPreferencias]: envolverCtx(
      CANALES.sesion.guardarPreferencias,
      async (ctx, parcial) => {
        vigente(ctx)
        return (await config.actualizar({ reproductor: parcial })).reproductor
      }
    ),
    [CANALES.cola.agregar]: envolver(CANALES.cola.agregar, (p) =>
      sesion().agregar(p.cancionId, p.donde)
    ),
    [CANALES.cola.mover]: envolver(CANALES.cola.mover, (p) =>
      sesion().mover(p.entradaId, p.antesDe)
    ),
    [CANALES.cola.quitar]: envolver(CANALES.cola.quitar, (p) => sesion().quitar(p.entradaId)),
    [CANALES.cola.vaciar]: envolver(CANALES.cola.vaciar, (p) => sesion().vaciar(p.contexto)),
    [CANALES.exportacion.perfiles]: envolverCtx(CANALES.exportacion.perfiles, (ctx) => {
      exigirRol(ctx, 'principal')
      return exportacion().perfiles()
    }),
    [CANALES.exportacion.estimar]: envolverCtx(CANALES.exportacion.estimar, (ctx, p) => {
      exigirRol(ctx, 'principal')
      return exportacion().estimar(p)
    }),
    [CANALES.exportacion.destinoPropuesto]: envolverCtx(
      CANALES.exportacion.destinoPropuesto,
      (ctx, p) => {
        exigirRol(ctx, 'principal')
        return exportacion().destinoPropuesto(p)
      }
    ),
    [CANALES.exportacion.elegirDestino]: envolverCtx(
      CANALES.exportacion.elegirDestino,
      (ctx, p) => {
        exigirRol(ctx, 'principal')
        return exportacion().elegirDestino(p.destinoId)
      }
    ),
    [CANALES.exportacion.iniciar]: envolverCtx(CANALES.exportacion.iniciar, (ctx, p) => {
      exigirRol(ctx, 'principal')
      return exportacion().iniciar(p)
    }),
    [CANALES.exportacion.destinoCarpeta]: envolverCtx(
      CANALES.exportacion.destinoCarpeta,
      (ctx, p) => {
        exigirRol(ctx, 'principal')
        return exportacion().destinoCarpeta(p.desdeCarpetaId)
      }
    ),
    [CANALES.exportacion.iniciarLote]: envolverCtx(CANALES.exportacion.iniciarLote, (ctx, p) => {
      exigirRol(ctx, 'principal')
      return exportacion().iniciarLote(p)
    }),
    [CANALES.exportacion.previsualizarLote]: envolverCtx(
      CANALES.exportacion.previsualizarLote,
      (ctx, p) => {
        exigirRol(ctx, 'principal')
        return exportacion().previsualizarLote(p)
      }
    ),
    [CANALES.exportacion.mostrarCarpetaLote]: envolverCtx(
      CANALES.exportacion.mostrarCarpetaLote,
      (ctx, p) => {
        exigirRol(ctx, 'principal')
        return exportacion().mostrarCarpetaLote(p.loteId)
      }
    ),
    [CANALES.exportacion.cancelarLote]: envolverCtx(CANALES.exportacion.cancelarLote, (ctx, p) => {
      exigirRol(ctx, 'principal')
      return exportacion().cancelarLote(p.loteId)
    }),
    [CANALES.exportacion.reintentarLote]: envolverCtx(
      CANALES.exportacion.reintentarLote,
      (ctx, p) => {
        exigirRol(ctx, 'principal')
        return exportacion().reintentarLote(p.loteId)
      }
    ),
    [CANALES.exportacion.cancelar]: envolverCtx(CANALES.exportacion.cancelar, (ctx, p) => {
      exigirRol(ctx, 'principal')
      return exportacion().cancelar(p.trabajoId)
    }),
    [CANALES.exportacion.estado]: envolverCtx(CANALES.exportacion.estado, (ctx) => {
      exigirRol(ctx, 'principal')
      return exportacion().estado()
    }),
    [CANALES.exportacion.mostrarEnCarpeta]: envolverCtx(
      CANALES.exportacion.mostrarEnCarpeta,
      (ctx, ref) => {
        exigirRol(ctx, 'principal')
        return exportacion().mostrarEnCarpeta(ref)
      }
    ),
    [CANALES.exportacion.avisosPendientes]: envolverCtx(
      CANALES.exportacion.avisosPendientes,
      (ctx) => {
        exigirRol(ctx, 'principal')
        return exportacion().avisosPendientes()
      }
    ),
    [CANALES.exportacion.inicial]: envolverCtx(CANALES.exportacion.inicial, (ctx) => {
      exigirRol(ctx, 'exportacion')
      return ventanaExportacion().inicial()
    }),
    [CANALES.exportacion.listo]: envolverCtx(CANALES.exportacion.listo, (ctx, carga) => {
      exigirRol(ctx, 'exportacion')
      return ventanaExportacion().confirmarListo(carga)
    }),
    ...noImplementados,
    [CANALES.app.guardadoPendiente]: envolver(CANALES.app.guardadoPendiente, (pendiente) =>
      deps.fijarGuardadoPendiente?.(pendiente)
    ),
    [CANALES.app.registrarError]: envolver(CANALES.app.registrarError, (error) =>
      deps.registrarErrorRenderer?.(error)
    ),
    [CANALES.app.confirmarCierre]: envolver(CANALES.app.confirmarCierre, () =>
      deps.confirmarCierre()
    ),
    [CANALES.app.solicitudCierrePendiente]: envolver(
      CANALES.app.solicitudCierrePendiente,
      () => deps.solicitudCierrePendiente?.() ?? null
    ),
    [CANALES.app.salir]: envolver(CANALES.app.salir, () => deps.salir())
  }
}

/** Mínimo de `ipcMain` que se usa. */
export interface IpcMainLike {
  handle(canal: string, fn: (evento: unknown, ...args: unknown[]) => unknown): void
  removeHandler(canal: string): void
}

export interface OpcionesRegistro {
  /** Debe devolver true solo si el evento viene de una ventana con permiso en ese canal. */
  remitenteValido?: (evento: unknown, canal: string) => boolean
  /** Rol registrado del remitente (`RegistroVentanas.rolDe(evento.sender)`); sin él, `principal`. */
  rolDe?: (evento: unknown) => RolVentana | null
  /** Envía un evento a la ventana con ese rol (ADR 0017 §11); no hace nada si no existe. */
  enviarA: (rol: RolVentana, canal: string, carga: unknown) => void
}

/** Registra los canales y reenvía los eventos de los servicios. Devuelve la función para deshacerlo. */
export function registrarIpc(
  ipc: IpcMainLike,
  deps: DependenciasIpc,
  opciones: OpcionesRegistro
): () => void {
  const manejadores = crearManejadores(deps)
  const canales = Object.keys(manejadores) as CanalInvocable[]
  for (const canal of canales) {
    ipc.handle(canal, (evento, ...args) => {
      if (opciones.remitenteValido && !opciones.remitenteValido(evento, canal)) {
        return {
          ok: false,
          error: { codigo: 'ARGUMENTOS_NO_VALIDOS', mensaje: 'Origen no permitido.' }
        } satisfies RespuestaIpc<never>
      }
      const contexto: ContextoIpc = {
        rol: opciones.rolDe ? opciones.rolDe(evento) : 'principal',
        sender: (evento as { sender?: unknown } | null)?.sender ?? null
      }
      return manejadores[canal](args, contexto)
    })
  }
  // Los eventos de datos son de la principal; el servicio de sesión envía los suyos a cada rol.
  const aPrincipal = (canal: string, carga: unknown): void =>
    opciones.enviarA('principal', canal, carga)
  const bajaPantallaCompleta = deps.ventana?.suscribir((activa) =>
    aPrincipal(CANALES.eventos.pantallaCompleta, activa)
  )
  const bajaCancion = deps.biblioteca.suscribir((e) =>
    aPrincipal(CANALES.eventos.cancion, eventoParaRenderer(e, deps.recuentoRevision))
  )
  // Un recuento calculado en segundo plano que cambia lo que ya se mostraba llega como un resumen nuevo.
  const bajaRecuento = deps.recuentoRevision?.suscribir((id) => {
    const r = deps.biblioteca.listar().find((x) => x.id === id)
    if (r)
      aPrincipal(
        CANALES.eventos.cancion,
        eventoParaRenderer({ id, resumen: r }, deps.recuentoRevision)
      )
  })
  // La secundaria solo recibe `config.reproductor`, y solo cuando cambia (ADR 0017 §11).
  let reproductorPrevio = JSON.stringify(deps.config.obtener().reproductor)
  const bajaConfig = deps.config.suscribir((c) => {
    aPrincipal(CANALES.eventos.config, c)
    const reproductor = JSON.stringify(c.reproductor)
    if (reproductor === reproductorPrevio) return
    reproductorPrevio = reproductor
    opciones.enviarA('secundaria', CANALES.eventos.sesionPreferencias, c.reproductor)
  })
  const bajaTrabajo = deps.trabajos.suscribir((t) => aPrincipal(CANALES.eventos.trabajo, t))
  const bajaProgreso = deps.trabajos.suscribirProgreso((p) =>
    aPrincipal(CANALES.eventos.trabajoProgreso, p)
  )
  const bajaRtProgreso = deps.runtime.alProgreso((p) =>
    aPrincipal(CANALES.eventos.runtimeProgreso, p)
  )
  const bajaRtCambio = deps.runtime.alCambiar((e) => aPrincipal(CANALES.eventos.runtimeCambio, e))
  const bajasExportacion = [
    deps.exportacion?.suscribir((e) => aPrincipal(CANALES.eventos.exportacionCambio, e)),
    deps.exportacion?.suscribirProgreso((p) => aPrincipal(CANALES.eventos.exportacionProgreso, p)),
    deps.exportacion?.suscribirAviso((a) => aPrincipal(CANALES.eventos.exportacionAviso, a))
  ]
  const bajaActualizaciones = deps.actualizaciones?.suscribir((e) =>
    aPrincipal(CANALES.eventos.actualizacionesCambio, e)
  )
  return () => {
    bajaActualizaciones?.()
    for (const baja of bajasExportacion) baja?.()
    bajaPantallaCompleta?.()
    bajaRtProgreso()
    bajaRtCambio()
    bajaCancion()
    bajaRecuento?.()
    bajaConfig()
    bajaTrabajo()
    bajaProgreso()
    for (const canal of canales) ipc.removeHandler(canal)
  }
}
