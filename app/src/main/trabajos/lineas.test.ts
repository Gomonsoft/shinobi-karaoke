import { describe, expect, it } from 'vitest'
import { LectorLineas } from './lineas'

describe('LectorLineas', () => {
  it('une líneas partidas entre chunks', () => {
    const l = new LectorLineas()
    expect(l.empujar('{"a":')).toEqual([])
    expect(l.empujar('1}\n')).toEqual(['{"a":1}'])
  })

  it('separa varias líneas de un chunk y descarta vacías y \\r', () => {
    const l = new LectorLineas()
    expect(l.empujar('uno\r\n\ndos\ntres')).toEqual(['uno', 'dos'])
    expect(l.terminar()).toEqual(['tres'])
    expect(l.terminar()).toEqual([])
  })

  it('reconstruye UTF-8 multibyte partido entre chunks', () => {
    const l = new LectorLineas()
    const bytes = Buffer.from('canción 日本語 🎤\n', 'utf8')
    const salida: string[] = []
    for (let i = 0; i < bytes.length; i++) salida.push(...l.empujar(bytes.subarray(i, i + 1)))
    expect(salida).toEqual(['canción 日本語 🎤'])
  })
})
