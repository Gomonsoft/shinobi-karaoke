import { useLayoutEffect, useMemo, useState, type RefObject } from 'react'
import type { PreferenciasPaneles } from '@shared/config'
import { ALTO_TIMELINE_MINIMIZADA, preferenciasPanelesPredeterminadas } from '@shared/paneles'
import {
  ALTO_PISTA_VOZ_MIN,
  calcularDistribucion,
  type Distribucion,
  type DivisorEditor,
  type MedidasEditor
} from './distribucion'

/** Medidas de partida (1280 × 720 sin medir aún): también las que se usan sin DOM (Vitest). */
const MEDIDAS_INICIALES: MedidasEditor = {
  ancho: 1248,
  alto: 664,
  altoCabecera: 48,
  altoTransporte: 80
}

interface Entrada {
  /** Raíz del editor (`100vh − 56 px`, con su margen superior como relleno). */
  raiz: RefObject<HTMLElement | null>
  cabecera: RefObject<HTMLElement | null>
  /** Caja del dock (relleno y borde incluidos). */
  dock: RefObject<HTMLElement | null>
  /** Transporte y avisos que lo acompañan. */
  transporte: RefObject<HTMLElement | null>
  /** Banner del modo sincronizar y la línea de tiempo bajo él. */
  extraSync: RefObject<HTMLElement | null>
  pestana: 'sincronia' | 'estilo'
  sincronizando: boolean
  preferencias?: PreferenciasPaneles
}

const PREFERENCIAS_MEMORIA = preferenciasPanelesPredeterminadas()

/**
 * Tamaño en vivo de un divisor durante el arrastre: escribe la variable CSS directamente, sin pasar
 * por el estado de React ni por el reducer de edición. Al confirmar, la distribución recalculada
 * escribe el mismo valor.
 */
export function aplicarTamanoVivo(
  raiz: HTMLElement | null,
  d: Distribucion,
  divisor: DivisorEditor,
  valor: number
): void {
  const estilo = raiz?.style
  if (!estilo) return
  if (divisor === 'lista') estilo.setProperty('--ancho-lista', `${valor}px`)
  else if (divisor === 'panel') estilo.setProperty('--ancho-panel', `${valor}px`)
  else {
    estilo.setProperty('--alto-linea-tiempo', `${valor}px`)
    // El mínimo de la sección es filas fijas + pista de voz mínima: solo la pista crece.
    estilo.setProperty('--alto-pista-voz', `${valor - (d.lineaTiempo.min - ALTO_PISTA_VOZ_MIN)}px`)
  }
}

function igual(a: MedidasEditor, b: MedidasEditor): boolean {
  return (
    a.ancho === b.ancho &&
    a.alto === b.alto &&
    a.altoCabecera === b.altoCabecera &&
    a.altoTransporte === b.altoTransporte &&
    a.barraVertical === b.barraVertical &&
    a.altoBannerSync === b.altoBannerSync
  )
}

function medir(e: Entrada, sincronizando: boolean): MedidasEditor | null {
  const raiz = e.raiz.current
  if (!raiz || raiz.clientWidth === 0 || raiz.clientHeight === 0) return null
  const compacto = raiz.clientHeight + 56 < 800
  const cabecera = e.cabecera.current?.offsetHeight ?? MEDIDAS_INICIALES.altoCabecera
  let altoTransporte = e.transporte.current?.offsetHeight ?? MEDIDAS_INICIALES.altoTransporte
  const dock = e.dock.current
  if (dock) {
    const css = getComputedStyle(dock)
    altoTransporte +=
      (parseFloat(css.paddingTop) || 0) +
      (parseFloat(css.paddingBottom) || 0) +
      (parseFloat(css.borderTopWidth) || 0)
  }
  const medidas: MedidasEditor = {
    ancho: raiz.clientWidth,
    alto: raiz.clientHeight,
    altoCabecera: cabecera,
    altoTransporte
  }
  const marco = raiz.closest('main')
  if (marco) medidas.barraVertical = Math.max(0, marco.offsetWidth - marco.clientWidth)
  const extra = e.extraSync.current
  if (sincronizando && extra) {
    // El modelo suma la fila minimizada de la línea de tiempo: se descuenta para no contarla dos veces.
    const minimizada = ALTO_TIMELINE_MINIMIZADA[compacto ? 'compacto' : 'normal']
    medidas.altoBannerSync = Math.max(0, extra.offsetHeight - minimizada)
  }
  return medidas
}

/**
 * Distribución efectiva del editor (spec 06-editor, subfase 2.1). Observa la raíz, la cabecera, el
 * dock y el modo de altura, llama al modelo puro y escribe las variables CSS de tamaño. Solo
 * vuelve a renderizar si cambian las medidas (la columna no depende de su contenido, así que no
 * hay realimentación).
 */
export function useDistribucion(entrada: Entrada): Distribucion {
  const { raiz, pestana, sincronizando } = entrada
  const [medidas, setMedidas] = useState<MedidasEditor>(MEDIDAS_INICIALES)
  const preferencias = entrada.preferencias ?? PREFERENCIAS_MEMORIA

  useLayoutEffect(() => {
    const nodo = raiz.current
    if (!nodo) return
    const actualizar = () => {
      const nuevas = medir(entrada, sincronizando)
      if (nuevas) setMedidas((previas) => (igual(previas, nuevas) ? previas : nuevas))
    }
    actualizar()
    const elementos = [
      nodo,
      entrada.cabecera.current,
      entrada.dock.current,
      entrada.transporte.current,
      entrada.extraSync.current
    ].filter((el): el is HTMLElement => el !== null)
    const observador =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => actualizar())
    for (const el of elementos) observador?.observe(el)
    const consulta =
      typeof window.matchMedia === 'function' ? window.matchMedia('(max-height: 799.98px)') : null
    consulta?.addEventListener?.('change', actualizar)
    return () => {
      observador?.disconnect()
      consulta?.removeEventListener?.('change', actualizar)
    }
    // Las referencias son estables; la lista de elementos observados cambia con la pestaña y el modo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestana, sincronizando])

  const distribucion = useMemo(
    () => calcularDistribucion({ medidas, preferencias, pestana, sincronizando }),
    [medidas, preferencias, pestana, sincronizando]
  )

  useLayoutEffect(() => {
    const estilo = raiz.current?.style
    if (!estilo) return
    const l = distribucion.lineaTiempo
    estilo.setProperty('--ancho-lista', `${distribucion.lista.ancho}px`)
    estilo.setProperty('--ancho-panel', `${distribucion.panel.ancho}px`)
    // Minimizada (preferencia, falta de espacio o modo sincronizar): fila de 44 px (40 en compacto).
    estilo.setProperty(
      '--alto-linea-tiempo',
      `${l.minimizado ? ALTO_TIMELINE_MINIMIZADA[distribucion.compacto ? 'compacto' : 'normal'] : l.alto}px`
    )
    estilo.setProperty('--alto-pista-voz', `${l.altoPistaVoz || 48}px`)
  }, [distribucion, raiz])

  return distribucion
}
