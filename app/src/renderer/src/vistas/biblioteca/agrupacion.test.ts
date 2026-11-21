import { agruparCanciones, textoAnuncioResultados, textoRecuentoGrupo } from './agrupacion'
import { filtrarCanciones } from './filtrado'
import { resumenConIdentidad as conIdentidad } from './resumenPrueba'

const nombres = (g: ReturnType<typeof agruparCanciones>) => g.map((x) => x.nombre)

describe('agruparCanciones', () => {
  it('B2: «Queen», «QUEEN » y «queen» forman un grupo; «Canción» y «Cancion», dos', () => {
    const todas = [
      conIdentidad('1', 'Queen', null),
      conIdentidad('2', 'QUEEN ', null, { modificada: '2026-11-05T10:00:00Z' }),
      conIdentidad('3', 'queen', null),
      conIdentidad('4', 'Canción', null),
      conIdentidad('5', 'Cancion', null)
    ]
    const g = agruparCanciones(todas, todas, 'artista')
    expect(g).toHaveLength(3)
    const queen = g.find((x) => x.canciones.length === 3)
    // La grafía visible es la de la canción modificada más recientemente.
    expect(queen?.nombre).toBe('QUEEN')
  })

  it('B2: dos «Greatest Hits» de ABBA y de Queen son dos grupos', () => {
    const todas = [
      conIdentidad('1', 'Queen', 'Greatest Hits'),
      conIdentidad('2', 'ABBA', 'Greatest Hits')
    ]
    expect(nombres(agruparCanciones(todas, todas, 'album'))).toEqual([
      'Greatest Hits — ABBA',
      'Greatest Hits — Queen'
    ])
  })

  it('B3: sin metadatos al final y no asignables; álbum sin artista aparte', () => {
    const todas = [
      conIdentidad('1', '', null),
      conIdentidad('2', 'Zeta', 'Disco'),
      conIdentidad('3', '', 'Suelto'),
      conIdentidad('4', 'Alfa', null)
    ]
    const porArtista = agruparCanciones(todas, todas, 'artista')
    expect(nombres(porArtista)).toEqual(['Alfa', 'Zeta', 'Sin artista'])
    expect(porArtista.map((g) => g.asignable)).toEqual([true, true, false])
    const porAlbum = agruparCanciones(todas, todas, 'album')
    expect(nombres(porAlbum)).toEqual(['Disco — Zeta', 'Suelto — Sin artista', 'Sin álbum'])
    expect(porAlbum.map((g) => g.asignable)).toEqual([true, false, false])
  })

  it('ordena sin distinguir mayúsculas ni tildes y conserva el orden dentro del grupo', () => {
    const todas = [
      conIdentidad('1', 'ñandú', null),
      conIdentidad('2', 'Abba', null),
      conIdentidad('3', 'Abba', null)
    ]
    const g = agruparCanciones(todas, todas, 'artista')
    expect(nombres(g)).toEqual(['Abba', 'ñandú'])
    expect(g[0]!.canciones.map((c) => c.id)).toEqual(['2', '3'])
  })

  it('el total cuenta toda la biblioteca y solo salen grupos con coincidencias', () => {
    const todas = [conIdentidad('1', 'Queen', null), conIdentidad('2', 'Queen', null)]
    const g = agruparCanciones([todas[0]!], todas, 'artista')
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ total: 2 })
    expect(textoRecuentoGrupo(1, 2, true)).toBe('1 de 2 canciones')
    expect(textoRecuentoGrupo(2, 2, false)).toBe('2 canciones')
    expect(textoRecuentoGrupo(1, 1, false)).toBe('1 canción')
    expect(agruparCanciones(todas, todas, 'ninguno')).toEqual([])
  })

  it('anuncio de resultados', () => {
    expect(textoAnuncioResultados(0)).toBe('Ninguna canción')
    expect(textoAnuncioResultados(1)).toBe('1 canción')
    expect(textoAnuncioResultados(7)).toBe('7 canciones')
  })

  it('500 canciones: filtrar y agrupar tarda menos de 16 ms por pulsación (orientativo)', () => {
    const todas = Array.from({ length: 500 }, (_, i) =>
      conIdentidad(String(i), `Artista ${i % 40}`, `Álbum ${i % 90}`)
    )
    const medir = () => {
      const t = performance.now()
      const visibles = filtrarCanciones(todas, 'todas', 'artista 1 album')
      agruparCanciones(visibles, todas, 'album')
      return performance.now() - t
    }
    medir()
    expect(Math.min(medir(), medir(), medir())).toBeLessThan(16)
  })
})
