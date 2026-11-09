import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { sembrar } from '../src/main/biblioteca/semilla'
import { E } from '../src/renderer/src/vistas/editor/textos'
import { abrirEditor, alargarLetra, conEditor, idSemilla, lanzar } from './fixtures/editor'
import { leerCancion, leerConfig, tarjeta } from './fixtures/separacion'
import { crearTemporal } from './temporales'

/**
 * Layout del editor a alto completo (subfase 2.1, tareas 0157 y 0158). Ninguna comprobación espera
 * a la forma de onda: los altos no dependen de que haya picos.
 */

const T19 = 'Editor: lista incompleta'
const ID19 = idSemilla(19)

/** Matriz de la spec: viewport CSS y densidad con la que se lanza. */
const VIEWPORTS = [
  { nombre: '1280x720', ancho: 1280, alto: 720, dpr: 1 },
  { nombre: '1024x576', ancho: 1024, alto: 576, dpr: 1.25 },
  { nombre: '1720x1440', ancho: 1720, alto: 1440, dpr: 1 },
  { nombre: '1376x1152', ancho: 1376, alto: 1152, dpr: 1.25 },
  { nombre: '1920x1080', ancho: 1920, alto: 1080, dpr: 1 },
  { nombre: '1536x864', ancho: 1536, alto: 864, dpr: 1.25 }
] as const

/**
 * Con densidad 1,25 Windows redondea el contenido de la ventana (hasta ~4 px de más). Se acepta esa
 * holgura: las comprobaciones usan siempre el `innerWidth`/`innerHeight` real.
 */
const admite = (real: number[], ancho: number, alto: number) =>
  real[0]! >= ancho && real[0]! - ancho <= 4 && real[1]! >= alto && real[1]! - alto <= 4

async function ajustarVentana(app: ElectronApplication, v: Page, ancho: number, alto: number) {
  await app.evaluate(
    ({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0]!.setContentSize(w!, h!),
    [ancho, alto]
  )
  await v.waitForTimeout(400)
  return v.evaluate(() => [window.innerWidth, window.innerHeight])
}

/**
 * Comprueba al empezar `devicePixelRatio`, `innerWidth` e `innerHeight`. Si el sistema operativo no
 * concede el viewport, deja una anotación y omite el caso (no lo da por bueno).
 */
async function exigirViewport(
  app: ElectronApplication,
  v: Page,
  vp: { nombre: string; ancho: number; alto: number; dpr: number }
): Promise<{ ancho: number; alto: number }> {
  const [w, h] = await ajustarVentana(app, v, vp.ancho, vp.alto)
  const dpr = await v.evaluate(() => window.devicePixelRatio)
  const ok = admite([w!, h!], vp.ancho, vp.alto) && Math.abs(dpr - vp.dpr) < 0.01
  if (!ok) {
    test.info().annotations.push({
      type: 'viewport omitido',
      description: `${vp.nombre} (dpr ${vp.dpr}): el sistema entregó ${w} × ${h} con dpr ${dpr}`
    })
  }
  test.skip(!ok, `la pantalla no concede ${vp.nombre} con dpr ${vp.dpr}`)
  return { ancho: w!, alto: h! }
}

interface Medidas {
  vp: { ancho: number; alto: number; scrollAncho: number; scrollAlto: number }
  fuera: string[]
  cabecera: { alto: number }
  zona: { alto: number }
  tituloLista: boolean
  filaLista: boolean
  corregir: boolean
  lienzo: { ancho: number; alto: number; izq: number; der: number; arriba: number; abajo: number }
  probar: { arriba: number; ancho: number }
  dock: { arriba: number; abajo: number }
  filas: { fila1: number[]; fila2: number[]; barra: number }
  controlesLinea: number[]
  paginaScroll: number
}

const medir = (v: Page): Promise<Medidas> =>
  v.evaluate(
    ({ transporte, linea }) => {
      const r = (el: Element) => el.getBoundingClientRect()
      const main = document.querySelector('main')!
      const dentro = (el: Element) => {
        const c = r(el)
        return (
          c.width === 0 ||
          (c.left >= -0.5 &&
            c.top >= -0.5 &&
            c.right <= window.innerWidth + 0.5 &&
            c.bottom <= window.innerHeight + 0.5)
        )
      }
      const cabecera = main.querySelector('header[role=banner]')!
      const cuerpo = main.querySelector('[data-divisor="lista"]')!.parentElement!
      const previa = main.querySelector('section[aria-label="Vista previa"]')!
      const pantalla = main.querySelector('[data-lienzo]')!
      const probar = [...previa.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Probar')
      )!
      const reg = document.querySelector(`section[aria-label="${transporte}"]`)!
      const dock = reg.parentElement!.parentElement!
      const filasT = [...reg.children] as HTMLElement[]
      const tops = (fila: HTMLElement) =>
        [...fila.querySelectorAll('button, input, [role=radio], [role=slider]')]
          .filter((e) => r(e).width > 0)
          .map((e) => Math.round(r(e).top + r(e).height / 2))
      const tl = document.querySelector(`section[aria-label="${linea}"]`)
      const ctrl = tl?.firstElementChild
      const criticos = [
        cabecera,
        cuerpo,
        previa,
        pantalla,
        probar,
        reg,
        dock,
        ...(tl ? [tl] : []),
        ...reg.querySelectorAll('button'),
        ...(ctrl ? ctrl.querySelectorAll('button') : [])
      ]
      const lista = main.querySelector('[role=listbox]')?.closest('section')
      const cp = getComputedStyle(previa)
      const huecoArriba = r(previa).top + parseFloat(cp.paddingTop)
      const huecoAbajo = r(previa).bottom - parseFloat(cp.paddingBottom)
      const lienzo = r(pantalla)
      const visibleEn = (el: Element | null | undefined, zona: Element | null | undefined) => {
        if (!el || !zona) return false
        const a = r(el)
        const z = r(zona)
        return a.width > 0 && a.top >= z.top - 0.5 && a.bottom <= z.bottom + 0.5
      }
      const zonaLista = lista ?? null
      return {
        vp: {
          ancho: window.innerWidth,
          alto: window.innerHeight,
          scrollAncho: document.documentElement.scrollWidth,
          scrollAlto: document.documentElement.scrollHeight
        },
        fuera: criticos.filter((e) => !dentro(e)).map((e) => e.outerHTML.slice(0, 80)),
        cabecera: { alto: r(cabecera).height },
        zona: { alto: r(cuerpo).height },
        tituloLista: visibleEn(zonaLista?.querySelector('h2'), cuerpo),
        filaLista: [...(zonaLista?.querySelectorAll('[role=option]') ?? [])].some((o) =>
          visibleEn(o, zonaLista?.querySelector('[role=listbox]')?.parentElement)
        ),
        corregir: visibleEn(zonaLista?.querySelector(':scope > button:last-child'), cuerpo),
        lienzo: {
          ancho: lienzo.width,
          alto: lienzo.height,
          izq: lienzo.left - r(previa).left,
          der: r(previa).right - lienzo.right,
          arriba: lienzo.top - huecoArriba,
          abajo: huecoAbajo - lienzo.bottom
        },
        probar: { arriba: r(probar).top - lienzo.bottom, ancho: r(probar).width },
        dock: { arriba: r(dock).top, abajo: r(dock).bottom },
        filas: {
          fila1: filasT[0] ? tops(filasT[0]) : [],
          fila2: filasT[1] ? tops(filasT[1]) : [],
          barra: Math.round(
            r(reg.querySelector('input[aria-label="Tiempo de reproducción"]')!).width
          )
        },
        controlesLinea: ctrl
          ? [...ctrl.querySelectorAll('button')].map((b) => Math.round(r(b).top + r(b).height / 2))
          : [],
        paginaScroll: main.scrollHeight - main.clientHeight
      }
    },
    { transporte: 'Reproducción', linea: E.timeline.titulo }
  )

function comprobarLayout(m: Medidas, contexto: string, pestana: 'sincronia' | 'estilo') {
  expect(m.vp.scrollAlto, `${contexto}: scroll vertical`).toBeLessThanOrEqual(m.vp.alto)
  expect(m.vp.scrollAncho, `${contexto}: scroll horizontal`).toBeLessThanOrEqual(m.vp.ancho)
  expect(m.paginaScroll, `${contexto}: scroll de main`).toBeLessThanOrEqual(0)
  expect(m.fuera, `${contexto}: elementos fuera del viewport`).toEqual([])
  expect(m.cabecera.alto, `${contexto}: cabecera`).toBe(m.vp.alto < 800 ? 48 : 80)
  expect(Math.abs(m.lienzo.ancho / m.lienzo.alto - 16 / 9) * m.lienzo.alto, contexto).toBeLessThan(
    1.5
  )
  expect(Math.abs(m.lienzo.izq - m.lienzo.der), `${contexto}: centrado horizontal`).toBeLessThan(
    1.5
  )
  expect(Math.abs(m.lienzo.arriba - m.lienzo.abajo), `${contexto}: centrado vertical`).toBeLessThan(
    1.5
  )
  expect(m.probar.arriba, `${contexto}: botón bajo el lienzo`).toBeGreaterThanOrEqual(0)
  expect(m.probar.arriba, `${contexto}: botón justo debajo`).toBeLessThan(16)
  expect(m.zona.alto, `${contexto}: zona superior`).toBeGreaterThanOrEqual(136)
  if (m.vp.alto <= 720) {
    expect(m.tituloLista, `${contexto}: título de la lista`).toBe(true)
    expect(m.filaLista, `${contexto}: una fila de la lista`).toBe(true)
    expect(m.corregir, `${contexto}: pie de la lista`).toBe(true)
  }
  expect(new Set(m.filas.fila1).size, `${contexto}: fila 1 del transporte`).toBe(1)
  expect(new Set(m.filas.fila2).size, `${contexto}: fila 2 del transporte`).toBe(1)
  expect(m.filas.fila1[0]).not.toBe(m.filas.fila2[0])
  expect(m.filas.barra, `${contexto}: barra de tiempo`).toBeGreaterThanOrEqual(240)
  if (pestana === 'sincronia') {
    expect(new Set(m.controlesLinea).size, `${contexto}: controles de la línea de tiempo`).toBe(1)
  }
}

test.describe('layout del editor a alto completo', () => {
  test.describe.configure({ timeout: 90_000 })

  for (const vp of VIEWPORTS) {
    test(`no hay scroll de página y la previa queda centrada en ${vp.nombre}`, async () => {
      await conEditor(
        `layout-${vp.nombre}`,
        async (v, _datos, app) => {
          await exigirViewport(app, v, vp)
          await abrirEditor(v, T19)
          comprobarLayout(await medir(v), `${vp.nombre} sincronía en pausa`, 'sincronia')

          await v.getByRole('button', { name: 'Reproducir', exact: true }).click()
          await v.waitForTimeout(5000)
          comprobarLayout(await medir(v), `${vp.nombre} sincronía reproduciendo`, 'sincronia')
          await v.getByRole('button', { name: 'Pausar', exact: true }).click()

          await v.getByRole('radio', { name: 'Estilo' }).click()
          await expect(v.getByRole('region', { name: E.timeline.titulo })).toHaveCount(0)
          comprobarLayout(await medir(v), `${vp.nombre} estilo`, 'estilo')
          await v.getByRole('radio', { name: 'Sincronía' }).click()

          // Crecer y encoger la ventana.
          await ajustarVentana(app, v, vp.ancho + 160, vp.alto + 90)
          comprobarLayout(await medir(v), `${vp.nombre} tras crecer`, 'sincronia')
          await ajustarVentana(app, v, vp.ancho, vp.alto)
          comprobarLayout(await medir(v), `${vp.nombre} tras encoger`, 'sincronia')

          // Modo sincronizar: sin scroll de página y la zona superior conserva su mínimo.
          await v.keyboard.press('s')
          await expect(v.getByRole('heading', { name: E.syncTitulo })).toBeVisible()
          const sync = await medir(v)
          expect(sync.vp.scrollAlto, `${vp.nombre} sincronizando`).toBeLessThanOrEqual(sync.vp.alto)
          expect(sync.vp.scrollAncho).toBeLessThanOrEqual(sync.vp.ancho)
          expect(sync.zona.alto).toBeGreaterThanOrEqual(136)
          // La fila minimizada de la línea de tiempo (0160) hace que el dock quepa también bajo 720.
          expect(sync.fuera, `${vp.nombre} sincronizando`).toEqual([])
          expect(
            sync.paginaScroll,
            `${vp.nombre} sincronizando: scroll de main`
          ).toBeLessThanOrEqual(0)
        },
        undefined,
        vp.dpr
      )
    })
  }

  test('con 64 líneas la lista hace scroll y la página no; el banner se desplaza con las filas', async () => {
    await conEditor(
      'layout-64',
      async (v) => {
        await v.setViewportSize({ width: 1280, height: 720 }).catch(() => undefined)
        await abrirEditor(v, T19)
        const r = await v.evaluate(() => {
          const caja = document.querySelector('[role=listbox]')!.parentElement!
          const banner = caja.firstElementChild!
          const antes = banner.getBoundingClientRect().top
          caja.scrollTop = 200
          return {
            lista: caja.scrollHeight > caja.clientHeight,
            pagina: document.documentElement.scrollHeight <= window.innerHeight,
            bannerSeMueve: banner.getBoundingClientRect().top < antes,
            hayBanner: banner.getAttribute('role') !== 'listbox'
          }
        })
        expect(r.lista).toBe(true)
        expect(r.pagina).toBe(true)
        expect(r.hayBanner).toBe(true)
        expect(r.bannerSeMueve).toBe(true)
      },
      (datos) => alargarLetra(datos, ID19, 64)
    )
  })

  test('el modo sincronizar no hace scroll de página y al salir vuelve el estado anterior', async () => {
    await conEditor('layout-sync', async (v, _datos, app) => {
      const [w, h] = await ajustarVentana(app, v, 1280, 720)
      test.skip(w !== 1280 || h !== 720, 'la pantalla no admite 1280 x 720')
      await abrirEditor(v, T19)
      const antes = await medir(v)
      await v.keyboard.press('s')
      await expect(v.getByRole('heading', { name: E.syncTitulo })).toBeVisible()
      const en = await medir(v)
      expect(en.vp.scrollAlto).toBeLessThanOrEqual(en.vp.alto)
      expect(en.zona.alto).toBeGreaterThanOrEqual(136)
      expect(en.fuera).toEqual([])
      await v.keyboard.press('Escape')
      await expect(v.getByRole('heading', { name: E.syncTitulo })).toHaveCount(0)
      const despues = await medir(v)
      expect(despues.zona.alto).toBe(antes.zona.alto)
      expect(despues.dock.arriba).toBe(antes.dock.arriba)
    })
  })

  test('con zoom 150 % se usa la disposición B con solo scroll vertical', async () => {
    await conEditor('layout-zoom', async (v, _datos, app) => {
      const [w, h] = await ajustarVentana(app, v, 1280, 720)
      test.skip(w !== 1280 || h !== 720, 'la pantalla no admite 1280 x 720')
      await abrirEditor(v, T19)
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]!.webContents.setZoomFactor(1.5)
      )
      await v.waitForTimeout(500)
      const r = await v.evaluate(() => ({
        bajo: document.querySelector('[data-bajo-minimo]')?.getAttribute('data-bajo-minimo'),
        ancho: document.documentElement.scrollWidth <= window.innerWidth,
        previaDerecha:
          document.querySelector('section[aria-label="Vista previa"]')!.getBoundingClientRect()
            .left > document.querySelector('[role=listbox]')!.getBoundingClientRect().left
      }))
      expect(r.bajo).toBe('ancho')
      expect(r.ancho).toBe(true)
      expect(r.previaDerecha).toBe(true)
    })
  })

  for (const ancho of [1024, 1280]) {
    test(`el transporte y el desplazamiento no se parten a ${ancho} px`, async () => {
      await conEditor('layout-filas', async (v, _datos, app) => {
        const [w] = await ajustarVentana(app, v, ancho, 720)
        test.skip(w !== ancho, `la pantalla no admite ${ancho}`)
        await abrirEditor(v, T19)
        const m = await medir(v)
        expect(new Set(m.filas.fila1).size).toBe(1)
        expect(new Set(m.filas.fila2).size).toBe(1)
        expect(m.filas.barra).toBeGreaterThanOrEqual(240)
        const grupo = v.getByRole('group', { name: E.offsetTitulo })
        await expect(v.getByText(E.offsetTitulo)).toHaveCount(1)
        await grupo.scrollIntoViewIfNeeded()
        const tops = await grupo.evaluate((g) =>
          [...g.querySelectorAll('button, input')].map((e) =>
            Math.round(e.getBoundingClientRect().top)
          )
        )
        expect(tops).toHaveLength(4)
        expect(new Set(tops).size).toBe(1)
      })
    })
  }
})

// --- Divisores, modos minimizados y persistencia (0159, 0160 y 0161) ---------------------------

const T17 = 'Editor: pista de clics'
const NOMBRE_DIVISOR = {
  lista: E.layout.divisor.lista,
  panel: E.layout.divisor.panel,
  dock: E.layout.divisor.dock
} as const
type NombreDivisor = keyof typeof NOMBRE_DIVISOR

const divisor = (v: Page, nombre: NombreDivisor) =>
  v.getByRole('separator', { name: NOMBRE_DIVISOR[nombre] })
const anuncio = (v: Page) => v.locator('[data-anuncio-layout]')
const botonLayout = (v: Page, nombre: string) => v.locator(`[data-boton-layout="${nombre}"]`)
/** El foco nunca queda en `body`. */
const focoEnBody = (v: Page) => v.evaluate(() => document.activeElement === document.body)

interface Tamanos {
  lista: number
  panel: number
  dock: number
  previa: number
  zona: number
  scrollV: number
  scrollH: number
  scrollMain: number
}

const tamanos = (v: Page): Promise<Tamanos> =>
  v.evaluate(() => {
    const caja = (s: string) => document.querySelector(s)!.getBoundingClientRect()
    const main = document.querySelector('main')!
    return {
      lista: caja('#zona-lista').width,
      panel: caja('#zona-panel').width,
      dock: document.querySelector('#zona-linea-tiempo')?.getBoundingClientRect().height ?? 0,
      previa: caja('section[aria-label="Vista previa"]').width,
      zona: document.querySelector('[data-divisor="lista"]')!.parentElement!.getBoundingClientRect()
        .height,
      scrollV: document.documentElement.scrollHeight - window.innerHeight,
      scrollH: document.documentElement.scrollWidth - window.innerWidth,
      scrollMain: main.scrollHeight - main.clientHeight
    }
  })

/** Arrastra un divisor con el ratón real hasta (x, y) y, por defecto, suelta. */
async function arrastrar(v: Page, nombre: NombreDivisor, x: number, y: number, soltar = true) {
  const caja = (await v.locator(`[data-divisor="${nombre}"]`).boundingBox())!
  await v.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2)
  await v.mouse.down()
  await v.mouse.move(x, y, { steps: 10 })
  if (soltar) await v.mouse.up()
}

const sinScroll = (t: Tamanos, contexto: string) => {
  expect(t.scrollV, `${contexto}: scroll vertical`).toBeLessThanOrEqual(0)
  expect(t.scrollH, `${contexto}: scroll horizontal`).toBeLessThanOrEqual(0)
  expect(t.scrollMain, `${contexto}: scroll de main`).toBeLessThanOrEqual(0)
}

const rutaConfig = (datos: string) => join(datos, 'config.json')
/** Siembra `config.json` antes de lanzar la app (se conserva lo que ya hubiera). */
function sembrarConfig(datos: string, cambio: Record<string, unknown>) {
  const config = existsSync(rutaConfig(datos))
    ? JSON.parse(readFileSync(rutaConfig(datos), 'utf8'))
    : { esquema: 1 }
  writeFileSync(rutaConfig(datos), JSON.stringify({ ...config, ...cambio }))
}

test.describe('divisores accesibles (0159)', () => {
  test.describe.configure({ timeout: 90_000 })

  for (const vp of [
    { nombre: '1280x720', ancho: 1280, alto: 720 },
    { nombre: '1920x1080', ancho: 1920, alto: 1080 }
  ]) {
    test(`arrastrar cada divisor se detiene en los mínimos y máximos efectivos a ${vp.nombre}`, async () => {
      await conEditor(`div-${vp.nombre}`, async (v, datos, app) => {
        const [w, h] = await ajustarVentana(app, v, vp.ancho, vp.alto)
        test.skip(!admite([w!, h!], vp.ancho, vp.alto), `la pantalla no admite ${vp.nombre}`)
        await abrirEditor(v, T19)
        const rutaCancion = join(datos, 'biblioteca', ID19, 'cancion.json')
        const antes = readFileSync(rutaCancion, 'utf8')
        const compacto = h! < 800
        const inicial = await tamanos(v)
        expect(inicial.lista).toBe(300)
        expect(inicial.panel).toBe(360)
        expect(inicial.dock).toBe(compacto ? 204 : 216)

        // Lista.
        await arrastrar(v, 'lista', 1, 300)
        let t = await tamanos(v)
        expect(t.lista).toBe(256)
        sinScroll(t, 'lista mínimo')
        await arrastrar(v, 'lista', w! - 1, 300)
        t = await tamanos(v)
        expect(t.lista).toBe(480)
        expect(t.previa).toBeGreaterThanOrEqual(320)
        await expect(divisor(v, 'lista')).toHaveAttribute('aria-valuenow', '480')
        sinScroll(t, 'lista máximo')

        // Panel.
        await arrastrar(v, 'panel', w! - 1, 300)
        t = await tamanos(v)
        expect(t.panel).toBe(300)
        await arrastrar(v, 'panel', 1, 300)
        t = await tamanos(v)
        expect(t.panel).toBeLessThanOrEqual(480)
        expect(t.panel).toBe(Number(await divisor(v, 'panel').getAttribute('aria-valuemax')))
        expect(t.previa).toBeGreaterThanOrEqual(320)
        sinScroll(t, 'panel máximo')

        // Línea de tiempo (divisor del dock).
        await arrastrar(v, 'dock', 600, h! - 1)
        t = await tamanos(v)
        expect(t.dock).toBe(compacto ? 176 : 188)
        sinScroll(t, 'dock mínimo')
        await arrastrar(v, 'dock', 600, 1)
        t = await tamanos(v)
        expect(t.zona).toBeGreaterThanOrEqual(136)
        expect(t.zona).toBeLessThan(138)
        expect(t.dock).toBe(Number(await divisor(v, 'dock').getAttribute('aria-valuemax')))
        sinScroll(t, 'dock máximo')

        // Redimensionar no escribe la canción.
        expect(readFileSync(rutaCancion, 'utf8')).toBe(antes)
      })
    })
  }

  test('Esc durante el arrastre devuelve el tamaño previo y no sale del editor', async () => {
    await conEditor('div-esc', async (v) => {
      await abrirEditor(v, T19)
      const antes = await tamanos(v)
      await arrastrar(v, 'lista', 450, 300, false)
      expect((await tamanos(v)).lista).toBeGreaterThan(antes.lista + 100)
      await v.keyboard.press('Escape')
      await v.mouse.up()
      expect((await tamanos(v)).lista).toBe(antes.lista)
      await expect(v.getByRole('heading', { level: 1, name: 'Editor' })).toBeAttached()
    })
  })

  test('con el foco en el divisor ↓ no cambia de línea, Espacio reproduce y las flechas cambian 16 px', async () => {
    await conEditor('div-teclado', async (v) => {
      await abrirEditor(v, T19)
      const seleccionada = () =>
        v.getByRole('option', { selected: true }).getAttribute('aria-label')
      const linea = await seleccionada()
      const lista = divisor(v, 'lista')
      await lista.focus()
      await v.keyboard.press('ArrowDown')
      await v.keyboard.press('ArrowUp')
      expect(await seleccionada()).toBe(linea)
      await v.keyboard.press('Space')
      await expect(v.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible()
      await v.keyboard.press('Space')
      await expect(v.getByRole('button', { name: 'Reproducir', exact: true })).toBeVisible()

      await v.keyboard.press('ArrowRight')
      await expect(lista).toHaveAttribute('aria-valuenow', '316')
      await v.keyboard.press('Shift+ArrowRight')
      await expect(lista).toHaveAttribute('aria-valuenow', '380')
      await v.keyboard.press('Home')
      await expect(lista).toHaveAttribute('aria-valuenow', '256')
      await v.keyboard.press('End')
      await expect(lista).toHaveAttribute('aria-valuenow', '480')
      await expect(lista).toHaveAttribute('aria-valuetext', '480 píxeles')
      await expect(lista).toBeFocused()
    })
  })

  test('«Restablecer distribución de paneles» devuelve los valores, lo anuncia una vez y deja el foco en ⋯', async () => {
    await conEditor('div-restablecer', async (v, _datos, app) => {
      const [, h] = await ajustarVentana(app, v, 1280, 720)
      await abrirEditor(v, T19)
      await divisor(v, 'lista').focus()
      await v.keyboard.press('End')
      await divisor(v, 'panel').focus()
      await v.keyboard.press('Home')
      await divisor(v, 'dock').focus()
      await v.keyboard.press('Home')
      await divisor(v, 'panel').focus()
      await v.keyboard.press('Enter')
      await expect(v.getByRole('region', { name: 'Panel, minimizado' })).toBeVisible()
      const menu = v.getByRole('button', { name: 'Más acciones del editor' })
      await menu.click()
      await v.getByRole('menuitem', { name: E.layout.restablecer }).click()
      await expect(anuncio(v)).toHaveText(E.layout.anuncio.restablecida)
      await expect(v.getByRole('region', { name: 'Panel, minimizado' })).toHaveCount(0)
      const t = await tamanos(v)
      expect([t.lista, t.panel, t.dock]).toEqual([300, 360, h! < 800 ? 204 : 216])
      await expect(menu).toBeFocused()
    })
  })
})

test.describe('modos minimizados (0160)', () => {
  test.describe.configure({ timeout: 90_000 })

  test('minimizar y expandir cada zona con su botón y con Intro, anunciándolo una vez y sin perder el foco', async () => {
    await conEditor('min-zonas', async (v) => {
      await abrirEditor(v, T19)
      const zonas = [
        { id: 'lista', divisor: 'lista', nombre: 'Lista de líneas', f: true },
        { id: 'panel', divisor: 'panel', nombre: 'Panel', f: false },
        { id: 'timeline', divisor: 'dock', nombre: 'Línea de tiempo', f: true }
      ] as const
      for (const z of zonas) {
        const separador = divisor(v, z.divisor)
        const minimizada = z.f ? 'minimizada' : 'minimizado'
        // Con el botón: el foco pasa al botón equivalente del otro modo.
        await botonLayout(v, `${z.id}-minimizar`).click()
        await expect(botonLayout(v, `${z.id}-expandir`)).toBeFocused()
        await expect(anuncio(v)).toHaveText(E.layout.anuncio.minimizado(z.nombre, z.f))
        await expect(v.getByRole('region', { name: `${z.nombre}, ${minimizada}` })).toBeVisible()
        await expect(separador).toHaveAttribute('aria-valuetext', E.layout.valorMinimizado(z.f))
        expect(await focoEnBody(v)).toBe(false)
        await botonLayout(v, `${z.id}-expandir`).click()
        await expect(botonLayout(v, `${z.id}-minimizar`)).toBeFocused()
        await expect(anuncio(v)).toHaveText(E.layout.anuncio.expandido(z.nombre, z.f))
        // Con Intro en el divisor: el foco se queda en él.
        await separador.focus()
        await v.keyboard.press('Enter')
        await expect(botonLayout(v, `${z.id}-expandir`)).toBeVisible()
        await expect(separador).toBeFocused()
        await v.keyboard.press('Enter')
        await expect(botonLayout(v, `${z.id}-minimizar`)).toBeVisible()
        await expect(separador).toBeFocused()
        expect(await focoEnBody(v)).toBe(false)
      }
    })
  })

  test('el riel de la lista cambia de línea y el del panel muestra Inicio y Fin de la seleccionada', async () => {
    await conEditor('min-rieles', async (v) => {
      await abrirEditor(v, T19)
      await botonLayout(v, 'lista-minimizar').click()
      await botonLayout(v, 'panel-minimizar').click()
      const riel = v.getByRole('region', { name: 'Lista de líneas, minimizada' })
      const rielPanel = v.getByRole('region', { name: 'Panel, minimizado' })
      expect((await riel.boundingBox())!.width).toBe(72)
      expect((await rielPanel.boundingBox())!.width).toBe(120)
      const linea = riel.getByRole('group')
      const antes = await linea.getAttribute('aria-label')
      await riel.getByRole('button', { name: 'Línea anterior (↑)' }).click()
      expect(await linea.getAttribute('aria-label')).not.toBe(antes)
      await riel.getByRole('button', { name: 'Línea siguiente (↓)' }).click()
      expect(await linea.getAttribute('aria-label')).toBe(antes)
      // La línea 4 de la semilla no tiene inicio: «Fijar fin» sigue inactivo hasta fijar el inicio.
      const fijarFin = rielPanel.getByRole('button', { name: 'Fijar fin aquí (O)' })
      await expect(fijarFin).toHaveAttribute('aria-disabled', 'true')
      // «I» respeta los límites como el atajo: se busca a un instante entre las líneas vecinas.
      const barra = v.getByRole('slider', { name: 'Tiempo de reproducción' })
      await barra.focus()
      await v.keyboard.press('ArrowRight')
      await riel.getByRole('button', { name: 'Fijar inicio aquí (I)' }).click()
      await expect(fijarFin).not.toHaveAttribute('aria-disabled')
      await expect(rielPanel.getByText('automático')).toBeVisible()
    })
  })

  test('la fila minimizada muestra el cabezal avanzando, busca con un clic y conserva el zoom al expandir', async () => {
    await conEditor('min-linea', async (v) => {
      await abrirEditor(v, T19)
      await v.getByRole('button', { name: E.timeline.mas, exact: true }).click()
      await v.getByRole('button', { name: E.timeline.mas, exact: true }).click()
      const intervalo = () =>
        v.getByRole('slider', { name: E.timeline.general }).getAttribute('aria-valuetext')
      const visible = await intervalo()
      await botonLayout(v, 'timeline-minimizar').click()
      const fila = v.getByRole('region', { name: 'Línea de tiempo, minimizada' })
      const compacto = (await v.evaluate(() => window.innerHeight)) < 800
      expect((await fila.boundingBox())!.height).toBe(compacto ? 40 : 44)
      const cabezal = fila.locator('[data-cabezal-general]')
      const posicion = async () =>
        Number.parseFloat((await cabezal.evaluate((e) => (e as HTMLElement).style.left)) || '0')
      await v.getByRole('button', { name: 'Reproducir', exact: true }).click()
      await v.waitForTimeout(1500)
      const enMovimiento = await posicion()
      expect(enMovimiento).toBeGreaterThan(0)
      await v.waitForTimeout(800)
      expect(await posicion()).toBeGreaterThan(enMovimiento)
      await v.getByRole('button', { name: 'Pausar', exact: true }).click()
      // Un clic en el minimapa busca a ese instante.
      const mapa = (await fila.locator('[data-vista-general]').boundingBox())!
      await v.mouse.click(mapa.x + mapa.width * 0.9, mapa.y + mapa.height / 2)
      await expect.poll(posicion).toBeGreaterThan(85)
      await botonLayout(v, 'timeline-expandir').click()
      expect(await intervalo()).toBe(visible)
    })
  })

  test('a 1024 × 500 CSS la línea de tiempo se minimiza sola y vuelve al agrandar, sin tocar la preferencia', async () => {
    await conEditor('min-espacio', async (v, datos, app) => {
      await ajustarVentana(app, v, 1280, 625)
      await abrirEditor(v, T19)
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]!.webContents.setZoomFactor(1.25)
      )
      await v.waitForTimeout(500)
      const alto = await v.evaluate(() => window.innerHeight)
      test.skip(alto > 520, `el viewport CSS mide ${alto} de alto`)
      await expect(v.getByRole('region', { name: 'Línea de tiempo, minimizada' })).toBeVisible()
      const expandir = botonLayout(v, 'timeline-expandir')
      await expect(expandir).toHaveAttribute('aria-disabled', 'true')
      await expect(expandir).toHaveAccessibleDescription(E.layout.timeline.sinEspacio)
      await expect(anuncio(v)).toHaveText(E.layout.anuncio.sinEspacio)
      const t = await tamanos(v)
      sinScroll(t, '1024 × 500')
      expect(t.zona).toBeGreaterThanOrEqual(136)
      await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows()[0]!
        w.webContents.setZoomFactor(1)
        w.setContentSize(1280, 800)
      })
      await expect(v.getByRole('region', { name: E.timeline.titulo, exact: true })).toBeVisible()
      // La minimización temporal nunca se guarda.
      const guardada = existsSync(rutaConfig(datos)) ? leerConfig(datos).editor?.paneles : undefined
      expect(guardada?.linea_tiempo?.minimizado ?? false).toBe(false)
    })
  })

  test('todo minimizado a 1024 × 576 no hace scroll y la previa ocupa el ancho liberado', async () => {
    await conEditor(
      'todo-min',
      async (v, _datos, app) => {
        const [w, h] = await ajustarVentana(app, v, 1024, 576)
        test.skip(!admite([w!, h!], 1024, 576), 'la pantalla no admite 1024 × 576')
        await abrirEditor(v, T19)
        await botonLayout(v, 'lista-minimizar').click()
        await botonLayout(v, 'panel-minimizar').click()
        await botonLayout(v, 'timeline-minimizar').click()
        const t = await tamanos(v)
        sinScroll(t, 'todo-min')
        // Ancho real − 32 de márgenes − 24 de divisores − 72 − 120 de rieles.
        expect(t.previa).toBeGreaterThan(w! - 32 - 24 - 72 - 120 - 2)
        expect(t.zona).toBeGreaterThanOrEqual(136)
        expect((await medir(v)).fuera).toEqual([])
      },
      undefined,
      1.25
    )
  })
})

test.describe('persistencia de la distribución (0161)', () => {
  test.describe.configure({ timeout: 120_000 })

  test('los tamaños y estados se guardan, se recuperan tras reiniciar y en otra canción', async () => {
    const datos = crearTemporal('persistencia')
    await sembrar(datos)
    let app = await lanzar(datos)
    try {
      let v = await app.firstWindow()
      await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
      await abrirEditor(v, T19)
      await divisor(v, 'lista').focus()
      await v.keyboard.press('Shift+ArrowRight')
      await divisor(v, 'panel').focus()
      await v.keyboard.press('Shift+ArrowLeft')
      await v.keyboard.press('ArrowLeft')
      await divisor(v, 'dock').focus()
      await v.keyboard.press('Shift+ArrowUp')
      await botonLayout(v, 'panel-minimizar').click()
      await botonLayout(v, 'lista-minimizar').click()
      // Una ráfaga de teclado se escribe 500 ms después de la última tecla.
      await expect
        .poll(() => leerConfig(datos).editor?.paneles?.lista?.minimizado, { timeout: 5000 })
        .toBe(true)
      const guardado = leerConfig(datos).editor.paneles
      expect(guardado.lista).toEqual({ ancho: 364, minimizado: true })
      expect(guardado.panel).toEqual({ ancho: 440, minimizado: true })
      expect(guardado.linea_tiempo.minimizado).toBe(false)
      expect(guardado.linea_tiempo.alto).toBeGreaterThan(200)
      await app.close()

      app = await lanzar(datos)
      v = await app.firstWindow()
      await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
      await abrirEditor(v, T17)
      await expect(v.getByRole('region', { name: 'Lista de líneas, minimizada' })).toBeVisible()
      await expect(v.getByRole('region', { name: 'Panel, minimizado' })).toBeVisible()
      await botonLayout(v, 'lista-expandir').click()
      await botonLayout(v, 'panel-expandir').click()
      await expect(divisor(v, 'lista')).toHaveAttribute('aria-valuenow', '364')
      await expect(divisor(v, 'panel')).toHaveAttribute('aria-valuenow', '440')
      await expect(divisor(v, 'dock')).toHaveAttribute(
        'aria-valuenow',
        String(guardado.linea_tiempo.alto)
      )
      // La canción no se escribe al redimensionar o minimizar.
      expect(leerCancion(datos, ID19).letra.lineas.length).toBeGreaterThan(0)
    } finally {
      await app.close().catch(() => undefined)
    }
  })

  test('una preferencia mayor que lo que cabe se recorta sin sobrescribirla y se recupera al agrandar', async () => {
    await conEditor(
      'pref-recorte',
      async (v, datos, app) => {
        const [w] = await ajustarVentana(app, v, 1024, 720)
        test.skip(w !== 1024, 'la pantalla no admite 1024 de ancho')
        const antes = readFileSync(rutaConfig(datos), 'utf8')
        await abrirEditor(v, T19)
        let t = await tamanos(v)
        expect(t.lista).toBeLessThan(480)
        expect(t.panel).toBeLessThan(480)
        expect(t.previa).toBeGreaterThanOrEqual(320)
        sinScroll(t, 'recortado a 1024')
        await ajustarVentana(app, v, 1920, 720)
        t = await tamanos(v)
        expect([t.lista, t.panel]).toEqual([480, 480])
        // En alto: línea de tiempo de 600 px a 1280 × 720.
        await ajustarVentana(app, v, 1280, 720)
        t = await tamanos(v)
        sinScroll(t, 'línea de tiempo recortada')
        expect(t.zona).toBeGreaterThanOrEqual(136)
        expect(t.dock).toBeLessThan(600)
        expect(readFileSync(rutaConfig(datos), 'utf8')).toBe(antes)
      },
      (datos) =>
        sembrarConfig(datos, {
          editor: {
            paneles: {
              lista: { ancho: 480, minimizado: false },
              panel: { ancho: 480, minimizado: false },
              linea_tiempo: { alto: 600, minimizado: false }
            }
          }
        })
    )
  })

  test('una preferencia corrupta arranca con los valores por defecto, sin aviso y sin apartar la configuración', async () => {
    await conEditor(
      'pref-corrupta',
      async (v, datos, app) => {
        await ajustarVentana(app, v, 1280, 720)
        await abrirEditor(v, T19)
        const t = await tamanos(v)
        expect([t.lista, t.panel]).toEqual([300, 360])
        await expect(v.getByRole('alert')).toHaveCount(0)
        expect(existsSync(join(datos, 'config.json.danado'))).toBe(false)
        expect(leerConfig(datos).reproductor.volumen).toBe(0.42)
      },
      (datos) =>
        sembrarConfig(datos, {
          reproductor: { volumen: 0.42 },
          editor: {
            paneles: {
              lista: { ancho: 9999, minimizado: 'si' },
              panel: 'roto',
              linea_tiempo: { alto: 5, minimizado: null }
            }
          }
        })
    )
  })
})

test('el desplazamiento de toda la letra no se parte con el panel a 300, 360 y 480 px', async () => {
  await conEditor('panel-angosto', async (v, _datos, app) => {
    await ajustarVentana(app, v, 1280, 720)
    await abrirEditor(v, T19)
    const panel = divisor(v, 'panel')
    const casos: [() => Promise<void>, number][] = [
      [async () => v.keyboard.press('Home'), 300],
      [async () => panel.dblclick(), 360],
      [async () => v.keyboard.press('End'), 480]
    ]
    for (const [accion, ancho] of casos) {
      await panel.focus()
      await accion()
      await expect(panel).toHaveAttribute('aria-valuenow', String(ancho))
      const grupo = v.getByRole('group', { name: E.offsetTitulo })
      await grupo.scrollIntoViewIfNeeded()
      const tops = await grupo.evaluate((g) =>
        [...g.querySelectorAll('button, input')].map((e) =>
          Math.round(e.getBoundingClientRect().top)
        )
      )
      expect(tops, `panel a ${ancho} px`).toHaveLength(4)
      expect(new Set(tops).size, `panel a ${ancho} px`).toBe(1)
      await expect(v.getByText(E.offsetTitulo)).toHaveCount(1)
    }
  })
})

test('con la barra vertical de main a 1024 px de ancho no se salta a la disposición B', async () => {
  await conEditor('histeresis', async (v, _datos, app) => {
    // 1536 × 600 DIP con zoom 1,5: 1024 × 400 CSS, sin altura para la zona superior.
    await ajustarVentana(app, v, 1536, 600)
    await abrirEditor(v, T19)
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.webContents.setZoomFactor(1.5)
    )
    await v.waitForTimeout(600)
    const r = await v.evaluate(() => {
      const main = document.querySelector('main')!
      return {
        ancho: window.innerWidth,
        barra: main.offsetWidth - main.clientWidth,
        scrollMain: main.scrollHeight - main.clientHeight,
        bajo: document.querySelector('[data-bajo-minimo]')?.getAttribute('data-bajo-minimo'),
        scrollH: document.documentElement.scrollWidth - window.innerWidth
      }
    })
    test.skip(r.ancho !== 1024, `el viewport CSS mide ${r.ancho} de ancho`)
    expect(r.scrollMain).toBeGreaterThan(0)
    expect(r.barra, 'la barra vertical ocupa ancho').toBeGreaterThan(0)
    expect(r.bajo).toBe('alto')
    expect(r.scrollH).toBeLessThanOrEqual(0)
  })
})

test('el divisor enseña su tooltip a los 500 ms de hover sin mover la rejilla', async () => {
  await conEditor('div-tooltip', async (v) => {
    await abrirEditor(v, T19)
    const antes = await tamanos(v)
    const caja = (await v.locator('[data-divisor="lista"]').boundingBox())!
    await v.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2)
    await expect(v.getByRole('tooltip', { name: E.layout.divisor.tooltip })).toBeVisible({
      timeout: 3000
    })
    expect(await tamanos(v)).toEqual(antes)
    await v.mouse.move(caja.x + 400, caja.y + 40)
    await expect(v.getByRole('tooltip')).toHaveCount(0)
  })
})

// --- Otras vistas con la ventana mínima de contenido (1024 × 576) ------------------------------

test.describe('otras vistas a 1024 × 576 (mínimo de ventana de 0155)', () => {
  test.describe.configure({ timeout: 90_000 })

  const sinDesbordeHorizontal = async (v: Page, contexto: string) => {
    const [sw, iw] = await v.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth
    ])
    expect(sw, `${contexto}: scroll horizontal`).toBeLessThanOrEqual(iw!)
  }
  /** El diálogo cabe en el viewport o su contenido se alcanza con scroll y sus botones se activan. */
  const alcanzable = async (v: Page, nombre: string | RegExp, boton: string) => {
    const dialogo = v.getByRole('dialog', { name: nombre })
    await expect(dialogo).toBeVisible()
    const cerrar = dialogo.getByRole('button', { name: boton, exact: true })
    await cerrar.scrollIntoViewIfNeeded()
    const c = (await cerrar.boundingBox())!
    const [iw, ih] = await v.evaluate(() => [window.innerWidth, window.innerHeight])
    expect(c.x).toBeGreaterThanOrEqual(0)
    expect(c.y).toBeGreaterThanOrEqual(0)
    expect(c.x + c.width).toBeLessThanOrEqual(iw!)
    expect(c.y + c.height).toBeLessThanOrEqual(ih!)
    await cerrar.click()
    await expect(dialogo).toHaveCount(0)
  }

  test('Biblioteca, diálogos, Ajustes, Añadir y Letra no desbordan en horizontal y los diálogos son alcanzables', async () => {
    await conEditor('otras-vistas', async (v, _datos, app) => {
      const [w, h] = await ajustarVentana(app, v, 1024, 576)
      test.skip(!admite([w!, h!], 1024, 576), 'la pantalla no admite 1024 × 576')
      await sinDesbordeHorizontal(v, 'Biblioteca')

      const t = tarjeta(v, 'Canción lista')
      await t.getByRole('button', { name: 'Más acciones de «Canción lista»' }).click()
      await v.getByRole('menuitem', { name: 'Editar datos' }).click()
      await alcanzable(v, 'Editar datos', 'Cancelar')
      await t.getByRole('button', { name: 'Más acciones de «Canción lista»' }).click()
      await v.getByRole('menuitem', { name: /^Eliminar/ }).click()
      await alcanzable(v, /^¿Eliminar/, 'Cancelar')

      await v.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+,`)
      await expect(v.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible()
      await sinDesbordeHorizontal(v, 'Ajustes')
      await v.keyboard.press('Escape')

      await v.getByRole('button', { name: 'Añadir canción' }).first().click()
      await expect(v.getByRole('heading', { level: 1, name: 'Añadir canción' })).toBeVisible()
      await sinDesbordeHorizontal(v, 'Añadir')
      await v.keyboard.press('Escape')

      await abrirEditor(v, T19)
      await v
        .getByRole('navigation', { name: 'Pasos de la canción' })
        .getByRole('button', { name: /^Paso \d, Letra/ })
        .click()
      await expect(v.getByRole('heading', { level: 1, name: /Letra/ })).toBeVisible()
      await sinDesbordeHorizontal(v, 'Letra')
    })
  })
})

// --- Capturas de revisión del criterio 25 (opcional: SHINOBI_CAPTURAS_2_1=1) --------------------

const CAPTURAS = process.env.SHINOBI_CAPTURAS_2_1 === '1'
const DIR_CAPTURAS = join(process.cwd(), '..', 'docs', 'ux', 'revision-fase-2.1')

/** Espera, sin fallar, a que la forma de onda tenga picos dibujados (hay entorno del worker). */
async function esperarPicosSiHay(v: Page): Promise<boolean> {
  const lienzos = v.getByRole('region', { name: E.timeline.titulo }).locator('canvas')
  try {
    await expect
      .poll(
        () =>
          lienzos.evaluateAll(
            (nodos) =>
              nodos.length === 2 &&
              nodos.every((n) => {
                const c = n as HTMLCanvasElement
                if (!c.width || !c.height) return false
                return c
                  .getContext('2d')
                  ?.getImageData(0, 0, c.width, c.height)
                  .data.some((p, i) => i % 4 === 3 && p !== 0)
              })
          ),
        { timeout: 20_000 }
      )
      .toBe(true)
    return true
  } catch {
    return false
  }
}

test.describe('capturas de revisión de la subfase 2.1', () => {
  test.skip(!CAPTURAS, 'se generan solo con SHINOBI_CAPTURAS_2_1=1')
  test.describe.configure({ timeout: 180_000 })

  const escala = (dpr: number) => (dpr === 1 ? '100' : '125')

  for (const vp of VIEWPORTS) {
    test(`capturas de ${vp.nombre} al ${escala(vp.dpr)} %`, async () => {
      await conEditor(
        `capturas-${vp.nombre}`,
        async (v, _datos, app) => {
          await exigirViewport(app, v, vp)
          const fisico = `${Math.round(vp.ancho * vp.dpr)}x${Math.round(vp.alto * vp.dpr)}`
          mkdirSync(DIR_CAPTURAS, { recursive: true })
          const capturar = async (estado: string) => {
            await v.mouse.move(0, 0)
            // Sin el tooltip que acompaña al botón enfocado (salvo en la captura del foco).
            if (estado !== 'foco-divisor') {
              await v.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
            }
            await v.waitForTimeout(250)
            await v.screenshot({
              path: join(DIR_CAPTURAS, `editor-${fisico}-${escala(vp.dpr)}-${estado}.png`)
            })
          }
          await abrirEditor(v, T19)
          const picos = await esperarPicosSiHay(v)
          test.info().annotations.push({ type: 'picos', description: String(picos) })
          await capturar('defecto')
          await v.getByRole('radio', { name: 'Estilo' }).click()
          await expect(v.getByRole('region', { name: E.timeline.titulo })).toHaveCount(0)
          await capturar('estilo')
          await v.getByRole('radio', { name: 'Sincronía' }).click()

          if (vp.ancho !== 1280 && vp.ancho !== 1024) return
          // Solo a 1280 × 720 (100 %) y 1024 × 576 CSS (125 %).
          const minimizar = async (...zonas: string[]) => {
            for (const z of zonas) await botonLayout(v, `${z}-minimizar`).click()
          }
          const expandir = async (...zonas: string[]) => {
            for (const z of zonas) await botonLayout(v, `${z}-expandir`).click()
          }
          await minimizar('lista')
          await capturar('lista-min')
          await expandir('lista')
          await minimizar('panel')
          await capturar('panel-min')
          await expandir('panel')
          await minimizar('timeline')
          await capturar('timeline-min')
          await minimizar('lista', 'panel')
          await capturar('todo-min')
          await expandir('lista', 'panel', 'timeline')

          await v.keyboard.press('s')
          await expect(v.getByRole('heading', { name: E.syncTitulo })).toBeVisible()
          await capturar('sync')
          await v.keyboard.press('Escape')
          await expect(v.getByRole('heading', { name: E.syncTitulo })).toHaveCount(0)

          // El foco de teclado en el divisor (Mayús solo activa la modalidad de teclado).
          await divisor(v, 'panel').focus()
          await v.keyboard.press('Shift')
          await capturar('foco-divisor')

          await v.keyboard.press('Home')
          await expect(divisor(v, 'panel')).toHaveAttribute('aria-valuenow', '300')
          await v
            .getByRole('group', { name: E.offsetTitulo })
            .evaluate((g) =>
              g.querySelector('input')!.scrollIntoView({ block: 'center', inline: 'nearest' })
            )
          await capturar('panel-300')
          await divisor(v, 'panel').dblclick()

          await app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0]!.webContents.setZoomFactor(1.5)
          )
          await v.waitForTimeout(600)
          expect(await v.locator('[data-bajo-minimo]').getAttribute('data-bajo-minimo')).toBe(
            'ancho'
          )
          await capturar('bajo-minimo')
        },
        undefined,
        vp.dpr
      )
    })
  }
})
