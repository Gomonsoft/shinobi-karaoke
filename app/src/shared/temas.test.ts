import { describe, expect, it } from 'vitest'
import {
  aparienciaDePrueba,
  borradorRecienCreado,
  catalogoDePrueba,
  idDePrueba,
  temaDePrueba
} from './__fixtures__'
import { ESTILO_PREDETERMINADO, estiloPredeterminado, type Estilo } from './estilo'
import { migrarCancion } from './migraciones'
import {
  aparienciaSchema,
  catalogoInicial,
  catalogoSchema,
  crearIndiceCatalogo,
  esAparienciaNeutra,
  estilosIguales,
  migrarCatalogo,
  resolverApariencia,
  type CancionResoluble,
  type Catalogo
} from './temas'

const color = (hex: string): Estilo => {
  const e = estiloPredeterminado()
  e.letra.color = hex
  return e
}
const T1 = idDePrueba(1)
const T2 = idDePrueba(2)
const T3 = idDePrueba(3)
const T4 = idDePrueba(4)
const FALTA = idDePrueba(99)
const temas = [
  temaDePrueba({ id: T1, nombre: 'Uno', estilo: color('#111111') }),
  temaDePrueba({ id: T2, nombre: 'Dos', estilo: color('#222222') }),
  temaDePrueba({ id: T3, nombre: 'Tres', estilo: color('#333333') }),
  temaDePrueba({ id: T4, nombre: 'Cuatro', estilo: color('#444444') })
]
const instantanea = color('#999999')

function catalogo(extra: Partial<Catalogo> = {}): Catalogo {
  return catalogoDePrueba({
    temas,
    asignaciones: {
      artistas: [{ artista: 'queen', nombre_artista: 'Queen', tema_id: T2 }],
      albumes: [
        {
          artista: 'queen',
          album: 'jazz',
          nombre_artista: 'Queen',
          nombre_album: 'Jazz',
          tema_id: T3
        }
      ]
    },
    ...extra
  })
}
const indice = (extra: Partial<Catalogo> = {}) => crearIndiceCatalogo(catalogo(extra))
const SIN_ASIGNACIONES = { artistas: [], albumes: [] }

const cancion = (
  artista: string,
  album: string | null,
  apariencia?: CancionResoluble['apariencia']
): CancionResoluble => ({ metadatos: { artista, album }, estilo: instantanea, apariencia })

describe('catalogoSchema', () => {
  const rechaza = (c: unknown): void => {
    expect(catalogoSchema.safeParse(c).success).toBe(false)
  }
  it('acepta un catálogo válido y «Canción»/«Cancion» como nombres distintos', () => {
    const c = catalogo({
      temas: [
        temaDePrueba({ id: T1, nombre: 'Canción' }),
        temaDePrueba({ id: T2, nombre: 'Cancion' })
      ],
      asignaciones: SIN_ASIGNACIONES
    })
    expect(catalogoSchema.safeParse(c).success).toBe(true)
    expect(catalogoSchema.safeParse(catalogo()).success).toBe(true)
  })
  it('rechaza id repetido', () => {
    rechaza(
      catalogo({
        temas: [temas[0]!, { ...temas[1]!, id: T1 }],
        asignaciones: SIN_ASIGNACIONES
      })
    )
  })
  it('rechaza predeterminado o asignación a un tema inexistente', () => {
    rechaza(catalogo({ predeterminado: FALTA }))
    rechaza(
      catalogo({
        asignaciones: {
          artistas: [{ artista: 'x', nombre_artista: 'X', tema_id: FALTA }],
          albumes: []
        }
      })
    )
    rechaza(
      catalogo({
        asignaciones: {
          artistas: [],
          albumes: [
            { artista: 'x', album: 'y', nombre_artista: 'X', nombre_album: 'Y', tema_id: FALTA }
          ]
        }
      })
    )
  })
  it('rechaza dos asignaciones con la misma clave', () => {
    const a = { artista: 'x', nombre_artista: 'X', tema_id: T1 }
    rechaza(catalogo({ asignaciones: { artistas: [a, { ...a, tema_id: T2 }], albumes: [] } }))
    const al = { artista: 'x', album: 'y', nombre_artista: 'X', nombre_album: 'Y', tema_id: T1 }
    rechaza(catalogo({ asignaciones: { artistas: [], albumes: [al, { ...al, tema_id: T2 }] } }))
  })
  it('rechaza clave no normalizada y nombre que no corresponde a la clave', () => {
    rechaza(
      catalogo({
        asignaciones: {
          artistas: [{ artista: 'Queen', nombre_artista: 'Queen', tema_id: T1 }],
          albumes: []
        }
      })
    )
    rechaza(
      catalogo({
        asignaciones: {
          artistas: [{ artista: 'queen', nombre_artista: 'Brian', tema_id: T1 }],
          albumes: []
        }
      })
    )
    rechaza(
      catalogo({
        asignaciones: {
          artistas: [],
          albumes: [
            { artista: 'q', album: 'a', nombre_artista: 'Q', nombre_album: 'Otro', tema_id: T1 }
          ]
        }
      })
    )
  })
  it('rechaza «Noche Ninja» y «noche  ninja»', () => {
    rechaza(
      catalogo({
        temas: [
          temaDePrueba({ id: T1, nombre: 'Noche Ninja' }),
          temaDePrueba({ id: T2, nombre: 'noche  ninja' })
        ],
        asignaciones: SIN_ASIGNACIONES
      })
    )
  })
  it('rechaza borrado_pendiente a un tema inexistente', () => {
    rechaza(
      catalogo({
        borrado_pendiente: { tema_id: FALTA, iniciado: '2026-11-09T10:00:00Z', canciones: [] }
      })
    )
  })
})

describe('migrarCatalogo', () => {
  it('lee un catálogo válido', () => {
    expect(migrarCatalogo(JSON.parse(JSON.stringify(catalogo()))).tipo).toBe('ok')
  })
  it('esquema 2: mas_nuevo', () => {
    expect(migrarCatalogo({ ...catalogo(), esquema: 2 })).toEqual({ tipo: 'mas_nuevo' })
  })
  it('JSON inválido: invalido', () => {
    expect(migrarCatalogo(null).tipo).toBe('invalido')
    expect(migrarCatalogo([]).tipo).toBe('invalido')
    expect(migrarCatalogo({ esquema: 'x' }).tipo).toBe('invalido')
    expect(migrarCatalogo({ ...catalogo(), predeterminado: FALTA }).tipo).toBe('invalido')
  })
})

describe('catalogoInicial', () => {
  const ahora = '2026-11-09T10:00:00Z'
  it('«Shinobi» con el estilo de fábrica, aunque cambie el orden de claves', () => {
    const c = catalogoInicial({ estilo: estiloPredeterminado(), ahora, id: T1 })
    expect(c.temas[0]?.nombre).toBe('Shinobi')
    expect(c.predeterminado).toBe(T1)
    expect(catalogoSchema.safeParse(c).success).toBe(true)
    const e = ESTILO_PREDETERMINADO
    const reordenado = { letra: e.letra, fondo: e.fondo, version: e.version } as Estilo
    expect(catalogoInicial({ estilo: reordenado, ahora, id: T1 }).temas[0]?.nombre).toBe('Shinobi')
  })
  it('«Mi estilo» con cualquier otro', () => {
    const c = catalogoInicial({ estilo: color('#ABCDEF'), ahora, id: T1 })
    expect(c.temas[0]?.nombre).toBe('Mi estilo')
    expect(c.predeterminado).toBe(T1)
  })
})

describe('aparienciaSchema', () => {
  it('modo tema exige tema_id; los demás modos lo prohíben', () => {
    expect(aparienciaSchema.safeParse({ modo: 'tema' }).success).toBe(false)
    expect(aparienciaSchema.safeParse({ modo: 'tema', tema_id: T1 }).success).toBe(true)
    expect(aparienciaSchema.safeParse({ modo: 'heredar', tema_id: T1 }).success).toBe(false)
    expect(aparienciaSchema.safeParse({ modo: 'propio', tema_id: T1 }).success).toBe(false)
    expect(aparienciaSchema.safeParse({ modo: 'heredar', tema_id: null }).success).toBe(true)
  })
  it('valida base y tema_nombre', () => {
    const ok = (base: unknown): boolean =>
      aparienciaSchema.safeParse({ modo: 'heredar', base }).success
    expect(ok({ tipo: 'aleatorio', tema_id: T1 })).toBe(true)
    expect(ok({ tipo: 'predeterminado_anterior', tema_id: T1 })).toBe(true)
    expect(ok({ tipo: 'incluido' })).toBe(true)
    expect(ok({ tipo: 'aleatorio' })).toBe(false)
    expect(ok({ tipo: 'otro' })).toBe(false)
    expect(aparienciaSchema.safeParse({ modo: 'heredar', tema_nombre: '' }).success).toBe(false)
  })
})

describe('compatibilidad con 0.1.0', () => {
  it('un cancion.json sin apariencia valida igual y se resuelve como propio', () => {
    const c = borradorRecienCreado()
    c.estilo = color('#123456')
    const json = JSON.parse(JSON.stringify(c))
    expect('apariencia' in json).toBe(false)
    const leida = migrarCancion(json)
    expect('apariencia' in leida).toBe(false)
    const r = resolverApariencia(leida, null)
    expect(r.procedencia).toBe('propio')
    expect(r.estilo).toEqual(c.estilo)
    expect(r.temaId).toBeNull()
    expect(r.temaNombre).toBeNull()
  })
  it('con apariencia se conserva al leer', () => {
    const c = {
      ...borradorRecienCreado(),
      apariencia: aparienciaDePrueba({ base: { tipo: 'incluido' } })
    }
    expect(migrarCancion(JSON.parse(JSON.stringify(c))).apariencia).toEqual(c.apariencia)
  })
})

describe('resolverApariencia', () => {
  it('propio', () => {
    const r = resolverApariencia(cancion('Queen', 'Jazz', { modo: 'propio' }), indice())
    expect(r).toEqual({
      estilo: instantanea,
      procedencia: 'propio',
      temaId: null,
      temaNombre: null
    })
  })
  it('tema presente', () => {
    const r = resolverApariencia(cancion('Queen', 'Jazz', { modo: 'tema', tema_id: T1 }), indice())
    expect(r).toEqual({
      estilo: temas[0]!.estilo,
      procedencia: 'cancion',
      temaId: T1,
      temaNombre: 'Uno'
    })
  })
  it('tema ausente: respaldo con instantánea y tema_nombre', () => {
    const ap = { modo: 'tema' as const, tema_id: FALTA, tema_nombre: 'Viejo' }
    expect(resolverApariencia(cancion('X', null, ap), indice())).toEqual({
      estilo: instantanea,
      procedencia: 'respaldo',
      temaId: FALTA,
      temaNombre: 'Viejo'
    })
    const sinNombre = cancion('X', null, { modo: 'tema', tema_id: FALTA })
    expect(resolverApariencia(sinNombre, indice()).temaNombre).toBeNull()
  })
  it('heredar con álbum', () => {
    const r = resolverApariencia(cancion(' QUEEN', 'jazz ', { modo: 'heredar' }), indice())
    expect(r.procedencia).toBe('album')
    expect(r.temaId).toBe(T3)
    expect(r.temaNombre).toBe('Tres')
  })
  it('heredar con artista (álbum sin asignación o sin álbum)', () => {
    for (const album of ['Sheer Heart Attack', null]) {
      const r = resolverApariencia(cancion('Queen', album, { modo: 'heredar' }), indice())
      expect(r.procedencia).toBe('artista')
      expect(r.temaId).toBe(T2)
    }
  })
  it('álbum homónimo de otro artista no aplica', () => {
    const c = cancion('Otro', 'Jazz', { modo: 'heredar' })
    const r = resolverApariencia(c, indice({ predeterminado: T1 }))
    expect(r.procedencia).toBe('predeterminado')
    expect(r.temaId).toBe(T1)
  })
  it('base aleatorio presente y ausente', () => {
    const base = { tipo: 'aleatorio' as const, tema_id: T4 }
    const p = resolverApariencia(cancion('X', null, { modo: 'heredar', base }), indice())
    expect(p).toMatchObject({ procedencia: 'aleatorio', temaId: T4, temaNombre: 'Cuatro' })
    const ausente = cancion('X', null, {
      modo: 'heredar',
      base: { ...base, tema_id: FALTA },
      tema_nombre: 'Gone'
    })
    expect(resolverApariencia(ausente, indice())).toMatchObject({
      procedencia: 'respaldo',
      estilo: instantanea,
      temaNombre: 'Gone'
    })
  })
  it('base predeterminado_anterior presente y ausente', () => {
    const base = { tipo: 'predeterminado_anterior' as const, tema_id: T4 }
    const p = resolverApariencia(cancion('X', null, { modo: 'heredar', base }), indice())
    expect(p).toMatchObject({ procedencia: 'predeterminado_anterior', temaId: T4 })
    const ausente = cancion('X', null, { modo: 'heredar', base: { ...base, tema_id: FALTA } })
    expect(resolverApariencia(ausente, indice())).toMatchObject({
      procedencia: 'respaldo',
      temaNombre: null
    })
  })
  it('base incluido', () => {
    const c = cancion('X', null, { modo: 'heredar', base: { tipo: 'incluido' } })
    expect(resolverApariencia(c, indice({ predeterminado: T1 }))).toEqual({
      estilo: ESTILO_PREDETERMINADO,
      procedencia: 'incluido',
      temaId: null,
      temaNombre: null
    })
  })
  it('sin base: con predeterminado y sin él', () => {
    const c = cancion('X', null, { modo: 'heredar' })
    expect(resolverApariencia(c, indice({ predeterminado: T1 }))).toMatchObject({
      procedencia: 'predeterminado',
      temaId: T1,
      temaNombre: 'Uno'
    })
    expect(resolverApariencia(c, indice())).toMatchObject({
      procedencia: 'incluido',
      estilo: ESTILO_PREDETERMINADO
    })
  })
  it('la base fijada precede al predeterminado; álbum y artista preceden a la base', () => {
    const base = { tipo: 'aleatorio' as const, tema_id: T4 }
    const ix = indice({ predeterminado: T1 })
    const ap = { modo: 'heredar' as const, base }
    expect(resolverApariencia(cancion('X', null, ap), ix).temaId).toBe(T4)
    expect(resolverApariencia(cancion('Queen', 'Jazz', ap), ix).procedencia).toBe('album')
    expect(resolverApariencia(cancion('Queen', null, ap), ix).procedencia).toBe('artista')
  })
  it('índice null: tema y heredar dan respaldo, salvo base incluido', () => {
    const p = (a: CancionResoluble['apariencia'], artista = 'X') =>
      resolverApariencia(cancion(artista, null, a), null).procedencia
    expect(p({ modo: 'tema', tema_id: T1 })).toBe('respaldo')
    expect(p({ modo: 'heredar' }, 'Queen')).toBe('respaldo')
    expect(p({ modo: 'heredar', base: { tipo: 'aleatorio', tema_id: T1 } })).toBe('respaldo')
    expect(p({ modo: 'heredar', base: { tipo: 'incluido' } })).toBe('incluido')
    expect(p({ modo: 'propio' })).toBe('propio')
  })
})

describe('esAparienciaNeutra', () => {
  const res = (procedencia: Parameters<typeof esAparienciaNeutra>[0]['procedencia']) => ({
    estilo: instantanea,
    procedencia,
    temaId: null,
    temaNombre: null
  })
  it('true con las procedencias sin elección', () => {
    for (const p of [
      'predeterminado',
      'predeterminado_anterior',
      'aleatorio',
      'incluido'
    ] as const) {
      expect(esAparienciaNeutra(res(p), { estilo: instantanea }, null)).toBe(true)
    }
  })
  it('false con cancion, album, artista y respaldo', () => {
    for (const p of ['cancion', 'album', 'artista', 'respaldo'] as const) {
      const c = { estilo: ESTILO_PREDETERMINADO }
      expect(esAparienciaNeutra(res(p), c, ESTILO_PREDETERMINADO)).toBe(false)
    }
  })
  it('propio: neutra si es de fábrica o igual al heredado; si no, no', () => {
    const propio = res('propio')
    expect(esAparienciaNeutra(propio, { estilo: estiloPredeterminado() }, null)).toBe(true)
    expect(esAparienciaNeutra(propio, { estilo: color('#ABCDEF') }, color('#ABCDEF'))).toBe(true)
    expect(esAparienciaNeutra(propio, { estilo: color('#ABCDEF') }, color('#000001'))).toBe(false)
    expect(esAparienciaNeutra(propio, { estilo: color('#ABCDEF') }, null)).toBe(false)
  })
})

describe('estilosIguales', () => {
  it('ignora el orden de claves y detecta diferencias', () => {
    const a = estiloPredeterminado()
    const b = { letra: a.letra, version: a.version, fondo: a.fondo } as Estilo
    expect(estilosIguales(a, b)).toBe(true)
    expect(estilosIguales(a, color('#000000'))).toBe(false)
  })
})
