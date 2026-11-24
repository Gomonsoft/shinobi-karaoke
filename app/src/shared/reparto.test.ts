import { describe, expect, it } from 'vitest'
import { cancionDosCantantes, cancionUnCantanteConCoros } from './__fixtures__/reparto'
import { linea, letra, pausa } from './__fixtures__'
import { ESTILO_PREDETERMINADO } from './estilo'
import { letraSchema, type Letra } from './letra'
import {
  anadirCantante,
  asignar,
  carriles,
  colorDeParte,
  COLORES_PARTES_PREDETERMINADOS,
  inicial,
  insignia,
  lineasEntreParentesis,
  normalizarReparto,
  parteDe,
  quitarCantante,
  recuentoPorParte,
  renombrar,
  siguienteRanuraLibre,
  textoEnPantalla,
  tieneReparto,
  validarReparto,
  variosCantantes
} from './reparto'

const base = (): Letra =>
  letra([linea('a', 'Uno', 1000), linea('b', 'Dos', 2000), pausa('p'), linea('c', 'Tres', 4000)])
const dueto = (): Letra => anadirCantante(base())
const trio = (): Letra => anadirCantante(dueto())
const conNombres = (nombres: (string | null)[]): Letra => {
  let l = base()
  nombres.forEach((n, i) => {
    if (i > 0) l = anadirCantante(l)
    l = renombrar(l, (['c1', 'c2', 'c3', 'c4'] as const)[i]!, n)
  })
  return l
}
const texto = (l: Letra, p: Parameters<typeof inicial>[1]): unknown => {
  const i = inicial(l, p)
  return i.tipo === 'texto' ? i.texto : i.icono
}

describe('canción sin reparto', () => {
  it('no tiene reparto ni carriles y todas las líneas son de c1', () => {
    const l = base()
    expect(tieneReparto(l)).toBe(false)
    expect(variosCantantes(l)).toBe(false)
    expect(carriles(l)).toEqual([])
    expect(l.lineas.map((e) => parteDe(e))).toEqual(['c1', 'c1', 'c1', 'c1'])
    expect(insignia(l, 'c1')).toBeNull()
    expect(normalizarReparto(l)).toEqual(l)
  })
  it('un solo cantante con nombre o nivel propio no activa carriles, pero conserva partes', () => {
    const l = renombrar(base(), 'c1', ' Ana ')
    expect(l.partes).toEqual({ cantantes: [{ id: 'c1', nombre: 'Ana' }] })
    expect(tieneReparto(l)).toBe(false)
    expect(carriles(l)).toEqual([])
    const con = {
      ...base(),
      partes: { cantantes: [{ id: 'c1' as const, nombre: null }], voz_en_coros: 0.8 }
    }
    expect(normalizarReparto(con).partes?.voz_en_coros).toBe(0.8)
  })
  it('normalizar quita partes que no aportan nada (c1 sin nombre y nivel 0,5 o ausente)', () => {
    for (const nivel of [undefined, 0.5]) {
      const l = {
        ...base(),
        partes: { cantantes: [{ id: 'c1' as const, nombre: null }], voz_en_coros: nivel }
      }
      expect('partes' in normalizarReparto(l)).toBe(false)
    }
  })
})

describe('asignar, añadir, quitar y renombrar', () => {
  it('añadir en una canción sin reparto crea c1 y c2; la ranura libre sigue el orden', () => {
    const l = dueto()
    expect(l.partes?.cantantes.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(siguienteRanuraLibre(l)).toBe('c3')
    expect(siguienteRanuraLibre(anadirCantante(trio()))).toBeNull()
    expect(anadirCantante(anadirCantante(trio()))).toEqual(anadirCantante(trio()))
  })
  it('añadir con líneas se las asigna', () => {
    const l = anadirCantante(base(), ['b'])
    expect(parteDe(l.lineas[1]!, l)).toBe('c2')
    expect(l.lineas[0]!.parte).toBeUndefined()
  })
  it('asignar no toca tiempos; c1 no se escribe; las pausas se ignoran', () => {
    const l = asignar(dueto(), ['a', 'p', 'c'], 'c2')
    expect(l.lineas[0]!.parte).toBe('c2')
    expect(l.lineas[2]!.parte).toBeUndefined()
    expect(l.lineas[0]!.inicio_ms).toBe(1000)
    expect(asignar(l, ['a'], 'c1').lineas[0]).not.toHaveProperty('parte')
  })
  it('asignar una parte no disponible deja la letra igual', () => {
    const l = base()
    expect(asignar(l, ['a'], 'c3')).toBe(l)
    expect(asignar(l, ['a'], 'todos')).toBe(l)
    expect(asignar(l, ['a'], 'coro').lineas[0]!.parte).toBe('coro')
    expect(asignar(dueto(), ['a'], 'todos').lineas[0]!.parte).toBe('todos')
  })
  it('quitar pasa las líneas a c1, no renumera y, con uno solo, también las de todos', () => {
    let l = asignar(asignar(trio(), ['a'], 'c2'), ['b'], 'c3')
    l = asignar(l, ['c'], 'todos')
    const sin2 = quitarCantante(l, 'c2')
    expect(sin2.partes?.cantantes.map((c) => c.id)).toEqual(['c1', 'c3'])
    expect(parteDe(sin2.lineas[0]!, sin2)).toBe('c1')
    expect(parteDe(sin2.lineas[1]!, sin2)).toBe('c3')
    expect(parteDe(sin2.lineas[3]!, sin2)).toBe('todos')
    const sin3 = quitarCantante(sin2, 'c3')
    expect(sin3.lineas.every((e) => e.parte === undefined)).toBe(true)
    expect('partes' in sin3).toBe(false)
    expect(quitarCantante(l, 'c1')).toBe(l)
  })
  it('quitar deja los coros y su nivel', () => {
    const l = asignar(dueto(), ['a'], 'coro')
    const sin = quitarCantante(l, 'c2')
    expect(sin.lineas[0]!.parte).toBe('coro')
    expect(sin.partes?.cantantes).toEqual([{ id: 'c1', nombre: null }])
  })
  it('renombrar recorta, vacío es null y se limita a 40 caracteres', () => {
    expect(renombrar(dueto(), 'c2', '  Luis ').partes?.cantantes[1]!.nombre).toBe('Luis')
    expect(
      renombrar(renombrar(dueto(), 'c2', 'x'), 'c2', '   ').partes?.cantantes[1]!.nombre
    ).toBeNull()
    expect(renombrar(dueto(), 'c2', 'x'.repeat(60)).partes?.cantantes[1]!.nombre).toHaveLength(40)
    const l = dueto()
    expect(renombrar(l, 'c4', 'Nadie')).toBe(l)
  })
})

describe('carriles', () => {
  it('dúo: c1, c2 y coro; todos solo con líneas', () => {
    expect(carriles(dueto())).toEqual(['c1', 'c2', 'coro'])
    expect(carriles(asignar(dueto(), ['a'], 'todos'))).toEqual(['c1', 'c2', 'todos', 'coro'])
  })
  it('trío o más: todos siempre, entre los cantantes y el coro', () => {
    expect(carriles(trio())).toEqual(['c1', 'c2', 'c3', 'todos', 'coro'])
    expect(carriles(anadirCantante(trio()))).toEqual(['c1', 'c2', 'c3', 'c4', 'todos', 'coro'])
  })
  it('un cantante con coros: c1 y coro; un cantante recién añadido tiene su carril vacío', () => {
    expect(carriles(cancionUnCantanteConCoros().letra!)).toEqual(['c1', 'coro'])
    expect(carriles(anadirCantante(base())).includes('c2')).toBe(true)
  })
})

describe('inicial e insignia', () => {
  it('primera letra en mayúscula; el nombre predeterminado usa el número de ranura', () => {
    const l = conNombres(['ana', null])
    expect(texto(l, 'c1')).toBe('A')
    expect(texto(l, 'c2')).toBe('2')
    expect(texto(l, 'coro')).toBe('( )')
  })
  it('si chocan, dos letras; si aún chocan, el número de ranura', () => {
    expect([
      texto(conNombres(['Ana', 'Alba']), 'c1'),
      texto(conNombres(['Ana', 'Alba']), 'c2')
    ]).toEqual(['An', 'Al'])
    const igual = conNombres(['Ana', 'ana'])
    expect([texto(igual, 'c1'), texto(igual, 'c2')]).toEqual(['1', '2'])
    const tres = conNombres(['Ana', 'Alba', 'Luis'])
    expect([texto(tres, 'c1'), texto(tres, 'c2'), texto(tres, 'c3')]).toEqual(['An', 'Al', 'L'])
  })
  it('todos: dos iniciales con 2 cantantes y el icono users con 3 o 4', () => {
    expect(texto(conNombres(['Ana', 'Luis']), 'todos')).toBe('A·L')
    expect(inicial(trio(), 'todos')).toEqual({ tipo: 'icono', icono: 'users' })
  })
  it('la insignia solo existe con varios cantantes y nunca en el coro', () => {
    const l = conNombres(['Ana', 'Luis'])
    expect(insignia(l, 'c2')).toEqual({ tipo: 'texto', texto: 'L' })
    expect(insignia(l, 'coro')).toBeNull()
    expect(insignia(cancionUnCantanteConCoros().letra!, 'c1')).toBeNull()
  })
})

describe('lectura tolerante y validación', () => {
  it('una parte de un cantante que no existe o todos con uno solo se leen como c1', () => {
    const l = base()
    expect(parteDe({ parte: 'c3' }, l)).toBe('c1')
    expect(parteDe({ parte: 'todos' }, l)).toBe('c1')
    expect(parteDe({ parte: 'coro' }, l)).toBe('coro')
    expect(parteDe({ parte: 'x' as never }, l)).toBe('c1')
    expect(parteDe({ parte: 'c2' }, dueto())).toBe('c2')
  })
  it('cantantes dañados se reparan sin marcar la letra como inválida', () => {
    const r = letraSchema.parse({
      ...base(),
      partes: {
        cantantes: [{ id: 'c3', nombre: 5 }, { id: 'c3', nombre: 'Dup' }, { id: 'zz' }, 'x'],
        voz_en_coros: 7
      }
    })
    expect(r.partes?.cantantes).toEqual([
      { id: 'c1', nombre: null },
      { id: 'c3', nombre: null }
    ])
    expect(r.partes?.voz_en_coros).toBeUndefined()
    expect(letraSchema.parse({ ...base(), partes: { cantantes: 'no' } }).partes?.cantantes).toEqual(
      [{ id: 'c1', nombre: null }]
    )
  })
  it('validarReparto rechaza lo que main no debe escribir', () => {
    expect(validarReparto(cancionDosCantantes().letra!)).toEqual([])
    const l = base()
    const con = (parte: string, tipo = 0): string[] =>
      validarReparto({
        ...l,
        lineas: l.lineas.map((e, i) => (i === tipo ? { ...e, parte: parte as never } : e))
      })
    expect(con('c1')).toHaveLength(1)
    expect(con('c3')).toHaveLength(1)
    expect(con('todos')).toHaveLength(1)
    expect(con('coro')).toEqual([])
    expect(con('coro', 2)).toHaveLength(1)
    expect(
      validarReparto({ ...l, partes: { cantantes: [{ id: 'c2', nombre: null }] } })
    ).not.toEqual([])
    expect(
      validarReparto({ ...l, partes: { cantantes: [{ id: 'c1', nombre: '  x ' }] } })
    ).not.toEqual([])
    expect(
      validarReparto({
        ...l,
        partes: { cantantes: [{ id: 'c1', nombre: null }], voz_en_coros: 0.33 }
      })
    ).not.toEqual([])
  })
})

describe('presentación', () => {
  const estilo = ESTILO_PREDETERMINADO
  it('colorDeParte: c1 es color_resaltado y el resto usa el estilo o el predeterminado', () => {
    expect(colorDeParte(estilo, 'c1')).toBe(estilo.letra.color_resaltado)
    expect(colorDeParte(estilo, 'coro')).toBe(COLORES_PARTES_PREDETERMINADOS.coro)
    const propio = { letra: { ...estilo.letra, colores_partes: { c2: '#112233' } } }
    expect(colorDeParte(propio, 'c2')).toBe('#112233')
    expect(colorDeParte(propio, 'c3')).toBe(COLORES_PARTES_PREDETERMINADOS.c3)
  })
  it('textoEnPantalla pone paréntesis solo al coro que no los trae', () => {
    const t = (texto: string, parte?: 'coro'): boolean =>
      textoEnPantalla({ tipo: 'linea', texto, ...(parte ? { parte } : {}) }).parentesis
    expect(t('Ah', 'coro')).toBe(true)
    expect(t(' (Ah) ', 'coro')).toBe(false)
    expect(t('Ah')).toBe(false)
  })
  it('lineasEntreParentesis solo toma líneas de c1', () => {
    const l = letra([
      linea('a', '(Ah)', 1000),
      linea('b', ' (Eh) ', 2000, { parte: 'coro' }),
      linea('c', '(abierto', 3000),
      linea('d', 'Hola (eco)', 4000)
    ])
    expect(lineasEntreParentesis(l)).toEqual(['a'])
  })
  it('recuentoPorParte cuenta líneas, no pausas', () => {
    expect(recuentoPorParte(cancionDosCantantes().letra!)).toEqual({
      c1: 1,
      c2: 2,
      c3: 0,
      c4: 0,
      todos: 1,
      coro: 2
    })
  })
})
