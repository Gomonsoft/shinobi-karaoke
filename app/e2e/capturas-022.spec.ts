import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { sembrar, TEMA_NEON } from '../src/main/biblioteca/semilla'
import { E } from '../src/renderer/src/vistas/editor/textos'
import { T_PANTALLA } from '../src/renderer/src/vistas/editor/estilo/textosPantalla'
import { R } from '../src/renderer/src/vistas/reproductor/textos'
import { abrirEditor, idSemilla, lanzar } from './fixtures/editor'
import { leerCancion, tarjeta } from './fixtures/separacion'
import { pulsosFlac } from '../src/main/biblioteca/flac'
import { K } from '../src/renderer/src/vistas/editor/comprobar/textos'
import { CC } from '../src/renderer/src/vistas/letra/textosComprobacion'
import { TEXTO as TEXTO_LETRA } from '../src/renderer/src/vistas/letra/textos'
import { iniciarServidorLrclib, TITULOS, VOZ_SINTETICA } from './fixtures/lrclib/servidor'
import { crearTemporal } from './temporales'

/**
 * Capturas de revisión de 0.2.2, features 1, 2 y 4 (tareas 0292, 0295 y 0301): F1-R25, F1-E16,
 * F2-R9, F2-E11, F2-A4, F4-L12 y F4-E11. Opt-in, solo para el diseñador, sobre la semilla (letras inventadas):
 *
 *   SHINOBI_CAPTURAS_022_1=1 npx playwright test e2e/capturas-022.spec.ts --workers=1
 *   SHINOBI_CAPTURAS_022_2=1 npx playwright test e2e/capturas-022.spec.ts --workers=1
 *   SHINOBI_CAPTURAS_022_4=1 npx playwright test e2e/capturas-022.spec.ts --workers=1
 *
 * No escribe nada en el CI. Cada estado es independiente: si uno falla se anota y se sigue.
 */

const F1 = process.env.SHINOBI_CAPTURAS_022_1 === '1'
const F2 = process.env.SHINOBI_CAPTURAS_022_2 === '1'
const F4 = process.env.SHINOBI_CAPTURAS_022_4 === '1'
const RAIZ = join(process.cwd(), '..', 'docs', 'ux', 'revisiones')
const ID = idSemilla(20)
const TITULO = 'Reproductor: lista'

const paradas = [
  { color: '#0B3D2E', posicion: 0 },
  { color: '#2B6CB0', posicion: 1 }
]
interface Opciones {
  color?: string
  resaltado?: string
  subrayar?: boolean
  pantalla?: Record<string, unknown>
  espera?: boolean
}
const estiloCon = ({
  color = '#FFFFFF',
  resaltado = '#FFD400',
  subrayar,
  pantalla,
  espera
}: Opciones = {}) => ({
  version: 1,
  fondo: { tipo: 'degradado', forma: 'lineal', angulo_grados: 160, paradas },
  letra: {
    fuente: { familia: 'Montserrat', origen: 'incluida' },
    color,
    color_resaltado: resaltado,
    ...(subrayar ? { subrayar_cantado: true } : {})
  },
  ...(espera
    ? {
        espera: { puntos: true, barra: true, cuenta: true, primera_entrada: true, umbral_ms: 3000 }
      }
    : {}),
  ...(pantalla ? { pantalla } : {})
})

const CORTOS = [
  'Suben las barcas al puerto',
  'Nadie sabe la canción',
  'Una luz sobre el tejado',
  'Cuenta las olas despacio',
  'Vuelve el coro a la plaza',
  'Y la noche se despierta',
  'Piedras de sal y espuma',
  'Abre los ojos al alba',
  'Fin de la prueba inventada'
]
const LARGOS = [
  'Suben las barcas al puerto cuando la marea se retira y el faro apaga su luz',
  'Nadie sabe la canción que cantan las gaviotas sobre los tejados de la plaza',
  'Una luz de color naranja se derrama despacio por las calles del barrio viejo',
  'Cuenta las olas una por una hasta que el cansancio te cierre los ojos del todo',
  'Vuelve el coro a la plaza con sus tambores y sus faroles de papel de colores',
  'Y la noche se despierta con el ruido lejano de los trenes que cruzan el valle',
  'Piedras de sal y de espuma levantan un muro blanco frente al mar de la tarde',
  'Abre los ojos al alba y verás que todo lo que dejaste sigue esperando aquí',
  'Fin de la prueba inventada para mirar cómo se parte una línea muy larga'
]

type Linea = {
  id: string
  tipo: 'linea'
  texto: string
  inicio_ms: number
  fin_ms: number
  palabras: null
}
const lineas = (textos: string[], inicios: number[], dur = 2800): Linea[] =>
  textos.map((texto, i) => ({
    id: `c${i + 1}`,
    tipo: 'linea',
    texto,
    inicio_ms: inicios[i]!,
    fin_ms: inicios[i]! + dur,
    palabras: null
  }))
/** Nueve líneas seguidas cada 3 s: entre una y otra quedan 200 ms (relevo). */
const SEGUIDAS = Array.from({ length: 9 }, (_, i) => 2000 + i * 3000)
/** Cuatro seguidas, un hueco de 8 s (de 13,4 a 22 s) y tres más. */
const CON_HUECO = [2000, 5000, 8000, 11_000, 22_000, 25_000, 27_500]

type Cambios = Record<string, unknown>
function reescribir(datos: string, n: number, cambios: Cambios): void {
  const id = idSemilla(n)
  const cancion = { ...leerCancion(datos, id), ...cambios }
  writeFileSync(join(datos, 'biblioteca', id, 'cancion.json'), JSON.stringify(cancion))
}
/** Cambia la letra de la canción 20 conservando el resto de su objeto `letra`. */
function conLetra(datos: string, lista: Linea[], resto: Cambios = {}): void {
  const c = leerCancion(datos, ID)
  reescribir(datos, 20, { ...resto, letra: { ...c.letra, offset_ms: 0, lineas: lista } })
}

/** Mezcla `reproductor.subrayar_cantado` en el `config.json` que ya dejó `sembrar` (si lo hay). */
function subrayarEnConfig(datos: string): void {
  const ruta = join(datos, 'config.json')
  const config = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : { esquema: 1 }
  config.reproductor = { ...(config.reproductor ?? {}), subrayar_cantado: true }
  writeFileSync(ruta, JSON.stringify(config))
}

/**
 * Tamaño exacto del contenido. La ventana se redimensiona y, como macOS limita el alto a la pantalla
 * (en un portátil, 757 px), el viewport se fija con CDP al tamaño pedido: la captura sale a ese tamaño.
 */
async function ponerTamano(
  app: ElectronApplication,
  ancho: number,
  alto: number,
  pagina?: Page
): Promise<void> {
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
  if (pagina) {
    const cdp = await pagina.context().newCDPSession(pagina)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: ancho,
      height: alto,
      deviceScaleFactor: await pagina.evaluate(() => window.devicePixelRatio),
      mobile: false
    })
    await new Promise((r) => setTimeout(r, 500))
  }
}

interface Conf {
  dpr?: number
  temas?: boolean
  preparar?: (datos: string) => void
  reducido?: boolean
}
async function conApp(
  nombre: string,
  { dpr = 1, temas = false, preparar, reducido = false }: Conf,
  prueba: (v: Page, app: ElectronApplication, datos: string) => Promise<void>
): Promise<void> {
  const datos = crearTemporal(nombre)
  await sembrar(datos, { temas })
  preparar?.(datos)
  const app = await lanzar(datos, dpr)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
    if (reducido) await v.emulateMedia({ reducedMotion: 'reduce' })
    await prueba(v, app, datos)
  } finally {
    await app.close().catch(() => undefined)
  }
}

function suite(
  titulo: string,
  activa: boolean,
  carpeta: string,
  cuerpo: (c: {
    dir: string
    intentar: (n: string, a: () => Promise<void>) => Promise<void>
    foto: (p: Page, nombre: string) => Promise<void>
  }) => void
): void {
  test.describe(titulo, () => {
    test.skip(!activa, 'se generan solo con la variable SHINOBI_CAPTURAS_022_N=1')
    test.describe.configure({ timeout: 600_000 })
    const dir = join(RAIZ, carpeta)
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
        console.log(`FALLO ${n}: ${String(e).split('\n')[0]}`)
      }
    }
    const foto = async (p: Page, nombre: string): Promise<void> => {
      await p.mouse.move(0, 0).catch(() => undefined)
      await p.waitForTimeout(500)
      await p.screenshot({ path: join(dir, `${nombre}.png`) })
    }
    cuerpo({ dir, intentar, foto })
  })
}

/** Abre «Reproductor: lista» en la principal, la pausa en `ms` y toma una captura por tamaño. */
async function reproductor(
  intentar: (n: string, a: () => Promise<void>) => Promise<void>,
  foto: (p: Page, nombre: string) => Promise<void>,
  estado: string,
  preparar: (datos: string) => void,
  ms: number,
  tamanos: [number, number][],
  conf: Conf = {}
): Promise<void> {
  await intentar(`reproductor-${estado}`, () =>
    conApp(`cap022-rep-${estado}`, { ...conf, preparar }, async (v, app) => {
      await ponerTamano(app, tamanos[0]![0], tamanos[0]![1], v)
      await v.getByRole('searchbox', { name: /^Buscar título/ }).fill(TITULO)
      await tarjeta(v, TITULO)
        .getByRole('button', { name: /^Reproducir/ })
        .click()
      const capa = v.getByRole('dialog', { name: `Reproductor de «${TITULO}»` })
      await expect(capa.getByRole('button', { name: R.tooltip.pausa })).toBeVisible({
        timeout: 15_000
      })
      await capa.getByRole('button', { name: R.tooltip.pausa }).click()
      await capa.getByRole('slider', { name: 'Barra de tiempo' }).fill(String(ms))
      for (const [ancho, alto] of tamanos) {
        await ponerTamano(app, ancho, alto, v)
        const dim = await v.evaluate(() => `${window.innerWidth}x${window.innerHeight}`)
        if (dim !== `${ancho}x${alto}`)
          console.log(`AVISO ${estado}: viewport real ${dim}, pedido ${ancho}x${alto}`)
        await foto(v, `reproductor-${ancho}x${alto}-${estado}`)
      }
    })
  )
}

const DOS: [number, number][] = [
  [1920, 1080],
  [1280, 720]
]
const SOLO_1080: [number, number][] = [[1920, 1080]]

// ---------------------------------------------------------------------------- feature 1
suite('capturas de revisión de 0.2.2 · feature 1', F1, '0.2.2-feature-1', ({ intentar, foto }) => {
  const pant = (p: Record<string, unknown>) => (d: string) =>
    conLetra(d, lineas(CORTOS, SEGUIDAS), { estilo: estiloCon({ pantalla: p }) })

  test('reproductor F1-R25', async () => {
    const base = { lineas: 5, pasadas: 1, transicion: 'desplazamiento' }
    await reproductor(intentar, foto, 'cinco-lineas', pant(base), 8500, DOS)
    await reproductor(
      intentar,
      foto,
      'siete-lineas-dos-cantadas',
      pant({ ...base, lineas: 7, pasadas: 2 }),
      11_500,
      DOS
    )
    await reproductor(intentar, foto, 'dos-lineas', pant({ ...base, lineas: 2 }), 8500, DOS)
    // Relevo en 11 000 ms: «Desplazamiento» dura 350 ms (mitad 175) y «Fundido» 250 ms (mitad 125).
    await reproductor(intentar, foto, 'cambio-desplazamiento-mitad', pant(base), 11_175, DOS)
    await reproductor(
      intentar,
      foto,
      'cambio-fundido-mitad',
      pant({ ...base, transicion: 'fundido' }),
      11_125,
      DOS
    )
    await reproductor(
      intentar,
      foto,
      'pausa-larga-indicadores',
      (d) =>
        conLetra(d, lineas(CORTOS.slice(0, 7), CON_HUECO, 2400), {
          estilo: estiloCon({ pantalla: base, espera: true })
        }),
      19_500,
      DOS
    )
    await reproductor(
      intentar,
      foto,
      'dos-renglones',
      (d) => conLetra(d, lineas(LARGOS, SEGUIDAS), { estilo: estiloCon({ pantalla: base }) }),
      8500,
      DOS
    )
    await reproductor(
      intentar,
      foto,
      'letra-lista',
      (d) =>
        conLetra(d, lineas(CORTOS, SEGUIDAS), {
          estilo: estiloCon({ pantalla: base }),
          modalidad: 'letra_lista'
        }),
      8500,
      DOS
    )
    await reproductor(
      intentar,
      foto,
      'cuatro-tercios-siete-lineas',
      (d) =>
        conLetra(d, lineas(LARGOS, SEGUIDAS), {
          estilo: estiloCon({ pantalla: { ...base, lineas: 7, pasadas: 2 } })
        }),
      11_500,
      [[1440, 1080]]
    )
  })

  // ------------------------------------------------------------------ editor (F1-E16)
  const FORMATOS = [
    { dpr: 1, escala: '100' },
    { dpr: 1.25, escala: '125' }
  ]
  const irAEstilo = async (v: Page): Promise<void> => {
    await v.getByRole('radio', { name: /^Estilo/ }).click()
    await expect(v.getByRole('heading', { name: T_PANTALLA.titulo })).toBeAttached()
    await v.getByRole('heading', { name: T_PANTALLA.titulo }).scrollIntoViewIfNeeded()
  }
  const pausarEn = async (v: Page, ms: number): Promise<void> => {
    await v
      .getByRole('region', { name: 'Reproducción' })
      .getByRole('button', { name: 'Reproducir', exact: true })
      .click()
    await v.getByRole('button', { name: 'Pausar', exact: true }).click()
    await v.getByRole('slider', { name: 'Tiempo de reproducción' }).fill(String(ms))
  }

  for (const f of FORMATOS) {
    test(`editor 1280x720 al ${f.escala} % F1-E16`, async () => {
      const nombre = (estado: string) => `editor-1280x720-${f.escala}-${estado}`
      const css = { ancho: Math.round(1280 / f.dpr), alto: Math.round(720 / f.dpr) }
      const con = (
        id: string,
        conf: Conf,
        prueba: (v: Page, app: ElectronApplication, datos: string) => Promise<void>
      ) =>
        conApp(`cap022-ed-${id}`, { dpr: f.dpr, ...conf }, async (v, app, datos) => {
          await ponerTamano(app, css.ancho, css.alto)
          await prueba(v, app, datos)
        })
      const propio = (p?: Record<string, unknown>) => (d: string) =>
        conLetra(d, lineas(CORTOS, SEGUIDAS), { estilo: estiloCon({ pantalla: p }) })

      await intentar('pantalla-d2', () =>
        con('d2', { preparar: propio() }, async (v) => {
          await abrirEditor(v, TITULO)
          await irAEstilo(v)
          await foto(v, nombre('pantalla-d2'))
        })
      )
      const apariencia = (extra: Record<string, unknown> = {}) => ({
        modo: 'tema',
        tema_id: TEMA_NEON,
        tema_nombre: 'Neón',
        ...extra
      })
      await intentar('pantalla-d1', () =>
        con(
          'd1',
          {
            temas: true,
            preparar: (d) => {
              conLetra(d, lineas(CORTOS, SEGUIDAS), { apariencia: apariencia() })
            }
          },
          async (v) => {
            await abrirEditor(v, TITULO)
            await irAEstilo(v)
            await foto(v, nombre('pantalla-d1'))
          }
        )
      )
      await intentar('pantalla-d1-propia', () =>
        con(
          'd1p',
          {
            temas: true,
            preparar: (d) => {
              conLetra(d, lineas(CORTOS, SEGUIDAS), {
                apariencia: apariencia({
                  reemplazo_pantalla: { lineas: 7, pasadas: 2, transicion: 'fundido' }
                })
              })
            }
          },
          async (v) => {
            await abrirEditor(v, TITULO)
            await irAEstilo(v)
            await foto(v, nombre('pantalla-d1-propia'))
          }
        )
      )
      await intentar('pantalla-no-disponible', () =>
        con(
          'nodisp',
          { preparar: propio({ lineas: 3, pasadas: 0, transicion: 'desplazamiento' }) },
          async (v) => {
            await abrirEditor(v, TITULO)
            await irAEstilo(v)
            // El motivo en texto bajo el control (sin tooltip) tiene que verse.
            await v
              .locator('p', { hasText: T_PANTALLA.minimo1 })
              .first()
              .evaluate((el) => el.scrollIntoView({ block: 'center' }))
            await v.mouse.move(0, 0)
            await foto(v, nombre('pantalla-no-disponible'))
          }
        )
      )
      await intentar('pantalla-ejemplo', () =>
        con('ejemplo', { preparar: propio() }, async (v) => {
          await abrirEditor(v, TITULO)
          await irAEstilo(v)
          await v.getByRole('button', { name: T_PANTALLA.ejemplo }).first().click()
          await v.waitForTimeout(3000)
          await foto(v, nombre('pantalla-ejemplo'))
        })
      )
      await intentar('pantalla-reducido', () =>
        con('reducido', { reducido: true, preparar: propio() }, async (v) => {
          await abrirEditor(v, TITULO)
          await irAEstilo(v)
          await expect(v.getByText(T_PANTALLA.reducido)).toBeVisible()
          await v
            .getByText(T_PANTALLA.reducido)
            .evaluate((el) => el.scrollIntoView({ block: 'center' }))
          await foto(v, nombre('pantalla-reducido'))
        })
      )
      await intentar('previa-pausa-siete', () =>
        con(
          'siete',
          { preparar: propio({ lineas: 7, pasadas: 2, transicion: 'desplazamiento' }) },
          async (v) => {
            await abrirEditor(v, TITULO)
            // La 4.ª línea seleccionada: 2 ya cantadas, la activa y 4 futuras.
            await v.getByRole('option').nth(3).click()
            await pausarEn(v, 11_500)
            await irAEstilo(v)
            await foto(v, nombre('previa-pausa-siete'))
          }
        )
      )
      await intentar('pantalla-300px', () =>
        con('300', { preparar: propio() }, async (v) => {
          await abrirEditor(v, TITULO)
          await irAEstilo(v)
          const panel = v.getByRole('separator', { name: E.layout.divisor.panel })
          await panel.focus()
          await v.keyboard.press('Home')
          await expect(panel).toHaveAttribute('aria-valuenow', '300')
          await v.getByRole('heading', { name: T_PANTALLA.titulo }).scrollIntoViewIfNeeded()
          await foto(v, nombre('pantalla-300px'))
        })
      )
    })
  }
})

// ---------------------------------------------------------------------------- feature 2
suite('capturas de revisión de 0.2.2 · feature 2', F2, '0.2.2-feature-2', ({ intentar, foto }) => {
  const sub = (o: Opciones) => (d: string) =>
    conLetra(d, lineas(CORTOS, SEGUIDAS), { estilo: estiloCon({ subrayar: true, ...o }) })

  test('reproductor F2-R9', async () => {
    // 9 400 ms: la línea de 8 000 ms va por el 50 % (dura 2 800 ms).
    await reproductor(intentar, foto, 'subrayado-mitad', sub({}), 9400, SOLO_1080)
    await reproductor(
      intentar,
      foto,
      'subrayado-dos-renglones',
      (d) => conLetra(d, lineas(LARGOS, SEGUIDAS), { estilo: estiloCon({ subrayar: true }) }),
      9400,
      SOLO_1080
    )
    await reproductor(
      intentar,
      foto,
      'subrayado-barra-espera',
      (d) =>
        conLetra(d, lineas(CORTOS.slice(0, 7), CON_HUECO, 2400), {
          estilo: estiloCon({ subrayar: true, espera: true })
        }),
      19_500,
      SOLO_1080
    )
    await reproductor(
      intentar,
      foto,
      'subrayado-rojo-verde',
      sub({ color: '#E53935', resaltado: '#43A047' }),
      9400,
      SOLO_1080
    )
  })

  const irALetra = async (v: Page): Promise<void> => {
    await v.getByRole('radio', { name: /^Estilo/ }).click()
    await expect(v.getByRole('checkbox', { name: 'Subrayar lo ya cantado' })).toBeAttached()
    await v.getByRole('checkbox', { name: 'Subrayar lo ya cantado' }).scrollIntoViewIfNeeded()
  }
  test('editor 1280x720 al 100 % F2-E11', async () => {
    const nombre = (estado: string) => `editor-1280x720-100-${estado}`
    const con = (
      id: string,
      conf: Conf,
      prueba: (v: Page, app: ElectronApplication, datos: string) => Promise<void>
    ) =>
      conApp(`cap022-ed2-${id}`, conf, async (v, app, datos) => {
        await ponerTamano(app, 1280, 720, v)
        await prueba(v, app, datos)
      })
    const propio =
      (o: Opciones = {}, extra: Cambios = {}) =>
      (d: string) =>
        conLetra(d, lineas(CORTOS, SEGUIDAS), { estilo: estiloCon(o), ...extra })

    await intentar('subrayado-casilla', () =>
      con('casilla', { preparar: propio() }, async (v) => {
        await abrirEditor(v, TITULO)
        await irALetra(v)
        await foto(v, nombre('subrayado-casilla'))
      })
    )
    await intentar('subrayado-previa', () =>
      con('previa', { preparar: propio({ subrayar: true }) }, async (v) => {
        await abrirEditor(v, TITULO)
        await v
          .getByRole('region', { name: 'Reproducción' })
          .getByRole('button', { name: 'Reproducir', exact: true })
          .click()
        await v.getByRole('button', { name: 'Pausar', exact: true }).click()
        await v.getByRole('slider', { name: 'Tiempo de reproducción' }).fill('9400')
        await irALetra(v)
        await foto(v, nombre('subrayado-previa'))
      })
    )
    await intentar('aviso-daltonismo', () =>
      con('aviso', { preparar: propio({ color: '#E53935', resaltado: '#43A047' }) }, async (v) => {
        await abrirEditor(v, TITULO)
        await irALetra(v)
        await v.getByText(/Con daltonismo, lo ya cantado/).scrollIntoViewIfNeeded()
        await foto(v, nombre('aviso-daltonismo'))
      })
    )
    await intentar('subrayado-nota-ajustes', () =>
      con(
        'nota',
        {
          preparar: (d) => {
            propio()(d)
            subrayarEnConfig(d)
          }
        },
        async (v) => {
          await abrirEditor(v, TITULO)
          await irALetra(v)
          await expect(v.getByText(/Ajustes ya lo activa/)).toBeVisible()
          await foto(v, nombre('subrayado-nota-ajustes'))
        }
      )
    )
    await intentar('subrayado-letra-lista', () =>
      con(
        'letralista',
        {
          preparar: propio({ color: '#E53935', resaltado: '#43A047' }, { modalidad: 'letra_lista' })
        },
        async (v) => {
          await abrirEditor(v, TITULO)
          await irALetra(v)
          await v.getByText(/Con daltonismo, lo ya cantado/).scrollIntoViewIfNeeded()
          await foto(v, nombre('subrayado-letra-lista'))
        }
      )
    )
  })

  test('ajustes 1280x800 al 100 % F2-A4', async () => {
    await intentar('ajustes-subrayado', () =>
      conApp(
        'cap022-ajustes',
        {
          preparar: subrayarEnConfig
        },
        async (v, app) => {
          await ponerTamano(app, 1280, 800, v)
          await v.getByRole('button', { name: 'Ajustes', exact: true }).click()
          const casilla = v.getByRole('checkbox', { name: 'Subrayar siempre lo ya cantado' })
          await expect(casilla).toBeChecked()
          await casilla.scrollIntoViewIfNeeded()
          await foto(v, 'ajustes-1280x800-100-reproductor-subrayado')
        }
      )
    )
  })
})

// ---------------------------------------------------------------------------- feature 4
suite('capturas de revisión de 0.2.2 · feature 4', F4, '0.2.2-feature-4', ({ intentar, foto }) => {
  // ------------------------------------------------------------------ vista Letra (F4-L12)
  /** Canción 5 (separada, sin letra) con la voz sintética del doble de LRCLIB. */
  async function conLetraVoz(
    nombre: string,
    prueba: (v: Page, app: ElectronApplication) => Promise<void>
  ): Promise<void> {
    const datos = crearTemporal(nombre)
    await sembrar(datos)
    const id = idSemilla(5)
    const raiz = join(datos, 'biblioteca', id)
    const c = leerCancion(datos, id)
    c.metadatos = {
      ...c.metadatos,
      titulo: TITULOS.conVoz,
      artista: 'Artista inventado',
      album: 'Álbum inventado',
      duracion_ms: 30_000
    }
    writeFileSync(join(raiz, 'cancion.json'), JSON.stringify(c, null, 2))
    writeFileSync(join(raiz, 'pistas', 'voz.flac'), pulsosFlac(VOZ_SINTETICA))
    const srv = await iniciarServidorLrclib()
    const app = await electron.launch({
      args: ['.'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        SHINOBI_DATOS: datos,
        SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
        SHINOBI_SILENCIAR_AUDIO: '1',
        SHINOBI_LRCLIB_URL: srv.url
      }
    })
    try {
      const v = await app.firstWindow()
      await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
      await ponerTamano(app, 1280, 800, v)
      await tarjeta(v, TITULOS.conVoz)
        .getByRole('button', { name: /^Continuar/ })
        .click()
      await expect(v.getByRole('heading', { level: 1, name: 'Letra' })).toBeVisible()
      await prueba(v, app)
    } finally {
      await app.close().catch(() => undefined)
      await srv.cerrar()
    }
  }
  const nombreLetra = (estado: string) => `letra-1280x800-100-${estado}`

  test('letra: candidatos y letra elegida F4-L12', async () => {
    await intentar('letra-candidatos', () =>
      conLetraVoz('cap022-letra', async (v) => {
        const opciones = v.getByRole('option')
        await expect(opciones).toHaveCount(3, { timeout: 30_000 })
        // `comprobacion-pendiente` no se automatiza: los picos de 30 s quedan listos antes de poder fotografiarla.
        const coincide = opciones.filter({ hasText: 'Tema con voz — Artista' }).filter({
          hasNotText: /\(/
        })
        const desfasada = opciones.filter({ hasText: '(adelantada)' })
        const otra = opciones.filter({ hasText: '(otra versión)' })
        await expect(coincide).toContainText(CC.coincide, { timeout: 40_000 })
        // Con la primera (la «otra versión») seleccionada, el aviso de que la mejor es otra.
        const aviso = v.getByText(/Ya hemos comprobado las letras con tu audio/)
        if (await aviso.count()) await foto(v, nombreLetra('aviso-llegada'))
        else console.log('AVISO aviso-llegada: no apareció el aviso')
        // Los tres veredictos a la vista, con los encajes hechos y la lista ordenada.
        await expect(desfasada).toContainText('Va 0,8 s adelantada', { timeout: 40_000 })
        await expect(otra).toContainText(CC.noCoincide, { timeout: 40_000 })
        await v.mouse.move(0, 0)
        await foto(v, nombreLetra('candidatos-comprobados'))
        await desfasada.click()
        await expect(v.getByText(/Toda la letra sale 0,8 s antes que la voz/)).toBeVisible()
        await foto(v, nombreLetra('candidato-desfasado'))
        await otra.click()
        await expect(v.getByText(CC.noCoincideAyuda)).toBeVisible()
        await foto(v, nombreLetra('candidato-no-coincide'))
        await desfasada.click()
        await v.getByRole('button', { name: TEXTO_LETRA.usar }).click()
        await expect(v.getByText(/Movimos toda la letra 0,8 s más tarde/)).toBeVisible()
        await foto(v, nombreLetra('actual-corregida'))
        await v.getByRole('button', { name: CC.boton.quitar }).click()
        await expect(v.getByRole('button', { name: CC.boton.corregir })).toBeVisible()
        await foto(v, nombreLetra('actual-propuesta'))
      })
    )
    await intentar('letra-actual-no-coincide', () =>
      conLetraVoz('cap022-letra-no', async (v) => {
        const opciones = v.getByRole('option')
        await expect(opciones).toHaveCount(3, { timeout: 30_000 })
        const otra = opciones.filter({ hasText: '(otra versión)' })
        await expect(otra).toContainText(CC.noCoincide, { timeout: 40_000 })
        await otra.click()
        await v.getByRole('button', { name: TEXTO_LETRA.usar }).click()
        await expect(v.getByRole('button', { name: CC.boton.porque })).toBeVisible()
        await foto(v, nombreLetra('actual-no-coincide'))
      })
    )
  })

  // ------------------------------------------------------------------ editor (F4-E11)
  const SEIS = [1200, 6200, 11_200, 16_200, 21_200, 26_200]
  /** Letra de seis líneas inventadas; la voz canta 2 s cada 5 s desde el segundo 2. */
  const preparar = (inicios: number[], estado?: 'borrador') => (datos: string) => {
    const raiz = join(datos, 'biblioteca', ID)
    writeFileSync(
      join(raiz, 'pistas', 'voz.flac'),
      pulsosFlac({ segundos: 30, periodoMs: 5000, duracionPulsoMs: 2000, desfaseMs: 2000 })
    )
    const c = leerCancion(datos, ID)
    reescribir(datos, 20, {
      ...(estado
        ? { estado, pasos: { ...c.pasos, edicion: { ...c.pasos.edicion, estado: 'pendiente' } } }
        : {}),
      letra: {
        ...c.letra,
        offset_ms: 0,
        lineas: inicios.map((inicio, i) => ({
          id: `d${i}`,
          tipo: 'linea',
          texto: CORTOS[i % CORTOS.length],
          inicio_ms: inicio,
          fin_ms: inicio + 2000,
          palabras: null
        }))
      }
    })
  }
  const aFunciones = async (v: Page, esperar = true): Promise<void> => {
    await v.getByRole('radio', { name: 'Sincronía' }).click()
    await v.getByRole('radio', { name: 'Funciones' }).click()
    const boton = v.getByRole('button', { name: K.funciones.boton })
    await boton.scrollIntoViewIfNeeded()
    if (esperar)
      await expect(boton).not.toHaveAttribute('aria-disabled', 'true', { timeout: 30_000 })
  }

  test('editor 1280x720 al 100 % F4-E11', async () => {
    const nombre = (estado: string) => `editor-1280x720-100-${estado}`
    const con = (
      id: string,
      conf: Conf,
      prueba: (v: Page, app: ElectronApplication, datos: string) => Promise<void>
    ) =>
      conApp(`cap022-ed4-${id}`, conf, async (v, app, datos) => {
        await ponerTamano(app, 1280, 720, v)
        await abrirEditor(v, TITULO)
        await prueba(v, app, datos)
      })

    await intentar('funciones-comprobar', () =>
      con('func', { preparar: preparar(SEIS) }, async (v) => {
        await aFunciones(v)
        await foto(v, nombre('funciones-comprobar'))
      })
    )
    await intentar('funciones-comprobar-no-disponible', () =>
      con('nodisp', { preparar: preparar([2000, 6000, 10_000]) }, async (v) => {
        await aFunciones(v, false)
        await expect(v.getByText(K.falta.lineas)).toBeVisible()
        await foto(v, nombre('funciones-comprobar-no-disponible'))
      })
    )
    await intentar('dialogo-desfase', () =>
      con('dialogo', { preparar: preparar(SEIS) }, async (v) => {
        await aFunciones(v)
        await v.getByRole('button', { name: K.funciones.boton }).click()
        await expect(v.getByRole('dialog', { name: K.desfase.titulo })).toBeVisible()
        await foto(v, nombre('dialogo-desfase'))
      })
    )
    await intentar('dialogo-no-encaja', () =>
      con(
        'noencaja',
        { preparar: preparar([4300, 8800, 13_700, 17_900, 23_600, 27_100]) },
        async (v) => {
          await aFunciones(v)
          await v.getByRole('button', { name: K.funciones.boton }).click()
          await expect(v.getByRole('dialog', { name: K.noCoincide.titulo })).toBeVisible()
          await foto(v, nombre('dialogo-no-encaja'))
        }
      )
    )
    await intentar('banner-desfase', () =>
      con('banner', { preparar: preparar(SEIS, 'borrador') }, async (v) => {
        await expect(v.getByText(/Esta letra va 0,8 s adelantada respecto a la voz/)).toBeVisible({
          timeout: 40_000
        })
        await foto(v, nombre('banner-desfase'))
      })
    )
    await intentar('desfase-corregido', () =>
      con('corregido', { preparar: preparar(SEIS) }, async (v) => {
        await aFunciones(v)
        await v.getByRole('button', { name: K.funciones.boton }).click()
        await v
          .getByRole('dialog', { name: K.desfase.titulo })
          .getByRole('button', { name: K.desfase.boton })
          .click()
        await expect(v.getByText(/Desfase corregido: toda la letra 0,8 s más tarde/)).toBeVisible()
        await v.waitForTimeout(2500)
        await foto(v, nombre('desfase-corregido'))
      })
    )
  })
})
