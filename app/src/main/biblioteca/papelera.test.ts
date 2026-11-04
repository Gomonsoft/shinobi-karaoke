import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shellConPapeleraDePruebas, VARIABLE_PAPELERA_PRUEBAS } from './papelera'

let base: string
let carpeta: string
const real = () => ({
  trashItem: vi.fn(async () => undefined),
  openPath: vi.fn(async () => '')
})

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'shinobi-papelera-'))
  carpeta = join(base, 'biblioteca', 'abc')
  mkdirSync(carpeta, { recursive: true })
  writeFileSync(join(carpeta, 'cancion.json'), '{}')
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('shellConPapeleraDePruebas', () => {
  it('sin variable devuelve el shell tal cual', () => {
    const s = real()
    expect(shellConPapeleraDePruebas(s, { env: {}, empaquetada: false })).toBe(s)
  })

  it('con ruta mueve la carpeta a <ruta>/<nombre>-<marca> sin llamar al trashItem real', async () => {
    const s = real()
    const papelera = join(base, 'papelera')
    const r = shellConPapeleraDePruebas(s, {
      env: { [VARIABLE_PAPELERA_PRUEBAS]: papelera },
      empaquetada: false,
      ahora: () => 123
    })
    await r.trashItem(carpeta)
    expect(existsSync(carpeta)).toBe(false)
    expect(readFileSync(join(papelera, 'abc-123', 'cancion.json'), 'utf8')).toBe('{}')
    expect(s.trashItem).not.toHaveBeenCalled()
    await r.openPath('x')
    expect(s.openPath).toHaveBeenCalledWith('x')
  })

  it('con "fallar" rechaza y no toca la carpeta', async () => {
    const s = real()
    const r = shellConPapeleraDePruebas(s, {
      env: { [VARIABLE_PAPELERA_PRUEBAS]: 'fallar' },
      empaquetada: false
    })
    await expect(r.trashItem(carpeta)).rejects.toThrow()
    expect(existsSync(carpeta)).toBe(true)
    expect(s.trashItem).not.toHaveBeenCalled()
  })

  it('se ignora si la app está empaquetada', () => {
    const s = real()
    const env = { [VARIABLE_PAPELERA_PRUEBAS]: 'fallar' }
    expect(shellConPapeleraDePruebas(s, { env, empaquetada: true })).toBe(s)
  })
})
