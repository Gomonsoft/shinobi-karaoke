import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { configPredeterminada } from '../src/shared/config'
import { crearTemporal } from './temporales'

test('Ctrl/Cmd+, abre Ajustes, Esc vuelve a la Biblioteca y el zoom del menú funciona', async () => {
  const datos = crearTemporal('nav')
  const config = configPredeterminada()
  config.instalacion.estado = 'completa'
  mkdirSync(datos, { recursive: true })
  writeFileSync(join(datos, 'config.json'), JSON.stringify(config))
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, SHINOBI_DATOS: datos }
  })
  try {
    const ventana = await app.firstWindow()
    await expect(ventana.getByRole('banner')).toBeVisible()
    const altoBarra = await ventana
      .getByRole('banner')
      .evaluate((n) => n.getBoundingClientRect().height)
    expect(altoBarra).toBe(56)

    const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
    await ventana.keyboard.press(`${mod}+,`)
    await expect(ventana.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible()
    await ventana.keyboard.press('Escape')
    await expect(
      ventana.getByRole('heading', { level: 1, name: /Biblioteca|Tu biblioteca está vacía/ })
    ).toBeVisible()

    const menu = await app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu()
        ?.items.flatMap((i) => i.submenu?.items ?? [])
        .map((i) => i.label)
    )
    expect(menu).toEqual(expect.arrayContaining(['Añadir canción', 'Ajustes', 'Acercar', 'Alejar']))
  } finally {
    await app.close()
  }
})
