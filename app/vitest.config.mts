import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const comun = {
  plugins: [react()],
  resolve: { alias: { '@shared': resolve('src/shared') } }
}

export default defineConfig({
  test: {
    projects: [
      {
        ...comun,
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          include: ['src/shared/**/*.test.ts', 'src/main/**/*.test.ts']
        }
      },
      {
        ...comun,
        test: {
          name: 'renderer',
          globals: true,
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['./tests/setup.ts']
        }
      }
    ]
  }
})
