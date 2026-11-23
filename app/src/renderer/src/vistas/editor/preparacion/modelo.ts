import type { Preparacion } from '@shared/cancion'
import type { Letra } from '@shared/letra'

/** Lo que el bloque «Preparación automática» lista (solo lo que sigue en pie). */
export interface BloquePreparacion {
  fecha: string
  /** La letra la eligió la app (`app`) o el usuario entre las candidatas (`usuario`), y sigue puesta. */
  letra: 'app' | 'usuario' | null
  /** Corrección de desfase recordada (`letra.desfase_corregido_ms`). */
  desfaseMs: number | null
  /** Líneas con el fin fijado por la preparación que no se han tocado después. */
  fines: number
}

const formato = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })

/** `21 nov 2026` (sin el punto que añade «short» en algunos meses). */
export function fechaCorta(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : formato.format(d).replace(/\./g, '')
}

/**
 * Renglones del bloque: nada se muestra si el registro no existe o ya no queda ninguno cierto (letra
 * sustituida, corrección quitada, ningún fin de la preparación en pie).
 */
export function bloquePreparacion(
  registro: Preparacion | null | undefined,
  letra: Pick<Letra, 'lrclib_id' | 'desfase_corregido_ms' | 'lineas'>
): BloquePreparacion | null {
  if (!registro) return null
  const eleccion = registro.eleccion
  const letraPuesta =
    eleccion && letra.lrclib_id !== null && letra.lrclib_id === eleccion.lrclib_id
      ? eleccion.por === 'app'
        ? 'app'
        : 'usuario'
      : null
  const desfaseMs = letra.desfase_corregido_ms ? letra.desfase_corregido_ms : null
  const fines = letra.lineas.filter(
    (l) => l.tipo === 'linea' && l.origen_fin === 'preparacion'
  ).length
  if (letraPuesta === null && desfaseMs === null && fines === 0) return null
  return { fecha: fechaCorta(registro.actualizado), letra: letraPuesta, desfaseMs, fines }
}
