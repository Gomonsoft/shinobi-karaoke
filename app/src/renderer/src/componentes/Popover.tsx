import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject
} from 'react'
import { createPortal } from 'react-dom'
import { calcularPosicionMenu } from './MenuContextual'
import estilos from './componentes.module.css'

interface PopoverProps {
  abierto: boolean
  ancla: RefObject<HTMLElement | null>
  alCerrar(): void
  titulo?: string
  children: ReactNode
  etiqueta: string
  anunciar?: boolean
}

export function Popover({
  abierto,
  ancla,
  alCerrar,
  titulo,
  children,
  etiqueta,
  anunciar
}: PopoverProps) {
  const caja = useRef<HTMLDivElement>(null)
  const id = useId()
  const cerrar = useEffectEvent(() => {
    ancla.current?.focus()
    alCerrar()
  })

  useLayoutEffect(() => {
    if (!abierto) return
    const nodo = caja.current!
    const situar = () => {
      const origen = ancla.current
      if (!origen) return
      const rect = nodo.getBoundingClientRect()
      const { top, left, maxHeight } = calcularPosicionMenu(
        origen.getBoundingClientRect(),
        { width: rect.width, height: nodo.scrollHeight || rect.height },
        { width: window.innerWidth, height: window.innerHeight },
        8,
        4
      )
      Object.assign(nodo.style, {
        top: `${top}px`,
        left: `${left}px`,
        maxHeight: maxHeight === undefined ? '' : `${maxHeight}px`
      })
    }
    situar()
    window.addEventListener('resize', situar)
    window.addEventListener('scroll', situar, true)
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(situar)
    observador?.observe(nodo)
    return () => {
      observador?.disconnect()
      window.removeEventListener('resize', situar)
      window.removeEventListener('scroll', situar, true)
    }
  }, [abierto, ancla])

  useEffect(() => {
    if (!abierto) return
    const tecla = (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.querySelector('[aria-modal="true"]')) return
      if (e.key === 'Escape') {
        e.preventDefault()
        cerrar()
      } else if (e.key === 'Tab' && !e.shiftKey && e.target === ancla.current) {
        e.preventDefault()
        const primero = caja.current?.querySelector<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]'
        )
        ;(primero ?? caja.current)?.focus()
      }
    }
    const fuera = (e: PointerEvent) => {
      if (
        !(e.target instanceof Node) ||
        caja.current?.contains(e.target) ||
        ancla.current?.contains(e.target)
      )
        return
      e.preventDefault()
      cerrar()
    }
    document.addEventListener('keydown', tecla)
    document.addEventListener('pointerdown', fuera)
    return () => {
      document.removeEventListener('keydown', tecla)
      document.removeEventListener('pointerdown', fuera)
    }
  }, [abierto, ancla])

  if (!abierto) return null
  return createPortal(
    <div
      ref={caja}
      role="dialog"
      tabIndex={-1}
      aria-labelledby={titulo ? id : undefined}
      aria-label={titulo ? undefined : etiqueta}
      className={estilos.popover}
    >
      {titulo && (
        <h2 id={id} className={estilos.popoverTitulo}>
          {titulo}
        </h2>
      )}
      {anunciar && (
        <span className={estilos.soloLector} role="status">
          {titulo ?? etiqueta}
        </span>
      )}
      {children}
    </div>,
    document.body
  )
}
