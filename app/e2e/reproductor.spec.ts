import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { _electron as electron, expect, test, type Locator } from '@playwright/test'
import { join } from 'node:path'
import { sembrar } from '../src/main/biblioteca/semilla'
import { E } from '../src/renderer/src/vistas/editor/textos'
import { R } from '../src/renderer/src/vistas/reproductor/textos'
import { crearTemporal } from './temporales'
import { leerCancion, tarjeta } from './fixtures/separacion'

const lista = 'Reproductor: lista'
const incompleta = 'Reproductor: lista incompleta'
const idSemilla = (n: number): string => `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`
const leerConfig = (datos: string) =>
  JSON.parse(readFileSync(join(datos, 'config.json'), 'utf8')) as {
    reproductor: { volumen: number; voz_guia: number; voz_guia_silenciada: boolean }
  }

async function iniciar(
  nombre: string,
  simularPantallaCompleta = true,
  preparar?: (datos: string) => void
) {
  const datos = crearTemporal(nombre)
  await sembrar(datos)
  preparar?.(datos)
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHINOBI_DATOS: datos,
      SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
      SHINOBI_SILENCIAR_AUDIO: '1',
      SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1',
      SHINOBI_PANTALLA_COMPLETA_SIMULADA: simularPantallaCompleta ? '1' : ''
    }
  })
  const ventana = await app.firstWindow()
  await expect(ventana.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
  return { app, datos, ventana }
}

async function medirPintura(barrido: Locator) {
  return barrido.evaluate((elemento) => {
    const capa = elemento.lastElementChild as HTMLElement
    const rango = document.createRange()
    rango.selectNodeContents(elemento.firstChild!)
    const origen = capa.getBoundingClientRect()
    const rectangulos = Array.from(rango.getClientRects()).filter(({ width }) => width > 0)
    const vertices = Array.from(
      capa.style.clipPath.matchAll(/(-?[\d.]+)px (-?[\d.]+)px/g),
      ([, x, y]) => ({ x: Number(x), y: Number(y) })
    )
    const pintados = rectangulos.map((renglon, i) => {
      const izquierda = vertices[i * 6]
      const derecha = vertices[i * 6 + 1]
      if (!izquierda || !derecha) return 'vacío'
      if (
        Math.abs(izquierda.x - (renglon.left - origen.left)) > 1 ||
        Math.abs(izquierda.y - (renglon.top - origen.top)) > 1
      ) {
        return 'fuera'
      }
      const pintado = derecha.x - izquierda.x
      if (pintado <= 0 || pintado > renglon.width + 1) return 'fuera'
      return Math.abs(pintado - renglon.width) < 1 ? 'lleno' : 'parcial'
    })
    return { anchos: rectangulos.map(({ width }) => width), pintados }
  })
}

test.describe('reproductor sin red', () => {
  test.describe.configure({ timeout: 60_000 })

  test('una línea partida se pinta por renglón incluso al redimensionar', async () => {
    const { app, ventana } = await iniciar('reproductor-barrido', true, (datos) => {
      const id = idSemilla(20)
      const cancion = leerCancion(datos, id)
      cancion.letra.lineas = [
        {
          ...cancion.letra.lineas[0],
          texto: 'La luz de las estrellas cruza el cielo y pinta de plata las orillas del río',
          inicio_ms: 0,
          fin_ms: 24_000
        }
      ]
      writeFileSync(join(datos, 'biblioteca', id, 'cancion.json'), JSON.stringify(cancion))
    })
    try {
      const redimensionar = (ancho: number) =>
        app.evaluate(({ BrowserWindow }, width) => {
          const principal = BrowserWindow.getAllWindows()[0]!
          principal.unmaximize()
          principal.setMinimumSize(600, 500)
          principal.setContentSize(width, 560)
        }, ancho)

      await ventana.emulateMedia({ reducedMotion: 'reduce' })
      await redimensionar(700)
      await ventana.getByRole('searchbox', { name: 'Buscar título o artista' }).fill(lista)
      await tarjeta(ventana, lista)
        .getByRole('button', { name: /^Reproducir/ })
        .click()
      const capa = ventana.getByRole('dialog', { name: `Reproductor de «${lista}»` })
      const barrido = capa.locator('[data-barrido]')
      await expect(barrido).toBeVisible({ timeout: 12_000 })
      await ventana.evaluate(() => document.fonts.ready.then(() => undefined))
      const area = await capa.boundingBox()
      if (!area) throw new Error('No se pudo medir el reproductor')
      await ventana.mouse.move(area.x + area.width / 2, area.y + area.height * 0.95)
      const barra = capa.getByRole('slider', { name: 'Barra de tiempo' })
      const inicial = await medirPintura(barrido)
      expect(inicial.anchos.length).toBeGreaterThanOrEqual(2)
      const total = inicial.anchos.reduce((suma, ancho) => suma + ancho, 0)
      const buscarAncho = (ancho: number) =>
        barra.fill(String(Math.round((24_000 * ancho) / total)))

      await buscarAncho(inicial.anchos[0]! / 2)
      await expect
        .poll(async () => (await medirPintura(barrido)).pintados.slice(0, 2))
        .toEqual(['parcial', 'vacío'])
      await buscarAncho(inicial.anchos[0]! + inicial.anchos[1]! / 2)
      await expect
        .poll(async () => (await medirPintura(barrido)).pintados.slice(0, 2))
        .toEqual(['lleno', 'parcial'])

      await buscarAncho(inicial.anchos[0]! / 2)
      await expect(capa.getByRole('button', { name: R.tooltip.pausa })).toBeVisible()
      await redimensionar(830)
      await expect
        .poll(async () => (await medirPintura(barrido)).anchos)
        .not.toEqual(inicial.anchos)
      await expect
        .poll(async () => (await medirPintura(barrido)).pintados.slice(0, 2))
        .toEqual(['parcial', 'vacío'])
    } finally {
      await app.close()
    }
  })

  test('Biblioteca: controles, atajos, búsqueda y foco al salir', async () => {
    const { app, datos, ventana } = await iniciar('reproductor-biblioteca')
    try {
      const buscador = ventana.getByRole('searchbox', { name: 'Buscar título o artista' })
      await buscador.fill('Reproductor: lista')
      const cancion = tarjeta(ventana, lista)
      await cancion.getByRole('button', { name: /^Reproducir/ }).click()

      const capa = ventana.getByRole('dialog', { name: `Reproductor de «${lista}»` })
      await expect(capa).toBeVisible()
      await expect(capa).toHaveAttribute('data-pantalla-completa', 'true')
      await expect(capa.getByText('Primera luz sobre el tejado')).toBeVisible({ timeout: 10_000 })

      await ventana.keyboard.press('Space')
      await expect(capa.getByText(R.pausa, { exact: true }).first()).toBeVisible()
      await ventana.keyboard.press('ArrowRight')
      await expect(capa.getByText('+5 s')).toBeVisible()
      await ventana.keyboard.press('ArrowDown')
      await expect(capa.getByText('Volumen 70 %', { exact: true }).first()).toBeVisible()
      await expect.poll(() => leerConfig(datos).reproductor.volumen).toBe(0.7)
      await ventana.keyboard.press('m')
      await expect(capa.getByText('Silenciado', { exact: true }).first()).toBeVisible()
      await ventana.keyboard.press('v')
      await expect(capa.getByText('Voz 30 %', { exact: true }).first()).toBeVisible()
      await ventana.keyboard.press('Shift+ArrowDown')
      await expect(capa.getByText('Voz 20 %', { exact: true }).first()).toBeVisible()
      await expect.poll(() => leerConfig(datos).reproductor.voz_guia).toBe(0.2)
      await expect.poll(() => leerConfig(datos).reproductor.voz_guia_silenciada).toBe(false)
      await ventana.keyboard.press('F')
      await expect(capa).toHaveAttribute('data-pantalla-completa', 'false')
      await ventana.keyboard.press('F')
      await expect(capa).toHaveAttribute('data-pantalla-completa', 'true')
      await ventana.keyboard.press('F1')
      await expect(ventana.getByRole('dialog', { name: E.atajos })).toBeVisible()
      await ventana.keyboard.press('Escape')
      await expect(ventana.getByRole('dialog', { name: E.atajos })).toHaveCount(0)
      await ventana.keyboard.press('ControlOrMeta+n')
      await expect(capa).toBeVisible()
      await ventana.keyboard.press('Escape')
      await expect(capa).toHaveCount(0)
      await expect(buscador).toHaveValue(lista)
      await expect(cancion).toBeFocused()
      await cancion.getByRole('button', { name: /^Reproducir/ }).click()
      const reabierto = ventana.getByRole('dialog', { name: `Reproductor de «${lista}»` })
      await expect(reabierto.getByRole('slider', { name: R.aria.volumen })).toHaveValue('0.7')
      await expect(reabierto.getByRole('slider', { name: R.aria.vozguia })).toHaveValue('0.2')
      await ventana.keyboard.press('Escape')
    } finally {
      await app.close()
    }
  })

  test('Biblioteca: aviso de letra incompleta', async () => {
    const { app, ventana } = await iniciar('reproductor-incompleta')
    try {
      await ventana.getByRole('searchbox', { name: 'Buscar título o artista' }).fill(incompleta)
      await tarjeta(ventana, incompleta)
        .getByRole('button', { name: /^Reproducir/ })
        .click()
      const capa = ventana.getByRole('dialog', { name: `Reproductor de «${incompleta}»` })
      await expect(capa.getByText(R.incompleta(1), { exact: true }).first()).toBeVisible()
    } finally {
      await app.close()
    }
  })

  test('Biblioteca: los controles se ocultan y vuelven con el ratón', async () => {
    const { app, ventana } = await iniciar('reproductor-controles')
    try {
      await ventana.getByRole('searchbox', { name: 'Buscar título o artista' }).fill(lista)
      await tarjeta(ventana, lista)
        .getByRole('button', { name: /^Reproducir/ })
        .click()
      const capa = ventana.getByRole('dialog', { name: `Reproductor de «${lista}»` })
      const inferior = capa.locator('[data-franja="inferior"]')
      await expect(inferior).toBeVisible()
      await expect(capa.getByRole('button', { name: R.tooltip.pausa })).toBeVisible({
        timeout: 10_000
      })
      // El clic de la Biblioteca puede dejar el puntero sobre una franja en Xvfb.
      const area = await capa.boundingBox()
      if (!area) throw new Error('No se pudo medir el reproductor')
      await ventana.mouse.move(area.x + area.width / 2, area.y + area.height * 0.3)
      await expect(inferior).toHaveAttribute('aria-hidden', 'true', { timeout: 10_000 })
      await ventana.mouse.move(500, 300)
      await expect(inferior).not.toHaveAttribute('aria-hidden', 'true')
    } finally {
      await app.close()
    }
  })

  test('Biblioteca: la pantalla final se detiene con actividad y permite volver', async () => {
    const { app, ventana } = await iniciar('reproductor-final')
    try {
      await ventana.getByRole('searchbox', { name: 'Buscar título o artista' }).fill(lista)
      await tarjeta(ventana, lista)
        .getByRole('button', { name: /^Reproducir/ })
        .click()
      const capa = ventana.getByRole('dialog', { name: `Reproductor de «${lista}»` })
      await expect(capa).toBeVisible()
      await expect(capa.getByText('Primera luz sobre el tejado')).toBeVisible({ timeout: 10_000 })
      await capa.getByRole('slider', { name: 'Barra de tiempo' }).fill('29000')
      await expect(capa.getByRole('button', { name: R.otravez })).toBeVisible({ timeout: 10_000 })
      await expect(capa.getByRole('button', { name: R.volver.biblioteca })).toBeFocused()
      await ventana.keyboard.press('Escape')
      await expect(capa).toHaveCount(0)
    } finally {
      await app.close()
    }
  })

  test('Biblioteca: la pantalla final vuelve sola al terminar la cuenta atrás', async () => {
    const { app, ventana } = await iniciar('reproductor-final-auto')
    try {
      await ventana.getByRole('searchbox', { name: 'Buscar título o artista' }).fill(lista)
      await tarjeta(ventana, lista)
        .getByRole('button', { name: /^Reproducir/ })
        .click()
      const capa = ventana.getByRole('dialog', { name: `Reproductor de «${lista}»` })
      await expect(capa.getByText('Primera luz sobre el tejado')).toBeVisible({ timeout: 10_000 })
      // Apartar el puntero antes de llegar al final evita actividad al cambiar la pantalla.
      const area = await capa.boundingBox()
      if (!area) throw new Error('No se pudo medir el reproductor')
      await ventana.mouse.move(area.x + area.width / 2, area.y + area.height * 0.3)
      await capa.getByRole('slider', { name: 'Barra de tiempo' }).fill('29000')
      await expect(capa.getByRole('button', { name: R.otravez })).toBeVisible({ timeout: 5_000 })
      await expect(capa.getByText(/^Se cerrará en \d+ s…$/)).toBeVisible()
      await expect(capa).toHaveCount(0, { timeout: 12_000 })
    } finally {
      await app.close()
    }
  })

  test('Biblioteca: pista instrumental ausente muestra el error y actualiza la tarjeta', async () => {
    const { app, datos, ventana } = await iniciar('reproductor-pista-ausente')
    try {
      unlinkSync(join(datos, 'biblioteca', idSemilla(20), 'pistas', 'instrumental.flac'))
      await ventana.getByRole('searchbox', { name: 'Buscar título o artista' }).fill(lista)
      const cancion = tarjeta(ventana, lista)
      await cancion.getByRole('button', { name: /^Reproducir/ }).click()
      const capa = ventana.getByRole('dialog', { name: `Reproductor de «${lista}»` })
      await expect(capa.getByText(R.error.titulo)).toBeVisible()
      await expect(capa.getByText(R.error.pistas)).toBeVisible()
      await capa.getByRole('button', { name: R.volver.biblioteca }).click()
      await expect(capa).toHaveCount(0)
      await expect(cancion).toContainText('Dañada')
      await expect(cancion).toContainText('Faltan las pistas separadas')
    } finally {
      await app.close()
    }
  })

  test('Biblioteca: la voz ausente no interrumpe el instrumental y daña la tarjeta', async () => {
    const { app, datos, ventana } = await iniciar('reproductor-voz-ausente')
    try {
      unlinkSync(join(datos, 'biblioteca', idSemilla(20), 'pistas', 'voz.flac'))
      await ventana.getByRole('searchbox', { name: 'Buscar título o artista' }).fill(lista)
      const cancion = tarjeta(ventana, lista)
      await cancion.getByRole('button', { name: /^Reproducir/ }).click()
      const capa = ventana.getByRole('dialog', { name: `Reproductor de «${lista}»` })
      await expect(capa.getByText('Primera luz sobre el tejado')).toBeVisible({ timeout: 10_000 })
      await expect(capa.getByRole('slider', { name: R.aria.vozguia })).toHaveAttribute(
        'aria-disabled',
        'true'
      )
      await ventana.keyboard.press('Escape')
      await expect(capa).toHaveCount(0)
      await expect(cancion).toContainText('Dañada')
    } finally {
      await app.close()
    }
  })

  test('toast de «lista para cantar» abre el reproductor y cierra el toast', async () => {
    const { app, ventana } = await iniciar('reproductor-toast')
    try {
      await ventana.getByRole('searchbox', { name: 'Buscar título o artista' }).fill(lista)
      const cancion = tarjeta(ventana, lista)
      await cancion.getByRole('button', { name: `Más acciones de «${lista}»` }).click()
      await ventana.getByRole('menuitem', { name: 'Volver a borrador' }).click()
      const confirmar = ventana.getByRole('dialog', { name: /¿Volver a borrador\?/ })
      await confirmar.getByRole('button', { name: 'Volver a borrador' }).click()
      await expect(cancion.getByRole('button', { name: /^Continuar/ })).toBeVisible()
      await cancion.getByRole('button', { name: /^Continuar/ }).click()
      await expect(ventana.getByRole('heading', { level: 1, name: 'Editor' })).toBeAttached()
      await ventana.getByRole('button', { name: E.marcarLista }).click()
      await expect(ventana.getByText(`«${lista}» está lista para cantar.`)).toBeVisible()
      const toast = ventana.locator('[data-testid="toast"]')
      await toast.getByRole('button', { name: 'Reproducir' }).click()
      await expect(toast).toHaveCount(0)
      await expect(ventana.getByRole('dialog', { name: `Reproductor de «${lista}»` })).toBeVisible()
    } finally {
      await app.close()
    }
  })

  test('pantalla completa real restaura la ventana al salir', async () => {
    test.skip(process.platform === 'linux', 'Xvfb sin gestor de ventanas')
    const { app, ventana } = await iniciar('reproductor-pantalla-real', false)
    try {
      await ventana.getByRole('searchbox', { name: 'Buscar título o artista' }).fill(lista)
      await tarjeta(ventana, lista)
        .getByRole('button', { name: /^Reproducir/ })
        .click()
      const capa = ventana.getByRole('dialog', { name: `Reproductor de «${lista}»` })
      await expect(capa).toBeVisible()
      await expect
        .poll(() =>
          app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isFullScreen())
        )
        .toBe(true)
      await ventana.keyboard.press('Escape')
      await expect(capa).toHaveCount(0)
      await expect
        .poll(() =>
          app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isFullScreen())
        )
        .toBe(false)
    } finally {
      await app.close()
    }
  })

  test('editor: prueba original, desplazamiento, salida y deshacer', async () => {
    const { app, datos, ventana } = await iniciar('reproductor-editor')
    try {
      await ventana
        .getByRole('searchbox', { name: 'Buscar título o artista' })
        .fill('Editor: separación interrumpida')
      const cancion = tarjeta(ventana, 'Editor: separación interrumpida')
      const continuar = cancion.getByRole('button', { name: /^Continuar/ })
      if (await continuar.count()) {
        await continuar.click()
      } else {
        await cancion
          .getByRole('button', { name: `Más acciones de «Editor: separación interrumpida»` })
          .click()
        await ventana.getByRole('menuitem', { name: 'Continuar' }).click()
      }
      await expect(ventana.getByRole('heading', { level: 1, name: 'Editor' })).toBeAttached()
      const probar = ventana.getByRole('button', { name: E.botonProbar })
      await expect(probar).toBeEnabled({ timeout: 20_000 })
      await probar.click()
      const capa = ventana.getByRole('dialog', { name: /Reproductor de/ })
      await expect(capa.getByText(R.original)).toBeVisible()
      await expect(capa.getByRole('slider', { name: R.aria.vozguia })).toHaveCount(0)
      await ventana.keyboard.press('.')
      await ventana.keyboard.press('.')
      await expect(capa.getByText(R.offset(200))).toBeVisible()
      await ventana.keyboard.press('Escape')
      await expect(ventana.getByRole('heading', { level: 1, name: 'Editor' })).toBeVisible()
      await expect(probar).toBeFocused()
      await expect
        .poll(() => {
          const ruta = join(datos, 'biblioteca', idSemilla(18), 'cancion.json')
          return JSON.parse(readFileSync(ruta, 'utf8')).letra.offset_ms as number
        })
        .toBe(200)
      await ventana.keyboard.press('ControlOrMeta+z')
      await expect
        .poll(() => {
          const ruta = join(datos, 'biblioteca', idSemilla(18), 'cancion.json')
          return JSON.parse(readFileSync(ruta, 'utf8')).letra.offset_ms as number
        })
        .toBe(0)
    } finally {
      await app.close()
    }
  })
})
