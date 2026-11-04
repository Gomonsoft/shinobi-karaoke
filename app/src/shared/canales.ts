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
    abrirEnlace: 'sistema:abrirEnlace'
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
    menu: 'evento:menu'
  }
} as const
