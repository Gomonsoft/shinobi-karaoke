/**
 * Nombres de los canales IPC (0011). Archivo sin dependencias: el preload (con
 * sandbox) solo importa este módulo. El contrato completo está en `ipc.ts`.
 */
export const CANALES = {
  biblioteca: {
    listar: 'biblioteca:listar',
    obtener: 'biblioteca:obtener',
    actualizarMetadatos: 'biblioteca:actualizarMetadatos',
    volverABorrador: 'biblioteca:volverABorrador',
    eliminar: 'biblioteca:eliminar',
    mostrarEnCarpeta: 'biblioteca:mostrarEnCarpeta'
  },
  config: {
    obtener: 'config:obtener',
    actualizar: 'config:actualizar'
  },
  sistema: {
    info: 'sistema:info',
    abrirEnlace: 'sistema:abrirEnlace',
    textoLegal: 'sistema:textoLegal',
    abrirCarpetaDatos: 'sistema:abrirCarpetaDatos',
    elegirArchivoAudio: 'sistema:elegirArchivoAudio'
  },
  fuente: {
    importarArchivo: 'fuente:importarArchivo',
    cancelarImportacion: 'fuente:cancelarImportacion',
    confirmarArchivo: 'fuente:confirmarArchivo',
    descartarImportacion: 'fuente:descartarImportacion',
    infoYoutube: 'fuente:infoYoutube',
    cancelarInfo: 'fuente:cancelarInfo',
    confirmarYoutube: 'fuente:confirmarYoutube',
    reintentar: 'fuente:reintentar'
  },
  runtime: {
    estado: 'runtime:estado',
    requisitos: 'runtime:requisitos',
    instalar: 'runtime:instalar',
    pausar: 'runtime:pausar',
    detalles: 'runtime:detalles',
    estimarSeparacion: 'runtime:estimarSeparacion'
  },
  app: {
    /** El renderer confirma el cierre pedido por `eventos.solicitudCierre` (0036). */
    confirmarCierre: 'app:confirmarCierre',
    /** Sale de la aplicación (`app.quit()`), también en macOS donde cerrar la ventana no basta. */
    salir: 'app:salir'
  },
  trabajos: {
    listar: 'trabajos:listar',
    cancelar: 'trabajos:cancelar',
    hayPendientes: 'trabajos:hayPendientes'
  },
  eventos: {
    cancion: 'evento:cancion',
    config: 'evento:config',
    /** Cambio de estado o de posición en la cola de un trabajo (0014). */
    trabajo: 'trabajo:cambio',
    /** Progreso de un trabajo, ≤ 4 por segundo y trabajo (0014). */
    trabajoProgreso: 'trabajo:progreso',
    menu: 'evento:menu',
    /** Progreso de la instalación del runtime, ≤ 4 por segundo (0036). */
    runtimeProgreso: 'runtime:progreso',
    /** Cambio de fase, estado o error del runtime (0036). */
    runtimeCambio: 'runtime:cambio',
    /** Main pide confirmar el cierre con una instalación en curso (0036). */
    solicitudCierre: 'app:solicitudCierre',
    /** La consulta de YouTube espera o provoca una actualización de yt-dlp (0050). */
    estadoInfo: 'fuente:estadoInfo'
  }
} as const
