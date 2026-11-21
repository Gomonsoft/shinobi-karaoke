import { describe, expect, it } from 'vitest'
import { hashCorto, identificador, lineaVersion, numeroVisible } from './compilacion'

const SHA = '3f9c2a1' + 'b'.repeat(33)
const V = '0.2.0-alpha.2'

describe('compilacion', () => {
  it('forma los cuatro casos de aj.compilacion.id', () => {
    expect(identificador(V, { canal: 'publicada', numero: 1234, commit: SHA })).toBe(
      '0.2.0-alpha.2-1234 (publicada, commit 3f9c2a1)'
    )
    expect(identificador(V, { canal: 'local', numero: null, commit: SHA })).toBe(
      '0.2.0-alpha.2 (local, sin número, commit 3f9c2a1)'
    )
    expect(identificador(V, { canal: 'local', numero: null, commit: null })).toBe(
      '0.2.0-alpha.2 (local, sin número, sin commit)'
    )
    expect(identificador(V, { canal: 'desarrollo', numero: 1260, commit: null })).toBe(
      '0.2.0-alpha.2-1260 (desarrollo, sin commit)'
    )
  })

  it('la línea de versión y el número visible', () => {
    const c = { canal: 'desarrollo', numero: 1260, commit: '9e07c55' + 'a'.repeat(33) } as const
    expect(lineaVersion('0.2.0-alpha.3', c)).toBe(
      'Versión: 0.2.0-alpha.3-1260 (desarrollo, commit 9e07c55)'
    )
    expect(numeroVisible(V, { canal: 'local', numero: null, commit: null })).toBe(V)
    expect(numeroVisible(V, { canal: 'publicada', numero: null, commit: null })).toBe(V)
    expect(hashCorto({ canal: 'local', numero: null, commit: null })).toBeNull()
  })

  it('nunca produce undefined, null ni NaN', () => {
    for (const canal of ['publicada', 'desarrollo', 'local'] as const) {
      for (const numero of [null, 7]) {
        for (const commit of [null, '', SHA]) {
          const t = lineaVersion(V, { canal, numero, commit })
          expect(t).not.toMatch(/undefined|null|NaN|-\)|-$/)
        }
      }
    }
  })
})
