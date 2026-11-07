import { access, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { escribirJsonAtomico } from '../persistencia'
import type { CerrojoYtdlp, OpcionesLecturaCerrojo } from '../fuente/youtube'
import { interpreteVenv } from './gestor'
import { clasificarStderr, entornoUv, ErrorRuntime, type EjecutorUv } from './uv'

/**
 * Actualización de yt-dlp (tarea 0050, ADR 0003 y ADR 0009 §7 y Revisiones): cerrojo
 * lectores/escritor, `actualizarYtDlp` de un solo vuelo, marcador de interrupción y
 * planificación (semanal, al arrancar con marcador). Todo es automático y silencioso.
 */

export const LIMITE_ACTUALIZACION_MS = 5 * 60_000
export const ESPERA_CIERRE_MS = 10_000
export const RETARDO_COMPROBACION_MS = 60_000
export const PERIODO_COMPROBACION_MS = 7 * 24 * 3600_000

// --- Cerrojo lectores/escritor con prioridad al escritor ----------------------------------------

interface Lector {
  entrar(): void
}

/**
 * Lectores: cada proceso `info-youtube` / `descargar-youtube`. Escritor: la actualización.
 * El escritor espera a los lectores activos; mientras está pendiente o en curso no entra ningún
 * lector nuevo. Sin reentrada: quien tiene una lectura no puede pedir la escritura.
 */
export class CerrojoLecturaEscritura implements CerrojoYtdlp {
  private lectores = 0
  private escribiendo = false
  private readonly escritores: (() => void)[] = []
  private readonly lectoresEsperando: Lector[] = []
  private oyentesFin: (() => void)[] = []

  /** Hay un escritor pendiente o en curso. */
  enMantenimiento(): boolean {
    return this.escribiendo || this.escritores.length > 0
  }

  /** Avisa una sola vez cuando termina el mantenimiento. */
  alTerminarMantenimiento(cb: () => void): void {
    this.oyentesFin.push(cb)
  }

  async conLectura<T>(fn: () => Promise<T>, opciones?: OpcionesLecturaCerrojo): Promise<T> {
    if (this.enMantenimiento()) {
      try {
        opciones?.alEsperar?.()
      } catch {
        // un oyente defectuoso no debe bloquear la lectura
      }
      await new Promise<void>((ok, fallo) => {
        const lector: Lector = {
          entrar: () => {
            this.lectores++
            opciones?.señal?.removeEventListener('abort', alAbortar)
            ok()
          }
        }
        const alAbortar = (): void => {
          const i = this.lectoresEsperando.indexOf(lector)
          if (i >= 0) this.lectoresEsperando.splice(i, 1)
          fallo({ codigo: 'CANCELADO', mensaje: 'Cancelado', reintentable: false })
        }
        if (opciones?.señal?.aborted) return alAbortar()
        opciones?.señal?.addEventListener('abort', alAbortar, { once: true })
        this.lectoresEsperando.push(lector)
      })
    } else {
      this.lectores++
    }
    try {
      return await fn()
    } finally {
      this.lectores--
      this.avanzar()
    }
  }

  async conEscritura<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((ok) => {
      this.escritores.push(ok)
      this.avanzar()
    })
    try {
      return await fn()
    } finally {
      this.escribiendo = false
      this.avanzar()
      if (!this.enMantenimiento()) {
        const oyentes = this.oyentesFin
        this.oyentesFin = []
        for (const cb of oyentes) cb()
      }
    }
  }

  private avanzar(): void {
    if (this.escribiendo) return
    if (this.escritores.length > 0) {
      if (this.lectores === 0) {
        this.escribiendo = true
        this.escritores.shift()?.()
      }
      return
    }
    for (const l of this.lectoresEsperando.splice(0)) l.entrar()
  }
}

// --- Versión instalada --------------------------------------------------------------------------

/**
 * Versión de yt-dlp en el venv, leída del nombre de `yt_dlp-<versión>.dist-info` sin lanzar
 * Python. `null` si no hay venv o paquete. (La reutiliza 0054.)
 */
export async function versionYtDlp(
  dirVenv: string,
  plataforma: NodeJS.Platform
): Promise<string | null> {
  const candidatos: string[] = []
  if (plataforma === 'win32') candidatos.push(join(dirVenv, 'Lib', 'site-packages'))
  else {
    const lib = join(dirVenv, 'lib')
    for (const n of await readdir(lib).catch(() => [] as string[]))
      if (/^python3/.test(n)) candidatos.push(join(lib, n, 'site-packages'))
  }
  for (const dir of candidatos) {
    for (const n of await readdir(dir).catch(() => [] as string[])) {
      const m = /^yt_dlp-(.+)\.dist-info$/i.exec(n)
      if (m?.[1]) return m[1]
    }
  }
  return null
}

// --- Actualizador -------------------------------------------------------------------------------

export type MotivoActualizacion = 'semanal' | 'bloqueo' | 'reparacion'

export interface MarcadorActualizando {
  inicio: string
  motivo: MotivoActualizacion
}

export interface ResultadoActualizacion {
  anterior: string | null
  nueva: string | null
  /** Sin empaquetar y con el lanzador de desarrollo: no se tocó el entorno. */
  noop: boolean
}

export interface OpcionesActualizar {
  /** Con `reparar`, reinstala yt-dlp, yt-dlp-ejs y deno. */
  reparar?: boolean
  motivo?: MotivoActualizacion
}

export interface DependenciasActualizador {
  /** `<datos>/runtime`. */
  dirRuntime: string
  rutaExclusiones: string
  plataforma: NodeJS.Platform
  ejecutorUv: EjecutorUv
  cerrojo: CerrojoLecturaEscritura
  /** Desarrollo con `uv run`: la actualización no toca el entorno del repo. */
  noop?: boolean
  /** Duración simulada del no-op (`SHINOBI_YTDLP_ACTUALIZAR_MS`, ya filtrado por `isPackaged`). */
  retardoNoopMs?: number
  limiteMs?: number
  esperaCierreMs?: number
  /** Entorno base para uv (por defecto `process.env`). */
  env?: Record<string, string | undefined>
  /** Se llama tras una actualización correcta (también el no-op). */
  alCompletar?: (r: ResultadoActualizacion) => void | Promise<void>
  registrar?: (nivel: 'info' | 'aviso' | 'error', mensaje: string) => void
  ahora?: () => Date
  /** Versión instalada (pruebas); por defecto lee el venv. */
  version?: () => Promise<string | null>
}

export function rutaMarcadorYtdlp(dirRuntime: string): string {
  return join(dirRuntime, 'ytdlp-actualizando.json')
}

export async function hayMarcadorYtdlp(dirRuntime: string): Promise<boolean> {
  try {
    await access(rutaMarcadorYtdlp(dirRuntime))
    return true
  } catch {
    return false
  }
}

async function borrarMarcador(dirRuntime: string): Promise<void> {
  const ruta = rutaMarcadorYtdlp(dirRuntime)
  await rm(ruta, { force: true })
  await rm(`${ruta}.bak`, { force: true })
  await rm(`${ruta}.tmp`, { force: true })
}

const dormir = (ms: number, señal: AbortSignal): Promise<boolean> =>
  new Promise((ok) => {
    if (señal.aborted) return ok(false)
    const alAbortar = (): void => {
      clearTimeout(t)
      ok(false)
    }
    const t = setTimeout(() => {
      señal.removeEventListener('abort', alAbortar)
      ok(true)
    }, ms)
    señal.addEventListener('abort', alAbortar, { once: true })
  })

export class ActualizadorYtDlp {
  private vuelo: Promise<ResultadoActualizacion> | null = null
  private control: AbortController | null = null
  private cerrando = false

  constructor(private readonly deps: DependenciasActualizador) {}

  /** `true` mientras hay una actualización pendiente o en curso. */
  enCurso(): boolean {
    return this.vuelo !== null
  }

  /** De un solo vuelo: una llamada con otra en curso recibe la misma promesa. */
  actualizar(opciones: OpcionesActualizar = {}): Promise<ResultadoActualizacion> {
    if (this.vuelo) return this.vuelo
    const p: Promise<ResultadoActualizacion> = this.ejecutar(opciones).finally(() => {
      if (this.vuelo === p) {
        this.vuelo = null
        this.control = null
      }
    })
    this.vuelo = p
    return p
  }

  /**
   * Cierre de la app (preguntas/0014 §1b): espera a uv hasta `esperaCierreMs`; después mata el
   * árbol de procesos. Sin diálogo. El marcador se conserva, así que el siguiente arranque repara.
   */
  async cerrar(): Promise<void> {
    this.cerrando = true
    const v = this.vuelo
    if (!v) return
    const terminada = v.then(
      () => true,
      () => true
    )
    const plazo = this.deps.esperaCierreMs ?? ESPERA_CIERRE_MS
    let temporizador: ReturnType<typeof setTimeout> | undefined
    const agotado = new Promise<boolean>((ok) => {
      temporizador = setTimeout(() => ok(false), plazo)
    })
    const acabo = await Promise.race([terminada, agotado])
    clearTimeout(temporizador)
    if (!acabo) {
      this.deps.registrar?.('aviso', 'yt-dlp: se mata la actualización al cerrar la app')
      this.control?.abort()
      await terminada
    }
  }

  private registrar(nivel: 'info' | 'aviso' | 'error', mensaje: string): void {
    this.deps.registrar?.(nivel, mensaje)
  }

  private async version(): Promise<string | null> {
    try {
      return await (this.deps.version?.() ??
        versionYtDlp(join(this.deps.dirRuntime, 'venv'), this.deps.plataforma))
    } catch {
      return null
    }
  }

  private ejecutar(opciones: OpcionesActualizar): Promise<ResultadoActualizacion> {
    const { dirRuntime } = this.deps
    const reparar = opciones.reparar ?? false
    const motivo = opciones.motivo ?? (reparar ? 'reparacion' : 'semanal')
    return this.deps.cerrojo.conEscritura(async () => {
      if (this.cerrando) throw new ErrorRuntime('CANCELADO', 'La app se está cerrando.')
      const anterior = await this.version()
      const control = new AbortController()
      this.control = control
      const marcador: MarcadorActualizando = {
        inicio: (this.deps.ahora?.() ?? new Date()).toISOString(),
        motivo
      }
      await escribirJsonAtomico(rutaMarcadorYtdlp(dirRuntime), marcador)
      let agotado = false
      const temporizador = setTimeout(() => {
        agotado = true
        control.abort()
      }, this.deps.limiteMs ?? LIMITE_ACTUALIZACION_MS)
      try {
        let codigo: number
        let cancelado: boolean
        let texto = ''
        if (this.deps.noop) {
          this.registrar('info', `yt-dlp: actualización simulada (${motivo}), sin tocar el entorno`)
          cancelado = !(await dormir(this.deps.retardoNoopMs ?? 0, control.signal))
          codigo = 0
        } else {
          const python = interpreteVenv(dirRuntime, this.deps.plataforma)
          const args = [
            '--no-config',
            'pip',
            'install',
            '--python',
            python,
            '--excludes',
            this.deps.rutaExclusiones,
            '-U',
            'yt-dlp[default]',
            'deno',
            ...(reparar
              ? [
                  '--reinstall-package',
                  'yt-dlp',
                  '--reinstall-package',
                  'yt-dlp-ejs',
                  '--reinstall-package',
                  'deno'
                ]
              : [])
          ]
          // Sin `--require-hashes`: única excepción a los requisitos bloqueados (ADR 0003).
          this.registrar('info', `yt-dlp: actualizando (${motivo}${reparar ? ', reparar' : ''})`)
          const r = await this.deps.ejecutorUv.ejecutar(args, {
            env: entornoUv(dirRuntime, this.deps.env ?? process.env),
            señal: control.signal
          })
          codigo = r.codigo
          cancelado = r.cancelado
          texto = r.ultimasLineas.join('\n')
        }
        if (cancelado) {
          throw new ErrorRuntime(
            'ERROR_INTERNO',
            agotado
              ? 'La actualización de yt-dlp superó el límite de 5 minutos.'
              : 'La actualización de yt-dlp se interrumpió.',
            texto
          )
        }
        if (codigo !== 0) {
          throw new ErrorRuntime(
            clasificarStderr(texto),
            `uv pip install terminó con código ${String(codigo)}`,
            texto
          )
        }
        // El marcador se borra solo si uv salió con código 0.
        await borrarMarcador(dirRuntime)
        const resultado: ResultadoActualizacion = {
          anterior,
          nueva: this.deps.noop ? anterior : await this.version(),
          noop: this.deps.noop ?? false
        }
        this.registrar('info', `yt-dlp: ${resultado.anterior ?? '?'} -> ${resultado.nueva ?? '?'}`)
        try {
          await this.deps.alCompletar?.(resultado)
        } catch (e) {
          this.registrar('aviso', `yt-dlp: no se pudo guardar la comprobación: ${String(e)}`)
        }
        return resultado
      } catch (e) {
        this.registrar('aviso', `yt-dlp: la actualización falló: ${String(e)}`)
        throw e
      } finally {
        clearTimeout(temporizador)
      }
    })
  }
}

// --- Planificación ------------------------------------------------------------------------------

export interface OpcionesPlanificador {
  actualizador: Pick<ActualizadorYtDlp, 'actualizar'>
  /** Instalación `completa`. */
  completa: () => boolean
  youtubeActivo: boolean
  ultimaComprobacion: () => string | null
  hayMarcador: () => Promise<boolean>
  ahora?: () => Date
  retardoMs?: number
  /** Inyectable en pruebas. Devuelve la función que cancela. */
  programar?: (fn: () => void, ms: number) => () => void
  registrar?: (nivel: 'info' | 'aviso' | 'error', mensaje: string) => void
}

/** Al arrancar: repara si quedó un marcador y programa la comprobación semanal. */
export async function iniciarMantenimientoYtdlp(
  o: OpcionesPlanificador
): Promise<{ cancelar(): void }> {
  const sin = { cancelar: () => undefined }
  if (!o.completa() || !o.youtubeActivo) return sin
  const registrar = o.registrar ?? (() => undefined)
  const lanzar = (opciones: OpcionesActualizar): void => {
    o.actualizador.actualizar(opciones).catch((e: unknown) => {
      const sinConexion = (e as { codigo?: unknown } | null)?.codigo === 'SIN_CONEXION'
      registrar(
        'aviso',
        sinConexion
          ? 'yt-dlp: sin conexión; se reintentará en el próximo arranque'
          : `yt-dlp: ${String(e)}`
      )
    })
  }
  // Reparación: se lanza ya (antes de que nadie pueda empezar una operación de YouTube).
  if (await o.hayMarcador()) lanzar({ reparar: true, motivo: 'reparacion' })
  const ultima = o.ultimaComprobacion()
  const ms = ultima === null ? Number.NaN : Date.parse(ultima)
  const ahora = (o.ahora?.() ?? new Date()).getTime()
  const vencida = Number.isNaN(ms) || ahora - ms > PERIODO_COMPROBACION_MS
  if (!vencida) return sin
  const programar =
    o.programar ??
    ((fn, retardo) => {
      const t = setTimeout(fn, retardo)
      t.unref()
      return () => clearTimeout(t)
    })
  const cancelar = programar(
    () => lanzar({ motivo: 'semanal' }),
    o.retardoMs ?? RETARDO_COMPROBACION_MS
  )
  return { cancelar }
}
