import type { ResumenCancionIpc } from '@shared/ipc'

export type FiltroBiblioteca = 'todas' | 'listas' | 'borradores'

/** Minúsculas y sin tildes ni otras marcas diacríticas: "cancion" encuentra "Canción". */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Pertenencia a un filtro. *Listas* se basa en `estado: "lista"`, de modo que incluye las
 * listas **incompletas** (docs/ux/02 "Lista incompleta"). Las dañadas no son ni lista ni
 * borrador: solo aparecen en *Todas* (opción conservadora; la spec no las asigna a un filtro).
 */
export function cumpleFiltro(c: ResumenCancionIpc, filtro: FiltroBiblioteca): boolean {
  if (filtro === 'todas') return true
  if (c.danada) return false
  return filtro === 'listas' ? c.estado === 'lista' : c.estado === 'borrador'
}

export function cumpleBusqueda(c: ResumenCancionIpc, busqueda: string): boolean {
  const q = normalizarBusqueda(busqueda)
  if (q === '') return true
  return normalizarBusqueda(`${c.titulo} ${c.artista}`).includes(q)
}

export function filtrarCanciones(
  canciones: ResumenCancionIpc[],
  filtro: FiltroBiblioteca,
  busqueda: string
): ResumenCancionIpc[] {
  return canciones.filter((c) => cumpleFiltro(c, filtro) && cumpleBusqueda(c, busqueda))
}

/** Recuentos de las tres pestañas (independientes de la búsqueda, como en el wireframe). */
export function contarPorFiltro(canciones: ResumenCancionIpc[]): Record<FiltroBiblioteca, number> {
  return {
    todas: canciones.length,
    listas: canciones.filter((c) => cumpleFiltro(c, 'listas')).length,
    borradores: canciones.filter((c) => cumpleFiltro(c, 'borradores')).length
  }
}
