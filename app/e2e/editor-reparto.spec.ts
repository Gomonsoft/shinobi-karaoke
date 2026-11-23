import { expect, test, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
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
const partesEnDisco = (datos: string, id = ID): (string | undefined)[] =>
  (leerCancion(datos, id).letra.lineas as LineaJson[])
    .filter((l) => l.tipo === 'linea')
    .map((l) => l.parte)

const fila = (v: Page, n: number) => v.getByRole('option', { name: new RegExp(`^Línea ${n},`) })

async function conDuo(
  nombre: string,
  prueba: (v: Page, datos: string) => Promise<void>,
  opciones: { titulo?: string; preparar?: (datos: string) => void } = {}
): Promise<void> {
  const datos = crearTemporal(nombre)
  await sembrar(datos, { reparto: true })
  opciones.preparar?.(datos)
  const app = await lanzar(datos)
  try {
    const v = await app.firstWindow()
    await abrirEditor(v, opciones.titulo ?? TITULO)
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
    await v.getByRole('button', { name: 'Canta: Ana', exact: true }).click()
    await v.getByRole('menuitemradio', { name: /Coro/ }).click()
    await expect(v.getByRole('button', { name: 'Canta: Coro', exact: true })).toBeFocused()
    await expect(fila(v, 1)).toHaveAccessibleName(/Canta: Coro/)
    await expect.poll(() => partesEnDisco(datos)[0], { timeout: 10_000 }).toBe('coro')
  })
})

test('un cantante nuevo trae su carril vacío y Alt + ↓ le lleva una línea', async () => {
  await conDuo(
    'editor-reparto-carril',
    async (v, datos) => {
      await fila(v, 1).click()
      await v.keyboard.press('c')
      await v.getByRole('menuitem', { name: /Añadir cantante/ }).click()
      // «+ Añadir cantante» le asignó la línea 1; Alt + ↑ la lleva a la parte anterior (Luis).
      await v.keyboard.press('Alt+ArrowUp')
      await expect(fila(v, 1)).toHaveAccessibleName(/Canta: Luis/)
      // Al irse la línea, el carril del Cantante 3 queda vacío y sigue ahí.
      await expect(v.getByText('Arrastra aquí las líneas de Cantante 3')).toBeVisible()
      await expect.poll(() => partesEnDisco(datos)[0], { timeout: 10_000 }).toBe('c2')
    },
    { titulo: TITULO }
  )
})

test('«Marcarlas como coro» marca las líneas entre paréntesis y la sugerencia desaparece', async () => {
  await conDuo(
    'editor-reparto-marcar-coro',
    async (v, datos) => {
      await v.getByRole('radio', { name: 'Funciones' }).click()
      await expect(v.getByText(/1 línea va entre paréntesis/)).toBeVisible()
      await v.getByRole('button', { name: 'Marcarla como coro' }).click()
      await expect(v.getByText(/va entre paréntesis/)).toHaveCount(0)
      await expect
        .poll(() => partesEnDisco(datos, idSemilla(51))[0], { timeout: 10_000 })
        .toBe('coro')
    },
    {
      titulo: 'Reparto: un cantante con coros',
      preparar: (datos) => {
        const cancion = leerCancion(datos, idSemilla(51))
        cancion.letra.lineas[0].texto = '(Ah, ah, la nieve)'
        writeFileSync(
          join(datos, 'biblioteca', idSemilla(51), 'cancion.json'),
          JSON.stringify(cancion)
        )
      }
    }
  )
})

test('el deslizador «Voz en los coros» guarda el nivel de la canción', async () => {
  await conDuo(
    'editor-reparto-voz-coros',
    async (v, datos) => {
      await v.getByRole('radio', { name: 'Funciones' }).click()
      const deslizador = v.getByRole('slider', { name: 'Voz en los coros' })
      await expect(deslizador).toHaveAttribute('aria-valuetext', '50 %')
      await deslizador.focus()
      await v.keyboard.press('ArrowRight')
      await v.keyboard.press('ArrowRight')
      await expect(deslizador).toHaveAttribute('aria-valuetext', '60 %')
      await expect
        .poll(
          () =>
            (
              leerCancion(datos, idSemilla(51)).letra.partes as
                { voz_en_coros?: number } | undefined
            )?.voz_en_coros,
          { timeout: 10_000 }
        )
        .toBeCloseTo(0.6)
    },
    { titulo: 'Reparto: un cantante con coros' }
  )
})

test('voces a la vez: alargar el fin de Ana sobre la línea de Luis se permite y se guarda', async () => {
  await conDuo('editor-reparto-solape', async (v, datos) => {
    await fila(v, 1).click()
    const fin = v.getByRole('slider', { name: /^Fin de la línea/ })
    await fin.focus()
    // La línea de Ana acaba sola a los 5 s, donde empieza la de Luis: tres pasos de 100 ms la pisan.
    for (let i = 0; i < 3; i++) await v.keyboard.press('Shift+ArrowRight')
    await expect(fila(v, 2)).toHaveAccessibleName(/suena a la vez que la línea 1/)
    await expect
      .poll(
        () =>
          (leerCancion(datos, ID).letra.lineas as { id: string; fin_ms: number | null }[]).find(
            (l) => l.id === 'd1'
          )?.fin_ms,
        { timeout: 10_000 }
      )
      .toBe(5300)
  })
})

test('C1-E23: a 256 px de lista y 300 px de panel nada se parte, no hay scroll horizontal y el texto mide ≥ 96 px', async () => {
  await conDuo('editor-reparto-anchos', async (v) => {
    for (const divisor of ['lista', 'panel']) {
      await v.locator(`[data-divisor="${divisor}"]`).focus()
      await v.keyboard.press('Home')
    }
    await fila(v, 1).click()
    const sinScroll = async (selector: string) =>
      v.locator(selector).evaluate((el) => el.scrollWidth <= el.clientWidth)
    expect(await sinScroll('#zona-lista [role="listbox"]')).toBe(true)
    expect(await sinScroll('#zona-lista')).toBe(true)
    expect(await sinScroll('#zona-panel')).toBe(true)
    for (const texto of await v.locator('#lineas-editor [class*="textoLinea"]').all()) {
      expect((await texto.boundingBox())!.width).toBeGreaterThanOrEqual(96)
    }
    for (const chip of await v.locator('#lineas-editor [data-parte]').all()) {
      expect((await chip.boundingBox())!.height).toBe(20)
    }
    await v.getByRole('radio', { name: 'Funciones' }).click()
    const seccion = v.getByRole('heading', { name: 'Cantantes y coros' }).locator('..')
    expect(await seccion.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    // Nada del panel queda bajo la barra de desplazamiento: el relleno derecho es de 12 px.
    expect(
      await v.locator('#zona-panel').evaluate((el) => parseFloat(getComputedStyle(el).paddingRight))
    ).toBeGreaterThanOrEqual(12)
  })
})
