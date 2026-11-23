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
