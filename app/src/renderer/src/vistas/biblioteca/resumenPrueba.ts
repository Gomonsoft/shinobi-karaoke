import type { Cancion } from '@shared/cancion'
import { claveAlbum, claveArtista } from '@shared/identidad'
import type { AparienciaResumenIpc, CancionIpc, ResumenCancionIpc } from '@shared/ipc'

type Paso = NonNullable<ResumenCancionIpc['pasos']>['fuente']

export const paso = (estado: Paso['estado'], extra: Partial<Paso> = {}): Paso => ({
  estado,
  progreso: null,
  error: null,
  ...extra
})

/** Apariencia por defecto de los resúmenes de prueba: estilo propio y neutra. */
export function aparienciaResumenPrueba(
  cambios: Partial<AparienciaResumenIpc> = {}
): AparienciaResumenIpc {
  return {
    modo: 'propio',
    procedencia: 'propio',
    temaId: null,
    temaNombre: null,
    neutra: true,
    alHeredar: { procedencia: 'incluido', temaId: null, temaNombre: null },
    ...cambios
  }
}

/** Canción tal y como la devuelve `biblioteca.obtener`: la de disco más su apariencia resuelta. */
export function cancionIpcPrueba(cancion: Cancion): CancionIpc {
  const { alHeredar } = aparienciaResumenPrueba()
  return {
    ...cancion,
    resuelta: {
      estilo: cancion.estilo,
      procedencia: 'propio',
      temaId: null,
      temaNombre: null,
      alHeredar
    }
  }
}

/** Campos de identidad y apariencia de un resumen de prueba (`album`, `claves`, `apariencia`). */
export function identidadResumenPrueba(): Pick<
  ResumenCancionIpc,
  'album' | 'claves' | 'apariencia'
> {
  return {
    album: null,
    claves: { artista: 'artista', album: null },
    apariencia: aparienciaResumenPrueba()
  }
}

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
    ...identidadResumenPrueba(),
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

/** Resumen con identidad derivada de artista y álbum, como la entrega main. */
export function resumenConIdentidad(
  id: string,
  artista: string,
  album: string | null,
  extra: Partial<ResumenCancionIpc> = {}
): ResumenCancionIpc {
  const meta = { artista, album }
  const pareja = claveAlbum(meta)
  return resumenPrueba({
    id,
    titulo: `Tema ${id}`,
    artista,
    album,
    claves: {
      artista: claveArtista(meta),
      album: pareja ? JSON.stringify([pareja.artista, pareja.album]) : null
    },
    apariencia: aparienciaResumenPrueba(),
    ...extra
  })
}
