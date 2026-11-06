import { useSyncExternalStore } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { TipoAviso } from './AvisoEnLinea'

export const MAX_TOASTS = 3
export const DURACION_TOAST_MS = 6000

export interface AccionToast {
  etiqueta: string
  icono?: LucideIcon
  alAccionar: () => void
}
export interface Toast {
  id: number
  tipo: TipoAviso
  mensaje: string
  accion?: AccionToast
  persistente?: boolean
}

// Gestor global (sin librería de estado, ADR 0007): almacén externo + useSyncExternalStore.
let toasts: Toast[] = []
let reteniendo = false
let retenidos: Toast[] = []
let siguiente = 1
const oyentes = new Set<() => void>()
const emitir = () => oyentes.forEach((o) => o())

export function mostrarToast(t: Omit<Toast, 'id'>): number {
  const id = siguiente++
  if (reteniendo) {
    retenidos = [...retenidos, { ...t, id }].slice(-MAX_TOASTS)
    return id
  }
  // Máximo 3 apiladas: al llegar la cuarta se descarta la más antigua.
  toasts = [...toasts, { ...t, id }].slice(-MAX_TOASTS)
  emitir()
  return id
}

export function cerrarToast(id: number) {
  retenidos = retenidos.filter((t) => t.id !== id)
  toasts = toasts.filter((t) => t.id !== id)
  emitir()
}

export function cerrarTodosLosToasts() {
  toasts = []
  retenidos = []
  emitir()
}

export function retenerToasts(activo: boolean): void {
  if (reteniendo === activo) return
  reteniendo = activo
  if (activo || retenidos.length === 0) return
  toasts = [...toasts, ...retenidos].slice(-MAX_TOASTS)
  retenidos = []
  emitir()
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (cb) => {
      oyentes.add(cb)
      return () => oyentes.delete(cb)
    },
    () => toasts
  )
}
