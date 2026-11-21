import { useExportaciones, type PeticionExportacion } from '../contexto'
import { DialogoFormulario } from './DialogoFormulario'
import { DialogoSeguimiento } from './DialogoSeguimiento'

interface Props {
  peticion: PeticionExportacion
  alCerrar(): void
}

/**
 * Contenedor de estados del diálogo «Exportar video» (docs/ux/10): el formulario (A, E, F) y,
 * una vez aceptada la exportación o al reabrirla, su seguimiento (B–D).
 */
export function DialogoExportacion({ peticion, alCerrar }: Props) {
  const { iniciada } = useExportaciones()
  if (peticion.trabajoId) {
    return <DialogoSeguimiento trabajoId={peticion.trabajoId} alCerrar={alCerrar} />
  }
  return (
    <DialogoFormulario
      cancionId={peticion.cancionId}
      temaBorrador={peticion.temaBorrador}
      opcionesIniciales={peticion.opciones}
      alIniciada={(trabajoId, existia) => iniciada(trabajoId, peticion.cancionId, existia)}
      alCerrar={alCerrar}
    />
  )
}
