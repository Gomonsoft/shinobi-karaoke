import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { manifiestoSchema, type Manifiesto, type PerfilHardware } from '../../shared'
import { ServicioConfig } from '../configuracion'
import { calcularRequisitosPrevios, type EspacioLibre } from './deteccion'
import {
  crearGestorRuntime,
  interpreteVenv,
  medidorReal,
  peticionPython,
  type DependenciasGestor,
  type Diagnosticador,
  type ProgresoRuntime,
  type ResultadoDiagnostico
} from './gestor'
import type { EjecutorUv, ResultadoUv } from './uv'

const manifiesto: Manifiesto = manifiestoSchema.parse(
  JSON.parse(readFileSync(join(__dirname, '../../../resources/runtime-manifest.json'), 'utf8'))
)

let datos: string
beforeEach(() => {
  datos = mkdtempSync(join(tmpdir(), 'shinobi-gestor-'))
})
afterEach(() => rmSync(datos, { recursive: true, force: true }))

const ok = (stdout = ''): ResultadoUv => ({
  codigo: 0,
  stdout,
  ultimasLineas: [],
  cancelado: false
})
const falla = (texto: string): ResultadoUv => ({
  codigo: 2,
  stdout: '',
  ultimasLineas: texto.split('\n'),
  cancelado: false
})

interface Escenario {
  plataforma?: { platform: string; arch: string; emulada: boolean; versionSo: string }
  gpu?: boolean
  libre?: number
  /** Fallo de uv por la primera orden cuyo texto contenga la clave (se consume). */
  fallos?: Record<string, string>
  diag?: ResultadoDiagnostico
  /** Retiene la orden uv que contenga esta clave hasta que se aborte. */
  colgar?: string
  fallaModelo?: boolean
}

async function montar(esc: Escenario = {}, id = 'cpu' as PerfilHardware) {
  void id
  const llamadas: string[][] = []
  const envs: Record<string, string>[] = []
  const diagLlamadas: unknown[] = []
  let vivos = 0
  const fallos = { ...(esc.fallos ?? {}) }
  const dirRuntime = join(datos, 'runtime')
  const py = interpreteVenv(dirRuntime, process.platform)
  const ejecutorUv: EjecutorUv = {
    async ejecutar(args, { env, señal }) {
      llamadas.push(args)
      envs.push(env)
      const orden = args.join(' ')
      vivos++
      try {
        if (esc.colgar && orden.includes(esc.colgar)) {
          await new Promise<void>((r) =>
            señal?.addEventListener('abort', () => r(), { once: true })
          )
          return { codigo: -1, stdout: '', ultimasLineas: [], cancelado: true }
        }
        const clave = Object.keys(fallos).find((k) => orden.includes(k))
        if (clave) {
          const t = fallos[clave] as string
          delete fallos[clave]
          return falla(t)
        }
        if (args[1] === 'python' && args[2] === 'install') {
          mkdirSync(join(dirRuntime, 'python'), { recursive: true })
          writeFileSync(join(dirRuntime, 'python', 'x'), Buffer.alloc(1000))
        } else if (args[1] === 'python' && args[2] === 'find') {
          return ok(`${join(dirRuntime, 'python', 'bin', 'python3.12')}\n`)
        } else if (args[1] === 'venv') {
          mkdirSync(join(py, '..'), { recursive: true })
          writeFileSync(py, '')
        } else if (args[1] === 'pip') {
          mkdirSync(join(dirRuntime, 'cache-uv'), { recursive: true })
          writeFileSync(join(dirRuntime, 'cache-uv', 'w'), Buffer.alloc(5000))
        } else if (args[1] === 'cache') {
          rmSync(join(dirRuntime, 'cache-uv'), { recursive: true, force: true })
        }
        return ok()
      } finally {
        vivos--
      }
    }
  }
  const config = await ServicioConfig.abrir(datos)
  const espacio: EspacioLibre = { bytesLibres: async () => esc.libre ?? 1e13 }
  const deps0 = {
    manifiesto,
    rutaDatos: datos,
    detectorGpu: { detectar: async () => (esc.gpu ? { nombre: 'RTX', vramMb: 12000 } : null) },
    espacio
  }
  const entorno = esc.plataforma ?? {
    platform: 'linux',
    arch: 'x64',
    emulada: false,
    versionSo: '6.1'
  }
  const previos = await calcularRequisitosPrevios(deps0, entorno)
  const diagnosticador: Diagnosticador = {
    async diagnosticar(o) {
      diagLlamadas.push(o)
      return esc.diag ?? { perfil: o.perfilPrevisto, gpu: null, vram_mb: null, motivo_rebaja: null }
    }
  }
  const descargas: string[] = []
  const deps: DependenciasGestor = {
    datos,
    manifiesto,
    config,
    deteccion: { requisitosPrevios: async () => previos },
    ejecutorUv,
    diagnosticador,
    descargador: {
      async descargar(modelo, o) {
        descargas.push(modelo.id)
        const total = modelo.bytes
        o.alProgreso?.({ bytes: Math.floor(total / 2), total })
        if (esc.fallaModelo) throw Object.assign(new Error('sin red'), { codigo: 'SIN_CONEXION' })
        o.alProgreso?.({ bytes: total, total })
      }
    },
    medidor: medidorReal,
    espacio,
    raizRecursos: '/recursos',
    rutaCodigoWorker: '/recursos/worker',
    plataformaSO: process.platform,
    intervaloMedicionMs: 5,
    intervaloEmisionMs: 0,
    envBase: { PATH: '/bin', UV_X: '1', VIRTUAL_ENV: '/v' }
  }
  const eventos: ProgresoRuntime[] = []
  const gestor = crearGestorRuntime(deps)
  gestor.suscribir((p) => eventos.push(p))
  return {
    gestor,
    config,
    llamadas,
    envs,
    eventos,
    diagLlamadas,
    descargas,
    vivos: () => vivos,
    deps
  }
}

const ordenes = (l: string[][]): string[] => l.map((a) => a.slice(1, 3).join(' '))

describe('peticionPython', () => {
  it('arquitectura explícita', () => {
    expect(peticionPython('3.12.16', 'macos', 'arm64')).toBe('cpython-3.12.16-macos-aarch64-none')
    expect(peticionPython('3.12.16', 'windows', 'x64')).toBe('cpython-3.12.16-windows-x86_64-none')
    expect(peticionPython('3.12.16', 'linux', 'x64')).toBe('cpython-3.12.16-linux-x86_64-gnu')
    expect(peticionPython('3.12.16', 'otro', 'x64')).toBeNull()
  })
})

describe('gestor de runtime', () => {
  it('secuencia completa con argumentos exactos', async () => {
    const t = await montar()
    const r = await t.gestor.instalar()
    expect(r).toEqual({ estado: 'completa' })
    expect(ordenes(t.llamadas)).toEqual([
      'python install',
      'python find',
      'venv --clear',
      'pip install',
      'cache clean'
    ])
    expect(t.llamadas.every((a) => a[0] === '--no-config')).toBe(true)
    expect(t.llamadas[0]).toEqual([
      '--no-config',
      'python',
      'install',
      'cpython-3.12.16-linux-x86_64-gnu'
    ])
    const pip = t.llamadas[3] as string[]
    expect(pip).toContain('--require-hashes')
    expect(pip.join(' ')).toContain('--index-strategy unsafe-best-match')
    expect(pip.join(' ')).toContain(
      `-r ${join('/recursos', 'worker/requisitos/linux-x64-cpu.txt')}`
    )
    expect(t.envs[0]).toMatchObject({ UV_PYTHON_PREFERENCE: 'only-managed' })
    expect(t.envs[0]?.UV_X).toBeUndefined()
    expect(t.envs[0]?.VIRTUAL_ENV).toBeUndefined()
    const c = t.config.obtener()
    expect(c.instalacion).toMatchObject({
      estado: 'completa',
      version_manifiesto: manifiesto.version,
      perfil_hardware: 'cpu',
      error: null,
      fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' }
    })
    expect(c.separacion.modelos_descargados).toEqual(['rapido'])
    const marcador = JSON.parse(readFileSync(join(datos, 'runtime', 'instalado.json'), 'utf8'))
    expect(marcador).toMatchObject({ plataforma: 'linux-x64', perfil: 'cpu' })
    const ultimo = t.eventos.at(-1)
    expect(ultimo?.porcentajeGlobal).toBe(100)
    // nunca retrocede
    const pc = t.eventos.map((e) => e.porcentajeGlobal)
    expect(pc).toEqual([...pc].sort((a, b) => a - b))
  })

  it('Rosetta: pide Python aarch64 explícito y guarda la plataforma real', async () => {
    const t = await montar({
      plataforma: { platform: 'darwin', arch: 'x64', emulada: true, versionSo: '15.0' }
    })
    await t.gestor.instalar()
    expect(t.llamadas[0]).toEqual([
      '--no-config',
      'python',
      'install',
      'cpython-3.12.16-macos-aarch64-none'
    ])
    const m = JSON.parse(readFileSync(join(datos, 'runtime', 'instalado.json'), 'utf8'))
    expect(m.plataforma).toBe('darwin-arm64')
  })

  it('macOS 13.6 y plataformas sin manifiesto: PLATAFORMA_NO_SOPORTADA sin lanzar uv', async () => {
    for (const plataforma of [
      { platform: 'darwin', arch: 'arm64', emulada: false, versionSo: '13.6.0' },
      { platform: 'darwin', arch: 'x64', emulada: false, versionSo: '15.0' }
    ]) {
      const t = await montar({ plataforma })
      const r = await t.gestor.instalar()
      expect(r).toMatchObject({
        estado: 'error',
        error: { codigo: 'PLATAFORMA_NO_SOPORTADA', fase: 'plataforma' }
      })
      expect(t.llamadas).toHaveLength(0)
      expect(t.config.obtener().instalacion.error?.codigo).toBe('PLATAFORMA_NO_SOPORTADA')
    }
    const ok14 = await montar({
      plataforma: { platform: 'darwin', arch: 'arm64', emulada: false, versionSo: '14.0.0' }
    })
    expect((await ok14.gestor.instalar()).estado).toBe('completa')
  })

  it('rebaja cuda a cpu: el total baja y el porcentaje no retrocede', async () => {
    const t = await montar({
      gpu: true,
      diag: { perfil: 'cpu', gpu: 'RTX', vram_mb: 2000, motivo_rebaja: 'memoria' }
    })
    const r = await t.gestor.instalar()
    expect(r.estado).toBe('completa')
    const antes = t.eventos.find((e) => e.comprobando)!
    const despues = t.eventos.filter((e) => e.motivoRebaja === 'memoria')
    expect(antes.modo).toBe('calidad')
    expect(despues.length).toBeGreaterThan(0)
    expect(despues[0]!.totalGlobal).toBeLessThan(antes.totalGlobal)
    expect(despues[0]!.modo).toBe('rapido')
    expect(despues[0]!.porcentajeGlobal).toBeGreaterThanOrEqual(antes.porcentajeGlobal)
    expect(t.descargas).toEqual(['rapido'])
    expect(t.config.obtener().instalacion).toMatchObject({
      perfil_hardware: 'cpu',
      motivo_rebaja: 'memoria'
    })
  })

  it('fallo en componentes: reintento sin repetir el motor', async () => {
    const t = await montar({ fallos: { 'pip install': 'dns error' } })
    const r1 = await t.gestor.instalar()
    expect(r1).toMatchObject({
      estado: 'error',
      error: { codigo: 'SIN_CONEXION', fase: 'componentes' }
    })
    expect(t.config.obtener().instalacion).toMatchObject({
      estado: 'en_curso',
      error: { codigo: 'SIN_CONEXION', fase: 'componentes' },
      fases: { motor: 'completada', componentes: 'error' }
    })
    const r2 = await t.gestor.reintentar()
    expect(r2.estado).toBe('completa')
    expect(ordenes(t.llamadas).filter((o) => o === 'python install')).toHaveLength(1)
    expect(t.config.obtener().instalacion.error).toBeNull()
  })

  it.each([
    ['No space left on device (os error 28)', 'SIN_ESPACIO'],
    ['Hash mismatch for `x`', 'VERIFICACION_FALLIDA'],
    ['HTTP status server error (503 Service Unavailable)', 'SERVICIO_NO_DISPONIBLE'],
    ['algo raro', 'ERROR_INTERNO']
  ])('uv falla con "%s" -> %s', async (texto, codigo) => {
    const t = await montar({ fallos: { 'python install': texto } })
    const r = await t.gestor.instalar()
    expect(r).toMatchObject({ estado: 'error', error: { codigo, fase: 'motor' } })
  })

  it('espacio insuficiente antes de una fase: SIN_ESPACIO sin lanzar uv', async () => {
    const t = await montar({ libre: 1000 })
    const r = await t.gestor.instalar()
    expect(r).toMatchObject({ estado: 'error', error: { codigo: 'SIN_ESPACIO', fase: 'motor' } })
    expect(t.llamadas).toHaveLength(0)
  })

  it('fallo del modelo se traduce y se reanuda solo el modelo', async () => {
    const t = await montar({ fallaModelo: true })
    const r = await t.gestor.instalar()
    expect(r).toMatchObject({ estado: 'error', error: { codigo: 'SIN_CONEXION', fase: 'modelo' } })
    const n = t.llamadas.length
    t.deps.descargador.descargar = async () => undefined
    expect((await t.gestor.instalar()).estado).toBe('completa')
    expect(t.llamadas).toHaveLength(n)
  })

  it.each(['python install', 'pip install'])(
    'pausa durante "%s" sin procesos vivos y continúa',
    async (clave) => {
      const t = await montar({ colgar: clave })
      const p = t.gestor.instalar()
      for (let i = 0; i < 500 && !t.llamadas.some((a) => a.join(' ').includes(clave)); i++)
        await new Promise((r) => setTimeout(r, 10))
      await new Promise((r) => setTimeout(r, 20))
      expect(t.vivos()).toBe(1)
      await t.gestor.pausar()
      expect(t.vivos()).toBe(0)
      expect(await p).toEqual({ estado: 'pausada' })
      const fases = t.config.obtener().instalacion
      expect(fases.error).toBeNull()
      expect(Object.values(fases.fases)).not.toContain('error')
      expect(clave === 'python install' ? fases.fases.motor : fases.fases.componentes).toBe(
        'pendiente'
      )
    }
  )

  it('reanudación tras cerrar: salta las fases completadas', async () => {
    const t = await montar({ colgar: 'nada' })
    await t.gestor.instalar()
    // una instalación nueva con el mismo disco no repite nada
    const n = t.llamadas.length
    await t.config.actualizar({ instalacion: { estado: 'en_curso' } })
    const g2 = crearGestorRuntime(t.deps)
    expect((await g2.instalar()).estado).toBe('completa')
    expect(t.llamadas).toHaveLength(n)
    expect(t.descargas).toHaveLength(1)
    // si el modelo estaba pendiente solo se descarga el modelo
    await t.config.actualizar({
      instalacion: { fases: { modelo: 'pendiente' } },
      separacion: { modelos_descargados: [] }
    })
    await g2.instalar()
    expect(t.llamadas).toHaveLength(n)
    expect(t.descargas).toHaveLength(2)
    // sin marcador se repiten componentes pero no el motor
    rmSync(join(datos, 'runtime', 'instalado.json'))
    await t.config.actualizar({ instalacion: { fases: { componentes: 'en_curso' } } })
    await g2.instalar()
    expect(ordenes(t.llamadas.slice(n))).toEqual(['pip install', 'cache clean'])
    expect(existsSync(join(datos, 'runtime', 'instalado.json'))).toBe(true)
  })

  it('llamadas concurrentes devuelven la misma promesa', async () => {
    const t = await montar()
    const a = t.gestor.instalar()
    const b = t.gestor.instalar()
    expect(a).toBe(b)
    await a
    expect(t.gestor.instalando()).toBe(false)
  })

  it('emite como mucho 4 eventos por segundo por defecto', async () => {
    const t = await montar()
    const g = crearGestorRuntime({ ...t.deps, intervaloEmisionMs: 250 })
    const ev: ProgresoRuntime[] = []
    g.suscribir((p) => ev.push(p))
    await g.instalar()
    expect(ev.length).toBeLessThan(40)
  })
})
