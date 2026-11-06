import type { z } from 'zod'
import {
  CANALES,
  CONTRATO,
  type CanalInvocable,
  type ErrorIpc,
  type EventoCancionIpc,
  type EventoProgresoIpc,
  type TrabajoIpc,
  type InfoSistema,
  type TextoLegal,
  type RespuestaIpc,
  type ResumenCancionIpc,
  type ImportacionLeidaIpc,
  type InfoYoutubeIpc,
  type EstadoRuntimeIpc,
  type OrigenRapido,
  type EstimacionSeparacion,
  type EstimacionCancion,
  type ProgresoRuntimeIpc,
  type RequisitosRuntimeIpc,
  type MetadatosEditables,
  type BusquedaLetra,
  type ResultadoBusquedaLetra,
  type GuardarLetra,
  type GuardarTiempos,
  type Estilo,
  type EditarTextoLetra,
  type ArchivoLetraLeido,
  CODIGOS_ERROR,
  ErrorDatosInvalidos,
  type Cancion,
  type Config
} from '../../shared'
import type { ConfigParcial } from '../configuracion'
import type { EventoCancion, ResumenCancion } from '../biblioteca'
import { ESQUEMA_MEDIOS } from '../medios'

/** Subconjuntos de los servicios que usa la IPC (se simulan en los tests). */
export interface BibliotecaIpc {
  listar(): ResumenCancion[]
  obtener(id: string): Cancion | null
  actualizar(
    id: string,
    cambio: { metadatos: { titulo: string; artista: string; album: string | null } }
  ): Promise<ResumenCancion>
  guardarEstilo(id: string, estilo: Estilo): Promise<ResumenCancion>
  marcarLista(id: string): Promise<ResumenCancion>
  volverABorrador(id: string): Promise<ResumenCancion>
  eliminar(id: string): Promise<void>
  mostrarEnCarpeta(id: string): Promise<void>
  suscribir(cb: (evento: EventoCancion) => void): () => void
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
  guardar(letra: GuardarLetra): Promise<ResumenCancion>
  editarTexto(peticion: EditarTextoLetra): Promise<ResumenCancion>
  guardarTiempos(peticion: GuardarTiempos): Promise<ResumenCancion>
  leerArchivo(): Promise<ArchivoLetraLeido>
}

export interface DependenciasIpc {
  letras?: LetrasIpc
  separacion?: SeparacionIpc
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
export function resumenParaRenderer(r: ResumenCancion): ResumenCancionIpc {
  const miniatura =
    r.miniatura !== null && ID_MEDIOS.test(r.id)
      ? `${ESQUEMA_MEDIOS}://${r.id}/fuente/miniatura.jpg`
      : null
  return { ...r, miniatura }
}

export function eventoParaRenderer(e: EventoCancion): EventoCancionIpc {
  return e.eliminada === true
    ? { id: e.id, eliminada: true }
    : { id: e.id, resumen: resumenParaRenderer(e.resumen) }
}

const esCodigo = (c: unknown): c is ErrorIpc['codigo'] =>
  typeof c === 'string' && (CODIGOS_ERROR as readonly string[]).includes(c)

/** Convierte cualquier excepción en `{ codigo, mensaje }` sin filtrar detalles internos. */
export function aErrorIpc(e: unknown): ErrorIpc {
  if (e instanceof ErrorDatosInvalidos) {
    return { codigo: 'ARGUMENTOS_NO_VALIDOS', mensaje: 'Los datos no son válidos.' }
  }
  if (e instanceof Error && esCodigo((e as { codigo?: unknown }).codigo)) {
    const detalles = (e as { detalles?: unknown }).detalles
    return {
      codigo: (e as unknown as ErrorIpc).codigo,
      mensaje: e.message,
      ...(typeof detalles === 'string' && detalles ? { detalles } : {})
    }
  }
  return { codigo: 'ERROR_INTERNO', mensaje: 'Algo salió mal.' }
}

export type ManejadorIpc = (args: unknown[]) => Promise<RespuestaIpc<unknown>>

/** Un manejador por canal invocable: valida argumentos, ejecuta y envuelve el resultado. */
export function crearManejadores(deps: DependenciasIpc): Record<CanalInvocable, ManejadorIpc> {
  const { biblioteca, config, trabajos, fuente, runtime } = deps
  /** Módulo desactivado: los canales de YouTube responden `ARGUMENTOS_NO_VALIDOS`. */
  const youtube = (): YoutubeIpc => {
    if (!deps.youtube) {
      throw Object.assign(new Error('YouTube no está disponible en esta versión.'), {
        codigo: 'ARGUMENTOS_NO_VALIDOS'
      })
    }
    return deps.youtube
  }

  const envolver =
    <C extends CanalInvocable>(
      canal: C,
      fn: (...args: z.output<(typeof CONTRATO)[C]['args']>) => unknown
    ): ManejadorIpc =>
    async (crudos) => {
      const parseo = CONTRATO[canal].args.safeParse(crudos)
      if (!parseo.success) {
        return {
          ok: false,
          error: { codigo: 'ARGUMENTOS_NO_VALIDOS', mensaje: 'Los argumentos no son válidos.' }
        }
      }
      try {
        const valor = await fn(...(parseo.data as never))
        return { ok: true, valor }
      } catch (e) {
        const error = aErrorIpc(e)
        if (error.codigo === 'ERROR_INTERNO') deps.registrar?.('error', `${canal}: ${String(e)}`)
        return { ok: false, error }
      }
    }

  /** Sin servicio (hasta 0065) el canal falla con `ERROR_INTERNO`. */
  const separacion = (): SeparacionIpc => {
    if (!deps.separacion) throw new Error('El servicio de separación no está disponible.')
    return deps.separacion
  }

  const letras = (): LetrasIpc => {
    if (!deps.letras) throw new Error('El servicio de letras no está disponible.')
    return deps.letras
  }

  return {
    [CANALES.letras.buscar]: envolver(CANALES.letras.buscar, (p) => letras().buscar(p)),
    [CANALES.letras.guardar]: envolver(CANALES.letras.guardar, async (p) =>
      resumenParaRenderer(await letras().guardar(p))
    ),
    [CANALES.letras.editarTexto]: envolver(CANALES.letras.editarTexto, async (p) =>
      resumenParaRenderer(await letras().editarTexto(p))
    ),
    [CANALES.letras.guardarTiempos]: envolver(CANALES.letras.guardarTiempos, async (p) =>
      resumenParaRenderer(await letras().guardarTiempos(p))
    ),
    [CANALES.letras.leerArchivo]: envolver(CANALES.letras.leerArchivo, () =>
      letras().leerArchivo()
    ),
    [CANALES.biblioteca.listar]: envolver(CANALES.biblioteca.listar, () =>
      biblioteca.listar().map(resumenParaRenderer)
    ),
    [CANALES.biblioteca.obtener]: envolver(CANALES.biblioteca.obtener, (id) =>
      biblioteca.obtener(id)
    ),
    [CANALES.biblioteca.actualizarMetadatos]: envolver(
      CANALES.biblioteca.actualizarMetadatos,
      async (id, metadatos) => resumenParaRenderer(await biblioteca.actualizar(id, { metadatos }))
    ),
    [CANALES.biblioteca.guardarEstilo]: envolver(
      CANALES.biblioteca.guardarEstilo,
      async (id, estilo) => resumenParaRenderer(await biblioteca.guardarEstilo(id, estilo))
    ),
    [CANALES.biblioteca.marcarLista]: envolver(CANALES.biblioteca.marcarLista, async (id) =>
      resumenParaRenderer(await biblioteca.marcarLista(id))
    ),
    [CANALES.biblioteca.volverABorrador]: envolver(CANALES.biblioteca.volverABorrador, async (id) =>
      resumenParaRenderer(await biblioteca.volverABorrador(id))
    ),
    [CANALES.biblioteca.eliminar]: envolver(CANALES.biblioteca.eliminar, (id) =>
      biblioteca.eliminar(id)
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
    [CANALES.fuente.importarArchivo]: envolver(CANALES.fuente.importarArchivo, (ruta) =>
      fuente.importar(ruta)
    ),
    [CANALES.fuente.cancelarImportacion]: envolver(CANALES.fuente.cancelarImportacion, (...ids) =>
      fuente.cancelar(ids[0])
    ),
    [CANALES.fuente.confirmarArchivo]: envolver(
      CANALES.fuente.confirmarArchivo,
      async (id, metadatos, opciones?: { cancionId: string }) =>
        resumenParaRenderer(await fuente.confirmar(id, metadatos, opciones))
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
        resumenParaRenderer(await youtube().confirmar(id, metadatos, opciones))
    ),
    [CANALES.fuente.reintentar]: envolver(CANALES.fuente.reintentar, (id) =>
      youtube().reintentar(id)
    ),
    [CANALES.runtime.estado]: envolver(CANALES.runtime.estado, () => runtime.estado()),
    [CANALES.runtime.requisitos]: envolver(CANALES.runtime.requisitos, (opciones) =>
      runtime.requisitos(opciones.recalcularEspacio)
    ),
    [CANALES.runtime.instalar]: envolver(CANALES.runtime.instalar, () => runtime.instalar()),
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
    [CANALES.app.guardadoPendiente]: envolver(CANALES.app.guardadoPendiente, (pendiente) =>
      deps.fijarGuardadoPendiente?.(pendiente)
    ),
    [CANALES.app.confirmarCierre]: envolver(CANALES.app.confirmarCierre, () =>
      deps.confirmarCierre()
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
  /** Debe devolver true solo para los eventos que vienen de nuestra ventana. */
  remitenteValido?: (evento: unknown) => boolean
  /** Envía un evento a todos los renderers. */
  difundir: (canal: string, carga: unknown) => void
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
      if (opciones.remitenteValido && !opciones.remitenteValido(evento)) {
        return {
          ok: false,
          error: { codigo: 'ARGUMENTOS_NO_VALIDOS', mensaje: 'Origen no permitido.' }
        } satisfies RespuestaIpc<never>
      }
      return manejadores[canal](args)
    })
  }
  const bajaCancion = deps.biblioteca.suscribir((e) =>
    opciones.difundir(CANALES.eventos.cancion, eventoParaRenderer(e))
  )
  const bajaConfig = deps.config.suscribir((c) => opciones.difundir(CANALES.eventos.config, c))
  const bajaTrabajo = deps.trabajos.suscribir((t) => opciones.difundir(CANALES.eventos.trabajo, t))
  const bajaProgreso = deps.trabajos.suscribirProgreso((p) =>
    opciones.difundir(CANALES.eventos.trabajoProgreso, p)
  )
  const bajaRtProgreso = deps.runtime.alProgreso((p) =>
    opciones.difundir(CANALES.eventos.runtimeProgreso, p)
  )
  const bajaRtCambio = deps.runtime.alCambiar((e) =>
    opciones.difundir(CANALES.eventos.runtimeCambio, e)
  )
  return () => {
    bajaRtProgreso()
    bajaRtCambio()
    bajaCancion()
    bajaConfig()
    bajaTrabajo()
    bajaProgreso()
    for (const canal of canales) ipc.removeHandler(canal)
  }
}
