import { useCallback, useState } from 'react'
import type { ResumenCancionIpc } from '@shared/ipc'

/** Una Dañada con `cancion.json` ilegible no se puede abrir: no admite cambiar su tema (0054 §8). */
export function esSeleccionable(r: ResumenCancionIpc): boolean {
  return !(r.danada && r.motivo === 'json')
}

/** Ids del orden visual entre dos tarjetas, ambas incluidas; vacío si alguna no está en el orden. */
export function idsDelRango(orden: readonly string[], desde: string, hasta: string): string[] {
  const a = orden.indexOf(desde)
  const b = orden.indexOf(hasta)
  if (a < 0 || b < 0) return []
  return orden.slice(Math.min(a, b), Math.max(a, b) + 1)
}

export type EstadoCasilla = 'ninguna' | 'algunas' | 'todas'

/** Estado de la casilla de grupo respecto a las canciones editables que muestra. */
export function estadoCasilla(
  ids: readonly string[],
  seleccion: ReadonlySet<string>
): EstadoCasilla {
  const marcadas = ids.filter((id) => seleccion.has(id)).length
  if (marcadas === 0) return 'ninguna'
  return marcadas === ids.length ? 'todas' : 'algunas'
}

interface Estado {
  activo: boolean
  ids: ReadonlySet<string>
  /** Última tarjeta alternada (origen de Mayús + clic). */
  ultimo: string | null
}

const VACIO: Estado = { activo: false, ids: new Set(), ultimo: null }
// El modo selección sobrevive a salir de la vista (reproductor, editor) y volver, como el filtro.
let deSesion: Estado = VACIO

/** Solo para pruebas. */
export function reiniciarSeleccionDeSesion(): void {
  deSesion = VACIO
}

export interface Seleccion {
  activo: boolean
  /** Ids marcados, aunque estén fuera de la vista o ya no existan (quien lee filtra). */
  ids: ReadonlySet<string>
  /** Entra en el modo; con `ids`, además los marca. */
  entrar(ids?: Iterable<string>): void
  /** Sale del modo y vacía la selección. */
  salir(): void
  alternar(id: string): void
  /** Marca el rango entre la última alternada y `id` en el orden visual dado. */
  rango(id: string, orden: readonly string[], permitida: (id: string) => boolean): void
  anadir(ids: Iterable<string>): void
  quitar(ids: Iterable<string>): void
  /** Vacía la selección y sigue en el modo. */
  vaciar(): void
  /** Sustituye la selección (por ejemplo, con las fallidas de un lote). */
  fijar(ids: Iterable<string>): void
}

/** Estado de la selección múltiple por id, independiente de la vista (agrupación, búsqueda, plegado). */
export function useSeleccion(): Seleccion {
  const [estado, setEstado] = useState<Estado>(deSesion)
  const poner = useCallback((cambio: (e: Estado) => Estado) => {
    setEstado((e) => {
      deSesion = cambio(e)
      return deSesion
    })
  }, [])

  const entrar = useCallback(
    (ids?: Iterable<string>) =>
      poner((e) => ({
        activo: true,
        ids: ids ? new Set([...e.ids, ...ids]) : e.ids,
        ultimo: e.ultimo
      })),
    [poner]
  )
  const salir = useCallback(() => poner(() => VACIO), [poner])
  const alternar = useCallback(
    (id: string) =>
      poner((e) => {
        const ids = new Set(e.ids)
        if (!ids.delete(id)) ids.add(id)
        return { ...e, ids, ultimo: id }
      }),
    [poner]
  )
  const rango = useCallback(
    (id: string, orden: readonly string[], permitida: (id: string) => boolean) =>
      poner((e) => {
        const ids = new Set(e.ids)
        const origen = e.ultimo ?? id
        for (const r of idsDelRango(orden, origen, id)) if (permitida(r)) ids.add(r)
        return { ...e, ids, ultimo: id }
      }),
    [poner]
  )
  const anadir = useCallback(
    (ids: Iterable<string>) => poner((e) => ({ ...e, ids: new Set([...e.ids, ...ids]) })),
    [poner]
  )
  const quitar = useCallback(
    (ids: Iterable<string>) =>
      poner((e) => {
        const siguiente = new Set(e.ids)
        for (const id of ids) siguiente.delete(id)
        return { ...e, ids: siguiente }
      }),
    [poner]
  )
  const vaciar = useCallback(() => poner((e) => ({ ...e, ids: new Set(), ultimo: null })), [poner])
  const fijar = useCallback(
    (ids: Iterable<string>) => poner((e) => ({ ...e, ids: new Set(ids), ultimo: null })),
    [poner]
  )

  return {
    activo: estado.activo,
    ids: estado.ids,
    entrar,
    salir,
    alternar,
    rango,
    anadir,
    quitar,
    vaciar,
    fijar
  }
}
