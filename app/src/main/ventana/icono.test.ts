import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rutaIcono } from './icono'

const base = { dirApp: '/app', dirRecursos: '/res' }

describe('rutaIcono', () => {
  it('sin empaquetar usa build/icon.png en cualquier sistema', () => {
    for (const plataforma of ['win32', 'darwin', 'linux'] as const) {
      expect(rutaIcono({ ...base, empaquetada: false, plataforma })).toBe(
        join('/app', 'build', 'icon.png')
      )
    }
  })

  it('empaquetada solo Linux lleva icon.png en resources', () => {
    expect(rutaIcono({ ...base, empaquetada: true, plataforma: 'linux' })).toBe(
      join('/res', 'icon.png')
    )
    expect(rutaIcono({ ...base, empaquetada: true, plataforma: 'win32' })).toBeUndefined()
    expect(rutaIcono({ ...base, empaquetada: true, plataforma: 'darwin' })).toBeUndefined()
  })
})
