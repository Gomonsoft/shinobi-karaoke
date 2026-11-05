/**
 * Canciones cuyo progreso de separación ya ha visto el usuario (docs/ux/00 §3): con la separación en
 * curso y sin letra, "Continuar" abre Letra en lugar de Progreso. Solo vive mientras la app está abierta.
 */
const vistos = new Set<string>()

export const marcarProgresoVisto = (id: string): void => void vistos.add(id)
export const progresoVisto = (id: string): boolean => vistos.has(id)
/** Solo para pruebas. */
export const olvidarProgresosVistos = (): void => vistos.clear()
