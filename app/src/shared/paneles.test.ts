import { describe, expect, it } from 'vitest'
import {
  ALTO_TIMELINE_MINIMIZADA,
  LIMITES_PANELES,
  LIMITES_PRECISO,
  PRECISO_POR_DEFECTO,
  preferenciasPanelesPredeterminadas
} from './paneles'

describe('paneles', () => {
  it('los defectos están dentro de sus límites', () => {
    for (const l of [LIMITES_PANELES.lista, LIMITES_PANELES.panel]) {
      expect(l.defecto).toBeGreaterThanOrEqual(l.min)
      expect(l.defecto).toBeLessThanOrEqual(l.max)
    }
    expect(LIMITES_PANELES.linea_tiempo.defecto).toBeNull()
  })
  it('devuelve un objeto nuevo en cada llamada', () => {
    const a = preferenciasPanelesPredeterminadas()
    a.lista.ancho = 400
    expect(preferenciasPanelesPredeterminadas().lista.ancho).toBe(300)
  })
  it('la línea de tiempo minimizada es más baja en compacto', () => {
    expect(ALTO_TIMELINE_MINIMIZADA.compacto).toBeLessThan(ALTO_TIMELINE_MINIMIZADA.normal)
  })
})

describe('ventana del editor preciso (0273)', () => {
  it('valores por defecto y límites', () => {
    expect(PRECISO_POR_DEFECTO).toMatchObject({ ancho: 760, alto: 440, margen_ms: 500 })
    expect(LIMITES_PRECISO).toEqual({ ancho: { min: 560 }, alto: { min: 360 } })
  })

  it('«Restablecer distribución» devuelve la ventana a «sin preferencia»', () => {
    expect(preferenciasPanelesPredeterminadas().preciso).toEqual({
      geometria: null,
      margen_ms: 500
    })
  })
})
