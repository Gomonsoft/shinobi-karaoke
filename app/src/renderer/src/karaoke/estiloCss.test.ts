import { fondoCss, variablesEstilo } from './estiloCss'
import { ESTILO_PREDETERMINADO } from '@shared/estilo'

describe('fondoCss', () => {
  it('devuelve el color de un fondo sólido', () => {
    expect(fondoCss({ tipo: 'solido', color: '#112233' })).toBe('#112233')
  })

  it('genera un linear-gradient con ángulo y paradas', () => {
    expect(fondoCss(ESTILO_PREDETERMINADO.fondo)).toBe(
      'linear-gradient(135deg, #1B1033 0%, #5A1E6E 100%)'
    )
  })
})

it('deriva variables CSS y peso desde el estilo y el registro', () => {
  const estilo = structuredClone(ESTILO_PREDETERMINADO)
  estilo.letra.fuente.familia = 'Nunito'
  expect(variablesEstilo(estilo)).toEqual({
    '--k-color': '#FFFFFF',
    '--k-resaltado': '#FFD400',
    '--k-fuente': '"Nunito"',
    '--k-peso': '800',
    '--k-fondo': 'linear-gradient(135deg, #1B1033 0%, #5A1E6E 100%)'
  })
})
