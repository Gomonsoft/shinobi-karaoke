import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lanzadorDeApp } from './lanzadorApp'

const base = {
  dirRecursos: '/app/resources',
  raizRepo: '/repo',
  datos: '/d',
  plataforma: 'linux' as const
}

describe('lanzadorDeApp', () => {
  it('sin empaquetar: modo desarrollo (uv run), también en E2E', () => {
    const r = lanzadorDeApp({ ...base, empaquetada: false, env: {} })
    expect(r.modo).toBe('desarrollo')
    expect(r.lanzador.comando).toBe('uv')
    expect(r.lanzador.argsBase).toContain(join('/repo', 'worker'))
  })

  it('empaquetada: intérprete del venv, PYTHONPATH a resources/worker y PATH', () => {
    const r = lanzadorDeApp({ ...base, empaquetada: true, env: { PATH: '/usr/bin' } })
    expect(r.modo).toBe('produccion')
    expect(r.lanzador.comando).toBe(join('/d', 'runtime', 'venv', 'bin', 'python'))
    expect(r.lanzador.env).toEqual({
      PYTHONPATH: join('/app/resources', 'worker'),
      PYTHONDONTWRITEBYTECODE: '1',
      PATH: '/d/runtime/venv/bin:/usr/bin'
    })
  })

  it('SHINOBI_LANZADOR=produccion sin empaquetar usa el código del repo', () => {
    const r = lanzadorDeApp({
      ...base,
      empaquetada: false,
      env: { SHINOBI_LANZADOR: 'produccion' }
    })
    expect(r.modo).toBe('produccion')
    expect(r.lanzador.env?.PYTHONPATH).toBe(join('/repo', 'worker'))
  })

  it('SHINOBI_LANZADOR no cambia nada empaquetada (ya es producción) ni otros valores', () => {
    expect(
      lanzadorDeApp({ ...base, empaquetada: false, env: { SHINOBI_LANZADOR: 'x' } }).modo
    ).toBe('desarrollo')
    const e = lanzadorDeApp({
      ...base,
      empaquetada: true,
      env: { SHINOBI_LANZADOR: 'desarrollo' }
    })
    expect(e.modo).toBe('produccion')
    expect(e.lanzador.env?.PYTHONPATH).toBe(join('/app/resources', 'worker'))
    expect(e.lanzador.env?.PYTHONDONTWRITEBYTECODE).toBe('1')
  })
})
