import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const alias = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    resolve: { alias },
    // Módulo de YouTube desactivable al compilar (ADR 0003, mitigación 5): SHINOBI_SIN_YOUTUBE=1.
    define: { __SHINOBI_YOUTUBE__: JSON.stringify(process.env.SHINOBI_SIN_YOUTUBE !== '1') }
  },
  preload: { resolve: { alias } },
  renderer: {
    resolve: { alias },
    plugins: [react()]
  }
})
