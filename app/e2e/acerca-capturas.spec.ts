import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { conTemas } from './fixtures/temas'
import type { Compilacion } from '../src/shared/compilacion'

/**
 * Capturas de «Acerca de» de la fase 10 (tarea 0249, AC8 de `docs/ux/08-ajustes-y-acerca.md`).
 * Opt-in: `SHINOBI_CAPTURAS_10=1 npx playwright test e2e/acerca-capturas.spec.ts --workers=1`.
 * No escribe nada en CI. La compilación de prueba no sale de un build distinto: la prueba sustituye
 * en main el manejador de `sistema:info` por uno con los datos de cada estado.
 */

const CAPTURAS = process.env.SHINOBI_CAPTURAS_10 === '1'
const DIR = join(process.cwd(), '..', 'docs', 'ux', 'revision-fase-10')
const SHA = '3f9c2a1' + 'b'.repeat(33)

const ESTADOS: { estado: string; version: string; compilacion: Compilacion; canal: RegExp }[] = [
  {
    estado: 'previa',
    version: '0.2.0-alpha.2',
    compilacion: { canal: 'publicada', numero: 1234, commit: SHA },
    canal: /Versión preliminar publicada · commit 3f9c2a1/
  },
  {
    estado: 'desarrollo',
    version: '0.2.0-alpha.3',
    compilacion: { canal: 'desarrollo', numero: 1260, commit: SHA },
    canal:
      /Compilación de desarrollo: no es una versión publicada y puede fallar\. · commit 3f9c2a1/
  },
  {
    estado: 'local',
    version: '0.2.0-alpha.3',
    compilacion: { canal: 'local', numero: null, commit: SHA },
    canal: /Compilación local, sin número de compilación · commit 3f9c2a1/
  }
]

test.describe('capturas de Acerca de de la fase 10', () => {
  test.skip(!CAPTURAS, 'se generan solo con SHINOBI_CAPTURAS_10=1')
  test.describe.configure({ timeout: 120_000 })

  for (const e of ESTADOS) {
    test(`ajustes 1280x800 al 100 %: acerca ${e.estado}`, async () => {
      await conTemas(`cap-acerca-${e.estado}`, async (v, _datos, app) => {
        await app.evaluate(
          ({ BrowserWindow, ipcMain }, datos) => {
            BrowserWindow.getAllWindows()[0]!.setContentSize(1280, 800)
            ipcMain.removeHandler('sistema:info')
            ipcMain.handle('sistema:info', () => ({
              ok: true,
              valor: {
                version: datos.version,
                compilacion: datos.compilacion,
                so: 'Windows_NT 10.0',
                plataforma: 'win32',
                youtube: true
              }
            }))
          },
          { version: e.version, compilacion: e.compilacion }
        )
        await v.getByRole('button', { name: 'Ajustes', exact: true }).click()
        const bloque = v.getByRole('region', { name: 'Acerca de Shinobi Karaoke' })
        await expect(bloque.getByText(e.canal)).toBeVisible()
        await bloque.scrollIntoViewIfNeeded()
        await v.mouse.move(0, 0)
        await v.waitForTimeout(400)
        mkdirSync(DIR, { recursive: true })
        await v.screenshot({ path: join(DIR, `ajustes-1280x800-100-acerca-${e.estado}.png`) })
      })
    })
  }
})
