import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { idPorEntrada } from './scripts/preloads-autocontenidos'

const alias = { '@shared': resolve('src/shared') }

/**
 * Con `sandbox` un preload no puede cargar otros archivos, pero con varias entradas el bundler
 * extrae los módulos comunes (p. ej. `shared/canales`) a un chunk que se cargaría con `require`.
 * Este plugin da a cada entrada su propia copia de los módulos propios (`?e=<entrada>`), así que
 * no hay chunks compartidos y cada preload sale en un único archivo.
 */
function preloadsAutocontenidos(): {
  name: string
  enforce: 'pre'
  resolveId: (...args: never[]) => unknown
} {
  return {
    name: 'preloads-autocontenidos',
    enforce: 'pre',
    async resolveId(
      this: { resolve: (...a: unknown[]) => Promise<{ id: string; external?: unknown } | null> },
      source: string,
      importer: string | undefined,
      opciones: { isEntry: boolean }
    ) {
      if (!importer || opciones.isEntry) return null
      const resuelto = await this.resolve(source, importer, { ...opciones, skipSelf: true })
      if (!resuelto || resuelto.external || resuelto.id.includes('node_modules')) return null
      const id = idPorEntrada(resuelto.id, importer, resolve('src'))
      return id ? { ...resuelto, id } : null
    }
  } as never
}

export default defineConfig({
  main: {
    resolve: { alias },
    // Módulo de YouTube desactivable al compilar (ADR 0003, mitigación 5): SHINOBI_SIN_YOUTUBE=1.
    define: { __SHINOBI_YOUTUBE__: JSON.stringify(process.env.SHINOBI_SIN_YOUTUBE !== '1') }
  },
  // Un preload por rol de ventana (ADR 0017 §2): `index` (principal) y `secundaria`.
  preload: {
    resolve: { alias },
    plugins: [preloadsAutocontenidos()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          secundaria: resolve('src/preload/secundaria.ts')
        }
      }
    }
  },
  // Un documento por rol de ventana: `index.html` y `reproductor.html`.
  renderer: {
    resolve: { alias },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          reproductor: resolve('src/renderer/reproductor.html')
        }
      }
    }
  }
})
