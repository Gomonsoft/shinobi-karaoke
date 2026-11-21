import { Boton } from '../componentes/Boton'
import { Dialogo } from '../componentes/Dialogo'
import { EDI_BLOQUEO } from './textos'

interface Props {
  abierto: boolean
  /** «Entendido» y Esc: el foco vuelve al elemento que abrió el diálogo. */
  alCerrar: () => void
  /** «Cerrar el reproductor…»: cierra este diálogo y sigue la vía normal de cierre. */
  alCerrarReproductor: () => void
}

/** `edi.bloqueo` (spec 06): el mismo aviso para todos los puntos de entrada bloqueados. */
export function DialogoBloqueo({ abierto, alCerrar, alCerrarReproductor }: Props) {
  return (
    <Dialogo
      abierto={abierto}
      titulo={EDI_BLOQUEO.titulo}
      onCancelar={alCerrar}
      enfoqueInicial="[data-entendido]"
      ancho="30rem"
      acciones={
        <>
          <Boton variante="secundario" onClick={alCerrarReproductor}>
            {EDI_BLOQUEO.cerrar}
          </Boton>
          <Boton variante="primario" data-entendido onClick={alCerrar}>
            {EDI_BLOQUEO.entendido}
          </Boton>
        </>
      }
    >
      <p>{EDI_BLOQUEO.cuerpo}</p>
    </Dialogo>
  )
}
