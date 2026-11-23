import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Locator,
  type Page
} from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sembrar } from '../src/main/biblioteca/semilla'
import type { EstadoSesionIpc } from '../src/shared/sesion'
import { E } from '../src/renderer/src/vistas/editor/textos'
import { LL } from '../src/renderer/src/vistas/editor/textosLetraLista'
import { R } from '../src/renderer/src/vistas/reproductor/textos'
import { abrirEditor, conEditor, idSemilla } from './fixtures/editor'
import { leerCancion, tarjeta } from './fixtures/separacion'
import { salirSinConfirmar } from './salir'
import { crearTemporal } from './temporales'

/**
 * Integración de la fase 5 (0219): Letra lista de punta a punta, en la sesión, la misma fase del
 * fondo en editor y reproductor, y movimiento reducido. La matemática y las pantallas las cubre
 * Vitest; aquí solo lo que cruza procesos. G2 (píxel a píxel con 0.1.0) pasa a la guía manual.
 */

const TITULO = 'Reproductor: lista'
const ID = idSemilla(20)
const SEGUNDOS = 12_300

const ESTILO_CONICO = {
  version: 1,
  fondo: {
    tipo: 'degradado',
    forma: 'conico',
    centro: { x: 0.5, y: 0.5 },
    movimiento: { periodo_s: 30, sentido: 'horario' },
    angulo_grados: 0,
    paradas: [
      { color: '#0B3D2E', posicion: 0 },
      { color: '#FFE066', posicion: 0.5 },
      { color: '#1E5AA8', posicion: 1 }
    ]
  },
  letra: {
    fuente: { familia: 'Montserrat', origen: 'incluida' },
    color: '#FFFFFF',
    color_resaltado: '#FFE066'
  }
}

/** Reescribe `cancion.json` de la semilla 20 antes de lanzar la app. */
async function reescribir(datos: string, cambios: Record<string, unknown>): Promise<void> {
  const cancion = { ...leerCancion(datos, ID), ...cambios }
  await writeFile(join(datos, 'biblioteca', ID, 'cancion.json'), JSON.stringify(cancion))
}

/** Pone en pausa y busca `ms` en el control de tiempo (el reproductor y el editor lo exponen). */
async function buscarEnPausa(
  pagina: Page | Locator,
  botonPausa: RegExp | string,
  barra: Locator,
  ms: number
): Promise<void> {
  const pausa = pagina.getByRole('button', {
    name: botonPausa,
    exact: typeof botonPausa === 'string'
  })
  await expect(pausa).toBeVisible({ timeout: 15_000 })
  await pausa.click()
  await barra.fill(String(ms))
}

const fondoDe = (raiz: Locator): Promise<string> =>
  raiz.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--k-fondo'))

test.describe('fase 5: integración', () => {
  test.describe.configure({ timeout: 120_000 })

  test('Letra lista de punta a punta: marcar, insignia, sin barrido al reproducir y con barrido en el editor', async () => {
    await conEditor(
      'fase5-letra-lista',
      async (v) => {
        await abrirEditor(v, TITULO)
        await v.getByRole('button', { name: LL.boton, exact: true }).click()
        const dialogo = v.getByRole('dialog', { name: LL.dialogoTitulo })
        await expect(dialogo).toBeVisible()
        await dialogo.getByRole('checkbox', { name: LL.noVolverAMostrar }).check()
        await dialogo.getByRole('button', { name: LL.boton, exact: true }).click()

        // LB1: vuelve a la Biblioteca con la tarjeta resaltada y la insignia.
        await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
        await expect(v.locator('[data-resaltada]')).toHaveCount(1)
        await v.getByRole('searchbox', { name: /^Buscar título/ }).fill(TITULO)
        await expect(tarjeta(v, TITULO)).toContainText('Letra lista')

        // R12: la reproducción no tiene capa de resaltado.
        await tarjeta(v, TITULO)
          .getByRole('button', { name: /^Reproducir/ })
          .click()
        const capa = v.getByRole('dialog', { name: `Reproductor de «${TITULO}»` })
        await expect(capa.getByRole('button', { name: R.tooltip.pausa })).toBeVisible({
          timeout: 15_000
        })
        await capa.getByRole('slider', { name: 'Barra de tiempo' }).fill('5500')
        await expect(capa.locator('[data-linea="r2"]')).toBeVisible()
        await expect(capa.locator('[data-barrido]')).toHaveCount(0)
        await v.keyboard.press('Escape')
        await expect(capa).toHaveCount(0)

        // LL4: en el editor la vista previa conserva el barrido.
        await abrirEditor(v, TITULO)
        await v
          .getByRole('region', { name: 'Reproducción' })
          .getByRole('button', { name: 'Reproducir', exact: true })
          .click()
        await v.getByRole('slider', { name: 'Tiempo de reproducción' }).fill('5500')
        const previa = v.locator('[data-lienzo="previa"]')
        await expect(previa.locator('[data-linea="r2"]')).toBeVisible()
        await expect(previa.locator('[data-barrido]').first()).toBeVisible()
      },
      (datos) => {
        const cancion = leerCancion(datos, ID)
        cancion.estado = 'borrador'
        delete cancion.modalidad
        cancion.pasos.edicion = { ...cancion.pasos.edicion, estado: 'pendiente' }
        writeFileSync(join(datos, 'biblioteca', ID, 'cancion.json'), JSON.stringify(cancion))
      }
    )
  })

  test('Letra lista en la sesión: sin barrido en la secundaria y el cambio a Lista no afecta a la que suena', async () => {
    const datos = crearTemporal('fase5-sesion')
    await sembrar(datos)
    await reescribir(datos, { estado: 'lista', modalidad: 'letra_lista' })
    const rutaConfig = join(datos, 'config.json')
    const config = JSON.parse(await readFile(rutaConfig, 'utf8'))
    config.reproductor = { ...config.reproductor, transicion_s: 2 }
    await writeFile(rutaConfig, JSON.stringify(config, null, 2))
    const app: ElectronApplication = await electron.launch({
      args: ['.'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        SHINOBI_DATOS: datos,
        SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
        SHINOBI_SILENCIAR_AUDIO: '1',
        SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1',
        SHINOBI_PANTALLAS_SIMULADAS: JSON.stringify([
          { id: 1, label: 'Principal', bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
          { id: 2, label: 'Escenario', bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
        ]),
        SHINOBI_PANTALLA_COMPLETA_SIMULADA: '1'
      }
    })
    try {
      const principal = await app.firstWindow()
      await expect(principal.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
      interface Api {
        shinobi: {
          sesion: {
            abrir(p: unknown): Promise<EstadoSesionIpc>
            estado(): Promise<EstadoSesionIpc>
          }
          biblioteca: { marcarLista(id: string, o: unknown): Promise<{ modalidad: string }> }
        }
      }
      const nueva = app.waitForEvent('window')
      await principal.evaluate(
        (id) =>
          (window as unknown as Api).shinobi.sesion.abrir({
            pantallaId: 2,
            pantallaCompleta: false,
            inicio: { tipo: 'cancion', cancionId: id, donde: 'ahora' }
          }),
        ID
      )
      const secundaria = await nueva
      await secundaria.waitForLoadState('domcontentloaded')
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .filter((w) => w.webContents.getURL().endsWith('reproductor.html'))
          .forEach((w) => w.webContents.setAudioMuted(true))
      )
      // R13: suena en la secundaria con letra y sin capa de resaltado (r2 lleva tiempos de palabra).
      await expect(secundaria.locator('[data-linea="r2"]')).toBeVisible({ timeout: 40_000 })
      await expect(secundaria.locator('[data-barrido]')).toHaveCount(0)

      // Cambiarla a Lista en mitad de la reproducción: la edición está bloqueada mientras suena
      // (ADR 0017), así que la canción sigue siendo Letra lista y la secundaria no cambia.
      const cambio = await principal.evaluate(
        (id) =>
          (window as unknown as Api).shinobi.biblioteca
            .marcarLista(id, { modalidad: 'karaoke' })
            .then(() => 'aceptado')
            .catch((e: unknown) => JSON.stringify(e)),
        ID
      )
      expect(cambio).toContain('EDICION_BLOQUEADA')
      expect(leerCancion(datos, ID).modalidad).toBe('letra_lista')
      await secundaria.waitForTimeout(1500)
      // 0.2.2: el bloque de 5 líneas (como mucho 5 en reposo, 6 en un cambio), siempre sin barrido.
      // Se espera a que la secundaria haya pintado el bloque antes de contarlo (un `count()` suelto leía 0).
      await expect(secundaria.locator('[data-linea]').first()).toBeVisible()
      const lineas = await secundaria.locator('[data-linea]').count()
      expect(lineas).toBeGreaterThanOrEqual(1)
      expect(lineas).toBeLessThanOrEqual(6)
      await expect(secundaria.locator('[data-barrido]')).toHaveCount(0)
    } finally {
      await salirSinConfirmar(app)
    }
  })

  test('la misma fase del fondo a 12,3 s en la vista previa del editor y en el reproductor', async () => {
    await conEditor(
      'fase5-fondo',
      async (v) => {
        await abrirEditor(v, TITULO)
        const previa = v.locator('[data-lienzo="previa"] > div')
        const fase0 = await fondoDe(previa)
        await v.getByRole('button', { name: 'Reproducir', exact: true }).click()
        await buscarEnPausa(
          v,
          'Pausar',
          v.getByRole('slider', { name: 'Tiempo de reproducción' }),
          SEGUNDOS
        )
        await expect.poll(() => fondoDe(previa)).not.toBe(fase0)
        const enEditor = await fondoDe(previa)

        await v.getByRole('button', { name: E.botonProbar }).click()
        const capa = v.getByRole('dialog', { name: /Reproductor de/ })
        await expect(capa.getByRole('button', { name: R.tooltip.pausa })).toBeVisible({
          timeout: 15_000
        })
        await capa.getByRole('button', { name: R.tooltip.pausa }).click()
        await capa.getByRole('slider', { name: 'Barra de tiempo' }).fill(String(SEGUNDOS))
        const pantalla = capa.locator('div[aria-hidden="true"][style*="--k-fondo"]').first()
        await expect.poll(() => fondoDe(pantalla)).toBe(enEditor)
      },
      (datos) => {
        const cancion = leerCancion(datos, ID)
        cancion.estilo = ESTILO_CONICO
        writeFileSync(join(datos, 'biblioteca', ID, 'cancion.json'), JSON.stringify(cancion))
      }
    )
  })

  test('movimiento reducido: el fondo queda en la fase 0, con su nota y sin botón de detener', async () => {
    await conEditor(
      'fase5-reducido',
      async (v) => {
        await v.emulateMedia({ reducedMotion: 'reduce' })
        await abrirEditor(v, TITULO)
        const previa = v.locator('[data-lienzo="previa"] > div')
        const fase0 = await fondoDe(previa)
        await v.getByRole('button', { name: 'Reproducir', exact: true }).click()
        await buscarEnPausa(
          v,
          'Pausar',
          v.getByRole('slider', { name: 'Tiempo de reproducción' }),
          SEGUNDOS
        )
        await v.waitForTimeout(500)
        expect(await fondoDe(previa)).toBe(fase0)
        await expect(v.getByRole('button', { name: E.fondoG.detener })).toHaveCount(0)
        await v.getByRole('radio', { name: /^Estilo/ }).click()
        await expect(v.getByText(E.fondoG.reducido)).toBeVisible()

        await v.getByRole('button', { name: E.botonProbar }).click()
        const capa = v.getByRole('dialog', { name: /Reproductor de/ })
        await expect(capa.getByRole('button', { name: R.tooltip.pausa })).toBeVisible({
          timeout: 15_000
        })
        await capa.getByRole('button', { name: R.tooltip.pausa }).click()
        await capa.getByRole('slider', { name: 'Barra de tiempo' }).fill(String(SEGUNDOS))
        await v.waitForTimeout(500)
        const pantalla = capa.locator('div[aria-hidden="true"][style*="--k-fondo"]').first()
        expect(await fondoDe(pantalla)).toBe(fase0)
      },
      (datos) => {
        const cancion = leerCancion(datos, ID)
        cancion.estilo = ESTILO_CONICO
        writeFileSync(join(datos, 'biblioteca', ID, 'cancion.json'), JSON.stringify(cancion))
      }
    )
  })
})
