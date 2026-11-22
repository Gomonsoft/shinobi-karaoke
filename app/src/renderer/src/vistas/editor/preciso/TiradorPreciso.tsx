import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { formatearTiempo } from '@shared/letras/tiempos'
import { tiempoAPorcentaje, type VistaPrecisa } from './vistaPrecisa'
import css from './preciso.module.css'

export interface ResultadoLimitar {
  valor: number
  /** Límite alcanzado (clave del llamador, p. ej. `anterior`); `null` si no hubo. */
  limite: string | null
}

interface Props {
  /** `linea`: trazo de 3 px `texto-1`, a toda la altura; `palabra`: 2 px `acento-texto`. */
  tipo: 'linea' | 'palabra'
  borde: 'inicio' | 'fin'
  ms: number
  vista: VistaPrecisa
  /** Nombre accesible. */
  etiqueta: string
  /** Fin automático de la línea: trazo discontinuo. */
  automatico?: boolean
  /** Casi coincide con el de la palabra vecina: se desplaza en vertical. */
  escalonado?: boolean
  /** Rango para `aria-valuemin/max`. */
  min: number
  max: number
  /** Calcula el valor válido más cercano y el límite alcanzado (lo decide quien lo usa). */
  limitar(ms: number): ResultadoLimitar
  /** Texto del tooltip de un límite (visible mientras se arrastra). */
  textoLimite?(limite: string): string
  /** Cada cambio provisional del arrastre (vista previa en vivo). */
  alMover?(ms: number, limite: string | null): void
  /** Al soltar con el valor final. */
  alConfirmar(ms: number): void
  /** Esc: el arrastre se descarta. */
  alCancelar?(): void
  /** Flechas con el foco en el tirador (±10 ms; con Mayús ±100). */
  alAjustar?(deltaMs: number): void
}

interface Arrastre {
  id: number
  origenX: number
  inicioMs: number
  ancho: number
  ultimo: number
}

/** Tirador de la ventana del editor preciso. Su contenedor debe estar posicionado y medir el ancho de la vista. */
export function TiradorPreciso({
  tipo,
  borde,
  ms,
  vista,
  etiqueta,
  automatico,
  escalonado,
  min,
  max,
  limitar,
  textoLimite,
  alMover,
  alConfirmar,
  alCancelar,
  alAjustar
}: Props) {
  const arrastre = useRef<Arrastre | null>(null)
  const [vivo, setVivo] = useState<ResultadoLimitar | null>(null)
  const arrastrando = vivo !== null

  function terminar(confirmar: boolean) {
    const a = arrastre.current
    if (!a) return
    arrastre.current = null
    setVivo(null)
    if (confirmar) alConfirmar(a.ultimo)
    else alCancelar?.()
  }

  useEffect(() => {
    if (!arrastrando) return
    const alEscapar = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      terminar(false)
    }
    window.addEventListener('keydown', alEscapar, true)
    return () => window.removeEventListener('keydown', alEscapar, true)
    // `terminar` solo usa refs y props estables durante el arrastre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastrando])

  function mover(e: PointerEvent<HTMLElement>) {
    const a = arrastre.current
    if (!a || e.pointerId !== a.id) return
    const r = limitar(
      a.inicioMs + ((e.clientX - a.origenX) / a.ancho) * (vista.finMs - vista.inicioMs)
    )
    a.ultimo = r.valor
    setVivo(r)
    alMover?.(r.valor, r.limite)
  }

  function alTeclear(e: KeyboardEvent<HTMLElement>) {
    if (e.ctrlKey || e.metaKey || e.altKey || !alAjustar) return
    const sentido = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (!sentido) return
    e.preventDefault()
    e.stopPropagation()
    alAjustar(sentido * (e.shiftKey ? 100 : 10))
  }

  const visible = vivo?.valor ?? ms
  const izquierda = Math.max(0, Math.min(100, tiempoAPorcentaje(vista, visible)))
  return (
    <div
      className={css.tirador}
      data-tipo={tipo}
      data-borde={borde}
      data-auto={automatico || undefined}
      data-escalonado={escalonado || undefined}
      data-arrastrando={arrastrando || undefined}
      style={{ left: `${izquierda}%` }}
      role="slider"
      tabIndex={0}
      aria-label={etiqueta}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.max(min, Math.min(visible, max))}
      aria-valuetext={formatearTiempo(visible)}
      onKeyDown={alTeclear}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        const ancho = e.currentTarget.parentElement?.getBoundingClientRect().width
        if (!ancho) return
        e.preventDefault()
        e.currentTarget.focus({ preventScroll: true })
        e.currentTarget.setPointerCapture?.(e.pointerId)
        arrastre.current = { id: e.pointerId, origenX: e.clientX, inicioMs: ms, ancho, ultimo: ms }
        setVivo({ valor: ms, limite: null })
      }}
      onPointerMove={mover}
      onPointerUp={(e) => {
        if (arrastre.current?.id !== e.pointerId) return
        mover(e)
        terminar(true)
      }}
      onPointerCancel={() => terminar(false)}
    >
      {arrastrando && (
        <span role="tooltip" className={css.tiradorTiempo}>
          {formatearTiempo(visible)}
          {vivo.limite && textoLimite ? ` · ${textoLimite(vivo.limite)}` : ''}
        </span>
      )}
    </div>
  )
}
