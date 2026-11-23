import { describe, expect, it } from 'vitest'
import { letra as hacerLetra, linea } from '@shared/__fixtures__'
import { cancionDosCantantes, cancionUnCantanteConCoros } from '@shared/__fixtures__/reparto'
import { PANTALLA_PREDETERMINADA, ZONA_OPACIDAD_INACTIVA } from '@shared/pantalla'
import type { Letra } from '@shared/letra'
import { fotogramaEn } from './render'
import {
  fotogramasDeZonas,
  fotogramasEstaticosDeZonas,
  geometriaDeZonas,
  pantallaDeZona,
  zonasDeLetra,
  zonasDePantalla
} from './zonas'

// 0.2.3 · tarea 0364: disposición por zonas (ADR 0029 §4 bis; C1-R2 a C1-R10).
const duo = cancionDosCantantes().letra!
const conCoros = cancionUnCantanteConCoros().letra!
const trio: Letra = {
  ...hacerLetra([
    linea('t1', 'Uno canta', 2000, { fin_ms: 4000 }),
    linea('t2', 'Dos canta', 5000, { parte: 'c2', fin_ms: 7000 }),
    linea('t3', 'Tres canta', 8000, { parte: 'c3', fin_ms: 10_000 })
  ]),
  partes: {
    cantantes: [
      { id: 'c1', nombre: null },
      { id: 'c2', nombre: null },
      { id: 'c3', nombre: null }
    ]
  }
}
const cuarteto: Letra = {
  ...duo,
  partes: {
    cantantes: [
      { id: 'c1', nombre: 'Ana' },
      { id: 'c2', nombre: 'Luis' },
      { id: 'c3', nombre: null },
      { id: 'c4', nombre: null }
    ]
  }
}
const ctx = { duracionMs: 30_000, titulo: 'Inventada', artista: 'Shinobi' }
const ventanas = [
  { anchoPx: 1920, altoPx: 1080 },
  { anchoPx: 1280, altoPx: 720 },
  { anchoPx: 1440, altoPx: 1080 }
]

describe('zonasDeLetra', () => {
  it('sin reparto o con «Todas en un bloque» hay una sola zona: el bloque de 0.2.2', () => {
    const solo = hacerLetra([linea('a', 'Nubes', 2000)])
    expect(zonasDeLetra(solo).map((z) => [z.id, z.modo])).toEqual([['todas', 'bloque']])
    expect(zonasDeLetra(solo)[0]!.lineas).toBe(solo.lineas)
    expect(zonasDeLetra(duo, { zonas: 'una' }).map((z) => z.id)).toEqual(['todas'])
  })

  it('un dúo con coro: Coro arriba, después un cantante por zona; Todos en cada cantante', () => {
    const zonas = zonasDeLetra(duo, { duracionMs: 30_000 })
    expect(zonas.map((z) => z.id)).toEqual(['coro', 'c1', 'c2'])
    expect(zonas.map((z) => z.lineasVisibles)).toEqual([1, 2, 2])
    const ids = (id: string) => zonas.find((z) => z.id === id)!.lineas.map((l) => l.id)
    expect(ids('coro')).toEqual(['d4', 'd6'])
    expect(ids('c1')).toEqual(['d1', 'd3'])
    expect(ids('c2')).toEqual(['d2', 'd3', 'd5'])
  })

  it('un solo cantante con coros tiene dos zonas; un trío sin coro, tres', () => {
    expect(zonasDeLetra(conCoros).map((z) => z.id)).toEqual(['coro', 'c1'])
    expect(zonasDeLetra(trio).map((z) => z.id)).toEqual(['c1', 'c2', 'c3'])
  })

  it('el fin de cada línea se resuelve en la letra entera', () => {
    const l = hacerLetra([
      linea('a', 'Uno', 2000),
      linea('b', 'Dos', 4000, { parte: 'c2' }),
      linea('c', 'Tres', 12_000)
    ])
    const dos = { ...l, partes: duo.partes }
    const c1 = zonasDeLetra(dos, { duracionMs: 30_000 }).find((z) => z.id === 'c1')!
    // «Uno» acaba cuando empieza «Dos» (otra parte), no 10 s después con «Tres».
    expect(c1.lineas[0]!.fin_ms).toBe(4000)
  })

  it('la subsecuencia es la misma para la misma letra (la caché de sucesos depende de ella)', () => {
    expect(zonasDeLetra(duo, { duracionMs: 30_000 })).toBe(
      zonasDeLetra(duo, { duracionMs: 30_000 })
    )
  })
})

describe('geometriaDeZonas (C1-R2, C1-R6)', () => {
  for (const { anchoPx, altoPx } of ventanas) {
    it(`dúo con coro a ${anchoPx} × ${altoPx}: en el 12 %–86 %, el coro a la mitad`, () => {
      const zonas = zonasDePantalla(duo, {}, { altoPx, anchoPx, duracionMs: 30_000 } as never)
      expect(zonas.map((z) => z.id)).toEqual(['coro', 'c1', 'c2'])
      const [coro, c1, c2] = zonas
      expect(coro!.region.altoPx).toBeCloseTo(c1!.region.altoPx / 2)
      expect(c1!.region.altoPx).toBeCloseTo(c2!.region.altoPx)
      expect(coro!.region.y0Px).toBeCloseTo(0.12 * altoPx)
      const ultima = c2!.region
      expect(ultima.y0Px + ultima.altoPx).toBeCloseTo(0.86 * altoPx)
      // Separadas 0,3 × S.
      const S = Math.max(32, 0.075 * altoPx)
      expect(c1!.region.y0Px - (coro!.region.y0Px + coro!.region.altoPx)).toBeCloseTo(0.3 * S)
      // Con 1 o 2 cantantes la línea en curso conserva S.
      expect(c1!.escala).toBe(1)
    })
  }

  it('la zona del coro cabe dos renglones y la fila de espera: S_coro = alto / 3,3 (mín. 0,5 S)', () => {
    const zonas = zonasDeLetra(duo, { duracionMs: 30_000 })
    const g = geometriaDeZonas(zonas, { altoPx: 1080 })
    const S = 0.075 * 1080
    expect(g.coro!.tamanoPx).toBeCloseTo(
      Math.max(0.5 * S, Math.min(S, g.coro!.region.altoPx / 3.3))
    )
  })

  it('con 4 cantantes y coro la línea que suena mide al menos el 75 % de S', () => {
    for (const { altoPx } of ventanas) {
      const zonas = zonasDeLetra(cuarteto, { duracionMs: 30_000 })
      expect(zonas).toHaveLength(5)
      const g = geometriaDeZonas(zonas, { altoPx })
      for (const z of zonas) {
        const geo = g[z.id]!
        expect(geo.escala).toBeGreaterThanOrEqual(z.id === 'coro' ? 0.5 : 0.75)
        expect(geo.region.y0Px).toBeGreaterThanOrEqual(0.12 * altoPx - 1e-6)
        expect(geo.region.y0Px + geo.region.altoPx).toBeLessThanOrEqual(0.86 * altoPx + 1e-6)
      }
      const [, c1, c2] = zonas.map((z) => g[z.id]!)
      expect(c1!.escala).toBe(c2!.escala)
    }
  })

  it('el tamaño depende de la ventana, no de las líneas: igual en 50 instantes', () => {
    const zonas = zonasDeLetra(duo, { duracionMs: 30_000 })
    const antes = geometriaDeZonas(zonas, { altoPx: 1080 })
    for (let i = 0; i < 50; i++) {
      fotogramasDeZonas(zonas, duo, i * 600, { ...ctx })
      expect(geometriaDeZonas(zonas, { altoPx: 1080 })).toEqual(antes)
    }
  })
})

describe('fotogramas por zona', () => {
  const zonas = zonasDeLetra(duo, { duracionMs: 30_000 })
  const en = (t: number, z = zonas, l: Letra = duo) => {
    const f = fotogramasDeZonas(z, l, t, { ...ctx })
    return Object.fromEntries(z.map((zona, i) => [zona.id, f[i]!]))
  }

  it('C1-R3: mientras canta Luis su zona está al 100 % y la de Ana espera su próxima al 55 %', () => {
    const f = en(5600)
    expect(f.c2!.opacidadZona).toBe(1)
    expect(f.c1!.opacidadZona).toBe(ZONA_OPACIDAD_INACTIVA)
    expect(f.c2!.lineas.find((l) => l.desde === 0)!.id).toBe('d2')
    // La próxima de Ana (la de Todos) ya está en el sitio principal de su zona, sin barrer.
    const proxima = f.c1!.lineas.find((l) => l.id === 'd3')!
    expect([proxima.desde, proxima.hacia, proxima.progreso]).toEqual([0, 0, 0])
  })

  it('C1-R4: una línea de Todos suena a la vez en la zona de cada cantante, y no en la del coro', () => {
    const f = en(9000)
    for (const id of ['c1', 'c2']) {
      expect(f[id]!.opacidadZona).toBe(1)
      expect(f[id]!.lineas.find((l) => l.id === 'd3')!.progreso).toBeGreaterThan(0)
    }
    expect(f.coro!.lineas.map((l) => l.id)).not.toContain('d3')
  })

  it('C1-R5: la línea de coro está en su zona, de una en una (N = 1)', () => {
    const f = en(15_000)
    expect(f.coro!.lineas.filter((l) => l.desde === 0).map((l) => l.id)).toEqual(['d4'])
    expect(f.coro!.lineas.every((l) => l.hacia <= 0)).toBe(true)
  })

  it('la opacidad cambia de forma lineal en D y es instantánea con movimiento reducido', () => {
    // D = 350 ms (desplazamiento): a mitad, el punto medio entre 0,55 y 1.
    expect(en(5000 + 175).c2!.opacidadZona).toBeCloseTo(0.55 + 0.45 * 0.5, 5)
    const reducido = fotogramasDeZonas(zonas, duo, 5000, { ...ctx, movimiento: 'reducido' })
    expect(reducido[2]!.opacidadZona).toBe(1)
    const antes = fotogramasDeZonas(zonas, duo, 4999, { ...ctx, movimiento: 'reducido' })
    expect(antes[2]!.opacidadZona).toBe(ZONA_OPACIDAD_INACTIVA)
  })

  it('cada zona solo tiene líneas suyas y ninguna ya cantada, en 50 instantes', () => {
    for (let i = 0; i < 50; i++) {
      const f = en(i * 500)
      for (const zona of zonas) {
        const propias = zona.lineas.map((l) => l.id)
        const lineas = f[zona.id]!.lineas
        expect(lineas.every((l) => propias.includes(l.id))).toBe(true)
        // N = 2 (1 en el coro): la en curso o próxima y la siguiente.
        expect(lineas.filter((l) => l.hacia >= 0).length).toBeLessThanOrEqual(zona.lineasVisibles)
        expect(f[zona.id]!.titulo).toBeNull()
      }
    }
  })

  it('el título y la aparición salen de la canción entera, no de cada zona', () => {
    const tardia: Letra = {
      ...hacerLetra([
        linea('p1', 'Cruza el faro', 9000, { fin_ms: 11_000 }),
        linea('p2', 'Responde el viento', 12_000, { parte: 'c2', fin_ms: 14_000 }),
        linea('p3', 'Eco de la plaza', 20_000, { parte: 'coro', fin_ms: 22_000 })
      ]),
      partes: duo.partes
    }
    const z = zonasDeLetra(tardia, { duracionMs: 30_000 })
    const antes = fotogramasDeZonas(z, tardia, 1000, { ...ctx })
    expect(antes.every((f) => f.titulo?.titulo === 'Inventada')).toBe(true)
    // La zona del coro empieza a los 20 s, pero se ve como próxima en cuanto acaba el título.
    const f = fotogramasDeZonas(z, tardia, 5500, { ...ctx })
    expect(f.every((x) => x.titulo === null)).toBe(true)
    expect(f[0]!.lineas.map((l) => l.id)).toEqual(['p3'])
    expect(f[0]!.opacidadZona).toBe(ZONA_OPACIDAD_INACTIVA)
  })

  describe('C1-R9: indicadores de espera', () => {
    const base = {
      ...hacerLetra([
        linea('h1', 'Cruza el faro', 2000, { fin_ms: 4000 }),
        linea('h2', 'Responde el viento', 15_000, { parte: 'c2' }),
        linea('h3', 'Cantemos todos', 24_000, { parte: 'todos' })
      ]),
      partes: duo.partes
    }
    const z = zonasDeLetra(base, { duracionMs: 30_000 })
    const con = (t: number) => {
      const f = fotogramasDeZonas(z, base, t, { ...ctx })
      return Object.fromEntries(z.map((zona, i) => [zona.id, f[i]!]))
    }

    it('antes de una línea de Luis, en su zona y con la línea que viene', () => {
      const f = con(12_500)
      expect(f.c2!.espera).not.toBeNull()
      expect(f.c1!.espera).toBeNull()
      expect(f.c2!.siguiente!.id).toBe('h2')
    })

    it('antes de una línea de Todos, una sola vez, en la zona del primer cantante', () => {
      const f = fotogramasDeZonas(z, base, 21_500, { ...ctx })
      const cuantas = f.filter((x) => x.espera).length
      expect(cuantas).toBe(1)
      expect(f[0]!.espera).not.toBeNull()
    })
  })

  it('C1-R10: «Líneas a la vez» y «Líneas ya cantadas» no cambian nada en zonas', () => {
    const otra = { ...PANTALLA_PREDETERMINADA, lineas: 7, pasadas: 2 }
    const a = fotogramasDeZonas(zonas, duo, 9500, { ...ctx, pantalla: PANTALLA_PREDETERMINADA })
    const b = fotogramasDeZonas(zonas, duo, 9500, { ...ctx, pantalla: otra })
    expect(b.map((f) => f.lineas)).toEqual(a.map((f) => f.lineas))
  })

  it('con «Todas en un bloque» el modelo es el de 0.2.2', () => {
    const una = zonasDeLetra(duo, { zonas: 'una' })
    expect(fotogramasDeZonas(una, duo, 9500, { ...ctx })).toEqual([
      fotogramaEn(duo, 9500, { ...ctx })
    ])
  })

  it('la zona estática pone la línea elegida en su zona y la próxima en las demás', () => {
    const f = fotogramasEstaticosDeZonas(zonas, duo, 'd2', PANTALLA_PREDETERMINADA)
    const [coro, c1, c2] = f
    expect(c2!.lineas.find((l) => l.desde === 0)!.id).toBe('d2')
    expect(c2!.opacidadZona).toBe(1)
    expect(c1!.lineas.find((l) => l.desde === 0)!.id).toBe('d3')
    expect(c1!.opacidadZona).toBe(ZONA_OPACIDAD_INACTIVA)
    expect(coro!.actual!.progreso).toBe(0)
  })
})

describe('subidaAlSalir (render.ts)', () => {
  const dos = { lineas: 2, pasadas: 0, transicion: 'desplazamiento' as const }
  const l = hacerLetra([
    linea('a', 'Uno', 2000, { fin_ms: 4000 }),
    linea('b', 'Dos', 10_000, { fin_ms: 12_000 }),
    linea('c', 'Tres', 20_000, { fin_ms: 22_000 })
  ])
  const puestos = (t: number, subida: boolean) =>
    Object.fromEntries(
      fotogramaEn(l, t, { ...ctx, pantalla: dos, subidaAlSalir: subida }).lineas.map((x) => [
        x.id,
        [x.desde, x.hacia]
      ])
    )

  it('en el fin, la salida y la subida van en un solo cambio', () => {
    expect(puestos(4100, true)).toEqual({ a: [0, -1], b: [1, 0], c: [2, 1] })
  })

  it('con hueco, la próxima espera en el sitio principal y no se mueve al empezar', () => {
    expect(puestos(8000, true)).toEqual({ b: [0, 0], c: [1, 1] })
    expect(puestos(10_100, true)).toEqual({ b: [0, 0], c: [1, 1] })
  })

  it('sin la opción es el «dos tiempos» de 0.2.2: la próxima espera en el puesto 1', () => {
    expect(puestos(8000, false)).toEqual({ b: [1, 1] })
  })

  it('antes de la primera línea ya está en el sitio principal', () => {
    expect(puestos(1000, true)).toEqual({ a: [0, 0], b: [1, 1] })
  })

  it('pantallaDeZona fija N y P = 0', () => {
    expect(pantallaDeZona(PANTALLA_PREDETERMINADA, zonasDeLetra(duo)[0]!)).toMatchObject({
      lineas: 1,
      pasadas: 0
    })
  })
})
