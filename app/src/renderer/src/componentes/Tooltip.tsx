import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import estilos from './componentes.module.css'

/** Retardo al pasar el ratón (§6). Con foco de teclado aparece al instante. */
export const RETARDO_TOOLTIP_MS = 500

interface TooltipProps {
  contenido: ReactNode
  /** Id del elemento `role="tooltip"`, por si el control lo referencia con `aria-describedby`. */
  id?: string
  /** Fuerza que se muestre (p. ej. al pulsar una acción no disponible). */
  forzar?: boolean
  /** Lo oculta hasta que el puntero salga y vuelva a entrar o el foco vuelva a llegar. */
  suprimir?: boolean
  children: ReactNode
}

export function Tooltip({
  contenido,
  id,
  forzar = false,
  suprimir = false,
  children
}: TooltipProps) {
  const [porRaton, setPorRaton] = useState(false)
  const [porFoco, setPorFoco] = useState(false)
  const [cerrado, setCerrado] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const limpiar = useCallback(() => clearTimeout(temporizador.current), [])
  useEffect(() => limpiar, [limpiar])

  if (suprimir && !cerrado) setCerrado(true)

  const visible = (forzar || porRaton || porFoco) && !cerrado

  // Esc descarta el tooltip sin mover el foco (WCAG 1.4.13).
  useEffect(() => {
    if (!visible) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCerrado(true)
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [visible])

  const entrarRaton = () => {
    setCerrado(false)
    limpiar()
    temporizador.current = setTimeout(() => setPorRaton(true), RETARDO_TOOLTIP_MS)
  }
  const salirRaton = () => {
    limpiar()
    setPorRaton(false)
  }

  return (
    <span
      className={estilos.tooltipEnvoltorio}
      onMouseEnter={entrarRaton}
      onMouseLeave={salirRaton}
      onFocus={() => {
        setCerrado(false)
        setPorFoco(true)
      }}
      onBlur={() => setPorFoco(false)}
    >
      {children}
      {visible && (
        <span role="tooltip" id={id} className={estilos.tooltip}>
          {contenido}
        </span>
      )}
    </span>
  )
}
