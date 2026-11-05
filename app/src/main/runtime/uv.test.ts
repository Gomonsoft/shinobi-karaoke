import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { clasificarStderr, entornoUv, resolverUv } from './uv'

const fixture = (n: string): string =>
  readFileSync(join(__dirname, '__fixtures__/uv-stderr', n), 'utf8')

describe('clasificarStderr', () => {
  it.each([
    ['dns.txt', 'SIN_CONEXION'],
    ['conexion-rechazada.txt', 'SIN_CONEXION'],
    ['python-sin-dns.txt', 'SIN_CONEXION'],
    ['sin-espacio-posix.txt', 'SIN_ESPACIO'],
    ['sin-espacio-windows.txt', 'SIN_ESPACIO'],
    ['http-503.txt', 'SERVICIO_NO_DISPONIBLE'],
    ['http-429.txt', 'SERVICIO_NO_DISPONIBLE'],
    ['timeout.txt', 'SERVICIO_NO_DISPONIBLE'],
    ['hash.txt', 'VERIFICACION_FALLIDA'],
    ['desconocido.txt', 'ERROR_INTERNO']
  ])('%s -> %s', (archivo, codigo) => {
    expect(clasificarStderr(fixture(archivo))).toBe(codigo)
  })

  it('cubre todos los fixtures', () => {
    expect(readdirSync(join(__dirname, '__fixtures__/uv-stderr')).length).toBe(10)
  })
})

describe('entornoUv', () => {
  it('aísla uv del entorno del usuario', () => {
    const env = entornoUv('/d/runtime', {
      PATH: '/bin',
      HOME: '/h',
      VIRTUAL_ENV: '/v',
      PYTHONPATH: '/p',
      UV_INDEX_URL: 'http://malo',
      uv_python: 'x'
    })
    expect(env).toMatchObject({
      PATH: '/bin',
      HOME: '/h',
      UV_PYTHON_PREFERENCE: 'only-managed',
      UV_NO_PROGRESS: '1'
    })
    expect(env.UV_CACHE_DIR).toBe(join('/d/runtime', 'cache-uv'))
    expect(env.UV_PYTHON_INSTALL_DIR).toBe(join('/d/runtime', 'python'))
    expect(env.VIRTUAL_ENV).toBeUndefined()
    expect(env.PYTHONPATH).toBeUndefined()
    expect(env.UV_INDEX_URL).toBeUndefined()
    expect(env.uv_python).toBeUndefined()
  })
})

describe('resolverUv', () => {
  it('empaquetada: resources/bin/uv[.exe], ignorando SHINOBI_UV', () => {
    const base = { empaquetada: true, dirRecursos: '/r', env: { SHINOBI_UV: '/otro/uv' } }
    expect(resolverUv({ ...base, plataforma: 'darwin' })).toBe(join('/r', 'bin', 'uv'))
    expect(resolverUv({ ...base, plataforma: 'win32' })).toBe(join('/r', 'bin', 'uv.exe'))
  })

  it('sin empaquetar: SHINOBI_UV o uv del PATH', () => {
    const base = { empaquetada: false, dirRecursos: '/r', plataforma: 'linux' as const }
    expect(resolverUv({ ...base, env: { SHINOBI_UV: '/x/uv' } })).toBe('/x/uv')
    expect(resolverUv({ ...base, env: {} })).toBe('uv')
    expect(resolverUv({ ...base, env: { SHINOBI_UV: '' } })).toBe('uv')
  })
})
