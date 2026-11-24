import { useRef, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import type { PalabraBorrador } from '@shared/letras'
import { T } from './textosPreciso'
import { tiempoAPorcentaje, type VistaPrecisa } from './vistaPrecisa'
import css from './preciso.module.css'

interface Props {
  palabras: readonly PalabraBorrador[]
  seleccionada: number
  vista: VistaPrecisa
  /** «Quitar los tiempos por palabra»: toda la tira al 50 %. */
  atenuada?: boolean
  alSeleccionar(indice: number): void
  /** Doble clic: reproduce desde la palabra. */
  alEscucharPalabra(indice: number): void
  /** Teclas del contenedor (Intro, Alt/Ctrl + flechas…): si llama a `preventDefault`, la tira no actúa. */
  alTeclear?(e: KeyboardEvent<HTMLElement>): void
  /** Los tiradores de la palabra seleccionada, que comparten el eje. */
  children?: ReactNode
  /** Para llevar el foco a la tira (al abrir la ventana). */
  ref?: Ref<HTMLDivElement>
}

/**
 * Tira de palabras: `listbox` horizontal con *roving tabindex*; un segmento por palabra sobre el
 * mismo eje de tiempo que la onda. Controlada: no guarda selección ni tiempos.
 */
export function TiraPalabras({
  palabras,
  seleccionada,
  vista,
  atenuada,
  alSeleccionar,
  alEscucharPalabra,
  alTeclear,
  children,
  ref
}: Props) {
  const opciones = useRef<(HTMLElement | null)[]>([])
  const m = palabras.length

  function irA(k: number) {
    const destino = Math.max(0, Math.min(m - 1, k))
    alSeleccionar(destino)
    opciones.current[destino]?.focus()
  }

  function teclear(e: KeyboardEvent<HTMLDivElement>) {
    alTeclear?.(e)
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
    const destino =
      e.key === 'ArrowLeft'
        ? seleccionada - 1
        : e.key === 'ArrowRight'
          ? seleccionada + 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? m - 1
              : null
    if (destino === null) return
    e.preventDefault()
    irA(destino)
  }

  return (
    <div className={css.tira} data-atenuada={atenuada || undefined}>
      {/* El listbox recibe el teclado de sus opciones (roving tabindex). */}
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
      <div
        ref={ref}
        role="listbox"
        aria-orientation="horizontal"
        aria-label={T.tira}
        className={css.palabras}
        onKeyDown={teclear}
      >
        {palabras.map((p, k) => {
          const izquierda = Math.max(0, tiempoAPorcentaje(vista, p.inicio_ms))
          const derecha = Math.min(100, tiempoAPorcentaje(vista, p.fin_ms))
          if (derecha <= izquierda) return null
          return (
            // El teclado de las opciones lo gestiona el listbox (roving tabindex).
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <div
              key={k}
              ref={(nodo) => {
                opciones.current[k] = nodo
              }}
              role="option"
              aria-selected={k === seleccionada}
              aria-label={T.ariaPalabra(k + 1, m, p.texto, p.inicio_ms, p.fin_ms, p.marcada)}
              tabIndex={k === seleccionada ? 0 : -1}
              title={p.texto}
              className={css.palabra}
              data-marcada={p.marcada || undefined}
              data-seleccionada={k === seleccionada || undefined}
              style={{ left: `${izquierda}%`, width: `${derecha - izquierda}%` }}
              onClick={() => alSeleccionar(k)}
              onDoubleClick={() => alEscucharPalabra(k)}
            >
              <span aria-hidden="true">{p.texto}</span>
            </div>
          )
        })}
      </div>
      {children}
    </div>
  )
}
