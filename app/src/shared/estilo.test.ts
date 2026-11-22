import { describe, expect, it } from 'vitest'
import { estiloSchema010 } from './__fixtures__/estilo-0.1.0'
import { ESPERA_LEGADA } from './espera'
import {
  ESTILO_PREDETERMINADO,
  estiloPredeterminado,
  estiloSchema,
  normalizarEstilo
} from './estilo'
import { PANTALLA_PREDETERMINADA } from './pantalla'
import { FUENTE_PREDETERMINADA, FUENTES_INCLUIDAS } from './fuentes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const estilo = () => structuredClone(ESTILO_PREDETERMINADO) as Record<string, any>

describe('estiloSchema', () => {
  it('acepta el estilo predeterminado (sistema-visual §8)', () => {
    expect(estiloSchema.parse(ESTILO_PREDETERMINADO)).toEqual(ESTILO_PREDETERMINADO)
    expect(ESTILO_PREDETERMINADO.letra.color_resaltado).toBe('#FFD400')
  })
  it('estiloPredeterminado devuelve copias independientes', () => {
    const a = estiloPredeterminado()
    a.letra.color = '#000000'
    expect(estiloPredeterminado().letra.color).toBe('#FFFFFF')
  })
  it('acepta fondo sólido', () => {
    const e = estilo()
    e.fondo = { tipo: 'solido', color: '#0E0F14' }
    expect(estiloSchema.safeParse(e).success).toBe(true)
  })
  it('degradado: 2 a 4 paradas', () => {
    const parada = (p: number) => ({ color: '#112233', posicion: p })
    const con = (n: number) => {
      const e = estilo()
      e.fondo.paradas = Array.from({ length: n }, (_, i) => parada(i / Math.max(1, n - 1)))
      return estiloSchema.safeParse(e).success
    }
    expect([con(1), con(2), con(3), con(4), con(5)]).toEqual([false, true, true, true, false])
  })
  it('degradado: ángulo entero 0–359', () => {
    const con = (a: number) => {
      const e = estilo()
      e.fondo.angulo_grados = a
      return estiloSchema.safeParse(e).success
    }
    expect([con(0), con(359), con(360), con(-1), con(10.5)]).toEqual([
      true,
      true,
      false,
      false,
      false
    ])
  })
  it('posición de parada 0..1', () => {
    const e = estilo()
    e.fondo.paradas[1].posicion = 1.1
    expect(estiloSchema.safeParse(e).success).toBe(false)
  })
  it('colores #RRGGBB', () => {
    for (const malo of ['FFFFFF', '#FFF', '#GGGGGG', '#FFFFFFFF', 'rojo']) {
      const e = estilo()
      e.letra.color = malo
      expect(estiloSchema.safeParse(e).success, malo).toBe(false)
    }
    const e = estilo()
    e.letra.color = '#ffd400'
    expect(estiloSchema.safeParse(e).success).toBe(true)
  })
  it('rechaza origen de fuente "sistema" en el MVP', () => {
    const e = estilo()
    e.letra.fuente.origen = 'sistema'
    expect(estiloSchema.safeParse(e).success).toBe(false)
  })
  it('familia incluida desconocida cae a la predeterminada; las conocidas se conservan', () => {
    const e = estilo()
    e.letra.fuente.familia = 'Comic Sans'
    expect(estiloSchema.parse(e).letra.fuente.familia).toBe(FUENTE_PREDETERMINADA)
    for (const f of FUENTES_INCLUIDAS) {
      e.letra.fuente.familia = f
      expect(estiloSchema.parse(e).letra.fuente.familia).toBe(f)
    }
  })
  it('rechaza versión distinta de 1 y tipo de fondo desconocido', () => {
    expect(estiloSchema.safeParse({ ...estilo(), version: 2 }).success).toBe(false)
    expect(estiloSchema.safeParse({ ...estilo(), fondo: { tipo: 'radial' } }).success).toBe(false)
  })
  it('hay 8 familias incluidas', () => {
    expect(FUENTES_INCLUIDAS).toHaveLength(8)
  })
})

describe('estilo ampliado (ADR 0018 §1)', () => {
  const conico = () => {
    const e = estilo()
    e.fondo = {
      ...e.fondo,
      forma: 'conico',
      centro: { x: 0.2, y: 0.8 },
      movimiento: { periodo_s: 30, sentido: 'antihorario' }
    }
    e.espera = { ...ESPERA_LEGADA, cuenta: true, umbral_ms: 8000 }
    return e
  }
  it('un estilo de 0.1.0 valida igual y se normaliza como lineal estático con espera legada', () => {
    const base = estiloPredeterminado()
    const parsed = estiloSchema.parse(base)
    expect(parsed).toEqual(base)
    const n = normalizarEstilo(parsed)
    expect(n.fondo).toMatchObject({ forma: 'lineal', centro: { x: 0.5, y: 0.5 }, movimiento: null })
    expect(n.espera).toEqual(ESPERA_LEGADA)
    expect(parsed).toEqual(base) // no modifica la entrada
  })
  it('normalizar un fondo sólido no le añade campos de degradado', () => {
    const e = estilo()
    e.fondo = { tipo: 'solido', color: '#0E0F14' }
    expect(normalizarEstilo(estiloSchema.parse(e)).fondo).toEqual(e.fondo)
  })
  it('valida un cónico completo; la copia de 0.1.0 lo lee sin los campos nuevos', () => {
    const e = conico()
    expect(estiloSchema.parse(e)).toEqual(e)
    const viejo = estiloSchema010.parse(e)
    expect(viejo.fondo).toEqual({
      tipo: 'degradado',
      angulo_grados: e.fondo.angulo_grados,
      paradas: e.fondo.paradas
    })
    expect(viejo).not.toHaveProperty('espera')
  })
  it('rechaza valores fuera de rango y movimiento en un fondo sólido', () => {
    const con = (cambio: (e: ReturnType<typeof conico>) => void) => {
      const e = conico()
      cambio(e)
      return estiloSchema.safeParse(e).success
    }
    expect([
      con((e) => (e.fondo.movimiento.periodo_s = 9)),
      con((e) => (e.fondo.movimiento.periodo_s = 121)),
      con((e) => (e.fondo.movimiento.periodo_s = 10)),
      con((e) => (e.fondo.centro.x = 1.1)),
      con((e) => (e.fondo.centro.y = -0.1)),
      con((e) => (e.espera.umbral_ms = 999)),
      con((e) => (e.espera.umbral_ms = 60001)),
      con((e) => (e.fondo = { tipo: 'solido', color: '#000000', movimiento: null }))
    ]).toEqual([false, false, true, false, false, false, false, false])
  })
})

it.each([
  { posiciones: [0, 1], valida: true },
  { posiciones: [0, 1 / 3, 2 / 3, 1], valida: true },
  { posiciones: [0, 0.5, 0.5, 1], valida: true },
  { posiciones: [1, 0], valida: false }
])('valida el orden de las paradas $posiciones', ({ posiciones, valida }) => {
  const e = estilo()
  e.fondo.paradas = posiciones.map((posicion) => ({ color: '#112233', posicion }))
  expect(estiloSchema.safeParse(e).success).toBe(valida)
})

describe('estilo.pantalla y colores_partes (ADR 0022 §1)', () => {
  it('un estilo sin pantalla se normaliza con el predeterminado y no se reescribe', () => {
    const base = estiloPredeterminado()
    const parsed = estiloSchema.parse(base)
    expect(parsed).not.toHaveProperty('pantalla')
    expect(normalizarEstilo(parsed).pantalla).toEqual(PANTALLA_PREDETERMINADA)
    expect(estiloSchema.parse(base)).toEqual(base)
  })
  it('conserva pantalla; un valor suelto inválido no daña el estilo y uno entero ilegible se descarta', () => {
    const e = {
      ...estiloPredeterminado(),
      pantalla: { lineas: 7, pasadas: 2, transicion: 'fundido' }
    }
    expect(estiloSchema.parse(e).pantalla).toEqual(e.pantalla)
    expect(estiloSchema.parse({ ...e, pantalla: { ...e.pantalla, lineas: 99 } }).pantalla).toEqual({
      ...e.pantalla,
      lineas: 5
    })
    expect(estiloSchema.parse({ ...e, pantalla: 'x' }).pantalla).toBeUndefined()
  })
  it('pantalla.zonas (reservado para 0.2.3) se conserva tras leer y normalizar', () => {
    const e = {
      ...estiloPredeterminado(),
      pantalla: { ...PANTALLA_PREDETERMINADA, zonas: 'por_parte' }
    }
    const una = estiloSchema.parse(JSON.parse(JSON.stringify(e)))
    expect(una.pantalla?.zonas).toBe('por_parte')
    expect(normalizarEstilo(una).pantalla.zonas).toBe('por_parte')
  })
  it('colores_partes (reservado para 0.2.3) se conserva tras leer y volver a escribir', () => {
    const e = estiloPredeterminado()
    e.letra = { ...e.letra, colores_partes: { c2: '#4ADEDE', todos: '#B388FF', coro: '#FF9F1C' } }
    const una = estiloSchema.parse(JSON.parse(JSON.stringify(e)))
    expect(una.letra.colores_partes).toEqual(e.letra.colores_partes)
    expect(estiloSchema.parse(JSON.parse(JSON.stringify(una)))).toEqual(una)
  })
  it('colores_partes es tolerante: un color inválido se descarta y un valor ilegible no daña el estilo', () => {
    const e = estiloPredeterminado()
    const letra = (cp: unknown): unknown => ({ ...e, letra: { ...e.letra, colores_partes: cp } })
    expect(estiloSchema.parse(letra({ c1: 'rojo', c2: '#4ADEDE' })).letra.colores_partes).toEqual({
      c2: '#4ADEDE'
    })
    expect(estiloSchema.parse(letra(5)).letra.colores_partes).toBeUndefined()
  })
})
