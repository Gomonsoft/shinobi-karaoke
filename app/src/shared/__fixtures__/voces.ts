import type { Cancion } from '../cancion'
import { linea, lista } from './index'

/*
 * Dúo inventado con voces a la vez (0.2.3, feature 3, tarea 0360): Marta (c1) e Iván (c2) se pisan a
 * medias, un coro acompaña a la principal y «Todos» canta solo, sin solapes. Letra inventada; los inicios
 * crecen en toda la letra y cada fin respeta a la siguiente línea de su parte (ADR 0029 §7). 30 s.
 */
export function cancionVocesAlaVez(): Cancion {
  const cancion = lista()
  cancion.metadatos.duracion_ms = 30_000
  cancion.letra = {
    origen: 'manual',
    lrclib_id: null,
    offset_ms: 0,
    partes: {
      cantantes: [
        { id: 'c1', nombre: 'Marta' },
        { id: 'c2', nombre: 'Iván' }
      ]
    },
    lineas: [
      linea('v1', 'Luciérnagas en el tejado', 2000, { fin_ms: 6000 }),
      linea('v2', 'Responde la lluvia lenta', 4500, { parte: 'c2', fin_ms: 8500 }),
      linea('v3', 'Se enciende la calle entera', 7000, { fin_ms: 10_000 }),
      linea('v4', '(Ah, ah, la lluvia)', 7500, { parte: 'coro', fin_ms: 11_000 }),
      linea('v5', 'Cantemos juntos al alba', 12_000, { parte: 'todos', fin_ms: 15_000 }),
      linea('v6', 'Vuelve el barco a la bahía', 16_000, { parte: 'c2', fin_ms: 19_000 }),
      linea('v7', '(Ya duerme la lluvia)', 16_500, { parte: 'coro', fin_ms: 19_500 })
    ]
  }
  return cancion
}
