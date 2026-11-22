import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { E } from '../src/renderer/src/vistas/editor/textos'
import { leerCancion } from './fixtures/separacion'
import { conEditor, abrirEditor, idSemilla } from './fixtures/editor'

/**
 * Capturas de revisión de la fase 8 de 0.2.1 (E8-19, `docs/ux/revisiones/0.2.1-fase-8/`). Opt-in:
 * `SHINOBI_CAPTURAS_8=1 npx playwright test e2e/fase8-capturas.spec.ts --workers=1`.
 * Las canciones y letras son inventadas (la semilla de pruebas). No escribe nada en el CI.
 */

const CAPTURAS = process.env.SHINOBI_CAPTURAS_8 === '1'
const DIR = join(process.cwd(), '..', 'docs', 'ux', 'revisiones', '0.2.1-fase-8')
const LISTA = 'Editor: lista incompleta'
const BORRADOR = 'Editor: pista de clics'
const FORMATOS = [
  { escala: 100, dpr: 1 },
  { escala: 125, dpr: 1.25 }
]

test.skip(!CAPTURAS, 'opt-in: SHINOBI_CAPTURAS_8=1')
test.describe.configure({ timeout: 120_000 })

async function ponerTamano(app: ElectronApplication, v: Page, ancho: number, alto: number) {
  await app.evaluate(
    ({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0]!.setContentSize(w!, h!),
    [ancho, alto]
  )
  await v.waitForTimeout(500)
}

/** Final Ruin inventado: líneas con palabras importadas (sin `origen_palabras`). */
function conImportadas(datos: string): void {
  const id = idSemilla(19)
  const cancion = leerCancion(datos, id)
  const base = cancion.letra.lineas.filter((l: { tipo: string }) => l.tipo === 'linea')
  cancion.letra.lineas = base.slice(0, 2).map((l: Record<string, unknown>, i: number) => ({
    ...l,
    texto: i === 0 ? 'Sol y mar' : 'Otro verso',
    inicio_ms: 2000 + i * 6000,
    fin_ms: 6000 + i * 6000,
    palabras:
      i === 0
        ? [
            { texto: 'Sol', inicio_ms: 2000, fin_ms: 3000 },
            { texto: 'y', inicio_ms: 3000, fin_ms: 3500 },
            { texto: 'mar', inicio_ms: 3500, fin_ms: 5500 }
          ]
        : null
  }))
  writeFileSync(join(datos, 'biblioteca', id, 'cancion.json'), JSON.stringify(cancion))
}

for (const f of FORMATOS) {
  test(`editor 1280x720 al ${f.escala} %`, async () => {
    mkdirSync(DIR, { recursive: true })
    const css = { ancho: Math.round(1280 / f.dpr), alto: Math.round(720 / f.dpr) }
    const foto = (v: Page, estado: string) =>
      v.screenshot({ path: join(DIR, `editor-1280x720-${f.escala}-${estado}.png`) })
    const con = (
      nombre: string,
      prueba: (v: Page, app: ElectronApplication) => Promise<void>,
      preparar?: (d: string) => void
    ) =>
      conEditor(
        `fase8-cap-${nombre}-${f.escala}`,
        async (v, _d, app) => {
          await ponerTamano(app, v, css.ancho, css.alto)
          await prueba(v, app)
        },
        preparar,
        f.dpr
      )
    const funciones = (v: Page) => v.getByRole('radio', { name: E.funciones.nombre }).click()

    await con(
      'importadas',
      async (v) => {
        await abrirEditor(v, LISTA)
        await v.getByRole('option', { name: /^Línea 1,/ }).click()
        await foto(v, 'final-ruin-sin-palabras')
        await foto(v, 'panel-sin-desplazamiento')
        await foto(v, 'dock-lista')
        await funciones(v)
        await foto(v, 'funciones-lista')
        await v.getByRole('button', { name: 'Más acciones del editor' }).click()
        await foto(v, 'menu-cabecera')
      },
      conImportadas
    )
    await con('borrador', async (v) => {
      await abrirEditor(v, BORRADOR)
      await foto(v, 'dock-borrador')
      await funciones(v)
      await foto(v, 'funciones-borrador')
      await foto(v, 'funciones-no-disponible')
      await v.getByRole('button', { name: 'Minimizar panel' }).click()
      await expect(v.getByRole('button', { name: E.layout.riel.funcionesNombre })).toBeVisible()
      await foto(v, 'riel-funciones')
    })
    await con(
      'letra-lista',
      async (v) => {
        await abrirEditor(v, LISTA)
        await foto(v, 'dock-letra-lista')
      },
      (d) => {
        const id = idSemilla(19)
        const cancion = leerCancion(d, id)
        cancion.modalidad = 'letra_lista'
        writeFileSync(join(d, 'biblioteca', id, 'cancion.json'), JSON.stringify(cancion))
      }
    )
  })
}
