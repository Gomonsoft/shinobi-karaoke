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
  const { codigo, mensaje, detalles } = respuesta.error
  throw detalles === undefined ? { codigo, mensaje } : { codigo, mensaje, detalles }
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
    guardarEstilo: (id, estilo) => invocar(CANALES.biblioteca.guardarEstilo, id, estilo),
    marcarLista: (id) => invocar(CANALES.biblioteca.marcarLista, id),
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
  separacion: {
    separar: (cancionId) => invocar(CANALES.separacion.separar, cancionId),
    estimar: (cancionId) => invocar(CANALES.separacion.estimar, cancionId)
  },
  letras: {
    buscar: (peticion) => invocar(CANALES.letras.buscar, peticion),
    guardar: (letra) => invocar(CANALES.letras.guardar, letra),
    editarTexto: (peticion) => invocar(CANALES.letras.editarTexto, peticion),
    guardarTiempos: (peticion, sesionId) =>
      invocar(CANALES.letras.guardarTiempos, peticion, sesionId),
    abrirEdicion: (id) => invocar(CANALES.letras.abrirEdicion, id),
    cerrarEdicion: (sesionId) => invocar(CANALES.letras.cerrarEdicion, sesionId),
    leerArchivo: () => invocar(CANALES.letras.leerArchivo)
  },
  config: {
    obtener: () => invocar(CANALES.config.obtener),
    actualizar: (parcial) => invocar(CANALES.config.actualizar, parcial)
  },
  sistema: {
    info: () => invocar(CANALES.sistema.info),
    abrirEnlace: (url) => invocar(CANALES.sistema.abrirEnlace, url),
    textoLegal: (tipo) => invocar(CANALES.sistema.textoLegal, tipo),
    abrirCarpetaDatos: () => invocar(CANALES.sistema.abrirCarpetaDatos),
    elegirArchivoAudio: () => invocar(CANALES.sistema.elegirArchivoAudio)
  },
  fuente: {
    importarArchivo: (ruta) => invocar(CANALES.fuente.importarArchivo, ruta),
    cancelarImportacion: (id) =>
      id === undefined
        ? invocar(CANALES.fuente.cancelarImportacion)
        : invocar(CANALES.fuente.cancelarImportacion, id),
    confirmarArchivo: (id, metadatos, opciones) =>
      opciones === undefined
        ? invocar(CANALES.fuente.confirmarArchivo, id, metadatos)
        : invocar(CANALES.fuente.confirmarArchivo, id, metadatos, opciones),
    descartarImportacion: (id) => invocar(CANALES.fuente.descartarImportacion, id),
    infoYoutube: (url) => invocar(CANALES.fuente.infoYoutube, url),
    cancelarInfo: (id) =>
      id === undefined
        ? invocar(CANALES.fuente.cancelarInfo)
        : invocar(CANALES.fuente.cancelarInfo, id),
    confirmarYoutube: (id, metadatos, opciones) =>
      opciones === undefined
        ? invocar(CANALES.fuente.confirmarYoutube, id, metadatos)
        : invocar(CANALES.fuente.confirmarYoutube, id, metadatos, opciones),
    reintentar: (id) => invocar(CANALES.fuente.reintentar, id)
  },
  runtime: {
    estado: () => invocar(CANALES.runtime.estado),
    requisitos: (opciones) => invocar(CANALES.runtime.requisitos, opciones),
    instalar: () => invocar(CANALES.runtime.instalar),
    pausar: () => invocar(CANALES.runtime.pausar),
    detalles: () => invocar(CANALES.runtime.detalles),
    estimarSeparacion: (duracionMs, modelo) =>
      invocar(CANALES.runtime.estimarSeparacion, duracionMs, modelo),
    aceptarYUsarRapido: (origen) => invocar(CANALES.runtime.aceptarYUsarRapido, origen),
    volverACalidad: () => invocar(CANALES.runtime.volverACalidad),
    cancelarVolverACalidad: () => invocar(CANALES.runtime.cancelarVolverACalidad),
    alProgreso: (cb) => suscribir(CANALES.eventos.runtimeProgreso, cb),
    alCambiar: (cb) => suscribir(CANALES.eventos.runtimeCambio, cb)
  },
  app: {
    guardadoPendiente: (pendiente) => invocar(CANALES.app.guardadoPendiente, pendiente),
    confirmarCierre: () => invocar(CANALES.app.confirmarCierre),
    salir: () => invocar(CANALES.app.salir),
    alSolicitudCierre: (cb) => suscribir(CANALES.eventos.solicitudCierre, () => cb())
  },
  avisos: {
    alAviso: (cb) => suscribir(CANALES.eventos.avisoTrabajo, cb),
    alAbrirCancion: (cb) => suscribir(CANALES.eventos.abrirCancion, cb)
  },
  alCambiarCancion: (cb) => suscribir(CANALES.eventos.cancion, cb),
  alCambiarConfig: (cb) => suscribir(CANALES.eventos.config, cb),
  alCambiarEstadoInfo: (cb) => suscribir(CANALES.eventos.estadoInfo, cb),
  alAccionMenu: (cb) => suscribir(CANALES.eventos.menu, cb),
  rutaDeArchivo: (archivo) => webUtils.getPathForFile(archivo)
}

contextBridge.exposeInMainWorld('shinobi', api)
