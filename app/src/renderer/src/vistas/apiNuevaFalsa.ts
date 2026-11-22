import type { ApiShinobi, ErrorIpc } from '@shared/ipc'

/**
 * Dobles de los métodos de 0.2.2 (tarea 0339) para los `fixturesApi.ts`: las lecturas devuelven
 * respuestas vacías y las acciones rechazan con `ERROR_INTERNO` «No implementado.», como el main real
 * hasta que cada feature sustituya su manejador. Cada fixture los esparce antes de sus propios métodos.
 */
const noImplementado = (): Promise<never> =>
  Promise.reject({ codigo: 'ERROR_INTERNO', mensaje: 'No implementado.' } satisfies ErrorIpc)
const sinBaja = (): (() => void) => () => undefined

export function apiNuevaFalsa(): Pick<
  ApiShinobi,
  'actualizaciones' | 'preparacion' | 'copias' | 'alineacion'
> {
  return {
    actualizaciones: {
      estado: () =>
        Promise.resolve({
          canal: 'local',
          avisar: true,
          disponible: null,
          vista: null,
          ultimaComprobacion: null,
          comprobando: false,
          enlaces: null
        }),
      comprobar: noImplementado,
      marcarVista: noImplementado,
      alCambiar: sinBaja
    },
    preparacion: {
      previsualizar: () => Promise.resolve([]),
      preparar: noImplementado,
      pausar: noImplementado,
      reanudar: noImplementado,
      reintentarFallidas: noImplementado,
      tanda: () => Promise.resolve(null),
      cancelar: noImplementado,
      alCambiar: sinBaja,
      alTanda: sinBaja,
      alReanudar: sinBaja
    },
    copias: {
      exportarCanciones: noImplementado,
      exportarBiblioteca: noImplementado,
      destinoPropuesto: noImplementado,
      elegirDestino: () => Promise.resolve(null),
      elegirOrigen: () => Promise.resolve(null),
      leer: noImplementado,
      importar: noImplementado,
      cancelar: noImplementado,
      alCambiar: sinBaja,
      alProgreso: sinBaja
    },
    alineacion: {
      estado: () => Promise.resolve({ disponible: false, modelos: [] }),
      descargarModelo: noImplementado,
      cancelarDescarga: noImplementado,
      quitarModelo: noImplementado,
      previsualizar: noImplementado,
      alinear: noImplementado,
      cancelar: noImplementado,
      alProgreso: sinBaja,
      alResultado: sinBaja
    }
  }
}

/** Métodos nuevos de `letras`, `biblioteca`, `sesion`, `exportacion` y `fuente`. */
export const letrasNuevasFalsas = (): Pick<
  ApiShinobi['letras'],
  'candidatoPorId' | 'exportarLrc' | 'exportarLrcVarias' | 'mostrarEnCarpeta' | 'alEncaje'
> => ({
  candidatoPorId: () => Promise.resolve(null),
  exportarLrc: noImplementado,
  exportarLrcVarias: noImplementado,
  mostrarEnCarpeta: noImplementado,
  alEncaje: sinBaja
})

export const bibliotecaNuevaFalsa = (): Pick<
  ApiShinobi['biblioteca'],
  'valoresDatos' | 'editarDatosVarias' | 'eliminarVarias' | 'alProgresoLote'
> => ({
  valoresDatos: () => Promise.resolve({ artistas: [], albumes: [] }),
  editarDatosVarias: { previsualizar: noImplementado, ejecutar: noImplementado },
  eliminarVarias: { previsualizar: noImplementado, ejecutar: noImplementado },
  alProgresoLote: sinBaja
})

export const colaNuevaFalsa = (): Pick<ApiShinobi['cola'], 'agregarVarias' | 'quitarVarias'> => ({
  agregarVarias: noImplementado,
  quitarVarias: noImplementado
})

export const exportacionNuevaFalsa = (): Pick<
  ApiShinobi['exportacion'],
  'destinoCarpeta' | 'iniciarLote' | 'cancelarLote' | 'reintentarLote'
> => ({
  destinoCarpeta: () => Promise.resolve(null),
  iniciarLote: noImplementado,
  cancelarLote: noImplementado,
  reintentarLote: noImplementado
})

export const fuenteNuevaFalsa = (): Pick<
  ApiShinobi['fuente'],
  'leerArchivos' | 'leerCarpeta' | 'infoLista' | 'lote'
> => ({
  leerArchivos: () => Promise.resolve(null),
  leerCarpeta: () => Promise.resolve(null),
  infoLista: noImplementado,
  lote: noImplementado
})
