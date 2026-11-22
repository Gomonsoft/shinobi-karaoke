import { fondoCss, fondoCssEn, variablesEstilo } from './estiloCss'
import { ESTILO_PREDETERMINADO, type Estilo } from '@shared/estilo'

describe('fondoCss', () => {
  it('devuelve el color de un fondo sólido', () => {
    expect(fondoCss({ tipo: 'solido', color: '#112233' })).toBe('#112233')
  })

  it('genera un linear-gradient con ángulo y paradas', () => {
    expect(fondoCss(ESTILO_PREDETERMINADO.fondo)).toBe(
      'linear-gradient(135deg, #1B1033 0%, #5A1E6E 100%)'
    )
  })

  it('genera radial y cónico con cierre, y el movimiento cambia el ángulo', () => {
    const d = {
      ...ESTILO_PREDETERMINADO.fondo,
      centro: { x: 0.2, y: 0.8 }
    } as Extract<Estilo['fondo'], { tipo: 'degradado' }>
    expect(fondoCss({ ...d, forma: 'radial' })).toBe(
      'radial-gradient(circle farthest-corner at 20% 80%, #1B1033 0%, #5A1E6E 100%)'
    )
    expect(fondoCss({ ...d, forma: 'conico' })).toBe(
      'conic-gradient(from 135deg at 20% 80%, #1B1033 0%, #5A1E6E 100%, #1B1033 100%)'
    )
    const m = { ...d, movimiento: { periodo_s: 10, sentido: 'horario' as const } }
    expect(fondoCssEn(m, 2500)).toBe('linear-gradient(225deg, #1B1033 0%, #5A1E6E 100%)')
    expect(fondoCssEn(m, 2500, { estatico: true })).toBe(fondoCss(m))
  })
})

it('deriva variables CSS y peso desde el estilo y el registro', () => {
  const estilo = structuredClone(ESTILO_PREDETERMINADO)
  estilo.letra.fuente.familia = 'Nunito'
  expect(variablesEstilo(estilo)).toEqual({
    '--k-color': '#FFFFFF',
    '--k-resaltado': '#FFD400',
    '--k-color-gris': '#FFFFFF',
    '--k-fuente': '"Nunito"',
    '--k-peso': '800',
    '--k-fondo': 'linear-gradient(135deg, #1B1033 0%, #5A1E6E 100%)'
  })
})
