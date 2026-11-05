import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { AcercaDe } from './AcercaDe'
import { TEXTOS_ACERCA as T } from './textos'

/** "Licencias" de B1 (`ux/01`): el bloque Acerca de en un diálogo, porque aún no hay barra superior. */
export function DialogoAcercaDe({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  return (
    <Dialogo
      abierto={abierto}
      titulo="Licencias"
      onCancelar={alCerrar}
      acciones={
        <Boton variante="primario" onClick={alCerrar}>
          {T.cerrar}
        </Boton>
      }
    >
      <AcercaDe />
    </Dialogo>
  )
}
