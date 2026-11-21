import { useId, useState } from 'react'
import { Boton } from '../componentes/Boton'
import { Dialogo } from '../componentes/Dialogo'
import { SES } from './textos'

/**
 * Confirmación de cierre en la secundaria (ADR 0017 §8, spec 02 «Cerrar el reproductor»).
 * Se monta solo mientras `cierrePendiente.origen === 'secundaria'`.
 */
export function DialogoCierreSesion({
  alConfirmar,
  alCancelar
}: {
  /** Rechaza con `CONFIRMACION_OBSOLETA` si la cola cambió desde la revisión del estado. */
  alConfirmar(cola: 'eliminar' | 'conservar'): Promise<void>
  alCancelar(): void
}) {
  const idCuerpo = useId()
  const [obsoleto, setObsoleto] = useState(false)

  function confirmar(cola: 'eliminar' | 'conservar'): void {
    alConfirmar(cola).catch((error: unknown) => {
      if ((error as { codigo?: string } | null)?.codigo === 'CONFIRMACION_OBSOLETA') {
        setObsoleto(true)
      }
    })
  }

  return (
    <Dialogo
      abierto
      titulo={SES.cierre.titulo}
      onCancelar={alCancelar}
      descripcionId={idCuerpo}
      enfoqueInicial="[data-cancelar]"
      ancho="30rem"
      acciones={
        <>
          <Boton data-cancelar="" onClick={alCancelar}>
            {SES.cierre.cancelar}
          </Boton>
          <Boton variante="destructivo" onClick={() => confirmar('eliminar')}>
            {SES.cierre.eliminar}
          </Boton>
          <Boton variante="primario" onClick={() => confirmar('conservar')}>
            {SES.cierre.conservar}
          </Boton>
        </>
      }
    >
      <p id={idCuerpo}>{SES.cierre.cuerpo}</p>
      {obsoleto && <p role="alert">{SES.cierre.obsoleto}</p>}
    </Dialogo>
  )
}
