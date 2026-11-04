import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ColaLineas, MAX_ARCHIVOS_REGISTRO, RegistroWorker } from './registro'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'shinobi-reg-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('RegistroWorker', () => {
  it('escribe en worker-<fecha>.log creando el directorio', () => {
    const r = new RegistroWorker(join(dir, 'registros'), () => new Date(2026, 10, 4, 12))
    r.escribir('hola')
    const contenido = readFileSync(join(dir, 'registros', 'worker-2026-11-04.log'), 'utf8')
    expect(contenido).toMatch(/ hola\n$/)
  })

  it('conserva como mucho los últimos días', () => {
    for (let d = 1; d <= 10; d++) {
      writeFileSync(join(dir, `worker-2026-10-${String(d).padStart(2, '0')}.log`), 'x')
    }
    new RegistroWorker(dir, () => new Date(2026, 10, 4)).escribir('x')
    const nombres = readdirSync(dir).sort()
    expect(nombres.length).toBe(MAX_ARCHIVOS_REGISTRO)
    expect(nombres).toContain('worker-2026-11-04.log')
    expect(nombres).not.toContain('worker-2026-10-01.log')
  })

  it('no lanza si el directorio no se puede crear', () => {
    const archivo = join(dir, 'f')
    writeFileSync(archivo, '')
    expect(() => new RegistroWorker(join(archivo, 'sub')).escribir('x')).not.toThrow()
  })
})

describe('ColaLineas', () => {
  it('guarda solo las últimas N', () => {
    const c = new ColaLineas(3)
    for (const l of ['1', '2', '3', '4', '5']) c.añadir(l)
    expect(c.texto()).toBe('3\n4\n5')
  })
})
