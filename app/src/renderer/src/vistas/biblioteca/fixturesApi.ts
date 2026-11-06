import { ESTILO_PREDETERMINADO, type Estilo } from '@shared/estilo'
import type { ApiShinobi } from '@shared/ipc'
import { ventanaFalsa } from './ventanaFalsa'

type Parcial = {
  listar: ApiShinobi['biblioteca']['listar']
  alCambiarCancion?: ApiShinobi['alCambiarCancion']
  /** Sustituye operaciones de `biblioteca` (obtener, eliminar, actualizarMetadatos…). */
  biblioteca?: Partial<ApiShinobi['biblioteca']>
  /** Estilo predeterminado vigente de `config` (por defecto, el de fábrica). */
  estiloPredeterminado?: Estilo
  alCambiarConfig?: ApiShinobi['alCambiarConfig']
}

/** `window.shinobi` mínimo para pruebas de la Biblioteca. */
export function fixtures({
  listar,
  alCambiarCancion,
  biblioteca,
  estiloPredeterminado = ESTILO_PREDETERMINADO,
  alCambiarConfig
}: Parcial): ApiShinobi & { ventana: ReturnType<typeof ventanaFalsa> } {
  return {
    ventana: ventanaFalsa(),
    biblioteca: {
      listar,
      obtener: () => Promise.resolve(null),
      comprobarPistas: async (id: string) => (await listar()).find((c) => c.id === id) ?? null,
      mostrarEnCarpeta: () => Promise.resolve(),
      ...biblioteca
    },
    config: { obtener: () => Promise.resolve({ estilo_predeterminado: estiloPredeterminado }) },
    alCambiarConfig: alCambiarConfig ?? (() => () => undefined),
    alCambiarCancion: alCambiarCancion ?? (() => () => undefined)
  } as unknown as ApiShinobi & { ventana: ReturnType<typeof ventanaFalsa> }
}
