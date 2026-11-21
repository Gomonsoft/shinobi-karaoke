import { expect, test, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { E } from '../src/renderer/src/vistas/editor/textos'
import { leerCancion } from './fixtures/separacion'
import { abrirEditor, conEditor, idSemilla } from './fixtures/editor'

/**
 * Editor preciso de línea (fase 9) con la app compilada: abrir, editar el texto, aplicar como un
 * paso, guardar (texto antes que tiempos), deshacer y el worker del estiramiento (0.5× con tono).
 */

const T19 = 'Editor: lista incompleta'
const ID = idSemilla(19)

interface Linea {
  tipo: 'linea' | 'pausa'
  texto?: string
  inicio_ms: number | null
  fin_ms: number | null
  palabras?: unknown[] | null
  origen_palabras?: string
}
const lineas = (datos: string): Linea[] =>
  (leerCancion(datos, ID).letra.lineas as Linea[]).filter((l) => l.tipo === 'linea')

function preparar(datos: string): void {
  const cancion = leerCancion(datos, ID)
  const base = cancion.letra.lineas.filter((l: Linea) => l.tipo === 'linea')
  cancion.letra.offset_ms = 0
  cancion.letra.lineas = [
    { ...base[0], texto: 'Sol y mar', inicio_ms: 2000, fin_ms: 5000, palabras: null },
    { ...base[1], texto: 'Otro verso', inicio_ms: 7000, fin_ms: 9000, palabras: null }
  ]
  writeFileSync(join(datos, 'biblioteca', ID, 'cancion.json'), JSON.stringify(cancion))
}

const opcion = (v: Page, n: number) => v.getByRole('option', { name: new RegExp(`^Línea ${n},`) })

test.describe('editor preciso de línea', () => {
  test.describe.configure({ timeout: 90_000 })

  test('P abre la ventana; el texto nuevo se aplica como un paso, se guarda y se deshace', async () => {
    await conEditor(
      'preciso-aplicar',
      async (v, datos) => {
        await abrirEditor(v, T19)
        await opcion(v, 1).click()
        await v.keyboard.press('p')
        const ventana = v.getByRole('dialog', { name: /Editor preciso · Línea 1 de 2/ })
        await expect(ventana).toBeVisible()
        // La línea abierta no deja editar sus tiempos desde el panel.
        await expect(
          v
            .getByRole('region', { name: 'Ajuste de sincronía' })
            .getByRole('textbox', { name: 'Inicio' })
        ).toBeDisabled()

        const campo = ventana.getByRole('textbox', { name: 'Texto' })
        await campo.fill('Sol y mar azul')
        await campo.press('Enter')
        await campo.press('Control+Enter')
        await expect(ventana).toHaveCount(0)

        // Las palabras nuevas llegan repartidas y la línea las pinta palabra a palabra.
        await expect(opcion(v, 1)).toContainText('Sol y mar azul')
        await expect
          .poll(() => lineas(datos)[0]!, { timeout: 8000 })
          .toMatchObject({
            texto: 'Sol y mar azul',
            inicio_ms: 2000,
            fin_ms: 5000,
            origen_palabras: 'manual'
          })
        expect(lineas(datos)[0]!.palabras).toHaveLength(4)
        expect(lineas(datos)[1]!.texto).toBe('Otro verso')

        // Un solo Ctrl/Cmd + Z devuelve texto, límites y palabras.
        await v.keyboard.press('ControlOrMeta+z')
        await expect(opcion(v, 1)).toContainText('Sol y mar')
        await expect
          .poll(() => lineas(datos)[0]!, { timeout: 8000 })
          .toMatchObject({ texto: 'Sol y mar', palabras: null })
      },
      preparar
    )
  })

  test('a 0,5× el estiramiento con tono conservado carga en la app compilada (worker y CSP)', async () => {
    await conEditor(
      'preciso-tono',
      async (v) => {
        const errores: string[] = []
        v.on('console', (m) => {
          if (m.type() === 'error') errores.push(m.text())
        })
        await v.evaluate(() => {
          const w = window as unknown as {
            __workers: { creados: number; errores: number; respuestas: number }
          }
          w.__workers = { creados: 0, errores: 0, respuestas: 0 }
          const Original = window.Worker
          window.Worker = class extends Original {
            constructor(...args: ConstructorParameters<typeof Worker>) {
              super(...args)
              w.__workers.creados++
              this.addEventListener('error', () => w.__workers.errores++)
              this.addEventListener('message', () => w.__workers.respuestas++)
            }
          }
        })
        await abrirEditor(v, T19)
        await opcion(v, 1).click()
        await v.keyboard.press('p')
        const ventana = v.getByRole('dialog', { name: /Editor preciso/ })
        await expect(ventana).toBeVisible()
        await ventana.getByRole('radio', { name: '0,5×' }).click()
        await ventana.getByRole('button', { name: /Bucle de la línea/ }).click()
        await v.waitForTimeout(2500)
        // La nota de tono solo aparece si el estiramiento falló (ADR 0021 §9).
        await expect(ventana.getByText(E.velocidadTooltip)).toHaveCount(0)
        // El worker se creó, respondió y no falló (CSP y empaquetado de la app compilada).
        const worker = await v.evaluate(
          () =>
            (
              window as unknown as {
                __workers: { creados: number; errores: number; respuestas: number }
              }
            ).__workers
        )
        expect(worker.creados).toBeGreaterThan(0)
        expect(worker.errores).toBe(0)
        expect(worker.respuestas).toBeGreaterThan(0)
        expect(errores.filter((e) => /worker|Content Security Policy|CSP/i.test(e))).toEqual([])
      },
      preparar
    )
  })

  test('palabras hechas a mano: se muestran, y mover el fin las quita con aviso y Ctrl+Z las devuelve (P18, P20)', async () => {
    await conEditor(
      'preciso-descartar',
      async (v, datos) => {
        await abrirEditor(v, T19)
        await opcion(v, 1).click()
        // Guardadas y reabiertas: la fila y el panel las señalan (a diferencia de las importadas).
        await expect(opcion(v, 1).locator('svg.lucide-whole-word')).toBeVisible()
        await expect(v.getByText(E.preciso.indicadorPanel)).toBeVisible()
        await expect(v.getByText(E.preciso.avisoDescartar)).toBeVisible()

        const fin = v.getByRole('textbox', { name: E.fin, exact: true })
        await fin.fill('00:05.00')
        await fin.press('Enter')
        await expect(v.getByText(/La línea 1 vuelve al barrido progresivo/)).toBeVisible()
        await expect
          .poll(() => lineas(datos)[0]!, { timeout: 8000 })
          .toMatchObject({ fin_ms: 5000, palabras: null })
        await opcion(v, 1).focus()
        await v.keyboard.press('ControlOrMeta+z')
        await expect
          .poll(() => lineas(datos)[0]!, { timeout: 8000 })
          .toMatchObject({ fin_ms: 6000, origen_palabras: 'manual' })
        expect(lineas(datos)[0]!.palabras).toHaveLength(3)
      },
      (datos) => {
        preparar(datos)
        const cancion = leerCancion(datos, ID)
        cancion.letra.lineas[0] = {
          ...cancion.letra.lineas[0],
          texto: 'Sol y mar',
          inicio_ms: 2000,
          fin_ms: 6000,
          origen_palabras: 'manual',
          palabras: [
            { texto: 'Sol', inicio_ms: 2000, fin_ms: 3000 },
            { texto: 'y', inicio_ms: 3000, fin_ms: 3500 },
            { texto: 'mar', inicio_ms: 3500, fin_ms: 5500 }
          ]
        }
        writeFileSync(join(datos, 'biblioteca', ID, 'cancion.json'), JSON.stringify(cancion))
      }
    )
  })
})
