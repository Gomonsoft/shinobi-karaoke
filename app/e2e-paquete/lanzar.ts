import { execFile, spawn } from 'node:child_process'
import { setTimeout as esperar } from 'node:timers/promises'
import { promisify } from 'node:util'
import { chromium, type Browser } from '@playwright/test'

interface Arranque {
  bin: string
  datos: string
  env?: NodeJS.ProcessEnv
  args?: string[]
}

export function iniciarProceso({ bin, datos, env, args = [] }: Arranque) {
  const entorno = { ...process.env }
  // El proceso de prueba controla los valores de cada arranque, incluso al ejecutarse desde un IDE.
  for (const clave of Object.keys(entorno)) {
    if (/^(SHINOBI_|ELECTRON_|NODE_OPTIONS$)/i.test(clave)) delete entorno[clave]
  }
  const proceso = spawn(bin, args, {
    env: { ...entorno, ...env, SHINOBI_DATOS: datos },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let stderr = ''
  let stdout = ''
  let termino = false
  const salida = new Promise<number | null>((resolve, reject) => {
    proceso.once('error', reject)
    proceso.once('exit', (codigo) => {
      termino = true
      resolve(codigo)
    })
  })
  // La limpieza puede adelantarse a la espera de salida si falla el arranque.
  void salida.catch(() => {})
  proceso.stderr.setEncoding('utf8').on('data', (trozo: string) => {
    stderr = (stderr + trozo).slice(-64_000)
  })
  proceso.stdout.setEncoding('utf8').on('data', (trozo: string) => {
    stdout = (stdout + trozo).slice(-64_000)
  })

  async function cerrar(): Promise<void> {
    const pid = proceso.pid
    if (pid === undefined) return
    if (process.platform === 'win32') {
      if (!termino) {
        try {
          await promisify(execFile)('taskkill', ['/PID', String(pid), '/T', '/F'], {
            timeout: 5000
          })
        } catch (error) {
          if (!termino) throw error
        }
      }
    } else {
      const senal = (tipo: NodeJS.Signals): boolean => {
        try {
          process.kill(-pid, tipo)
          return true
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
          return false
        }
      }
      if (senal('SIGTERM')) {
        await Promise.race([salida, esperar(1000)])
        senal('SIGKILL')
      }
    }
    await Promise.race([
      salida,
      esperar(5000, undefined, { ref: false }).then(() => {
        throw new Error(`El proceso ${pid} sigue vivo tras el cierre`)
      })
    ])
  }

  return {
    salida,
    cerrar,
    stderr: () => stderr,
    logs: () => `stdout:\n${stdout}\nstderr:\n${stderr}`
  }
}

export async function lanzarPaquete(opciones: Arranque) {
  const proceso = iniciarProceso({
    ...opciones,
    args: ['--remote-debugging-port=0', ...(opciones.args ?? [])]
  })
  const limite = Date.now() + 45_000
  const restante = (): number => Math.max(1, limite - Date.now())
  let navegador: Browser | undefined
  let esperarDevTools = true

  const cerrar = async (): Promise<void> => {
    try {
      await navegador?.close()
    } finally {
      await proceso.cerrar()
    }
  }

  try {
    const puerto = await Promise.race([
      proceso.salida.then((codigo) => {
        throw new Error(`El paquete salió antes de abrir DevTools (código ${codigo})`)
      }),
      (async () => {
        while (esperarDevTools && Date.now() < limite) {
          const ws = /DevTools listening on (ws:\/\/\S+)\s/.exec(proceso.stderr())?.[1]
          if (ws) return new URL(ws).port
          await esperar(50, undefined, { ref: false })
        }
        throw new Error('DevTools no anunció su puerto en 45 s')
      })()
    ])
    navegador = await chromium.connectOverCDP(`http://127.0.0.1:${puerto}`, {
      timeout: restante()
    })
    const contexto = navegador.contexts()[0]
    if (!contexto) throw new Error('El paquete no abrió un contexto de Chromium')
    const pagina =
      contexto.pages()[0] ?? (await contexto.waitForEvent('page', { timeout: restante() }))
    return { pagina, navegador, cerrar }
  } catch (error) {
    const diagnostico = proceso.logs()
    await cerrar()
    throw new Error(
      `No se pudo abrir el paquete ${opciones.bin}: ${String(error)}\n${diagnostico}`,
      {
        cause: error
      }
    )
  } finally {
    esperarDevTools = false
  }
}
