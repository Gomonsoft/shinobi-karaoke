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

describe('agruparCanciones por fecha de añadido (B8-4 a B8-6)', () => {
  const cancion = (id: string, creada: string | null, modificada = '2026-01-01T00:00:00Z') =>
    conIdentidad(id, 'X', null, { creada, modificada })
  const local = (a: number, m: number, d: number, h = 12) => new Date(a, m - 1, d, h).toISOString()

  it('B8-4: miércoles 18-11-2026, siete canciones en siete grupos y en orden', () => {
    const todas = [
      cancion('sin', null),
      cancion('dic', local(2025, 12, 15)),
      cancion('oct', local(2026, 10, 20)),
      cancion('mes', local(2026, 11, 3)),
      cancion('semana', local(2026, 11, 16, 0)),
      cancion('ayer', local(2026, 11, 17)),
      cancion('hoy', local(2026, 11, 18, 9))
    ]
    const g = agruparCanciones(todas, todas, 'fecha', new Date(2026, 10, 18, 10))
    expect(g.map((x) => [x.nombre, x.canciones.length])).toEqual([
      ['Hoy', 1],
      ['Ayer', 1],
      ['Esta semana', 1],
      ['Este mes', 1],
      ['Octubre de 2026', 1],
      ['Diciembre de 2025', 1],
      ['Sin agrupar', 1]
    ])
    expect(g.every((x) => !x.asignable)).toBe(true)
  })

  it('B8-4: el lunes 02-11 el día 1 es «Ayer», el 31-10 es octubre y no hay «Esta semana»', () => {
    const todas = [cancion('a', local(2026, 11, 1)), cancion('b', local(2026, 10, 31))]
    const g = agruparCanciones(todas, todas, 'fecha', new Date(2026, 10, 2, 10))
    expect(nombres(g)).toEqual(['Ayer', 'Octubre de 2026'])
  })

  it('B8-6: una fecha futura es «Hoy»', () => {
    const todas = [cancion('a', local(2027, 5, 5))]
    expect(nombres(agruparCanciones(todas, todas, 'fecha', new Date(2026, 10, 18, 10)))).toEqual([
      'Hoy'
    ])
  })

  it('B8-5: por `creada` descendente; «Sin agrupar», por `modificada`; recuento con filtro', () => {
    const todas = [
      cancion('v', local(2026, 11, 18, 8)),
      cancion('n', local(2026, 11, 18, 9)),
      cancion('s1', null, '2026-02-01T00:00:00Z'),
      cancion('s2', null, '2026-03-01T00:00:00Z')
    ]
    const g = agruparCanciones(todas, todas, 'fecha', new Date(2026, 10, 18, 10))
    expect(g[0]!.canciones.map((c) => c.id)).toEqual(['n', 'v'])
    expect(g[1]!.canciones.map((c) => c.id)).toEqual(['s2', 's1'])
    const filtradas = agruparCanciones([todas[0]!], todas, 'fecha', new Date(2026, 10, 18, 10))
    expect([filtradas[0]!.canciones.length, filtradas[0]!.total]).toEqual([1, 2])
  })
})
