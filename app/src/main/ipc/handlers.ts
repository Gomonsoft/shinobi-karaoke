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
  type RespuestaIpc,
  type ResumenCancionIpc,
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

export interface DependenciasIpc {
  biblioteca: BibliotecaIpc
  trabajos: TrabajosIpc
  config: ConfigIpc
  infoSistema(): InfoSistema
  abrirExterno(url: string): Promise<void>
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
    return { codigo: (e as unknown as ErrorIpc).codigo, mensaje: e.message }
  }
  return { codigo: 'ERROR_INTERNO', mensaje: 'Algo salió mal.' }
}

export type ManejadorIpc = (args: unknown[]) => Promise<RespuestaIpc<unknown>>

/** Un manejador por canal invocable: valida argumentos, ejecuta y envuelve el resultado. */
export function crearManejadores(deps: DependenciasIpc): Record<CanalInvocable, ManejadorIpc> {
  const { biblioteca, config, trabajos } = deps

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

  return {
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
    )
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
  return () => {
    bajaCancion()
    bajaConfig()
    bajaTrabajo()
    bajaProgreso()
    for (const canal of canales) ipc.removeHandler(canal)
  }
}
