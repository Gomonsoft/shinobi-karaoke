import { expect, test, type Page } from '@playwright/test'
import { sembrar } from '../src/main/biblioteca/semilla'
import { abrirEditor, idSemilla, lanzar } from './fixtures/editor'
import { leerCancion } from './fixtures/separacion'
import { crearTemporal } from './temporales'

/**
 * Cantantes por línea en el editor (0.2.3, tareas 0343 y 0344): asignar con el teclado y desde la fila
 * «Canta». Usa la semilla opt-in del reparto (`sembrar(datos, { reparto: true })`). Comprobar el archivo
 * exige que main (0341) escriba `parte` y `partes`; hasta entonces solo la parte visual pasa.
 */

const TITULO = 'Reparto: dúo con coros'
const ID = idSemilla(50)

interface LineaJson {
  id: string
  tipo: string
  parte?: string
}
const partesEnDisco = (datos: string): (string | undefined)[] =>
  (leerCancion(datos, ID).letra.lineas as LineaJson[])
    .filter((l) => l.tipo === 'linea')
    .map((l) => l.parte)

const fila = (v: Page, n: number) => v.getByRole('option', { name: new RegExp(`^Línea ${n},`) })

async function conDuo(
  nombre: string,
  prueba: (v: Page, datos: string) => Promise<void>
): Promise<void> {
  const datos = crearTemporal(nombre)
  await sembrar(datos, { reparto: true })
  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    await abrirEditor(v, TITULO)
    await prueba(v, datos)
  } finally {
    await app.close().catch(() => undefined)
  }
}

test('C › 2 reparte tres líneas seleccionadas, se guarda y Ctrl + Z lo deshace', async () => {
  await conDuo('editor-reparto-teclado', async (v, datos) => {
    await expect(fila(v, 1)).toContainText('A')
    await fila(v, 1).click()
    await fila(v, 3).click({ modifiers: ['Shift'] })
    await expect(v.getByRole('heading', { name: '3 líneas seleccionadas' })).toBeVisible()

    await v.keyboard.press('c')
    await expect(v.getByRole('menu', { name: '¿Quién canta?' })).toBeVisible()
    await v.keyboard.press('2')
    await expect(fila(v, 1)).toHaveAccessibleName(/Canta: Luis/)
    await expect(fila(v, 3)).toHaveAccessibleName(/Canta: Luis/)
    await expect
      .poll(() => partesEnDisco(datos).slice(0, 3), { timeout: 10_000 })
      .toEqual(['c2', 'c2', 'c2'])

    await v.keyboard.press('Control+z')
    await expect(fila(v, 1)).toHaveAccessibleName(/Canta: Ana/)
    await expect(fila(v, 3)).toHaveAccessibleName(/Canta: Todos/)
    await expect
      .poll(() => partesEnDisco(datos).slice(0, 3), { timeout: 10_000 })
      .toEqual([undefined, 'c2', 'todos'])
  })
})

test('la fila «Canta» del panel asigna la parte de la línea', async () => {
  await conDuo('editor-reparto-fila-canta', async (v, datos) => {
    await fila(v, 1).click()
    await v.getByRole('button', { name: 'Canta: Ana' }).click()
    await v.getByRole('menuitemradio', { name: /Coro/ }).click()
    await expect(v.getByRole('button', { name: 'Canta: Coro' })).toBeFocused()
    await expect(fila(v, 1)).toHaveAccessibleName(/Canta: Coro/)
    await expect.poll(() => partesEnDisco(datos)[0], { timeout: 10_000 }).toBe('coro')
  })
})
