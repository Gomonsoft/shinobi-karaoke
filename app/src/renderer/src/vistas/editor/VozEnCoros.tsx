import { useId } from 'react'
import { Play, Square } from 'lucide-react'
import { Boton } from '../../componentes/Boton'
import { Deslizador } from '../../componentes/Deslizador'
import { Icono } from '../../componentes/Icono'
import { C } from './partes'
import estilos from './editor.module.css'

interface Props {
  /** Nivel de la canción, de 0 a 1 (`vozEnCoros(letra)`: 0,5 si no hay dato). */
  nivel: number
  cambiar(nivel: number): void
  escuchando: boolean
  escuchar(): void
  /** Sin voz separada: el nivel se puede cambiar, pero «Escuchar un coro» no está disponible. */
  sinVoz: boolean
}

const texto = (nivel: number): string => (nivel === 0 ? C.cero : `${Math.round(nivel * 100)} %`)

/**
 * «Voz en los coros» (ADR 0030 §1 y spec 06 · 0.2.3 · Feature 2): deslizador del nivel de la canción y
 * «Escuchar un coro». Va al final de «Cantantes y coros», solo en canciones con coros.
 */
export function VozEnCoros({ nivel, cambiar, escuchando, escuchar, sinVoz }: Props) {
  const id = useId()
  const pct = Math.round(nivel * 100)
  return (
    <div className={estilos.vozCoros} data-voz-coros="">
      <h4>{C.nivel}</h4>
      <div className={estilos.filaVozCoros}>
        <Deslizador
          etiqueta={C.nivel}
          valor={nivel}
          step={0.05}
          textoValor={nivel === 0 ? C.cero : `${pct} %`}
          aria-describedby={`${id}-ayuda ${id}-limite`}
          alCambiar={cambiar}
          onKeyDown={(e) => {
            // Re Pág / Av Pág mueven 25 puntos; Inicio y Fin los hace el propio control.
            if (e.key !== 'PageUp' && e.key !== 'PageDown') return
            e.preventDefault()
            cambiar(Math.min(1, Math.max(0, nivel + (e.key === 'PageUp' ? 0.25 : -0.25))))
          }}
        />
        <span className="t-tiempo" aria-hidden="true">
          {texto(nivel)}
        </span>
      </div>
      <Boton
        data-funcion="escuchar-coro"
        noDisponible={sinVoz ? C.sinVoz : undefined}
        onClick={escuchar}
      >
        <Icono icono={escuchando ? Square : Play} tamano={16} />
        {escuchando ? C.detener : C.escuchar}
      </Boton>
      <p id={`${id}-ayuda`}>{C.ayuda}</p>
      <p id={`${id}-limite`} className={estilos.textoTres}>
        {C.limite}
      </p>
    </div>
  )
}
