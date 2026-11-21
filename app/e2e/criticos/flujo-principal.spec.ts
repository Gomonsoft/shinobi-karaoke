import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'
import { E } from '../../src/renderer/src/vistas/editor/textos'
import { R } from '../../src/renderer/src/vistas/reproductor/textos'
import { TEXTO } from '../../src/renderer/src/vistas/letra/textos'
import { TEXTO_PEGAR } from '../../src/renderer/src/vistas/letra/textosPegar'
import {
  cerrar,
  filaPreparar,
  filaSeparar,
  idDe,
  importar,
  lanzar,
  leerCancion,
  preparar,
  tarjeta,
  volverABiblioteca
} from '../fixtures/separacion'

/**
 * Suite crítica (docs/pruebas.md, nivel 1): el flujo principal de punta a punta y sin red.
 * Inicio → Biblioteca → Añadir canción (archivo) → Letra (pegar) → Editor (sincronizar y marcar
 * como lista) → Reproductor. Runtime y separador falsos (ADR 0009 §8), WAV generado, letra
 * inventada, LRCLIB en un puerto cerrado y audio silenciado. Sin aserciones de píxeles.
 */

const TITULO = 'Tema del flujo crítico'
const LETRA = ['Primera línea inventada', 'Segunda línea inventada', 'Tercera línea inventada']

/**
 * Sin scroll de página: un elemento «solo lector» sin `top/left`, un margen o un desbordamiento
 * añaden píxeles al documento (regresión de las fases 4 y 6). Cuesta una evaluación.
 */
async function sinScrollDePagina(v: Page, donde: string): Promise<void> {
  const m = await v.evaluate(() => ({
    alto: document.documentElement.scrollHeight,
    ventana: window.innerHeight,
    ancho: document.documentElement.scrollWidth,
    anchoVentana: window.innerWidth
  }))
  expect(m.alto, `${donde}: scrollHeight ${m.alto} > innerHeight ${m.ventana}`).toBeLessThanOrEqual(
    m.ventana
  )
  expect(
    m.ancho,
    `${donde}: scrollWidth ${m.ancho} > innerWidth ${m.anchoVentana}`
  ).toBeLessThanOrEqual(m.anchoVentana)
}

test.describe('flujo principal', { tag: '@critico' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('añadir un archivo, pegar la letra, sincronizar, marcar como lista y cantar', async () => {
    const env = preparar('critico-flujo', { segundos: 2, pasos: 4 })
    const app = await lanzar(env, {
      SHINOBI_SILENCIAR_AUDIO: '1',
      SHINOBI_PANTALLA_COMPLETA_SIMULADA: '1',
      SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1'
    })
    try {
      const v = await app.firstWindow()
      const errores: string[] = []
      v.on('pageerror', (e) => errores.push(e.message))
      v.on('console', (m: ConsoleMessage) => m.type() === 'error' && errores.push(m.text()))

      // Inicio → Biblioteca vacía.
      await expect(
        v.getByRole('heading', { level: 1, name: 'Tu biblioteca está vacía' })
      ).toBeVisible()
      await sinScrollDePagina(v, 'Biblioteca')

      // Añadir canción desde un archivo: preparar el audio y separar (separador falso).
      await importar(v, TITULO)
      await expect(filaPreparar(v)).toContainText('completado', { timeout: 30_000 })
      await expect(filaSeparar(v)).toContainText('completado', { timeout: 30_000 })
      await volverABiblioteca(v)

      // Letra: la búsqueda falla sin red y se pega la letra a mano.
      await tarjeta(v, TITULO)
        .getByRole('button', { name: /^Continuar/ })
        .click()
      await expect(v.getByRole('heading', { level: 1, name: 'Letra' })).toBeVisible()
      await v.getByRole('button', { name: TEXTO.pegar }).click()
      await v
        .getByRole('textbox', { name: TEXTO_PEGAR.etiquetaArea, exact: true })
        .fill(LETRA.join('\n'))
      await expect(v.getByText(TEXTO_PEGAR.contador(LETRA.length))).toBeVisible()
      await v.getByRole('button', { name: TEXTO.usar }).click()
      await expect(
        v.getByText(`Letra actual · pegada · sin sincronizar · ${LETRA.length} líneas`)
      ).toBeVisible()

      // Editor: sincronizar las tres líneas al ritmo y marcar como lista.
      await v.getByRole('button', { name: /^Paso 4, Editor/ }).click()
      await expect(v.getByRole('heading', { level: 1, name: 'Editor' })).toBeAttached()
      const sincronizar = v.getByRole('button', { name: /^Sincronizar al ritmo/ })
      await expect(sincronizar).toBeEnabled({ timeout: 20_000 })
      await sinScrollDePagina(v, 'Editor')
      await sincronizar.click()
      await expect(v.getByRole('heading', { name: E.syncTitulo })).toBeVisible()
      await expect(v.getByRole('button', { name: E.syncMarcar })).toBeEnabled({ timeout: 10_000 })
      for (let i = 0; i < LETRA.length; i++) {
        await v.keyboard.press('Enter')
        await v.waitForTimeout(800)
      }
      await expect(v.getByText(`${LETRA.length}/${LETRA.length} sincronizadas ✓`)).toBeVisible()
      await v.keyboard.press('Escape')
      await expect(v.getByRole('heading', { name: E.syncTitulo })).toHaveCount(0)

      const id = idDe(env.datos, TITULO)
      const inicios = (): (number | null)[] =>
        (leerCancion(env.datos, id).letra.lineas as { tipo: string; inicio_ms: number | null }[])
          .filter((l) => l.tipo === 'linea')
          .map((l) => l.inicio_ms)
      await expect.poll(() => inicios().every((ms) => ms !== null), { timeout: 5000 }).toBe(true)

      await v.getByRole('button', { name: E.marcarLista }).click()
      await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
      await expect(v.getByText(`«${TITULO}» está lista para cantar.`)).toBeVisible()
      await expect.poll(() => leerCancion(env.datos, id).estado).toBe('lista')

      // Reproductor: abre, el tiempo avanza y la primera línea aparece; Esc vuelve a la Biblioteca.
      await tarjeta(v, TITULO)
        .getByRole('button', { name: /^Reproducir/ })
        .click()
      const capa = v.getByRole('dialog', { name: `Reproductor de «${TITULO}»` })
      await expect(capa).toBeVisible()
      await expect(capa.getByText(LETRA[0]!).first()).toBeVisible({ timeout: 10_000 })
      // Saltar cerca del final y dejar que suene hasta la pantalla final: el tiempo avanza solo.
      const area = await capa.boundingBox()
      if (!area) throw new Error('No se pudo medir el reproductor')
      await v.mouse.move(area.x + area.width / 2, area.y + area.height / 2)
      await capa.getByRole('slider', { name: 'Barra de tiempo' }).fill('13000')
      await expect(capa.getByRole('button', { name: R.otravez })).toBeVisible({ timeout: 10_000 })
      await v.keyboard.press('Escape')
      await expect(capa).toHaveCount(0)
      await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()

      expect(errores).toEqual([])
    } finally {
      await cerrar(app)
    }
  })
})
