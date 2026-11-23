import { describe, expect, it } from 'vitest'
import type { Preparacion } from '@shared/cancion'
import { filasPreparacion } from './preparacion'

const registro = (extra: Partial<Preparacion> = {}): Preparacion =>
  ({
    estado: 'en_curso',
    paso: 'ajustando_fines',
    origen: 'manual',
    actualizado: '2026-11-22T10:00:00Z',
    dudosas: 0,
    revisada: false,
    ...extra
  }) as Preparacion

describe('«Ajustar los fines…» sobre una letra sin marca en la vista de progreso (spec 04)', () => {
  it('con la corrida en marcha, «Comprobar» dice que no se comprueba y solo avanza los fines', () => {
    const [letra, comprobar, fines] = filasPreparacion(registro(), {
      tieneLetra: true,
      desfaseCorregidoMs: null,
      sinMarca: true
    })
    expect(letra!.dato).toBe('— Ya tiene letra')
    expect(comprobar!.dato).toBe('— Letra de una versión anterior: no se comprueba')
    expect(fines!.icono).toBe('curso')
  })

  it('sin la marca (letra intacta) no cambia nada', () => {
    const [, comprobar] = filasPreparacion(registro({ paso: 'comprobando' }), {
      tieneLetra: true,
      desfaseCorregidoMs: null,
      sinMarca: false
    })
    expect(comprobar!.icono).toBe('curso')
  })
})
