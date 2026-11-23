import type { Espera } from '@shared/espera'
import type { Letra } from '@shared/letra'
import type { EjemploEspera } from './ejemploEspera'

/** «Ver un ejemplo» de Letra en pantalla: 12,5 s con tres relevos, una salida con hueco y una entrada. */
export const DURACION_EJEMPLO_PANTALLA_MS = 12_500
const INICIO_MS = 500
const FIN_MS = INICIO_MS + DURACION_EJEMPLO_PANTALLA_MS
/** [inicio, fin] de las cinco líneas: cuatro de 2 s seguidas, un hueco de 3 s y la última. */
const TRAMOS: [number, number][] = [
  [1000, 3000],
  [3000, 5000],
  [5000, 7000],
  [7000, 9000],
  [12_000, 13_000]
]
/** Sin indicadores: el ejemplo enseña los cambios de línea, no la espera. */
const SIN_ESPERA: Espera = {
  puntos: false,
  barra: false,
  cuenta: false,
  primera_entrada: false,
  umbral_ms: 1000
}

/**
 * Cinco líneas sintéticas con el texto de la seleccionada y las que la siguen (si no quedan
 * bastantes, empieza antes; con menos de cinco en la canción se repiten). Pura: no toca la canción.
 */
export function crearEjemploPantalla(letra: Letra, seleccion: string | null): EjemploEspera {
  const textos = letra.lineas.filter((l) => l.tipo === 'linea').map((l) => l.texto)
  const elegida = Math.max(
    0,
    letra.lineas.filter((l) => l.tipo === 'linea').findIndex((l) => l.id === seleccion)
  )
  const primera = Math.max(0, Math.min(elegida, textos.length - TRAMOS.length))
  return {
    letra: {
      origen: 'manual',
      lrclib_id: null,
      offset_ms: 0,
      lineas: TRAMOS.map(([inicio, fin], i) => ({
        id: `ejemplo-${i}`,
        tipo: 'linea',
        texto: textos.length ? textos[(primera + i) % textos.length]! : '',
        inicio_ms: inicio,
        fin_ms: fin,
        palabras: null
      }))
    },
    duracionMs: FIN_MS + 3000,
    inicioMs: INICIO_MS,
    finMs: FIN_MS,
    espera: SIN_ESPERA
  }
}
