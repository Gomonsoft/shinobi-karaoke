import { spawn, type ChildProcess } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { CodigoError } from '../../shared'
import { LectorLineas } from '../trabajos/lineas'
import { ColaLineas, fechaLocal } from '../trabajos/registro'
import { terminarArbol } from '../trabajos/worker'

/** Ejecución de uv y clasificación de sus errores (tarea 0034, ADR 0009 §3 y §8). */

/** Error del gestor de runtime con código estable del catálogo. */
export class ErrorRuntime extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
    /** Últimas líneas de salida (para "Copiar detalles"). */
    readonly detalles = ''
  ) {
    super(mensaje)
    this.name = 'ErrorRuntime'
  }
}

export interface ResultadoUv {
  codigo: number
  /** Salida estándar (hasta 64 KB). */
  stdout: string
  /** Últimas 50 líneas de stdout y stderr, en orden de llegada. */
  ultimasLineas: string[]
  cancelado: boolean
}

export interface OpcionesUv {
  env: Record<string, string>
  señal?: AbortSignal
}

/** Puerto: lanza uv. Resuelve cuando el proceso (y su árbol) ha terminado. */
export interface EjecutorUv {
  ejecutar(args: string[], opciones: OpcionesUv): Promise<ResultadoUv>
}

export const LINEAS_DETALLE_UV = 50
const MAX_STDOUT = 64 * 1024

export interface ConfigEjecutorUv {
  /** Binario de uv (`process.resourcesPath/bin/uv`, `SHINOBI_UV` o `uv`). */
  uv: string
  /** Argumentos antes de los de uv (solo pruebas: `[scriptFalso]` con `uv = process.execPath`). */
  argsPrevios?: string[]
  /** `registros/`: stdout y stderr van a `runtime-<fecha>.log`. */
  dirRegistros?: string
  plataforma?: NodeJS.Platform
  esperaKillMs?: number
  /** Solo pruebas: unir al entorno final. */
  envExtra?: Record<string, string>
}

export function crearEjecutorUv(
  config: ConfigEjecutorUv
): EjecutorUv & { ultimasLineas(): string[] } {
  const plataforma = config.plataforma ?? process.platform
  const recientes = new ColaLineas(LINEAS_DETALLE_UV)
  let preparado = false

  const registrar = (origen: string, linea: string): void => {
    recientes.añadir(linea)
    if (!config.dirRegistros) return
    try {
      if (!preparado) {
        mkdirSync(config.dirRegistros, { recursive: true })
        preparado = true
      }
      const ahora = new Date()
      appendFileSync(
        join(config.dirRegistros, `runtime-${fechaLocal(ahora)}.log`),
        `${ahora.toISOString()} [${origen}] ${linea}\n`,
        'utf8'
      )
    } catch {
      // un fallo de disco no debe romper la instalación
    }
  }

  return {
    ultimasLineas: () => (recientes.texto() === '' ? [] : recientes.texto().split('\n')),
    ejecutar(args, { env, señal }) {
      return new Promise((resolver, rechazar) => {
        const cola = new ColaLineas(LINEAS_DETALLE_UV)
        if (señal?.aborted) {
          resolver({ codigo: -1, stdout: '', ultimasLineas: [], cancelado: true })
          return
        }
        registrar('uv', `$ uv ${args.join(' ')}`)
        let hijo: ChildProcess
        try {
          hijo = spawn(config.uv, [...(config.argsPrevios ?? []), ...args], {
            shell: false,
            detached: plataforma !== 'win32',
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...env, ...config.envExtra }
          })
        } catch (e) {
          rechazar(new ErrorRuntime('RUNTIME_NO_DISPONIBLE', `No se pudo lanzar uv: ${String(e)}`))
          return
        }
        let stdout = ''
        let cancelado = false
        let cancelarKill: () => void = () => undefined
        let fallo: ErrorRuntime | undefined
        const alAbortar = (): void => {
          if (cancelado) return
          cancelado = true
          cancelarKill = terminarArbol(hijo, plataforma, config.esperaKillMs ?? 3000)
        }
        señal?.addEventListener('abort', alAbortar, { once: true })

        const lectorOut = new LectorLineas()
        const lectorErr = new LectorLineas()
        const linea = (origen: string) => (l: string) => {
          cola.añadir(l)
          registrar(origen, l)
        }
        hijo.stdout?.on('data', (c: Buffer) => {
          if (stdout.length < MAX_STDOUT) stdout += c.toString('utf8')
          lectorOut.empujar(c).forEach(linea('stdout'))
        })
        hijo.stderr?.on('data', (c: Buffer) => lectorErr.empujar(c).forEach(linea('stderr')))
        hijo.on('error', (e: NodeJS.ErrnoException) => {
          fallo = new ErrorRuntime(
            'RUNTIME_NO_DISPONIBLE',
            `No se pudo lanzar uv (${config.uv}): ${e.code ?? e.message}`
          )
          if (hijo.pid === undefined) finalizar(null)
        })
        let terminado = false
        const finalizar = (codigo: number | null): void => {
          if (terminado) return
          terminado = true
          cancelarKill()
          señal?.removeEventListener('abort', alAbortar)
          lectorOut.terminar().forEach(linea('stdout'))
          lectorErr.terminar().forEach(linea('stderr'))
          if (fallo) return rechazar(fallo)
          const texto = cola.texto()
          resolver({
            codigo: codigo ?? -1,
            stdout,
            ultimasLineas: texto === '' ? [] : texto.split('\n'),
            cancelado
          })
        }
        hijo.on('close', (codigo) => finalizar(codigo))
      })
    }
  }
}

/**
 * Entorno aislado de uv (ADR 0009 §3): sin `VIRTUAL_ENV`, `PYTHONPATH`, `PYTHONHOME` ni `UV_*`
 * del usuario; caché e intérpretes dentro de `runtime/`; solo Python gestionado.
 */
export function entornoUv(
  dirRuntime: string,
  base: Record<string, string | undefined> = process.env
): Record<string, string> {
  const salida: Record<string, string> = {}
  for (const [k, v] of Object.entries(base)) {
    if (v === undefined) continue
    const K = k.toUpperCase()
    if (K === 'VIRTUAL_ENV' || K === 'PYTHONPATH' || K === 'PYTHONHOME' || K.startsWith('UV_'))
      continue
    salida[k] = v
  }
  salida.UV_CACHE_DIR = join(dirRuntime, 'cache-uv')
  salida.UV_PYTHON_INSTALL_DIR = join(dirRuntime, 'python')
  salida.UV_PYTHON_PREFERENCE = 'only-managed'
  salida.UV_NO_PROGRESS = '1'
  salida.NO_COLOR = '1'
  return salida
}

/** Traduce el texto de error de uv a un código del catálogo (fixtures en `__fixtures__/uv-stderr`). */
export function clasificarStderr(texto: string): CodigoError {
  if (
    /no space left on device|os error 28\b|os error 112\b|espacio en disco insuficiente|not enough space on the disk/i.test(
      texto
    )
  )
    return 'SIN_ESPACIO'
  if (/hash mismatch|hashes? (?:do not|don't) match|checksum mismatch/i.test(texto))
    return 'VERIFICACION_FALLIDA'
  if (
    /HTTP status server error \(5\d\d|\b5\d\d (?:Service Unavailable|Bad Gateway|Gateway Timeout|Internal Server Error)|\b429\b|too many requests|timed out|network timeout/i.test(
      texto
    )
  )
    return 'SERVICIO_NO_DISPONIBLE'
  if (
    /dns error|error resolving dns|failed to lookup address|\(Connect\)|connection refused|network is unreachable|no route to host|error sending request|connection reset|ENOTFOUND|ECONNREFUSED/i.test(
      texto
    )
  )
    return 'SIN_CONEXION'
  return 'ERROR_INTERNO'
}

export interface OpcionesResolverUv {
  empaquetada: boolean
  /** `process.resourcesPath` (solo empaquetada). */
  dirRecursos: string
  plataforma: NodeJS.Platform
  env?: Record<string, string | undefined>
}

/**
 * Binario de uv (ADR 0009 §3): empaquetada, `resources/bin/uv[.exe]` (tarea 0025);
 * sin empaquetar, `SHINOBI_UV` o `uv` del PATH. Empaquetada se ignora `SHINOBI_UV`.
 */
export function resolverUv(o: OpcionesResolverUv): string {
  if (o.empaquetada) return join(o.dirRecursos, 'bin', o.plataforma === 'win32' ? 'uv.exe' : 'uv')
  const v = o.env?.SHINOBI_UV
  return v !== undefined && v !== '' ? v : 'uv'
}
