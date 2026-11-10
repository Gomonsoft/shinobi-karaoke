import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'
import { createPortal } from 'react-dom'
import { Ellipsis, type LucideIcon } from 'lucide-react'
import { BotonIcono } from './BotonIcono'
import { Icono } from './Icono'
import estilos from './componentes.module.css'

export interface ItemMenu {
  id: string
  etiqueta: string
  icono?: LucideIcon
  /** Se pinta en `error`. */
  destructivo?: boolean
  /** Línea separadora de 1 px antes del ítem (`role="separator"`, no interactiva). */
  separadorAntes?: boolean
  /** Motivo por el que no está disponible (aria-disabled): sigue enfocable y no hace nada. */
  noDisponible?: string
  alSeleccionar: () => void
}

interface MenuContextualProps {
  /** Nombre del botón (⋯), p. ej. "Más acciones de «Mi canción»". */
  etiqueta: string
  items: ItemMenu[]
  /** `-1` para sacar el botón ⋯ del orden de tabulación (p. ej. rejilla con roving tabindex). */
  tabIndexDisparador?: number
}

export interface PosicionMenu {
  top: number
  left: number
  /** Solo si no cabe entero: el menú se desplaza por dentro. */
  maxHeight?: number
}

/**
 * Coloca el menú (fixed) respecto al disparador: debajo si cabe; si no, arriba; si no cabe
 * en ninguno, donde haya más espacio con `maxHeight`. Alineado al borde derecho del disparador
 * y desplazado para no salirse del viewport.
 */
export function calcularPosicionMenu(
  disparador: { top: number; bottom: number; right: number },
  menu: { width: number; height: number },
  viewport: { width: number; height: number },
  margen: number,
  separacion: number
): PosicionMenu {
  const abajo = viewport.height - margen - (disparador.bottom + separacion)
  const arriba = disparador.top - separacion - margen
  let top: number
  let maxHeight: number | undefined
  if (menu.height <= abajo) top = disparador.bottom + separacion
  else if (menu.height <= arriba) top = disparador.top - separacion - menu.height
  else if (abajo >= arriba) {
    top = disparador.bottom + separacion
    maxHeight = Math.max(abajo, 0)
  } else {
    maxHeight = Math.max(arriba, 0)
    top = disparador.top - separacion - maxHeight
  }
  const maxIzq = Math.max(viewport.width - margen - menu.width, margen)
  const left = Math.min(Math.max(disparador.right - menu.width, margen), maxIzq)
  return { top, left, maxHeight }
}

/** Lee un token de espaciado (rem o px) en píxeles; `respaldo` si no está definido. */
function leerToken(nombre: string, respaldo: number): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim()
  const n = parseFloat(v)
  if (Number.isNaN(n)) return respaldo
  if (v.endsWith('rem'))
    return n * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
  return n
}

export function MenuContextual({ etiqueta, items, tabIndexDisparador }: MenuContextualProps) {
  const [abierto, setAbierto] = useState(false)
  const [inicial, setInicial] = useState<'primero' | 'ultimo'>('primero')
  const raiz = useRef<HTMLSpanElement>(null)
  const disparador = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const [posicion, setPosicion] = useState<PosicionMenu | null>(null)
  const idMenu = useId()

  const botonesItem = () =>
    Array.from(lista.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

  // Posición antes de pintar: se mide el menú ya montado y se coloca respecto al disparador.
  useLayoutEffect(() => {
    if (!abierto || !disparador.current || !lista.current) return
    const d = disparador.current.getBoundingClientRect()
    const m = lista.current.getBoundingClientRect()
    setPosicion(
      calcularPosicionMenu(
        d,
        { width: m.width, height: lista.current.scrollHeight || m.height },
        { width: window.innerWidth, height: window.innerHeight },
        leerToken('--e-2', 8),
        leerToken('--e-1', 4)
      )
    )
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    const dentro = (n: EventTarget | null) =>
      n instanceof Node && (raiz.current?.contains(n) || lista.current?.contains(n))
    const cerrarSiFuera = (e: Event) => {
      if (!dentro(e.target)) setAbierto(false)
    }
    const cerrarSiempre = () => setAbierto(false)
    document.addEventListener('mousedown', cerrarSiFuera)
    // En captura: cualquier contenedor con desplazamiento (la rejilla) cierra el menú.
    window.addEventListener('scroll', cerrarSiFuera, true)
    window.addEventListener('resize', cerrarSiempre)
    window.addEventListener('blur', cerrarSiempre)
    return () => {
      document.removeEventListener('mousedown', cerrarSiFuera)
      window.removeEventListener('scroll', cerrarSiFuera, true)
      window.removeEventListener('resize', cerrarSiempre)
      window.removeEventListener('blur', cerrarSiempre)
    }
  }, [abierto, inicial])

  // El foco solo puede entrar cuando el menú ya está colocado (hasta entonces es `visibility: hidden`).
  const colocado = posicion !== null
  useEffect(() => {
    if (!abierto || !colocado) return
    const items = botonesItem()
    ;(inicial === 'ultimo' ? items[items.length - 1] : items[0])?.focus()
  }, [abierto, colocado, inicial])

  const cerrar = (devolverFoco: boolean) => {
    setAbierto(false)
    setPosicion(null)
    if (devolverFoco) disparador.current?.focus()
  }

  const teclaDisparador = (e: KeyboardEvent) => {
    // Los eventos del menú (en el portal) burbujean por React hasta aquí: se ignoran.
    if (!raiz.current?.contains(e.target as Node)) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setInicial(e.key === 'ArrowUp' ? 'ultimo' : 'primero')
      setAbierto(true)
    }
  }

  const teclaMenu = (e: KeyboardEvent) => {
    const items = botonesItem()
    const i = items.indexOf(document.activeElement as HTMLElement)
    let destino = -1
    if (e.key === 'ArrowDown') destino = (i + 1) % items.length
    else if (e.key === 'ArrowUp') destino = (i - 1 + items.length) % items.length
    else if (e.key === 'Home') destino = 0
    else if (e.key === 'End') destino = items.length - 1
    else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cerrar(true)
      return
    } else if (e.key === 'Tab') {
      setAbierto(false)
      return
    } else if (/^\p{L}$/u.test(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const normalizar = (texto: string) =>
        texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
      const letra = normalizar(e.key)
      for (let paso = 1; paso <= items.length; paso++) {
        const siguiente = (i + paso) % items.length
        if (normalizar(items[siguiente]?.textContent?.trim() ?? '').startsWith(letra)) {
          destino = siguiente
          break
        }
      }
      if (destino === -1) return
    } else return
    e.preventDefault()
    items[destino]?.focus()
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <span ref={raiz} className={estilos.menuEnvoltorio} onKeyDown={teclaDisparador}>
      <BotonIcono
        ref={disparador}
        icono={Ellipsis}
        etiqueta={etiqueta}
        tabIndex={tabIndexDisparador}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? idMenu : undefined}
        ocultarTooltip={abierto}
        onClick={() => {
          setInicial('primero')
          setAbierto((a) => !a)
        }}
      />
      {abierto &&
        createPortal(
          // eslint-disable-next-line jsx-a11y/interactive-supports-focus
          <div
            ref={lista}
            id={idMenu}
            role="menu"
            aria-label={etiqueta}
            className={estilos.menu}
            style={
              posicion
                ? { top: posicion.top, left: posicion.left, maxHeight: posicion.maxHeight }
                : { visibility: 'hidden' }
            }
            onKeyDown={teclaMenu}
          >
            {items.map((it) => (
              <Fragment key={it.id}>
                {it.separadorAntes && <div role="separator" className={estilos.menuSeparador} />}
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className={`${estilos.item} ${it.destructivo ? estilos.itemDestructivo : ''}`}
                  aria-disabled={it.noDisponible ? true : undefined}
                  title={it.noDisponible}
                  onClick={() => {
                    if (it.noDisponible) return
                    cerrar(true)
                    it.alSeleccionar()
                  }}
                >
                  {it.icono && <Icono icono={it.icono} tamano={16} />}
                  {it.etiqueta}
                </button>
              </Fragment>
            ))}
          </div>,
          document.body
        )}
    </span>
  )
}
