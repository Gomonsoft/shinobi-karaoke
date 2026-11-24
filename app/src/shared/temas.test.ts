import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  aparienciaDePrueba,
  borradorRecienCreado,
  catalogoDePrueba,
  idDePrueba,
  temaDePrueba
} from './__fixtures__'
import { ESTILO_PREDETERMINADO, estiloPredeterminado, estiloSchema, type Estilo } from './estilo'
import { ESPERA_LEGADA } from './espera'
import { PANTALLA_PREDETERMINADA, type Pantalla } from './pantalla'
import { migrarCancion } from './migraciones'
import { colorDeParte, COLORES_PARTES_PREDETERMINADOS } from './reparto'
import {
  aparienciaSchema,
  catalogoInicial,
  catalogoSchema,
  crearIndiceCatalogo,
  esAparienciaNeutra,
  estilosIguales,
  migrarCatalogo,
  resolverApariencia,
  type Apariencia,
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
      procedenciaEspera: 'propio',
      procedenciaPantalla: 'propio',
      temaId: null,
      temaNombre: null
    })
  })
  it('tema presente', () => {
    const r = resolverApariencia(cancion('Queen', 'Jazz', { modo: 'tema', tema_id: T1 }), indice())
    expect(r).toEqual({
      estilo: temas[0]!.estilo,
      procedencia: 'cancion',
      procedenciaEspera: 'cancion',
      procedenciaPantalla: 'cancion',
      temaId: T1,
      temaNombre: 'Uno'
    })
  })
  it('tema ausente: respaldo con instantánea y tema_nombre', () => {
    const ap = { modo: 'tema' as const, tema_id: FALTA, tema_nombre: 'Viejo' }
    expect(resolverApariencia(cancion('X', null, ap), indice())).toEqual({
      estilo: instantanea,
      procedencia: 'respaldo',
      procedenciaEspera: 'respaldo',
      procedenciaPantalla: 'respaldo',
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
      procedenciaEspera: 'incluido',
      procedenciaPantalla: 'incluido',
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
  it('un estilo sin espera es igual al que lleva la espera legada explícita', () => {
    const a = estiloPredeterminado()
    const b = { ...estiloPredeterminado(), espera: { ...ESPERA_LEGADA } }
    expect(estilosIguales(a, b)).toBe(true)
    expect(estilosIguales(a, { ...b, espera: { ...ESPERA_LEGADA, cuenta: true } })).toBe(false)
  })
})

describe('resolverApariencia con reemplazos de espera (0202)', () => {
  const espera = {
    puntos: false,
    barra: true,
    cuenta: true,
    primera_entrada: false,
    umbral_ms: 6000
  }
  const A = idDePrueba(1)
  const indice = crearIndiceCatalogo(
    catalogoDePrueba({ predeterminado: A, temas: [temaDePrueba({ id: A, nombre: 'A' })] })
  )
  const meta = { artista: 'X', album: null }
  const cancion = (apariencia: Apariencia): Parameters<typeof resolverApariencia>[0] => ({
    metadatos: meta,
    estilo: estiloPredeterminado(),
    apariencia
  })

  it('heredar con reemplazo: espera de la canción y fondo del tema', () => {
    const r = resolverApariencia(cancion({ modo: 'heredar', reemplazos: { espera } }), indice)
    expect(r.estilo).toEqual({ ...temaDePrueba().estilo, espera })
    expect(r.procedencia).toBe('predeterminado')
    expect(r.procedenciaEspera).toBe('cancion')
  })
  it('sin reemplazo la procedencia de la espera es la del estilo', () => {
    const r = resolverApariencia(cancion({ modo: 'heredar' }), indice)
    expect(r.procedenciaEspera).toBe('predeterminado')
    expect(resolverApariencia(cancion({ modo: 'propio' }), null).procedenciaEspera).toBe('propio')
  })
  it('respaldo: se vuelve a aplicar y es idempotente', () => {
    const ap: Apariencia = { modo: 'tema', tema_id: A, reemplazos: { espera } }
    const fusionado = resolverApariencia(cancion(ap), indice).estilo
    const r = resolverApariencia({ metadatos: meta, estilo: fusionado, apariencia: ap }, null)
    expect(r.procedencia).toBe('respaldo')
    expect(r.estilo).toEqual(fusionado)
    expect(r.procedenciaEspera).toBe('cancion')
  })
})

describe('estilosIguales y pantalla (0287)', () => {
  it('la pantalla ausente es igual a la predeterminada explícita', () => {
    const a = estiloPredeterminado()
    expect(estilosIguales(a, { ...a, pantalla: { ...PANTALLA_PREDETERMINADA } })).toBe(true)
    expect(estilosIguales(a, { ...a, pantalla: { ...PANTALLA_PREDETERMINADA, lineas: 3 } })).toBe(
      false
    )
  })
})

describe('reemplazo_pantalla (ADR 0022 §1)', () => {
  const pantalla: Pantalla = { lineas: 3, pasadas: 0, transicion: 'fundido' }
  const A = idDePrueba(1)
  const indice = crearIndiceCatalogo(
    catalogoDePrueba({ predeterminado: A, temas: [temaDePrueba({ id: A, nombre: 'A' })] })
  )
  const meta = { artista: 'X', album: null }
  const cancion = (apariencia: Apariencia): Parameters<typeof resolverApariencia>[0] => ({
    metadatos: meta,
    estilo: estiloPredeterminado(),
    apariencia
  })

  it('heredar y tema fusionan la pantalla y la procedencia es la de la canción', () => {
    for (const ap of [
      { modo: 'heredar', reemplazo_pantalla: pantalla },
      { modo: 'tema', tema_id: A, reemplazo_pantalla: pantalla }
    ] as Apariencia[]) {
      const r = resolverApariencia(cancion(ap), indice)
      expect(r.estilo).toEqual({ ...temaDePrueba().estilo, pantalla })
      expect(r.procedenciaPantalla).toBe('cancion')
    }
  })
  it('0363: `zonas` viaja en el reemplazo (se hereda y se congela con el bloque)', () => {
    const conZonas: Pantalla = { ...pantalla, zonas: 'una' }
    const ap: Apariencia = { modo: 'heredar', reemplazo_pantalla: conZonas }
    expect(aparienciaSchema.parse(ap).reemplazo_pantalla).toEqual(conZonas)
    const r = resolverApariencia(cancion(ap), indice)
    expect(r.estilo.pantalla).toEqual(conZonas)
    expect(r.procedenciaPantalla).toBe('cancion')
  })
  it('sin reemplazo la procedencia es la del estilo y el estilo no se copia', () => {
    const r = resolverApariencia(cancion({ modo: 'heredar' }), indice)
    expect(r.procedenciaPantalla).toBe('predeterminado')
    expect(r.estilo).toBe(indice.porId.get(A)!.estilo)
    expect(resolverApariencia(cancion({ modo: 'propio' }), null).procedenciaPantalla).toBe('propio')
  })
  it('respaldo: se vuelve a aplicar y es idempotente', () => {
    const ap: Apariencia = { modo: 'tema', tema_id: A, reemplazo_pantalla: pantalla }
    const fusionado = resolverApariencia(cancion(ap), indice).estilo
    const r = resolverApariencia({ metadatos: meta, estilo: fusionado, apariencia: ap }, null)
    expect(r.procedencia).toBe('respaldo')
    expect(r.estilo).toEqual(fusionado)
    expect(r.procedenciaPantalla).toBe('cancion')
  })
  it('congelar al borrar el tema: el estilo resuelto ya lleva la pantalla y propio no la admite', () => {
    const ap: Apariencia = { modo: 'heredar', reemplazo_pantalla: pantalla }
    const congelado = resolverApariencia(cancion(ap), indice).estilo
    expect(congelado.pantalla).toEqual(pantalla)
    const propio = aparienciaSchema.safeParse({ modo: 'propio', reemplazo_pantalla: pantalla })
    expect(propio.success).toBe(false)
  })
  it('lectura tolerante: campos inválidos caen a su valor por defecto', () => {
    const r = aparienciaSchema.parse({
      modo: 'heredar',
      reemplazo_pantalla: { lineas: 40, pasadas: 1, transicion: 'ninguna' }
    })
    expect(r.reemplazo_pantalla).toEqual({ lineas: 5, pasadas: 1, transicion: 'ninguna' })
    expect(
      aparienciaSchema.parse({ modo: 'heredar', reemplazo_pantalla: 7 }).reemplazo_pantalla
    ).toBeUndefined()
  })
  it('reemplazos desconocidos ya no dañan la apariencia al leer', () => {
    const r = aparienciaSchema.safeParse({ modo: 'heredar', reemplazos: { futuro: 1 } })
    expect(r.success).toBe(true)
  })
  it('copia congelada del aparienciaSchema de 0.2.1: acepta la canción de 0.2.2 y descarta el campo', () => {
    // 0.2.1: reemplazos estricto, `reemplazo_pantalla` desconocido (se descarta sin error).
    const reemplazos021 = z.strictObject({ espera: z.object({}).loose().optional() })
    const apariencia021 = z.object({
      modo: z.enum(['propio', 'tema', 'heredar']),
      tema_id: z.uuid().nullable().optional(),
      reemplazos: reemplazos021.optional()
    })
    const escrito = JSON.parse(
      JSON.stringify({ modo: 'tema', tema_id: A, reemplazo_pantalla: pantalla })
    )
    const leido = apariencia021.safeParse(escrito)
    expect(leido.success).toBe(true)
    expect(leido.data).not.toHaveProperty('reemplazo_pantalla')
  })
  it('un tema con colores_partes lo conserva al volver a leerse', () => {
    const estilo = estiloPredeterminado()
    estilo.letra.colores_partes = { c2: '#4ADEDE' }
    const t = temaDePrueba({ id: A, estilo })
    const leido = catalogoSchema.parse(
      JSON.parse(JSON.stringify(catalogoDePrueba({ predeterminado: A, temas: [t] })))
    )
    expect(leido.temas[0]!.estilo.letra.colores_partes).toEqual({ c2: '#4ADEDE' })
    expect(estiloSchema.parse(leido.temas[0]!.estilo)).toEqual(leido.temas[0]!.estilo)
  })
})

describe('colores_partes y herencia de temas (0.2.3 · 0347)', () => {
  const A = idDePrueba(1)
  const B = idDePrueba(2)
  const conColores = estiloPredeterminado()
  conColores.letra.colores_partes = { c2: '#112233', coro: '#445566' }
  const indice = crearIndiceCatalogo(
    catalogoDePrueba({
      predeterminado: A,
      temas: [
        temaDePrueba({ id: A, nombre: 'Con colores', estilo: conColores }),
        temaDePrueba({ id: B, nombre: 'Sin colores' })
      ]
    })
  )
  const cancion = (tema_id: string): CancionResoluble => ({
    metadatos: { artista: 'X', album: null },
    estilo: estiloPredeterminado(),
    apariencia: { modo: 'tema', tema_id }
  })

  it('la canción hereda los colores del tema y, sin ellos, usa los predeterminados', () => {
    const con = resolverApariencia(cancion(A), indice).estilo
    expect(colorDeParte(con, 'c2')).toBe('#112233')
    expect(colorDeParte(con, 'c3')).toBe(COLORES_PARTES_PREDETERMINADOS.c3)
    const sin = resolverApariencia(cancion(B), indice).estilo
    expect(sin.letra.colores_partes).toBeUndefined()
    expect(colorDeParte(sin, 'c2')).toBe(COLORES_PARTES_PREDETERMINADOS.c2)
  })

  it('«ausente» y «predeterminado» son el mismo estilo; un color distinto, no', () => {
    const explicito = estiloPredeterminado()
    explicito.letra.colores_partes = { ...COLORES_PARTES_PREDETERMINADOS }
    expect(estilosIguales(explicito, estiloPredeterminado())).toBe(true)
    expect(estilosIguales(conColores, estiloPredeterminado())).toBe(false)
  })
})
