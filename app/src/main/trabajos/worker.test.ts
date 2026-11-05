import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resultadoDiagnosticoSchema } from '../../shared'
import { procesosCon } from './procesosCon.testutil'
import { crearClienteWorker, resolverLanzador, type ErrorTrabajo, type Lanzador } from './worker'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'shinobi-worker-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('resolverLanzador', () => {
  it('desarrollo: uv run --project <repo>/worker', () => {
    const l = resolverLanzador({ modo: 'desarrollo', raizRepo: '/r', env: {} })
    expect(l.comando).toBe('uv')
    expect(l.argsBase).toEqual([
      'run',
      '--project',
      join('/r', 'worker'),
      'python',
      '-m',
      'shinobi_worker'
    ])
  })

  it('desarrollo: respeta SHINOBI_UV y la opción uv', () => {
    expect(
      resolverLanzador({ modo: 'desarrollo', raizRepo: '/r', env: { SHINOBI_UV: '/x/uv' } }).comando
    ).toBe('/x/uv')
    expect(
      resolverLanzador({
        modo: 'desarrollo',
        raizRepo: '/r',
        uv: '/y/uv',
        env: { SHINOBI_UV: '/x/uv' }
      }).comando
    ).toBe('/y/uv')
  })

  it('producción: venv del directorio de datos por SO', () => {
    const mac = resolverLanzador({ modo: 'produccion', datos: '/d', plataforma: 'darwin' })
    expect(mac.comando).toBe(join('/d', 'runtime', 'venv', 'bin', 'python'))
    expect(mac.argsBase).toEqual(['-m', 'shinobi_worker'])
    const win = resolverLanzador({
      modo: 'produccion',
      datos: '/d',
      plataforma: 'win32',
      rutaCodigoWorker: '/app/worker'
    })
    expect(win.comando).toBe(join('/d', 'runtime', 'venv', 'Scripts', 'python.exe'))
    expect(win.env).toEqual({ PYTHONPATH: '/app/worker' })
  })

  it('producción: antepone los scripts del venv al PATH (POSIX)', () => {
    const l = resolverLanzador({
      modo: 'produccion',
      datos: '/d',
      plataforma: 'linux',
      rutaCodigoWorker: '/app/worker',
      envBase: { PATH: '/usr/bin:/bin' }
    })
    expect(l.env).toEqual({
      PYTHONPATH: '/app/worker',
      PATH: '/d/runtime/venv/bin:/usr/bin:/bin'
    })
  })

  it('producción: PATH de Windows con ; y la clave original (Path)', () => {
    const l = resolverLanzador({
      modo: 'produccion',
      datos: 'C:\\Datos',
      plataforma: 'win32',
      rutaCodigoWorker: 'C:\\App\\resources\\worker',
      envBase: { Path: 'C:\\Windows' }
    })
    expect(l.env).toEqual({
      PYTHONPATH: 'C:\\App\\resources\\worker',
      Path: 'C:\\Datos\\runtime\\venv\\Scripts;C:\\Windows'
    })
  })

  it('producción: sin PATH previo solo el directorio de scripts', () => {
    const l = resolverLanzador({
      modo: 'produccion',
      datos: '/d',
      plataforma: 'darwin',
      envBase: {}
    })
    expect(l.env).toEqual({ PATH: '/d/runtime/venv/bin' })
  })
})

/** Worker falso en Node: el script recibe `comando --args json` y escribe lo que se le pida. */
function falso(script: string): Lanzador {
  return { comando: process.execPath, argsBase: ['-e', script] }
}
const ejecutarFalso = (script: string, dirRegistros?: string) =>
  crearClienteWorker({ lanzador: falso(script), ...(dirRegistros ? { dirRegistros } : {}) })

describe('ejecutar con worker falso', () => {
  it('entrega progreso, log y resultado; --args llega como un único JSON', async () => {
    const c = ejecutarFalso(`
      const args = JSON.parse(process.argv[process.argv.indexOf('--args') + 1]);
      process.stdout.write('{"tipo":"progreso","fase":"a","valor":0.5}\\n');
      process.stdout.write('{"tipo":"log","nivel":"info","mensaje":"hola"}\\n');
      process.stdout.write(JSON.stringify({tipo:'resultado',datos:{eco:args, cmd:process.argv[1]}})+'\\n');
    `)
    const alProgreso = vi.fn()
    const alLog = vi.fn()
    const raros = { texto: 'a b; rm -rf "x" $(y)', n: 1 }
    const r = await c.ejecutar('cmd', raros, { alProgreso, alLog })
    expect(r).toEqual({ eco: raros, cmd: 'cmd' })
    expect(alProgreso).toHaveBeenCalledWith({ tipo: 'progreso', fase: 'a', valor: 0.5 })
    expect(alLog).toHaveBeenCalledWith({ tipo: 'log', nivel: 'info', mensaje: 'hola' })
  })

  it('tolera líneas partidas, juntas, multibyte partido, no JSON y fuera de esquema', async () => {
    const c = ejecutarFalso(`
      const o = process.stdout;
      const esp = (ms) => new Promise((r) => setTimeout(r, ms));
      (async () => {
        const b = Buffer.from(JSON.stringify({tipo:'resultado',datos:{t:'日本語'}}) + '\\n');
        o.write('ruido que no es json\\n');
        o.write('{"tipo":"progreso","fase":"x","valor":7}\\n');
        o.write('{"tipo":"progreso","fase":"p","valor":0.1}\\n{"tipo":"progreso","fase":"p","valor":0.2}\\n');
        const corte = b.indexOf(0xE6) + 1; // dentro del primer carácter multibyte
        o.write(b.subarray(0, corte)); await esp(30); o.write(b.subarray(corte));
      })();
    `)
    const alProgreso = vi.fn()
    const alLog = vi.fn()
    const r = await c.ejecutar('x', {}, { alProgreso, alLog })
    expect(r).toEqual({ t: '日本語' })
    expect(alProgreso.mock.calls.map((a) => a[0].valor)).toEqual([0.1, 0.2])
    expect(alLog).toHaveBeenCalledTimes(2)
    expect(alLog.mock.calls[0]?.[0].mensaje).toContain('ruido que no es json')
  })

  it('mensaje error → rechaza con su código y adjunta últimas 50 líneas de stderr; stderr va al registro', async () => {
    const regs = join(dir, 'registros')
    const c = ejecutarFalso(
      `
      for (let i = 1; i <= 80; i++) process.stderr.write('linea ' + i + '\\n');
      process.stdout.write('{"tipo":"error","codigo":"SIN_CONEXION","mensaje":"sin red","reintentable":true}\\n');
      process.exitCode = 1;
    `,
      regs
    )
    const e = (await c.ejecutar('x', {}).catch((x: unknown) => x)) as ErrorTrabajo
    expect(e).toMatchObject({ codigo: 'SIN_CONEXION', mensaje: 'sin red', reintentable: true })
    const lineas = e.detalles?.split('\n') ?? []
    expect(lineas).toHaveLength(50)
    expect(lineas[0]).toBe('linea 31')
    expect(lineas[49]).toBe('linea 80')
    const archivo = readdirSync(regs).find((n) => /^worker-\d{4}-\d{2}-\d{2}\.log$/.test(n))
    expect(archivo).toBeDefined()
    expect(readFileSync(join(regs, archivo ?? ''), 'utf8')).toContain('linea 80')
  })

  it('código ≠ 0 sin mensaje error → PROCESO_TERMINADO reintentable con el código', async () => {
    const c = ejecutarFalso(`process.stderr.write('boom\\n'); process.exit(3)`)
    const e = (await c.ejecutar('x', {}).catch((x: unknown) => x)) as ErrorTrabajo
    expect(e.codigo).toBe('PROCESO_TERMINADO')
    expect(e.reintentable).toBe(true)
    expect(e.mensaje).toContain('código 3')
    expect(e.detalles).toBe('boom')
  })

  it.skipIf(process.platform === 'win32')(
    'proceso muerto por SIGKILL sin cancelar → PROCESO_TERMINADO con la señal',
    async () => {
      const c = ejecutarFalso(`process.kill(process.pid, 'SIGKILL')`)
      await expect(c.ejecutar('x', {})).rejects.toMatchObject({
        codigo: 'PROCESO_TERMINADO',
        reintentable: true,
        mensaje: expect.stringContaining('SIGKILL') as string
      })
    }
  )

  it.skipIf(process.platform !== 'win32')(
    'salida brusca con código 137 (Windows) → PROCESO_TERMINADO',
    async () => {
      const c = ejecutarFalso(`process.exit(137)`)
      await expect(c.ejecutar('x', {})).rejects.toMatchObject({
        codigo: 'PROCESO_TERMINADO',
        mensaje: expect.stringContaining('137') as string
      })
    }
  )

  it('si el gestor lo cancela, sigue siendo CANCELADO (no PROCESO_TERMINADO)', async () => {
    const c = ejecutarFalso(`setTimeout(() => {}, 30000)`)
    const ac = new AbortController()
    const p = c.ejecutar('x', {}, { señal: ac.signal })
    setTimeout(() => ac.abort(), 200)
    await expect(p).rejects.toMatchObject({ codigo: 'CANCELADO' })
  })

  it('salida 0 sin resultado → ERROR_INTERNO', async () => {
    const c = ejecutarFalso(`process.exit(0)`)
    await expect(c.ejecutar('x', {})).rejects.toMatchObject({ codigo: 'ERROR_INTERNO' })
  })

  it('intérprete inexistente → RUNTIME_NO_DISPONIBLE', async () => {
    const c = crearClienteWorker({
      lanzador: { comando: join(dir, 'no-existe'), argsBase: [] }
    })
    await expect(c.ejecutar('x', {})).rejects.toMatchObject({ codigo: 'RUNTIME_NO_DISPONIBLE' })
  })

  it('instalación no completa (disponible → false): RUNTIME_NO_DISPONIBLE sin lanzar', async () => {
    const marca = join(dir, 'lanzado')
    const c = crearClienteWorker({
      lanzador: falso(`require('fs').writeFileSync(${JSON.stringify(marca)}, '')`),
      disponible: () => false
    })
    await expect(c.ejecutar('x', {})).rejects.toMatchObject({ codigo: 'RUNTIME_NO_DISPONIBLE' })
    expect(existsSync(marca)).toBe(false)
  })

  it('señal ya abortada → CANCELADO sin lanzar', async () => {
    const c = ejecutarFalso(
      `require('fs').writeFileSync(${JSON.stringify(join(dir, 'lanzado'))}, '')`
    )
    const ac = new AbortController()
    ac.abort()
    await expect(c.ejecutar('x', {}, { señal: ac.signal })).rejects.toMatchObject({
      codigo: 'CANCELADO'
    })
    expect(existsSync(join(dir, 'lanzado'))).toBe(false)
  })
})

const enPosix = process.platform !== 'win32'

describe.skipIf(!enPosix)('cancelación (POSIX)', () => {
  it('mata el árbol de procesos, SIGKILL si ignora SIGTERM', async () => {
    const marca = `marca-${Date.now()}`
    // El proceso ignora SIGTERM y lanza un nieto que también vive; ambos deben morir.
    const c = crearClienteWorker({
      lanzador: falso(`
        process.on('SIGTERM', () => {});
        require('child_process').spawn(process.execPath, ['-e', 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)', '${marca}'], {stdio:'ignore'});
        process.stdout.write('{"tipo":"progreso","fase":"a","valor":null}\\n');
        setInterval(() => {}, 1000);
      `),
      esperaKillMs: 300
    })
    const ac = new AbortController()
    const p = c.ejecutar('x', {}, { señal: ac.signal, alProgreso: () => ac.abort() })
    await expect(p).rejects.toMatchObject({ codigo: 'CANCELADO' })
    await new Promise((r) => setTimeout(r, 100))
    expect(procesosCon(marca)).toBe(0)
  })
})

/* ---- Integración con el comando `demo` del worker real (0003) ---- */

const raizRepo = resolve(__dirname, '..', '..', '..', '..')
const uv = process.env.SHINOBI_UV ?? 'uv'
function hayUv(): boolean {
  try {
    execFileSync(uv, ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

describe.skipIf(!hayUv())('integración con el worker real (demo)', () => {
  const cliente = (): ReturnType<typeof crearClienteWorker> =>
    crearClienteWorker({
      lanzador: resolverLanzador({ modo: 'desarrollo', raizRepo, uv }),
      dirRegistros: join(dir, 'registros'),
      esperaKillMs: 3000
    })

  it('progreso y resultado', async () => {
    const progresos: { fase: string; valor: number | null }[] = []
    const r = await cliente().ejecutar(
      'demo',
      { segundos: 0.5, indeterminado_s: 0.2 },
      { alProgreso: (m) => progresos.push({ fase: m.fase, valor: m.valor }) }
    )
    expect(r).toEqual({ segundos: 0.5 })
    expect(progresos[0]).toEqual({ fase: 'cargando', valor: null })
    expect(progresos.at(-1)).toEqual({ fase: 'procesando', valor: 1 })
  }, 60_000)

  it('error simulado DEMO_FALLO reintentable', async () => {
    await expect(cliente().ejecutar('demo', { segundos: 1, fallar_en: 0.5 })).rejects.toMatchObject(
      {
        codigo: 'DEMO_FALLO',
        reintentable: true
      }
    )
  }, 60_000)

  it('argumentos no válidos → ARGUMENTOS_NO_VALIDOS', async () => {
    await expect(cliente().ejecutar('demo', { segundos: -1 })).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
  }, 60_000)

  it('cancelación a mitad: CANCELADO, sin huérfanos y el llamador limpia el parcial', async () => {
    const parcial = join(dir, 'parcial.tmp')
    const ac = new AbortController()
    const p = cliente().ejecutar(
      'demo',
      { segundos: 30, ruta_parcial: parcial },
      {
        señal: ac.signal,
        alProgreso: (m) => m.fase === 'procesando' && (m.valor ?? 0) > 0.02 && ac.abort()
      }
    )
    await expect(p).rejects.toMatchObject({ codigo: 'CANCELADO' })
    expect(existsSync(parcial)).toBe(true) // el worker muere por SIGTERM sin limpiar
    rmSync(parcial, { force: true }) // limpieza a cargo del llamador
    await new Promise((r) => setTimeout(r, 200))
    expect(procesosCon(parcial)).toBe(0)
  }, 60_000)

  it('diagnostico: resultado válido con el esquema compartido (cpu/generico sin torch en CI)', async () => {
    const progresos: { fase: string; valor: number | null }[] = []
    const r = await cliente().ejecutar(
      'diagnostico',
      { perfil_previsto: 'cuda' },
      { alProgreso: (m) => progresos.push({ fase: m.fase, valor: m.valor }) }
    )
    const d = resultadoDiagnosticoSchema.parse(r)
    expect(progresos[0]).toEqual({ fase: 'diagnostico', valor: null })
    // Sin el extra `separacion` torch no está: se rebaja a cpu/generico.
    if (d.torch === null) {
      expect(d).toMatchObject({ perfil: 'cpu', dispositivo: 'cpu', motivo_rebaja: 'generico' })
    }
  }, 60_000)
})
