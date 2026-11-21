import type { Espera } from '@shared/espera'
import type { ElementoLetra, Letra } from '@shared/letra'

/** Duración del hueco simulado de «Ver un ejemplo». */
export const HUECO_EJEMPLO_MS = 6000

const INICIO_A_MS = 5000
const FIN_A_MS = 7000
const INICIO_B_MS = FIN_A_MS + HUECO_EJEMPLO_MS
const COLA_MS = 1500

export interface EjemploEspera {
  letra: Letra
  duracionMs: number
  /** El reloj local de la vista previa recorre [inicioMs, finMs]. */
  inicioMs: number
  finMs: number
  /** La espera efectiva; el umbral nunca supera el hueco para que el ejemplo siempre muestre algo. */
  espera: Espera
}

const linea = (id: string, texto: string, inicio: number, fin: number): ElementoLetra => ({
  id,
  tipo: 'linea',
  texto,
  inicio_ms: inicio,
  fin_ms: fin,
  palabras: null
})

/**
 * Letra sintética de dos líneas con un hueco de 6 s entre ellas: la seleccionada y la siguiente
 * (con la última seleccionada, la anterior y ella). Función pura: no toca la canción.
 */
export function crearEjemploEspera(
  letra: Letra,
  seleccion: string | null,
  espera: Espera
): EjemploEspera {
  const lineas = letra.lineas.filter((l) => l.tipo === 'linea')
  const i = Math.max(
    0,
    lineas.findIndex((l) => l.id === seleccion)
  )
  const [a, b] =
    i === lineas.length - 1 && lineas.length > 1
      ? [lineas[i - 1]!, lineas[i]!]
      : [lineas[i], lineas[i + 1] ?? lineas[i]]
  return {
    letra: {
      origen: 'manual',
      lrclib_id: null,
      offset_ms: 0,
      lineas: [
        linea('ejemplo-a', a?.texto ?? '', INICIO_A_MS, FIN_A_MS),
        linea('ejemplo-b', b?.texto ?? '', INICIO_B_MS, INICIO_B_MS + 2000)
      ]
    },
    duracionMs: INICIO_B_MS + 3000,
    inicioMs: INICIO_A_MS,
    finMs: INICIO_B_MS + COLA_MS,
    espera: { ...espera, umbral_ms: Math.min(espera.umbral_ms, HUECO_EJEMPLO_MS) }
  }
}
