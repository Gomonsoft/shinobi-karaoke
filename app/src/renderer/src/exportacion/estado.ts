import {
  FASES_EXPORTACION,
  type ExportacionIpc,
  type ProgresoExportacionIpc
} from '@shared/exportacion'

/**
 * Almacén de exportaciones de la principal (0239): lo alimentan `exportacion.estado()` y los
 * eventos `exportacion:cambio` / `exportacion:progreso`. Descarta lo atrasado: un evento no
 * hace retroceder el estado (cola → curso → terminada) ni la barra de progreso.
 */

/** Una exportación con lo que solo el renderer sabe: cuánto tardó (desde que la vio empezar). */
export interface ExportacionVista extends ExportacionIpc {
  /** Milisegundos entre ver la exportación en curso y verla terminada; `null` si no los vio. */
  tardoMs: number | null
}

export interface AlmacenExportaciones {
  /** Instantánea inmutable; cambia de identidad solo cuando cambia algo. */
  obtener(): readonly ExportacionVista[]
  suscribir(cb: () => void): () => void
  /** `exportacion:cambio`. Devuelve la exportación anterior (para clasificar el aviso). */
  cambio(e: ExportacionIpc): ExportacionVista | undefined
  /** `exportacion:progreso`. */
  progreso(p: ProgresoExportacionIpc): void
  /** Respuesta de `exportacion.estado()`: los eventos ya recibidos prevalecen. */
  inicial(lista: ExportacionIpc[]): void
}

const ORDEN_ESTADO = { en_cola: 0, en_curso: 1, terminada: 2 } as const
/** Terminadas que se conservan para poder reabrirlas (toasts, «Ver exportación»). */
export const MAX_TERMINADAS = 20

const indiceFase = (fase: ProgresoExportacionIpc['fase']): number => FASES_EXPORTACION.indexOf(fase)

/** `true` si `nuevo` no avanza respecto a `actual` (misma fase con menos avance, o fase anterior). */
export function esProgresoAtrasado(
  actual: ProgresoExportacionIpc,
  nuevo: ProgresoExportacionIpc
): boolean {
  const a = indiceFase(actual.fase)
  const n = indiceFase(nuevo.fase)
  if (n !== a) return n < a
  if (nuevo.fotograma < actual.fotograma) return true
  return nuevo.valor !== null && actual.valor !== null && nuevo.valor < actual.valor
}

export function crearAlmacenExportaciones(ahora: () => number = Date.now): AlmacenExportaciones {
  const porId = new Map<string, ExportacionVista>()
  const vistos = new Set<string>()
  const inicios = new Map<string, number>()
  const oyentes = new Set<() => void>()
  let instantanea: readonly ExportacionVista[] = []

  const publicar = () => {
    const terminadas = [...porId.values()].filter((e) => e.estado === 'terminada')
    for (const e of terminadas.slice(0, Math.max(0, terminadas.length - MAX_TERMINADAS))) {
      porId.delete(e.trabajoId)
      inicios.delete(e.trabajoId)
    }
    instantanea = [...porId.values()]
    oyentes.forEach((cb) => cb())
  }

  function fijar(e: ExportacionIpc): ExportacionVista | undefined {
    const previa = porId.get(e.trabajoId)
    if (previa && ORDEN_ESTADO[e.estado] < ORDEN_ESTADO[previa.estado]) return previa
    if (previa?.estado === 'terminada') return previa
    if (e.estado === 'en_curso' && !inicios.has(e.trabajoId)) inicios.set(e.trabajoId, ahora())
    let progreso = e.progreso
    if (previa?.progreso && progreso && esProgresoAtrasado(previa.progreso, progreso)) {
      progreso = previa.progreso
    }
    const inicio = inicios.get(e.trabajoId)
    const tardoMs =
      e.estado === 'terminada' && inicio !== undefined
        ? Math.max(0, ahora() - inicio)
        : (previa?.tardoMs ?? null)
    porId.set(e.trabajoId, { ...e, progreso, tardoMs })
    return previa
  }

  return {
    obtener: () => instantanea,
    suscribir(cb) {
      oyentes.add(cb)
      return () => oyentes.delete(cb)
    },
    cambio(e) {
      vistos.add(e.trabajoId)
      const previa = fijar(e)
      publicar()
      return previa
    },
    progreso(p) {
      const actual = porId.get(p.trabajoId)
      if (!actual || actual.estado === 'terminada') return
      if (actual.progreso && esProgresoAtrasado(actual.progreso, p)) return
      porId.set(p.trabajoId, { ...actual, progreso: p })
      publicar()
    },
    inicial(lista) {
      for (const e of lista) if (!vistos.has(e.trabajoId)) fijar(e)
      publicar()
    }
  }
}

// --- Avisos --------------------------------------------------------------------

export type AvisoExportacion =
  | { tipo: 'ok' }
  | { tipo: 'error' }
  | { tipo: 'cancelada' }
  | { tipo: 'quitada' }
  | { tipo: 'limpieza' }
  | { tipo: 'interrumpida' }

/**
 * Qué aviso corresponde a un `exportacion:cambio` según lo que ya se sabía de esa exportación.
 * Provisional hasta la respuesta a la pregunta 0132: `LIMPIEZA_FALLIDA` y la caída del proceso
 * («interrumpida») se deducen de `error.codigo`.
 */
export function clasificarAviso(
  previa: ExportacionVista | undefined,
  nueva: ExportacionIpc
): AvisoExportacion | null {
  if (nueva.estado !== 'terminada' || previa?.estado === 'terminada') return null
  if (nueva.error?.codigo === 'LIMPIEZA_FALLIDA') return { tipo: 'limpieza' }
  if (
    !previa &&
    nueva.resultado === 'error' &&
    nueva.error?.codigo === 'PROCESO_TERMINADO' &&
    nueva.error.posicionMs === null
  )
    return { tipo: 'interrumpida' }
  if (nueva.resultado === 'completada') return { tipo: 'ok' }
  if (nueva.resultado === 'error') return { tipo: 'error' }
  if (nueva.resultado === 'cancelada')
    return { tipo: previa?.estado === 'en_cola' ? 'quitada' : 'cancelada' }
  return null
}

/** Porcentaje entero de «Crear el video» (0–100). */
export const porcentajeDe = (p: ProgresoExportacionIpc | null): number =>
  p && p.valor !== null ? Math.round(Math.min(1, Math.max(0, p.valor)) * 100) : 0

/**
 * Hito de accesibilidad entre dos estados de una exportación (inicio, cada subpaso, 25/50/75 %,
 * éxito y cancelación); `null` si no hay hito. Nunca cada actualización del porcentaje.
 */
export function hitoDe(
  previa: ExportacionVista | undefined,
  nueva: ExportacionVista,
  textos: {
    inicio: (titulo: string) => string
    fase: Record<ProgresoExportacionIpc['fase'], string>
    porcentaje: (n: number) => string
    ok: string
    cancelada: string
  }
): string | null {
  if (nueva.estado === 'terminada') {
    if (previa?.estado === 'terminada') return null
    if (nueva.resultado === 'completada') return textos.ok
    return nueva.resultado === 'cancelada' ? textos.cancelada : null
  }
  if (nueva.estado !== 'en_curso') return null
  if (previa?.estado !== 'en_curso') return textos.inicio(nueva.titulo)
  const antes = previa.progreso
  const ahora = nueva.progreso
  if (!ahora) return null
  if (!antes || antes.fase !== ahora.fase) return textos.fase[ahora.fase]
  if (ahora.fase === 'codificando') {
    const umbral = [25, 50, 75].filter((u) => porcentajeDe(antes) < u && porcentajeDe(ahora) >= u)
    if (umbral.length > 0) return textos.porcentaje(umbral[umbral.length - 1]!)
  }
  return null
}
