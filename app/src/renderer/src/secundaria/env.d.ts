import type { ApiReproductor } from '@shared/ipc'

declare global {
  interface Window {
    /** API del preload de la secundaria (`preload/secundaria.ts`). Allí no existe `window.shinobi`. */
    shinobiReproductor: ApiReproductor
  }
}
