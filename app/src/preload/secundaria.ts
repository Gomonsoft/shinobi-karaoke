import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CANALES } from '../shared/canales'
import type { ApiReproductor, RespuestaIpc } from '../shared/ipc'

/** Mismo patrón que `preload/index.ts`; esta ventana no ve `window.shinobi` (ADR 0017 §2). */
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

const api: ApiReproductor = {
  sesion: {
    inicial: () => invocar(CANALES.sesion.inicial),
    informar: (informe) => invocar(CANALES.sesion.informar, informe),
    siguiente: (desdeEntradaId) => invocar(CANALES.sesion.siguiente, { desdeEntradaId }),
    empezar: (candidataId) => invocar(CANALES.sesion.empezar, { candidataId }),
    detenerTransicion: (transicionId) =>
      invocar(CANALES.sesion.detenerTransicion, { transicionId }),
    repetir: (entradaId) => invocar(CANALES.sesion.repetir, { entradaId }),
    cierre: {
      solicitar: () => invocar(CANALES.sesion.solicitarCierre),
      confirmar: (cola, revision) => invocar(CANALES.sesion.confirmarCierre, { cola, revision }),
      cancelar: () => invocar(CANALES.sesion.cancelarCierre)
    },
    preferencias: () => invocar(CANALES.sesion.preferencias),
    guardarPreferencias: (parcial) => invocar(CANALES.sesion.guardarPreferencias, parcial)
  },
  ventana: {
    fijarPantallaCompleta: (activa) => invocar(CANALES.ventana.fijarPantallaCompleta, activa),
    estaEnPantallaCompleta: () => invocar(CANALES.ventana.estaEnPantallaCompleta),
    alCambiarPantallaCompleta: (cb) => suscribir(CANALES.eventos.pantallaCompleta, cb)
  },
  alComando: (cb) => suscribir(CANALES.eventos.sesionComando, cb),
  alEstado: (cb) => suscribir(CANALES.eventos.sesionEstadoSecundaria, cb),
  alPreferencias: (cb) => suscribir(CANALES.eventos.sesionPreferencias, cb)
}

contextBridge.exposeInMainWorld('shinobiReproductor', api)
