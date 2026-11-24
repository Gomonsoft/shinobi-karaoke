import { recuentosBandeja } from '@shared/derivados'
import type { ResumenCancionIpc } from '@shared/ipc'
import { esListaParaRevisar } from './tarjeta'
import type { CasillaBandeja } from './textosPreparacion'

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

/**
 * Búsqueda flexible (`bib.buscar`): cada palabra de la consulta debe aparecer en el título, el
 * artista o el álbum (en cualquiera de los tres). Nunca se usa como identidad de grupo.
 */
export function cumpleBusqueda(c: ResumenCancionIpc, busqueda: string): boolean {
  const q = normalizarBusqueda(busqueda)
  if (q === '') return true
  const texto = normalizarBusqueda(`${c.titulo} ${c.artista} ${c.album ?? ''}`)
  return q.split(' ').every((palabra) => texto.includes(palabra))
}

/** Casilla de la bandeja de pendientes a la que cuenta una canción (`null` si a ninguna). */
export function casillaDe(c: ResumenCancionIpc): CasillaBandeja | null {
  const r = recuentosBandeja([
    {
      ...c,
      estadoPreparacion: esListaParaRevisar(c) ? 'lista_para_revisar' : c.estadoPreparacion
    }
  ])
  if (r.listasParaRevisar > 0) return 'revisar'
  if (r.conError > 0) return 'error'
  if (r.esperanLetra > 0) return 'letra'
  return null
}

/** Números de las tres casillas de «Pendientes de ti» (independientes del filtro y la búsqueda). */
export function contarBandeja(canciones: ResumenCancionIpc[]): Record<CasillaBandeja, number> {
  const cuentas: Record<CasillaBandeja, number> = { revisar: 0, letra: 0, error: 0 }
  for (const c of canciones) {
    const casilla = casillaDe(c)
    if (casilla) cuentas[casilla]++
  }
  return cuentas
}

/**
 * `siempre`: canción que se mantiene visible aunque ya no coincida (tras «Editar datos»).
 * `casilla`: casilla activa de la bandeja; se aplica además del filtro y la búsqueda.
 */
export function filtrarCanciones(
  canciones: ResumenCancionIpc[],
  filtro: FiltroBiblioteca,
  busqueda: string,
  siempre?: string | null,
  casilla?: CasillaBandeja | null
): ResumenCancionIpc[] {
  return canciones.filter(
    (c) =>
      c.id === siempre ||
      (cumpleFiltro(c, filtro) &&
        cumpleBusqueda(c, busqueda) &&
        (!casilla || casillaDe(c) === casilla))
  )
}

/** Recuentos de las tres pestañas (independientes de la búsqueda, como en el wireframe). */
export function contarPorFiltro(canciones: ResumenCancionIpc[]): Record<FiltroBiblioteca, number> {
  return {
    todas: canciones.length,
    listas: canciones.filter((c) => cumpleFiltro(c, 'listas')).length,
    borradores: canciones.filter((c) => cumpleFiltro(c, 'borradores')).length
  }
}
