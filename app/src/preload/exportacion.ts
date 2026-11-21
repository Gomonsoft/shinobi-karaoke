import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CANALES } from '../shared/canales'
import type { ApiExportacion, RespuestaIpc } from '../shared/ipc'

/** Mismo patrón que `preload/index.ts`; esta ventana no ve `window.shinobi` (ADR 0019 §10). */
async function invocar<T>(canal: string, ...args: unknown[]): Promise<T> {
  let respuesta: RespuestaIpc<T>
  try {
    respuesta = (await ipcRenderer.invoke(canal, ...args)) as RespuestaIpc<T>
  } catch {
    throw { codigo: 'ERROR_INTERNO', mensaje: 'Algo salió mal.' }
  }
  if (respuesta.ok) return respuesta.valor
  const { codigo, mensaje, detalles } = respuesta.error
  throw detalles === undefined ? { codigo, mensaje } : { codigo, mensaje, detalles }
}

function suscribir<T>(canal: string, cb: (carga: T) => void): () => void {
  const oyente = (_evento: IpcRendererEvent, carga: T): void => cb(carga)
  ipcRenderer.on(canal, oyente)
  return () => {
    ipcRenderer.removeListener(canal, oyente)
  }
}

const api: ApiExportacion = {
  inicial: () => invocar(CANALES.exportacion.inicial),
  listo: (trabajoId, n) => invocar(CANALES.exportacion.listo, { trabajoId, n }),
  alFotograma: (cb) => suscribir(CANALES.eventos.exportacionFotograma, cb)
}

contextBridge.exposeInMainWorld('shinobiExportacion', api)
