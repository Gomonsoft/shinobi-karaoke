import { _electron as electron, expect, test } from '@playwright/test'
import { crearTemporal } from './temporales'

test('la app arranca y la ventana muestra "Shinobi Karaoke"', async () => {
  const datos = crearTemporal('humo')
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, SHINOBI_DATOS: datos }
  })
  try {
    const ventana = await app.firstWindow()
    await expect(ventana).toHaveTitle('Shinobi Karaoke')
    // Sin instalación completa arranca el Primer arranque: la bienvenida (B1, 0037).
    await expect(
      ventana.getByRole('heading', { name: 'Hola. Vamos a preparar tu estudio de karaoke.' })
    ).toBeVisible()
  } finally {
    await app.close()
  }
})
