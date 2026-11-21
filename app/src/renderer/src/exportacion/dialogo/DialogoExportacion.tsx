import { DialogoFormulario } from './DialogoFormulario'

/** Qué abre el diálogo: la canción a exportar y, si se reabre una exportación, su `trabajoId`. */
export interface PeticionExportacion {
  cancionId: string
  /** Reabre el diálogo en el estado de esa exportación (B, B2, C o D). */
  trabajoId?: string
  /** Hay un borrador de tema sin guardar en el editor (`edi.exp.temaBorrador`). */
  temaBorrador?: boolean
}

interface Props {
  peticion: PeticionExportacion
  alCerrar(): void
}

/** Contenedor de estados del diálogo «Exportar video» (docs/ux/10). */
export function DialogoExportacion({ peticion, alCerrar }: Props) {
  return (
    <DialogoFormulario
      cancionId={peticion.cancionId}
      temaBorrador={peticion.temaBorrador}
      alIniciada={alCerrar}
      alCerrar={alCerrar}
    />
  )
}
