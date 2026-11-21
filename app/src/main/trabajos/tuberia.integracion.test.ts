import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { crearClienteWorker } from './worker'

/** Python mínimo que cuenta los bytes de stdin y los devuelve como `resultado`. Se omite sin python3. */
function buscarPython(): string | undefined {
  for (const c of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
    try {
      execFileSync(c, ['--version'], { stdio: 'ignore' })
      return c
    } catch {
      // siguiente candidato
    }
  }
  return undefined
}
const python = buscarPython()

describe.skipIf(!python)('cliente del worker con entrada por tubería', () => {
  let dir: string
  let script: string
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'shinobi-tuberia-'))
    script = join(dir, 'cuenta.py')
    writeFileSync(
      script,
      [
        'import json, sys',
        'n = len(sys.stdin.buffer.read())',
        'print(json.dumps({"tipo": "resultado", "datos": {"bytes": n}}), flush=True)'
      ].join('\n')
    )
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('el worker recibe los bytes escritos en stdin (y acepta prioridad baja)', async () => {
    const cliente = crearClienteWorker({ lanzador: { comando: python!, argsBase: [script] } })
    const r = await cliente.ejecutar(
      'cuenta',
      {},
      {
        entrada: 'tuberia',
        prioridad: 'baja',
        alEntrada: (stdin) => {
          stdin.write(Buffer.alloc(1000, 1))
          stdin.write(Buffer.alloc(234, 2))
          stdin.end()
        }
      }
    )
    expect(r).toEqual({ bytes: 1234 })
  }, 30_000)
})
