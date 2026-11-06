import { createHash } from 'node:crypto'
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { verificarPaquete } from './verificar-paquete.mjs'

const FUSES_OK = {
  version: '1',
  '0': 48,
  '1': 48,
  '2': 48,
  '3': 48,
  '4': 49,
  '5': 49,
  '6': 48,
  '7': 48,
  '8': 49
}
const ENTRADAS_ASAR = [
  '/package.json',
  '/out/main/index.js',
  '/out/preload/index.js',
  '/out/renderer/index.html',
  '/node_modules/yaml/index.js',
  '/node_modules/zod/index.js'
]

describe('verificar-paquete', () => {
  let temporal: string
  let recursos: string
  let listaAsar: string[]
  let fuses: Record<string, number | string>

  beforeEach(() => {
    temporal = mkdtempSync(join(tmpdir(), 'shinobi-paquete-'))
    recursos = join(temporal, 'resources')
    listaAsar = [...ENTRADAS_ASAR]
    fuses = { ...FUSES_OK }
    const escribir = (ruta: string, texto = 'fixture') => {
      const destino = join(recursos, ruta)
      mkdirSync(join(destino, '..'), { recursive: true })
      writeFileSync(destino, texto)
    }

    escribir('app.asar')
    escribir('runtime-manifest.json', '')
    escribir('LICENSE')
    escribir('THIRD_PARTY_NOTICES.md')
    escribir('worker/shinobi_worker/__main__.py')
    escribir('worker/pyproject.toml')
    escribir('worker/uv.lock')
    escribir('worker/requisitos/exclusiones.txt', 'diffq\ndiffq-fixed\n')
    const requisitos = 'paquete inventado==1.0\n'
    const hash = createHash('sha256').update(requisitos).digest('hex')
    escribir('worker/requisitos/linux-x64-cpu.txt', requisitos)
    writeFileSync(
      join(recursos, 'runtime-manifest.json'),
      JSON.stringify({
        runtime: {
          'linux-x64': {
            cpu: { requisitos: 'worker/requisitos/linux-x64-cpu.txt', sha256_requisitos: hash }
          }
        }
      })
    )
    escribir('fonts/Atkinson/OFL.txt')
    escribir('fonts/Atkinson/Atkinson.woff2')
    escribir('bin/uv')
    chmodSync(join(recursos, 'bin/uv'), 0o755)
    escribir('apparmor-profile')
    escribir('shinobi-karaoke')
  })

  afterEach(() => rmSync(temporal, { recursive: true, force: true }))

  const verificar = () =>
    verificarPaquete({
      entrada: temporal,
      plataforma: 'linux',
      leerFuses: async () => fuses,
      listarAsar: () => listaAsar,
      ejecutar: () => 'uv 0.13.7'
    })

  it('acepta el árbol completo y devuelve un informe con tamaño, plataforma y fuses', async () => {
    const informe = await verificar()
    expect(informe.plataforma).toBe('linux')
    expect(informe.tamano_desempaquetado).toBeGreaterThan(0)
    expect(informe.fuses.OnlyLoadAppFromAsar).toBe(true)
    expect(informe.comprobaciones).toContain('uv 0.13.7')
  })

  it('falla con la ruta concreta cuando falta uv', async () => {
    rmSync(join(recursos, 'bin/uv'))
    await expect(verificar()).rejects.toThrow('resources/bin/uv')
  })

  it('falla cuando un archivo de requisitos no coincide con el SHA-256 del manifiesto', async () => {
    writeFileSync(join(recursos, 'worker/requisitos/linux-x64-cpu.txt'), 'otro contenido')
    await expect(verificar()).rejects.toThrow(
      'SHA-256 distinto en worker/requisitos/linux-x64-cpu.txt'
    )
  })

  it.each([
    'spikes',
    'tests',
    'e2e',
    'e2e-paquete',
    '.datos-dev',
    'docs',
    'src',
    '.venv',
    '__pycache__',
    'semilla',
    'scripts'
  ])('rechaza la carpeta prohibida %s en resources', async (nombre) => {
    mkdirSync(join(recursos, nombre), { recursive: true })
    await expect(verificar()).rejects.toThrow(`resources: ${nombre}`)
  })

  it('rechaza un archivo de test y una dependencia React en el asar', async () => {
    writeFileSync(join(recursos, 'worker/shinobi_worker/test_ejemplo.py'), '')
    await expect(verificar()).rejects.toThrow('test_ejemplo.py')
    rmSync(join(recursos, 'worker/shinobi_worker/test_ejemplo.py'))
    listaAsar.push('/node_modules/react/index.js')
    await expect(verificar()).rejects.toThrow('Dependencia no permitida en app.asar: react')
  })

  it('rechaza un fuse con valor incorrecto e identifica su nombre', async () => {
    fuses['0'] = 49
    await expect(verificar()).rejects.toThrow('Fuse RunAsNode')
  })

  it('rechaza un fuse futuro desconocido', async () => {
    fuses['9'] = 49
    await expect(verificar()).rejects.toThrow('Fuse desconocido')
  })

  it('rechaza dependencias transitivas fuera de zod y yaml', async () => {
    listaAsar.push('/node_modules/scheduler/index.js')
    await expect(verificar()).rejects.toThrow('Dependencia no permitida en app.asar: scheduler')
  })
})
