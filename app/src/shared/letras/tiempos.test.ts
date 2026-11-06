import { describe, expect, it } from 'vitest'
import { letra, linea, pausa } from '../__fixtures__'
import { validarInvariantesLetra, type Letra } from '../letra'
import {
  ajustarFin,
  ajustarInicio,
  aPeticionTiempos,
  borrarTiempos,
  contador,
  desplazar,
  fijarDesplazamiento,
  fijarFin,
  fijarInicio,
  formatearDesplazamiento,
  formatearTiempo,
  indiceLineaActual,
  interpretarDesplazamiento,
  interpretarTiempo,
  limitesInicio,
  lineaVecina,
  marcarInicioLinea,
  numeroDeLinea,
  primeraSinInicio,
  tiempoGuardado,
  tiempoMostrado,
  usarFinAutomatico
} from './tiempos'

function ejemplo(): Letra {
  return letra([
    linea('a', 'Llueve', 1000, {
      fin_ms: 2900,
      palabras: [{ texto: 'Llueve', inicio_ms: 1100, fin_ms: 1700 }]
    }),
    linea('b', 'Cae la lluvia', 3000),
    pausa('p', 5000),
    linea('c', 'Canta el río', 7000),
    linea('d', 'Al amanecer', 9000),
    linea('e', 'Llega el sol', null)
  ])
}

function congelar<T>(valor: T): T {
  if (typeof valor === 'object' && valor !== null) {
    for (const hijo of Object.values(valor)) congelar(hijo)
    Object.freeze(valor)
  }
  return valor
}

describe('edición de tiempos', () => {
  it('distingue los vecinos y solo acota los ajustes relativos', () => {
    const l = congelar(ejemplo())
    expect(limitesInicio(l, 'b')).toEqual({
      min: 1001,
      max: 4999,
      vecinoAnterior: 'linea',
      vecinoSiguiente: 'pausa'
    })
    expect(() => limitesInicio(l, 'p')).toThrow(RangeError)
    expect(fijarInicio(l, 'b', 5000)).toMatchObject({
      letra: l,
      cambiado: false,
      limite: { tipo: 'inicio_siguiente', vecino: 'pausa' }
    })
    expect(ajustarInicio(l, 'b', -3000)).toMatchObject({
      cambiado: true,
      limite: { tipo: 'inicio_anterior', vecino: 'linea' }
    })
    expect(ajustarInicio(l, 'b', 3000).letra.lineas[1]?.inicio_ms).toBe(4999)
    expect(ajustarInicio(l, 'e', 100).letra).toBe(l)
  })

  it('fija el fin a partir del automático y permite restaurarlo', () => {
    const l = ejemplo()
    const cambio = ajustarFin(l, 'b', -100, 30_000)
    expect(cambio.letra.lineas[1]?.fin_ms).toBe(4900)
    expect(usarFinAutomatico(cambio.letra, 'b').letra.lineas[1]?.fin_ms).toBeNull()
    expect(fijarFin(l, 'b', 3000, 30_000).limite).toEqual({ tipo: 'fin_antes_del_inicio' })
    expect(fijarFin(l, 'b', 5001, 30_000).limite).toEqual({ tipo: 'fin_siguiente' })
    expect(fijarFin(l, 'b', 5000, 30_000).letra.lineas[1]?.fin_ms).toBe(5000)
    expect(fijarFin(l, 'e', 29_000, 30_000).cambiado).toBe(false)
  })

  it('borra las dos líneas y la pausa adelantadas por una marca', () => {
    const l = congelar(ejemplo())
    const cambio = marcarInicioLinea(l, 'b', 9000)
    expect(cambio.borrados).toEqual(['p', 'c', 'd'])
    expect(cambio.letra.lineas.map((e) => e.inicio_ms)).toEqual([
      1000,
      9000,
      null,
      null,
      null,
      null
    ])
    expect(marcarInicioLinea(l, 'c', 5000)).toMatchObject({
      letra: l,
      cambiado: false,
      borrados: [],
      limite: { tipo: 'demasiado_pronto' }
    })
  })

  it('desplaza palabras y avisa si hay que descartarlas o anular un fin', () => {
    const l = congelar(ejemplo())
    expect(fijarInicio(l, 'a', 1200).letra.lineas[0]?.palabras).toEqual([
      { texto: 'Llueve', inicio_ms: 1300, fin_ms: 1900 }
    ])
    expect(fijarInicio(l, 'b', 1400)).toMatchObject({
      palabrasDescartadas: ['a'],
      finesAutomaticos: ['a']
    })
    expect(borrarTiempos(l, 'a').letra.lineas[0]).toMatchObject({
      inicio_ms: null,
      fin_ms: null,
      palabras: null
    })
  })

  it('aplica el desplazamiento al consultar los tiempos y conserva el original en la petición', () => {
    const l = ejemplo()
    expect(fijarDesplazamiento(l, -31_000)).toMatchObject({
      letra: { offset_ms: -30_000 },
      limite: { tipo: 'desplazamiento' }
    })
    expect(desplazar({ ...l, offset_ms: 30_000 }, 100)).toMatchObject({
      cambiado: false,
      limite: { tipo: 'desplazamiento' }
    })
    const ajustada = desplazar(l, 250).letra
    expect(indiceLineaActual(ajustada, 1249)).toBe(-1)
    expect(indiceLineaActual(ajustada, 5250)).toBe(1)
    expect(aPeticionTiempos('id', ajustada)).toMatchObject({
      cancionId: 'id',
      offset_ms: 250,
      tiempos: [
        expect.objectContaining({ id: 'a', inicio_ms: 1000 }),
        ...ajustada.lineas
          .slice(1)
          .map(({ id, inicio_ms, fin_ms, palabras }) => ({ id, inicio_ms, fin_ms, palabras }))
      ]
    })
    expect(tiempoGuardado(100.5, 250)).toBe(0)
    expect(tiempoGuardado(1249.5, 250)).toBe(1000)
    expect(tiempoMostrado(100, -250)).toBe(0)
  })

  it('consulta líneas ignorando las pausas', () => {
    const l = ejemplo()
    expect(contador(l)).toEqual({ sincronizadas: 4, total: 5 })
    expect(numeroDeLinea(l, 'c')).toBe(3)
    expect(primeraSinInicio(l)).toBe('e')
    expect(lineaVecina(l, 'b', 1)).toBe('c')
    expect(lineaVecina(l, 'c', -1)).toBe('b')
    expect(lineaVecina(l, 'a', -1)).toBeNull()
    expect(lineaVecina(l, null, 1)).toBe('a')
    expect(lineaVecina(l, null, -1)).toBe('e')
  })

  it('conserva los invariantes en 500 operaciones reproducibles sobre entradas congeladas', () => {
    let semilla = 25
    const azar = (maximo: number) => {
      semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0
      return Math.floor((semilla / 2 ** 32) * maximo)
    }
    let l = ejemplo()
    l.lineas.push(
      pausa('p2'),
      ...Array.from({ length: 7 }, (_, i) => linea(`extra${i}`, 'Inventada', 11_000 + i * 2000))
    )
    const ids = l.lineas.filter((e) => e.tipo === 'linea').map((e) => e.id)
    for (let i = 0; i < 500; i++) {
      congelar(l)
      const id = ids[azar(ids.length)]!
      const ms = azar(30_000)
      const delta = azar(6001) - 3000
      const operaciones = [
        () => fijarInicio(l, id, ms),
        () => ajustarInicio(l, id, delta),
        () => fijarFin(l, id, ms, 30_000),
        () => ajustarFin(l, id, delta, 30_000),
        () => usarFinAutomatico(l, id),
        () => borrarTiempos(l, id),
        () => marcarInicioLinea(l, id, ms),
        () => fijarDesplazamiento(l, ms * 3 - 45_000)
      ]
      l = operaciones[azar(operaciones.length)]!().letra
      expect(validarInvariantesLetra(l.lineas), `operación ${i}`).toEqual([])
    }
  })
})

describe('formato de los campos', () => {
  it('trunca a centésimas y acepta formatos parciales', () => {
    expect(formatearTiempo(4200)).toBe('00:04.20')
    expect(formatearTiempo(65_432)).toBe('01:05.43')
    expect(formatearTiempo(null)).toBe('--:--.--')
    expect(['1:05', '01:05.4', '01:05.43'].map(interpretarTiempo)).toEqual([65_000, 65_400, 65_430])
    expect(['1:5', '01:60', '01:05,20', '01:05.123', 'texto'].map(interpretarTiempo)).toEqual(
      Array(5).fill(null)
    )
  })
  it('muestra el signo y lee desplazamientos en segundos', () => {
    expect([250, -100, 0].map(formatearDesplazamiento)).toEqual(['+0,25 s', '−0,10 s', '+0,00 s'])
    expect(['+0,25', '−1,5', '0.3', '-30'].map(interpretarDesplazamiento)).toEqual([
      250, -1500, 300, -30_000
    ])
    expect(['0.125', '5 s', 'x', ''].map(interpretarDesplazamiento)).toEqual(Array(4).fill(null))
  })
})
