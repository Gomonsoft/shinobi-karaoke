import { ESPERA_LEGADA, type Espera } from '@shared/espera'
import type { Estilo } from '@shared/estilo'
import type { AparienciaEditor } from './estado'

/**
 * Espera de la canción tal como la ve el público: el reemplazo de la canción (con `tema` o
 * `heredar`), la del estilo visible (propio, tema o heredado) o la de 0.1.0.
 */
export function esperaEfectiva(apariencia: AparienciaEditor, estiloVisible: Estilo): Espera {
  const reemplazo =
    apariencia.seleccion.modo === 'propio' ? undefined : apariencia.reemplazos?.espera
  return reemplazo ?? estiloVisible.espera ?? ESPERA_LEGADA
}
