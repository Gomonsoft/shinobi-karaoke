import { useEffect, useRef } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { Icono } from '../../componentes/Icono'
import type { OrigenReproductor } from './atajos'
import { R } from './textos'
import estilos from './reproductor.module.css'

export function PantallaFinal({
  titulo,
  artista,
  origen,
  restante,
  alRepetir,
  alSalir
}: {
  titulo: string
  artista: string
  origen: OrigenReproductor
  restante: number | null
  alRepetir(): void
  alSalir(): void
}) {
  const volver = useRef<HTMLButtonElement>(null)
  useEffect(() => volver.current?.focus({ preventScroll: true }), [])

  return (
    <div className={estilos.pantallaFinal}>
      <div className={estilos.tituloFinal}>{titulo}</div>
      <div className={estilos.artistaFinal}>{artista}</div>
      <div className={estilos.accionesFinal}>
        <button className={`foco-doble ${estilos.botonFinal}`} onClick={alRepetir} type="button">
          <Icono icono={RotateCcw} /> {R.otravez}
        </button>
        <button
          ref={volver}
          className={`foco-doble ${estilos.botonFinal}`}
          onClick={alSalir}
          type="button"
        >
          <Icono icono={X} /> {R.volver[origen]}
        </button>
      </div>
      {restante !== null && restante > 0 && (
        <span className={estilos.cuentaFinal} aria-hidden="true">
          {R.cierre(restante)}
        </span>
      )}
    </div>
  )
}
