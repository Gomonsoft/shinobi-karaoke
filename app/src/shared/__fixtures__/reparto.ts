import type { Cancion } from '../cancion'
import { linea, lista, pausa } from './index'

/*
 * Canciones de ejemplo del reparto (0.2.3, tarea 0340). Letra inventada, sin sincronía por palabra.
 * Cada llamada construye una nueva (sin estado compartido).
 */

/** Dos cantantes (Ana y Luis), una línea «Todos» y dos de coro. 30 s. */
export function cancionDosCantantes(): Cancion {
  const cancion = lista()
  cancion.metadatos.duracion_ms = 30_000
  cancion.letra = {
    origen: 'manual',
    lrclib_id: null,
    offset_ms: 0,
    partes: {
      cantantes: [
        { id: 'c1', nombre: 'Ana' },
        { id: 'c2', nombre: 'Luis' }
      ],
      voz_en_coros: 0.5
    },
    lineas: [
      linea('d1', 'Cruza el faro la gaviota', 2000),
      linea('d2', 'Responde el viento del sur', 5000, { parte: 'c2' }),
      linea('d3', 'Cantemos todos la marea', 8000, { parte: 'todos' }),
      pausa('dp'),
      linea('d4', '(Ah, ah, la marea)', 14_000, { parte: 'coro' }),
      linea('d5', 'Vuelve la barca al muelle', 18_000, { parte: 'c2' }),
      linea('d6', 'Ya duerme la bahía', 22_000, { parte: 'coro' })
    ]
  }
  return cancion
}

/** Un solo cantante y dos líneas de coro. 30 s. */
export function cancionUnCantanteConCoros(): Cancion {
  const cancion = lista()
  cancion.metadatos.duracion_ms = 30_000
  cancion.letra = {
    origen: 'manual',
    lrclib_id: null,
    offset_ms: 0,
    lineas: [
      linea('u1', 'Enciende el farol la nieve', 2000),
      linea('u2', 'Callan los pasos del alba', 5000),
      linea('u3', 'Eco de la plaza vacía', 8000, { parte: 'coro' }),
      linea('u4', 'Sube el humo de las casas', 12_000),
      linea('u5', 'Eco de la plaza vacía', 16_000, { parte: 'coro' })
    ]
  }
  return cancion
}
