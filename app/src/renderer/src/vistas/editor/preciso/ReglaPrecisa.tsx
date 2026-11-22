import { formatearTiempo } from '@shared/letras/tiempos'
import { T } from './textosPreciso'
import type { VistaPrecisa } from './vistaPrecisa'
import css from './preciso.module.css'

const PASO_TECLA_MS = 100

interface Props {
  vista: VistaPrecisa
  posicionMs: number
  /** Un clic (o las flechas) busca a ese instante. */
  alBuscar(ms: number): void
}

/** Regla del intervalo de la vista, como la de la línea de tiempo (marcas + control deslizante transparente). */
export function ReglaPrecisa({ vista, posicionMs, alBuscar }: Props) {
  const extension = vista.finMs - vista.inicioMs
  const valor = Math.max(vista.inicioMs, Math.min(posicionMs, vista.finMs))
  return (
    <div className={css.regla}>
      <div className={css.marcas} aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <span key={f}>{formatearTiempo(vista.inicioMs + extension * f)}</span>
        ))}
      </div>
      <input
        type="range"
        aria-label={T.regla}
        aria-valuetext={formatearTiempo(valor)}
        min={vista.inicioMs}
        max={vista.finMs}
        step="any"
        value={valor}
        onChange={(e) => alBuscar(e.currentTarget.valueAsNumber)}
        onKeyDown={(e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return
          const sentido = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
          if (!sentido) return
          e.preventDefault()
          alBuscar(Math.max(vista.inicioMs, Math.min(vista.finMs, valor + sentido * PASO_TECLA_MS)))
        }}
      />
    </div>
  )
}
