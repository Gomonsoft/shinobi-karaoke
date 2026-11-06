import type { ComponentPropsWithRef } from 'react'
import estilos from './componentes.module.css'

type Props = Omit<ComponentPropsWithRef<'input'>, 'type' | 'value' | 'min' | 'max' | 'onChange'> & {
  etiqueta: string
  valor: number
  min?: number
  max?: number
  textoValor?: string
  alCambiar(valor: number): void
}

export function Deslizador({
  etiqueta,
  valor,
  min = 0,
  max = 1,
  step = 'any',
  textoValor,
  alCambiar,
  onKeyDown,
  className,
  ...resto
}: Props) {
  return (
    <input
      {...resto}
      type="range"
      className={`${estilos.deslizador} ${className ?? ''}`}
      aria-label={etiqueta}
      aria-valuetext={textoValor}
      min={min}
      max={max}
      step={step}
      value={valor}
      onChange={(e) => alCambiar(e.currentTarget.valueAsNumber)}
      onKeyDown={(e) => {
        onKeyDown?.(e)
        if (e.defaultPrevented) return
        const direcciones: Record<string, number> = {
          ArrowRight: 1,
          ArrowUp: 1,
          ArrowLeft: -1,
          ArrowDown: -1
        }
        const sentido = direcciones[e.key]
        if (!sentido) return
        e.preventDefault()
        const nuevo = Math.round((valor + (sentido * (max - min)) / 20) * 1e8) / 1e8
        alCambiar(Math.min(max, Math.max(min, nuevo)))
      }}
    />
  )
}
