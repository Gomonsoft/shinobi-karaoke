import { spawn, type ChildProcess } from 'node:child_process'
import { join, posix, win32 } from 'node:path'
import { parsearLineaWorker, type MensajeWorker } from '../../shared/protocolo'
import { LectorLineas } from './lineas'
import { ColaLineas, RegistroWorker } from './registro'

type Progreso = Extract<MensajeWorker, { tipo: 'progreso' }>
type Log = Extract<MensajeWorker, { tipo: 'log' }>

/** Error con el que rechaza `ejecutar`. */
export interface ErrorTrabajo {
  codigo: string
  mensaje: string
  reintentable: boolean
  /** Últimas líneas de salida del worker (para "Copiar detalles"). */
  detalles?: string
}

/** Cómo lanzar el worker: ejecutable, argumentos previos al comando y entorno. */
export interface Lanzador {
  comando: string
  argsBase: string[]
  cwd?: string
  env?: Record<string, string>
}

export interface OpcionesLanzadorDesarrollo {
  modo: 'desarrollo'
  /** Raíz del repositorio (contiene `worker/`). */
  raizRepo: string
  /** Ejecutable de uv. Por defecto `SHINOBI_UV` o `uv` del PATH. */
  uv?: string
  env?: Record<string, string | undefined>
}

export interface OpcionesLanzadorProduccion {
  modo: 'produccion'
  /** Directorio de datos de la app (`<datos>/runtime/venv`). */
  datos: string
  plataforma: NodeJS.Platform
  /** Carpeta con el paquete `shinobi_worker` empaquetado (se añade a PYTHONPATH). */
  rutaCodigoWorker?: string
  /** Entorno del que parte el hijo: si se da, el directorio de scripts del venv se antepone a su PATH. */
  envBase?: Record<string, string | undefined>
}

/** Resuelve el intérprete del worker. Función pura. */
export function resolverLanzador(
  o: OpcionesLanzadorDesarrollo | OpcionesLanzadorProduccion
): Lanzador {
  if (o.modo === 'desarrollo') {
    const proyecto = join(o.raizRepo, 'worker')
    const uv = o.uv ?? o.env?.SHINOBI_UV ?? 'uv'
    return {
      comando: uv,
      argsBase: ['run', '--project', proyecto, 'python', '-m', 'shinobi_worker']
    }
  }
  const venv = join(o.datos, 'runtime', 'venv')
  const python =
    o.plataforma === 'win32' ? join(venv, 'Scripts', 'python.exe') : join(venv, 'bin', 'python')
  const env: Record<string, string> = { PYTHONDONTWRITEBYTECODE: '1' }
  if (o.rutaCodigoWorker) env.PYTHONPATH = o.rutaCodigoWorker
  if (o.envBase) {
    const win = o.plataforma === 'win32'
    const ruta = win ? win32 : posix
    const scripts = ruta.join(o.datos, 'runtime', 'venv', win ? 'Scripts' : 'bin')
    const clave =
      Object.keys(o.envBase).find((k) => k.toUpperCase() === 'PATH') ?? (win ? 'Path' : 'PATH')
    const previo = o.envBase[clave]
    env[clave] = previo ? `${scripts}${win ? ';' : ':'}${previo}` : scripts
  }
  return {
    comando: python,
    argsBase: ['-m', 'shinobi_worker'],
    ...(Object.keys(env).length > 0 ? { env } : {})
  }
}

export interface OpcionesEjecucion {
  alProgreso?: (m: Progreso) => void
  alLog?: (m: Log) => void
  señal?: AbortSignal
  /** Variables de entorno extra solo para este proceso (0066: `SHINOBI_INTENTO`). */
  env?: Record<string, string>
}

export interface ConfigCliente {
  lanzador: Lanzador
  /** Directorio `registros/` donde escribir `worker-<fecha>.log`. */
  dirRegistros?: string
  /** Espera entre SIGTERM y SIGKILL (ms). Por defecto 3000. */
  esperaKillMs?: number
  plataforma?: NodeJS.Platform
  /** Si devuelve `false` (instalación no completa) no se lanza ningún proceso: `RUNTIME_NO_DISPONIBLE`. */
  disponible?: () => boolean
}

export const LINEAS_DETALLE = 50

const error = (codigo: string, mensaje: string, reintentable = false): ErrorTrabajo => ({
  codigo,
  mensaje,
  reintentable
})

/** Termina el proceso y todo su árbol. Devuelve una función que cancela el temporizador de SIGKILL. */
export function terminarArbol(
  hijo: ChildProcess,
  plataforma: NodeJS.Platform,
  esperaKillMs: number
): () => void {
  const pid = hijo.pid
  if (pid === undefined) return () => undefined
  if (plataforma === 'win32') {
    const t = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      shell: false,
      windowsHide: true,
      stdio: 'ignore'
    })
    t.on('error', () => hijo.kill())
    return () => undefined
  }
  const enviar = (s: NodeJS.Signals): void => {
    try {
      process.kill(-pid, s) // grupo: el hijo es líder (detached)
    } catch {
      // el grupo ya no existe
    }
  }
  enviar('SIGTERM')
  const temporizador = setTimeout(() => enviar('SIGKILL'), esperaKillMs)
  return () => clearTimeout(temporizador)
}

export function crearClienteWorker(config: ConfigCliente) {
  const plataforma = config.plataforma ?? process.platform
  const registro = config.dirRegistros ? new RegistroWorker(config.dirRegistros) : undefined

  function ejecutar(
    comando: string,
    args: Record<string, unknown>,
    { alProgreso, alLog, señal, env: envExtra }: OpcionesEjecucion = {}
  ): Promise<Record<string, unknown>> {
    return new Promise((resolver, rechazar) => {
      if (señal?.aborted) {
        rechazar(error('CANCELADO', 'Trabajo cancelado'))
        return
      }
      if (config.disponible && !config.disponible()) {
        rechazar(error('RUNTIME_NO_DISPONIBLE', 'El motor de audio no está instalado'))
        return
      }
      const { lanzador } = config
      const cola = new ColaLineas(LINEAS_DETALLE)
      let hijo: ChildProcess
      try {
        hijo = spawn(
          lanzador.comando,
          [...lanzador.argsBase, comando, '--args', JSON.stringify(args)],
          {
            shell: false,
            detached: plataforma !== 'win32',
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            ...(lanzador.cwd ? { cwd: lanzador.cwd } : {}),
            env: {
              ...process.env,
              PYTHONUNBUFFERED: '1',
              PYTHONIOENCODING: 'utf-8',
              ...lanzador.env,
              ...envExtra
            }
          }
        )
      } catch (e) {
        rechazar(error('RUNTIME_NO_DISPONIBLE', `No se pudo lanzar el worker: ${String(e)}`))
        return
      }

      let resultado: Record<string, unknown> | undefined
      let errorWorker: ErrorTrabajo | undefined
      let falloLanzar: ErrorTrabajo | undefined
      let cancelado = false
      let cancelarKill: () => void = () => undefined

      const alAbortar = (): void => {
        if (cancelado) return
        cancelado = true
        cancelarKill = terminarArbol(hijo, plataforma, config.esperaKillMs ?? 3000)
      }
      señal?.addEventListener('abort', alAbortar, { once: true })

      const registrarLinea = (origen: string, linea: string): void => {
        cola.añadir(linea)
        registro?.escribir(`[${origen}] ${linea}`)
      }

      const tratarStdout = (linea: string): void => {
        const r = parsearLineaWorker(linea)
        if (!r.ok) {
          registrarLinea('stdout', linea)
          alLog?.({
            tipo: 'log',
            nivel: 'warning',
            mensaje: `Salida no válida del worker: ${linea}`
          })
          return
        }
        const m = r.mensaje
        if (m.tipo === 'progreso') alProgreso?.(m)
        else if (m.tipo === 'log') alLog?.(m)
        else if (m.tipo === 'resultado') resultado = m.datos
        else errorWorker = { codigo: m.codigo, mensaje: m.mensaje, reintentable: m.reintentable }
      }

      const lectorOut = new LectorLineas()
      const lectorErr = new LectorLineas()
      hijo.stdout?.on('data', (c: Buffer) => lectorOut.empujar(c).forEach(tratarStdout))
      hijo.stderr?.on('data', (c: Buffer) =>
        lectorErr.empujar(c).forEach((l) => registrarLinea('stderr', l))
      )

      hijo.on('error', (e: NodeJS.ErrnoException) => {
        falloLanzar = error(
          'RUNTIME_NO_DISPONIBLE',
          `No se pudo lanzar el worker (${lanzador.comando}): ${e.code ?? e.message}`
        )
        // Si nunca llegó a arrancar, 'close' puede no emitirse.
        if (hijo.pid === undefined) finalizar(null)
      })

      let terminado = false
      const finalizar = (codigoSalida: number | null, señalSalida: string | null = null): void => {
        if (terminado) return
        terminado = true
        cancelarKill()
        señal?.removeEventListener('abort', alAbortar)
        lectorOut.terminar().forEach(tratarStdout)
        lectorErr.terminar().forEach((l) => registrarLinea('stderr', l))

        if (falloLanzar) return rechazar(falloLanzar)
        if (cancelado) return rechazar(error('CANCELADO', 'Trabajo cancelado'))
        const detalles = cola.texto()
        const conDetalles = (e: ErrorTrabajo): ErrorTrabajo => (detalles ? { ...e, detalles } : e)
        if (errorWorker) return rechazar(conDetalles(errorWorker))
        if (codigoSalida === 0 && resultado) return resolver(resultado)
        if (codigoSalida === 0) {
          return rechazar(
            conDetalles(error('ERROR_INTERNO', 'El worker terminó sin devolver resultado'))
          )
        }
        // El sistema mató el proceso (p. ej. el OOM killer) o salió con error sin dejar línea de
        // `error`, y el gestor no lo canceló: la política de cada comando decide qué hacer (0063).
        const como = señalSalida
          ? `por la señal ${señalSalida}`
          : `con código ${String(codigoSalida)}`
        rechazar(
          conDetalles({
            codigo: 'PROCESO_TERMINADO',
            mensaje: `El worker terminó ${como} sin informar del error`,
            reintentable: true
          })
        )
      }
      hijo.on('close', (codigo, señal) => finalizar(codigo, señal))
    })
  }

  return { ejecutar }
}

export type ClienteWorker = ReturnType<typeof crearClienteWorker>

let clienteGlobal: ClienteWorker | undefined

/** Configura el cliente que usa `ejecutar` (se llama una vez al arrancar la app). */
export function configurarWorker(config: ConfigCliente): void {
  clienteGlobal = crearClienteWorker(config)
}

export function ejecutar(
  comando: string,
  args: Record<string, unknown>,
  opciones?: OpcionesEjecucion
): Promise<Record<string, unknown>> {
  if (!clienteGlobal) {
    return Promise.reject(
      error('RUNTIME_NO_DISPONIBLE', 'El cliente del worker no está configurado')
    )
  }
  return clienteGlobal.ejecutar(comando, args, opciones)
}
