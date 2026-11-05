import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { dialogoCancelarCuerpo, SEP, TEXTO } from './textos'

interface Props {
  abierto: boolean
  /** "Seguir …", Esc o cerrar: no cancela nada. */
  alSeguir: () => void
  alConfirmar: () => void
}

/**
 * Diálogo `prog.dialogo.cancelar.descarga` (foco en "Seguir descargando"). Se exporta para
 * reutilizarlo desde el panel de actividad (0071) y el menú de la tarjeta (0070).
 */
export function DialogoCancelarDescarga({
  abierto,
  titulo,
  alSeguir,
  alConfirmar
}: Props & { titulo: string }) {
  return (
    <Dialogo
      abierto={abierto}
      titulo="¿Cancelar la descarga?"
      onCancelar={alSeguir}
      enfoqueInicial="[data-seguir]"
      acciones={
        <>
          <Boton data-seguir onClick={alSeguir}>
            {TEXTO.seguirDescargando}
          </Boton>
          <Boton variante="destructivo" onClick={alConfirmar}>
            {TEXTO.cancelarDescarga}
          </Boton>
        </>
      }
    >
      <p>{dialogoCancelarCuerpo(titulo)}</p>
    </Dialogo>
  )
}

/** Diálogo `prog.dialogo.cancelar` (foco en "Seguir separando"); reutilizable como el anterior. */
export function DialogoCancelarSeparacion({ abierto, alSeguir, alConfirmar }: Props) {
  return (
    <Dialogo
      abierto={abierto}
      titulo={SEP.dialogoTitulo}
      onCancelar={alSeguir}
      enfoqueInicial="[data-seguir]"
      acciones={
        <>
          <Boton data-seguir onClick={alSeguir}>
            {SEP.seguir}
          </Boton>
          <Boton variante="destructivo" onClick={alConfirmar}>
            {SEP.cancelar}
          </Boton>
        </>
      }
    >
      <p>{SEP.dialogoCuerpo}</p>
    </Dialogo>
  )
}
