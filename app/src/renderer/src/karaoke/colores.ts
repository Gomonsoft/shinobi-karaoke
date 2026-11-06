import type { Fondo } from '@shared/estilo'

export const SUGERIDOS_FONDO = [
  '#0E0F14',
  '#1B1033',
  '#5A1E6E',
  '#0B3D4A',
  '#123524',
  '#4A0E16',
  '#1E2A5A',
  '#F2E8D5'
] as const

export const SUGERIDOS_LETRA = [
  '#FFFFFF',
  '#F2F3F7',
  '#FFD400',
  '#FF5C8A',
  '#4ADEDE',
  '#7CFF6B',
  '#FF9F1C',
  '#111111'
] as const

export function canalesRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

export function aHex(canales: readonly number[]): string {
  return (
    '#' +
    canales
      .map((x) => Math.round(x).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

/** Cambia la L de HSL en 30 puntos, manteniendo el tono y la saturación. */
export function variarLuminosidad30(hex: string): string {
  const rgb = canalesRgb(hex)
  const minimo = Math.min(...rgb)
  const maximo = Math.max(...rgb)
  const croma = maximo - minimo
  const l = (maximo + minimo) / 510
  const nuevaL = l <= 0.7 ? l + 0.3 : l - 0.3
  if (croma === 0) return aHex(rgb.map(() => nuevaL * 255))
  const saturacion = croma / (255 * (1 - Math.abs(2 * l - 1)))
  const nuevoCroma = 255 * saturacion * (1 - Math.abs(2 * nuevaL - 1))
  const nuevoMinimo = nuevaL * 255 - nuevoCroma / 2
  return aHex(rgb.map((canal) => nuevoMinimo + ((canal - minimo) / croma) * nuevoCroma))
}

export function repartirParadas(colores: readonly string[]): { color: string; posicion: number }[] {
  return colores.map((color, i) => ({ color, posicion: i / Math.max(1, colores.length - 1) }))
}

export function aSolido(fondo: Fondo): Extract<Fondo, { tipo: 'solido' }> {
  return fondo.tipo === 'solido' ? fondo : { tipo: 'solido', color: fondo.paradas[0]!.color }
}

export function aDegradado(fondo: Fondo): Extract<Fondo, { tipo: 'degradado' }> {
  if (fondo.tipo === 'degradado') return fondo
  return {
    tipo: 'degradado',
    angulo_grados: 135,
    paradas: repartirParadas([fondo.color, variarLuminosidad30(fondo.color)])
  }
}
