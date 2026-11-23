import type { EstadoActualizacionesIpc } from '@shared/ipc'
import { esPrevia } from '@shared/version'

/** Reglas de visibilidad del aviso de versión nueva (`ux/08`, feature 3). Funciones puras. */

/** Hay versión nueva que avisar: compilación publicada, aviso activado y versión disponible. */
export function hayNueva(e: EstadoActualizacionesIpc | null): boolean {
  return e !== null && e.canal === 'publicada' && e.avisar && e.disponible !== null
}

/** El punto del botón ⚙: hay versión nueva y el usuario aún no ha visto esa versión en Ajustes. */
export function hayPunto(e: EstadoActualizacionesIpc | null): boolean {
  return hayNueva(e) && e?.disponible?.version !== e?.vista
}

export const esPreliminar = esPrevia

const dosDigitos = (n: number): string => String(n).padStart(2, '0')
const mismoDia = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/** «hoy a las 18:42», «ayer» o la fecha corta local («18 nov 2026»). */
export function cuandoComprobado(iso: string, ahora: Date = new Date()): string {
  const f = new Date(iso)
  if (mismoDia(f, ahora))
    return `hoy a las ${dosDigitos(f.getHours())}:${dosDigitos(f.getMinutes())}`
  const ayer = new Date(ahora)
  ayer.setDate(ayer.getDate() - 1)
  if (mismoDia(f, ayer)) return 'ayer'
  return f
    .toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace(/\./g, '')
}
