import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { sembrar, TEMA_NEON } from '../src/main/biblioteca/semilla'
import { E } from '../src/renderer/src/vistas/editor/textos'
import { T_PANTALLA } from '../src/renderer/src/vistas/editor/estilo/textosPantalla'
import { R } from '../src/renderer/src/vistas/reproductor/textos'
import { abrirEditor, idSemilla, lanzar } from './fixtures/editor'
import {
  cerrar as cerrarFalso,
  irAAnadir,
  lanzar as lanzarFalso,
  leerCancion,
  preparar as prepararFalso,
  tarjeta
} from './fixtures/separacion'
import { escribirWavConVoz } from './fixtures/lrclib/wavConVoz'
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
 *   SHINOBI_CAPTURAS_022_6=1 npx playwright test e2e/capturas-022.spec.ts --workers=1  (feature 6, 0305)
 *   SHINOBI_CAPTURAS_022_11=1 npx playwright test e2e/capturas-022.spec.ts --workers=1  (feature 11, 0335 y 0337)
 *   SHINOBI_CAPTURAS_022_5=1 npx playwright test e2e/capturas-022.spec.ts --workers=1  (feature 5, 0312)
 *
 * No escribe nada en el CI. Cada estado es independiente: si uno falla se anota y se sigue.
 */

const F1 = process.env.SHINOBI_CAPTURAS_022_1 === '1'
const F2 = process.env.SHINOBI_CAPTURAS_022_2 === '1'
const F4 = process.env.SHINOBI_CAPTURAS_022_4 === '1'
const F11 = process.env.SHINOBI_CAPTURAS_022_11 === '1'
const F6 = process.env.SHINOBI_CAPTURAS_022_6 === '1'
const F5 = process.env.SHINOBI_CAPTURAS_022_5 === '1'
// `SHINOBI_CAPTURAS_RAIZ` permite generar desde otra copia del repositorio sin el submódulo `docs/`.
const RAIZ =
  process.env.SHINOBI_CAPTURAS_RAIZ ?? join(process.cwd(), '..', 'docs', 'ux', 'revisiones')
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
        console.log(`FALLO ${n}: ${String(e).split('\n').slice(0, 8).join(' | ')}`)
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

// ---------------------------------------------------------------------- feature 11 (F11-E16)
suite(
  'capturas de revisión de 0.2.2 · feature 11',
  F11,
  '0.2.2-feature-11',
  ({ intentar, foto }) => {
    /** Voz de 2 s cada 5 s desde el segundo 2; la 2.ª línea acaba 3 s tarde (finTarde) y la 4.ª empieza 0,8 s antes (vozTarde). */
    const CON_DUDAS: [number, number][] = [
      [2000, 4000],
      [7000, 12_000],
      [12_500, 14_000],
      [16_200, 18_200],
      [22_000, 24_000],
      [27_000, 29_000]
    ]
    const SIN_DUDAS: [number, number][] = [2000, 7000, 12_000, 17_000, 22_000, 27_000].map((t) => [
      t,
      t + 2000
    ])
    const preparar =
      (tiempos: [number, number][], borrador: boolean, panel300 = false) =>
      (datos: string) => {
        const raiz = join(datos, 'biblioteca', ID)
        writeFileSync(
          join(raiz, 'pistas', 'voz.flac'),
          pulsosFlac({ segundos: 30, periodoMs: 5000, duracionPulsoMs: 2000, desfaseMs: 2000 })
        )
        const c = leerCancion(datos, ID)
        reescribir(datos, 20, {
          ...(borrador
            ? {
                estado: 'borrador',
                pasos: { ...c.pasos, edicion: { ...c.pasos.edicion, estado: 'pendiente' } }
              }
            : {}),
          letra: {
            ...c.letra,
            offset_ms: 0,
            lineas: tiempos.map(([inicio, fin], i) => ({
              id: `r${i}`,
              tipo: 'linea',
              texto: CORTOS[i % CORTOS.length],
              inicio_ms: inicio,
              fin_ms: fin,
              palabras: null
            }))
          }
        })
        if (panel300) {
          const ruta = join(datos, 'config.json')
          const config = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : { esquema: 1 }
          config.editor = {
            ...(config.editor ?? {}),
            paneles: { ...(config.editor?.paneles ?? {}), panel: { ancho: 300, minimizado: false } }
          }
          writeFileSync(ruta, JSON.stringify(config))
        }
      }

    const tomar = (dpr: number, sufijo: string) => {
      const nombre = (estado: string) => `editor-1280x720-${sufijo}-${estado}`
      const con = (id: string, conf: Conf, prueba: (v: Page) => Promise<void>): Promise<void> =>
        conApp(`cap022-ed11-${sufijo}-${id}`, { ...conf, dpr }, async (v, app) => {
          await ponerTamano(app, 1280, 720, v)
          await abrirEditor(v, TITULO)
          await v.getByRole('radio', { name: 'Sincronía' }).click()
          // Con la voz leída, la lista lleva sus marcas (o, sin dudas, el botón cuenta 0).
          await expect(v.getByRole('radio', { name: 'Funciones' })).toBeVisible()
          await v.waitForTimeout(3000)
          await prueba(v)
        })
      const empezar = async (v: Page) => {
        await v.getByRole('radio', { name: 'Funciones' }).click()
        await v.getByRole('button', { name: /^Revisar \(\d+\)…/ }).click()
        await expect(v.getByRole('region', { name: /Revisión · quedan/ })).toBeVisible()
      }
      const sinScroll = async (v: Page, donde: string) => {
        const m = await v.evaluate(() => [
          document.documentElement.scrollHeight,
          window.innerHeight
        ])
        if (m[0]! > m[1]!) console.log(`AVISO scroll de página en ${donde}: ${m[0]} > ${m[1]}`)
      }
      return async () => {
        await intentar(`funciones-revisar-${sufijo}`, () =>
          con('func', { preparar: preparar(CON_DUDAS, false) }, async (v) => {
            await v.getByRole('radio', { name: 'Funciones' }).click()
            await expect(v.getByRole('button', { name: 'Revisar (2)…' })).toBeVisible()
            await foto(v, nombre('funciones-revisar'))
          })
        )
        await intentar(`lista-con-marcas-${sufijo}`, () =>
          con('lista', { preparar: preparar(CON_DUDAS, false) }, async (v) => {
            await expect(v.getByRole('option', { name: /por revisar/ }).first()).toBeVisible()
            await foto(v, nombre('lista-con-marcas'))
          })
        )
        await intentar(`recorrido-${sufijo}`, () =>
          con('rec', { preparar: preparar(CON_DUDAS, false) }, async (v) => {
            await empezar(v)
            await sinScroll(v, 'recorrido')
            await foto(v, nombre('recorrido'))
          })
        )
        await intentar(`recorrido-corregida-${sufijo}`, () =>
          con('corr', { preparar: preparar(CON_DUDAS, false) }, async (v) => {
            await empezar(v)
            await v.getByRole('button', { name: 'Fin al final de la voz' }).click()
            await expect(v.getByText('✓ Ya no vemos nada raro en esta línea.')).toBeVisible()
            await foto(v, nombre('recorrido-corregida'))
          })
        )
        await intentar(`recorrido-fuera-${sufijo}`, () =>
          con('fuera', { preparar: preparar(CON_DUDAS, false) }, async (v) => {
            await empezar(v)
            await v.getByRole('option', { name: /^Línea 1,/ }).click()
            await expect(v.getByText('Esta línea no está señalada.')).toBeVisible()
            await foto(v, nombre('recorrido-fuera'))
          })
        )
        await intentar(`recorrido-fin-${sufijo}`, () =>
          con('fin', { preparar: preparar(CON_DUDAS, false) }, async (v) => {
            await empezar(v)
            await v.getByRole('button', { name: 'Está bien' }).click()
            await v.getByRole('button', { name: 'Está bien' }).click()
            await expect(v.getByRole('region', { name: 'Revisión terminada' })).toBeVisible()
            await foto(v, nombre('recorrido-fin'))
          })
        )
        await intentar(`popover-pendientes-${sufijo}`, () =>
          con('pop', { preparar: preparar(CON_DUDAS, true) }, async (v) => {
            await expect(v.getByRole('option', { name: /por revisar/ }).first()).toBeVisible()
            await v.getByRole('button', { name: E.marcarLista }).click()
            await expect(v.getByRole('dialog', { name: /por revisar/ })).toBeVisible()
            await foto(v, nombre('popover-pendientes'))
          })
        )
        await intentar(`sin-dudas-${sufijo}`, () =>
          con('nada', { preparar: preparar(SIN_DUDAS, false) }, async (v) => {
            await v.getByRole('radio', { name: 'Funciones' }).click()
            await expect(v.getByText('No vemos nada raro en esta canción.')).toBeVisible()
            await foto(v, nombre('sin-dudas'))
          })
        )
        if (sufijo === '100') {
          await intentar('recorrido-otra-pestana', () =>
            con('otra', { preparar: preparar(CON_DUDAS, false) }, async (v) => {
              await empezar(v)
              await v.getByRole('radio', { name: 'Funciones' }).click()
              await expect(
                v.getByRole('radio', { name: 'Sincronía, hay una revisión en curso' })
              ).toBeVisible()
              await foto(v, nombre('recorrido-otra-pestana'))
            })
          )
          await intentar('recorrido-panel-300', () =>
            con('p300', { preparar: preparar(CON_DUDAS, false, true) }, async (v) => {
              await empezar(v)
              await sinScroll(v, 'panel de 300 px')
              await foto(v, nombre('recorrido-panel-300'))
            })
          )
        }
      }
    }

    // ---- Biblioteca (F11-B4): tarjeta con líneas por revisar, otra sin dudosas y el menú ⋯; y el diálogo.
    const registroLista = (dudosas: number, importantes: number) => {
      const ahora = new Date().toISOString()
      return {
        estado: 'lista_para_revisar',
        paso: null,
        origen: 'automatica',
        actualizado: ahora,
        eleccion: { por: 'app', fecha: ahora, lrclib_id: 4242 },
        fines: { metodo: 'silencios', lineas: 3 },
        dudosas,
        dudosas_importantes: importantes,
        revisada: false
      }
    }
    /** 6: «Lista para revisar» con 4 por revisar (2 importantes); 5: «Lista para revisar» con 0; 15 queda sin registro. */
    const prepararBiblioteca = (datos: string): void => {
      const completa = (n: number): void => {
        const c = leerCancion(datos, idSemilla(n))
        let t = 2000
        for (const l of c.letra.lineas) if (l.tipo === 'linea') l.inicio_ms = t += 3000
        writeFileSync(join(datos, 'biblioteca', idSemilla(n), 'cancion.json'), JSON.stringify(c))
      }
      completa(6)
      reescribir(datos, 6, {
        preparacion: registroLista(4, 2),
        modificada: new Date().toISOString()
      })
      reescribir(datos, 5, {
        preparacion: {
          ...registroLista(0, 0),
          eleccion: { por: 'usuario', fecha: new Date().toISOString(), lrclib_id: null }
        },
        modificada: new Date(Date.now() - 60_000).toISOString(),
        letra: {
          origen: 'manual',
          lrclib_id: null,
          offset_ms: 0,
          lineas: ['Una orilla de papel', 'Dos barcas sin viento', 'Tres luces en la bruma'].map(
            (texto, i) => ({
              id: `b${i}`,
              tipo: 'linea',
              texto,
              inicio_ms: 3000 + i * 3000,
              fin_ms: 5500 + i * 3000,
              palabras: null
            })
          )
        },
        pasos: {
          ...leerCancion(datos, idSemilla(5)).pasos,
          fuente: { estado: 'completado', actualizado: new Date().toISOString(), error: null },
          separacion: { estado: 'completado', actualizado: new Date().toISOString(), error: null },
          letra: { estado: 'completado', actualizado: new Date().toISOString(), error: null }
        }
      })
    }
    test('biblioteca 1280x800 al 100 % F11-B4', async () => {
      await intentar('biblioteca-lista-para-revisar', () =>
        conApp('cap022-bib11', { preparar: prepararBiblioteca }, async (v, app) => {
          await ponerTamano(app, 1280, 800, v)
          const revisar = v.getByRole('article', { name: /^Borrador con letra a medias,/ })
          await expect(revisar).toContainText('4 líneas por revisar')
          await expect(v.getByRole('article', { name: /^Borrador sin letra,/ })).toContainText(
            'Sin líneas dudosas'
          )
          await revisar.getByRole('button', { name: /^Más acciones de/ }).click()
          await expect(
            v.getByRole('menuitem', { name: 'Marcar como lista', exact: true })
          ).toBeVisible()
          await foto(v, 'biblioteca-1280x800-100-lista-para-revisar')
          // El diálogo `bib.revision.dialogo`, con el foco en «Revisar ahora».
          await v.getByRole('menuitem', { name: 'Marcar como lista', exact: true }).click()
          const d = v.getByRole('dialog', { name: '¿Marcar como lista sin revisar?' })
          await expect(d).toBeVisible()
          await expect(d.getByRole('button', { name: 'Revisar ahora' })).toBeFocused()
          await foto(v, 'biblioteca-1280x800-100-revision-dialogo')
        })
      )
    })

    test('editor 1280x720 al 100 % F11-E16', async () => {
      await tomar(1, '100')()
    })
    test('editor 1280x720 al 125 % F11-E16', async () => {
      await tomar(1.25, '125')()
    })
  }
)

// ---------------------------------------------------------------------------- feature 6
/** WAV PCM mono con un tono y etiquetas `LIST/INFO` (INAM título, IART artista, IPRD álbum). */
function escribirWavEtiquetado(ruta: string, etiquetas: Record<string, string> = {}): void {
  const tasa = 22050
  const n = 12 * tasa
  const info = Buffer.concat(
    Object.entries(etiquetas).map(([clave, valor]) => {
      const texto = Buffer.from(`${valor}\0`, 'utf8')
      const relleno = texto.length % 2 ? Buffer.from([0]) : Buffer.alloc(0)
      const cab = Buffer.alloc(8)
      cab.write(clave, 0)
      cab.writeUInt32LE(texto.length, 4)
      return Buffer.concat([cab, texto, relleno])
    })
  )
  const lista =
    info.length === 0
      ? Buffer.alloc(0)
      : Buffer.concat([Buffer.from('LIST'), Buffer.alloc(4), Buffer.from('INFO'), info])
  if (lista.length) lista.writeUInt32LE(lista.length - 8, 4)
  const b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 2 + lista.length, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(tasa, 24)
  b.writeUInt32LE(tasa * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++)
    b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / tasa)), 44 + i * 2)
  writeFileSync(ruta, Buffer.concat([b.subarray(0, 36), lista, b.subarray(36)]))
}

suite('capturas de revisión de 0.2.2 · feature 6', F6, '0.2.2-feature-6', ({ intentar, foto }) => {
  const nombre = (estado: string) => `anadir-1280x800-100-${estado}`
  const ID_YT = 'Marea_00001'

  /**
   * Biblioteca inventada para el autocompletado: «Quimera» (3 canciones, álbumes «Querido…» ×2 y
   * «Cartas al mar»), «Quimera Azul» (1) y «Queen» (3, de la semilla de temas).
   */
  function biblioteca(datos: string): void {
    const poner = (n: number, artista: string, album: string | null): void =>
      reescribir(datos, n, {
        metadatos: { ...leerCancion(datos, idSemilla(n)).metadatos, artista, album }
      })
    poner(1, 'Quimera', 'Querido…')
    poner(2, 'Quimera', 'Querido…')
    poner(3, 'Quimera', 'Cartas al mar')
    poner(4, 'Quimera Azul', null)
    poner(5, 'Queso de Luna', null)
    poner(6, 'Quena Roja', null)
  }

  async function conAnadir(
    nombreApp: string,
    { wav }: { wav?: string },
    prueba: (v: Page, app: ElectronApplication, datos: string) => Promise<void>
  ): Promise<void> {
    const datos = crearTemporal(nombreApp)
    await sembrar(datos, { temas: true })
    biblioteca(datos)
    const falsos = join(datos, '..', `falsos-${nombreApp}-${Date.now()}`)
    mkdirSync(falsos, { recursive: true })
    cpSync(join(process.cwd(), 'e2e', 'fixtures', 'youtube'), falsos, { recursive: true })
    writeFileSync(
      join(falsos, `${ID_YT}.json`),
      JSON.stringify({
        id: ID_YT,
        _type: 'video',
        title: 'Marea baja',
        channel: 'QuimeraVEVO',
        uploader: 'QuimeraVEVO',
        duration: 20,
        live_status: 'not_live',
        is_live: false,
        bytes_por_segundo: 200000,
        ritmo: 3
      })
    )
    cpSync(join(falsos, 'Normal_0001.jpg'), join(falsos, `${ID_YT}.jpg`))
    const ruta = join(datos, 'config.json')
    const config = JSON.parse(readFileSync(ruta, 'utf8'))
    config.aviso_youtube_aceptado = new Date().toISOString()
    writeFileSync(ruta, JSON.stringify(config))
    const app = await electron.launch({
      args: ['--force-device-scale-factor=1', '.'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        SHINOBI_DATOS: datos,
        SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
        SHINOBI_SILENCIAR_AUDIO: '1',
        SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1',
        SHINOBI_YTDLP_FALSO: falsos,
        ...(wav ? { SHINOBI_DIALOGO_PRUEBAS: wav } : {})
      }
    })
    try {
      const v = await app.firstWindow()
      await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
      await ponerTamano(app, 1280, 800, v)
      await prueba(v, app, datos)
    } finally {
      await app.close().catch(() => undefined)
    }
  }

  async function revisarArchivo(v: Page): Promise<void> {
    await v.getByRole('button', { name: 'Añadir canción' }).first().click()
    await v.getByRole('button', { name: 'Elegir archivo…' }).click()
    await expect(v.getByRole('heading', { name: 'Revisa los datos de la canción' })).toBeVisible({
      timeout: 40_000
    })
  }

  function wavEn(carpeta: string, archivo: string, etiquetas?: Record<string, string>): string {
    const dir = join(carpeta, '..', `entrada-f6-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const ruta = join(dir, archivo)
    escribirWavEtiquetado(ruta, etiquetas)
    return ruta
  }

  test('datos con procedencia F6-N11', async () => {
    await intentar('datos-con-procedencia', async () => {
      const wav = wavEn(crearTemporal('cap022-f6-wav1'), 'Quimera - Marea baja.wav', {
        INAM: 'Marea baja',
        IPRD: 'Querido...'
      })
      await conAnadir('cap022-f6-procedencia', { wav }, async (v) => {
        await revisarArchivo(v)
        await expect(v.getByLabel('Álbum')).toHaveValue('Querido…')
        await expect(v.getByText('Como en tu biblioteca')).toBeVisible()
        await expect(v.getByText('De las etiquetas del archivo')).toBeVisible()
        await expect(v.getByText('Del nombre del archivo')).toBeVisible()
        await v.getByRole('button', { name: 'Continuar' }).scrollIntoViewIfNeeded()
        await foto(v, nombre('datos-con-procedencia'))
      })
    })
  })

  test('dato dudoso F6-N11', async () => {
    await intentar('dato-dudoso', async () => {
      await conAnadir('cap022-f6-canal', {}, async (v) => {
        await v.getByRole('button', { name: 'Añadir canción' }).first().click()
        await v.getByRole('radio', { name: 'Enlace de YouTube' }).click()
        await v.getByLabel('Enlace del vídeo').fill(`https://www.youtube.com/watch?v=${ID_YT}`)
        await v.getByRole('button', { name: 'Buscar vídeo' }).click()
        await expect(
          v.getByRole('heading', { name: 'Revisa los datos de la canción' })
        ).toBeVisible({ timeout: 40_000 })
        await expect(v.getByLabel('Artista')).toHaveValue('Quimera')
        await expect(v.getByText('Del nombre del canal: compruébalo')).toBeVisible()
        await v.getByRole('button', { name: 'Descargar y continuar' }).scrollIntoViewIfNeeded()
        await foto(v, nombre('dato-dudoso'))
      })
    })
    await intentar('dato-dudoso-archivo', async () => {
      const wav = wavEn(crearTemporal('cap022-f6-wav2'), 'audio_final2.wav')
      await conAnadir('cap022-f6-nombre', { wav }, async (v) => {
        await revisarArchivo(v)
        await expect(v.getByLabel('Título')).toHaveValue('audio final2')
        await expect(v.getByText('Sin artista es más difícil encontrar la letra.')).toBeVisible()
        await v.getByRole('button', { name: 'Continuar' }).scrollIntoViewIfNeeded()
        await foto(v, nombre('dato-dudoso-archivo'))
      })
    })
  })

  test('autocompletado y unificar F6-N11', async () => {
    const wav = wavEn(crearTemporal('cap022-f6-wav3'), 'Quimera - Marea baja.wav')
    await intentar('autocompletado', () =>
      conAnadir('cap022-f6-auto', { wav }, async (v) => {
        await revisarArchivo(v)
        const artista = v.getByRole('combobox', { name: 'Artista' })
        await artista.fill('')
        await artista.pressSequentially('que')
        await expect(v.getByRole('option')).toHaveCount(3)
        await expect(v.getByRole('option', { name: 'Queen, 3 canciones' })).toBeVisible()
        await foto(v, nombre('autocompletado'))
      })
    )
    await intentar('unificar', () =>
      conAnadir('cap022-f6-unificar', { wav }, async (v) => {
        await revisarArchivo(v)
        const album = v.getByLabel('Álbum')
        await album.fill('Querido...')
        // La sugerencia aparece sola (400 ms) con el foco aún en el campo (spec 03, D1 corregido).
        await expect(
          v.getByText('¿Te refieres a «Querido…», que ya está en tu biblioteca?')
        ).toBeVisible()
        await expect(album).toBeFocused()
        // El formulario no cabe en 800 px: se desplaza para que se vean el campo, la sugerencia y sus botones.
        await v.getByRole('button', { name: /^Usar «Querido/ }).scrollIntoViewIfNeeded()
        await foto(v, nombre('unificar'))
      })
    )
  })

  test('Editar datos de la Biblioteca (F6-N9)', async () => {
    await intentar('editar-datos', () =>
      conAnadir('cap022-f6-editar', {}, async (v) => {
        await v.getByRole('searchbox', { name: /^Buscar título/ }).fill('Canción lista')
        const t = tarjeta(v, 'Canción lista')
        await t.getByRole('button', { name: 'Más acciones de «Canción lista»' }).click()
        await v.getByRole('menuitem', { name: 'Editar datos' }).click()
        const d = v.getByRole('dialog', { name: 'Editar datos' })
        const artista = d.getByRole('combobox', { name: 'Artista' })
        await artista.fill('')
        await artista.pressSequentially('que')
        await expect(v.getByRole('option', { name: 'Queen, 3 canciones' })).toBeVisible()
        await expect(artista).toHaveAttribute('role', 'combobox')
        await foto(v, 'biblioteca-1280x800-100-editar-datos-autocompletado')
        await v.keyboard.press('Escape')
        await expect(d).toBeVisible()
        const album = d.getByLabel('Álbum (opcional)')
        await album.fill('Querido...')
        await expect(
          v.getByText('¿Te refieres a «Querido…», que ya está en tu biblioteca?')
        ).toBeVisible()
        await expect(album).toBeFocused()
        await foto(v, 'biblioteca-1280x800-100-editar-datos-unificar')
        await artista.fill('Quimera')
        await v.keyboard.press('Escape')
        await expect(v.getByRole('option')).toHaveCount(0)
        await expect(d.getByRole('button', { name: 'Intercambiar título y artista' })).toBeVisible()
        await d.getByRole('button', { name: 'Intercambiar título y artista' }).click()
        await expect(d.getByLabel('Título')).toHaveValue('Quimera')
        await expect(artista).toHaveValue('Canción lista')
        await foto(v, 'biblioteca-1280x800-100-editar-datos-intercambio')
      })
    )
  })
})

// ---------------------------------------------------------------------------- feature 5
suite('capturas de revisión de 0.2.2 · feature 5', F5, '0.2.2-feature-5', ({ intentar, foto }) => {
  const ahora = (): string => new Date().toISOString()
  const registro = (estado: string, extra: Record<string, unknown> = {}) => ({
    estado,
    paso: null,
    origen: 'automatica',
    actualizado: ahora(),
    dudosas: 0,
    revisada: false,
    ...extra
  })
  const completa = (datos: string, n: number): void => {
    const c = leerCancion(datos, idSemilla(n))
    let t = 2000
    for (const l of c.letra.lineas) if (l.tipo === 'linea') l.inicio_ms = t += 3000
    writeFileSync(join(datos, 'biblioteca', idSemilla(n), 'cancion.json'), JSON.stringify(c))
  }

  /** Biblioteca con una Lista (1), una «Lista para revisar» (6), un «Elige la letra» (5) y un «No encontramos la letra» (4). */
  const prepararBiblioteca = (datos: string): void => {
    completa(datos, 6)
    reescribir(datos, 6, {
      preparacion: registro('lista_para_revisar', {
        eleccion: { por: 'app', fecha: ahora(), lrclib_id: 4242 },
        fines: { metodo: 'silencios', lineas: 3 },
        dudosas: 2
      }),
      modificada: ahora()
    })
    reescribir(datos, 5, {
      preparacion: registro('elige_letra', {
        busqueda: {
          resultado: 'elige',
          candidatas: 3,
          motivo: null,
          no_elige: 'varias',
          ids: [11, 12, 13]
        }
      }),
      modificada: new Date(Date.now() - 60_000).toISOString()
    })
    // La 3 (una Lista de la semilla) pasa a ser un borrador sin letra: copia de la 5 con otro título.
    const c5 = leerCancion(datos, idSemilla(5))
    reescribir(datos, 3, {
      ...c5,
      id: idSemilla(3),
      metadatos: { ...c5.metadatos, titulo: 'Borrador sin coincidencia', artista: 'Artista Tres' },
      preparacion: registro('sin_letra', {
        busqueda: { resultado: 'sin_letra', candidatas: 0, motivo: null, ids: [] }
      }),
      modificada: new Date(Date.now() - 120_000).toISOString()
    })
    reescribir(datos, 1, { modificada: new Date(Date.now() - 180_000).toISOString() })
  }

  test('biblioteca 1280x800 y 1024x640 al 100 % F5-B11', async () => {
    await intentar('biblioteca-lista-para-revisar', () =>
      conApp('cap022-bib5', { preparar: prepararBiblioteca }, async (v, app) => {
        await ponerTamano(app, 1280, 800, v)
        await expect(
          v.getByRole('article', { name: /^Borrador con letra a medias,/ })
        ).toContainText('Revisar')
        await expect(v.getByRole('article', { name: /^Borrador sin letra,/ })).toContainText(
          'Elige la letra'
        )
        await foto(v, 'biblioteca-1280x800-100-lista-para-revisar')
        const bandeja = v.getByRole('group', { name: 'Pendientes de ti:' })
        await expect(bandeja).toBeVisible()
        await bandeja.getByRole('button').first().focus()
        await foto(v, 'biblioteca-1280x800-100-bandeja')
        await bandeja.getByRole('button', { name: /listas? para revisar/ }).click()
        await expect(v.getByRole('article').first()).toBeVisible()
        await foto(v, 'biblioteca-1280x800-100-bandeja-filtrada')
        await bandeja.getByRole('button', { name: /listas? para revisar/ }).click()
        await ponerTamano(app, 1024, 640, v)
        await foto(v, 'biblioteca-1024x640-100-bandeja')
      })
    )
    await intentar('biblioteca-retomando', async () => {
      const env = prepararFalso('cap022-retomando', { segundos: 60, pasos: 60 })
      await sembrar(env.datos)
      mkdirSync(join(env.datos, 'trabajos'), { recursive: true })
      writeFileSync(
        join(env.datos, 'trabajos', 'pendientes.json'),
        JSON.stringify([
          {
            cancionId: idSemilla(8),
            tipo: 'separacion',
            orden: 0,
            interrupciones: 0,
            enCurso: true
          },
          {
            cancionId: idSemilla(14),
            tipo: 'separacion',
            orden: 1,
            interrupciones: 0,
            enCurso: false
          }
        ])
      )
      const app = await lanzarFalso(
        env,
        { SHINOBI_SILENCIAR_AUDIO: '1', SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1' },
        ['--force-device-scale-factor=1']
      )
      try {
        const v = await app.firstWindow()
        await ponerTamano(app, 1280, 800, v)
        await expect(
          v.getByText(/Retomando 2 canciones que quedaron a medias al cerrar/)
        ).toBeVisible({ timeout: 30_000 })
        await foto(v, 'biblioteca-1280x800-100-retomando')
      } finally {
        await cerrarFalso(app)
      }
    })
  })

  /** Añade el WAV con voz con ese título (y artista) y deja abierta la vista de progreso. */
  async function conFlujo(
    nombre: string,
    titulo: string,
    artista: string | null,
    prueba: (v: Page, app: ElectronApplication) => Promise<void>,
    escenario = { segundos: 3, pasos: 6 }
  ): Promise<void> {
    const env = prepararFalso(nombre, escenario)
    escribirWavConVoz(env.wav)
    const lrclib = await iniciarServidorLrclib()
    const app = await lanzarFalso(
      env,
      { SHINOBI_SILENCIAR_AUDIO: '1', SHINOBI_LRCLIB_URL: lrclib.url },
      ['--force-device-scale-factor=1']
    )
    try {
      const v = await app.firstWindow()
      await ponerTamano(app, 1280, 800, v)
      await irAAnadir(v)
      await v.getByRole('button', { name: 'Elegir archivo…' }).click()
      await expect(v.getByLabel('Título')).toBeVisible({ timeout: 30_000 })
      await v.getByLabel('Título').fill(titulo)
      if (artista) await v.getByLabel('Artista').fill(artista)
      await v.getByRole('button', { name: 'Continuar' }).click()
      await expect(v.getByRole('heading', { level: 1 })).toBeVisible()
      await prueba(v, app)
    } finally {
      await cerrarFalso(app)
      await lrclib.cerrar()
    }
  }

  test('progreso y letra 1280x800 al 100 % F5-P12 y F5-L8', async () => {
    await intentar('progreso-preparando', () =>
      conFlujo(
        'cap022-prog-prep',
        TITULOS.lenta,
        'Artista inventado',
        async (v) => {
          await expect(v.getByText('Preparando tu canción')).toBeVisible({ timeout: 20_000 })
          await expect(
            v.getByRole('list', { name: 'Subpasos' }).getByText(/Buscando la letra en LRCLIB/)
          ).toBeVisible({ timeout: 20_000 })
          await foto(v, 'progreso-1280x800-100-preparando')
        },
        { segundos: 3, pasos: 40 }
      )
    )
    await intentar('progreso-lista-para-revisar y letra-elegida-sola', () =>
      conFlujo('cap022-prog-r1', TITULOS.conVoz, 'Artista inventado', async (v) => {
        await expect(
          v.getByText('Escúchala, corrige lo que no coincida y márcala como lista.')
        ).toBeVisible({
          timeout: 90_000
        })
        await v.getByRole('button', { name: 'Revisar', exact: true }).scrollIntoViewIfNeeded()
        await foto(v, 'progreso-1280x800-100-lista-para-revisar')
        await v.getByRole('button', { name: /^Paso 3/ }).click()
        await expect(v.getByRole('heading', { level: 1, name: 'Letra' })).toBeVisible()
        await expect(v.getByText(/Elegimos esta letra por ti/)).toBeVisible()
        await foto(v, 'letra-1280x800-100-elegida-sola')
      })
    )
    await intentar('progreso-elige-la-letra y letra-elige-la-letra', () =>
      conFlujo('cap022-prog-r2', TITULOS.conVoz, null, async (v) => {
        await expect(v.getByText('Elige la letra', { exact: true }).first()).toBeVisible({
          timeout: 90_000
        })
        await expect(v.getByRole('button', { name: 'Elegir la letra' })).toBeVisible()
        await v.getByRole('button', { name: 'Elegir la letra' }).scrollIntoViewIfNeeded()
        await foto(v, 'progreso-1280x800-100-elige-la-letra')
        await v.getByRole('button', { name: 'Elegir la letra' }).click()
        await expect(v.getByRole('heading', { level: 1, name: 'Letra' })).toBeVisible()
        await expect(v.getByRole('option').first()).toBeVisible({ timeout: 20_000 })
        await v.waitForTimeout(1500)
        await foto(v, 'letra-1280x800-100-elige-la-letra')
      })
    )
    await intentar('progreso-no-encontrada', () =>
      conFlujo('cap022-prog-r3', TITULOS.inexistente, 'Artista inventado', async (v) => {
        await expect(v.getByText('No encontramos la letra', { exact: true }).first()).toBeVisible({
          timeout: 90_000
        })
        await v.getByRole('button', { name: 'Añadir la letra' }).scrollIntoViewIfNeeded()
        await foto(v, 'progreso-1280x800-100-no-encontrada')
      })
    )
    await intentar('progreso-letra-pendiente', () =>
      conApp(
        'cap022-prog-r4',
        {
          preparar: (datos) =>
            reescribir(datos, 5, {
              preparacion: registro('error', {
                busqueda: {
                  resultado: 'pendiente',
                  candidatas: 0,
                  motivo: 'SIN_CONEXION',
                  ids: []
                },
                error: { codigo: 'SIN_CONEXION', mensaje: '' }
              })
            })
        },
        async (v, app) => {
          await ponerTamano(app, 1280, 800, v)
          await v.getByRole('searchbox', { name: /^Buscar título/ }).fill('Borrador sin letra')
          const t = tarjeta(v, 'Borrador sin letra')
          await expect(t).toContainText('Letra pendiente')
          // La vista de progreso de esa canción: por el paso 2 del hilo de pasos de su vista Letra.
          await t.getByRole('button', { name: /^Más acciones de/ }).click()
          await v
            .getByRole('menuitem', { name: /Continuar|Añadir la letra|Elegir la letra/ })
            .first()
            .dispatchEvent('click')
          await expect(v.getByRole('heading', { level: 1 })).toBeVisible()
          await v.getByRole('button', { name: /^Paso 2/ }).click()
          await expect(v.getByRole('heading', { name: /No pudimos buscar la letra/ })).toBeVisible({
            timeout: 20_000
          })
          await foto(v, 'progreso-1280x800-100-letra-pendiente')
        }
      )
    )
  })

  test('editor 1280x720 al 100 % F5-E5', async () => {
    await intentar('editor-preparacion-automatica', () =>
      conApp(
        'cap022-ed5',
        {
          preparar: (datos) => {
            const raiz = join(datos, 'biblioteca', ID)
            writeFileSync(
              join(raiz, 'pistas', 'voz.flac'),
              pulsosFlac({ segundos: 30, periodoMs: 5000, duracionPulsoMs: 2000, desfaseMs: 2000 })
            )
            const c = leerCancion(datos, ID)
            reescribir(datos, 20, {
              estado: 'borrador',
              pasos: { ...c.pasos, edicion: { ...c.pasos.edicion, estado: 'pendiente' } },
              letra: {
                ...c.letra,
                origen: 'lrclib',
                lrclib_id: 4242,
                offset_ms: 0,
                desfase_corregido_ms: 800,
                lineas: [2000, 7000, 12_000, 17_000, 22_000, 27_000].map((inicio, i) => ({
                  id: `p${i}`,
                  tipo: 'linea',
                  texto: CORTOS[i],
                  inicio_ms: inicio,
                  fin_ms: inicio + 2000,
                  palabras: null,
                  ...(i < 4 ? { origen_fin: 'preparacion' } : {})
                }))
              },
              preparacion: registro('lista_para_revisar', {
                eleccion: { por: 'app', fecha: ahora(), lrclib_id: 4242 },
                desfase_ms: 800,
                fines: { metodo: 'silencios', lineas: 4 },
                dudosas: 0
              })
            })
          }
        },
        async (v, app) => {
          await ponerTamano(app, 1280, 720, v)
          await abrirEditor(v, TITULO)
          // «Revisar» abre con la revisión guiada; con 0 pendientes, el fin de la revisión.
          await v.getByRole('radio', { name: 'Funciones' }).click()
          await expect(v.getByRole('heading', { name: 'Preparación automática' })).toBeVisible()
          await v.getByRole('heading', { name: 'Preparación automática' }).scrollIntoViewIfNeeded()
          await foto(v, 'editor-1280x720-100-preparacion-automatica')
        }
      )
    )
  })

  test('ajustes 1280x800 al 100 % F5-J8', async () => {
    const config = (datos: string, automatica: boolean): void => {
      const ruta = join(datos, 'config.json')
      const c = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : { esquema: 1 }
      writeFileSync(ruta, JSON.stringify({ ...c, preparacion: { automatica } }))
    }
    const hacer = async (
      id: string,
      automatica: boolean,
      nombre: string,
      conPendientes: boolean
    ) => {
      const datos = crearTemporal(`cap022-aj5-${id}`)
      await sembrar(datos)
      config(datos, automatica)
      // La semilla trae «Borrador sin letra» (fuente lista y sin letra): cuenta como pendiente. Sin él, no hay aviso.
      if (!conPendientes) {
        for (const n of [4, 5, 6, 14, 15]) {
          const c = leerCancion(datos, idSemilla(n))
          if (c.estado === 'borrador') reescribir(datos, n, { estado: 'lista' })
        }
      }
      const app = await lanzar(datos, 1)
      try {
        const v = await app.firstWindow()
        await ponerTamano(app, 1280, 800, v)
        await v.getByRole('button', { name: 'Ajustes', exact: true }).click()
        await expect(
          v.getByRole('checkbox', { name: /Buscar la letra automáticamente/ })
        ).toBeVisible()
        await v
          .getByRole('heading', { name: 'Letras y preparación automática' })
          .scrollIntoViewIfNeeded()
        if (conPendientes) {
          // Marcar la casilla con borradores «Falta la letra» muestra el aviso con el recuento (F5-J5).
          await v.getByRole('checkbox', { name: /Buscar la letra automáticamente/ }).check()
          await expect(v.getByText(/Tienes \d+ borradores? sin letra/)).toBeVisible({
            timeout: 10_000
          })
        }
        await foto(v, nombre)
      } finally {
        await app.close().catch(() => undefined)
      }
    }
    await intentar('ajustes-letras', () => hacer('a', true, 'ajustes-1280x800-100-letras', false))
    await intentar('ajustes-letras-desactivada', () =>
      hacer('b', false, 'ajustes-1280x800-100-letras-desactivada', false)
    )
    await intentar('ajustes-letras-pendientes', () =>
      hacer('c', false, 'ajustes-1280x800-100-letras-pendientes', true)
    )
  })

  test('Editar datos con datos de LRCLIB 1280x800 al 100 % F5 (F6-N7)', async () => {
    await intentar('editar-datos-lrclib', () =>
      conApp(
        'cap022-lrclib',
        {
          temas: true,
          preparar: (datos) => {
            const c = leerCancion(datos, idSemilla(15))
            reescribir(datos, 15, {
              metadatos: { ...c.metadatos, album: 'Cartas al mar', origen: { album: 'lrclib' } },
              letra: {
                ...c.letra,
                datos_lrclib: {
                  titulo: 'Luces sobre el río dormido',
                  artista: 'Artista Quince',
                  album: 'Orillas de papel'
                }
              }
            })
          }
        },
        async (v, app) => {
          await ponerTamano(app, 1280, 800, v)
          await v
            .getByRole('searchbox', { name: /^Buscar título/ })
            .fill('Letra de LRCLIB sincronizada')
          const t = tarjeta(v, 'Letra de LRCLIB sincronizada')
          await t.getByRole('button', { name: /^Más acciones de/ }).click()
          await v.getByRole('menuitem', { name: 'Editar datos' }).click()
          const d = v.getByRole('dialog', { name: 'Editar datos' })
          await expect(d.getByText(/LRCLIB la llama/)).toBeVisible()
          await foto(v, 'anadir-1280x800-100-editar-datos-lrclib')
        }
      )
    )
  })
})
