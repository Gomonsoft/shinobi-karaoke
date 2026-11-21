import { expect, it, vi } from 'vitest'
import { fijarAnimaciones, tiempoDeAnimacion, type AnimacionLike } from './animacionesPorFotograma'

function animacion(nace: string | null): AnimacionLike {
  const target = { getAttribute: (n: string) => (n === 'data-nace-ms' ? nace : null) }
  return { pause: vi.fn(), currentTime: null, effect: { target } as unknown as KeyframeEffect }
}

it('pausa todas y coloca cada una según su nacimiento, sin depender del fotograma anterior', () => {
  const entrada = animacion('2000')
  const numero = animacion('9000')
  const ajena = animacion(null)
  const doc = { getAnimations: () => [entrada, numero, ajena] }
  expect(fijarAnimaciones(2100, doc)).toBe(2)
  expect(entrada.currentTime).toBe(100)
  expect(numero.currentTime).toBe(0)
  expect(ajena.currentTime).toBeNull()
  for (const a of [entrada, numero, ajena]) expect(a.pause).toHaveBeenCalled()
  // Repetir el mismo instante, o saltar a él, da lo mismo.
  fijarAnimaciones(5000, doc)
  fijarAnimaciones(2100, doc)
  expect(entrada.currentTime).toBe(100)
})

it('el tiempo nunca es negativo', () => {
  expect(tiempoDeAnimacion(1000, 1500)).toBe(0)
})
