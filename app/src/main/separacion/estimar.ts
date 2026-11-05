import type { EstimacionCancion } from '../../shared'

/**
 * `separacion.estimar(cancionId)` (0067): lee `metadatos.duracion_ms` de la canción y delega en la
 * misma estimación del runtime (perfil, modo vigente y factores medidos). `null` si la canción no
 * existe o no hay datos para el perfil y el modo. Lo cablea el servicio de separación (0065).
 */
export function estimarCancion(deps: {
  obtener(id: string): { metadatos: { duracion_ms: number } } | null
  estimarSeparacion(duracionMs: number): EstimacionCancion
}): (cancionId: string) => EstimacionCancion {
  return (cancionId) => {
    const cancion = deps.obtener(cancionId)
    return cancion === null ? null : deps.estimarSeparacion(cancion.metadatos.duracion_ms)
  }
}
