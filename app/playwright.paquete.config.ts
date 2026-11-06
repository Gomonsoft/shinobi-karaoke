import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e-paquete',
  timeout: 75_000,
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results/paquete'
})
