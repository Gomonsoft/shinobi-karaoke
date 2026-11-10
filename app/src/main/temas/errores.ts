import type { CodigoError } from '../../shared'

/** Error de una operación de temas, con código estable (`shared/errores.ts`). */
export class ErrorTemas extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
    /** Solo `CONFIRMACION_OBSOLETA`: el impacto nuevo, con su ficha (`ImpactoIpc`). */
    readonly detalles?: unknown
  ) {
    super(mensaje)
    this.name = 'ErrorTemas'
  }
}
