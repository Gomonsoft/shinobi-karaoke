import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { configPredeterminada } from '../src/shared/config'
import { crearTemporal } from './temporales'

test('navegación bloqueada, enlaces por la lista blanca e instancia única', async () => {
  const datos = crearTemporal('seguridad')
  const config = configPredeterminada()
  config.instalacion.estado = 'completa'
  mkdirSync(datos, { recursive: true })
  writeFileSync(join(datos, 'config.json'), JSON.stringify(config))
  const env = { ...process.env, SHINOBI_DATOS: datos }
  const app = await electron.launch({ args: ['.'], cwd: process.cwd(), env })
  try {
    const ventana = await app.firstWindow()
    await expect(ventana.getByRole('banner')).toBeVisible()
    await app.evaluate(({ shell }) => {
      const g = globalThis as unknown as { __abiertos: string[] }
      g.__abiertos = []
      ;(shell as { openExternal: unknown }).openExternal = async (u: string) => {
        g.__abiertos.push(u)
      }
    })
    const urlAntes = ventana.url()
    await ventana.evaluate(
      "window.open('https://example.com'); location.href = 'https://example.com/pagina'"
    )
    await ventana.evaluate("window.open('https://lrclib.net/')")
    await expect
      .poll(() =>
        app.evaluate(() => (globalThis as unknown as { __abiertos: string[] }).__abiertos)
      )
      .toEqual(['https://lrclib.net/'])
    expect(ventana.url()).toBe(urlAntes)
    expect(app.windows()).toHaveLength(1)

    // Segunda instancia con los mismos datos: sale enseguida.
    // Sale antes de que Playwright pueda conectarse, así que `launch` falla.
    await expect(electron.launch({ args: ['.'], cwd: process.cwd(), env })).rejects.toThrow()
  } finally {
    await app.close()
  }
})
