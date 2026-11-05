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
}

/** Diálogos abiertos, el último arriba: solo el de arriba atiende Esc y Tab (diálogos anidados). */
const pila: symbol[] = []

/** Modal que atrapa el foco, se cancela con Esc y devuelve el foco al disparador. */
export function Dialogo({
  abierto,
  titulo,
  onCancelar,
  children,
  acciones,
  enfoqueInicial
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
    ;(inicial ?? enfocables()[0] ?? nodo).focus()

    const marca = Symbol('dialogo')
    pila.push(marca)
    const alTeclear = (e: KeyboardEvent) => {
      if (pila[pila.length - 1] !== marca) return
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
      pila.splice(pila.indexOf(marca), 1)
      if (disparador && document.contains(disparador)) disparador.focus()
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
        tabIndex={-1}
        className={estilos.dialogo}
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
