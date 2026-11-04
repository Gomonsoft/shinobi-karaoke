/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(import.meta.dirname, 'tokens.css'), 'utf8')

// Tabla de referencia: tokens de docs/ux/sistema-visual.md §2, §3 y §4 con su valor.
const ESCALA = [
  ['display', '2rem', '2.5rem', '700'],
  ['titulo', '1.5rem', '2rem', '700'],
  ['subtitulo', '1.125rem', '1.625rem', '600'],
  ['cuerpo', '0.9375rem', '1.375rem', '400'],
  ['cuerpo-fuerte', '0.9375rem', '1.375rem', '600'],
  ['pequeno', '0.8125rem', '1.125rem', '400'],
  ['tiempo', '0.8125rem', '1.125rem', '400']
] as const

const REFERENCIA: Record<string, string> = {
  'fondo-0': '#0e0f14',
  'fondo-1': '#161821',
  'fondo-2': '#1f2230',
  'fondo-3': '#292d3e',
  borde: '#2e3244',
  'borde-control': '#717896',
  velo: 'rgba(0, 0, 0, 0.6)',
  'texto-1': '#f2f3f7',
  'texto-2': '#a9aec2',
  'texto-3': '#9197ac',
  'texto-desactivado': 'rgba(145, 151, 172, 0.6)',
  acento: '#c8303b',
  'acento-hover': '#d13440',
  'acento-pulsado': '#b82a35',
  'acento-texto': '#ff6b72',
  foco: '#ffcc4d',
  exito: '#4ade9a',
  aviso: '#f5b94f',
  error: '#ff7a7a',
  info: '#7cb8ff',
  'exito-tenue': '#12291f',
  'aviso-tenue': '#2e2410',
  'error-tenue': '#331618',
  'info-tenue': '#122238',
  'e-1': '0.25rem',
  'e-2': '0.5rem',
  'e-3': '0.75rem',
  'e-4': '1rem',
  'e-5': '1.5rem',
  'e-6': '2rem',
  'e-7': '3rem',
  'e-8': '4rem',
  'r-s': '0.375rem',
  'r-m': '0.625rem',
  'r-l': '1rem',
  elevacion: '0 8px 24px rgba(0, 0, 0, 0.45)'
}
for (const [n, tam, lh, peso] of ESCALA) {
  REFERENCIA[`t-${n}`] = tam
  REFERENCIA[`t-${n}-lh`] = lh
  REFERENCIA[`t-${n}-peso`] = peso
}

function valorDe(token: string): string | undefined {
  const m = new RegExp(`--${token}:\\s*([^;]+);`).exec(css)
  return m?.[1]?.trim()
}

describe('tokens.css', () => {
  it.each(Object.entries(REFERENCIA))('define --%s con el valor de la spec', (token, valor) => {
    expect(valorDe(token)).toBe(valor)
  })

  it('declara la pila de respaldo de la fuente de interfaz', () => {
    expect(valorDe('fuente-interfaz')).toBe("'Atkinson Hyperlegible Next', system-ui, sans-serif")
  })
})
