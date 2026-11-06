import { describe, expect, it, vi } from 'vitest'
import { letra, linea, pausa } from '@shared/__fixtures__'
import {
  alternarVoz,
  CuentaFinal,
  formatearReloj,
  pasoVolumen,
  pasoVoz,
  posicionInicial,
  silencioPrevioMs,
  textoIncompleta,
  textoIndicador,
  tiempoEnPalabras,
  VisibilidadControles
} from './modelo'

describe('modelo del reproductor', () => {
  it.each([
    [500, 5500],
    [3000, 3000],
    [5900, 100],
    [6000, 0],
    [20000, 0]
  ])('calcula el silencio previo con la primera línea a %d ms', (inicio, silencio) => {
    expect(silencioPrevioMs(letra([linea('a', 'Viene la luz', inicio)]))).toBe(silencio)
  })

  it('usa el desplazamiento, omite pausas y líneas sin sincronizar y aplica el silencio al entrar desde cero', () => {
    const entrada = {
      ...letra([
        linea('a', 'Por sincronizar', null),
        pausa('p', 2000),
        linea('b', 'Viene la luz', 3000)
      ]),
      offset_ms: 250
    }
    expect(silencioPrevioMs(entrada)).toBe(2750)
    expect(silencioPrevioMs({ ...entrada, offset_ms: -4500 })).toBe(7500)
    expect(posicionInicial('biblioteca', 0, entrada)).toBe(-2750)
    expect(posicionInicial('editor', 0, entrada)).toBe(-2750)
    expect(posicionInicial('editor', 1200, entrada)).toBe(1200)
    expect(silencioPrevioMs(letra([linea('a', 'Por sincronizar', null)]))).toBe(0)
    expect(silencioPrevioMs(null)).toBe(0)
  })

  it('formatea el reloj y el texto hablado de la barra', () => {
    expect(formatearReloj(-501)).toBe('00:00')
    expect(formatearReloj(61_999)).toBe('01:01')
    expect(formatearReloj(3_599_999)).toBe('59:59')
    expect(formatearReloj(3_600_000)).toBe('1:00:00')
    expect(tiempoEnPalabras(-501, 62_000)).toBe('0 segundos de 1 minuto 2 segundos')
    expect(tiempoEnPalabras(1_000, 60_000)).toBe('1 segundo de 1 minuto')
  })

  it('acota y redondea los niveles, y reactiva al ajustar el volumen o la voz', () => {
    expect(pasoVolumen(0.25, 0.1)).toEqual({ volumen: 0.35, silenciado: false })
    expect(pasoVolumen(0.95, 0.1)).toEqual({ volumen: 1, silenciado: false })
    expect(pasoVolumen(0.05, -0.1)).toEqual({ volumen: 0, silenciado: false })

    expect(alternarVoz({ voz_guia: 0, voz_guia_silenciada: true })).toEqual({
      voz_guia: 0.3,
      voz_guia_silenciada: false
    })
    expect(alternarVoz({ voz_guia: 0.75, voz_guia_silenciada: false })).toEqual({
      voz_guia: 0.75,
      voz_guia_silenciada: true
    })
    expect(pasoVoz({ voz_guia: 0.27, voz_guia_silenciada: true }, 0.1)).toEqual({
      voz_guia: 0.37,
      voz_guia_silenciada: false
    })
    expect(pasoVoz({ voz_guia: 0.05, voz_guia_silenciada: true }, -0.1)).toEqual({
      voz_guia: 0,
      voz_guia_silenciada: false
    })
  })

  it('usa la microcopy exacta en los indicadores y el aviso de lista incompleta', () => {
    const ctx = {
      sonando: true,
      volumen: 0.6,
      silenciado: false,
      volumenVoz: 0.3,
      vozSilenciada: false,
      offsetMs: 0
    }
    expect(textoIndicador({ tipo: 'alternar' }, ctx)).toBe('▶')
    expect(textoIndicador({ tipo: 'alternar' }, { ...ctx, sonando: false })).toBe('❚❚')
    expect(textoIndicador({ tipo: 'saltar', deltaMs: -5000 }, ctx)).toBe('−5 s')
    expect(textoIndicador({ tipo: 'saltar', deltaMs: 10000 }, ctx)).toBe('+10 s')
    expect(textoIndicador({ tipo: 'principio' }, ctx)).toBe('Al principio')
    expect(textoIndicador({ tipo: 'volumen', delta: 0.1 }, ctx)).toBe('Volumen 60 %')
    expect(textoIndicador({ tipo: 'silenciar' }, { ...ctx, silenciado: true })).toBe('Silenciado')
    expect(textoIndicador({ tipo: 'nivel_voz', delta: 0.1 }, ctx)).toBe('Voz 30 %')
    expect(textoIndicador({ tipo: 'voz' }, { ...ctx, vozSilenciada: true })).toBe('Voz silenciada')
    expect(textoIndicador({ tipo: 'desplazar', deltaMs: 100 }, ctx)).toBe('Desplazamiento: +0,00 s')
    expect(textoIndicador({ tipo: 'desplazar', deltaMs: 100 }, { ...ctx, offsetMs: 250 })).toBe(
      'Desplazamiento: +0,25 s'
    )
    expect(textoIndicador({ tipo: 'desplazar', deltaMs: -100 }, { ...ctx, offsetMs: -300 })).toBe(
      'Desplazamiento: −0,30 s'
    )
    expect(textoIncompleta(1)).toBe('⚠ Falta 1 línea por sincronizar: no se verá.')
    expect(textoIncompleta(3)).toBe('⚠ Faltan 3 líneas por sincronizar: no se verán.')
  })
})

describe('temporizadores del reproductor', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('oculta los controles a los 3 s y la actividad reinicia el plazo', () => {
    const controles = new VisibilidadControles()
    const cambio = vi.fn()
    controles.suscribir(cambio)
    expect(controles.visible()).toBe(true)
    vi.advanceTimersByTime(2500)
    controles.actividad()
    vi.advanceTimersByTime(2999)
    expect(controles.visible()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(controles.visible()).toBe(false)
    controles.actividad()
    expect(controles.visible()).toBe(true)
    expect(cambio.mock.calls).toEqual([[false], [true]])
    controles.destruir()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('mantiene visibles los controles hasta que termina la última retención', () => {
    const controles = new VisibilidadControles()
    vi.advanceTimersByTime(3000)
    controles.fijarRetenida('pausa', true)
    controles.fijarRetenida('franja', true)
    expect(controles.visible()).toBe(true)
    controles.fijarRetenida('pausa', false)
    vi.advanceTimersByTime(6000)
    expect(controles.visible()).toBe(true)
    controles.fijarRetenida('franja', false)
    vi.advanceTimersByTime(3000)
    expect(controles.visible()).toBe(false)
  })

  it('la cuenta emite cada segundo y termina una sola vez', () => {
    const cuenta = new CuentaFinal()
    const cambio = vi.fn()
    const terminar = vi.fn()
    cuenta.suscribir(cambio)
    cuenta.alTerminar(terminar)
    cuenta.iniciar()
    vi.advanceTimersByTime(9999)
    expect(cambio.mock.calls.map(([n]) => n)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
    expect(terminar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10_000)
    expect(cambio).toHaveBeenLastCalledWith(0)
    expect(terminar).toHaveBeenCalledOnce()
  })

  it('detiene la cuenta con actividad y permite reiniciarla', () => {
    const cuenta = new CuentaFinal({ segundos: 2 })
    const cambio = vi.fn()
    const terminar = vi.fn()
    cuenta.suscribir(cambio)
    cuenta.alTerminar(terminar)
    cuenta.iniciar()
    vi.advanceTimersByTime(1000)
    cuenta.detener()
    vi.advanceTimersByTime(10_000)
    expect(cambio.mock.calls).toEqual([[2], [1], [null]])
    expect(terminar).not.toHaveBeenCalled()
    cuenta.iniciar()
    vi.advanceTimersByTime(2000)
    expect(terminar).toHaveBeenCalledOnce()
  })
})
