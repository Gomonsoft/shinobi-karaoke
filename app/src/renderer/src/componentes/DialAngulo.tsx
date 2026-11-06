import { useRef, useState, type PointerEvent } from 'react'
import { CampoTexto } from './Campos'
import estilos from './componentes.module.css'

interface Props {
  valor: number
  alCambiar(grados: number, gesto: { arrastrando: boolean }): void
  etiqueta?: string
}

const normalizar = (grados: number) => ((Math.round(grados) % 360) + 360) % 360

function angulo(e: PointerEvent<HTMLDivElement>): number {
  const { left, top, width, height } = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - (left + width / 2)
  const y = e.clientY - (top + height / 2)
  return normalizar((Math.atan2(x, -y) * 180) / Math.PI)
}

export function DialAngulo({ valor, alCambiar, etiqueta = 'Ángulo' }: Props) {
  const [texto, setTexto] = useState<string | null>(null)
  const puntero = useRef<number | null>(null)
  function aplicar(): void {
    const grados = Number(texto)
    if (texto?.trim() && Number.isFinite(grados))
      alCambiar(normalizar(grados), { arrastrando: false })
    setTexto(null)
  }

  return (
    <div className={estilos.filaColor}>
      <CampoTexto
        etiqueta={etiqueta}
        type="number"
        min={0}
        max={359}
        value={texto ?? String(valor)}
        onChange={(e) => setTexto(e.currentTarget.value)}
        onBlur={aplicar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            aplicar()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            setTexto(null)
          }
        }}
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label={`Dial de ${etiqueta.toLowerCase()}`}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={valor}
        aria-valuetext={`${valor}°`}
        className={estilos.dial}
        onKeyDown={(e) => {
          const sentido = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
          if (!sentido) return
          e.preventDefault()
          alCambiar(normalizar(valor + sentido * (e.shiftKey ? 1 : 15)), { arrastrando: false })
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || puntero.current !== null) return
          puntero.current = e.pointerId
          e.currentTarget.setPointerCapture?.(e.pointerId)
          alCambiar(angulo(e), { arrastrando: true })
        }}
        onPointerMove={(e) => {
          if (puntero.current === e.pointerId) alCambiar(angulo(e), { arrastrando: true })
        }}
        onPointerUp={(e) => {
          if (puntero.current !== e.pointerId) return
          puntero.current = null
          alCambiar(angulo(e), { arrastrando: false })
        }}
        onPointerCancel={() => {
          puntero.current = null
          alCambiar(valor, { arrastrando: false })
        }}
      >
        <span
          aria-hidden="true"
          className={estilos.aguja}
          style={{ transform: `rotate(${valor}deg)` }}
        />
      </div>
    </div>
  )
}
