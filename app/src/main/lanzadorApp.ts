import { join } from 'node:path'
import { resolverLanzador, type Lanzador } from './trabajos'

export interface OpcionesLanzadorApp {
  empaquetada: boolean
  /** `process.resourcesPath` (contiene `worker/` empaquetado). */
  dirRecursos: string
  /** Raíz del repositorio (sin empaquetar). */
  raizRepo: string
  datos: string
  plataforma: NodeJS.Platform
  env: Record<string, string | undefined>
}

export interface LanzadorApp {
  lanzador: Lanzador
  modo: 'desarrollo' | 'produccion'
}

/**
 * Lanzador del worker (ADR 0009 §5): empaquetada, intérprete del venv + `PYTHONPATH` a
 * `resources/worker` + scripts del venv en el PATH; sin empaquetar, `uv run` (también en E2E),
 * salvo `SHINOBI_LANZADOR=produccion`, que prueba el modo producción con un runtime instalado
 * de verdad (con el código del repo). La variable se ignora empaquetada.
 */
export function lanzadorDeApp(o: OpcionesLanzadorApp): LanzadorApp {
  const produccion = o.empaquetada || o.env.SHINOBI_LANZADOR === 'produccion'
  if (!produccion) {
    return {
      modo: 'desarrollo',
      lanzador: resolverLanzador({ modo: 'desarrollo', raizRepo: o.raizRepo, env: o.env })
    }
  }
  return {
    modo: 'produccion',
    lanzador: resolverLanzador({
      modo: 'produccion',
      datos: o.datos,
      plataforma: o.plataforma,
      rutaCodigoWorker: o.empaquetada ? join(o.dirRecursos, 'worker') : join(o.raizRepo, 'worker'),
      envBase: o.env
    })
  }
}
