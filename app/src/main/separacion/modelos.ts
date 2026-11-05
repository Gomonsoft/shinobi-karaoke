import type { Manifiesto, ModeloId } from '../../shared'
import { borrarModelo, modeloVerificado } from '../runtime/modelos'
import type { PuertoModelos } from './servicio'

/**
 * Puerto de modelos de la separación (0066) sobre `runtime/modelos.ts` (`verificados.json`) y la
 * descarga del gestor del runtime (reanudable, SHA-256; Rápido solo con consentimiento).
 */
export function crearPuertoModelos(o: {
  manifiesto: () => Manifiesto | null
  dirModelos: string
  descargar: PuertoModelos['descargar']
}): PuertoModelos {
  const modelo = (id: ModeloId) => o.manifiesto()?.modelos.find((m) => m.id === id)
  return {
    verificado: async (id) => {
      const m = modelo(id)
      return m ? modeloVerificado(m, o.dirModelos) : false
    },
    descargar: o.descargar,
    borrar: async (id) => {
      const m = modelo(id)
      if (m) await borrarModelo(m, o.dirModelos)
    }
  }
}
