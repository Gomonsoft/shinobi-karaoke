import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { crearClienteWorker, resolverLanzador } from './worker'

/**
 * Lanzador de producción con un venv real (`uv venv`) y `PYTHONPATH` al worker del repo:
 * ejecuta `demo` en los 3 SO (0035; cubre "sin probar en Windows" de 0013). Se omite sin uv.
 */
const raizRepo = resolve(__dirname, '..', '..', '..', '..')
const uv = process.env.SHINOBI_UV ?? 'uv'
function hayUv(): boolean {
  try {
    execFileSync(uv, ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

describe.skipIf(!hayUv())('resolverLanzador en producción con un venv real', () => {
  let datos: string
  beforeAll(() => {
    datos = mkdtempSync(join(tmpdir(), 'shinobi-lanzador-'))
    execFileSync(uv, ['venv', '--no-config', join(datos, 'runtime', 'venv')], {
      stdio: 'ignore'
    })
  }, 120_000)
  afterAll(() => rmSync(datos, { recursive: true, force: true }))

  it('ejecuta `demo` con el intérprete del venv y el código del worker por PYTHONPATH', async () => {
    const lanzador = resolverLanzador({
      modo: 'produccion',
      datos,
      plataforma: process.platform,
      rutaCodigoWorker: join(raizRepo, 'worker'),
      envBase: process.env
    })
    const progresos: number[] = []
    const cliente = crearClienteWorker({ lanzador })
    const r = await cliente.ejecutar(
      'demo',
      { segundos: 0.3 },
      { alProgreso: (m) => progresos.push(m.valor ?? 0) }
    )
    expect(r).toBeTruthy()
    expect(progresos.length).toBeGreaterThan(0)
  }, 60_000)
})
