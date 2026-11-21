/**
 * Geometría de la ventana flotante (spec 06 · Fase 9, «La ventana»). Funciones puras en px CSS.
 * Las coordenadas de `Posicion` son relativas a la esquina superior izquierda del área.
 */

export interface Area {
  left: number
  top: number
  width: number
  height: number
}
export interface Posicion {
  x: number
  y: number
}
export interface Tamano {
  ancho: number
  alto: number
}
export type Geometria = Posicion & Tamano

/** Margen que el tamaño máximo deja por cada lado del área. */
export const MARGEN_AREA = 16
/** Separación de la posición inicial respecto al borde superior y a la lista. */
export const SEPARACION_INICIAL = 12
export const PASO_TECLADO = 16
export const PASO_TECLADO_MAYUS = 64

/** Tamaños de diseño en `rem` (760 × 440 inicial, 560 × 360 mínimo). */
export function tamanosDiseno(rem = 16): { inicial: Tamano; minimo: Tamano } {
  return {
    inicial: { ancho: 47.5 * rem, alto: 27.5 * rem },
    minimo: { ancho: 35 * rem, alto: 22.5 * rem }
  }
}

export function tamanoMaximo(area: Area): Tamano {
  return {
    ancho: Math.max(0, area.width - 2 * MARGEN_AREA),
    alto: Math.max(0, area.height - 2 * MARGEN_AREA)
  }
}

/** Si el área no admite ni el mínimo de diseño: la ventana la ocupa (menos el margen) y no se mueve. */
export function esReducida(area: Area, minimo: Tamano): boolean {
  const max = tamanoMaximo(area)
  return max.ancho < minimo.ancho || max.alto < minimo.alto
}

const entre = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

/** Tamaño entre el mínimo y el máximo (el máximo manda si el mínimo no cabe). */
export function acotarTamano(t: Tamano, area: Area, minimo: Tamano): Tamano {
  const max = tamanoMaximo(area)
  return {
    ancho: entre(t.ancho, Math.min(minimo.ancho, max.ancho), max.ancho),
    alto: entre(t.alto, Math.min(minimo.alto, max.alto), max.alto)
  }
}

/** Posición con la ventana entera dentro del área. */
export function acotarPosicion(p: Posicion, t: Tamano, area: Area): Posicion {
  return {
    x: entre(p.x, 0, Math.max(0, area.width - t.ancho)),
    y: entre(p.y, 0, Math.max(0, area.height - t.alto))
  }
}

/** Geometría dibujable: tamaño y posición acotados; reducida = ocupa el área menos el margen. */
export function acotarGeometria(g: Geometria, area: Area, minimo: Tamano): Geometria {
  if (esReducida(area, minimo)) {
    const max = tamanoMaximo(area)
    return { x: MARGEN_AREA, y: MARGEN_AREA, ...max }
  }
  const tam = acotarTamano(g, area, minimo)
  return { ...tam, ...acotarPosicion(g, tam, area) }
}

/**
 * Posición inicial: arriba (+12 px) y a la derecha de la referencia (+12 px); si no cabe se
 * desplaza a la izquierda hasta caber y, si aun así no cabe, se centra.
 */
export function posicionInicial(area: Area, referencia: Area | null, tamano: Tamano): Posicion {
  const y = SEPARACION_INICIAL
  const centrada = (area.width - tamano.ancho) / 2
  let x = centrada
  if (referencia) {
    const deseada = referencia.left + referencia.width - area.left + SEPARACION_INICIAL
    const tope = area.width - tamano.ancho - SEPARACION_INICIAL
    x = deseada <= tope ? deseada : tope >= SEPARACION_INICIAL ? tope : centrada
  }
  return acotarPosicion({ x, y }, tamano, area)
}

const FLECHAS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

/** Nueva posición tras una tecla sobre el asa de mover; `null` si la tecla no es suya. */
export function moverConTeclado(
  actual: Geometria,
  tecla: string,
  mayus: boolean,
  inicial: Posicion,
  area: Area
): Posicion | null {
  if (tecla === 'Home') return acotarPosicion(inicial, actual, area)
  const flecha = FLECHAS[tecla]
  if (!flecha) return null
  const paso = mayus ? PASO_TECLADO_MAYUS : PASO_TECLADO
  return acotarPosicion(
    { x: actual.x + flecha[0] * paso, y: actual.y + flecha[1] * paso },
    actual,
    area
  )
}

/** Nuevo tamaño tras una tecla sobre el asa de tamaño (derecha/abajo agrandan); `null` si no es suya. */
export function redimensionarConTeclado(
  actual: Tamano,
  tecla: string,
  mayus: boolean,
  inicial: Tamano,
  area: Area,
  minimo: Tamano
): Tamano | null {
  if (tecla === 'Home') return acotarTamano(inicial, area, minimo)
  const flecha = FLECHAS[tecla]
  if (!flecha) return null
  const paso = mayus ? PASO_TECLADO_MAYUS : PASO_TECLADO
  return acotarTamano(
    { ancho: actual.ancho + flecha[0] * paso, alto: actual.alto + flecha[1] * paso },
    area,
    minimo
  )
}

export const igualesGeometria = (a: Geometria, b: Geometria): boolean =>
  a.x === b.x && a.y === b.y && a.ancho === b.ancho && a.alto === b.alto
