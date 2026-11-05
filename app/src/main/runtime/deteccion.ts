import { execFile } from 'node:child_process'
import { statfs } from 'node:fs/promises'
import { release } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import {
  PLATAFORMAS,
  bytesTotalesInstalacion,
  type Config,
  type Manifiesto,
  type PerfilHardware,
  type Plataforma
} from '../../shared'
import type { ServicioConfig } from '../configuracion'

/** Detección previa de hardware y espacio, sin Python (tarea 0031, ADR 0004 paso 1, ADR 0009 §8). */

export const PLAZO_NVIDIA_SMI_MS = 3000

export interface PlataformaReal {
  /** `process.platform` tal cual (`darwin`, `win32`, `linux`…). */
  so: string
  /** Arquitectura real del equipo: `arm64` aunque la app vaya emulada. */
  arquitectura: string
}

/**
 * Plataforma real del equipo (ADR 0009 Revisiones, preguntas/0014): si la app va
 * bajo Rosetta o bajo la emulación x64 de Windows on ARM, la arquitectura es `arm64`.
 */
export function plataformaReal(
  platform: string,
  arch: string,
  ejecutandoBajoTraduccionArm64: boolean
): PlataformaReal {
  return { so: platform, arquitectura: ejecutandoBajoTraduccionArm64 ? 'arm64' : arch }
}

/** macOS mínimo en Apple Silicon (ADR 0009 Revisiones, preguntas/0015). */
export const MACOS_MINIMO = 14

/** Versión mayor de un texto `14.2.1` (0 si no se entiende: se trata como no soportada). */
export function versionMayor(version: string): number {
  const n = Number.parseInt(version, 10)
  return Number.isNaN(n) ? 0 : n
}

export type MotivoNoSoportada = 'arquitectura' | 'so_antiguo'

/** Nombre comercial del macOS mínimo; vive junto a `MACOS_MINIMO` para que el renderer no lo repita. */
export const NOMBRE_MACOS_MINIMO = 'Sonoma'

export interface VersionMinimaSo {
  version: string
  nombre: string | null
}

export interface EvaluacionPlataforma {
  plataforma: Plataforma | null
  /** `null` si `plataforma !== null`. */
  motivo: MotivoNoSoportada | null
  /** Solo con `motivo === 'so_antiguo'`. */
  versionMinimaSo: VersionMinimaSo | null
}

/**
 * Plataforma del manifiesto (`darwin-arm64`, `win32-x64`, `linux-x64`…) y, si no es soportada, el
 * motivo. Orden fijado por el arquitecto (ux/01 B6b): primero la presencia en el manifiesto
 * (`arquitectura`) y después la versión de macOS (`so_antiguo`). Soportar otra plataforma
 * (p. ej. `darwin-x64`, preguntas/0015) es añadirla al manifiesto.
 */
export function evaluarPlataforma(
  real: PlataformaReal,
  manifiesto: Manifiesto,
  versionSo?: string
): EvaluacionPlataforma {
  const clave = `${real.so}-${real.arquitectura}`
  const conocida = PLATAFORMAS.find((p) => p === clave)
  if (conocida === undefined || manifiesto.runtime[conocida] === undefined) {
    return { plataforma: null, motivo: 'arquitectura', versionMinimaSo: null }
  }
  if (real.so === 'darwin' && versionSo !== undefined && versionMayor(versionSo) < MACOS_MINIMO) {
    return {
      plataforma: null,
      motivo: 'so_antiguo',
      versionMinimaSo: { version: String(MACOS_MINIMO), nombre: NOMBRE_MACOS_MINIMO }
    }
  }
  return { plataforma: conocida, motivo: null, versionMinimaSo: null }
}

export function plataformaActual(
  real: PlataformaReal,
  manifiesto: Manifiesto,
  versionSo?: string
): Plataforma | null {
  return evaluarPlataforma(real, manifiesto, versionSo).plataforma
}

export function motivoNoSoportada(
  real: PlataformaReal,
  manifiesto: Manifiesto,
  versionSo?: string
): MotivoNoSoportada | null {
  return evaluarPlataforma(real, manifiesto, versionSo).motivo
}

export interface Equipo {
  so: 'windows' | 'macos' | 'linux' | 'otro'
  versionSo: string
  arquitectura: 'x64' | 'arm64' | 'ia32' | 'otra'
}

/** Datos del equipo para `pa.nocompat.equipo` y "Copiar detalles". */
export function describirEquipo(real: PlataformaReal, versionSo: string): Equipo {
  const so =
    real.so === 'win32'
      ? 'windows'
      : real.so === 'darwin'
        ? 'macos'
        : real.so === 'linux'
          ? 'linux'
          : 'otro'
  const a = real.arquitectura
  const arquitectura = a === 'x64' || a === 'arm64' || a === 'ia32' ? a : 'otra'
  return { so, versionSo, arquitectura }
}

export interface GpuDetectada {
  nombre: string
  vramMb: number
}

export interface DetectorGpu {
  detectar(): Promise<GpuDetectada | null>
}

export interface ResultadoComando {
  codigo: number
  salida: string
}

/** Ejecuta un binario sin shell. Rechaza si no existe o vence el plazo. */
export type EjecutarComando = (
  ejecutable: string,
  args: string[],
  plazoMs: number
) => Promise<ResultadoComando>

export const ejecutarComandoReal: EjecutarComando = (ejecutable, args, plazoMs) =>
  new Promise((resolver, rechazar) => {
    execFile(
      ejecutable,
      args,
      { shell: false, timeout: plazoMs, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error === null) return resolver({ codigo: 0, salida: stdout })
        const codigo = (error as { code?: unknown }).code
        if (typeof codigo === 'number') return resolver({ codigo, salida: stdout })
        rechazar(error)
      }
    )
  })

/** Parsea la salida `csv,noheader,nounits` de nvidia-smi; se queda con la GPU de más VRAM. */
export function parsearNvidiaSmi(salida: string): GpuDetectada | null {
  let mejor: GpuDetectada | null = null
  for (const linea of salida.split(/\r?\n/)) {
    const i = linea.lastIndexOf(',')
    if (i < 0) continue
    const nombre = linea.slice(0, i).trim()
    const textoVram = linea.slice(i + 1).trim()
    if (nombre === '' || !/^\d+(\.\d+)?$/.test(textoVram)) continue
    const vramMb = Math.round(Number(textoVram))
    if (mejor === null || vramMb > mejor.vramMb) mejor = { nombre, vramMb }
  }
  return mejor
}

export interface OpcionesDetectorNvidia {
  plataforma?: string
  env?: Record<string, string | undefined>
  ejecutar?: EjecutarComando
  plazoMs?: number
}

const ARGS_NVIDIA_SMI = ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits']

/** GPU NVIDIA vía `nvidia-smi`. Cualquier fallo (sin binario, plazo, salida ilegible) → `null`. Nunca en macOS. */
export async function detectarGpuNvidia(
  opciones: OpcionesDetectorNvidia = {}
): Promise<GpuDetectada | null> {
  const plataforma = opciones.plataforma ?? process.platform
  if (plataforma === 'darwin') return null
  const env = opciones.env ?? process.env
  const ejecutar = opciones.ejecutar ?? ejecutarComandoReal
  const plazo = opciones.plazoMs ?? PLAZO_NVIDIA_SMI_MS
  const candidatos = ['nvidia-smi']
  if (plataforma === 'win32') {
    const raiz = env.SystemRoot ?? env.SYSTEMROOT
    if (raiz) candidatos.push(join(raiz, 'System32', 'nvidia-smi.exe'))
  }
  for (const ejecutable of candidatos) {
    try {
      const r = await ejecutar(ejecutable, ARGS_NVIDIA_SMI, plazo)
      if (r.codigo !== 0) continue
      const gpu = parsearNvidiaSmi(r.salida)
      if (gpu !== null) return gpu
    } catch {
      // sin binario o plazo vencido: no es un error
    }
  }
  return null
}

export function crearDetectorGpu(opciones: OpcionesDetectorNvidia = {}): DetectorGpu {
  return { detectar: () => detectarGpuNvidia(opciones) }
}

/** Perfil previsto: Apple Silicon → `mps`; NVIDIA en win32/linux → `cuda`; resto → `cpu`; sin plataforma → `null`. */
export function perfilPrevisto(
  plataforma: Plataforma | null,
  gpu: GpuDetectada | null
): PerfilHardware | null {
  if (plataforma === null) return null
  if (plataforma === 'darwin-arm64') return 'mps'
  if (gpu !== null && (plataforma === 'win32-x64' || plataforma === 'linux-x64')) return 'cuda'
  return 'cpu'
}

export interface EspacioLibre {
  /** Bytes disponibles para el usuario en el volumen de `ruta` (o su ancestro existente). */
  bytesLibres(ruta: string): Promise<number>
}

export type Statfs = (ruta: string) => Promise<{ bavail: number | bigint; bsize: number | bigint }>

export function crearEspacioLibre(statfsFn: Statfs = (r) => statfs(r)): EspacioLibre {
  return {
    async bytesLibres(ruta) {
      let actual = resolve(ruta)
      for (;;) {
        try {
          const s = await statfsFn(actual)
          return Number(s.bavail) * Number(s.bsize)
        } catch (e) {
          const padre = dirname(actual)
          if (padre === actual) throw e
          actual = padre
        }
      }
    }
  }
}

export type ModoPrevisto = 'calidad' | 'rapido'

export interface RequisitosPrevios {
  plataforma: Plataforma | null
  /** Por qué no hay plataforma (`null` si la hay): la UI elige B6 (`arquitectura`) o B6b (`so_antiguo`). */
  motivo: MotivoNoSoportada | null
  /** Solo con `motivo === 'so_antiguo'`: `{ version: '14', nombre: 'Sonoma' }`. */
  versionMinimaSo: VersionMinimaSo | null
  equipo: Equipo
  /** La app se ejecuta bajo Rosetta o la emulación x64 de Windows on ARM. */
  emulada: boolean
  perfil: PerfilHardware | null
  gpu: GpuDetectada | null
  /** `null` sin perfil: la UI usa `pa.req.descarga.generica`. */
  bytesDescarga: number | null
  espacioRequerido: number
  espacioLibre: number
  modoPrevisto: ModoPrevisto | null
}

export interface EntornoDeteccion {
  platform: string
  arch: string
  emulada: boolean
  versionSo: string
}

export interface DependenciasDeteccion {
  manifiesto: Manifiesto
  /** Directorio de datos (o cualquier ruta del volumen donde se instalará). */
  rutaDatos: string
  detectorGpu: DetectorGpu
  espacio: EspacioLibre
  entorno?: EntornoDeteccion
}

export function entornoReal(emulada: boolean): EntornoDeteccion {
  return { platform: process.platform, arch: process.arch, emulada, versionSo: versionSistema() }
}

/** Versión del SO: en Electron `process.getSystemVersion()` (macOS 14.x, no el núcleo Darwin). */
export function versionSistema(): string {
  const f = (process as { getSystemVersion?: () => string }).getSystemVersion
  return typeof f === 'function' ? f.call(process) : release()
}

/** Mayor `espacio_requerido` de todo el manifiesto (se usa sin perfil detectado). */
export function espacioRequeridoMaximo(manifiesto: Manifiesto): number {
  let max = 0
  for (const perfiles of Object.values(manifiesto.runtime)) {
    for (const req of Object.values(perfiles ?? {})) max = Math.max(max, req.espacio_requerido)
  }
  return max
}

/** Calcula los requisitos previos (función pura salvo los puertos). */
export async function calcularRequisitosPrevios(
  deps: DependenciasDeteccion,
  entorno: EntornoDeteccion
): Promise<RequisitosPrevios> {
  const real = plataformaReal(entorno.platform, entorno.arch, entorno.emulada)
  const { plataforma, motivo, versionMinimaSo } = evaluarPlataforma(
    real,
    deps.manifiesto,
    entorno.versionSo
  )
  const gpu = plataforma === null ? null : await deps.detectorGpu.detectar()
  const perfil = perfilPrevisto(plataforma, gpu)
  const req =
    plataforma !== null && perfil !== null
      ? deps.manifiesto.runtime[plataforma]?.[perfil]
      : undefined
  const perfilSoportado = req === undefined ? null : perfil
  const espacioLibre = await deps.espacio.bytesLibres(deps.rutaDatos)
  return {
    plataforma,
    motivo,
    versionMinimaSo,
    equipo: describirEquipo(real, entorno.versionSo),
    emulada: entorno.emulada,
    perfil: perfilSoportado,
    gpu,
    bytesDescarga:
      plataforma !== null && perfilSoportado !== null
        ? bytesTotalesInstalacion(deps.manifiesto, plataforma, perfilSoportado)
        : null,
    espacioRequerido: req?.espacio_requerido ?? espacioRequeridoMaximo(deps.manifiesto),
    espacioLibre,
    modoPrevisto: perfilSoportado === null ? null : 'calidad'
  }
}

export interface ServicioDeteccion {
  /** Detecta una vez por sesión; solo `espacioLibre` se recalcula en cada llamada. */
  requisitosPrevios(): Promise<RequisitosPrevios>
}

/** Cachea plataforma, GPU y perfil durante la sesión; recalcula el espacio libre. */
export function crearServicioDeteccion(
  deps: DependenciasDeteccion,
  config?: Pick<ServicioConfig, 'actualizar'>
): ServicioDeteccion {
  const entorno = deps.entorno ?? entornoReal(false)
  let cache: Promise<RequisitosPrevios> | null = null
  return {
    async requisitosPrevios() {
      if (cache === null) {
        cache = calcularRequisitosPrevios(deps, entorno).then(async (r) => {
          if (config) await guardarPrevision(config, r)
          return r
        })
        cache.catch(() => {
          cache = null
        })
      }
      const base = await cache
      return { ...base, espacioLibre: await deps.espacio.bytesLibres(deps.rutaDatos) }
    }
  }
}

/** Guarda `instalacion.perfil_previsto` y `instalacion.hardware` (0008). */
export async function guardarPrevision(
  config: Pick<ServicioConfig, 'actualizar'>,
  r: Pick<RequisitosPrevios, 'perfil' | 'gpu'>
): Promise<Config> {
  return config.actualizar({
    instalacion: {
      perfil_previsto: r.perfil,
      hardware: { gpu: r.gpu?.nombre ?? null, vram_mb: r.gpu?.vramMb ?? null }
    }
  })
}
