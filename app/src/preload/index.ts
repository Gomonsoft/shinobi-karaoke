import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { CANALES } from '../shared/canales'
import type { ApiShinobi, RespuestaIpc } from '../shared/ipc'

/** Invoca un canal; si main responde con error, la promesa rechaza con `{ codigo, mensaje }`. */
async function invocar<T>(canal: string, ...args: unknown[]): Promise<T> {
  let respuesta: RespuestaIpc<T>
  try {
    respuesta = (await ipcRenderer.invoke(canal, ...args)) as RespuestaIpc<T>
  } catch {
    throw { codigo: 'ERROR_INTERNO', mensaje: 'Algo salió mal.' }
  }
  if (respuesta.ok) return respuesta.valor
  throw { codigo: respuesta.error.codigo, mensaje: respuesta.error.mensaje }
}

/** Suscripción que no filtra el objeto `event` de Electron al renderer. */
function suscribir<T>(canal: string, cb: (carga: T) => void): () => void {
  const oyente = (_evento: IpcRendererEvent, carga: T): void => cb(carga)
  ipcRenderer.on(canal, oyente)
  return () => {
    ipcRenderer.removeListener(canal, oyente)
  }
}

const api: ApiShinobi = {
  biblioteca: {
    listar: () => invocar(CANALES.biblioteca.listar),
    obtener: (id) => invocar(CANALES.biblioteca.obtener, id),
    actualizarMetadatos: (id, metadatos) =>
      invocar(CANALES.biblioteca.actualizarMetadatos, id, metadatos),
    volverABorrador: (id) => invocar(CANALES.biblioteca.volverABorrador, id),
    eliminar: (id) => invocar(CANALES.biblioteca.eliminar, id),
    mostrarEnCarpeta: (id) => invocar(CANALES.biblioteca.mostrarEnCarpeta, id)
  },
  trabajos: {
    listar: () => invocar(CANALES.trabajos.listar),
    cancelar: (id) => invocar(CANALES.trabajos.cancelar, id),
    hayPendientes: () => invocar(CANALES.trabajos.hayPendientes),
    alCambiar: (cb) => suscribir(CANALES.eventos.trabajo, cb),
    alProgreso: (cb) => suscribir(CANALES.eventos.trabajoProgreso, cb)
  },
  config: {
    obtener: () => invocar(CANALES.config.obtener),
    actualizar: (parcial) => invocar(CANALES.config.actualizar, parcial)
  },
  sistema: {
    info: () => invocar(CANALES.sistema.info),
    abrirEnlace: (url) => invocar(CANALES.sistema.abrirEnlace, url)
  },
  alCambiarCancion: (cb) => suscribir(CANALES.eventos.cancion, cb),
  alCambiarConfig: (cb) => suscribir(CANALES.eventos.config, cb),
  alAccionMenu: (cb) => suscribir(CANALES.eventos.menu, cb),
  rutaDeArchivo: (archivo) => webUtils.getPathForFile(archivo)
}

contextBridge.exposeInMainWorld('shinobi', api)
