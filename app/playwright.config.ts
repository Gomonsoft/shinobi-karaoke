import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/preparar-electron.ts',
  timeout: 30_000,
  retries: 0,
  reporter: 'list'
})
