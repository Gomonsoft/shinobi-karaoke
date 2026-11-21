import { forwardRef } from 'react'
import { SquareCheck } from 'lucide-react'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { SEL } from './textosSeleccion'
import estilos from './biblioteca.module.css'

interface Props {
  seleccionadas: number
  /** Seleccionadas que no están en la vista actual (`bib.sel.fuera`). */
  fuera: number
  /** Motivo por el que «Aplicar tema…» no está disponible (`aria-disabled` + tooltip). */
  motivoInactivo?: string
  alAplicar(): void
  alSeleccionarVisibles(): void
  alQuitar(): void
  alTerminar(): void
}

/** Barra del modo selección: fija arriba al desplazar la vista (`position: sticky`). */
export const BarraSeleccion = forwardRef<HTMLButtonElement, Props>(function BarraSeleccion(
  { seleccionadas, fuera, motivoInactivo, alAplicar, alSeleccionarVisibles, alQuitar, alTerminar },
  refAplicar
) {
  return (
    <div className={estilos.barraSeleccion} role="toolbar" aria-label="Selección">
      <p className={estilos.contadorSeleccion}>
        <Icono icono={SquareCheck} tamano={16} />
        <span>
          {SEL.contador(seleccionadas)}
          {fuera > 0 && ` · ${SEL.fuera(fuera)}`}
        </span>
      </p>
      <div className={estilos.accionesSeleccion}>
        <Boton
          ref={refAplicar}
          variante="primario"
          noDisponible={motivoInactivo}
          onClick={alAplicar}
        >
          {SEL.aplicarTema}
        </Boton>
        <Boton onClick={alSeleccionarVisibles}>{SEL.visibles}</Boton>
        <Boton onClick={alQuitar}>{SEL.quitar}</Boton>
        <Boton onClick={alTerminar}>{SEL.terminar}</Boton>
      </div>
    </div>
  )
})
