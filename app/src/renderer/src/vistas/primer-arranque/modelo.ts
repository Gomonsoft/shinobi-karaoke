import type {
  EstadoRuntimeIpc,
  FaseRuntime,
  ProgresoRuntimeIpc,
  RequisitosRuntimeIpc
} from '@shared/ipc'
import { PA } from './textos'

/** Lógica pura de Primer arranque (sin React): decisión de pantalla, cifras y textos. */

export type Pantalla =
  | 'cargando'
  | 'biblioteca'
  | 'b0'
  | 'b1'
  | 'b2'
  | 'b3'
  | 'b4'
  | 'b5continuar'
  | 'b5reparar'
  | 'b6'
  | 'b6b'

export interface EntradaDecision {
  estado: EstadoRuntimeIpc | null
  requisitos: RequisitosRuntimeIpc | null
  /** El usuario lanzó la instalación en esta ejecución de la pantalla (Preparar, Continuar…). */
  sesion: boolean
  /** Se ha pedido instalar y aún no ha llegado `en_curso`. */
  iniciando: boolean
}

/** Qué pantalla toca (ux/01, diagrama de detección previa y criterios 1, 12, 14, 15 y 15b). */
export function decidirPantalla({
  estado,
  requisitos,
  sesion,
  iniciando
}: EntradaDecision): Pantalla {
  if (estado === null) return 'cargando'
  if (estado.estado === 'completa') return sesion ? 'b3' : 'biblioteca'
  if (estado.estado === 'verificando') return 'b0'
  if (estado.estado === 'en_curso' || iniciando) return 'b2'
  if (requisitos === null) return 'cargando'
  // El renderer no compara versiones: solo lee `motivo` (0036).
  if (requisitos.plataforma === null) return requisitos.motivo === 'so_antiguo' ? 'b6b' : 'b6'
  if (sesion && estado.error !== null) return 'b4'
  if (estado.estado === 'dañada') return 'b5reparar'
  const conProgreso =
    estado.error !== null || Object.values(estado.fases).some((f) => f === 'completada')
  return conProgreso ? 'b5continuar' : 'b1'
}

// --- Cifras ---------------------------------------------------------------------

/** GB (decimales, 1 GB = 10^9 bytes) con una cifra decimal máxima y coma: `0,7`, `3,1`, `120`. */
export function formatearGb(bytes: number): string {
  const r = Math.round((bytes / 1e9) * 10) / 10
  return String(r).replace('.', ',')
}

/** GB con una cifra decimal máxima, redondeando hacia abajo (el espacio libre no se infla). */
export function formatearGbLibre(bytes: number): string {
  const r = Math.floor((bytes / 1e9) * 10) / 10
  return String(r).replace('.', ',')
}

export const aMb = (bytes: number): number => Math.round(bytes / 1e6)

export function espacioInsuficiente(r: RequisitosRuntimeIpc): boolean {
  return r.espacioLibre < r.espacioRequerido
}

/** Segundos de espera antes de enseñar el tiempo restante (ux/01, "Progreso total y ETA"). */
export const ESPERA_ETA_MS = 10_000

/** `pa.eta`: `null` -> "Calculando tiempo…". */
export function textoEta(etaSegundos: number | null, transcurridoMs: number): string {
  if (etaSegundos === null || transcurridoMs < ESPERA_ETA_MS) return PA.calculandoTiempo
  if (etaSegundos < 60) return PA.etaMenosDeUno
  if (etaSegundos > 30 * 60) return PA.etaMasDe30
  return PA.etaMinutos(Math.max(2, Math.round(etaSegundos / 60)))
}

// --- Equipo (B6/B6b) --------------------------------------------------------------

export function nombreSo(e: RequisitosRuntimeIpc['equipo']): string {
  switch (e.so) {
    case 'windows':
      return 'Windows'
    case 'macos':
      return `macOS ${e.versionSo}`.trim()
    case 'linux':
      return 'Linux'
    default:
      return 'Sistema desconocido'
  }
}

export function nombreProcesador(e: RequisitosRuntimeIpc['equipo']): string {
  if (e.so === 'macos' && e.arquitectura === 'arm64') return 'chip Apple'
  if (e.so === 'macos' && e.arquitectura === 'x64') return 'procesador Intel'
  switch (e.arquitectura) {
    case 'x64':
      return 'procesador x64'
    case 'arm64':
      return 'procesador ARM de 64 bits'
    case 'ia32':
      return 'procesador de 32 bits'
    default:
      return 'procesador desconocido'
  }
}

export function minimoMacos(r: RequisitosRuntimeIpc): { version: string; texto: string } {
  const v = r.versionMinimaSo
  if (!v) return { version: '', texto: '' }
  return { version: v.version, texto: v.nombre ? `${v.version} (${v.nombre})` : v.version }
}

/** "Copiar detalles" de B6 y B6b: información de soporte (Acerca de), arquitectura real y la marca. */
export function detallesEquipo(r: RequisitosRuntimeIpc, soporte: string | null): string {
  const marca =
    r.motivo === 'so_antiguo'
      ? `macos por debajo del mínimo (${minimoMacos(r).version})`
      : 'plataforma no compatible'
  return [
    soporte ?? `Sistema: ${nombreSo(r.equipo)}`,
    `Arquitectura: ${r.equipo.arquitectura}`,
    marca
  ].join('\n')
}

// --- Modo ---------------------------------------------------------------------------

export function mensajeModo(
  modo: 'calidad' | 'rapido' | null,
  perfil: 'cpu' | 'cuda' | 'mps' | null,
  rebaja: 'memoria' | 'generico' | null
): string | null {
  if (rebaja === 'memoria') return PA.modoRebajadoMemoria
  if (rebaja === 'generico') return PA.modoRebajadoGenerico
  if (modo === 'rapido') return PA.modoRapido
  if (modo === 'calidad') return perfil === 'mps' ? PA.modoCalidadApple : PA.modoCalidadNvidia
  return null
}

/** Nombre del modo final para B3. */
export function nombreModoFinal(
  modo: 'calidad' | 'rapido' | null,
  perfil: 'cpu' | 'cuda' | 'mps' | null
): string | null {
  if (modo === 'rapido') return 'Rápido'
  if (modo === 'calidad')
    return perfil === 'mps' ? 'Calidad (chip Apple)' : 'Calidad (tarjeta gráfica NVIDIA)'
  return null
}

export function textoTiempoListo(e: { min: number; max: number } | null): string | null {
  if (e === null) return null
  const a = Math.max(1, Math.round(e.min))
  const b = Math.max(a, Math.ceil(e.max))
  return a === b ? PA.listoTiempoIgual(a) : PA.listoTiempo(a, b)
}

// --- Errores (B4) -----------------------------------------------------------------------

export function textoDeError(
  codigo: string,
  espacioRequerido: number | null
): { titulo: string; cuerpo: string } {
  switch (codigo) {
    case 'SIN_CONEXION':
      return PA.errorSinConexion
    case 'SIN_ESPACIO':
      return PA.errorSinEspacio(espacioRequerido === null ? '10' : formatearGb(espacioRequerido))
    case 'SERVICIO_NO_DISPONIBLE':
      return PA.errorServidor
    case 'VERIFICACION_FALLIDA':
      return PA.errorVerificacion
    default:
      return PA.errorGenerico
  }
}

// --- Progreso -----------------------------------------------------------------------------

export const FASES: readonly FaseRuntime[] = ['motor', 'componentes', 'modelo']

export const NOMBRE_FASE: Record<FaseRuntime, string> = {
  motor: PA.faseMotor,
  componentes: PA.faseComponentes,
  modelo: PA.faseModelo
}

/** Acumulado del progreso que nunca retrocede (ux/01: las barras no bajan; fase máx. 99 %). */
export interface AcumuladoProgreso {
  ultimo: ProgresoRuntimeIpc | null
  total: number
  fases: Record<FaseRuntime, number>
  /** Marca de tiempo del primer evento. */
  inicio: number | null
}

export const acumuladoVacio = (): AcumuladoProgreso => ({
  ultimo: null,
  total: 0,
  fases: { motor: 0, componentes: 0, modelo: 0 },
  inicio: null
})

export function acumular(
  previo: AcumuladoProgreso,
  p: ProgresoRuntimeIpc,
  ahora: number
): AcumuladoProgreso {
  const fases = { ...previo.fases }
  for (const f of FASES) {
    if (p.estados[f] === 'completada') fases[f] = 100
    else if (f === p.faseVisible && p.total > 0)
      fases[f] = Math.max(fases[f], Math.min(99, Math.floor((100 * p.bytes) / p.total)))
  }
  return {
    ultimo: p,
    total: Math.max(previo.total, p.porcentajeGlobal),
    fases,
    inicio: previo.inicio ?? ahora
  }
}

/** Ref de callback: enfoca el elemento al montarse (foco inicial en el primario de cada pantalla). */
export const enfocar = (nodo: HTMLElement | null): void => nodo?.focus()
