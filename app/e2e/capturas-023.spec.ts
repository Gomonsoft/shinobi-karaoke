import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { sembrar } from '../src/main/biblioteca/semilla'
import { T_PARTES } from '../src/renderer/src/vistas/editor/estilo/textosPartes'
import { R } from '../src/renderer/src/vistas/reproductor/textos'
import { abrirEditor, idSemilla, lanzar } from './fixtures/editor'
import { leerCancion, tarjeta } from './fixtures/separacion'
import { crearTemporal } from './temporales'

/**
 * Capturas de revisión de 0.2.3, feature 1 (tareas 0348, 0364 y 0347): C1-R12 y C1-E24. Opt-in, solo para
 * el diseñador, sobre la semilla con reparto (letras inventadas):
 *
 *   SHINOBI_CAPTURAS_023_1=1 npx playwright test e2e/capturas-023.spec.ts --workers=1
 *
 * No escribe nada en el CI. Cada estado es independiente: si uno falla se anota y se sigue.
 */
const ACTIVA = process.env.SHINOBI_CAPTURAS_023_1 === '1'
const RAIZ =
  process.env.SHINOBI_CAPTURAS_RAIZ ?? join(process.cwd(), '..', 'docs', 'ux', 'revisiones')
const DUO = 'Reparto: dúo con coros'
const SOLO_COROS = 'Reparto: un cantante con coros'

type Cancion = ReturnType<typeof leerCancion>
function cambiar(datos: string, n: number, f: (c: Cancion) => void): void {
  const id = idSemilla(n)
  const c = leerCancion(datos, id)
  f(c)
  writeFileSync(join(datos, 'biblioteca', id, 'cancion.json'), JSON.stringify(c))
}
const lineaDe = (id: string, texto: string, inicio: number, fin: number, parte?: string) => ({
  id,
  tipo: 'linea',
  texto,
  inicio_ms: inicio,
  fin_ms: fin,
  palabras: null,
  ...(parte ? { parte } : {})
})

async function ponerTamano(app: ElectronApplication, ancho: number, alto: number, v: Page) {
  await app.evaluate(
    ({ BrowserWindow }, [w, h]) => {
      const ventana = BrowserWindow.getAllWindows()[0]!
      ventana.unmaximize()
      ventana.setMinimumSize(300, 300)
      ventana.setContentSize(w as number, h as number)
    },
    [ancho, alto] as const
  )
  await new Promise((r) => setTimeout(r, 700))
  const cdp = await v.context().newCDPSession(v)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: ancho,
    height: alto,
    deviceScaleFactor: await v.evaluate(() => window.devicePixelRatio),
    mobile: false
  })
  await new Promise((r) => setTimeout(r, 500))
}

async function conApp(
  nombre: string,
  preparar: (datos: string) => void,
  prueba: (v: Page, app: ElectronApplication) => Promise<void>,
  dpr = 1
): Promise<void> {
  const datos = crearTemporal(nombre)
  await sembrar(datos, { reparto: true, voces: true })
  preparar(datos)
  const app = await lanzar(datos, dpr)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
    await prueba(v, app)
  } finally {
    await app.close().catch(() => undefined)
  }
}

const sin = (): void => undefined
const ESPERA = { puntos: true, barra: true, cuenta: true, primera_entrada: true, umbral_ms: 2000 }
const CON_ESPERA = (d: string) =>
  cambiar(d, 50, (c) => {
    c.estilo.espera = ESPERA
    for (const l of c.letra.lineas) if (l.id === 'd3') l.fin_ms = 11_000
  })
const CUARTETO = (d: string) =>
  cambiar(d, 50, (c) => {
    c.letra.partes = {
      cantantes: [
        { id: 'c1', nombre: 'Ana' },
        { id: 'c2', nombre: 'Luis' },
        { id: 'c3', nombre: null },
        { id: 'c4', nombre: null }
      ]
    }
    c.letra.lineas = [
      lineaDe('q1', 'Cruza el faro la gaviota', 2000, 4800),
      lineaDe('q2', 'Responde el viento del sur', 5000, 7800, 'c2'),
      lineaDe('q3', 'Se enciende la bahía entera', 8000, 10_800, 'c3'),
      lineaDe('q4', 'Baja la niebla despacio', 11_000, 13_800, 'c4'),
      lineaDe('q5', '(Ah, ah, la marea)', 14_000, 16_800, 'coro'),
      lineaDe('q6', 'Cantemos todos la marea', 17_000, 19_800, 'todos')
    ]
  })

test.describe('capturas de revisión de 0.2.3 · feature 1', () => {
  test.skip(!ACTIVA, 'se generan solo con la variable SHINOBI_CAPTURAS_023_1=1')
  test.describe.configure({ timeout: 600_000 })
  const dir = join(RAIZ, '0.2.3-feature-1')
  const fallos: string[] = []
  test.beforeAll(() => mkdirSync(dir, { recursive: true }))
  test.afterAll(() => {
    if (fallos.length > 0) console.log(`Capturas no tomadas:\n${fallos.join('\n')}`)
  })
  const intentar = async (n: string, a: () => Promise<void>): Promise<void> => {
    try {
      await a()
    } catch (e) {
      fallos.push(`${n}: ${String(e).split('\n')[0]}`)
      console.log(`FALLO ${n}: ${String(e).split('\n').slice(0, 8).join(' | ')}`)
    }
  }
  const foto = async (p: Page, nombre: string): Promise<void> => {
    await p.mouse.move(0, 0).catch(() => undefined)
    await p.waitForTimeout(500)
    await p.screenshot({ path: join(dir, `${nombre}.png`) })
  }

  /** Abre una canción en el reproductor, la pausa en `ms` y toma una captura por tamaño. */
  async function reproductor(
    estado: string,
    titulo: string,
    preparar: (d: string) => void,
    ms: number,
    tamanos: [number, number][],
    grises = false
  ): Promise<void> {
    // `SHINOBI_CAPTURAS_023_SOLO=espera-zona,duo-coro` rehace solo esos estados del reproductor.
    const solo = process.env.SHINOBI_CAPTURAS_023_SOLO
    if (solo && !solo.split(',').includes(estado)) return
    await intentar(`reproductor-${estado}`, () =>
      conApp(`cap023-rep-${estado}`, preparar, async (v, app) => {
        await ponerTamano(app, tamanos[0]![0], tamanos[0]![1], v)
        await v.getByRole('searchbox', { name: /^Buscar título/ }).fill(titulo)
        await tarjeta(v, titulo)
          .getByRole('button', { name: /^Reproducir/ })
          .click()
        const capa = v.getByRole('dialog', { name: `Reproductor de «${titulo}»` })
        await expect(capa.getByRole('button', { name: R.tooltip.pausa })).toBeVisible({
          timeout: 15_000
        })
        await capa.getByRole('button', { name: R.tooltip.pausa }).click()
        await capa.getByRole('slider', { name: 'Barra de tiempo' }).fill(String(ms))
        if (grises) await v.addStyleTag({ content: 'html { filter: grayscale(1) !important; }' })
        for (const [ancho, alto] of tamanos) {
          await ponerTamano(app, ancho, alto, v)
          await foto(v, `reproductor-${ancho}x${alto}-${estado}`)
        }
      })
    )
  }

  const DOS: [number, number][] = [
    [1920, 1080],
    [1280, 720]
  ]

  test('reproductor C1-R12', async () => {
    await reproductor('duo-canta-1', DUO, sin, 3000, DOS)
    await reproductor('duo-canta-2', DUO, sin, 6000, DOS)
    await reproductor('duo-todos', DUO, sin, 9500, DOS)
    await reproductor('duo-coro', DUO, sin, 15_500, DOS)
    await reproductor('solo-coros', SOLO_COROS, sin, 9000, DOS)
    await reproductor(
      'letra-lista-duo',
      DUO,
      (d) => cambiar(d, 50, (c) => (c.modalidad = 'letra_lista')),
      6000,
      DOS
    )
    await reproductor('espera-zona', DUO, CON_ESPERA, 12_600, DOS)
    await reproductor('cuarteto-coro', DUO, CUARTETO, 9000, DOS)
    await reproductor('escala-de-grises', DUO, sin, 6000, DOS, true)
    await reproductor('cuatro-tercios-duo', DUO, sin, 6000, [[1440, 1080]])
  })

  // ------------------------------------------------------------------ editor (C1-E24)
  for (const f of [
    { dpr: 1, escala: '100' },
    { dpr: 1.25, escala: '125' }
  ]) {
    test(`editor 1280x720 al ${f.escala} %`, async () => {
      const css = { ancho: Math.round(1280 / f.dpr), alto: Math.round(720 / f.dpr) }
      const nombre = (e: string) => `editor-1280x720-${f.escala}-${e}`
      const estilo = async (v: Page) => {
        await abrirEditor(v, DUO)
        await v.getByRole('radio', { name: /^Estilo/ }).click()
        const titulo = v.getByRole('heading', { name: T_PARTES.titulo })
        await expect(titulo).toBeAttached()
        await titulo.scrollIntoViewIfNeeded()
      }
      await intentar('estilo-colores', () =>
        conApp(
          `cap023-ed-colores-${f.escala}`,
          sin,
          async (v, app) => {
            await ponerTamano(app, css.ancho, css.alto, v)
            await estilo(v)
            await foto(v, nombre('estilo-colores'))
          },
          f.dpr
        )
      )
      await intentar('aviso-parte', () =>
        conApp(
          `cap023-ed-aviso-${f.escala}`,
          (d) =>
            cambiar(d, 50, (c) => {
              c.letra.partes = {
                cantantes: [
                  { id: 'c1', nombre: 'Ana' },
                  { id: 'c2', nombre: 'Luis' },
                  { id: 'c3', nombre: null }
                ]
              }
              c.estilo.letra.colores_partes = { c3: '#2A1A44' }
            }),
          async (v, app) => {
            await ponerTamano(app, css.ancho, css.alto, v)
            await estilo(v)
            await v.getByText(/apenas se ve sobre el fondo/).scrollIntoViewIfNeeded()
            await foto(v, nombre('aviso-parte'))
          },
          f.dpr
        )
      )
    })
  }

  // ------------------------------------------------------- editor: cantantes por línea y coros (0343–0346, 0365)
  const TRES = (d: string, conLineasEnElTres: boolean) =>
    cambiar(d, 50, (c) => {
      c.letra.partes = {
        cantantes: [
          { id: 'c1', nombre: 'Ana' },
          { id: 'c2', nombre: 'Luis' },
          { id: 'c3', nombre: 'Marta' }
        ]
      }
      c.letra.lineas = [
        lineaDe('t1', 'Cruza el faro la gaviota', 2000, 4800),
        lineaDe('t2', 'Responde el viento del sur', 5000, 7800, 'c2'),
        lineaDe('t3', 'Se enciende la bahía entera', 8000, 10_800, conLineasEnElTres ? 'c3' : 'c1'),
        lineaDe('t4', '(Ah, ah, la marea)', 11_000, 13_800, 'coro'),
        lineaDe('t5', 'Cantemos todos la marea', 14_000, 16_800, 'todos')
      ]
    })
  const SIN_REPARTO = (d: string) =>
    cambiar(d, 50, (c) => {
      delete c.letra.partes
      for (const l of c.letra.lineas) delete l.parte
    })
  const SIN_VOZ = (d: string) =>
    cambiar(d, 51, (c) => {
      c.pasos.separacion = { estado: 'pendiente', progreso: null, error: null, actualizado: null }
    })
  const fila = (v: Page, n: number) => v.getByRole('option', { name: new RegExp(`^Línea ${n},`) })
  /** Baja el panel hasta que el final del elemento queda a la vista. */
  const verHastaElFinal = async (v: Page, el: ReturnType<Page['locator']>) => {
    await el.evaluate((nodo) => nodo.scrollIntoView({ block: 'end' }))
    await v.waitForTimeout(300)
  }
  const funciones = async (v: Page) => {
    await v.getByRole('radio', { name: /^Funciones/ }).click()
    const t = v.getByRole('heading', { name: 'Cantantes y coros' })
    await expect(t).toBeAttached()
    // La sección entera por abajo: filas de partes, «+ Añadir cantante» o `edi.partes.maximo`.
    const cierre = v
      .locator('[data-funcion="anadir-cantante"], p:has-text("Hasta 4 cantantes")')
      .first()
    // Sin cantantes de más (un solo cantante): el final de la sección.
    if (await cierre.count()) await verHastaElFinal(v, cierre)
    else await verHastaElFinal(v, t.locator('..'))
  }
  const funcionesCoros = async (v: Page) => {
    await v.getByRole('radio', { name: /^Funciones/ }).click()
    // «Voz en los coros» entera: deslizador, valor, ayuda, límite y «Escuchar un coro».
    const voz = v.locator('[data-voz-coros]')
    await expect(voz).toBeAttached()
    await verHastaElFinal(v, voz)
  }
  const dir2 = join(RAIZ, '0.2.3-feature-2')
  const SOLAPES = (d: string) =>
    cambiar(d, 50, (c) => {
      for (const l of c.letra.lineas) if (l.id === 'd1') l.fin_ms = 6000
    })
  const estilo = async (v: Page) => {
    await v.getByRole('radio', { name: /^Estilo/ }).click()
    await expect(v.getByRole('heading', { name: T_PARTES.titulo })).toBeAttached()
  }

  for (const f of [
    { ancho: 1280, alto: 720, dpr: 1, escala: '100' },
    { ancho: 1280, alto: 720, dpr: 1.25, escala: '125' },
    { ancho: 1024, alto: 576, dpr: 1, escala: '100' }
  ]) {
    test(`editor ${f.ancho}x${f.alto} al ${f.escala} % · cantantes y coros`, async () => {
      mkdirSync(dir2, { recursive: true })
      const css = { ancho: Math.round(f.ancho / f.dpr), alto: Math.round(f.alto / f.dpr) }
      const nombre = (e: string) => `editor-${f.ancho}x${f.alto}-${f.escala}-${e}`
      const estado = async (
        e: string,
        titulo: string,
        preparar: (d: string) => void,
        accion: (v: Page, app: ElectronApplication) => Promise<void>,
        carpeta = dir,
        moverPuntero = true
      ) =>
        intentar(`${nombre(e)}`, () =>
          conApp(
            `cap023-ed-${e}-${f.ancho}-${f.escala}`,
            preparar,
            async (v, app) => {
              await ponerTamano(app, css.ancho, css.alto, v)
              await abrirEditor(v, titulo)
              await accion(v, app)
              // Durante un arrastre el puntero se queda donde está (si no, la región se iría con él).
              if (moverPuntero) await v.mouse.move(0, 0).catch(() => undefined)
              await v.waitForTimeout(500)
              await v.screenshot({ path: join(carpeta, `${nombre(e)}.png`) })
            },
            f.dpr
          )
        )

      await estado('sin-reparto', DUO, SIN_REPARTO, async () => undefined)
      await estado('solo-coros', SOLO_COROS, sin, async () => undefined)
      await estado('lista-varios', DUO, sin, async (v) => {
        await fila(v, 2).click()
      })
      await estado('menu-quien-canta', DUO, sin, async (v) => {
        await fila(v, 2).click()
        await v.keyboard.press('c')
        await expect(v.getByRole('menu', { name: '¿Quién canta?' })).toBeVisible()
      })
      await estado(
        'menu-quien-canta-tres',
        DUO,
        (d) => TRES(d, true),
        async (v) => {
          await fila(v, 2).click()
          await v.keyboard.press('c')
          await expect(v.getByRole('menu', { name: '¿Quién canta?' })).toBeVisible()
        }
      )
      await estado('seleccion-multiple', DUO, sin, async (v) => {
        await fila(v, 1).click()
        await fila(v, 3).click({ modifiers: ['Shift'] })
      })
      await estado(
        'carriles-tres',
        DUO,
        (d) => TRES(d, true),
        async () => undefined
      )
      await estado(
        'carril-vacio',
        DUO,
        (d) => TRES(d, false),
        async () => undefined
      )
      // El arrastre no existe con los carriles juntos (a 1024 × 576 y al 125 % se juntan solos).
      if (f.escala === '100' && f.ancho === 1280)
        await estado(
          'arrastre-carril',
          DUO,
          (d) => TRES(d, true),
          async (v) => {
            const region = v.getByRole('button', { name: /^Responde el viento del sur/ })
            const caja = (await region.boundingBox())!
            await v.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2)
            await v.mouse.down()
            await v.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2 + 40, { steps: 6 })
            await expect(v.locator('[data-destino]')).toHaveCount(1)
          },
          dir,
          false
        )
      await estado(
        'carriles-juntos',
        DUO,
        (d) => TRES(d, true),
        async (v) => {
          // Con poco espacio los carriles ya se juntan solos y el botón se llama «Separar carriles».
          const juntar = v.getByRole('button', { name: 'Juntar carriles' })
          if (await juntar.count()) await juntar.click()
        }
      )
      await estado('carriles-sin-espacio', DUO, CUARTETO, async () => undefined)
      await estado('funciones-un-cantante', SOLO_COROS, sin, funciones)
      await estado('funciones-varios', DUO, sin, funciones)
      await estado('funciones-cuatro', DUO, CUARTETO, funciones)
      await estado('lista-256', DUO, sin, async (v) => {
        const divisor = v.locator('[data-divisor="lista"]')
        await divisor.focus()
        await v.keyboard.press('Home')
        await fila(v, 2).click()
      })
      await estado('panel-300', DUO, sin, async (v) => {
        const divisor = v.locator('[data-divisor="panel"]')
        await divisor.focus()
        await v.keyboard.press('Home')
        await fila(v, 2).click()
      })
      await estado('funciones-300', DUO, sin, async (v) => {
        const divisor = v.locator('[data-divisor="panel"]')
        await divisor.focus()
        await v.keyboard.press('Home')
        await funciones(v)
      })
      await estado('estilo-colores', DUO, sin, async (v) => {
        await estilo(v)
        await verHastaElFinal(v, v.getByText(/Más colores/).first())
      })
      await estado('estilo-voces', DUO, sin, async (v) => {
        await estilo(v)
        await expect(v.getByText('Varias voces').first()).toBeAttached()
        await v.getByText('Varias voces').first().scrollIntoViewIfNeeded()
        await expect(v.getByText(/Esta canción tiene varias voces/)).toBeVisible()
      })
      // --- 0359: voces a la vez (Ana pisa a Luis de 5 a 6 s) ---
      await estado('solape-carriles', DUO, SOLAPES, async () => undefined)
      await estado('solape-carriles-juntos', DUO, SOLAPES, async (v) => {
        const juntar = v.getByRole('button', { name: 'Juntar carriles' })
        if (await juntar.count()) await juntar.click()
      })
      await estado('solape-menu-inactivo', DUO, SOLAPES, async (v) => {
        await fila(v, 2).click()
        await v.keyboard.press('c')
        await expect(v.getByText(/No puede ser de Ana/)).toBeVisible()
      })
      if (f.escala === '100' && f.ancho === 1280)
        await estado(
          'solape-arrastre-prohibido',
          DUO,
          SOLAPES,
          async (v) => {
            const region = v.getByRole('button', { name: /^Responde el viento del sur/ })
            const caja = (await region.boundingBox())!
            await v.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2)
            await v.mouse.down()
            await v.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2 + 12, { steps: 3 })
            // Al empezar el arrastre la pista crece (cuenta las franjas) y los carriles suben: se vuelve a medir.
            await v.waitForTimeout(400)
            const carrilAna = (await v.locator('[data-carril="c1"]').boundingBox())!
            await v.mouse.move(caja.x + caja.width / 2, carrilAna.y + carrilAna.height / 2, {
              steps: 8
            })
            await expect(v.locator('[data-prohibido]')).toHaveCount(1)
          },
          dir,
          false
        )
      await estado('solape-silencios-excluidas', DUO, SOLAPES, async (v) => {
        await v.getByRole('radio', { name: /^Funciones/ }).click()
        const aviso = v.getByText(/líneas? que suenan? a la vez/)
        await expect(aviso).toBeVisible()
        await aviso.scrollIntoViewIfNeeded()
      })
      if (f.escala === '100' && f.ancho === 1280) {
        const dir3 = join(RAIZ, '0.2.3-feature-3')
        mkdirSync(dir3, { recursive: true })
        // C1S-E6: carriles juntos con voces a la vez: ninguna región tapa a otra (sub-filas de 24 px).
        await estado(
          'juntos-solapes',
          DUO,
          SOLAPES,
          async (v) => {
            const juntar = v.getByRole('button', { name: 'Juntar carriles' })
            if (await juntar.count()) await juntar.click()
            await expect(v.locator('[class*="conSubfilas"]')).toHaveCount(1)
          },
          dir3
        )
        await estado('coros-nivel', SOLO_COROS, sin, funcionesCoros, dir2)
        await estado('coros-sin-voz', SOLO_COROS, SIN_VOZ, funcionesCoros, dir2)
        // `coros-preparando`: la mezcla de prueba tarda 3 s; con «Instrumental» elegido se ve el aviso a los 500 ms.
        await intentar(nombre('coros-preparando'), () =>
          conApp(
            `cap023-ed-coros-preparando-${f.escala}`,
            sin,
            async (v, app) => {
              await ponerTamano(app, css.ancho, css.alto, v)
              await v.evaluate(() => {
                ;(
                  window as unknown as { __SHINOBI_MEZCLA_LENTA_MS: number }
                ).__SHINOBI_MEZCLA_LENTA_MS = 3000
              })
              await abrirEditor(v, SOLO_COROS)
              await v.getByRole('radio', { name: 'Instrumental' }).click()
              await expect(v.getByText('Preparando los coros…')).toBeVisible({ timeout: 5000 })
              await v.waitForTimeout(300)
              await v.screenshot({ path: join(dir2, `${nombre('coros-preparando')}.png`) })
            },
            f.dpr
          )
        )
      }
    })
  }
})

// ------------------------------------------------------------------ feature 3 · voces a la vez (0360)
const ACTIVA_3 = process.env.SHINOBI_CAPTURAS_023_3 === '1'
test.describe('capturas de revisión de 0.2.3 · feature 3', () => {
  test.skip(!ACTIVA_3, 'se generan solo con la variable SHINOBI_CAPTURAS_023_3=1')
  test.describe.configure({ timeout: 600_000 })
  const dir = join(RAIZ, '0.2.3-feature-3')
  const TITULO_VOCES = 'Voces a la vez: dúo con coro'
  test.beforeAll(() => mkdirSync(dir, { recursive: true }))

  const estados: [string, number, (d: string) => void][] = [
    ['dos-voces', 5200, sin],
    ['tres-voces-con-coro', 8000, sin],
    ['dos-voces-final', 17_500, sin],
    ['todos-sin-solape', 13_000, sin],
    // Tras el coro, con el hueco antes de «Todos»: los indicadores solo salen cuando nadie suena.
    [
      'espera-tras-solape',
      12_600,
      (d) =>
        cambiar(d, 52, (c) => {
          c.estilo.espera = ESPERA
          // Hueco de 3 s tras el coro (acaba a los 11 s): «Todos» entra a los 14 s.
          const v5 = c.letra.lineas.find((l: { id: string }) => l.id === 'v5')!
          v5.inicio_ms = 14_000
          v5.fin_ms = 15_800
        })
    ]
  ]
  for (const [estado, ms, preparar] of estados) {
    test(`reproductor ${estado}`, async () => {
      await conApp(`cap023-voces-${estado}`, preparar, async (v, app) => {
        await ponerTamano(app, 1920, 1080, v)
        await v.getByRole('searchbox', { name: /^Buscar título/ }).fill(TITULO_VOCES)
        await tarjeta(v, TITULO_VOCES)
          .getByRole('button', { name: /^Reproducir/ })
          .click()
        const capa = v.getByRole('dialog', { name: `Reproductor de «${TITULO_VOCES}»` })
        await expect(capa.getByRole('button', { name: R.tooltip.pausa })).toBeVisible({
          timeout: 15_000
        })
        await capa.getByRole('button', { name: R.tooltip.pausa }).click()
        await capa.getByRole('slider', { name: 'Barra de tiempo' }).fill(String(ms))
        for (const [ancho, alto] of [
          [1920, 1080],
          [1280, 720]
        ] as const) {
          await ponerTamano(app, ancho, alto, v)
          await v.mouse.move(0, 0).catch(() => undefined)
          await v.waitForTimeout(500)
          await v.screenshot({ path: join(dir, `reproductor-${ancho}x${alto}-${estado}.png`) })
        }
      })
    })
  }
})
