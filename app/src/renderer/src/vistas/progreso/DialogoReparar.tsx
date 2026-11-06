import { useId } from 'react'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { REPARACION_MOTOR } from './textos'

interface Props {
  trabajos: readonly string[]
  cancelando: boolean
  alSeguir: () => void
  alConfirmar: () => void
}

export function DialogoReparar({ trabajos, cancelando, alSeguir, alConfirmar }: Props) {
  const descripcionId = useId()
  return (
    <Dialogo
      abierto={trabajos.length > 0}
      titulo={REPARACION_MOTOR.tituloDialogo}
      onCancelar={alSeguir}
      descripcionId={descripcionId}
      enfoqueInicial="[data-seguir]"
      acciones={
        <>
          <Boton data-seguir disabled={cancelando} onClick={alSeguir}>
            {REPARACION_MOTOR.seguir}
          </Boton>
          <Boton variante="destructivo" disabled={cancelando} onClick={alConfirmar}>
            {REPARACION_MOTOR.confirmar}
          </Boton>
        </>
      }
    >
      <p id={descripcionId}>{REPARACION_MOTOR.cuerpoDialogo(trabajos)}</p>
    </Dialogo>
  )
}
