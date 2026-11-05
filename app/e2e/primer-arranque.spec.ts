import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import type { ApiShinobi } from '../src/shared/ipc'
import { manifiestoSchema, requisitosDe, bytesTotalesInstalacion } from '../src/shared/manifiesto'
import { configPredeterminada } from '../src/shared/config'
import { contenidoDiminuto, manifiestoParaEscenario } from '../src/main/runtime/falso/escenario'
import { crearTemporal } from './temporales'

/**
 * E2E del primer arranque con el runtime falso (tarea 0039, ADR 0009 §8): sin red ni descargas.
 * `SHINOBI_RUNTIME_FALSO` sustituye uv, el diagnóstico, la descarga de modelos, el espacio libre y
 * la GPU; `SHINOBI_LANZADOR=produccion` activa la comprobación del runtime al arrancar.
 */

type Escenario = Record<string, unknown>

const manifiesto = manifiestoSchema.parse(
  JSON.parse(readFileSync(join(process.cwd(), 'resources', 'runtime-manifest.json'), 'utf8'))
)
const FASES_RAPIDAS = {
  motor: { ms: 500 },
  componentes: { ms: 500 },
  diagnostico: { ms: 150 },
  modelo: { ms: 500 }
}

interface Entorno {
  datos: string
  escenario: string
  llamadas: string
}

function preparar(nombre: string, escenario: Escenario): Entorno {
  const datos = crearTemporal(`${nombre}-datos`)
  const carpeta = crearTemporal(`${nombre}-esc`)
  const e = {
    datos,
    escenario: join(carpeta, 'escenario.json'),
    llamadas: join(carpeta, 'llamadas.jsonl')
  }
  escribirEscenario(e, escenario)
  return e
}

function escribirEscenario(e: Entorno, escenario: Escenario): void {
  writeFileSync(e.escenario, JSON.stringify({ fases: FASES_RAPIDAS, ...escenario }))
}

function lanzar(e: Entorno): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHINOBI_DATOS: e.datos,
      SHINOBI_LANZADOR: 'produccion',
      SHINOBI_RUNTIME_FALSO: e.escenario
    }
  })
}

function llamadas(e: Entorno): { t: string; args?: string; modelo?: string }[] {
  try {
    return readFileSync(e.llamadas, 'utf8')
      .split('\n')
      .filter((l) => l !== '')
      .map((l) => JSON.parse(l) as { t: string; args?: string; modelo?: string })
  } catch {
    return []
  }
}

const cuenta = (e: Entorno, t: string, args?: string): number =>
  llamadas(e).filter((l) => l.t === t && (args === undefined || l.args === args)).length

const leerConfig = (datos: string): ReturnType<typeof configPredeterminada> =>
  JSON.parse(readFileSync(join(datos, 'config.json'), 'utf8')) as ReturnType<
    typeof configPredeterminada
  >

const BIENVENIDA = 'Hola. Vamos a preparar tu estudio de karaoke.'

/** Artefactos de un runtime ya instalado (Linux x64, perfil cpu, modelo Rápido diminuto). */
function instalarRuntimeEnDisco(datos: string, conModelo: boolean): void {
  const req = requisitosDe(manifiesto, 'linux-x64', 'cpu')
  if (!req) throw new Error('manifiesto sin linux-x64/cpu')
  const runtime = join(datos, 'runtime')
  mkdirSync(join(runtime, 'venv', 'bin'), { recursive: true })
  writeFileSync(join(runtime, 'venv', 'bin', 'python'), '')
  writeFileSync(
    join(runtime, 'instalado.json'),
    JSON.stringify({
      manifiesto_version: manifiesto.version,
      plataforma: 'linux-x64',
      perfil: 'cpu',
      sha256_requisitos: req.sha256_requisitos,
      python: manifiesto.python.version,
      fecha: '2026-11-04T00:00:00.000Z'
    })
  )
  if (conModelo) {
    const rapido = manifiestoParaEscenario(manifiesto, { modelos: 'diminutos' }).modelos.find(
      (m) => m.id === 'rapido'
    )
    if (!rapido) throw new Error('manifiesto sin modelo rápido')
    mkdirSync(join(datos, 'modelos'), { recursive: true })
    writeFileSync(join(datos, 'modelos', rapido.archivo), contenidoDiminuto(rapido.archivo))
  }
}

/** Escribe un `config.json` con la instalación completa (perfil cpu, modelo Rápido). */
function escribirConfigCompleta(datos: string): void {
  const config = configPredeterminada()
  config.instalacion.estado = 'completa'
  config.instalacion.perfil_hardware = 'cpu'
  config.instalacion.perfil_previsto = 'cpu'
  config.instalacion.version_manifiesto = manifiesto.version
  config.instalacion.fases = {
    motor: 'completada',
    componentes: 'completada',
    modelo: 'completada'
  }
  config.separacion.modelos_descargados = ['rapido']
  mkdirSync(datos, { recursive: true })
  writeFileSync(join(datos, 'config.json'), JSON.stringify(config))
}

test('1. CPU, todo bien: B1 con las cifras del manifiesto, B2, B3 y la Biblioteca vacía', async () => {
  const e = preparar('pa1', { plataforma: 'linux-x64', gpu: null })
  const app = await lanzar(e)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('heading', { name: BIENVENIDA })).toBeVisible()
    const gb = (n: number): string => String(Math.round((n / 1e9) * 10) / 10).replace('.', ',')
    const total = bytesTotalesInstalacion(manifiesto, 'linux-x64', 'cpu') as number
    await expect(v.getByText(`Descarga: unos ${gb(total)} GB para tu equipo`)).toBeVisible()
    await v.getByRole('button', { name: 'Preparar Shinobi Karaoke' }).click()

    await expect(v.getByRole('heading', { name: 'Preparando Shinobi Karaoke' })).toBeVisible()
    for (const fase of [
      'Preparando el motor de audio',
      'Instalando componentes',
      'Descargando el modelo de separación'
    ]) {
      await expect(v.getByText(fase).first()).toBeVisible()
    }
    await expect(v.getByText(/separaremos las pistas en modo Rápido/).first()).toBeVisible()

    await expect(v.getByRole('heading', { name: 'Todo listo' })).toBeVisible()
    await expect(v.getByText('Modo de separación: Rápido.')).toBeVisible()
    await v.getByRole('button', { name: 'Empezar' }).click()
    await expect(v.getByRole('heading', { name: 'Tu biblioteca está vacía' })).toBeVisible()

    const cfg = leerConfig(e.datos)
    expect(cfg.instalacion.estado).toBe('completa')
    expect(cfg.instalacion.perfil_hardware).toBe('cpu')
    expect(cfg.separacion.modelos_descargados).toEqual(['rapido'])
    expect(cuenta(e, 'uv', 'python install')).toBe(1)
    expect(cuenta(e, 'descarga')).toBe(1)
  } finally {
    await app.close()
  }
})

test('2. Sin espacio: B1 avisa y "Comprobar de nuevo" con más espacio habilita "Preparar"', async () => {
  const e = preparar('pa2', { espacioLibre: { desdeArchivo: 'espacio.txt' } })
  writeFileSync(join(e.escenario, '..', 'espacio.txt'), '1000000000')
  const app = await lanzar(e)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('heading', { name: BIENVENIDA })).toBeVisible()
    await expect(v.getByText(/Necesitas [\d,]+ GB libres y tienes 1 GB\./)).toBeVisible()
    const preparar = v.getByRole('button', { name: 'Preparar Shinobi Karaoke' })
    // Con poco espacio el botón único es "Comprobar de nuevo" y no se puede preparar.
    await expect(preparar).toHaveCount(0)

    writeFileSync(join(e.escenario, '..', 'espacio.txt'), '500000000000')
    await v.getByRole('button', { name: 'Comprobar de nuevo' }).click()
    await expect(preparar).toBeEnabled()
    await expect(v.getByRole('button', { name: 'Comprobar de nuevo' })).toHaveCount(0)
    await expect(v.getByText(/Necesitas [\d,]+ GB libres y tienes/)).toHaveCount(0)
  } finally {
    await app.close()
  }
})

test('3. SIN_CONEXION en componentes: B4 con su texto y "Reintentar" termina sin repetir el motor', async () => {
  const e = preparar('pa3', {
    fallo: { fase: 'componentes', codigo: 'SIN_CONEXION', veces: 1 }
  })
  const app = await lanzar(e)
  try {
    const v = await app.firstWindow()
    await v.getByRole('button', { name: 'Preparar Shinobi Karaoke' }).click()
    const aviso = v.getByRole('alert')
    await expect(aviso).toContainText('Sin conexión a internet.')
    await expect(aviso).toContainText('No perderás lo que ya se ha descargado.')
    await v.getByRole('button', { name: 'Reintentar' }).click()
    await expect(v.getByRole('heading', { name: 'Todo listo' })).toBeVisible()
    expect(cuenta(e, 'uv', 'python install')).toBe(1)
    expect(cuenta(e, 'uv', 'pip install')).toBe(2)
    expect(cuenta(e, 'descarga')).toBe(1)
  } finally {
    await app.close()
  }
})

test('4. Pausar y salir durante el modelo cierra la app; al relanzar, B5 continúa y termina', async () => {
  const e = preparar('pa4', { fases: { ...FASES_RAPIDAS, modelo: { ms: 30_000 } } })
  const app = await lanzar(e)
  const v = await app.firstWindow()
  await v.getByRole('button', { name: 'Preparar Shinobi Karaoke' }).click()
  await expect
    .poll(
      () =>
        v.evaluate(async () => {
          const api = (globalThis as unknown as { shinobi: ApiShinobi }).shinobi
          return (await api.runtime.estado()).fases.modelo
        }),
      { timeout: 10_000 }
    )
    .toBe('en_curso')
  const cierre = app.waitForEvent('close')
  await v.getByRole('button', { name: 'Pausar y salir' }).click()
  await v
    .getByRole('dialog', { name: '¿Pausar la preparación?' })
    .getByRole('button', { name: 'Pausar y salir' })
    .click()
  await cierre // `app.salir`: sale de la aplicación entera, también en macOS

  escribirEscenario(e, {}) // el segundo arranque ya no es lento
  const app2 = await lanzar(e)
  try {
    const v2 = await app2.firstWindow()
    await expect(v2.getByRole('heading', { name: 'Continuamos donde lo dejamos' })).toBeVisible()
    await v2.getByRole('button', { name: 'Continuar la preparación' }).click()
    await expect(v2.getByRole('heading', { name: 'Todo listo' })).toBeVisible()
    expect(cuenta(e, 'uv', 'python install')).toBe(1) // el motor no se repite
    expect(leerConfig(e.datos).instalacion.estado).toBe('completa')
  } finally {
    await app2.close()
  }
})

test('5. Rebaja cuda -> cpu por memoria: aviso, el total baja y el porcentaje no retrocede', async () => {
  const e = preparar('pa5', {
    plataforma: 'linux-x64',
    gpu: { nombre: 'NVIDIA GeForce RTX 3060', vramMb: 6144 },
    diagnostico: { perfil: 'cpu', motivoRebaja: 'memoria' },
    fases: { ...FASES_RAPIDAS, motor: { ms: 800 }, componentes: { ms: 1200 }, modelo: { ms: 1200 } }
  })
  const app = await lanzar(e)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('heading', { name: BIENVENIDA })).toBeVisible()
    await v.evaluate(() => {
      const api = (globalThis as unknown as { shinobi: ApiShinobi }).shinobi
      const w = globalThis as unknown as { __progreso: { total: number; pct: number }[] }
      w.__progreso = []
      api.runtime.alProgreso((p) =>
        w.__progreso.push({ total: p.totalGlobal, pct: p.porcentajeGlobal })
      )
    })
    await v.getByRole('button', { name: 'Preparar Shinobi Karaoke' }).click()
    await expect(
      v.getByText(/no tiene memoria suficiente para el modo Calidad/).first()
    ).toBeVisible()
    await expect(v.getByRole('heading', { name: 'Todo listo' })).toBeVisible()

    const eventos = await v.evaluate(
      () => (globalThis as unknown as { __progreso: { total: number; pct: number }[] }).__progreso
    )
    expect(eventos.length).toBeGreaterThan(3)
    const totales = eventos.map((x) => x.total).filter((t) => t > 0)
    expect(Math.min(...totales)).toBeLessThan(Math.max(...totales)) // el total bajó
    expect(totales[totales.length - 1]).toBe(Math.min(...totales))
    const pcts = eventos.map((x) => x.pct)
    for (let i = 1; i < pcts.length; i++) expect(pcts[i]).toBeGreaterThanOrEqual(pcts[i - 1] ?? 0)
    expect(leerConfig(e.datos).instalacion.motivo_rebaja).toBe('memoria')
  } finally {
    await app.close()
  }
})

test('6. Runtime dañado (completa en config, sin modelo): B5 "Hay que reparar" y "Reparar"', async () => {
  const e = preparar('pa6', { modelos: 'diminutos' })
  instalarRuntimeEnDisco(e.datos, false)
  escribirConfigCompleta(e.datos)
  const app = await lanzar(e)
  try {
    const v = await app.firstWindow()
    await expect(
      v.getByRole('heading', { name: 'Hay que reparar el motor de audio' })
    ).toBeVisible()
    await v.getByRole('button', { name: 'Reparar' }).click()
    await expect(v.getByRole('heading', { name: 'Todo listo' })).toBeVisible()
    expect(cuenta(e, 'descarga')).toBe(1)
    expect(cuenta(e, 'uv', 'python install')).toBe(0) // solo se repara lo que falta
    expect(leerConfig(e.datos).instalacion.estado).toBe('completa')
  } finally {
    await app.close()
  }
})

test('7. config.json borrado con runtime y modelo presentes: sin B1, directo a la Biblioteca', async () => {
  const e = preparar('pa7', { modelos: 'diminutos' })
  instalarRuntimeEnDisco(e.datos, true)
  const app = await lanzar(e)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('heading', { name: 'Tu biblioteca está vacía' })).toBeVisible()
    await expect(v.getByRole('heading', { name: BIENVENIDA })).toHaveCount(0)
    expect(cuenta(e, 'descarga')).toBe(0)
    expect(cuenta(e, 'uv')).toBe(0)
    await expect.poll(() => leerConfig(e.datos).instalacion.estado).toBe('completa')
  } finally {
    await app.close()
  }
})

test('8. Durante el primer arranque, Ctrl/Cmd+, y Ctrl/Cmd+N no navegan', async () => {
  const e = preparar('pa8', {})
  const app = await lanzar(e)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('heading', { name: BIENVENIDA })).toBeVisible()
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
    await v.keyboard.press(`${mod}+,`)
    await v.keyboard.press(`${mod}+N`)
    await v.waitForTimeout(500)
    await expect(v.getByRole('heading', { name: BIENVENIDA })).toBeVisible()
    await expect(v.getByRole('heading', { name: 'Ajustes' })).toHaveCount(0)
    await expect(v.getByRole('heading', { name: 'Añadir canción' })).toHaveCount(0)
  } finally {
    await app.close()
  }
})
