import type { ApiShinobi } from '@shared/ipc'

declare global {
  interface Window {
    /** API expuesta por el preload (0011). Es lo único que el renderer ve del proceso main. */
    shinobi: ApiShinobi
  }
}
