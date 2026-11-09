import { describe, expect, it } from 'vitest'
import { estiloPredeterminado, type Apariencia } from '../../shared'
import { catalogoDePrueba, idDePrueba, temaDePrueba } from '../../shared/__fixtures__'
import { construirCatalogoTemas, type CancionIndice } from './usos'

const TP = idDePrueba(1) // predeterminado
const TA = idDePrueba(2) // asignado a canción
const TAL = idDePrueba(3) // álbum
const TAR = idDePrueba(4) // artista
const TAN = idDePrueba(5) // predeterminado anterior
const TAZ = idDePrueba(6) // aleatorio

const catalogo = () =>
  catalogoDePrueba({
    predeterminado: TP,
    temas: [
      temaDePrueba({ id: TP, nombre: 'Pred' }),
      temaDePrueba({ id: TA, nombre: 'Canción' }),
      temaDePrueba({ id: TAL, nombre: 'Álbum' }),
      temaDePrueba({ id: TAR, nombre: 'Artista' }),
      temaDePrueba({ id: TAN, nombre: 'Anterior' }),
      temaDePrueba({ id: TAZ, nombre: 'Azar' })
    ],
    asignaciones: {
      artistas: [{ artista: 'queen', nombre_artista: 'Queen', tema_id: TAR }],
      albumes: [
        {
          artista: 'abba',
          album: 'arrival',
          nombre_artista: 'Abba',
          nombre_album: 'Arrival',
          tema_id: TAL
        }
      ]
    }
  })

let n = 0
const cancion = (
  apariencia: Apariencia | undefined,
  metadatos: CancionIndice['metadatos'] = { artista: 'Nadie', album: null },
  extra: Partial<CancionIndice> = {}
): CancionIndice => ({
  id: `c${++n}`,
  metadatos,
  modificada: '2026-11-09T10:00:00Z',
  estilo: estiloPredeterminado(),
  apariencia,
  danada: null,
  ...extra
})

describe('construirCatalogoTemas · usos', () => {
  const canciones = (): CancionIndice[] => [
    cancion({ modo: 'tema', tema_id: TA }),
    cancion({ modo: 'heredar' }, { artista: 'ABBA', album: 'Arrival' }),
    cancion({ modo: 'heredar' }, { artista: ' queen ', album: 'Otro' }),
    cancion({ modo: 'heredar' }),
    cancion({ modo: 'heredar', base: { tipo: 'predeterminado_anterior', tema_id: TAN } }),
    cancion({ modo: 'heredar', base: { tipo: 'aleatorio', tema_id: TAZ } }),
    cancion({ modo: 'propio' }),
    cancion({ modo: 'tema', tema_id: idDePrueba(99) }),
    cancion({ modo: 'heredar' }, { artista: 'x' }, { danada: 'json', estilo: null })
  ]

  it('cuenta cada procedencia y las referencias que faltan', () => {
    const r = construirCatalogoTemas(catalogo(), canciones(), { soloLectura: false })
    const usos = (id: string) => r.temas.find((t) => t.id === id)?.usos
    expect(usos(TA)).toMatchObject({ total: 1, cancion: 1 })
    expect(usos(TAL)).toMatchObject({ total: 1, album: 1 })
    expect(usos(TAR)).toMatchObject({ total: 1, artista: 1 })
    expect(usos(TP)).toMatchObject({ total: 1, predeterminado: 1 })
    expect(usos(TAN)).toMatchObject({ total: 1, predeterminadoAnterior: 1 })
    expect(usos(TAZ)).toMatchObject({ total: 1, aleatorio: 1 })
    expect(r.predeterminadoUsos).toBe(1)
    expect(r.referenciasFaltantes).toBe(1)
  })

  it('en solo lectura no hay temas y referenciasFaltantes es 0', () => {
    const r = construirCatalogoTemas(null, canciones(), { soloLectura: true })
    expect(r).toMatchObject({
      temas: [],
      soloLectura: true,
      referenciasFaltantes: 0,
      predeterminadoUsos: 0,
      predeterminado: null
    })
  })

  it('sin predeterminado, las que heredan sin base cuentan en predeterminadoUsos (incluido)', () => {
    const c = { ...catalogo(), predeterminado: null }
    const r = construirCatalogoTemas(c, canciones(), { soloLectura: false })
    expect(r.predeterminadoUsos).toBe(1)
    expect(r.temas.find((t) => t.id === TP)?.usos.total).toBe(0)
  })

  it('marca el tema en borrado y expone el borrado pendiente (restantes se recalcula)', () => {
    const c = {
      ...catalogo(),
      borrado_pendiente: { tema_id: TA, iniciado: '2026-11-09T10:00:00Z', canciones: ['a', 'b'] }
    }
    const r = construirCatalogoTemas(c, [], { soloLectura: false })
    expect(r.temas.find((t) => t.id === TA)?.enBorrado).toBe(true)
    expect(r.borradoPendiente).toEqual({ temaId: TA, nombre: 'Canción', total: 2, restantes: 0 })
  })

  it('expone `apartado`', () => {
    const c = { ...catalogo(), apartado: '2026-11-09T10:00:00Z' }
    expect(construirCatalogoTemas(c, [], { soloLectura: false }).apartado).toBe(c.apartado)
  })
})

describe('construirCatalogoTemas · grupos y nombres visibles', () => {
  it('usa la grafía de la canción más reciente del grupo y la de la asignación si no hay canciones', () => {
    const lista = [
      cancion(
        { modo: 'heredar' },
        { artista: 'QUEEN', album: 'x' },
        { modificada: '2026-01-01T00:00:00Z' }
      ),
      cancion(
        { modo: 'heredar' },
        { artista: 'Queen', album: 'x' },
        { modificada: '2026-06-01T00:00:00Z' }
      )
    ]
    const r = construirCatalogoTemas(catalogo(), lista, { soloLectura: false })
    expect(r.asignaciones.artistas).toEqual([{ artista: 'Queen', temaId: TAR }])
    expect(r.temas.find((t) => t.id === TAR)?.grupos.artistas).toEqual(['Queen'])
    // Álbum sin canciones: nombres de la asignación.
    expect(r.asignaciones.albumes).toEqual([{ artista: 'Abba', album: 'Arrival', temaId: TAL }])
    expect(r.temas.find((t) => t.id === TAL)?.grupos.albumes).toEqual([
      { artista: 'Abba', album: 'Arrival' }
    ])
  })

  it('el álbum con canciones muestra la grafía de ellas', () => {
    const lista = [cancion({ modo: 'heredar' }, { artista: 'ABBA', album: 'ARRIVAL' })]
    const r = construirCatalogoTemas(catalogo(), lista, { soloLectura: false })
    expect(r.asignaciones.albumes[0]).toMatchObject({ artista: 'ABBA', album: 'ARRIVAL' })
  })
})

describe('construirCatalogoTemas · rendimiento', () => {
  it('500 canciones en menos de 20 ms', () => {
    const lista = Array.from({ length: 500 }, (_, i) =>
      cancion(i % 3 === 0 ? { modo: 'heredar' } : { modo: 'tema', tema_id: TA }, {
        artista: `Artista ${i % 40}`,
        album: `Álbum ${i % 90}`
      })
    )
    const c = catalogo()
    construirCatalogoTemas(c, lista, { soloLectura: false }) // calienta
    const t0 = performance.now()
    construirCatalogoTemas(c, lista, { soloLectura: false })
    expect(performance.now() - t0).toBeLessThan(20)
  })
})
