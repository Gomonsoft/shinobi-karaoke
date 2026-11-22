import { describe, expect, it } from 'vitest'
import { detectarIdioma } from './idioma'

describe('detectarIdioma', () => {
  it('español', () => {
    const l = ['El sol se va con la tarde', 'y yo me quedo en el mar', 'no sé por qué lloro']
    expect(detectarIdioma(l.map((texto) => ({ texto })))).toBe('es')
  })
  it('inglés', () => {
    expect(detectarIdioma('The river is calm and I am on the shore\nYou are not with me')).toBe(
      'en'
    )
  })
  it('sin texto suficiente o desconocido: null', () => {
    expect(detectarIdioma('')).toBeNull()
    expect(detectarIdioma('la la la')).toBeNull()
    expect(detectarIdioma('Zorgan blit mexa torvi lunaki prest vomel kader ruli')).toBeNull()
  })
})
