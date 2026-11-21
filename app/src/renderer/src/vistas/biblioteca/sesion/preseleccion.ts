import type { ListaPantallasIpc, PantallaIpc } from '@shared/sesion'

/** Última pantalla usada (`config.reproductor.secundaria`, ADR 0017 §2). */
export interface PantallaGuardada {
  pantalla: { id: number; etiqueta: string; ancho: number; alto: number }
  pantalla_completa: boolean
}

/** La guardada, si sigue conectada: primero por `id`, después por etiqueta y tamaño. */
export function pantallaGuardadaConectada(
  pantallas: readonly PantallaIpc[],
  guardada: PantallaGuardada | null
): PantallaIpc | null {
  if (!guardada) return null
  const { id, etiqueta, ancho, alto } = guardada.pantalla
  return (
    pantallas.find((p) => p.id === id) ??
    pantallas.find((p) => p.etiqueta === etiqueta && p.ancho === ancho && p.alto === alto) ??
    null
  )
}

/**
 * Pantalla preseleccionada (ADR 0017 §2, spec 02): la última usada si está conectada; si no, la
 * primera que no es la de la ventana principal; con una sola, esa. `null` sin pantallas.
 */
export function preseleccionarPantalla(
  lista: ListaPantallasIpc,
  guardada: PantallaGuardada | null
): PantallaIpc | null {
  return (
    pantallaGuardadaConectada(lista.pantallas, guardada) ??
    lista.pantallas.find((p) => !p.conVentanaPrincipal) ??
    lista.pantallas[0] ??
    null
  )
}

/**
 * Valor inicial de «Pantalla completa»: lo guardado si la elegida es la guardada; si no, marcada
 * salvo en la pantalla de la ventana principal y con una sola pantalla.
 */
export function completaPorDefecto(
  lista: ListaPantallasIpc,
  elegida: PantallaIpc | null,
  guardada: PantallaGuardada | null
): boolean {
  if (!elegida) return false
  if (guardada && pantallaGuardadaConectada(lista.pantallas, guardada)?.id === elegida.id) {
    return guardada.pantalla_completa
  }
  return lista.pantallas.length > 1 && !elegida.conVentanaPrincipal
}
