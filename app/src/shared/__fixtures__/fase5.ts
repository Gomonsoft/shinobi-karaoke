/**
 * Dobles de la fase 5 (0201): resumen de canción y entrada de sesión con `modalidad` y
 * `procedenciaEspera`. Valores por defecto: `karaoke` y la procedencia del estilo.
 */
import { estiloPredeterminado } from '../estilo'
import type { ResumenCancionIpc } from '../ipc'
import type { EntradaCargarIpc } from '../sesion'
import { letra, linea } from './index'

export function resumenDePrueba(
  cambios: Partial<Omit<ResumenCancionIpc, 'apariencia'>> & {
    apariencia?: Partial<ResumenCancionIpc['apariencia']>
  } = {}
): ResumenCancionIpc {
  const { apariencia, ...resto } = cambios
  const base: ResumenCancionIpc['apariencia'] = {
    modo: 'propio',
    procedencia: 'propio',
    temaId: null,
    temaNombre: null,
    neutra: true,
    alHeredar: { procedencia: 'incluido', temaId: null, temaNombre: null },
    procedenciaEspera: apariencia?.procedencia ?? 'propio'
  }
  return {
    id: 'cancion-1',
    titulo: 'Canción de prueba',
    artista: 'Artista',
    duracionMs: 215_000,
    estado: 'lista',
    modalidad: 'karaoke',
    modificada: '2026-11-20T10:00:00Z',
    creada: '2026-11-20T10:00:00Z',
    estilo: estiloPredeterminado(),
    album: null,
    claves: { artista: 'artista', album: null },
    apariencia: { ...base, ...apariencia },
    miniatura: null,
    pasos: null,
    incompleta: false,
    lineasSinSincronizar: 0,
    danada: false,
    motivo: null,
    ...resto
  }
}

/** Entrada activa de la sesión (la instantánea que recibe la secundaria). */
export function entradaCargarDePrueba(cambios: Partial<EntradaCargarIpc> = {}): EntradaCargarIpc {
  return {
    entradaId: '00000000-0000-4000-8000-000000000001',
    cancionId: 'cancion-1',
    titulo: 'Canción 1',
    artista: 'Artista 1',
    duracionMs: 30_000,
    gananciaDb: 0,
    letra: letra([linea('l1', 'Luz sobre el río', 2_000)]),
    estilo: estiloPredeterminado(),
    modalidad: 'karaoke',
    lineasSinSincronizar: 0,
    silencioPrevio: true,
    ...cambios
  }
}
