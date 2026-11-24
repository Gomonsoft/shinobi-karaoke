import { describe, expect, it } from 'vitest'
import { lista } from './__fixtures__'
import * as anterior from './__fixtures__/letra0_2_2'
import { letraAleatoria, mulberry32 } from './__fixtures__/letrasAleatorias'
import { motivosParaNoEstarLetraLista } from './derivados'
import {
  anteriorQueChoca,
  chocan,
  finEfectivo,
  letraSchema,
  moverInicioLinea,
  siguienteQueChoca,
  validarInvariantesLetra,
  type ElementoLetra,
  type Letra
} from './letra'
import { ajustarFin, fijarFin, fijarInicio } from './letras/tiempos'
import { cargarBorrador, limitesEditorDe } from './letras/palabras'
import { normalizarLetra } from './letras/normalizar'
import { retirarCamposObsoletos } from './letras/retirar'

/**
 * Fin por parte (0.2.3, tarea 0357; ADR 0029 §7 y «Resultado de la prueba técnica de voces a la vez»):
 * inicios crecientes en toda la letra; el fin fijado y las palabras no pasan de la siguiente línea que
 * choca; el fin automático llega a la siguiente de cualquier parte. Letras inventadas.
 */

const l = (
  id: string,
  inicio: number | null,
  extra: Partial<ElementoLetra> = {}
): ElementoLetra => ({
  id,
  tipo: 'linea',
  texto: `Verso ${id}`,
  inicio_ms: inicio,
  fin_ms: null,
  palabras: null,
  ...extra
})
const pausa = (id: string, inicio: number | null = null): ElementoLetra => ({
  id,
  tipo: 'pausa',
  texto: '',
  inicio_ms: inicio,
  fin_ms: null,
  palabras: null
})
const DUO = {
  cantantes: [
    { id: 'c1' as const, nombre: 'Ana' },
    { id: 'c2' as const, nombre: 'Luis' }
  ]
}
const TRIO = {
  cantantes: [...DUO.cantantes, { id: 'c3' as const, nombre: null }]
}
const con = (lineas: ElementoLetra[], partes: Letra['partes'] = DUO): Letra => ({
  origen: 'manual',
  lrclib_id: null,
  offset_ms: 0,
  partes,
  lineas
})
const sin = (lineas: ElementoLetra[]): Letra => ({
  origen: 'manual',
  lrclib_id: null,
  offset_ms: 0,
  lineas
})
const problemas = (x: Letra) => validarInvariantesLetra(x.lineas, x)

describe('chocan', () => {
  const a = l('a', 0)
  const c2 = l('b', 1, { parte: 'c2' })
  const c3 = l('c', 2, { parte: 'c3' })
  const todos = l('t', 3, { parte: 'todos' })
  const coro = l('o', 4, { parte: 'coro' })
  it('misma parte; todos con cantantes pero no con el coro; coro con coro; pausa con todo', () => {
    expect(chocan(a, l('a2', 5), con([a]))).toBe(true)
    expect(chocan(a, c2, con([a, c2], TRIO))).toBe(false)
    expect(chocan(c2, c3, con([], TRIO))).toBe(false)
    expect(chocan(todos, a, con([], TRIO))).toBe(true)
    expect(chocan(c2, todos, con([], TRIO))).toBe(true)
    expect(chocan(todos, coro, con([], TRIO))).toBe(false)
    expect(chocan(coro, a, con([]))).toBe(false)
    expect(chocan(coro, l('o2', 6, { parte: 'coro' }))).toBe(true)
    expect(chocan(pausa('p'), coro)).toBe(true)
    expect(chocan(a, pausa('p'))).toBe(true)
  })

  it('usa la lectura tolerante: un cantante que no existe, o «todos» con uno solo, es c1', () => {
    const solo = sin([])
    expect(chocan(l('x', 0, { parte: 'c3' }), a, solo)).toBe(true)
    expect(chocan(l('x', 0, { parte: 'todos' }), a, solo)).toBe(true)
    expect(chocan(l('x', 0, { parte: 'c3' }), a, con([], DUO))).toBe(true)
  })

  it('siguienteQueChoca y anteriorQueChoca saltan las de otra parte', () => {
    const lineas = [
      l('a', 0),
      l('b', 100, { parte: 'c2' }),
      l('c', 200),
      l('d', 300, { parte: 'c2' })
    ]
    const letra = con(lineas)
    expect(siguienteQueChoca(lineas, 0, letra)).toBe(2)
    expect(siguienteQueChoca(lineas, 1, letra)).toBe(3)
    expect(siguienteQueChoca(lineas, 3, letra)).toBe(-1)
    expect(anteriorQueChoca(lineas, 3, letra)).toBe(1)
    expect(anteriorQueChoca(lineas, 0, letra)).toBe(-1)
  })
})

describe('invariantes con voces a la vez', () => {
  it('un fin fijado puede pasar del inicio de una línea de otra parte, no del de la siguiente que choca', () => {
    const ok = con([
      l('a', 1000, { fin_ms: 5000 }),
      l('b', 2000, { parte: 'c2', fin_ms: 4000 }),
      l('c', 6000)
    ])
    expect(problemas(ok)).toEqual([])
    const mal = con([l('a', 1000, { fin_ms: 7000 }), l('b', 2000, { parte: 'c2' }), l('c', 6000)])
    expect(problemas(mal)).toHaveLength(1)
    expect(problemas(mal)[0]).toContain('después del inicio de la siguiente (6000 ms)')
  })

  it('los inicios siguen estrictamente crecientes en toda la letra', () => {
    const mal = con([l('a', 2000), l('b', 2000, { parte: 'c2' })])
    expect(problemas(mal)[0]).toContain('orden creciente')
    expect(problemas(con([l('a', 2000), l('b', 2001, { parte: 'c2' })]))).toEqual([])
  })

  it('una pausa choca con todo: ninguna línea la cruza', () => {
    const mal = con([
      l('a', 1000, { fin_ms: 5000 }),
      pausa('p', 3000),
      l('b', 4000, { parte: 'c2' })
    ])
    expect(problemas(mal)).toHaveLength(1)
  })

  it('«todos» con cantantes choca; con el coro, no', () => {
    const base = (parte: 'c2' | 'coro') =>
      con(
        [
          l('t', 1000, { parte: 'todos', fin_ms: 5000 }),
          l('x', 2000, { parte }),
          l('z', 6000, { parte: 'todos' })
        ],
        DUO
      )
    expect(problemas(base('coro'))).toEqual([])
    expect(problemas(base('c2'))).toHaveLength(1)
  })

  it('las palabras tampoco pasan de la siguiente que choca', () => {
    const palabras = [
      { texto: 'Verso', inicio_ms: 1000, fin_ms: 1500 },
      { texto: 'a', inicio_ms: 1500, fin_ms: 4500 }
    ]
    const letra = con([l('a', 1000, { palabras }), l('b', 2000, { parte: 'c2' }), l('c', 6000)])
    expect(problemas(letra)).toEqual([])
    expect(problemas(sin([l('a', 1000, { palabras }), l('b', 2000), l('c', 6000)])).length).toBe(
      0 + 1
    )
  })

  it('el esquema acepta los solapes (la regla vive en letraSchema)', () => {
    const letra = con([l('a', 1000, { fin_ms: 5000 }), l('b', 2000, { parte: 'c2', fin_ms: 4000 })])
    expect(letraSchema.safeParse(letra).success).toBe(true)
  })
})

describe('fin efectivo', () => {
  it('el fin automático llega a la siguiente línea de cualquier parte (nunca crea un solape)', () => {
    const letra = con([l('a', 1000), l('b', 2500, { parte: 'c2' }), l('c', 6000)])
    expect(finEfectivo(letra, 'a', 30_000)).toBe(2500)
    expect(finEfectivo(letra, 'b', 30_000)).toBe(6000)
  })

  it('un fin fijado se respeta aunque pase de otra parte', () => {
    const letra = con([l('a', 1000, { fin_ms: 5000 }), l('b', 2500, { parte: 'c2' })])
    expect(finEfectivo(letra, 'a', 30_000)).toBe(5000)
  })

  it('las palabras hechas a mano pueden llegar más allá de otra parte', () => {
    const palabras = [
      { texto: 'Verso', inicio_ms: 1000, fin_ms: 2000 },
      { texto: 'a', inicio_ms: 2000, fin_ms: 4000 }
    ]
    const a = l('a', 1000, { palabras, origen_palabras: 'manual' })
    const letra = con([a, l('b', 2500, { parte: 'c2' }), l('c', 9000)])
    expect(finEfectivo(letra, 'a', 30_000)).toBe(4000)
    expect(finEfectivo(sin([a, l('b', 2500), l('c', 9000)]), 'a', 30_000)).toBe(2500)
  })
})

describe('moverInicioLinea con voces a la vez', () => {
  it('mover el inicio no quita el fin de una anterior de otra parte', () => {
    const letra = con([
      l('a', 1000, { fin_ms: 5000 }),
      l('b', 6000, { parte: 'c2' }),
      l('c', 7000, { parte: 'c2' })
    ])
    const r = moverInicioLinea(letra, 'b', 3000)
    expect(r.finesAutomaticos).toEqual([])
    expect(r.letra.lineas[0]!.fin_ms).toBe(5000)
    expect(validarInvariantesLetra(r.letra.lineas, r.letra)).toEqual([])
  })

  it('sí se lo quita a la anterior de su misma parte (y el suyo contra la siguiente que choca)', () => {
    const letra = con([l('a', 1000, { fin_ms: 5000 }), l('x', 3000, { parte: 'c2' }), l('b', 6000)])
    const r = moverInicioLinea(letra, 'b', 4000)
    expect(r.finesAutomaticos).toEqual(['a'])
  })
})

describe('límites del editor y del editor preciso', () => {
  const letra = con([
    l('a', 1000),
    l('b', 2000, { parte: 'c2' }),
    l('c', 6000),
    l('d', 7000, { parte: 'c2' })
  ])

  it('el fin llega hasta el inicio de la siguiente que choca', () => {
    expect(limitesEditorDe(letra, 'a', 30_000).finMax).toBe(6000)
    expect(limitesEditorDe(letra, 'b', 30_000).finMax).toBe(7000)
    expect(limitesEditorDe(letra, 'd', 30_000).finMax).toBe(30_000)
  })

  it('ajustar y fijar el fin: tope en la siguiente que choca; el aviso fin_siguiente solo ahí', () => {
    expect(fijarFin(letra, 'a', 5000, 30_000)).toMatchObject({ cambiado: true, limite: null })
    expect(fijarFin(letra, 'a', 6500, 30_000)).toMatchObject({
      cambiado: false,
      limite: { tipo: 'fin_siguiente' }
    })
    const r = ajustarFin(letra, 'a', 9000, 30_000)
    expect(r.letra.lineas[0]!.fin_ms).toBe(6000)
  })

  it('los límites del inicio no cambian: siguen entre los inicios vecinos (orden de lectura, aviso inicio_anterior)', () => {
    expect(fijarInicio(letra, 'c', 1500)).toMatchObject({
      limite: { tipo: 'inicio_anterior' }
    })
  })

  it('cargarBorrador respeta a la siguiente que choca para las palabras visibles', () => {
    const palabras = [
      { texto: 'Verso', inicio_ms: 1000, fin_ms: 2200 },
      { texto: 'a', inicio_ms: 2200, fin_ms: 4500 }
    ]
    const x = con([
      l('a', 1000, { palabras, origen_palabras: 'manual' }),
      l('b', 2000, { parte: 'c2' }),
      l('c', 6000)
    ])
    const { borrador, invalidas } = cargarBorrador(x, 'a', 30_000)
    expect(invalidas).toBe(false)
    expect(borrador.palabras).toHaveLength(2)
    expect(borrador.fin_ms).toBe(4500)
  })
})

describe('normalizarLetra con voces a la vez', () => {
  it('conserva los fines y las palabras que solo pasan de otra parte', () => {
    const letra = con([
      l('a', 1000, { fin_ms: 5000 }),
      l('b', 2000, { parte: 'c2', fin_ms: 4000 }),
      l('c', 6000)
    ])
    const salida = normalizarLetra(letra.lineas, undefined, letra)
    expect(salida.map((e) => e.fin_ms)).toEqual([5000, 4000, null])
  })

  it('recorta el fin que pasa de la siguiente que choca y, sin reparto, el de siempre', () => {
    const letra = con([l('a', 1000, { fin_ms: 7000 }), l('b', 2000, { parte: 'c2' }), l('c', 6000)])
    expect(normalizarLetra(letra.lineas, undefined, letra)[0]!.fin_ms).toBeNull()
    expect(normalizarLetra([l('a', 1000, { fin_ms: 3000 }), l('b', 2000)])[0]!.fin_ms).toBeNull()
  })
})

describe('derivados: líneas con fin no válido', () => {
  const cancion = (letra: Letra) => {
    const c = lista()
    c.metadatos.duracion_ms = 30_000
    c.letra = letra
    return c
  }
  const finNoValido = (letra: Letra) =>
    motivosParaNoEstarLetraLista(cancion(letra)).find((m) => m.codigo === 'FIN_NO_VALIDO')

  it('un solape de otra parte no es un fin no válido; pasar de la que choca, sí', () => {
    expect(
      finNoValido(con([l('a', 1000, { fin_ms: 5000 }), l('b', 2000, { parte: 'c2' })]))
    ).toBeUndefined()
    expect(finNoValido(con([l('a', 1000, { fin_ms: 5000 }), l('b', 2000)]))?.lineas).toEqual([1])
  })
})

describe('revisada y el fin efectivo', () => {
  it('«Está bien» deja de valer cuando cambia el fin efectivo de la línea, sin reescribir nada al abrir', () => {
    const revisada = { inicio_ms: 1000, fin_ms: 2500, texto: 'Verso a' }
    const previa = con([l('a', 1000, { revisada }), l('b', 2500, { parte: 'c2' }), l('c', 6000)])
    // Sin cambios: se conserva.
    expect(retirarCamposObsoletos(previa, previa, 30_000).lineas[0]!.revisada).toEqual(revisada)
    // Si la siguiente se adelanta, el fin automático de «a» cambia y la marca se retira.
    const movida = con([l('a', 1000, { revisada }), l('b', 2000, { parte: 'c2' }), l('c', 6000)])
    expect(retirarCamposObsoletos(previa, movida, 30_000).lineas[0]).not.toHaveProperty('revisada')
  })
})

// ---------------------------------------------------------------------------
// Regresión: sin solapes, la regla es la de 0.2.2 (prueba de propiedades de la 0356, semilla fija)
// ---------------------------------------------------------------------------

describe('regresión: sin solapes, la regla es la de 0.2.2', () => {
  const N = 1000
  const generar = (conReparto: boolean, semilla: number) => {
    const rng = mulberry32(semilla)
    return Array.from({ length: N }, () => letraAleatoria(rng, conReparto))
  }
  const sinReparto = generar(false, 20_261_123)
  const conReparto = generar(true, 20_261_124)

  it.each([
    ['sin reparto', sinReparto],
    ['con reparto pero sin solapes', conReparto]
  ])(
    '%s: invariantes y fin efectivo dan lo mismo que el código de 0.2.2 (1 000 letras)',
    (_n, letras) => {
      for (const letra of letras) {
        // Las generadas cumplen la regla anterior: las dos validaciones coinciden (vacías).
        expect(anterior.validarInvariantesLetra(letra.lineas)).toEqual([])
        expect(validarInvariantesLetra(letra.lineas, letra)).toEqual([])
        for (const e of letra.lineas) {
          expect(finEfectivo(letra, e.id, 60_000)).toBe(
            anterior.finEfectivo(letra as never, e.id, 60_000)
          )
        }
        // El esquema congelado de 0.2.2 sigue leyendo la letra (una letra sin solapes no se ve dañada).
        expect(anterior.letraSchema.safeParse(letra).success).toBe(true)
      }
    }
  )

  it('sin reparto: mover un inicio, normalizar y validar letras rotas dan lo mismo (1 000 letras)', () => {
    const rng = mulberry32(7)
    for (const letra of sinReparto) {
      const candidatas = letra.lineas.filter((e) => e.tipo === 'linea')
      const e = candidatas[Math.floor(rng() * candidatas.length)]!
      const i = letra.lineas.indexOf(e)
      const ant = letra.lineas.slice(0, i).findLast((x) => x.inicio_ms !== null)?.inicio_ms ?? -1
      const sig =
        letra.lineas.slice(i + 1).find((x) => x.inicio_ms !== null)?.inicio_ms ?? ant + 5000
      if (sig - ant < 3) continue
      const nuevo = ant + 1 + Math.floor(rng() * (sig - ant - 1))
      expect(moverInicioLinea(letra, e.id, nuevo)).toEqual(
        anterior.moverInicioLinea(letra as never, e.id, nuevo)
      )
      // Una letra rota (un fin pasa del siguiente inicio): los mismos problemas y la misma normalización.
      const rota = {
        ...letra,
        lineas: letra.lineas.map((x) =>
          x.id === e.id && x.inicio_ms !== null ? { ...x, fin_ms: x.inicio_ms + 99_999 } : { ...x }
        )
      }
      expect(validarInvariantesLetra(rota.lineas, rota)).toEqual(
        anterior.validarInvariantesLetra(rota.lineas)
      )
    }
    for (const letra of sinReparto) {
      const entrada = letra.lineas.map((x) => ({ ...x, fin_ms: x.fin_ms === null ? null : 1 }))
      expect(normalizarLetra(entrada, () => 'x', letra).map((x) => x.fin_ms)).toEqual(
        normalizarLetra(entrada, () => 'x').map((x) => x.fin_ms)
      )
    }
  })
})

describe('compatibilidad con 0.2.2 (pregunta 0365, opción A)', () => {
  it('una canción con solapes se ve dañada con el esquema de 0.2.2; una sin solapes, con reparto, no', () => {
    const solapes = con([
      l('a', 1000, { fin_ms: 5000 }),
      l('b', 2000, { parte: 'c2', fin_ms: 4000 })
    ])
    expect(letraSchema.safeParse(solapes).success).toBe(true)
    expect(anterior.letraSchema.safeParse(solapes).success).toBe(false)
    const sinSolapes = con([
      l('a', 1000, { fin_ms: 2000 }),
      l('b', 2000, { parte: 'c2', fin_ms: 4000 }),
      l('c', 5000, { parte: 'coro' })
    ])
    expect(letraSchema.safeParse(sinSolapes).success).toBe(true)
    expect(anterior.letraSchema.safeParse(sinSolapes).success).toBe(true)
  })
})
