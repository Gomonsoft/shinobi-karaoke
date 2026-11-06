import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, win32 } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clavePlataforma, descargarUv, esVersionEsperada } from './descargar-uv.mjs'

const manifiestoReal = JSON.parse(
  readFileSync(new URL('./uv-binarios.json', import.meta.url), 'utf8')
) as {
  version: string
  binarios: Record<string, { archivo: string; sha256: string }>
}

let raizApp: string
const bytesArchivo = Buffer.from('archivo uv de prueba')
const hashArchivo = createHash('sha256').update(bytesArchivo).digest('hex')

beforeEach(() => {
  raizApp = mkdtempSync(join(tmpdir(), 'shinobi-descargar-uv-'))
})

afterEach(() => rmSync(raizApp, { recursive: true, force: true }))

function manifiestoDePrueba(hash = hashArchivo) {
  const binarioDarwin = manifiestoReal.binarios['darwin-arm64']!
  return {
    ...manifiestoReal,
    binarios: {
      ...manifiestoReal.binarios,
      'darwin-arm64': {
        ...binarioDarwin,
        sha256: hash
      }
    }
  }
}

function prepararDescarga() {
  const fetchImpl = vi.fn(async () => new Response(bytesArchivo))
  const extraer = vi.fn((_archivo: string, destino: string, rutaInterna: string) => {
    const ejecutable = join(destino, rutaInterna)
    mkdirSync(dirname(ejecutable), { recursive: true })
    writeFileSync(ejecutable, 'binario uv simulado')
  })
  const ejecutarComando = vi.fn((ruta: string) => {
    if (ruta.includes(join('resources', 'bin')) && !existsSync(ruta)) {
      throw new Error('binario no instalado')
    }
    return 'uv ' + manifiestoReal.version
  })
  return { fetchImpl, extraer, ejecutarComando }
}

describe('descargarUv', () => {
  it.each([false, ...(process.platform === 'win32' ? [true] : [])])(
    'extrae ZIP con tar de System32 (ejecución real: %s)',
    async (real) => {
      const zip = Buffer.from(
        'UEsDBBQAAAAAACNyZl2XgDt2EQAAABEAAAAgAAAAdXYteDg2XzY0LXBjLXdpbmRvd3MtbXN2Yy91di5leGViaW5hcmlvIGRlIHBydWViYVBLAQIUAxQAAAAAACNyZl2XgDt2EQAAABEAAAAgAAAAAAAAAAAAAACAAQAAAAB1di14ODZfNjQtcGMtd2luZG93cy1tc3ZjL3V2LmV4ZVBLBQYAAAAAAQABAE4AAABPAAAAAAA=',
        'base64'
      )
      const binario = manifiestoReal.binarios['win32-x64']!
      const ejecutarComando = vi.fn(
        (comando: string, argumentos: string[], opciones?: { cwd?: string }) => {
          if (
            comando === win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
          ) {
            expect(argumentos).toEqual(['-xf', binario.archivo, 'uv-x86_64-pc-windows-msvc/uv.exe'])
            expect(opciones?.cwd).toBeTruthy()
            if (real)
              return execFileSync(comando, argumentos, { cwd: opciones?.cwd, encoding: 'utf8' })
            const extraido = join(opciones!.cwd!, 'uv-x86_64-pc-windows-msvc', 'uv.exe')
            mkdirSync(dirname(extraido), { recursive: true })
            writeFileSync(extraido, 'binario de prueba')
            return ''
          }
          return comando.includes(join('resources', 'bin')) ? '' : 'uv ' + manifiestoReal.version
        }
      )
      const resultado = await descargarUv({
        plataforma: 'win32',
        arquitectura: 'x64',
        raizApp,
        manifiesto: {
          ...manifiestoReal,
          binarios: {
            ...manifiestoReal.binarios,
            'win32-x64': { ...binario, sha256: createHash('sha256').update(zip).digest('hex') }
          }
        },
        fetchImpl: async () => new Response(zip),
        ejecutarComando
      })

      expect(readFileSync(resultado.ruta, 'utf8')).toBe('binario de prueba')
      expect(
        ejecutarComando.mock.calls.filter(([comando]) => comando.endsWith('tar.exe'))
      ).toHaveLength(1)
    }
  )

  it('descarga, comprueba el SHA-256 antes de extraer, verifica versión y deja el ejecutable', async () => {
    const dobles = prepararDescarga()
    const resultado = await descargarUv({
      plataforma: 'darwin',
      arquitectura: 'arm64',
      raizApp,
      manifiesto: manifiestoDePrueba(),
      ...dobles,
      extraer: async (archivo, destino, interno) => {
        expect(createHash('sha256').update(readFileSync(archivo)).digest('hex')).toBe(hashArchivo)
        dobles.extraer(archivo, destino, interno)
      }
    })

    expect(resultado).toMatchObject({ version: manifiestoReal.version, descargado: true })
    expect(dobles.fetchImpl).toHaveBeenCalledWith(
      'https://github.com/astral-sh/uv/releases/download/' +
        manifiestoReal.version +
        '/' +
        manifiestoReal.binarios['darwin-arm64']!.archivo
    )
    expect(dobles.extraer).toHaveBeenCalledOnce()
    expect(readFileSync(resultado.ruta, 'utf8')).toBe('binario uv simulado')
  })

  it('hash incorrecto no extrae, borra el binario de destino y falla con diagnóstico', async () => {
    const dobles = prepararDescarga()
    const destino = join(raizApp, 'resources', 'bin', 'uv')
    dobles.ejecutarComando.mockImplementation((ruta) => {
      if (ruta === destino) throw new Error('versión anterior incorrecta')
      return 'uv ' + manifiestoReal.version
    })
    mkdirSync(dirname(destino), { recursive: true })
    writeFileSync(destino, 'binario anterior')

    await expect(
      descargarUv({
        plataforma: 'darwin',
        arquitectura: 'arm64',
        raizApp,
        manifiesto: manifiestoDePrueba('0'.repeat(64)),
        ...dobles
      })
    ).rejects.toThrow('SHA-256 incorrecto')

    expect(dobles.extraer).not.toHaveBeenCalled()
    expect(existsSync(destino)).toBe(false)
  })

  it('rechaza el ZIP de Windows antes de invocar tar si el SHA-256 no coincide', async () => {
    const ejecutarComando = vi.fn<(comando: string) => string>(() => '')
    const binario = manifiestoReal.binarios['win32-x64']!
    await expect(
      descargarUv({
        plataforma: 'win32',
        arquitectura: 'x64',
        raizApp,
        manifiesto: {
          ...manifiestoReal,
          binarios: {
            ...manifiestoReal.binarios,
            'win32-x64': { ...binario, sha256: '0'.repeat(64) }
          }
        },
        fetchImpl: async () => new Response(bytesArchivo),
        ejecutarComando
      })
    ).rejects.toThrow('SHA-256 incorrecto')
    expect(ejecutarComando.mock.calls.some(([comando]) => comando.endsWith('tar.exe'))).toBe(false)
  })

  it('una plataforma sin entrada no descarga nada', async () => {
    const fetchImpl = vi.fn()

    await expect(
      descargarUv({ plataforma: 'freebsd', arquitectura: 'x64', raizApp, fetchImpl })
    ).rejects.toThrow('No hay un binario de uv configurado')

    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('si uv correcto ya existe, no vuelve a descargar', async () => {
    const destino = join(raizApp, 'resources', 'bin', 'uv')
    mkdirSync(dirname(destino), { recursive: true })
    writeFileSync(destino, 'uv instalado')
    const fetchImpl = vi.fn()
    const ejecutarComando = vi.fn(() => 'uv ' + manifiestoReal.version)

    const resultado = await descargarUv({
      plataforma: 'darwin',
      arquitectura: 'arm64',
      raizApp,
      fetchImpl,
      ejecutarComando
    })

    expect(resultado.descargado).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rechaza una versión distinta y borra el ejecutable extraído', async () => {
    const dobles = prepararDescarga()
    dobles.ejecutarComando.mockReturnValue('uv 0.0.0')
    const destino = join(raizApp, 'resources', 'bin', 'uv')

    await expect(
      descargarUv({
        plataforma: 'darwin',
        arquitectura: 'arm64',
        raizApp,
        manifiesto: manifiestoDePrueba(),
        ...dobles
      })
    ).rejects.toThrow('La versión descargada no coincide')

    expect(existsSync(destino)).toBe(false)
  })
})

describe('contrato de uv-binarios.json', () => {
  it('coincide con UV_VERSION de los workflows y fija los tres hashes', () => {
    for (const workflow of [
      '../../.github/workflows/ci.yml',
      '../../.github/workflows/runtime-real.yml'
    ]) {
      const texto = readFileSync(new URL(workflow, import.meta.url), 'utf8')
      const versionRegex = new RegExp(
        'UV_VERSION:\\s*[\'"]?' + manifiestoReal.version.replaceAll('.', '\\.') + '[\'"]?'
      )
      expect(texto).toMatch(versionRegex)
    }
    expect(Object.keys(manifiestoReal.binarios).sort()).toEqual([
      'darwin-arm64',
      'linux-x64',
      'win32-x64'
    ])
    for (const binario of Object.values(manifiestoReal.binarios)) {
      expect(binario.sha256).toMatch(/^[a-f0-9]{64}$/)
    }
  })

  it('mapea solo las tres plataformas soportadas y reconoce la versión fijada', () => {
    expect(clavePlataforma('win32', 'x64')).toBe('win32-x64')
    expect(clavePlataforma('darwin', 'arm64')).toBe('darwin-arm64')
    expect(clavePlataforma('linux', 'x64')).toBe('linux-x64')
    expect(clavePlataforma('darwin', 'x64')).toBeNull()
    expect(esVersionEsperada('uv ' + manifiestoReal.version, manifiestoReal.version)).toBe(true)
    expect(esVersionEsperada('uv 0.0.0', manifiestoReal.version)).toBe(false)
  })
})
