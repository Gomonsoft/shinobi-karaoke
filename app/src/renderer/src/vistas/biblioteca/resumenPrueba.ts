import type { ResumenCancionIpc } from '@shared/ipc'

type Paso = NonNullable<ResumenCancionIpc['pasos']>['fuente']

export const paso = (estado: Paso['estado'], extra: Partial<Paso> = {}): Paso => ({
  estado,
  progreso: null,
  error: null,
  ...extra
})

/** Resumen de borrador recién creado; `cambios` lo modifica (solo para pruebas). */
export function resumenPrueba(cambios: Partial<ResumenCancionIpc> = {}): ResumenCancionIpc {
  return {
    id: 'c1',
    titulo: 'Canción de prueba',
    artista: 'Artista',
    duracionMs: 235_000,
    estado: 'borrador',
    modificada: '2026-11-03T10:00:00Z',
    estilo: null,
    miniatura: null,
    pasos: {
      fuente: paso('completado'),
      separacion: paso('completado'),
      letra: paso('pendiente'),
      edicion: paso('pendiente')
    },
    incompleta: false,
    lineasSinSincronizar: 0,
    danada: false,
    motivo: null,
    ...cambios
  }
}
