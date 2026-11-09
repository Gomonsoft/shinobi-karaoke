import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent
} from 'react'
import { RETARDO_TOOLTIP_MS } from './Tooltip'
import estilos from './divisor.module.css'

export type OrigenCambio = 'teclado' | 'arrastre'
/** Lo que el contenedor decide para una tecla (mismo contrato que `aplicarTecla` del editor). */
export type AccionDivisor = { tipo: 'tamano'; valor: number } | { tipo: 'alternar' } | null

/** Atributo de `body` mientras se arrastra un divisor: los atajos globales se apartan (Esc es del arrastre). */
export const ATRIBUTO_ARRASTRE_DIVISOR = 'arrastreDivisor'

const TECLAS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter']

export interface DivisorProps {
  /** Identifica el divisor en el DOM (`data-divisor`). */
  nombre: string
  /** `vertical` controla un ancho (arrastre horizontal) y `horizontal` un alto. */
  orientacion: 'vertical' | 'horizontal'
  /** Id del elemento que controla. */
  controla: string
  etiqueta: string
  /** Tamaño visible, en px, y límites efectivos. */
  valor: number
  min: number
  max: number
  minimizado: boolean
  textoValor: string
  tooltip: string
  /** Clase de colocación en la rejilla del contenedor. */
  className?: string
  /** Valor de `data-foco-editor`: así los atajos globales saben que el foco está en un divisor. */
  focoEditor?: string
  alTecla(tecla: string, mayus: boolean): AccionDivisor
  /** Tamaño tras desplazar el puntero `deltaPx` desde `inicio` (ya acotado por el contenedor). */
  alArrastre(inicio: number, deltaPx: number): number
  alCambiar(valor: number, origen: OrigenCambio): void
  alConfirmar(valor: number): void
  alRestablecer(): void
  alAlternar?(): void
}

interface Arrastre {
  id: number
  x: number
  y: number
  cx: number
  cy: number
  inicio: number
  ultimo: number
  movido: boolean
}

/**
 * Separador redimensionable (patrón *Window Splitter* de WAI-ARIA). No conoce el editor: el
 * contenedor decide qué hace cada tecla y cada desplazamiento.
 */
export function Divisor({
  nombre,
  orientacion,
  controla,
  etiqueta,
  valor,
  min,
  max,
  minimizado,
  textoValor,
  tooltip,
  className,
  focoEditor,
  alTecla,
  alArrastre,
  alCambiar,
  alConfirmar,
  alRestablecer,
  alAlternar
}: DivisorProps) {
  const horizontal = orientacion === 'horizontal'
  const [vivo, setVivo] = useState<number | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [ayuda, setAyuda] = useState(false)
  const arrastre = useRef<Arrastre | null>(null)
  const nodo = useRef<HTMLDivElement>(null)
  const marco = useRef(0)
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const limpiarArrastre = () => {
    cancelAnimationFrame(marco.current)
    marco.current = 0
    delete document.body.dataset[ATRIBUTO_ARRASTRE_DIVISOR]
  }
  useEffect(
    () => () => {
      clearTimeout(temporizador.current)
      if (arrastre.current) limpiarArrastre()
    },
    []
  )

  const tamanoDe = (a: Arrastre) => alArrastre(a.inicio, horizontal ? a.cy - a.y : a.cx - a.x)

  function aplicar() {
    marco.current = 0
    const a = arrastre.current
    if (!a) return
    const v = tamanoDe(a)
    if (v === a.ultimo) return
    a.ultimo = v
    setVivo(v)
    alCambiar(v, 'arrastre')
  }

  function terminar(confirmar: boolean) {
    const a = arrastre.current
    if (!a) return
    arrastre.current = null
    cancelAnimationFrame(marco.current)
    marco.current = 0
    limpiarArrastre()
    setArrastrando(false)
    setVivo(null)
    const final = confirmar && a.movido ? tamanoDe(a) : a.inicio
    if (final !== a.ultimo) alCambiar(final, 'arrastre')
    if (final !== a.inicio) alConfirmar(final)
    if (nodo.current?.hasPointerCapture?.(a.id)) nodo.current.releasePointerCapture(a.id)
  }

  const alEscapar = useEffectEvent((e: globalThis.KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    terminar(false)
  })
  useEffect(() => {
    if (!arrastrando) return
    const escuchar = (e: globalThis.KeyboardEvent) => alEscapar(e)
    window.addEventListener('keydown', escuchar, true)
    return () => window.removeEventListener('keydown', escuchar, true)
  }, [arrastrando])

  function alBajar(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.focus({ preventScroll: true })
    e.currentTarget.setPointerCapture?.(e.pointerId)
    clearTimeout(temporizador.current)
    setAyuda(false)
    arrastre.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      cx: e.clientX,
      cy: e.clientY,
      inicio: valor,
      ultimo: valor,
      movido: false
    }
    document.body.dataset[ATRIBUTO_ARRASTRE_DIVISOR] = horizontal ? 'fila' : 'col'
    setArrastrando(true)
  }

  function alMover(e: PointerEvent<HTMLDivElement>) {
    const a = arrastre.current
    if (!a || e.pointerId !== a.id) return
    a.movido = true
    a.cx = e.clientX
    a.cy = e.clientY
    if (!marco.current) marco.current = requestAnimationFrame(aplicar)
  }

  function alSoltar(e: PointerEvent<HTMLDivElement>) {
    const a = arrastre.current
    if (!a || e.pointerId !== a.id) return
    if (e.clientX !== a.x || e.clientY !== a.y) {
      a.movido = true
      a.cx = e.clientX
      a.cy = e.clientY
    }
    terminar(true)
  }

  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || !TECLAS.includes(e.key)) return
    // Con el foco aquí las cuatro flechas son del divisor: las del otro eje no hacen nada.
    e.preventDefault()
    e.stopPropagation()
    const accion = alTecla(e.key, e.shiftKey)
    if (accion?.tipo === 'tamano') alCambiar(accion.valor, 'teclado')
    else if (accion?.tipo === 'alternar') alAlternar?.()
  }

  const visible = vivo ?? valor
  const clases = [
    estilos.divisor,
    horizontal ? estilos.horizontal : estilos.vertical,
    arrastrando && estilos.arrastrando,
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    // El separador enfocable es un widget (WAI-ARIA *Window Splitter*).
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
    <div
      ref={nodo}
      role="separator"
      tabIndex={0}
      className={clases}
      data-divisor={nombre}
      data-foco-editor={focoEditor}
      aria-orientation={orientacion}
      aria-controls={controla}
      aria-label={etiqueta}
      aria-valuenow={Math.min(Math.max(visible, min), max)}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={textoValor}
      data-minimizado={minimizado || undefined}
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={() => terminar(true)}
      onLostPointerCapture={() => terminar(true)}
      onDoubleClick={alRestablecer}
      onKeyDown={alTeclear}
      onMouseEnter={() => {
        clearTimeout(temporizador.current)
        temporizador.current = setTimeout(() => setAyuda(true), RETARDO_TOOLTIP_MS)
      }}
      onMouseLeave={() => {
        clearTimeout(temporizador.current)
        setAyuda(false)
      }}
    >
      <span className={estilos.linea} aria-hidden="true" />
      <span className={estilos.agarre} aria-hidden="true">
        {horizontal ? '⋯' : '⋮'}
      </span>
      {ayuda && !arrastrando && (
        <span role="tooltip" className={estilos.tooltip}>
          {tooltip}
        </span>
      )}
    </div>
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  )
}
