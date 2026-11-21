import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { huecoPorPosicion } from './ordenCola'

/** Franja (px) junto al borde del panel donde el arrastre desplaza la lista. */
const BORDE_DESPLAZAMIENTO = 36
const VELOCIDAD_MAXIMA = 14

export interface EstadoArrastre {
  entradaId: string
  indice: number
  /** Hueco de destino: 0 = antes de la primera, `total` = tras la última. */
  hueco: number
  x: number
  y: number
}

interface Opciones {
  contenedor: RefObject<HTMLElement | null>
  /** Se llama al soltar con la entrada y el hueco elegido (sin filtrar los no-ops). */
  alSoltar(entradaId: string, indice: number, hueco: number): void
}

function ancestroConScroll(nodo: HTMLElement | null): HTMLElement | null {
  for (let n = nodo?.parentElement; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY
    if (o === 'auto' || o === 'scroll') return n
  }
  return null
}

/**
 * Arrastre de una fila por su asa con eventos de puntero (sin librerías, como los divisores).
 * Esc cancela, los bordes del panel desplazan la lista y el hueco se calcula con las mitades de
 * las filas. El equivalente de teclado y de menú vive en `ListaPendientes`.
 */
export function useArrastreCola({ contenedor, alSoltar }: Opciones) {
  const [arrastre, setArrastre] = useState<EstadoArrastre | null>(null)
  const ref = useRef<EstadoArrastre | null>(null)
  const alSoltarRef = useRef(alSoltar)
  useEffect(() => {
    alSoltarRef.current = alSoltar
  })
  const id = arrastre?.entradaId

  const actualizar = useCallback(
    (x: number, y: number) => {
      const actual = ref.current
      if (!actual) return
      const filas = Array.from(
        contenedor.current?.querySelectorAll<HTMLElement>('[data-entrada-id]') ?? []
      )
      const centros = filas.map((f) => {
        const r = f.getBoundingClientRect()
        return r.top + r.height / 2
      })
      const siguiente = { ...actual, x, y, hueco: huecoPorPosicion(centros, y) }
      ref.current = siguiente
      setArrastre(siguiente)
    },
    [contenedor]
  )

  useEffect(() => {
    if (!id) return
    let velocidad = 0
    let marco = 0
    const desplazable = ancestroConScroll(contenedor.current)
    const paso = () => {
      if (velocidad !== 0 && desplazable) {
        desplazable.scrollTop += velocidad
        const a = ref.current
        if (a) actualizar(a.x, a.y)
      }
      marco = requestAnimationFrame(paso)
    }
    const terminar = (soltar: boolean) => {
      const a = ref.current
      ref.current = null
      setArrastre(null)
      if (soltar && a) alSoltarRef.current(a.entradaId, a.indice, a.hueco)
    }
    const alMover = (e: globalThis.PointerEvent) => {
      actualizar(e.clientX, e.clientY)
      velocidad = 0
      if (desplazable) {
        const r = desplazable.getBoundingClientRect()
        if (e.clientY < r.top + BORDE_DESPLAZAMIENTO)
          velocidad =
            -VELOCIDAD_MAXIMA *
            Math.min(1, (r.top + BORDE_DESPLAZAMIENTO - e.clientY) / BORDE_DESPLAZAMIENTO)
        else if (e.clientY > r.bottom - BORDE_DESPLAZAMIENTO)
          velocidad =
            VELOCIDAD_MAXIMA *
            Math.min(1, (e.clientY - (r.bottom - BORDE_DESPLAZAMIENTO)) / BORDE_DESPLAZAMIENTO)
      }
    }
    const alSoltarPuntero = () => terminar(true)
    const alCancelar = () => terminar(false)
    const alTecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      terminar(false)
    }
    window.addEventListener('pointermove', alMover)
    window.addEventListener('pointerup', alSoltarPuntero)
    window.addEventListener('pointercancel', alCancelar)
    window.addEventListener('keydown', alTecla, true)
    window.addEventListener('blur', alCancelar)
    marco = requestAnimationFrame(paso)
    return () => {
      cancelAnimationFrame(marco)
      window.removeEventListener('pointermove', alMover)
      window.removeEventListener('pointerup', alSoltarPuntero)
      window.removeEventListener('pointercancel', alCancelar)
      window.removeEventListener('keydown', alTecla, true)
      window.removeEventListener('blur', alCancelar)
    }
  }, [id, contenedor, actualizar])

  const iniciar = useCallback(
    (e: PointerEvent, entradaId: string, indice: number) => {
      if (e.button !== 0) return
      e.preventDefault()
      ref.current = { entradaId, indice, hueco: indice, x: e.clientX, y: e.clientY }
      actualizar(e.clientX, e.clientY)
    },
    [actualizar]
  )

  return { arrastre, iniciar }
}
