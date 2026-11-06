import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import estilos from './componentes.module.css'

/** Retardo al pasar el ratón (§6). Con foco de teclado aparece al instante. */
export const RETARDO_TOOLTIP_MS = 500

interface TooltipProps {
  contenido: ReactNode
  /** Id del elemento `role="tooltip"`, por si el control lo referencia con `aria-describedby`. */
  id?: string
  /** Fuerza que se muestre; una clave nueva reinicia el aviso temporal. */
  forzar?: boolean | { ms?: number; clave: number | string }
  /** Lo oculta hasta que el puntero salga y vuelva a entrar o el foco vuelva a llegar. */
  suprimir?: boolean
  children: ReactNode
}

export function posicionTooltip(
  ancla: { top: number; bottom: number; left: number; width: number },
  caja: { width: number; height: number },
  vista: { width: number; height: number },
  margen = 8
): { top: number; left: number } {
  const encima = ancla.top - margen - caja.height
  const debajo = ancla.bottom + margen
  const izquierda = ancla.left + (ancla.width - caja.width) / 2
  return {
    top: Math.max(
      margen,
      Math.min(encima >= margen ? encima : debajo, vista.height - caja.height - margen)
    ),
    left: Math.max(margen, Math.min(izquierda, vista.width - caja.width - margen))
  }
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
  const [caducada, setCaducada] = useState<number | string | undefined>()
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const ancla = useRef<HTMLSpanElement>(null)
  const caja = useRef<HTMLSpanElement>(null)

  const limpiar = useCallback(() => clearTimeout(temporizador.current), [])
  useEffect(() => limpiar, [limpiar])

  if (suprimir && !cerrado) setCerrado(true)

  const clave = typeof forzar === 'object' ? forzar.clave : undefined
  const ms = typeof forzar === 'object' ? (forzar.ms ?? 2000) : 0
  useEffect(() => {
    if (clave === undefined) return
    const timer = setTimeout(() => setCaducada(clave), ms)
    return () => clearTimeout(timer)
  }, [clave, ms])
  const temporal = clave !== undefined && clave !== caducada
  const visible =
    !suprimir &&
    (clave !== undefined ? temporal : (forzar === true || porRaton || porFoco) && !cerrado)

  useLayoutEffect(() => {
    if (!visible) return
    const origen = ancla.current!
    const destino = caja.current!
    const situar = () => {
      const pos = posicionTooltip(origen.getBoundingClientRect(), destino.getBoundingClientRect(), {
        width: window.innerWidth,
        height: window.innerHeight
      })
      Object.assign(destino.style, {
        left: `${pos.left}px`,
        top: `${pos.top}px`,
        visibility: 'visible'
      })
    }
    situar()
    window.addEventListener('resize', situar)
    window.addEventListener('scroll', situar, true)
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(situar)
    observador?.observe(destino)
    return () => {
      observador?.disconnect()
      window.removeEventListener('resize', situar)
      window.removeEventListener('scroll', situar, true)
    }
  }, [visible])

  // Esc descarta el tooltip sin mover el foco.
  useEffect(() => {
    if (!visible) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCerrado(true)
        setCaducada(clave)
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [visible, clave])

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
      ref={ancla}
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
        <span ref={caja} role="tooltip" id={id} className={estilos.tooltip}>
          {contenido}
        </span>
      )}
    </span>
  )
}
