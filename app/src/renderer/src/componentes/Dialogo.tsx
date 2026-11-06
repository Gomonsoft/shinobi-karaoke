import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import estilos from './componentes.module.css'

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface DialogoProps {
  abierto: boolean
  titulo: string
  /** Se llama con Esc o con la acción de cancelar. */
  onCancelar: () => void
  children?: ReactNode
  /** Botones; la acción primaria va a la derecha. */
  acciones?: ReactNode
  /** Selector CSS del elemento que recibe el foco al abrir (por defecto, el primero enfocable). */
  enfoqueInicial?: string
  /** `id` del contenido que describe el diálogo (`aria-describedby`). */
  descripcionId?: string
  /** Ancho propio (por defecto, el de `.dialogo`), p. ej. `32.5rem`. */
  ancho?: string
}

/** Diálogos abiertos, el último arriba: solo el de arriba atiende Esc y Tab (diálogos anidados). */
const pila: HTMLElement[] = []
const inertes = new Set<HTMLElement>()
let observador: MutationObserver | null = null

function aplicarInercia(): void {
  const superior = pila.at(-1)
  for (const nodo of inertes) {
    if (superior && nodo !== superior && nodo.parentElement === document.body) continue
    nodo.removeAttribute('inert')
    inertes.delete(nodo)
  }
  if (!superior) return
  for (const nodo of document.body.children) {
    if (nodo instanceof HTMLElement && nodo !== superior && !nodo.hasAttribute('inert')) {
      nodo.setAttribute('inert', '')
      inertes.add(nodo)
    }
  }
}

/** Modal que atrapa el foco, se cancela con Esc y devuelve el foco al disparador. */
export function Dialogo({
  abierto,
  titulo,
  onCancelar,
  children,
  acciones,
  enfoqueInicial,
  descripcionId,
  ancho
}: DialogoProps) {
  const idTitulo = useId()
  const caja = useRef<HTMLDivElement>(null)
  const alCancelar = useRef(onCancelar)
  useEffect(() => {
    alCancelar.current = onCancelar
  })

  useEffect(() => {
    if (!abierto) return
    const disparador = document.activeElement as HTMLElement | null
    const nodo = caja.current!
    const enfocables = () => Array.from(nodo.querySelectorAll<HTMLElement>(ENFOCABLES))
    const inicial = enfoqueInicial ? nodo.querySelector<HTMLElement>(enfoqueInicial) : null
    const velo = nodo.parentElement!
    pila.push(velo)
    aplicarInercia()
    if (!observador) {
      observador = new MutationObserver(aplicarInercia)
      observador.observe(document.body, { childList: true })
    }
    const enfocar = () => (inicial ?? enfocables()[0] ?? nodo).focus()
    enfocar()
    const protegerFoco = (e: FocusEvent) => {
      if (pila.at(-1) === velo && e.target instanceof Node && !nodo.contains(e.target)) enfocar()
    }
    document.addEventListener('focusin', protegerFoco)

    const alTeclear = (e: KeyboardEvent) => {
      if (pila.at(-1) !== velo || e.defaultPrevented) return
      if (e.key === 'Escape') {
        e.preventDefault()
        alCancelar.current()
      } else if (e.key === 'Tab') {
        const lista = enfocables()
        if (lista.length === 0) {
          e.preventDefault()
          return
        }
        const primero = lista[0]!
        const ultimo = lista[lista.length - 1]!
        const activo = document.activeElement
        if (e.shiftKey && (activo === primero || activo === nodo || !nodo.contains(activo))) {
          e.preventDefault()
          ultimo.focus()
        } else if (!e.shiftKey && (activo === ultimo || !nodo.contains(activo))) {
          e.preventDefault()
          primero.focus()
        }
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.removeEventListener('focusin', protegerFoco)
      const estabaArriba = pila.at(-1) === velo
      pila.splice(pila.indexOf(velo), 1)
      aplicarInercia()
      if (pila.length === 0) {
        observador?.disconnect()
        observador = null
      }
      if (estabaArriba && disparador?.isConnected && !disparador.closest('[inert]'))
        disparador.focus()
    }
  }, [abierto, enfoqueInicial])

  if (!abierto) return null
  return createPortal(
    <div className={estilos.velo}>
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descripcionId}
        tabIndex={-1}
        className={estilos.dialogo}
        style={ancho ? { width: ancho } : undefined}
      >
        <h2 id={idTitulo} className={estilos.dialogoTitulo}>
          {titulo}
        </h2>
        {children}
        {acciones && <div className={estilos.acciones}>{acciones}</div>}
      </div>
    </div>,
    document.body
  )
}
