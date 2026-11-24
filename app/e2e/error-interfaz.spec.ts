import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sembrar } from '../src/main/biblioteca/semilla'
import { abrirEditor, idSemilla, lanzar } from './fixtures/editor'
import { leerCancion } from './fixtures/separacion'
import { crearTemporal } from './temporales'

/**
 * Límite de errores de la interfaz (0.2.3, I-1): un error de dibujo en el editor muestra la pantalla de error en
 * el área de contenido (la barra sigue viva), envía lo pendiente de guardar y deja la línea en `app.log` con la
 * vista, el id de la canción, la pila y la pila de componentes. El error se provoca con el gancho de prueba
 * `shinobi:e2e-romper` (solo con `SHINOBI_E2E=1` y sin empaquetar).
 */
const TITULO = 'Reparto: dúo con coros'
const ID = idSemilla(50)

const romper = (v: Page) => v.evaluate(() => window.dispatchEvent(new Event('shinobi:e2e-romper')))
const fila = (v: Page, n: number) => v.getByRole('option', { name: new RegExp(`^Línea ${n},`) })

test('un fallo de dibujo en el editor: pantalla de error, guardado, app.log y salida sin reiniciar', async () => {
  const datos = crearTemporal('error-interfaz')
  await sembrar(datos, { reparto: true })
  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    await abrirEditor(v, TITULO)

    // Un cambio recién hecho (dentro del debounce de guardado) y, enseguida, el fallo.
    await fila(v, 1).click()
    await v.keyboard.press('c')
    await v.keyboard.press('2')
    await expect(fila(v, 1)).toHaveAccessibleName(/Canta: Luis/)
    await romper(v)

    await expect(
      v.getByRole('heading', { name: 'Esta pantalla ha tenido un problema' })
    ).toBeVisible()
    // La barra superior sigue viva y el cambio llegó al disco.
    await expect(v.getByRole('button', { name: 'Shinobi Karaoke' })).toBeVisible()
    await expect(v.getByText('Tus cambios del editor están guardados.')).toBeVisible()
    await expect(
      v.getByText('Se ha perdido el historial para deshacer de esta visita.')
    ).toBeVisible()
    const primera = () =>
      (leerCancion(datos, ID).letra.lineas as { tipo: string; parte?: string }[]).filter(
        (l) => l.tipo === 'linea'
      )[0]?.parte
    await expect.poll(primera, { timeout: 5000 }).toBe('c2')

    // El error y su contexto están en app.log.
    await expect
      .poll(() => readFileSync(join(datos, 'registros', 'app.log'), 'utf8'), { timeout: 10_000 })
      .toMatch(
        new RegExp(
          `\\[ERROR\\] \\[renderer\\] react: Error: Error de dibujo forzado por la prueba \\| vista=cancion/editor cancion=${ID} \\| pila: .*\\| componentes: `
        )
      )

    // «Volver a cargar» vuelve a montar el editor sin recargar la ventana.
    await v.evaluate(() => ((window as unknown as { marca: number }).marca = 7))
    await v.getByRole('button', { name: 'Volver a cargar esta pantalla' }).click()
    await expect(v.getByRole('heading', { level: 1, name: 'Editor' })).toBeAttached()
    await expect(fila(v, 1)).toHaveAccessibleName(/Canta: Luis/, { timeout: 20_000 })
    expect(await v.evaluate(() => (window as unknown as { marca: number }).marca)).toBe(7)

    // Segundo fallo y salida por «Ir a la Biblioteca».
    await romper(v)
    await v.getByRole('button', { name: 'Ir a la Biblioteca' }).click()
    await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
  } finally {
    await app.close().catch(() => undefined)
  }
})
