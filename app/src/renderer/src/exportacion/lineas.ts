import { textoEta } from '../vistas/biblioteca/tarjeta'
import type { LineaPasoDatos } from '../vistas/biblioteca/tarjeta'
import { EXP_ACTIVIDAD } from './dialogo/textosProgreso'
import { porcentajeDe, type ExportacionVista } from './estado'

/**
 * Línea de la tarjeta de la Biblioteca (`bib.exp.linea` / `bib.exp.cola`, spec 02 · Fase 6):
 * con porcentaje y tiempo restante al crear el video; indeterminada al preparar o terminar.
 * `null` si la exportación no está en curso ni en cola.
 */
export function lineaDeExportacion(e: ExportacionVista | undefined): LineaPasoDatos | null {
  if (!e || e.estado === 'terminada') return null
  if (e.estado === 'en_cola') return { tipo: 'cola', texto: EXP_ACTIVIDAD.enCola }
  const p = e.progreso
  if (p?.fase === 'codificando' && p.valor !== null) {
    const n = porcentajeDe(p)
    return {
      tipo: 'curso',
      texto: EXP_ACTIVIDAD.lineaTarjeta(n, textoEta(p.etaSegundos)),
      barra: n
    }
  }
  return { tipo: 'curso', texto: EXP_ACTIVIDAD.lineaTarjetaIndeterminada, barra: null }
}

/** Fila del panel de actividad (`act.exp`, sin el título): texto, tipo y barra. */
export function faseDeExportacion(e: ExportacionVista): {
  tipo: 'curso' | 'cola'
  texto: string
  barra?: number | null
  eta?: string | null
} {
  if (e.estado === 'en_cola') return { tipo: 'cola', texto: EXP_ACTIVIDAD.enCola }
  const p = e.progreso
  if (p?.fase === 'codificando' && p.valor !== null) {
    const n = porcentajeDe(p)
    return {
      tipo: 'curso',
      texto: EXP_ACTIVIDAD.enCurso(n),
      barra: n,
      eta: textoEta(p.etaSegundos)
    }
  }
  return {
    tipo: 'curso',
    texto: p?.fase === 'finalizando' ? EXP_ACTIVIDAD.terminando : EXP_ACTIVIDAD.preparando,
    barra: null
  }
}
