import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ActualizadorYtDlp,
  CerrojoLecturaEscritura,
  hayMarcadorYtdlp,
  iniciarMantenimientoYtdlp,
  rutaMarcadorYtdlp,
  versionYtDlp
} from './ytdlp'
import type { EjecutorUv, OpcionesUv, ResultadoUv } from './uv'

const reposo = (ms = 10) => new Promise((r) => setTimeout(r, ms))
async function hasta(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !cond(); i++) await reposo(5)
  expect(cond()).toBe(true)
}

/** uv falso: cada llamada espera a que el test la resuelva o la cancelen por la señal. */
function uvFalso() {
  interface Llamada {
    args: string[]
    opciones: OpcionesUv
    terminar: (r?: Partial<ResultadoUv>) => void
  }
  const llamadas: Llamada[] = []
  const ejecutor: EjecutorUv = {
    ejecutar: (args, opciones) =>
      new Promise((ok) => {
        const fin = (r: Partial<ResultadoUv> = {}): void =>
          ok({ codigo: 0, stdout: '', ultimasLineas: [], cancelado: false, ...r })
        llamadas.push({ args, opciones, terminar: fin })
        opciones.señal?.addEventListener('abort', () => fin({ codigo: -1, cancelado: true }))
      })
  }
  return { ejecutor, llamadas }
}

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ytdlp-'))
})
afterEach(async () => {
  vi.useRealTimers()
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 30 })
})

function montar(extra: Partial<ConstructorParameters<typeof ActualizadorYtDlp>[0]> = {}) {
  const uv = uvFalso()
  const cerrojo = new CerrojoLecturaEscritura()
  const versiones = ['2025.1.1', '2025.2.2']
  const act = new ActualizadorYtDlp({
    dirRuntime: dir,
    plataforma: 'linux',
    ejecutorUv: uv.ejecutor,
    cerrojo,
    env: { PATH: '/bin', UV_CACHE_DIR: '/otra', VIRTUAL_ENV: '/x' },
    version: () => Promise.resolve(versiones.shift() ?? '2025.2.2'),
    ...extra
  })
  return { act, uv, cerrojo }
}

describe('CerrojoLecturaEscritura', () => {
  it('el escritor espera a los lectores activos y no entra ningún lector nuevo', async () => {
    const c = new CerrojoLecturaEscritura()
    const orden: string[] = []
    let soltar: () => void = () => undefined
    const l1 = c.conLectura(async () => {
      orden.push('l1')
      await new Promise<void>((r) => (soltar = r))
    })
    await reposo()
    const e = c.conEscritura(async () => void orden.push('escritor'))
    expect(c.enMantenimiento()).toBe(true)
    const espera = vi.fn()
    const l2 = c.conLectura(async () => void orden.push('l2'), { alEsperar: espera })
    await reposo()
    expect(orden).toEqual(['l1'])
    expect(espera).toHaveBeenCalledTimes(1)
    soltar()
    await Promise.all([l1, e, l2])
    expect(orden).toEqual(['l1', 'escritor', 'l2'])
    expect(c.enMantenimiento()).toBe(false)
  })

  it('un lector que espera se puede cancelar sin entrar', async () => {
    const c = new CerrojoLecturaEscritura()
    let fin: () => void = () => undefined
    const e = c.conEscritura(() => new Promise<void>((r) => (fin = r)))
    await reposo()
    const control = new AbortController()
    const fn = vi.fn(() => Promise.resolve())
    const l = c.conLectura(fn, { señal: control.signal })
    control.abort()
    await expect(l).rejects.toMatchObject({ codigo: 'CANCELADO' })
    fin()
    await e
    expect(fn).not.toHaveBeenCalled()
  })

  it('avisa una vez cuando termina el mantenimiento', async () => {
    const c = new CerrojoLecturaEscritura()
    const cb = vi.fn()
    let fin: () => void = () => undefined
    const e = c.conEscritura(() => new Promise<void>((r) => (fin = r)))
    c.alTerminarMantenimiento(cb)
    await reposo()
    expect(cb).not.toHaveBeenCalled()
    fin()
    await e
    expect(cb).toHaveBeenCalledTimes(1)
  })
})

describe('actualizarYtDlp', () => {
  it('lanza uv con el entorno aislado, sin --require-hashes, y devuelve las versiones', async () => {
    const { act, uv } = montar()
    const p = act.actualizar({ motivo: 'semanal' })
    await hasta(() => uv.llamadas.length === 1)
    const llamada = uv.llamadas[0]!
    expect(llamada.args).toEqual([
      '--no-config',
      'pip',
      'install',
      '--python',
      join(dir, 'venv', 'bin', 'python'),
      '-U',
      'yt-dlp[default]',
      'deno'
    ])
    expect(llamada.opciones.env.UV_CACHE_DIR).toBe(join(dir, 'cache-uv'))
    expect(llamada.opciones.env.VIRTUAL_ENV).toBeUndefined()
    // El marcador existe mientras uv trabaja.
    expect(JSON.parse(await readFile(rutaMarcadorYtdlp(dir), 'utf8'))).toMatchObject({
      motivo: 'semanal'
    })
    llamada.terminar()
    await expect(p).resolves.toEqual({ anterior: '2025.1.1', nueva: '2025.2.2', noop: false })
    expect(existsSync(rutaMarcadorYtdlp(dir))).toBe(false)
  })

  it('reparar añade --reinstall-package de yt-dlp, yt-dlp-ejs y deno', async () => {
    const { act, uv } = montar()
    const p = act.actualizar({ reparar: true })
    await hasta(() => uv.llamadas.length === 1)
    expect(uv.llamadas[0]!.args.slice(-6)).toEqual([
      '--reinstall-package',
      'yt-dlp',
      '--reinstall-package',
      'yt-dlp-ejs',
      '--reinstall-package',
      'deno'
    ])
    uv.llamadas[0]!.terminar()
    await p
  })

  it('es de un solo vuelo: una llamada concurrente recibe la misma promesa', async () => {
    const { act, uv } = montar()
    const a = act.actualizar()
    const b = act.actualizar({ reparar: true })
    expect(b).toBe(a)
    await hasta(() => uv.llamadas.length === 1)
    uv.llamadas[0]!.terminar()
    await a
    expect(act.enCurso()).toBe(false)
    const c = act.actualizar()
    expect(c).not.toBe(a)
    await hasta(() => uv.llamadas.length === 2)
    uv.llamadas[1]!.terminar()
    await c
  })

  it('espera a una descarga en curso (lector) y bloquea las nuevas', async () => {
    const { act, uv, cerrojo } = montar()
    let soltar: () => void = () => undefined
    const lector = cerrojo.conLectura(() => new Promise<void>((r) => (soltar = r)))
    await reposo()
    const p = act.actualizar()
    await reposo()
    expect(uv.llamadas).toHaveLength(0)
    const eventos: string[] = []
    const nuevo = cerrojo.conLectura(async () => void eventos.push('lector'), {
      alEsperar: () => eventos.push('espera')
    })
    soltar()
    await lector
    await hasta(() => uv.llamadas.length === 1)
    expect(eventos).toEqual(['espera'])
    uv.llamadas[0]!.terminar()
    await Promise.all([p, nuevo])
    expect(eventos).toEqual(['espera', 'lector'])
  })

  it('un fallo clasificado conserva el marcador, no rompe nada y se registra', async () => {
    const registrar = vi.fn()
    const { act, uv } = montar({ registrar })
    const p = act.actualizar()
    const rechazo = expect(p).rejects.toMatchObject({ codigo: 'SIN_CONEXION' })
    await hasta(() => uv.llamadas.length === 1)
    uv.llamadas[0]!.terminar({
      codigo: 2,
      ultimasLineas: ['error: dns error: failed to lookup address']
    })
    await rechazo
    expect(existsSync(rutaMarcadorYtdlp(dir))).toBe(true)
    expect(registrar).toHaveBeenCalledWith('aviso', expect.stringContaining('falló'))
  })

  it('borra el marcador solo con código 0', async () => {
    const { act, uv } = montar()
    const p = act.actualizar()
    const rechazo = expect(p).rejects.toBeDefined()
    await hasta(() => uv.llamadas.length === 1)
    uv.llamadas[0]!.terminar({ codigo: 1 })
    await rechazo
    expect(await hayMarcadorYtdlp(dir)).toBe(true)
    const q = act.actualizar()
    await hasta(() => uv.llamadas.length === 2)
    uv.llamadas[1]!.terminar({ codigo: 0 })
    await q
    expect(await hayMarcadorYtdlp(dir)).toBe(false)
  })

  it('límite de 5 min: mata uv (señal) y lo trata como interrupción con el marcador', async () => {
    const { act, uv } = montar({ limiteMs: 60 })
    const p = act.actualizar()
    const rechazo = expect(p).rejects.toMatchObject({ message: expect.stringContaining('5 min') })
    await hasta(() => uv.llamadas.length === 1)
    expect(uv.llamadas[0]!.opciones.señal?.aborted).toBe(false)
    await hasta(() => uv.llamadas[0]!.opciones.señal?.aborted === true)
    await rechazo
    expect(existsSync(rutaMarcadorYtdlp(dir))).toBe(true)
  })

  it('una consulta o descarga cancelada no aborta uv', async () => {
    // La cancelación solo afecta a quien espera (esperarCancelable); el actualizador no recibe señal.
    const { act, uv } = montar()
    const p = act.actualizar()
    await hasta(() => uv.llamadas.length === 1)
    expect(uv.llamadas[0]!.opciones.señal?.aborted).toBe(false)
    uv.llamadas[0]!.terminar()
    await p
  })

  it('cerrar: espera a uv hasta el plazo y después lo mata', async () => {
    const { act, uv } = montar({ esperaCierreMs: 30 })
    const p = act.actualizar()
    const rechazo = expect(p).rejects.toBeDefined()
    await hasta(() => uv.llamadas.length === 1)
    const t0 = Date.now()
    await act.cerrar()
    expect(Date.now() - t0).toBeGreaterThanOrEqual(25)
    expect(uv.llamadas[0]!.opciones.señal?.aborted).toBe(true)
    await rechazo
    expect(existsSync(rutaMarcadorYtdlp(dir))).toBe(true)
  })

  it('cerrar: si uv acaba dentro del plazo no se mata', async () => {
    const { act, uv } = montar({ esperaCierreMs: 500 })
    const p = act.actualizar()
    await hasta(() => uv.llamadas.length === 1)
    const c = act.cerrar()
    uv.llamadas[0]!.terminar()
    await c
    await p
    expect(uv.llamadas[0]!.opciones.señal?.aborted).toBe(false)
    expect(existsSync(rutaMarcadorYtdlp(dir))).toBe(false)
  })

  it('tras cerrar no arranca ninguna actualización pendiente', async () => {
    const { act, uv, cerrojo } = montar()
    let soltar: () => void = () => undefined
    const lector = cerrojo.conLectura(() => new Promise<void>((r) => (soltar = r)))
    await reposo()
    const p = act.actualizar()
    const rechazo = expect(p).rejects.toBeDefined()
    const c = act.cerrar()
    soltar()
    await lector
    await c
    await rechazo
    expect(uv.llamadas).toHaveLength(0)
    expect(existsSync(rutaMarcadorYtdlp(dir))).toBe(false)
  })

  it('en desarrollo es un no-op registrado que respeta el cerrojo, el marcador y el retardo', async () => {
    const registrar = vi.fn()
    const alCompletar = vi.fn()
    const { act, uv } = montar({ noop: true, retardoNoopMs: 60, registrar, alCompletar })
    const t0 = Date.now()
    const p = act.actualizar()
    await reposo()
    expect(await hayMarcadorYtdlp(dir)).toBe(true)
    const r = await p
    expect(Date.now() - t0).toBeGreaterThanOrEqual(55)
    expect(r).toMatchObject({ noop: true, anterior: '2025.1.1', nueva: '2025.1.1' })
    expect(uv.llamadas).toHaveLength(0)
    expect(await hayMarcadorYtdlp(dir)).toBe(false)
    expect(registrar).toHaveBeenCalledWith('info', expect.stringContaining('simulada'))
    expect(alCompletar).toHaveBeenCalledTimes(1)
  })
})

describe('versionYtDlp', () => {
  it('lee la versión del dist-info del venv (Unix y Windows) o devuelve null', async () => {
    expect(await versionYtDlp(join(dir, 'venv'), 'linux')).toBeNull()
    const sp = join(dir, 'venv', 'lib', 'python3.12', 'site-packages')
    await mkdir(join(sp, 'yt_dlp-2026.3.17.dist-info'), { recursive: true })
    expect(await versionYtDlp(join(dir, 'venv'), 'linux')).toBe('2026.3.17')
    const win = join(dir, 'w', 'Lib', 'site-packages')
    await mkdir(join(win, 'yt_dlp-2025.1.2.dist-info'), { recursive: true })
    await writeFile(join(win, 'otro.txt'), '')
    expect(await versionYtDlp(join(dir, 'w'), 'win32')).toBe('2025.1.2')
  })

  it('con site-packages pero sin dist-info de yt-dlp devuelve null', async () => {
    const sp = join(dir, 'v2', 'lib', 'python3.12', 'site-packages')
    await mkdir(join(sp, 'otro-1.0.dist-info'), { recursive: true })
    expect(await versionYtDlp(join(dir, 'v2'), 'darwin')).toBeNull()
  })
})

describe('iniciarMantenimientoYtdlp', () => {
  const ahora = new Date('2026-11-04T10:00:00Z')
  function plan(extra: Partial<Parameters<typeof iniciarMantenimientoYtdlp>[0]> = {}) {
    const actualizar = vi.fn(() => Promise.resolve({ anterior: null, nueva: null, noop: true }))
    const programadas: { fn: () => void; ms: number }[] = []
    const opciones = {
      actualizador: { actualizar },
      completa: () => true,
      youtubeActivo: true,
      ultimaComprobacion: () => null,
      hayMarcador: () => Promise.resolve(false),
      ahora: () => ahora,
      programar: (fn: () => void, ms: number) => {
        programadas.push({ fn, ms })
        return () => undefined
      },
      ...extra
    }
    return { actualizar, programadas, iniciar: () => iniciarMantenimientoYtdlp(opciones) }
  }

  it('fecha nula: programa la comprobación a los 60 s', async () => {
    const p = plan()
    await p.iniciar()
    expect(p.programadas).toHaveLength(1)
    expect(p.programadas[0]!.ms).toBe(60_000)
    expect(p.actualizar).not.toHaveBeenCalled()
    p.programadas[0]!.fn()
    expect(p.actualizar).toHaveBeenCalledWith({ motivo: 'semanal' })
  })

  it('menos de 7 días: no programa nada; más de 7 días: sí', async () => {
    const reciente = plan({ ultimaComprobacion: () => '2026-10-29T10:00:00Z' })
    await reciente.iniciar()
    expect(reciente.programadas).toHaveLength(0)
    const vieja = plan({ ultimaComprobacion: () => '2026-10-27T09:00:00Z' })
    await vieja.iniciar()
    expect(vieja.programadas).toHaveLength(1)
  })

  it('instalación no completa o YouTube desactivado: nada', async () => {
    const a = plan({ completa: () => false })
    await a.iniciar()
    const b = plan({ youtubeActivo: false, hayMarcador: () => Promise.resolve(true) })
    await b.iniciar()
    expect(a.programadas).toHaveLength(0)
    expect(b.programadas).toHaveLength(0)
    expect(a.actualizar).not.toHaveBeenCalled()
    expect(b.actualizar).not.toHaveBeenCalled()
  })

  it('con marcador repara enseguida, sin esperar los 60 s', async () => {
    const p = plan({
      hayMarcador: () => Promise.resolve(true),
      ultimaComprobacion: () => '2026-11-03T10:00:00Z'
    })
    await p.iniciar()
    expect(p.actualizar).toHaveBeenCalledWith({ reparar: true, motivo: 'reparacion' })
    expect(p.programadas).toHaveLength(0)
  })

  it('sin conexión se ignora y se registra; el fallo de reparación no lanza', async () => {
    const registrar = vi.fn()
    const p = plan({ registrar, hayMarcador: () => Promise.resolve(true) })
    p.actualizar.mockRejectedValue({ codigo: 'SIN_CONEXION' })
    await p.iniciar()
    await reposo()
    expect(registrar).toHaveBeenCalledWith('aviso', expect.stringContaining('sin conexión'))
  })
})
