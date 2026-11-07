import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { manifiestoSchema } from '../../shared'
import { ServicioConfig } from '../configuracion'
import { calcularRequisitosPrevios } from './deteccion'
import { crearGestorRuntime, medidorReal } from './gestor'
import { crearEjecutorUv, entornoUv } from './uv'

/** uv falso: un script Node que registra argumentos y entorno y escribe los archivos que haría uv. */
const GUION = String.raw`
const fs = require('node:fs'), path = require('node:path')
const args = process.argv.slice(2)
const env = process.env
fs.appendFileSync(env.FALSO_LOG, JSON.stringify({ args, env: { UV_CACHE_DIR: env.UV_CACHE_DIR, UV_PYTHON_INSTALL_DIR: env.UV_PYTHON_INSTALL_DIR, UV_PYTHON_PREFERENCE: env.UV_PYTHON_PREFERENCE, VIRTUAL_ENV: env.VIRTUAL_ENV, PYTHONPATH: env.PYTHONPATH, UV_INDEX_URL: env.UV_INDEX_URL, UV_NO_PROGRESS: env.UV_NO_PROGRESS } }) + '\n')
const [, a, b] = args
if (a === 'python' && b === 'install') {
  fs.mkdirSync(env.UV_PYTHON_INSTALL_DIR, { recursive: true })
  fs.writeFileSync(path.join(env.UV_PYTHON_INSTALL_DIR, 'py'), 'x')
} else if (a === 'python' && b === 'find') {
  console.log(path.join(env.UV_PYTHON_INSTALL_DIR, 'py'))
} else if (a === 'venv') {
  const venv = args[args.length - 1]
  const py = process.platform === 'win32' ? path.join(venv, 'Scripts', 'python.exe') : path.join(venv, 'bin', 'python')
  fs.mkdirSync(path.dirname(py), { recursive: true }); fs.writeFileSync(py, '')
} else if (a === 'pip') {
  fs.mkdirSync(env.UV_CACHE_DIR, { recursive: true }); fs.writeFileSync(path.join(env.UV_CACHE_DIR, 'w'), 'x')
} else if (a === 'cache') {
  fs.rmSync(env.UV_CACHE_DIR, { recursive: true, force: true })
}
`

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'shinobi-uvfalso-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const manifiesto = manifiestoSchema.parse(
  JSON.parse(readFileSync(join(__dirname, '../../../resources/runtime-manifest.json'), 'utf8'))
)

async function instalar(entorno: { platform: string; arch: string; emulada: boolean }) {
  const script = join(dir, 'uv-falso.cjs')
  writeFileSync(script, GUION)
  const log = join(dir, 'llamadas.jsonl')
  writeFileSync(log, '')
  const datos = join(dir, 'datos')
  const config = await ServicioConfig.abrir(datos)
  const espacio = { bytesLibres: async () => 1e13 }
  const previos = await calcularRequisitosPrevios(
    { manifiesto, rutaDatos: datos, detectorGpu: { detectar: async () => null }, espacio },
    { ...entorno, versionSo: '15.0' }
  )
  const ejecutor = crearEjecutorUv({
    uv: process.execPath,
    argsPrevios: [script],
    dirRegistros: join(datos, 'registros'),
    envExtra: { FALSO_LOG: log }
  })
  const gestor = crearGestorRuntime({
    datos,
    manifiesto,
    config,
    deteccion: { requisitosPrevios: async () => previos },
    ejecutorUv: ejecutor,
    diagnosticador: {
      diagnosticar: async (o) => ({
        perfil: o.perfilPrevisto,
        gpu: null,
        vram_mb: null,
        motivo_rebaja: null
      })
    },
    descargador: { descargar: async () => undefined },
    medidor: medidorReal,
    espacio,
    raizRecursos: '/recursos',
    rutaCodigoWorker: '/recursos/worker',
    envBase: {
      PATH: process.env.PATH,
      VIRTUAL_ENV: '/malo',
      PYTHONPATH: '/malo',
      UV_INDEX_URL: 'http://malo'
    },
    intervaloMedicionMs: 20
  })
  const r = await gestor.instalar()
  const llamadas = readFileSync(log, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as { args: string[]; env: Record<string, string | undefined> })
  return { r, llamadas, datos, ejecutor }
}

describe('gestor con uv falso', () => {
  it('uv recibe los argumentos y el entorno exactos', async () => {
    const { r, llamadas, datos, ejecutor } = await instalar({
      platform: 'linux',
      arch: 'x64',
      emulada: false
    })
    expect(r).toEqual({ estado: 'completa' })
    expect(llamadas.map((l) => l.args.slice(0, 3))).toEqual([
      ['--no-config', 'python', 'install'],
      ['--no-config', 'python', 'find'],
      ['--no-config', 'venv', '--clear'],
      ['--no-config', 'pip', 'install'],
      ['--no-config', 'run', '--offline'],
      ['--no-config', 'cache', 'clean']
    ])
    expect(llamadas[0]?.args[3]).toBe('cpython-3.12.16-linux-x86_64-gnu')
    expect(llamadas[1]?.args[3]).toBe('cpython-3.12.16-linux-x86_64-gnu')
    const venv = llamadas[2]!.args
    expect(venv[3]).toBe('--python')
    expect(venv[4]).toBe(join(datos, 'runtime', 'python', 'py'))
    expect(venv[5]).toBe(join(datos, 'runtime', 'venv'))
    expect(llamadas[3]!.args.slice(3, 10)).toEqual([
      '--python',
      process.platform === 'win32'
        ? join(datos, 'runtime', 'venv', 'Scripts', 'python.exe')
        : join(datos, 'runtime', 'venv', 'bin', 'python'),
      '--require-hashes',
      '--excludes',
      join('/recursos/worker', 'requisitos', 'exclusiones.txt'),
      '--index-strategy',
      'unsafe-best-match'
    ])
    const esperado = entornoUv(join(datos, 'runtime'), {})
    for (const l of llamadas) {
      expect(l.env).toEqual({
        UV_CACHE_DIR: esperado.UV_CACHE_DIR,
        UV_PYTHON_INSTALL_DIR: esperado.UV_PYTHON_INSTALL_DIR,
        UV_PYTHON_PREFERENCE: 'only-managed',
        UV_NO_PROGRESS: '1'
      })
    }
    expect(ejecutor.ultimasLineas().length).toBeGreaterThan(0)
    expect(readFileSync(join(datos, 'registros', readdirLog(datos)), 'utf8')).toContain(
      'uv --no-config python install'
    )
  })

  it('simulando Rosetta pide Python aarch64', async () => {
    const { llamadas } = await instalar({ platform: 'darwin', arch: 'x64', emulada: true })
    expect(llamadas[0]?.args[3]).toBe('cpython-3.12.16-macos-aarch64-none')
  })
})

import { readdirSync } from 'node:fs'
function readdirLog(datos: string): string {
  return readdirSync(join(datos, 'registros')).find((n) => n.startsWith('runtime-')) as string
}
