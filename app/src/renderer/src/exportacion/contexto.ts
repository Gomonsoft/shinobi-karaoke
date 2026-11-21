import { createContext, useContext } from 'react'
import type { ExportacionVista } from './estado'
import type { OpcionesExportacion } from './dialogo/modelo'

/** Qué abre el diálogo: la canción a exportar y, si se reabre una exportación, su `trabajoId`. */
export interface PeticionExportacion {
  cancionId: string
  /** Reabre el diálogo en el estado de esa exportación (B, B2, C o D). */
  trabajoId?: string
  /** Hay un borrador de tema sin guardar en el editor (`edi.exp.temaBorrador`). */
  temaBorrador?: boolean
  /** «Cambiar opciones» (D): el formulario parte de estas opciones en lugar de las recordadas. */
  opciones?: OpcionesExportacion
  /** «Cambiar opciones» (D): el destino parte del que usó esa exportación (0133). */
  desdeTrabajoId?: string
}

export interface ContextoExportacion {
  /** En curso, en cola y las terminadas recientes de esta sesión de la app. */
  exportaciones: readonly ExportacionVista[]
  /** Exportación en curso o en cola de la canción. */
  activaDe(cancionId: string): ExportacionVista | undefined
  /** Abre el diálogo; con una exportación activa de la canción, en su estado actual. */
  abrir(peticion: PeticionExportacion): void
  /** Cierra el diálogo, esté en el estado que esté. */
  cerrar(): void
  /** El diálogo aceptó `iniciar`: pasa a seguir esa exportación. */
  iniciada(trabajoId: string, cancionId: string): void
  /** Cancela con la confirmación de `exp.dialogo.cancelar`; en cola, sin confirmar. */
  pedirCancelar(trabajoId: string): void
}

const vacio: ContextoExportacion = {
  exportaciones: [],
  activaDe: () => undefined,
  abrir: () => undefined,
  cerrar: () => undefined,
  iniciada: () => undefined,
  pedirCancelar: () => undefined
}

/** Fuera del proveedor (pruebas, muestrario) no hay exportaciones y abrir no hace nada. */
export const ExportacionContexto = createContext<ContextoExportacion>(vacio)

export function useExportaciones(): ContextoExportacion {
  return useContext(ExportacionContexto)
}
