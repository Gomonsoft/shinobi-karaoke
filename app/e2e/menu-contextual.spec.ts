import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type Page } from '@playwright/test'
import { sembrar } from '../src/main/biblioteca/semilla'

/** El menú ⋯ vive en un portal: ningún ítem puede quedar recortado por la tarjeta (B1). */
async function comprobarMenu(v: Page, tarjeta: ReturnType<Page['getByRole']>) {
  await tarjeta.scrollIntoViewIfNeeded()
  const disparador = tarjeta.getByRole('button', { name: /^Más acciones de/ })
  await disparador.click()
  const menu = v.getByRole('menu')
  await expect(menu).toBeVisible()
  const items = menu.getByRole('menuitem')
  const total = await items.count()
  expect(total).toBeGreaterThanOrEqual(2)
  const [ancho, alto] = await v.evaluate<[number, number]>(
    '[window.innerWidth, window.innerHeight]'
  )
  for (let i = 0; i < total; i++) {
    const item = items.nth(i)
    await expect(item).toBeVisible()
    const caja = (await item.boundingBox())!
    expect(caja.x).toBeGreaterThanOrEqual(0)
    expect(caja.y).toBeGreaterThanOrEqual(0)
    expect(caja.x + caja.width).toBeLessThanOrEqual(ancho)
    expect(caja.y + caja.height).toBeLessThanOrEqual(alto)
    // Recibe el clic (no está tapado ni recortado); sin pulsar, para no abrir la carpeta real.
    await item.click({ trial: true })
  }
  await v.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(disparador).toBeFocused()
}

test('el menú ⋯ se ve entero en la primera y en la última fila a 1024×640', async () => {
  const datos = mkdtempSync(join(tmpdir(), 'shinobi-e2e-menu-'))
  await sembrar(datos)
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, SHINOBI_DATOS: datos }
  })
  try {
    const v = await app.firstWindow()
    const ventana = await app.browserWindow(v)
    await ventana.evaluate((w) => w.setContentSize(1024, 640))
    await expect
      .poll(() => v.evaluate('[window.innerWidth, window.innerHeight]'))
      .toEqual([1024, 640])
    const tarjetas = v.getByRole('article')
    await expect(tarjetas).toHaveCount(18)
    await comprobarMenu(v, tarjetas.first())
    await comprobarMenu(v, tarjetas.last())
    // Una tarjeta con más ítems (lista: incluye «Volver a borrador» y «Eliminar…») también cabe.
    await comprobarMenu(v, v.getByRole('article', { name: /^Canción lista,/ }))
  } finally {
    await app.close()
  }
})
