import { _electron as electron, expect, test } from '@playwright/test'
import { crearTemporal } from './temporales'

test('la ventana no baja de 1024 x 576 de contenido y el viewport coincide (DPR 1)', async () => {
  const datos = crearTemporal('ventana')
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, SHINOBI_DATOS: datos }
  })
  try {
    const ventana = await app.firstWindow()
    await ventana.waitForLoadState('domcontentloaded')
    const r = await app.evaluate(async ({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0]!
      w.setContentSize(900, 500)
      const pequeno = w.getContentSize()
      w.setContentSize(1024, 576)
      const minimo = w.getContentSize()
      return { pequeno, minimo }
    })
    expect(r.pequeno[0]).toBeGreaterThanOrEqual(1024)
    expect(r.pequeno[1]).toBeGreaterThanOrEqual(576)
    expect(r.minimo).toEqual([1024, 576])
    await expect
      .poll(() => ventana.evaluate(() => [window.innerWidth, window.innerHeight]))
      .toEqual([1024, 576])
    expect(await ventana.evaluate(() => window.devicePixelRatio)).toBe(1)
  } finally {
    await app.close()
  }
})
