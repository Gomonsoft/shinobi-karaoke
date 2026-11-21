import type { ApiExportacion } from '@shared/ipc'

declare global {
  interface Window {
    /** API del preload de la ventana offscreen (`preload/exportacion.ts`). Allí no existe `window.shinobi`. */
    shinobiExportacion: ApiExportacion
  }
}
