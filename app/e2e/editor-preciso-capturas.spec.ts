import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { leerCancion } from './fixtures/separacion'
import { abrirEditor, conEditor, idSemilla } from './fixtures/editor'

/**
 * Capturas de revisión de la fase 9 de 0.2.1 (P23, `docs/ux/revision-0.2.1-fase-9/`). Opt-in:
 * `SHINOBI_CAPTURAS_9=1 npx playwright test e2e/editor-preciso-capturas.spec.ts --workers=1`.
 * Letras inventadas. No escribe nada en el CI.
 */

const CAPTURAS = process.env.SHINOBI_CAPTURAS_9 === '1'
const DIR = join(process.cwd(), '..', 'docs', 'ux', 'revision-0.2.1-fase-9')
const TITULO = 'Editor: lista incompleta'
const ID = idSemilla(19)

test.skip(!CAPTURAS, 'opt-in: SHINOBI_CAPTURAS_9=1')
test.describe.configure({ timeout: 120_000 })

function preparar(datos: string): void {
  const cancion = leerCancion(datos, ID)
  const base = cancion.letra.lineas.filter((l: { tipo: string }) => l.tipo === 'linea')
  cancion.letra.offset_ms = 0
  cancion.letra.lineas = [
    {
      ...base[0],
      texto: 'Sol y mar azul',
      inicio_ms: 2000,
      fin_ms: 6000,
      origen_palabras: 'manual',
      palabras: [
        { texto: 'Sol', inicio_ms: 2000, fin_ms: 3000 },
        { texto: 'y', inicio_ms: 3000, fin_ms: 3500 },
        { texto: 'mar', inicio_ms: 3500, fin_ms: 4800 },
        { texto: 'azul', inicio_ms: 4800, fin_ms: 6000 }
      ]
    },
    { ...base[1], texto: 'Otro verso', inicio_ms: 8000, fin_ms: 12_000, palabras: null }
  ]
  writeFileSync(join(datos, 'biblioteca', ID, 'cancion.json'), JSON.stringify(cancion))
}

async function ponerTamano(app: ElectronApplication, v: Page, ancho: number, alto: number) {
  await app.evaluate(
    ({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0]!.setContentSize(w!, h!),
    [ancho, alto]
  )
  await v.waitForTimeout(500)
}

const FORMATOS = [
  { nombre: '1280x720-100', ancho: 1280, alto: 720, dpr: 1 },
  { nombre: '1280x720-125', ancho: 1280, alto: 720, dpr: 1.25 },
  { nombre: '1024x576-125', ancho: 1024, alto: 576, dpr: 1.25 }
]

for (const f of FORMATOS) {
  test(`editor preciso ${f.nombre}`, async () => {
    mkdirSync(DIR, { recursive: true })
    await conEditor(
      `fase9-cap-${f.nombre}`,
      async (v, _d, app) => {
        await ponerTamano(app, v, Math.round(f.ancho / f.dpr), Math.round(f.alto / f.dpr))
        await abrirEditor(v, TITULO)
        const foto = (estado: string) =>
          v.screenshot({ path: join(DIR, `editor-${f.nombre}-${estado}.png`) })
        await foto('lista-indicador')
        await v.getByRole('option', { name: /^Línea 1,/ }).click()
        await v.keyboard.press('p')
        const ventana = v.getByRole('dialog', { name: /Editor preciso/ })
        await expect(ventana).toBeVisible()
        await v.waitForTimeout(600)
        await foto('preciso-abierto')
        await ventana.getByRole('radio', { name: '0,5×' }).click()
        await ventana.getByRole('button', { name: /Bucle de la línea/ }).click()
        await v.waitForTimeout(1500)
        await foto('preciso-marcando')
        await ventana.getByRole('textbox', { name: 'Texto' }).fill('Sol y mar azul y más')
        await ventana.getByRole('textbox', { name: 'Texto' }).press('Enter')
        await foto('preciso-texto-repartido')
      },
      preparar,
      f.dpr
    )
  })
}
