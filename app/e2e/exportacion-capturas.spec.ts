import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { sembrar } from '../src/main/biblioteca/semilla'
import { idSemilla } from './fixtures/editor'
import { leerCancion, leerConfig, tarjeta } from './fixtures/separacion'
import { salirSinConfirmar } from './salir'
import { crearTemporal } from './temporales'

/**
 * Capturas de revisión de la fase 6 (tarea 0241, `docs/ux/revisiones/fase-6/README.md`, criterio V29).
 * Opt-in: `SHINOBI_CAPTURAS_6=1 npx playwright test e2e/exportacion-capturas.spec.ts --workers=1`.
 * No escribe nada en el CI. Cada estado es independiente: si uno falla se anota y se sigue.
 * Con el worker real: el progreso y el éxito son de una exportación de verdad (5 s a 1080p30 MKV).
 */

const CAPTURAS = process.env.SHINOBI_CAPTURAS_6 === '1'
const DIR = join(process.cwd(), '..', 'docs', 'ux', 'revisiones', 'fase-6')
const TITULO = 'Reproductor: lista'
const ID = idSemilla(20)

const PANTALLAS = [
  { id: 1, label: 'Principal', bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
  { id: 2, label: 'Escenario', bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
]

const FORMATOS = [
  { ancho: 1280, alto: 800, dpr: 1, escala: '100' },
  { ancho: 1280, alto: 720, dpr: 1.25, escala: '125' }
]

async function lanzar(dpr: number): Promise<{ app: ElectronApplication; v: Page; salida: string }> {
  const datos = crearTemporal('exportacion-capturas')
  const salida = crearTemporal('exportacion-capturas-salida')
  await sembrar(datos)
  // 30 s de audio: se exporta 5 s para que el progreso se vea y el éxito llegue pronto.
  const cancion = leerCancion(datos, ID)
  cancion.metadatos.duracion_ms = 5000
  writeFileSync(join(datos, 'biblioteca', ID, 'cancion.json'), JSON.stringify(cancion, null, 2))
  const config = leerConfig(datos)
  config.instalacion.estado = 'completa'
  config.exportacion = { carpeta: salida }
  writeFileSync(join(datos, 'config.json'), JSON.stringify(config))
  const app = await electron.launch({
    args: ['.', `--force-device-scale-factor=${dpr}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHINOBI_DATOS: datos,
      SHINOBI_SILENCIAR_AUDIO: '1',
      SHINOBI_PANTALLAS_SIMULADAS: JSON.stringify(PANTALLAS),
      SHINOBI_PANTALLA_COMPLETA_SIMULADA: '1'
    }
  })
  const v = await app.firstWindow()
  await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
  return { app, v, salida }
}

async function ponerTamano(app: ElectronApplication, ancho: number, alto: number): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, [w, h]) => {
      const ventana = BrowserWindow.getAllWindows()[0]!
      ventana.unmaximize()
      ventana.setMinimumSize(300, 300)
      ventana.setContentSize(w as number, h as number)
    },
    [ancho, alto] as const
  )
  await new Promise((r) => setTimeout(r, 600))
}

async function abrirDialogo(v: Page): Promise<void> {
  await v.getByRole('searchbox', { name: /^Buscar título/ }).fill(TITULO)
  const t = tarjeta(v, TITULO)
  await expect(t).toBeVisible()
  // La tarjeta se recoloca al cambiar de estado y eso cierra el menú: se reintenta hasta que abre.
  await expect(async () => {
    await t.getByRole('button', { name: `Más acciones de «${TITULO}»` }).click()
    await v
      .getByRole('menuitem', { name: /^(Exportar video…|Ver exportación)$/ })
      .dispatchEvent('click', undefined, { timeout: 2000 })
  }).toPass({ timeout: 30_000 })
  await expect(v.getByRole('dialog', { name: /Exportar video|Exportando video/ })).toBeVisible()
}

test.describe('capturas de revisión de la fase 6', () => {
  test.skip(!CAPTURAS, 'se generan solo con SHINOBI_CAPTURAS_6=1')
  test.describe.configure({ timeout: 600_000 })

  const fallos: string[] = []
  test.beforeAll(() => mkdirSync(DIR, { recursive: true }))
  test.afterAll(() => {
    if (fallos.length > 0) console.log(`Capturas no tomadas:\n${fallos.join('\n')}`)
  })

  async function intentar(nombre: string, accion: () => Promise<void>): Promise<void> {
    try {
      await accion()
    } catch (e) {
      fallos.push(`${nombre}: ${String(e).split('\n')[0]}`)
      console.log(`FALLO ${nombre}: ${String(e).split('\n')[0]}`)
    }
  }
  const foto = async (p: Page, nombre: string): Promise<void> => {
    await p.mouse.move(0, 0).catch(() => undefined)
    await p.waitForTimeout(500)
    await p.screenshot({ path: join(DIR, `exportacion-${nombre}.png`) })
  }

  for (const f of FORMATOS) {
    test(`exportación ${f.ancho}x${f.alto} al ${f.escala} %`, async () => {
      const nombre = (estado: string) => `${f.ancho}x${f.alto}-${f.escala}-${estado}`
      const css = { ancho: Math.round(f.ancho / f.dpr), alto: Math.round(f.alto / f.dpr) }

      // Formulario en sus variantes, sin tocar el disco.
      {
        const { app, v } = await lanzar(f.dpr)
        try {
          await ponerTamano(app, css.ancho, css.alto)
          await abrirDialogo(v)
          const dialogo = v.getByRole('dialog', { name: 'Exportar video' })
          await expect(dialogo.getByRole('button', { name: 'Exportar', exact: true })).toBeEnabled()
          await intentar('formulario', () => foto(v, nombre('formulario')))

          await intentar('ayuda-formato', async () => {
            await dialogo.getByRole('button', { name: 'Qué formato elegir' }).click()
            await expect(dialogo.getByRole('region', { name: 'Qué formato elegir' })).toBeVisible()
            await foto(v, nombre('ayuda-formato'))
            await v.keyboard.press('Escape')
          })

          await intentar('formulario-webm', async () => {
            await dialogo.getByRole('radio', { name: /^WebM/ }).click()
            await foto(v, nombre('formulario-webm'))
            await dialogo.getByRole('radio', { name: /^MKV/ }).click()
          })

          await intentar('formulario-4x3', async () => {
            await dialogo.getByRole('radio', { name: /^4:3/ }).click()
            await foto(v, nombre('formulario-4x3'))
          })
        } finally {
          await salirSinConfirmar(app)
        }
      }

      // Con un archivo previo: aviso de sustitución.
      await intentar('archivo-existe', async () => {
        const { app, v, salida } = await lanzar(f.dpr)
        try {
          await ponerTamano(app, css.ancho, css.alto)
          const ruta = await v.evaluate(async (cancionId) => {
            const api = (
              globalThis as unknown as {
                shinobi: {
                  exportacion: { destinoPropuesto(p: unknown): Promise<{ ruta: string }> }
                }
              }
            ).shinobi.exportacion
            return (await api.destinoPropuesto({ cancionId, formato: 'mkv_av1' })).ruta
          }, ID)
          expect(ruta.startsWith(salida)).toBe(true)
          writeFileSync(ruta, 'video anterior')
          await abrirDialogo(v)
          const aviso = v.getByText(/Ya hay un archivo con este nombre/)
          await aviso.scrollIntoViewIfNeeded()
          await expect(aviso).toBeVisible()
          await foto(v, nombre('archivo-existe'))
        } finally {
          await salirSinConfirmar(app)
        }
      })

      // Con una sesión abierta en pantallas simuladas: la nota de recursos.
      await intentar('nota-sesion', async () => {
        const { app, v } = await lanzar(f.dpr)
        try {
          await ponerTamano(app, css.ancho, css.alto)
          const nueva = app.waitForEvent('window')
          await v.evaluate((cancionId) => {
            const api = (
              globalThis as unknown as {
                shinobi: { sesion: { abrir(p: unknown): Promise<unknown> } }
              }
            ).shinobi
            return api.sesion.abrir({
              pantallaId: 2,
              pantallaCompleta: false,
              inicio: { tipo: 'cancion', cancionId, donde: 'ahora' }
            })
          }, ID)
          await nueva
          await abrirDialogo(v)
          const nota = v.getByText(/El reproductor está abierto en otra pantalla/)
          await nota.scrollIntoViewIfNeeded()
          await expect(nota).toBeVisible()
          await foto(v, nombre('nota-sesion'))
        } finally {
          await salirSinConfirmar(app)
        }
      })

      // Exportación real: progreso, confirmación de cancelar, tarjeta y éxito.
      await intentar('exportando', async () => {
        const { app, v } = await lanzar(f.dpr)
        try {
          await ponerTamano(app, css.ancho, css.alto)
          await abrirDialogo(v)
          const dialogo = v.getByRole('dialog', { name: 'Exportar video' })
          await dialogo.getByRole('button', { name: 'Exportar', exact: true }).click()
          await expect(v.getByRole('dialog', { name: 'Exportando video' })).toBeVisible()
          await foto(v, nombre('exportando'))
          await intentar('confirmar-cancelar', async () => {
            await v.getByRole('button', { name: 'Cancelar exportación' }).click()
            await expect(v.getByText('¿Cancelar la exportación?')).toBeVisible()
            await foto(v, nombre('confirmar-cancelar'))
            await v.getByRole('button', { name: 'Seguir exportando' }).click()
          })
          await intentar('tarjeta-exportando', async () => {
            await v.getByRole('button', { name: 'Seguir en segundo plano' }).click()
            await expect(tarjeta(v, TITULO)).toBeVisible()
            await foto(v, nombre('tarjeta-exportando'))
          })
          await intentar('exito', async () => {
            await expect(async () => {
              if (!(await v.getByRole('dialog', { name: 'Video exportado' }).isVisible())) {
                await abrirDialogo(v).catch(() => undefined)
              }
              await expect(v.getByRole('dialog', { name: 'Video exportado' })).toBeVisible()
            }).toPass({ timeout: 120_000 })
            await foto(v, nombre('exito'))
          })
        } finally {
          await salirSinConfirmar(app)
        }
      })
    })
  }
})
