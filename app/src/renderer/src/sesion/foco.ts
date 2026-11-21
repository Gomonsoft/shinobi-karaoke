/**
 * Contrato de foco entre el indicador de sesión de la barra superior y la Biblioteca
 * (0183, 0185 y 0187): el panel «Cola de reproducción» marca su raíz con `data-panel-cola` y el
 * botón «Cola» de la Biblioteca lleva `data-boton-cola`.
 */
export const ATRIBUTO_PANEL_COLA = 'data-panel-cola'
export const ATRIBUTO_BOTON_COLA = 'data-boton-cola'

const ENFOCABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Intenta una vez poner el foco; devuelve `true` si lo consiguió. */
export function enfocarPanelCola(raiz: ParentNode = document): boolean {
  const panel = raiz.querySelector<HTMLElement>(`[${ATRIBUTO_PANEL_COLA}]`)
  const primero = panel?.querySelector<HTMLElement>(ENFOCABLES)
  const destino = primero ?? raiz.querySelector<HTMLElement>(`[${ATRIBUTO_BOTON_COLA}]`)
  if (!destino) return false
  destino.focus()
  return true
}

/**
 * Espera a que la Biblioteca y el panel estén montados (tras navegar y abrir el panel) y pone el
 * foco en el primer control del panel o, si no existe, en el botón «Cola». Devuelve la función
 * para cancelar el intento.
 */
export function enfocarPanelColaCuandoEste(intentos = 20): () => void {
  let cancelado = false
  let marco = 0
  const probar = (restantes: number): void => {
    if (cancelado) return
    if (enfocarPanelCola() || restantes <= 0) return
    marco = requestAnimationFrame(() => probar(restantes - 1))
  }
  marco = requestAnimationFrame(() => probar(intentos))
  return () => {
    cancelado = true
    cancelAnimationFrame(marco)
  }
}
