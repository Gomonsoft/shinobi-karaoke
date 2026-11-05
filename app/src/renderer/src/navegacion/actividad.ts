import type { EventoProgresoIpc, TrabajoIpc } from '@shared/ipc'
import { textoReintentoRed } from '../trabajos/useCuentaAtras'
import { textoEta } from '../vistas/biblioteca/tarjeta'

/** Texto de fase y barra de una fila del panel de actividad (docs/ux/04 §2). */
export interface FaseActividad {
  tipo: 'curso' | 'cola'
  /** Sin el título de la canción: `{título} — {texto}`. */
  texto: string
  /** Barra: `null` = indeterminada; ausente = sin barra. Valor 0–100. */
  barra?: number | null
  /** `bib.eta`, forma corta. */
  eta?: string | null
}

const porcentaje = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 100)

/**
 * Fase de un trabajo vivo con los mismos textos que la tarjeta (`bib.paso.*`): cola, descarga,
 * separación, descarga del modelo, reintentos (memoria y red con cuenta atrás) y actualización
 * del descargador. `esperaS` es la cuenta atrás de la interfaz (`useCuentaAtras`).
 */
export function faseDeTrabajo(
  trabajo: TrabajoIpc,
  progreso: EventoProgresoIpc | null | undefined,
  esperaS: number | null
): FaseActividad {
  const separacion = trabajo.paso === 'separacion'
  if (trabajo.estado === 'en_cola') {
    return {
      tipo: 'cola',
      texto: separacion ? 'En cola para separar' : 'En cola para descargar'
    }
  }
  const p = progreso ?? trabajo.progreso
  const fase = p?.fase
  const detalle = p?.detalle
  if (fase === 'reintentando') {
    const motivo = detalle && 'motivo' in detalle ? detalle.motivo : undefined
    if (motivo === 'red' && esperaS) return { tipo: 'curso', texto: textoReintentoRed(esperaS) }
    if (motivo === 'memoria') {
      return { tipo: 'curso', texto: 'Reintentando la separación…', barra: null }
    }
  }
  if (fase === 'actualizando') {
    return { tipo: 'curso', texto: 'Actualizando el descargador…', barra: null }
  }
  const valor = p?.valor ?? null
  if (fase === 'descargando_modelo') {
    return valor === null
      ? { tipo: 'curso', texto: 'Descargando el modelo…', barra: null }
      : {
          tipo: 'curso',
          texto: `Descargando el modelo ${porcentaje(valor)} %`,
          barra: porcentaje(valor)
        }
  }
  if (valor === null) {
    return {
      tipo: 'curso',
      texto: separacion ? 'Preparando la separación…' : 'Preparando el audio…',
      barra: null
    }
  }
  const n = porcentaje(valor)
  return {
    tipo: 'curso',
    texto: separacion ? `Separando ${n} %` : `Descargando ${n} %`,
    barra: n,
    eta: textoEta(p?.etaSegundos)
  }
}
