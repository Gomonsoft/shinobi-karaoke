import type { AgruparBiblioteca } from '@shared/config'
import type { ApiShinobi } from '@shared/ipc'
import { temasFalsos, type TemasFalsos } from './temasFalsos'
import { ventanaFalsa } from './ventanaFalsa'

type Parcial = {
  listar: ApiShinobi['biblioteca']['listar']
  alCambiarCancion?: ApiShinobi['alCambiarCancion']
  /** Sustituye operaciones de `biblioteca` (obtener, eliminar, actualizarMetadatos…). */
  biblioteca?: Partial<ApiShinobi['biblioteca']>
  /** `config.biblioteca.agrupar` guardado (por defecto, «Sin agrupar»). */
  agrupar?: AgruparBiblioteca
  /** Doble de `config.actualizar`; recibe el parcial escrito. */
  actualizarConfig?: (parcial: unknown) => Promise<unknown>
  alCambiarConfig?: ApiShinobi['alCambiarConfig']
  /** Doble de `temas` y `alCambiarTemas`; por defecto un catálogo en memoria con un tema. */
  temas?: TemasFalsos
}

/** `window.shinobi` mínimo para pruebas de la Biblioteca. */
export function fixtures({
  listar,
  alCambiarCancion,
  biblioteca,
  agrupar = 'ninguno',
  actualizarConfig = () => Promise.resolve({}),
  alCambiarConfig,
  temas = temasFalsos()
}: Parcial): ApiShinobi & { ventana: ReturnType<typeof ventanaFalsa> } {
  return {
    ventana: ventanaFalsa(),
    ...temas.api,
    biblioteca: {
      listar,
      obtener: () => Promise.resolve(null),
      comprobarPistas: async (id: string) => (await listar()).find((c) => c.id === id) ?? null,
      mostrarEnCarpeta: () => Promise.resolve(),
      ...biblioteca
    },
    config: {
      obtener: () => Promise.resolve({ biblioteca: { agrupar } }),
      actualizar: actualizarConfig
    },
    alCambiarConfig: alCambiarConfig ?? (() => () => undefined),
    alCambiarCancion: alCambiarCancion ?? (() => () => undefined)
  } as unknown as ApiShinobi & { ventana: ReturnType<typeof ventanaFalsa> }
}
