import { expect, test, type Page } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { E } from '../src/renderer/src/vistas/editor/textos'
import { leerCancion } from './fixtures/separacion'
import { abrirEditor, conEditor, idSemilla } from './fixtures/editor'

/**
 * Fase 8 de 0.2.1 de punta a punta con una canción con tiempos por palabra IMPORTADOS (inventados):
 * se muestran como cualquier línea, abrir no escribe, y corregir un fin descarta las palabras de esa
 * línea sin tocar las demás (E8-1, E8-2, E8-4 con palabras importadas: sin toast).
 */

const T19 = 'Editor: lista incompleta'
const ID = idSemilla(19)
const ruta = (datos: string): string => join(datos, 'biblioteca', ID, 'cancion.json')

interface Linea {
  tipo: 'linea' | 'pausa'
  texto?: string
  inicio_ms: number | null
  fin_ms: number | null
  palabras?: { texto: string; inicio_ms: number; fin_ms: number }[] | null
}
const lineas = (datos: string): Linea[] =>
  (leerCancion(datos, ID).letra.lineas as Linea[]).filter((l) => l.tipo === 'linea')

/** Dos líneas con palabras importadas (sin `origen_palabras`), como las de LRCLIB de 0.2.0. */
function conPalabrasImportadas(datos: string): void {
  const cancion = leerCancion(datos, ID)
  const base = cancion.letra.lineas.filter((l: Linea) => l.tipo === 'linea')
  cancion.letra.offset_ms = 0
  cancion.letra.lineas = [
    {
      ...base[0],
      texto: 'Sol y mar',
      inicio_ms: 2000,
      fin_ms: 6000,
      palabras: [
        { texto: 'Sol', inicio_ms: 2000, fin_ms: 3000 },
        { texto: 'y', inicio_ms: 3000, fin_ms: 3500 },
        { texto: 'mar', inicio_ms: 3500, fin_ms: 5500 }
      ]
    },
    {
      ...base[1],
      texto: 'Otro verso',
      inicio_ms: 8000,
      fin_ms: 12_000,
      palabras: [
        { texto: 'Otro', inicio_ms: 8000, fin_ms: 9500 },
        { texto: 'verso', inicio_ms: 9500, fin_ms: 11_000 }
      ]
    }
  ]
  writeFileSync(ruta(datos), JSON.stringify(cancion))
}

const opcion = (v: Page, n: number) => v.getByRole('option', { name: new RegExp(`^Línea ${n},`) })

test.describe('fase 8: sincronía y editor más simples', () => {
  test.describe.configure({ timeout: 60_000 })

  test('abrir una canción con palabras importadas no escribe el archivo ni muestra marcas por palabra', async () => {
    await conEditor(
      'fase8-importadas',
      async (v, datos) => {
        const antes = readFileSync(ruta(datos), 'utf8')
        await abrirEditor(v, T19)
        await opcion(v, 1).click()
        await expect(v.getByText('por palabra')).toHaveCount(0)
        await expect(v.getByRole('listbox').locator('svg.lucide-whole-word')).toHaveCount(0)
        await expect(v.getByText(/Desplazamiento de toda la letra/)).toHaveCount(0)
        // S no hace nada: solo el botón entra en el modo al ritmo.
        await v.keyboard.press('s')
        await expect(v.getByRole('heading', { name: E.syncTitulo })).toHaveCount(0)
        await v.waitForTimeout(1500)
        expect(readFileSync(ruta(datos), 'utf8')).toBe(antes)
      },
      conPalabrasImportadas
    )
  })

  test('corregir el fin de una línea descarta sus palabras importadas sin aviso y deja las demás', async () => {
    await conEditor(
      'fase8-corregir-fin',
      async (v, datos) => {
        await abrirEditor(v, T19)
        await opcion(v, 1).click()
        const fin = v.getByRole('textbox', { name: E.fin, exact: true })
        await fin.fill('00:05.00')
        await fin.press('Enter')
        await expect.poll(() => lineas(datos)[0]!.fin_ms, { timeout: 8000 }).toBe(5000)
        expect(lineas(datos)[0]!.palabras ?? null).toBeNull()
        expect(lineas(datos)[1]!.palabras).toHaveLength(2)
        // Las palabras importadas se borran sin toast (no cambia nada visible).
        await expect(v.getByText(/vuelve al barrido progresivo/)).toHaveCount(0)
        // Ctrl/Cmd + Z devuelve la línea tal cual, con sus palabras.
        await opcion(v, 1).focus()
        await v.keyboard.press('ControlOrMeta+z')
        await expect.poll(() => lineas(datos)[0]!.fin_ms, { timeout: 8000 }).toBe(6000)
        expect(lineas(datos)[0]!.palabras).toHaveLength(3)
      },
      conPalabrasImportadas
    )
  })
})
