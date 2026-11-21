import { useEffect, useState } from 'react'

const plural = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`

/** `aria-valuetext` del progreso: «1 minuto 12 segundos». */
export function textoTiempoLargo(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return [m > 0 ? plural(m, 'minuto', 'minutos') : null, plural(s, 'segundo', 'segundos')]
    .filter(Boolean)
    .join(' ')
}

/** Segundos que quedan de una cuenta: `restanteMs` al llegar el estado, menos lo transcurrido. */
export function segundosRestantes(
  restanteMs: number,
  congelada: boolean,
  recibidoEn: number,
  ahora: number
): number {
  const ms = congelada ? restanteMs : restanteMs - (ahora - recibidoEn)
  return Math.max(0, Math.ceil(ms / 1000))
}

/** `Date.now()` refrescado cada `cadaMs` mientras `activo` (reloj local de la cuenta). */
export function useAhora(activo: boolean, cadaMs = 250): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    if (!activo) return
    const id = setInterval(() => setAhora(Date.now()), cadaMs)
    return () => clearInterval(id)
  }, [activo, cadaMs])
  return ahora
}

let cancelarEnfoquePendiente: (() => void) | null = null

/**
 * Pone el foco en el primer elemento que cumpla `selector`, reintentando unos fotogramas. Solo
 * hay un enfoque pendiente a la vez: uno nuevo sustituye al anterior, para que un reintento
 * viejo no le robe el foco a la acción más reciente.
 */
export function enfocarCuando(selector: string, intentos = 20): () => void {
  cancelarEnfoquePendiente?.()
  let cancelado = false
  let marco = 0
  const probar = (restantes: number): void => {
    if (cancelado) return
    const nodo = document.querySelector<HTMLElement>(selector)
    if (nodo) {
      nodo.focus()
      if (cancelarEnfoquePendiente === cancelar) cancelarEnfoquePendiente = null
      return
    }
    if (restantes > 0) marco = requestAnimationFrame(() => probar(restantes - 1))
  }
  marco = requestAnimationFrame(() => probar(intentos))
  const cancelar = () => {
    cancelado = true
    cancelAnimationFrame(marco)
    if (cancelarEnfoquePendiente === cancelar) cancelarEnfoquePendiente = null
  }
  cancelarEnfoquePendiente = cancelar
  return cancelar
}
