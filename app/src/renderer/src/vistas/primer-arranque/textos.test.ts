import { expect, it } from 'vitest'
import textos from './textos.ts?raw'

it('los textos de primer arranque no usan caracteres del área de uso privado', () => {
  // Incluye los literales dentro de funciones y objetos, además de las cadenas estáticas.
  expect(textos).not.toMatch(/[\uE000-\uF8FF]/u)
})
