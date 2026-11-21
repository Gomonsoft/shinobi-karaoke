import { describe, expect, it } from 'vitest'
import { letra, linea } from './__fixtures__'
import { MARGEN_ESCUCHA_LINEA_MS, tramoEscuchaLinea } from './escucha'

const base = letra([
  linea('a', 'Uno', 300, { fin_ms: 2000 }),
  linea('b', 'Dos', 9800),
  linea('c', 'Tres', null)
])

describe('tramoEscuchaLinea', () => {
  it('usa 500 ms de margen y recorta a 0 y a la duración', () => {
    expect(MARGEN_ESCUCHA_LINEA_MS).toBe(500)
    expect(tramoEscuchaLinea(base, 'a', 10_000)).toEqual({ desdeMs: 0, hastaMs: 2500 })
    // La última línea termina a inicio + 5000 acotado a la duración; el margen no pasa de ella.
    expect(tramoEscuchaLinea(base, 'b', 10_000)).toEqual({ desdeMs: 9300, hastaMs: 10_000 })
  })

  it('aplica offset_ms y no existe sin inicio o fuera del audio', () => {
    expect(tramoEscuchaLinea({ ...base, offset_ms: 1500 }, 'a', 10_000)).toEqual({
      desdeMs: 1300,
      hastaMs: 4000
    })
    expect(tramoEscuchaLinea(base, 'c', 10_000)).toBeNull()
    expect(tramoEscuchaLinea(base, 'zz', 10_000)).toBeNull()
    expect(tramoEscuchaLinea({ ...base, offset_ms: 20_000 }, 'a', 10_000)).toBeNull()
  })
})
