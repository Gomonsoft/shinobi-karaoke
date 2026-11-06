import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { colorHex } from '@shared/estilo'
import estilos from './componentes.module.css'

interface Props {
  etiqueta: string
  valor: string
  sugeridos: readonly string[]
  alAbrirNativo?(): void
  alCambiar(hex: string, origen: 'hex' | 'nativo' | 'sugerido'): void
  id?: string
}

export function SelectorColor({ etiqueta, valor, sugeridos, alAbrirNativo, alCambiar, id }: Props) {
  const auto = useId()
  const idCampo = id ?? auto
  const nativo = useRef<HTMLInputElement>(null)
  const [borrador, setBorrador] = useState<{ base: string; texto: string } | null>(null)
  const texto = borrador?.base === valor ? borrador.texto : valor
  const invalido = !colorHex.safeParse(texto).success
  const elegida = sugeridos.findIndex((color) => color.toUpperCase() === valor.toUpperCase())

  const elegirSugerido = (color: string) => {
    setBorrador(null)
    alCambiar(color, 'sugerido')
  }

  function navegar(e: KeyboardEvent<HTMLButtonElement>, indice: number): void {
    const teclas: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1
    }
    const paso = teclas[e.key]
    if (!paso) return
    e.preventDefault()
    const siguiente = (indice + paso + sugeridos.length) % sugeridos.length
    e.currentTarget.parentElement?.querySelectorAll('button')[siguiente]?.focus()
    elegirSugerido(sugeridos[siguiente]!)
  }

  return (
    <div className={estilos.campo}>
      <label htmlFor={idCampo} className={estilos.etiqueta}>
        {etiqueta}
      </label>
      <div className={estilos.filaColor}>
        <button
          type="button"
          className={estilos.muestraColor}
          aria-label={`Abrir selector de color de ${etiqueta}`}
          style={{ background: valor }}
          onClick={() => {
            const selector = nativo.current!
            selector.value = valor
            alAbrirNativo?.()
            selector.click()
          }}
        />
        <input
          ref={nativo}
          type="color"
          tabIndex={-1}
          aria-hidden="true"
          className={estilos.soloLector}
          defaultValue={valor}
          onInput={(e) => {
            setBorrador(null)
            alCambiar(e.currentTarget.value.toUpperCase(), 'nativo')
          }}
        />
        <input
          id={idCampo}
          className={estilos.entrada}
          value={texto}
          spellCheck={false}
          aria-invalid={invalido || undefined}
          aria-describedby={invalido ? `${idCampo}-error` : undefined}
          onChange={(e) => {
            const hex = e.currentTarget.value
            setBorrador({ base: valor, texto: hex })
            if (colorHex.safeParse(hex).success) alCambiar(hex.toUpperCase(), 'hex')
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            e.preventDefault()
            e.stopPropagation()
            setBorrador(null)
          }}
        />
      </div>
      {invalido && (
        <span id={`${idCampo}-error`} className={estilos.mensajeError}>
          Usa el formato #RRGGBB.
        </span>
      )}
      <div
        role="radiogroup"
        aria-label={`Colores sugeridos de ${etiqueta}`}
        className={estilos.sugeridosColor}
      >
        {sugeridos.map((color, i) => (
          <button
            type="button"
            role="radio"
            key={color}
            className={estilos.muestraColor}
            style={{ background: color }}
            aria-label={color}
            aria-checked={i === elegida}
            tabIndex={i === Math.max(0, elegida) ? 0 : -1}
            onClick={() => elegirSugerido(color)}
            onKeyDown={(e) => navegar(e, i)}
          />
        ))}
      </div>
    </div>
  )
}
