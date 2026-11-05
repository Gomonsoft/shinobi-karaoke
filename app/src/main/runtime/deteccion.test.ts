import { mkdtemp, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { manifiestoSchema, type Manifiesto } from '../../shared'
import {
  calcularRequisitosPrevios,
  crearDetectorGpu,
  crearEspacioLibre,
  crearServicioDeteccion,
  describirEquipo,
  detectarGpuNvidia,
  entornoReal,
  evaluarPlataforma,
  guardarPrevision,
  parsearNvidiaSmi,
  perfilPrevisto,
  motivoNoSoportada,
  plataformaActual,
  plataformaReal,
  type DetectorGpu,
  type EjecutarComando,
  type EntornoDeteccion,
  type EspacioLibre
} from './deteccion'

const manifiesto: Manifiesto = manifiestoSchema.parse(
  JSON.parse(readFileSync(join(__dirname, '../../../resources/runtime-manifest.json'), 'utf8'))
)

const nvidia1 = 'NVIDIA GeForce RTX 3060, 12288\n'
const nvidia2 = 'NVIDIA GeForce GTX 1050, 2048\nNVIDIA GeForce RTX 4090, 24564\n'

describe('macOS mínimo (preguntas/0015)', () => {
  const mac = { so: 'darwin', arquitectura: 'arm64' }
  it('macOS 13.6 no está soportado y 14.0 sí', () => {
    expect(plataformaActual(mac, manifiesto, '13.6.0')).toBeNull()
    expect(plataformaActual(mac, manifiesto, '14.0.0')).toBe('darwin-arm64')
    expect(plataformaActual(mac, manifiesto, '15.2')).toBe('darwin-arm64')
  })
  it('el motivo sigue el orden: manifiesto primero, macOS después', () => {
    const intel = { so: 'darwin', arquitectura: 'x64' }
    expect(motivoNoSoportada(intel, manifiesto, '13.6.0')).toBe('arquitectura')
    expect(motivoNoSoportada(mac, manifiesto, '13.6.0')).toBe('so_antiguo')
    expect(motivoNoSoportada(mac, manifiesto, '14.0.0')).toBeNull()
  })
  it('evaluarPlataforma devuelve plataforma, motivo y versión mínima (0036)', () => {
    const sonoma = { version: '14', nombre: 'Sonoma' }
    expect(evaluarPlataforma(mac, manifiesto, '13.6')).toEqual({
      plataforma: null,
      motivo: 'so_antiguo',
      versionMinimaSo: sonoma
    })
    expect(evaluarPlataforma(mac, manifiesto, '14.0')).toEqual({
      plataforma: 'darwin-arm64',
      motivo: null,
      versionMinimaSo: null
    })
    const arq = { plataforma: null, motivo: 'arquitectura', versionMinimaSo: null }
    const intel = { so: 'darwin', arquitectura: 'x64' }
    expect(evaluarPlataforma(intel, manifiesto, '13.6')).toEqual(arq)
    expect(evaluarPlataforma(intel, manifiesto, '15.1')).toEqual(arq)
    expect(evaluarPlataforma({ so: 'linux', arquitectura: 'arm64' }, manifiesto, '6.1')).toEqual(
      arq
    )
    expect(evaluarPlataforma({ so: 'freebsd', arquitectura: 'x64' }, manifiesto)).toEqual(arq)
    // versión ilegible en un Mac arm64: se trata como antigua
    expect(evaluarPlataforma(mac, manifiesto, 'rara').motivo).toBe('so_antiguo')
  })
  it('los requisitos previos incluyen motivo y versionMinimaSo', async () => {
    const deps = {
      manifiesto,
      rutaDatos: '/x',
      detectorGpu: { detectar: async () => null },
      espacio: { bytesLibres: async () => 1e12 }
    }
    const e = { platform: 'darwin', arch: 'arm64', emulada: false }
    const viejo = await calcularRequisitosPrevios(deps, { ...e, versionSo: '13.6.0' })
    expect([viejo.motivo, viejo.versionMinimaSo]).toEqual([
      'so_antiguo',
      { version: '14', nombre: 'Sonoma' }
    ])
    const bueno = await calcularRequisitosPrevios(deps, { ...e, versionSo: '14.0.0' })
    expect([bueno.motivo, bueno.versionMinimaSo]).toEqual([null, null])
  })
  it('no afecta a otros sistemas', () => {
    expect(plataformaActual({ so: 'linux', arquitectura: 'x64' }, manifiesto, '6.1')).toBe(
      'linux-x64'
    )
  })
  it('los requisitos previos dan perfil null en macOS 13.6 y mps en 14.0', async () => {
    const deps = {
      manifiesto,
      rutaDatos: '/x',
      detectorGpu: { detectar: async () => null },
      espacio: { bytesLibres: async () => 1e12 }
    }
    const e = { platform: 'darwin', arch: 'arm64', emulada: false }
    expect(
      (await calcularRequisitosPrevios(deps, { ...e, versionSo: '13.6.0' })).plataforma
    ).toBeNull()
    expect((await calcularRequisitosPrevios(deps, { ...e, versionSo: '14.0.0' })).perfil).toBe(
      'mps'
    )
  })
})

describe('plataformaReal y plataformaActual', () => {
  it('usa arm64 si la app va bajo traducción', () => {
    expect(plataformaReal('darwin', 'x64', true)).toEqual({ so: 'darwin', arquitectura: 'arm64' })
    expect(plataformaReal('win32', 'x64', true)).toEqual({ so: 'win32', arquitectura: 'arm64' })
    expect(plataformaReal('linux', 'x64', false)).toEqual({ so: 'linux', arquitectura: 'x64' })
  })

  it.each([
    ['darwin', 'arm64', 'darwin-arm64'],
    ['win32', 'x64', 'win32-x64'],
    ['linux', 'x64', 'linux-x64'],
    ['darwin', 'x64', null], // macOS Intel: no está en el manifiesto (preguntas/0015)
    ['win32', 'arm64', null],
    ['linux', 'arm64', null],
    ['win32', 'ia32', null],
    ['freebsd', 'x64', null]
  ])('%s/%s -> %s', (so, arq, esperado) => {
    expect(plataformaActual({ so, arquitectura: arq }, manifiesto)).toBe(esperado)
  })

  it('Mac Apple Silicon con el build x64 (Rosetta) es darwin-arm64', () => {
    const real = plataformaReal('darwin', 'x64', true)
    expect(plataformaActual(real, manifiesto)).toBe('darwin-arm64')
  })

  it('Windows on ARM con el build x64 no es compatible y se informa arm64', () => {
    const real = plataformaReal('win32', 'x64', true)
    expect(plataformaActual(real, manifiesto)).toBeNull()
    expect(describirEquipo(real, '10.0.26100').arquitectura).toBe('arm64')
  })

  it('darwin-x64 pasa a soportada si el manifiesto la incluye', () => {
    const conIntel: Manifiesto = {
      ...manifiesto,
      runtime: { ...manifiesto.runtime, 'darwin-x64': manifiesto.runtime['linux-x64'] }
    }
    expect(plataformaActual({ so: 'darwin', arquitectura: 'x64' }, conIntel)).toBe('darwin-x64')
  })
})

describe('describirEquipo', () => {
  it('traduce SO y arquitectura', () => {
    expect(describirEquipo({ so: 'darwin', arquitectura: 'arm64' }, '25.5.0')).toEqual({
      so: 'macos',
      versionSo: '25.5.0',
      arquitectura: 'arm64'
    })
    expect(describirEquipo({ so: 'sunos', arquitectura: 'ppc' }, '5')).toMatchObject({
      so: 'otro',
      arquitectura: 'otra'
    })
    expect(describirEquipo({ so: 'win32', arquitectura: 'ia32' }, '10').so).toBe('windows')
  })
})

describe('parsearNvidiaSmi', () => {
  it('una GPU', () => {
    expect(parsearNvidiaSmi(nvidia1)).toEqual({ nombre: 'NVIDIA GeForce RTX 3060', vramMb: 12288 })
  })
  it('varias GPU: la de más VRAM, con CRLF y espacios', () => {
    expect(parsearNvidiaSmi(nvidia2.replace(/\n/g, '\r\n'))?.nombre).toBe('NVIDIA GeForce RTX 4090')
    expect(parsearNvidiaSmi('  Tesla T4 ,  15360  \n')).toEqual({
      nombre: 'Tesla T4',
      vramMb: 15360
    })
  })
  it('salida vacía o ilegible', () => {
    expect(parsearNvidiaSmi('')).toBeNull()
    expect(parsearNvidiaSmi('\n\n')).toBeNull()
    expect(parsearNvidiaSmi("NVIDIA-SMI has failed because it couldn't communicate")).toBeNull()
    expect(parsearNvidiaSmi('RTX, [N/A]')).toBeNull()
  })
})

describe('detectarGpuNvidia', () => {
  const ok = (salida: string): EjecutarComando => vi.fn(async () => ({ codigo: 0, salida }))

  it('ejecuta nvidia-smi con los argumentos esperados y el plazo de 3 s', async () => {
    const ejecutar = ok(nvidia1)
    const gpu = await detectarGpuNvidia({ plataforma: 'linux', ejecutar })
    expect(gpu?.vramMb).toBe(12288)
    expect(ejecutar).toHaveBeenCalledWith(
      'nvidia-smi',
      ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'],
      3000
    )
  })
  it('código distinto de 0 → null', async () => {
    const ejecutar: EjecutarComando = async () => ({ codigo: 9, salida: nvidia1 })
    expect(await detectarGpuNvidia({ plataforma: 'linux', ejecutar })).toBeNull()
  })
  it('salida vacía → null', async () => {
    expect(await detectarGpuNvidia({ plataforma: 'linux', ejecutar: ok('') })).toBeNull()
  })
  it('sin binario o plazo vencido → null', async () => {
    const ejecutar: EjecutarComando = async () => {
      throw Object.assign(new Error('spawn nvidia-smi ENOENT'), { code: 'ENOENT' })
    }
    expect(await detectarGpuNvidia({ plataforma: 'linux', ejecutar })).toBeNull()
    const lento: EjecutarComando = () =>
      new Promise((_, rechazar) => rechazar(new Error('timeout')))
    expect(await detectarGpuNvidia({ plataforma: 'win32', ejecutar: lento, env: {} })).toBeNull()
  })
  it('Windows prueba también System32 si falta en el PATH', async () => {
    const ejecutar = vi.fn<EjecutarComando>(async (exe) => {
      if (exe === 'nvidia-smi') throw new Error('ENOENT')
      return { codigo: 0, salida: nvidia1 }
    })
    const gpu = await detectarGpuNvidia({
      plataforma: 'win32',
      env: { SystemRoot: 'C:\\Windows' },
      ejecutar
    })
    expect(gpu?.nombre).toContain('RTX 3060')
    expect(ejecutar.mock.calls[1]?.[0]).toMatch(/System32.nvidia-smi\.exe$/)
  })
  it('nunca en macOS', async () => {
    const ejecutar = ok(nvidia1)
    expect(await detectarGpuNvidia({ plataforma: 'darwin', ejecutar })).toBeNull()
    expect(ejecutar).not.toHaveBeenCalled()
  })
})

describe('perfilPrevisto', () => {
  const gpu = { nombre: 'x', vramMb: 2048 }
  it('reglas', () => {
    expect(perfilPrevisto('darwin-arm64', null)).toBe('mps')
    expect(perfilPrevisto('darwin-arm64', gpu)).toBe('mps')
    expect(perfilPrevisto('win32-x64', gpu)).toBe('cuda') // < 4 GB: lo rebajará el diagnóstico
    expect(perfilPrevisto('linux-x64', gpu)).toBe('cuda')
    expect(perfilPrevisto('win32-x64', null)).toBe('cpu')
    expect(perfilPrevisto('darwin-x64', gpu)).toBe('cpu')
    expect(perfilPrevisto(null, gpu)).toBeNull()
  })
})

describe('espacioLibre', () => {
  it('multiplica bavail por bsize', async () => {
    const e = crearEspacioLibre(async () => ({ bavail: 1000, bsize: 4096 }))
    expect(await e.bytesLibres('/datos')).toBe(4096000)
  })
  it('sube al ancestro existente más cercano', async () => {
    const consultadas: string[] = []
    const e = crearEspacioLibre(async (ruta) => {
      consultadas.push(ruta)
      if (ruta !== '/a') throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      return { bavail: 10, bsize: 512 }
    })
    expect(await e.bytesLibres('/a/b/c')).toBe(5120)
    expect(consultadas).toEqual(['/a/b/c', '/a/b', '/a'])
  })
  it('si no existe ningún ancestro propaga el error', async () => {
    const e = crearEspacioLibre(async () => {
      throw new Error('ENOENT')
    })
    await expect(e.bytesLibres('/x/y')).rejects.toThrow('ENOENT')
  })
})

describe('requisitos previos', () => {
  const espacio: EspacioLibre = { bytesLibres: async () => 50e9 }
  const gpuNvidia: DetectorGpu = { detectar: async () => ({ nombre: 'RTX', vramMb: 8192 }) }
  const sinGpu: DetectorGpu = { detectar: async () => null }
  const env = (platform: string, arch: string, emulada = false): EntornoDeteccion => ({
    platform,
    arch,
    emulada,
    versionSo: '15.0'
  })
  const calcular = (detectorGpu: DetectorGpu, e: EntornoDeteccion) =>
    calcularRequisitosPrevios({ manifiesto, rutaDatos: '/datos', detectorGpu, espacio }, e)

  it('Apple Silicon: mps, Calidad, cifras del manifiesto', async () => {
    const r = await calcular(sinGpu, env('darwin', 'arm64'))
    expect(r).toMatchObject({
      plataforma: 'darwin-arm64',
      perfil: 'mps',
      modoPrevisto: 'calidad',
      espacioRequerido: 4_000_000_000,
      espacioLibre: 50e9,
      emulada: false
    })
    expect(r.bytesDescarga).toBeGreaterThan(296_000_000)
  })
  it('Mac bajo Rosetta: darwin-arm64 y mps', async () => {
    const r = await calcular(sinGpu, env('darwin', 'x64', true))
    expect(r).toMatchObject({ plataforma: 'darwin-arm64', perfil: 'mps', emulada: true })
    expect(r.equipo.arquitectura).toBe('arm64')
  })
  it('Windows con NVIDIA: cuda, 10 GB', async () => {
    const r = await calcular(gpuNvidia, env('win32', 'x64'))
    expect(r).toMatchObject({
      perfil: 'cuda',
      modoPrevisto: 'calidad',
      espacioRequerido: 10_000_000_000,
      gpu: { nombre: 'RTX', vramMb: 8192 }
    })
  })
  it('Linux sin GPU: cpu, Rápido, 3 GB', async () => {
    const r = await calcular(sinGpu, env('linux', 'x64'))
    expect(r).toMatchObject({ perfil: 'cpu', modoPrevisto: 'rapido', espacioRequerido: 3e9 })
    expect(r.bytesDescarga).toBeGreaterThan(434_000_000)
  })
  it.each([
    ['darwin', 'x64', false],
    ['win32', 'x64', true],
    ['linux', 'arm64', false]
  ])(
    'plataforma no soportada %s/%s: sin perfil, descarga null y espacio máximo',
    async (p, a, em) => {
      const detectar = vi.fn(async () => null)
      const r = await calcularRequisitosPrevios(
        { manifiesto, rutaDatos: '/d', detectorGpu: { detectar }, espacio },
        env(p, a, em)
      )
      expect(r).toMatchObject({
        plataforma: null,
        perfil: null,
        bytesDescarga: null,
        modoPrevisto: null,
        espacioRequerido: 10_000_000_000
      })
      expect(detectar).not.toHaveBeenCalled()
    }
  )
})

describe('servicio de detección', () => {
  it('cachea la detección pero recalcula el espacio libre y guarda la previsión', async () => {
    const detectar = vi.fn(async () => ({ nombre: 'RTX 3060', vramMb: 12288 }))
    let libre = 10e9
    const actualizar = vi.fn(async () => ({}) as never)
    const servicio = crearServicioDeteccion(
      {
        manifiesto,
        rutaDatos: '/d',
        detectorGpu: { detectar },
        espacio: { bytesLibres: async () => libre },
        entorno: { platform: 'linux', arch: 'x64', emulada: false, versionSo: '6.1' }
      },
      { actualizar }
    )
    const a = await servicio.requisitosPrevios()
    libre = 20e9
    const b = await servicio.requisitosPrevios()
    expect(a.espacioLibre).toBe(10e9)
    expect(b.espacioLibre).toBe(20e9)
    expect(b.perfil).toBe('cuda')
    expect(detectar).toHaveBeenCalledTimes(1)
    expect(actualizar).toHaveBeenCalledTimes(1)
    expect(actualizar).toHaveBeenCalledWith({
      instalacion: {
        perfil_previsto: 'cuda',
        hardware: { gpu: 'RTX 3060', vram_mb: 12288 }
      }
    })
  })

  it('guardarPrevision sin GPU escribe null', async () => {
    const actualizar = vi.fn(async () => ({}) as never)
    await guardarPrevision({ actualizar }, { perfil: 'cpu', gpu: null })
    expect(actualizar).toHaveBeenCalledWith({
      instalacion: { perfil_previsto: 'cpu', hardware: { gpu: null, vram_mb: null } }
    })
  })
})

describe('integración sin dobles (máquina actual)', () => {
  let dir = ''
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('devuelve una plataforma conocida y espacio libre > 0', async () => {
    dir = await mkdtemp(join(tmpdir(), 'shinobi-deteccion-'))
    const t0 = Date.now()
    const servicio = crearServicioDeteccion({
      manifiesto,
      rutaDatos: join(dir, 'no', 'existe', 'aun'),
      detectorGpu: crearDetectorGpu(),
      espacio: crearEspacioLibre(),
      entorno: entornoReal(false)
    })
    const r = await servicio.requisitosPrevios()
    // macOS Intel no está soportado (preguntas/0015): `null` es válido en esa máquina.
    const esIntelMac = process.platform === 'darwin' && process.arch === 'x64'
    if (esIntelMac) expect(r.plataforma).toBeNull()
    else expect(['darwin-arm64', 'win32-x64', 'linux-x64']).toContain(r.plataforma)
    expect(r.espacioLibre).toBeGreaterThan(0)
    expect(Date.now() - t0).toBeLessThan(4000)
  })
})
