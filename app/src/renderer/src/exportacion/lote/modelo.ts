import type { OpcionesExportacion } from '../dialogo/modelo'
import type { ExportacionVista } from '../estado'

export interface CancionLote {
  id: string
  titulo: string
  artista: string
}

export interface OmitidaLote extends CancionLote {
  motivo: string
}

/** Lo que la interfaz recuerda de un lote que main aceptó (los eventos solo traen `loteId`). */
export interface LoteVista {
  loteId: string
  /** Todas las canciones que entraron en alguna ronda, en el orden de la lista. */
  canciones: CancionLote[]
  /** `cancionId` → `trabajoId` de su exportación más reciente. */
  trabajos: Readonly<Record<string, string>>
  /** Canciones de la ronda actual (el primer envío o «Reintentar las fallidas»). */
  ronda: string[]
  /** Omitidas por nombre o por `YA_EN_COLA` en la última respuesta de main. */
  omitidas: OmitidaLote[]
  /** Carpeta de destino, para «En {carpeta}». */
  carpeta: string
  opciones: OpcionesExportacion
  /** Cuándo empezó la ronda actual (el tiempo restante y la clave del toast de fin). */
  iniciadoEn: number
}

export type EstadoFila = 'terminada' | 'enCurso' | 'enCola' | 'error' | 'noIntentada' | 'cancelada'

export interface FilaLote {
  cancion: CancionLote
  exportacion: ExportacionVista | undefined
  estado: EstadoFila
}

/** «No intentada» = `cancelada` **con** `error` (el lote se detuvo, pregunta 0290); sin `error`, la canceló el usuario. */
export const esNoIntentada = (e: ExportacionVista): boolean =>
  e.estado === 'terminada' && e.resultado === 'cancelada' && e.error !== null

export function estadoDeFila(e: ExportacionVista | undefined): EstadoFila {
  if (!e) return 'enCola'
  if (e.estado === 'en_cola') return 'enCola'
  if (e.estado === 'en_curso') return 'enCurso'
  if (e.resultado === 'completada') return 'terminada'
  if (esNoIntentada(e)) return 'noIntentada'
  return e.resultado === 'error' ? 'error' : 'cancelada'
}

/** Filas de las canciones indicadas (por defecto la ronda actual) con su exportación vigente. */
export function filasDelLote(
  lote: LoteVista,
  exportaciones: readonly ExportacionVista[],
  soloRonda = true
): FilaLote[] {
  const porId = new Map(exportaciones.map((e) => [e.trabajoId, e]))
  return lote.canciones
    .filter((c) => !soloRonda || lote.ronda.includes(c.id))
    .map((c) => {
      const exportacion = porId.get(lote.trabajos[c.id] ?? '')
      return { cancion: c, exportacion, estado: estadoDeFila(exportacion) }
    })
}

export interface ResumenLote {
  total: number
  terminadas: number
  completadas: number
  /** Terminó la ronda: ninguna espera ni está en curso. */
  acabado: boolean
  bytes: number
  /** Fracción 0–1 de la ronda: terminadas más lo que lleva la que está en curso. */
  fraccion: number
  /** Cuánto tardó, de la primera que empezó a la última que terminó; `null` si no se sabe. */
  duracionMs: number | null
  /** Primera exportación detenida por `SIN_ESPACIO`/`DESTINO_NO_DISPONIBLE` (las demás quedan «no intentadas»). */
  detenidoPor: ExportacionVista | null
}

export function resumirLote(filas: readonly FilaLote[]): ResumenLote {
  const total = filas.length
  const terminadas = filas.filter((f) =>
    ['terminada', 'error', 'noIntentada', 'cancelada'].includes(f.estado)
  ).length
  const enCurso = filas.find((f) => f.estado === 'enCurso')?.exportacion?.progreso
  const parcial =
    enCurso && enCurso.fase === 'codificando' && enCurso.valor !== null ? enCurso.valor : 0
  const inicios = filas.flatMap((f) =>
    f.exportacion?.iniciadaEn ? [Date.parse(f.exportacion.iniciadaEn)] : []
  )
  const fines = filas.flatMap((f) =>
    f.exportacion?.terminadaEn ? [Date.parse(f.exportacion.terminadaEn)] : []
  )
  const acabado = total > 0 && terminadas === total
  return {
    total,
    terminadas,
    completadas: filas.filter((f) => f.estado === 'terminada').length,
    acabado,
    bytes: filas.reduce(
      (s, f) => s + (f.estado === 'terminada' ? (f.exportacion?.bytes ?? 0) : 0),
      0
    ),
    fraccion: total === 0 ? 1 : Math.min(1, (terminadas + Math.min(0.99, parcial)) / total),
    duracionMs:
      inicios.length > 0 && fines.length > 0
        ? Math.max(0, Math.max(...fines) - Math.min(...inicios))
        : null,
    detenidoPor:
      filas.find(
        (f) =>
          f.estado === 'noIntentada' ||
          (f.estado === 'error' &&
            ['SIN_ESPACIO', 'DESTINO_NO_DISPONIBLE'].includes(f.exportacion?.error?.codigo ?? ''))
      )?.exportacion ?? null
  }
}

/** Ids de las canciones que «Reintentar las fallidas» vuelve a encolar: ✕ y no intentadas, nunca canceladas. */
export const reintentables = (filas: readonly FilaLote[]): FilaLote[] =>
  filas.filter((f) => f.estado === 'error' || f.estado === 'noIntentada')

/** Tiempo restante en minutos redondeados; `null` los primeros 15 s o sin avance (`prog.eta`). */
export function minutosRestantes(
  fraccion: number,
  transcurridoMs: number,
  minimoMs = 15_000
): number | null {
  if (transcurridoMs < minimoMs || fraccion <= 0.01) return null
  return Math.max(1, Math.round((transcurridoMs * (1 - fraccion)) / fraccion / 60_000))
}

/** Duración total del lote: «28 min», «1 h 12 min» o «45 s». */
export function duracionTotal(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min < 1) return `${Math.max(1, Math.round(ms / 1000))} s`
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
}
