import { expect, test, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { leerCancion } from './fixtures/separacion'
import { abrirEditor, conEditor, idSemilla } from './fixtures/editor'

/**
 * Plan 6 (0.2.3), con la app compilada y audio de la semilla (silenciado):
 * I-2, la vista previa en pausa sigue al cabezal y no a la línea seleccionada;
 * I-3, el doble clic en una palabra del editor preciso reproduce desde ahí sin saltar atrás.
 */

const T19 = 'Editor: lista incompleta'
const ID = idSemilla(19)

function preparar(datos: string): void {
  const cancion = leerCancion(datos, ID)
  const base = cancion.letra.lineas.filter((l: { tipo: string }) => l.tipo === 'linea')
  cancion.letra.offset_ms = 0
  cancion.letra.lineas = [
    { ...base[0], texto: 'Sol y mar', inicio_ms: 2000, fin_ms: 5000, palabras: null },
    { ...base[1], texto: 'Otro verso', inicio_ms: 7000, fin_ms: 9000, palabras: null }
  ]
  writeFileSync(join(datos, 'biblioteca', ID, 'cancion.json'), JSON.stringify(cancion))
}

const opcion = (v: Page, n: number) => v.getByRole('option', { name: new RegExp(`^Línea ${n},`) })
const barra = (v: Page) => v.getByRole('slider', { name: 'Tiempo de reproducción' })
const tiempo = async (v: Page) => Number(await barra(v).inputValue())

test.describe('plan 6 · pausa y doble clic en una palabra', () => {
  test.describe.configure({ timeout: 90_000 })

  test('pausar lejos de la línea seleccionada enseña el cabezal, no la línea (I2-1, I2-3)', async () => {
    await conEditor(
      'previa-pausa',
      async (v) => {
        await abrirEditor(v, T19)
        await opcion(v, 1).click()
        await barra(v).fill('6500')
        await v.getByRole('button', { name: 'Reproducir' }).click()
        await v.waitForTimeout(1200)
        await v.getByRole('button', { name: 'Pausar' }).click()
        const lienzo = v.locator('[data-lienzo="previa"]')
        // El cabezal está dentro de «Otro verso» (7000 a 9000): se ve esa línea, sin la píldora.
        await expect(lienzo).toContainText('Otro verso')
        await expect(lienzo).not.toContainText('(en pausa)')
        // La selección sigue en la línea 1.
        await expect(opcion(v, 1)).toHaveAttribute('aria-selected', 'true')
        // Clic en una fila: modo Línea con su píldora, y el cabezal no se mueve.
        const antes = await tiempo(v)
        await opcion(v, 2).click()
        await expect(lienzo).toContainText('Línea 2 (en pausa)')
        expect(await tiempo(v)).toBe(antes)
        // Buscar con la barra: vuelve el modo Cabezal.
        await barra(v).fill('1000')
        await expect(lienzo).not.toContainText('(en pausa)')
      },
      preparar
    )
  })

  test('doble clic en una palabra con la canción sonando no salta atrás (I3-1)', async () => {
    await conEditor(
      'preciso-doble-clic-sonando',
      async (v) => {
        await abrirEditor(v, T19)
        await opcion(v, 2).click()
        await v.keyboard.press('p')
        const ventana = v.getByRole('dialog', { name: /Editor preciso · Línea 2 de 2/ })
        await expect(ventana).toBeVisible()
        await barra(v).fill('8300')
        await v.getByRole('button', { name: 'Reproducir' }).click()
        await v.waitForTimeout(300)
        await ventana.getByRole('option').first().dblclick()
        // El deslizador se refresca cada ~80 ms: espera a que enseñe el salto antes de muestrear.
        await expect.poll(() => tiempo(v)).toBeLessThan(7500)
        // Muestrea el cabezal: va a 250 ms antes de la palabra (7000) y de ahí solo avanza.
        const muestras: number[] = []
        for (let i = 0; i < 20; i++) {
          muestras.push(await tiempo(v))
          await v.waitForTimeout(100)
        }
        expect(muestras[0]!).toBeGreaterThan(6600)
        expect(muestras[0]!).toBeLessThan(7300)
        for (let i = 1; i < muestras.length; i++) {
          expect(muestras[i]! - muestras[i - 1]!).toBeGreaterThanOrEqual(-50)
          expect(muestras[i]! - muestras[i - 1]!).toBeLessThan(400)
        }
        // Sigue sonando: dos segundos después el cabezal no ha vuelto a 8300.
        expect(muestras.at(-1)! - muestras[0]!).toBeGreaterThan(1200)
      },
      preparar
    )
  })
})
