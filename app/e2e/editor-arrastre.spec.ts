import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { sembrar } from '../src/main/biblioteca/semilla'
import { abrirEditor, lanzar } from './fixtures/editor'
import { crearTemporal } from './temporales'

/**
 * Arrastre de regiones entre carriles con el ratón (0.2.3, I-1 · B1). Hasta ahora ninguna prueba arrastraba: las
 * de reparto asignan con teclado o con la fila «Canta». Sobre la semilla de reparto y la de voces a la vez:
 * de un cantante a otro, a Todos, a Coro, a la franja «Suelta aquí para un cantante nuevo» y con Ctrl + Z.
 * Tras cada gesto el editor sigue vivo (el árbol de React no se desmonta) y `app.log` no registra errores.
 */
const REPARTO = 'Reparto: dúo con coros'
const VOCES = 'Voces a la vez: dúo con coro'

const regiones = (v: Page, parte: string) =>
  v.locator(`#zona-linea-tiempo [data-foco-editor="region"][data-parte="${parte}"]`)
const carril = (v: Page, id: string) => v.locator(`#zona-linea-tiempo [data-carril="${id}"]`)

async function centro(l: Locator): Promise<{ x: number; y: number }> {
  const b = (await l.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

/** Arrastra el cuerpo de la región con el ratón real hasta el centro del carril `destino`. */
async function arrastrar(v: Page, region: Locator, destino: string): Promise<void> {
  const o = await centro(region)
  await v.mouse.move(o.x, o.y)
  await v.mouse.down()
  await v.mouse.move(o.x, o.y + 12, { steps: 3 })
  // Las franjas virtuales (Todos en un dúo, cantante nuevo) existen solo mientras se arrastra.
  const objetivo = carril(v, destino)
  await expect(objetivo).toBeVisible()
  const d = await centro(objetivo)
  await v.mouse.move(o.x, d.y, { steps: 8 })
  await v.mouse.up()
}

const vivo = async (v: Page) => {
  await expect(v.getByRole('heading', { level: 1, name: 'Editor' })).toBeAttached()
  expect(
    await v.evaluate(() => document.getElementById('root')!.childElementCount)
  ).toBeGreaterThan(0)
}

async function conCancion(
  titulo: string,
  semilla: { reparto?: boolean; voces?: boolean },
  prueba: (v: Page, app: ElectronApplication, datos: string) => Promise<void>
): Promise<void> {
  const datos = crearTemporal('editor-arrastre')
  await sembrar(datos, semilla)
  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    await abrirEditor(v, titulo)
    await prueba(v, app, datos)
    await vivo(v)
  } finally {
    await app.close().catch(() => undefined)
  }
}

test('dúo con coros: de un cantante a otro, a Todos, a Coro y a un cantante nuevo, con deshacer', async () => {
  await conCancion(REPARTO, { reparto: true }, async (v) => {
    const total = () => v.locator('#zona-linea-tiempo [data-foco-editor="region"]').count()
    const n = await total()
    const primera = regiones(v, 'c1').first()
    await expect(primera).toBeVisible()
    const nombre = await primera.getAttribute('aria-label')

    await arrastrar(v, primera, 'c2')
    await expect(v.locator(`[aria-label="${nombre?.replace('Ana', 'Luis')}"]`)).toBeVisible()
    await vivo(v)
    await v.keyboard.press('Control+z')
    await expect(v.locator(`[aria-label="${nombre}"]`)).toHaveAttribute('data-parte', 'c1')

    await arrastrar(v, regiones(v, 'c1').first(), 'todos')
    await expect(v.locator('#zona-linea-tiempo [data-parte="todos"]')).not.toHaveCount(1)
    await vivo(v)
    await v.keyboard.press('Control+z')
    await expect(v.locator(`[aria-label="${nombre}"]`)).toHaveAttribute('data-parte', 'c1')

    await arrastrar(v, regiones(v, 'c1').first(), 'coro')
    await vivo(v)
    await v.keyboard.press('Control+z')
    await expect(v.locator(`[aria-label="${nombre}"]`)).toHaveAttribute('data-parte', 'c1')

    // Franja «Suelta aquí para un cantante nuevo»: crea el cantante 3 con esa línea; deshacer lo quita.
    await arrastrar(v, regiones(v, 'c1').first(), 'nuevo')
    await expect(carril(v, 'c3')).toBeVisible()
    await expect(regiones(v, 'c3')).toHaveCount(1)
    await vivo(v)
    await v.keyboard.press('Control+z')
    await expect(carril(v, 'c3')).toHaveCount(0)
    await expect(regiones(v, 'c1').first()).toBeVisible()
    expect(await total()).toBe(n)
  })
})

test('voces a la vez: los mismos gestos no vacían el editor', async () => {
  await conCancion(VOCES, { voces: true }, async (v) => {
    for (const destino of ['c2', 'coro', 'nuevo']) {
      const origen = regiones(v, 'c1').first()
      await expect(origen).toBeVisible()
      await arrastrar(v, origen, destino)
      await vivo(v)
      await v.keyboard.press('Control+z')
      await vivo(v)
    }
  })
})

test('ventana grande y «Ver canción completa»: la franja «cantante nuevo» aparece al arrastrar', async () => {
  await conCancion(REPARTO, { reparto: true }, async (v, app) => {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.setContentSize(1713, 1336)
    )
    await v.getByRole('button', { name: 'Ver canción completa' }).click()
    const origen = regiones(v, 'c1').first()
    await expect(origen).toBeVisible()
    const o = await centro(origen)
    await v.mouse.move(o.x, o.y)
    await v.mouse.down()
    await v.mouse.move(o.x, o.y + 12, { steps: 3 })
    await v.mouse.move(o.x, o.y + 40, { steps: 3 })
    await expect(carril(v, 'nuevo')).toBeVisible()
    await v.keyboard.press('Escape')
    await v.mouse.up()
    await vivo(v)
  })
})
