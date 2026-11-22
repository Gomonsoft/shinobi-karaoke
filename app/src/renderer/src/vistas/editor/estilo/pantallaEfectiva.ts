import type { Estilo } from '@shared/estilo'
import { normalizarEstilo } from '@shared/estilo'
import { PANTALLA_PREDETERMINADA, pasadasMaximas, type Pantalla } from '@shared/pantalla'
import type { VistaTema } from '../aparienciaVista'
import type { AparienciaEditor, ReemplazosEditor } from '../estado'

/** Reemplazos guardados en la canción (espera en `reemplazos`, pantalla en su clave hermana). */
export function reemplazosDeDisco(
  apariencia:
    | {
        reemplazos?: { espera?: ReemplazosEditor['espera'] } | null
        reemplazo_pantalla?: Pantalla | null
      }
    | null
    | undefined
): ReemplazosEditor | null {
  const espera = apariencia?.reemplazos?.espera
  const pantalla = apariencia?.reemplazo_pantalla ?? undefined
  return espera || pantalla ? { ...(espera && { espera }), ...(pantalla && { pantalla }) } : null
}

/**
 * La letra en pantalla que ve el público: el reemplazo de la canción (con `tema` o `heredar`) o la
 * del estilo visible (propio, tema o heredado); en D3, la del borrador. Ausente = la predeterminada.
 */
export function pantallaVisible(
  vista: Pick<VistaTema, 'estado'>,
  apariencia: AparienciaEditor,
  estilo: Estilo
): Pantalla {
  const del = normalizarEstilo(estilo).pantalla
  if (vista.estado === 'd3') return del
  const reemplazo =
    apariencia.seleccion.modo === 'propio' ? undefined : apariencia.reemplazos?.pantalla
  return reemplazo ?? del
}

/** Líneas ya cantadas que se ven de verdad con esas líneas (la elección se conserva en `pasadas`). */
export const pasadasQueSeVen = (p: Pantalla): number =>
  Math.min(p.pasadas, pasadasMaximas(p.lineas))

export { PANTALLA_PREDETERMINADA }
