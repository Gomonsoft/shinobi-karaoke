import type { PreferenciasPaneles } from '@shared/config'
import {
  ALTO_COMPACTO_DESDE,
  ALTO_MIN_ZONA_SUPERIOR,
  ALTO_TIMELINE_MINIMIZADA,
  ANCHO_DIVISOR,
  ANCHO_MIN_PREVIA,
  ANCHO_MINIMO_DISENO,
  ANCHO_RIEL_LISTA,
  ANCHO_RIEL_PANEL,
  LIMITES_PANELES,
  PASO_TECLADO,
  PASO_TECLADO_GRANDE
} from '@shared/paneles'

/**
 * Modelo puro de la distribución del editor (spec 06-editor, subfase 2.1): calcula los tamaños
 * efectivos a partir de las preferencias y de las medidas reales. Sin DOM ni React.
 */

/** Alto de la barra de la app: `medidas.alto` ya lo descuenta, el viewport no. */
const ALTO_BARRA_APP = 56
/** Márgenes laterales del editor (16 + 16): `medidas.ancho` no los incluye, el viewport sí. */
const MARGEN_LATERAL_TOTAL = 32
const MARGEN_SUPERIOR = { normal: 12, compacto: 8 } as const
const HUECO_BAJO_CABECERA = 8
const ALTO_DIVISOR_DOCK = ANCHO_DIVISOR
const ALTO_PISTA_VOZ_DEFECTO = 76
export const ALTO_PISTA_VOZ_MIN = 48
const ALTO_LINEA_TIEMPO_DEFECTO = { normal: 216, compacto: 204 } as const
const ALTO_BANNER_SYNC_DEFECTO = 140

export interface MedidasEditor {
  /** Contenedor raíz del editor, px CSS (sin márgenes laterales). */
  ancho: number
  /** Alto disponible bajo la barra de la app. */
  alto: number
  altoCabecera: number
  altoTransporte: number
  /**
   * Ancho de la barra vertical de `main` (0 si no hay). El ancho de la raíz ya la descuenta, pero el
   * umbral de la disposición B se decide con el ancho de la ventana: así la barra que aparece por
   * falta de alto no empuja el editor a B (histéresis).
   */
  barraVertical?: number
  /** Solo en el modo sincronizar. */
  altoBannerSync?: number
}

export interface EntradaDistribucion {
  medidas: MedidasEditor
  preferencias: PreferenciasPaneles
  pestana: 'sincronia' | 'estilo'
  sincronizando: boolean
}

export type DivisorEditor = 'lista' | 'panel' | 'dock'

export interface Distribucion {
  compacto: boolean
  bajoMinimo: null | 'ancho' | 'alto'
  lista: { ancho: number; minimizado: boolean; min: number; max: number }
  panel: { ancho: number; minimizado: boolean; min: number; max: number }
  lineaTiempo: {
    visible: boolean
    /** Alto que ocupa en el dock (44/40 si está minimizada; 0 si no es visible). */
    alto: number
    /** Parte del alto expandido que corresponde a la pista de voz y líneas. */
    altoPistaVoz: number
    minimizado: boolean
    minimizadoPorEspacio: boolean
    min: number
    max: number
  }
  altoZonaSuperior: number
}

const acotar = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max)

export function calcularDistribucion(e: EntradaDistribucion): Distribucion {
  const { medidas, preferencias, pestana, sincronizando } = e
  const compacto = medidas.alto + ALTO_BARRA_APP < ALTO_COMPACTO_DESDE
  const modo = compacto ? 'compacto' : 'normal'

  // --- Ancho ---------------------------------------------------------------------------------
  const bajoAncho =
    medidas.ancho + (medidas.barraVertical ?? 0) + MARGEN_LATERAL_TOTAL < ANCHO_MINIMO_DISENO
  const libre = medidas.ancho - 2 * ANCHO_DIVISOR
  const lim = LIMITES_PANELES
  let anchoLista = preferencias.lista.minimizado ? ANCHO_RIEL_LISTA : preferencias.lista.ancho
  let anchoPanel = preferencias.panel.minimizado ? ANCHO_RIEL_PANEL : preferencias.panel.ancho
  if (!bajoAncho) {
    let deficit = anchoLista + anchoPanel + ANCHO_MIN_PREVIA - libre
    if (deficit > 0 && !preferencias.lista.minimizado) {
      const r = Math.max(0, Math.min(deficit, anchoLista - lim.lista.min))
      anchoLista -= r
      deficit -= r
    }
    if (deficit > 0 && !preferencias.panel.minimizado) {
      const r = Math.max(0, Math.min(deficit, anchoPanel - lim.panel.min))
      anchoPanel -= r
    }
  }
  const maxLista = acotar(libre - ANCHO_MIN_PREVIA - anchoPanel, lim.lista.min, lim.lista.max)
  const maxPanel = acotar(libre - ANCHO_MIN_PREVIA - anchoLista, lim.panel.min, lim.panel.max)
  const lista = {
    ancho: preferencias.lista.minimizado ? anchoLista : acotar(anchoLista, lim.lista.min, maxLista),
    minimizado: preferencias.lista.minimizado && !bajoAncho,
    min: lim.lista.min,
    max: maxLista
  }
  const panel = {
    ancho: preferencias.panel.minimizado ? anchoPanel : acotar(anchoPanel, lim.panel.min, maxPanel),
    minimizado: preferencias.panel.minimizado && !bajoAncho,
    min: lim.panel.min,
    max: maxPanel
  }

  // --- Alto ----------------------------------------------------------------------------------
  const altoMinimizada = ALTO_TIMELINE_MINIMIZADA[modo]
  const defectoLT = ALTO_LINEA_TIEMPO_DEFECTO[modo]
  const filasFijas = defectoLT - ALTO_PISTA_VOZ_DEFECTO
  const minLT = filasFijas + ALTO_PISTA_VOZ_MIN
  const base =
    MARGEN_SUPERIOR[modo] + medidas.altoCabecera + HUECO_BAJO_CABECERA + medidas.altoTransporte
  const visible = pestana === 'sincronia'

  let altoZonaCalculado: number
  const linea: Distribucion['lineaTiempo'] = {
    visible,
    alto: 0,
    altoPistaVoz: 0,
    minimizado: false,
    minimizadoPorEspacio: false,
    min: minLT,
    max: minLT
  }

  if (!visible) {
    altoZonaCalculado = medidas.alto - base
    linea.min = 0
    linea.max = 0
  } else if (sincronizando) {
    const alto = (medidas.altoBannerSync ?? ALTO_BANNER_SYNC_DEFECTO) + altoMinimizada
    linea.alto = alto
    linea.min = alto
    linea.max = alto
    linea.minimizado = true
    altoZonaCalculado = medidas.alto - base - ALTO_DIVISOR_DOCK - alto
  } else {
    const disponible = medidas.alto - base - ALTO_DIVISOR_DOCK - ALTO_MIN_ZONA_SUPERIOR
    const maxLT = Math.min(lim.linea_tiempo.max, disponible)
    const sinEspacio = maxLT < minLT
    const preferido = Math.max(preferencias.linea_tiempo.alto ?? defectoLT, minLT)
    const efectivo = sinEspacio ? minLT : Math.min(preferido, maxLT)
    linea.min = minLT
    linea.max = Math.max(minLT, maxLT)
    linea.altoPistaVoz = efectivo - filasFijas
    linea.minimizadoPorEspacio = sinEspacio
    linea.minimizado = preferencias.linea_tiempo.minimizado || sinEspacio
    linea.alto = linea.minimizado ? altoMinimizada : efectivo
    altoZonaCalculado = medidas.alto - base - ALTO_DIVISOR_DOCK - linea.alto
  }

  const bajoAlto = altoZonaCalculado < ALTO_MIN_ZONA_SUPERIOR
  const bajoMinimo = bajoAncho ? 'ancho' : bajoAlto ? 'alto' : null

  return {
    compacto,
    bajoMinimo,
    lista,
    panel,
    lineaTiempo: linea,
    altoZonaSuperior: Math.max(ALTO_MIN_ZONA_SUPERIOR, altoZonaCalculado)
  }
}

const EJES: Record<DivisorEditor, { agrandar: string; reducir: string }> = {
  lista: { agrandar: 'ArrowRight', reducir: 'ArrowLeft' },
  panel: { agrandar: 'ArrowLeft', reducir: 'ArrowRight' },
  dock: { agrandar: 'ArrowUp', reducir: 'ArrowDown' }
}

interface ElementoDivisor {
  actual: number
  min: number
  max: number
  minimizado: boolean
  alternable: boolean
}

function elemento(d: Distribucion, divisor: DivisorEditor): ElementoDivisor | null {
  if (divisor === 'dock') {
    const l = d.lineaTiempo
    if (!l.visible || l.min === l.max) return null
    return {
      actual: l.alto,
      min: l.min,
      max: l.max,
      minimizado: l.minimizado,
      alternable: !l.minimizadoPorEspacio
    }
  }
  const p = d[divisor]
  return { actual: p.ancho, min: p.min, max: p.max, minimizado: p.minimizado, alternable: true }
}

export type AccionTecla = { tipo: 'tamano'; valor: number } | { tipo: 'alternar' } | null

export function aplicarTecla(
  d: Distribucion,
  divisor: DivisorEditor,
  tecla: string,
  mayus: boolean
): AccionTecla {
  const el = elemento(d, divisor)
  if (!el) return null
  if (tecla === 'Enter') return el.alternable ? { tipo: 'alternar' } : null
  if (tecla === 'Home') return { tipo: 'tamano', valor: el.min }
  if (tecla === 'End') return { tipo: 'tamano', valor: el.max }
  const paso = mayus ? PASO_TECLADO_GRANDE : PASO_TECLADO
  const eje = EJES[divisor]
  let signo: 1 | -1
  if (tecla === eje.agrandar) signo = 1
  else if (tecla === eje.reducir) signo = -1
  else return null
  // Minimizado: solo una flecha que agranda expande, partiendo del mínimo.
  if (el.minimizado && signo < 0) return null
  const origen = el.minimizado ? el.min : el.actual
  return { tipo: 'tamano', valor: acotar(origen + signo * paso, el.min, el.max) }
}

/**
 * Tamaño tras arrastrar `deltaPx` (desplazamiento del puntero en pantalla: + a la derecha o abajo)
 * desde `inicio` (tamaño visible al empezar). Se acota a [min, max] y nunca minimiza.
 */
export function aplicarArrastre(
  d: Distribucion,
  divisor: DivisorEditor,
  inicio: number,
  deltaPx: number
): number {
  const el = elemento(d, divisor)
  if (!el) return inicio
  const crecimiento = divisor === 'lista' ? deltaPx : -deltaPx
  const origen = el.minimizado ? el.min : inicio
  return acotar(origen + crecimiento, el.min, el.max)
}

/**
 * Preferencias tras una acción del usuario sobre un divisor: guarda el valor visible (entero,
 * dentro de los límites absolutos) y expande el panel. No muta la entrada.
 */
export function preferenciaTrasAccion(
  pref: PreferenciasPaneles,
  divisor: DivisorEditor,
  valorVisible: number
): PreferenciasPaneles {
  const v = Math.round(valorVisible)
  const lim = LIMITES_PANELES
  if (divisor === 'lista') {
    return { ...pref, lista: { ancho: acotar(v, lim.lista.min, lim.lista.max), minimizado: false } }
  }
  if (divisor === 'panel') {
    return { ...pref, panel: { ancho: acotar(v, lim.panel.min, lim.panel.max), minimizado: false } }
  }
  return {
    ...pref,
    linea_tiempo: {
      alto: acotar(v, lim.linea_tiempo.min, lim.linea_tiempo.max),
      minimizado: false
    }
  }
}
