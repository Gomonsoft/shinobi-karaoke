import { contarPorFiltro, filtrarCanciones, normalizarBusqueda } from './filtrado'
import { resumenPrueba } from './resumenPrueba'

const lista = resumenPrueba({ id: 'a', titulo: 'Canción', artista: 'Ñandú', estado: 'lista' })
const incompleta = resumenPrueba({
  id: 'b',
  titulo: 'Casi',
  estado: 'lista',
  incompleta: true,
  lineasSinSincronizar: 2
})
const borrador = resumenPrueba({ id: 'c', titulo: 'Borrador' })
const danada = resumenPrueba({ id: 'd', titulo: 'Rota', danada: true, motivo: 'json' })
const todas = [lista, incompleta, borrador, danada]

describe('filtrado', () => {
  it('normaliza mayúsculas, tildes y espacios', () => {
    expect(normalizarBusqueda('  CANCIÓN   Ñandú ')).toBe('cancion nandu')
  })

  it('"cancion" encuentra "Canción" y busca también por artista', () => {
    expect(filtrarCanciones(todas, 'todas', 'cancion').map((c) => c.id)).toEqual(['a'])
    expect(filtrarCanciones(todas, 'todas', 'NANDU').map((c) => c.id)).toEqual(['a'])
    expect(filtrarCanciones(todas, 'todas', '')).toHaveLength(4)
  })

  it('Listas incluye las incompletas y excluye dañadas; Borradores solo borradores', () => {
    expect(filtrarCanciones(todas, 'listas', '').map((c) => c.id)).toEqual(['a', 'b'])
    expect(filtrarCanciones(todas, 'borradores', '').map((c) => c.id)).toEqual(['c'])
  })

  it('cuenta por filtro (la lista incompleta cuenta en Listas)', () => {
    expect(contarPorFiltro(todas)).toEqual({ todas: 4, listas: 2, borradores: 1 })
  })

  it('B4: busca por palabras en título, artista y álbum con espacios repetidos', () => {
    const c = resumenPrueba({
      id: 'q',
      titulo: 'Bohemian',
      artista: 'Queen',
      album: 'Greatest Hits'
    })
    const otra = resumenPrueba({
      id: 'r',
      titulo: 'Fernando',
      artista: 'ABBA',
      album: 'Greatest Hits'
    })
    const ids = (q: string) => filtrarCanciones([c, otra], 'todas', q).map((x) => x.id)
    expect(ids('queen   greatest')).toEqual(['q'])
    expect(ids('HITS')).toEqual(['q', 'r'])
    expect(ids('greatest bohemian')).toEqual(['q'])
    expect(ids('queen fernando')).toEqual([])
  })

  it('mantiene visible la canción anclada aunque no coincida', () => {
    expect(filtrarCanciones(todas, 'todas', 'zzz', 'c').map((x) => x.id)).toEqual(['c'])
  })
})
