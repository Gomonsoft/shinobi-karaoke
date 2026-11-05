import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { manifiestoSchema, type Manifiesto } from '../../shared'
import { ServicioConfig } from '../configuracion'
import { calcularRequisitosPrevios } from './deteccion'
import {
  crearGestorRuntime,
  interpreteVenv,
  medidorReal,
  type GestorRuntime,
  type ProgresoRuntime,
  type ResultadoDiagnostico
} from './gestor'

const CONTENIDO = Buffer.from('modelo de prueba')
const SHA = createHash('sha256').update(CONTENIDO).digest('hex')

/** Manifiesto real con modelos diminutos (sin extras) para poder escribirlos en disco. */
const manifiesto: Manifiesto = (() => {
  const m = manifiestoSchema.parse(
    JSON.parse(readFileSync(join(__dirname, '../../../resources/runtime-manifest.json'), 'utf8'))
  )
  return {
    ...m,
    modelos: m.modelos.map((x) => ({
      ...x,
      archivo: `${x.id}.bin`,
      bytes: CONTENIDO.length,
      sha256: SHA,
      extra: []
    }))
  }
})()
const reqDe = manifiesto.runtime['linux-x64']?.cpu
if (!reqDe) throw new Error('manifiesto sin linux-x64 cpu')
const sha256Requisitos: string = reqDe.sha256_requisitos

let datos: string
beforeEach(() => {
  datos = mkdtempSync(join(tmpdir(), 'shinobi-arranque-'))
})
afterEach(() => rmSync(datos, { recursive: true, force: true }))

const dirRuntime = (): string => join(datos, 'runtime')
const py = (): string => interpreteVenv(dirRuntime(), process.platform)

function crearVenv(): void {
  mkdirSync(join(py(), '..'), { recursive: true })
  writeFileSync(py(), '')
}
function escribirMarcador(sobre: Record<string, unknown> = {}): void {
  mkdirSync(dirRuntime(), { recursive: true })
  writeFileSync(
    join(dirRuntime(), 'instalado.json'),
    JSON.stringify({
      manifiesto_version: manifiesto.version,
      plataforma: 'linux-x64',
      perfil: 'cpu',
      sha256_requisitos: sha256Requisitos,
      python: manifiesto.python.version,
      fecha: '2026-11-04T00:00:00.000Z',
      ...sobre
    })
  )
}
function escribirModelo(id: string, contenido: Buffer = CONTENIDO): void {
  mkdirSync(join(datos, 'modelos'), { recursive: true })
  writeFileSync(join(datos, 'modelos', `${id}.bin`), contenido)
}

async function montar(opts: { diag?: ResultadoDiagnostico | 'falla' } = {}) {
  const config = await ServicioConfig.abrir(datos)
  const espacio = { bytesLibres: async () => 1e13 }
  const previos = await calcularRequisitosPrevios(
    {
      manifiesto,
      rutaDatos: datos,
      detectorGpu: { detectar: async () => null },
      espacio
    },
    { platform: 'linux', arch: 'x64', emulada: false, versionSo: '6.1' }
  )
  const uvLlamadas: string[][] = []
  const descargas: string[] = []
  const diagLlamadas: unknown[] = []
  const gestor: GestorRuntime = crearGestorRuntime({
    datos,
    manifiesto,
    config,
    deteccion: { requisitosPrevios: async () => previos },
    ejecutorUv: {
      async ejecutar(args) {
        uvLlamadas.push(args)
        return { codigo: 0, stdout: '', ultimasLineas: [], cancelado: false }
      }
    },
    diagnosticador: {
      async diagnosticar(o) {
        diagLlamadas.push(o)
        if (opts.diag === 'falla') throw new Error('diagnóstico roto')
        return (
          opts.diag ?? { perfil: o.perfilPrevisto, gpu: null, vram_mb: null, motivo_rebaja: null }
        )
      }
    },
    descargador: {
      async descargar(m) {
        descargas.push(m.id)
      }
    },
    medidor: medidorReal,
    espacio,
    raizRecursos: '/recursos',
    rutaCodigoWorker: '/recursos/worker',
    plataformaSO: process.platform
  })
  const eventos: ProgresoRuntime[] = []
  gestor.suscribir((p) => eventos.push(p))
  return { gestor, config, uvLlamadas, descargas, diagLlamadas, eventos }
}

async function marcarCompleta(t: Awaited<ReturnType<typeof montar>>): Promise<void> {
  await t.config.actualizar({
    instalacion: {
      estado: 'completa',
      fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' },
      perfil_hardware: 'cpu',
      version_manifiesto: manifiesto.version
    },
    separacion: { modelos_descargados: ['calidad'] }
  })
}

describe('comprobarAlArrancar: instalación completa (comprobación barata)', () => {
  it('todo correcto: no hace nada y es rápida', async () => {
    crearVenv()
    escribirMarcador()
    escribirModelo('calidad')
    const t = await montar()
    await marcarCompleta(t)
    const t0 = performance.now()
    expect(await t.gestor.comprobarAlArrancar()).toEqual({ resultado: 'completa' })
    expect(performance.now() - t0).toBeLessThan(200)
    expect(t.config.obtener().instalacion.estado).toBe('completa')
    expect(t.diagLlamadas).toHaveLength(0)
    expect(t.uvLlamadas).toHaveLength(0)
  })

  it('falta el venv: dañada y motor y componentes pendientes', async () => {
    escribirMarcador()
    escribirModelo('calidad')
    const t = await montar()
    await marcarCompleta(t)
    expect(await t.gestor.comprobarAlArrancar()).toEqual({ resultado: 'dañada', motivo: 'venv' })
    expect(t.config.obtener().instalacion).toMatchObject({
      estado: 'dañada',
      fases: { motor: 'pendiente', componentes: 'pendiente', modelo: 'pendiente' }
    })
  })

  it('marcador de otra versión del manifiesto: dañada, solo se repiten los componentes', async () => {
    crearVenv()
    escribirMarcador({ manifiesto_version: manifiesto.version + 1 })
    escribirModelo('calidad')
    const t = await montar()
    await marcarCompleta(t)
    expect(await t.gestor.comprobarAlArrancar()).toEqual({
      resultado: 'dañada',
      motivo: 'marcador'
    })
    expect(t.config.obtener().instalacion).toMatchObject({
      estado: 'dañada',
      fases: { motor: 'completada', componentes: 'pendiente', modelo: 'completada' }
    })
  })

  it('sin marcador: dañada', async () => {
    crearVenv()
    escribirModelo('calidad')
    const t = await montar()
    await marcarCompleta(t)
    expect(await t.gestor.comprobarAlArrancar()).toMatchObject({ motivo: 'marcador' })
  })

  it('falta el modelo (o su tamaño no coincide): dañada, solo el modelo pendiente', async () => {
    crearVenv()
    escribirMarcador()
    for (const preparar of [() => undefined, () => escribirModelo('calidad', Buffer.from('x'))]) {
      preparar()
      const t = await montar()
      await marcarCompleta(t)
      expect(await t.gestor.comprobarAlArrancar()).toEqual({
        resultado: 'dañada',
        motivo: 'modelo'
      })
      expect(t.config.obtener().instalacion.fases).toMatchObject({
        motor: 'completada',
        componentes: 'completada',
        modelo: 'pendiente'
      })
      expect(t.config.obtener().separacion.modelos_descargados).toEqual([])
    }
  })

  it('borra los *.partial pero conserva los *.descarga', async () => {
    mkdirSync(join(datos, 'modelos'), { recursive: true })
    writeFileSync(join(datos, 'modelos', 'x.123.partial'), 'a')
    writeFileSync(join(datos, 'modelos', 'y.bin.descarga'), 'b')
    const t = await montar()
    await t.gestor.comprobarAlArrancar()
    expect(existsSync(join(datos, 'modelos', 'x.123.partial'))).toBe(false)
    expect(existsSync(join(datos, 'modelos', 'y.bin.descarga'))).toBe(true)
  })
})

describe('comprobarAlArrancar: no completa', () => {
  it('config.json recreado con runtime válido: completa sin descargar ni llamar a uv', async () => {
    crearVenv()
    escribirMarcador()
    escribirModelo('calidad')
    const t = await montar()
    expect(t.config.obtener().instalacion.estado).toBe('pendiente')
    expect(await t.gestor.comprobarAlArrancar()).toEqual({ resultado: 'reutilizada' })
    const c = t.config.obtener()
    expect(c.instalacion).toMatchObject({
      estado: 'completa',
      perfil_hardware: 'cpu',
      version_manifiesto: manifiesto.version,
      fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' }
    })
    expect(c.separacion.modelos_descargados).toEqual(['calidad'])
    expect(t.descargas).toHaveLength(0)
    expect(t.uvLlamadas).toHaveLength(0)
    expect(t.diagLlamadas).toHaveLength(1)
    // estado `verificando` emitido y retirado
    expect(t.eventos.map((e) => e.verificando)).toEqual([true, false])
  })

  it('modelo corrupto (mismo tamaño, SHA distinto): solo queda pendiente el modelo', async () => {
    crearVenv()
    escribirMarcador()
    escribirModelo('calidad', Buffer.alloc(CONTENIDO.length, 1))
    const t = await montar()
    expect(await t.gestor.comprobarAlArrancar()).toEqual({ resultado: 'pendiente' })
    expect(t.config.obtener().instalacion).toMatchObject({
      estado: 'pendiente',
      fases: { motor: 'completada', componentes: 'completada', modelo: 'pendiente' }
    })
    expect(t.config.obtener().separacion.modelos_descargados).toEqual([])
  })

  it('el diagnóstico rebaja el perfil: se comprueba el modelo del perfil final', async () => {
    crearVenv()
    escribirMarcador()
    escribirModelo('calidad')
    const t = await montar({
      diag: { perfil: 'cpu', gpu: null, vram_mb: null, motivo_rebaja: 'generico' }
    })
    await t.gestor.comprobarAlArrancar()
    expect(t.config.obtener().instalacion.motivo_rebaja).toBe('generico')
  })

  it('diagnóstico fallido: componentes pendientes', async () => {
    crearVenv()
    escribirMarcador()
    escribirModelo('calidad')
    const t = await montar({ diag: 'falla' })
    expect(await t.gestor.comprobarAlArrancar()).toEqual({ resultado: 'pendiente' })
    expect(t.config.obtener().instalacion.fases.componentes).toBe('pendiente')
  })

  it('marcador de otra versión del manifiesto: no se reutiliza (se instalará)', async () => {
    crearVenv()
    escribirMarcador({ manifiesto_version: manifiesto.version + 1 })
    escribirModelo('calidad')
    const t = await montar()
    expect(await t.gestor.comprobarAlArrancar()).toEqual({ resultado: 'pendiente' })
    expect(t.diagLlamadas).toHaveLength(0)
    expect(t.config.obtener().instalacion.estado).toBe('pendiente')
  })

  it('tras reutilizar, instalar() no hace nada: sin uv ni descargas', async () => {
    crearVenv()
    escribirMarcador()
    escribirModelo('calidad')
    const t = await montar()
    await t.gestor.comprobarAlArrancar()
    expect(await t.gestor.instalar()).toEqual({ estado: 'completa' })
    expect(t.uvLlamadas.filter((a) => a[1] === 'pip')).toHaveLength(0)
    expect(t.descargas).toHaveLength(0)
  })
})

describe('instalación de desarrollo previa (perfil cpu con solo Rápido, sin consentimiento)', () => {
  async function conSoloRapido() {
    crearVenv()
    escribirMarcador()
    escribirModelo('rapido')
    const t = await montar()
    await t.config.actualizar({
      instalacion: {
        estado: 'completa',
        fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' },
        perfil_hardware: 'cpu',
        version_manifiesto: manifiesto.version
      },
      separacion: { modo: 'rapido', modelos_descargados: ['rapido'] }
    })
    return t
  }

  it('la comprobación barata falla por falta de Calidad (B5 "Hay que reparar")', async () => {
    const t = await conSoloRapido()
    expect(await t.gestor.comprobarAlArrancar()).toEqual({ resultado: 'dañada', motivo: 'modelo' })
    expect(t.config.obtener().instalacion).toMatchObject({
      estado: 'dañada',
      fases: { motor: 'completada', componentes: 'completada', modelo: 'pendiente' }
    })
  })

  it('reparar descarga solo Calidad: ni uv ni Rápido', async () => {
    const t = await conSoloRapido()
    await t.gestor.comprobarAlArrancar()
    expect(await t.gestor.instalar()).toEqual({ estado: 'completa' })
    expect(t.descargas).toEqual(['calidad'])
    expect(t.uvLlamadas.filter((a) => a[1] === 'pip')).toHaveLength(0)
    expect(t.config.obtener().separacion.modelos_descargados).toContain('calidad')
  })
})

describe('instalación con solo Rápido y consentimiento (0057)', () => {
  it('con modo rapido y rapido_aceptado la comprobación barata la da por buena (no dañada)', async () => {
    crearVenv()
    escribirMarcador()
    escribirModelo('rapido')
    const t = await montar()
    await t.config.actualizar({
      instalacion: {
        estado: 'completa',
        fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' },
        perfil_hardware: 'cpu',
        version_manifiesto: manifiesto.version
      },
      separacion: {
        modo: 'rapido',
        rapido_aceptado: '2026-11-05T10:00:00.000Z',
        modelos_descargados: ['rapido']
      }
    })
    expect(await t.gestor.comprobarAlArrancar()).toEqual({ resultado: 'completa' })
    expect(t.config.obtener().instalacion.estado).toBe('completa')
    expect(t.descargas).toEqual([])
  })
})
