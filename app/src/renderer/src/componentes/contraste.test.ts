/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(import.meta.dirname, '../estilos/tokens.css'), 'utf8')
const token = (n: string) => {
  const m = css.match(new RegExp(`--${n}:\\s*(#[0-9a-f]{6})`, 'i'))
  if (!m) throw new Error(`Token ${n} sin valor hexadecimal`)
  return m[1]!
}

function luminancia(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contraste(a: string, b: string) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

// [texto, fondo, ratio de docs/ux/sistema-visual.md §2/§6]
const PARES: [string, string, number][] = [
  ['texto-sobre-acento', 'acento', 5.33],
  ['texto-sobre-acento', 'acento-hover', 4.91],
  ['texto-sobre-acento', 'acento-pulsado', 6.14],
  ['texto-1', 'fondo-3', 12.3],
  ['texto-2', 'fondo-0', 8.7],
  ['texto-1', 'fondo-0', 17.3],
  ['texto-2', 'fondo-3', 6.2],
  ['texto-3', 'fondo-2', 5.4],
  ['exito', 'exito-tenue', 8.96],
  ['aviso', 'aviso-tenue', 8.67],
  ['error', 'error-tenue', 6.56],
  ['info', 'info-tenue', 7.74],
  ['acento-texto', 'fondo-1', 6.4],
  ['foco', 'fondo-1', 11.8],
  ['borde-control', 'fondo-2', 3.63],
  ['borde-control', 'fondo-3', 3.14]
]

describe('contraste de las variantes (valores de la spec)', () => {
  it.each(PARES)('%s sobre %s ≈ %s:1', (t, f, esperado) => {
    const real = contraste(token(t), token(f))
    expect(Math.abs(real - esperado)).toBeLessThan(0.06)
  })
  it('el texto de botones e insignias cumple AA (4,5:1)', () => {
    const extra: [string, string, number][] = [['texto-1', 'fondo-3-hover', 0]]
    for (const [t, f] of [...PARES, ...extra].filter(([t]) => !/borde|foco/.test(t))) {
      expect(contraste(token(t), token(f)), `${t}/${f}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
