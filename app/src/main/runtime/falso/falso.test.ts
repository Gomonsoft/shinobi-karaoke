import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { manifiestoSchema } from '../../../shared'
import { ErrorRuntime } from '../uv'
import { crearDoblesRuntime } from './dobles'
import {
  cargarEscenarioFalso,
  contenidoDiminuto,
  manifiestoParaEscenario,
  parsearEscenario
} from './escenario'

const manifiesto = manifiestoSchema.parse(
  JSON.parse(readFileSync(join(__dirname, '../../../../resources/runtime-manifest.json'), 'utf8'))
)

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'shinobi-falso-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('escenario del runtime falso', () => {
  it('aplica valores por defecto y rechaza claves o valores no válidos', () => {
    const e = parsearEscenario({})
    expect(e).toMatchObject({ plataforma: 'linux-x64', gpu: null, modelos: 'reales', fallo: null })
    expect(() => parsearEscenario({ otra: 1 })).toThrow()
    expect(() => parsearEscenario({ plataforma: 'beos' })).toThrow()
    expect(() => parsearEscenario({ fallo: { fase: 'motor', codigo: 'NO_EXISTE' } })).toThrow()
  })

  it('se ignora empaquetada y sin variable', () => {
    const ruta = join(dir, 'e.json')
    writeFileSync(ruta, '{}')
    expect(
      cargarEscenarioFalso({ env: { SHINOBI_RUNTIME_FALSO: ruta }, empaquetada: true })
    ).toBeNull()
    expect(cargarEscenarioFalso({ env: {}, empaquetada: false })).toBeNull()
    expect(
      cargarEscenarioFalso({ env: { SHINOBI_RUNTIME_FALSO: ruta }, empaquetada: false })?.ruta
    ).toBe(ruta)
  })

  it('modelos diminutos: tamaño y SHA coherentes con el contenido', () => {
    const m = manifiestoParaEscenario(manifiesto, { modelos: 'diminutos' })
    expect(m.modelos.every((x) => x.bytes === 2048 && x.extra.every((e) => e.bytes === 2048))).toBe(
      true
    )
    expect(m.modelos.find((x) => x.id === 'calidad')!.extra).toHaveLength(1)
    const e = m.modelos.find((x) => x.id === 'calidad')!.extra[0]!
    expect(e.sha256).toBe(createHash('sha256').update(contenidoDiminuto(e.archivo)).digest('hex'))
    expect(manifiestoParaEscenario(manifiesto, { modelos: 'reales' })).toBe(manifiesto)
    expect(contenidoDiminuto('a.bin').equals(contenidoDiminuto('a.bin'))).toBe(true)
    expect(contenidoDiminuto('a.bin').equals(contenidoDiminuto('b.bin'))).toBe(false)
  })
})

describe('dobles del runtime', () => {
  function crear(sobre: Record<string, unknown> = {}, mod = manifiesto) {
    const ruta = join(dir, 'esc.json')
    const escenario = parsearEscenario({
      fases: {
        motor: { ms: 10 },
        componentes: { ms: 10 },
        diagnostico: { ms: 0 },
        modelo: { ms: 10 }
      },
      ...sobre
    })
    return crearDoblesRuntime({
      escenario,
      rutaEscenario: ruta,
      manifiesto: mod,
      plataformaSO: 'linux'
    })
  }
  const env = (): Record<string, string> => ({
    UV_CACHE_DIR: join(dir, 'runtime', 'cache-uv'),
    UV_PYTHON_INSTALL_DIR: join(dir, 'runtime', 'python')
  })
  const llamadas = (): string[] =>
    readFileSync(join(dir, 'llamadas.jsonl'), 'utf8').trim().split('\n')

  it('uv falso crea python, venv y archivos dispersos con los bytes del manifiesto, y anota llamadas', async () => {
    const d = crear()
    await d.ejecutorUv.ejecutar(['--no-config', 'python', 'install', 'x'], { env: env() })
    const bytes = manifiesto.python.bytes_descarga['linux-x64'] ?? 0
    expect(statSync(join(dir, 'runtime', 'python', 'cpython', 'bin', 'python')).size).toBe(bytes)
    const r = await d.ejecutorUv.ejecutar(['--no-config', 'python', 'find', 'x'], { env: env() })
    expect(r.stdout.trim()).toContain('python')
    await d.ejecutorUv.ejecutar(
      ['--no-config', 'venv', '--python', 'p', join(dir, 'runtime', 'venv')],
      {
        env: env()
      }
    )
    expect(existsSync(join(dir, 'runtime', 'venv', 'bin', 'python'))).toBe(true)
    expect(llamadas()).toEqual([
      '{"t":"uv","args":"python install"}',
      '{"t":"uv","args":"python find"}',
      '{"t":"uv","args":"venv --python"}'
    ])
  })

  it('el fallo ocurre `veces` veces y luego pasa; "siempre" no cede', async () => {
    const una = crear({ fallo: { fase: 'componentes', codigo: 'SIN_CONEXION', veces: 1 } })
    const args = ['--no-config', 'pip', 'install']
    await expect(una.ejecutorUv.ejecutar(args, { env: env() })).rejects.toMatchObject({
      codigo: 'SIN_CONEXION'
    })
    await expect(una.ejecutorUv.ejecutar(args, { env: env() })).resolves.toMatchObject({
      codigo: 0
    })
    const siempre = crear({
      fallo: { fase: 'diagnostico', codigo: 'ERROR_INTERNO', veces: 'siempre' }
    })
    for (let i = 0; i < 3; i++) {
      await expect(
        siempre.diagnosticador.diagnosticar({
          perfilPrevisto: 'cpu',
          interprete: 'p',
          rutaCodigoWorker: 'w'
        })
      ).rejects.toBeInstanceOf(ErrorRuntime)
    }
  })

  it('cancelar la señal interrumpe uv con cancelado', async () => {
    const d = crear({ fases: { motor: { ms: 5000 } } })
    const c = new AbortController()
    const p = d.ejecutorUv.ejecutar(['python', 'install', 'x'], { env: env(), señal: c.signal })
    setTimeout(() => c.abort(), 30)
    expect(await p).toMatchObject({ cancelado: true })
  })

  it('diagnóstico: perfil previsto por defecto o rebaja del escenario', async () => {
    const gpu = { nombre: 'NVIDIA', vramMb: 4096 }
    const base = { interprete: 'p', rutaCodigoWorker: 'w', perfilPrevisto: 'cuda' as const }
    expect((await crear({ gpu }).diagnosticador.diagnosticar(base)).perfil).toBe('cuda')
    const rebaja = await crear({
      gpu,
      diagnostico: { perfil: 'cpu', motivoRebaja: 'memoria' }
    }).diagnosticador.diagnosticar(base)
    expect(rebaja).toMatchObject({ perfil: 'cpu', motivo_rebaja: 'memoria', gpu: 'NVIDIA' })
  })

  it('descarga: archivo con el tamaño del modelo (disperso) y progreso hasta el total', async () => {
    const modelo = manifiesto.modelos.find((m) => m.id === 'rapido')!
    const d = crear()
    const dirModelos = join(dir, 'modelos')
    const bytes: number[] = []
    await d.descargador.descargar(modelo, { dirModelos, alProgreso: (p) => bytes.push(p.bytes) })
    expect(statSync(join(dirModelos, modelo.archivo)).size).toBe(modelo.bytes)
    expect(bytes[bytes.length - 1]).toBe(
      modelo.bytes + modelo.extra.reduce((a, e) => a + e.bytes, 0)
    )
    expect(bytes).toEqual([...bytes].sort((a, b) => a - b))
  })

  it('espacio libre: número fijo o leído de un archivo en cada llamada', async () => {
    expect(await crear({ espacioLibre: 123 }).espacio.bytesLibres('x')).toBe(123)
    const d = crear({ espacioLibre: { desdeArchivo: 'libre.txt' } })
    writeFileSync(join(dir, 'libre.txt'), '10')
    expect(await d.espacio.bytesLibres('x')).toBe(10)
    writeFileSync(join(dir, 'libre.txt'), '20\n')
    expect(await d.espacio.bytesLibres('x')).toBe(20)
  })

  it('entorno y GPU siguen la plataforma del escenario', async () => {
    const d = crear({ plataforma: 'darwin-arm64' })
    expect(d.entorno).toMatchObject({ platform: 'darwin', arch: 'arm64' })
    expect(await d.detectorGpu.detectar()).toBeNull()
  })
})
