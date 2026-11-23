import type { ResumenCancionIpc } from '@shared/ipc'
import { esListaParaRevisar, puedePrepararResumen } from '../tarjeta'

/** Las acciones de la barra de selección (docs/ux/02 · Feature 8, «A qué canciones aplica cada acción»). */
export type AccionLote =
  'preparar' | 'cola' | 'exportar' | 'paquete' | 'letra' | 'datos' | 'eliminar'

export interface ContextoAplica {
  /** Canciones con un trabajo vivo (descarga, separación) o en preparación. */
  conTrabajo: ReadonlySet<string>
  /** Canciones que se están exportando o esperan en la cola de exportación. */
  exportando: ReadonlySet<string>
  /** Canción que suena en la otra pantalla (no se elimina). */
  activaId: string | null
}

/** Clave de `MOTIVO` por la que una acción no aplica a una canción; `null` si aplica. */
export function motivoNoAplica(
  accion: AccionLote,
  r: ResumenCancionIpc,
  ctx: ContextoAplica
): string | null {
  const lista = r.estado === 'lista' && !r.danada
  switch (accion) {
    case 'preparar':
      if (r.danada) return 'danada'
      if (r.estado === 'lista') return 'yaLista'
      // Letra anterior a 0.2.2 sin marca: entra solo para ponerle los fines que faltan (con confirmación).
      if (
        r.prepararFinesSinMarca &&
        !ctx.conTrabajo.has(r.id) &&
        r.estadoPreparacion !== 'preparando'
      )
        return null
      if (esListaParaRevisar(r)) return 'yaPreparada'
      if (ctx.conTrabajo.has(r.id) || r.estadoPreparacion === 'preparando') return 'enCurso'
      return puedePrepararResumen(r, false) ? null : 'noLista'
    case 'cola':
      return lista ? null : 'noLista'
    case 'exportar':
      if (r.danada) return 'danada'
      if (!lista) return 'noLista'
      return ctx.exportando.has(r.id) ? 'exportando' : null
    case 'letra':
      return r.lineasConTiempo === 0 ? 'sinTiempos' : null
    case 'eliminar':
      return ctx.activaId === r.id ? 'activa' : null
    default:
      return null
  }
}

export const aplicaA = (accion: AccionLote, r: ResumenCancionIpc, ctx: ContextoAplica): boolean =>
  motivoNoAplica(accion, r, ctx) === null

/** Cuántas de las canciones admite cada acción. */
export function contarAplica(
  accion: AccionLote,
  rs: readonly ResumenCancionIpc[],
  ctx: ContextoAplica
): number {
  return rs.filter((r) => aplicaA(accion, r, ctx)).length
}

/** Seleccionadas en el orden visual de la Biblioteca; las que están fuera de la vista, al final. */
export function ordenarSeleccion(
  seleccionadas: readonly ResumenCancionIpc[],
  ordenVisual: readonly string[]
): ResumenCancionIpc[] {
  const posicion = new Map(ordenVisual.map((id, i) => [id, i]))
  return [...seleccionadas].sort(
    (a, b) => (posicion.get(a.id) ?? Infinity) - (posicion.get(b.id) ?? Infinity)
  )
}
