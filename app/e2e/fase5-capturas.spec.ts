import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pulsosFlac } from '../src/main/biblioteca/flac'
import { sembrar, TEMA_NEON } from '../src/main/biblioteca/semilla'
import { E } from '../src/renderer/src/vistas/editor/textos'
import { LL } from '../src/renderer/src/vistas/editor/textosLetraLista'
import { S } from '../src/renderer/src/vistas/editor/silencios/textos'
import { T_ESPERA } from '../src/renderer/src/vistas/editor/estilo/textosEspera'
import { R } from '../src/renderer/src/vistas/reproductor/textos'
import { abrirEditor, idSemilla, lanzar } from './fixtures/editor'
import { leerCancion, tarjeta } from './fixtures/separacion'
import { crearTemporal } from './temporales'

/**
 * Capturas de revisión de la fase 5 de 0.2.0 (tarea 0218, `docs/ux/revisiones/0.2.0-fase-5/README.md`):
 * F5-1 (editor), R14 (reproductor) y LB7 (biblioteca). Opt-in:
 * `SHINOBI_CAPTURAS_5=1 npx playwright test e2e/fase5-capturas.spec.ts --workers=1`.
 * No escribe nada en el CI. Cada estado es independiente: si uno falla se anota y se sigue.
 */

const CAPTURAS = process.env.SHINOBI_CAPTURAS_5 === '1'
const DIR = join(process.cwd(), '..', 'docs', 'ux', 'revisiones', '0.2.0-fase-5')
const ID = idSemilla(20)
const TITULO = 'Reproductor: lista'
const SEGUNDOS = 12_300

const paradas = [
  { color: '#0B3D2E', posicion: 0 },
  { color: '#FFE066', posicion: 0.5 },
  { color: '#1E5AA8', posicion: 1 }
]
const estiloCon = (fondo: Record<string, unknown>, espera?: unknown) => ({
  version: 1,
  fondo: { tipo: 'degradado', angulo_grados: 0, paradas, ...fondo },
  letra: {
    fuente: { familia: 'Montserrat', origen: 'incluida' },
    color: '#FFFFFF',
    color_resaltado: '#FFE066'
  },
  ...(espera ? { espera } : {})
})
const RADIAL = { forma: 'radial', centro: { x: 0.5, y: 0.5 }, movimiento: null }
const CONICO = {
  forma: 'conico',
  centro: { x: 0.5, y: 0.5 },
  movimiento: { periodo_s: 30, sentido: 'horario' }
}
const espera = (puntos: boolean, barra: boolean, cuenta: boolean) => ({
  puntos,
  barra,
  cuenta,
  primera_entrada: true,
  umbral_ms: 3000
})

type Cambios = Record<string, unknown>
/** Reescribe `cancion.json` de la canción `n` de la semilla. */
function reescribir(datos: string, n: number, cambios: Cambios): void {
  const id = idSemilla(n)
  const cancion = { ...leerCancion(datos, id), ...cambios }
  writeFileSync(join(datos, 'biblioteca', id, 'cancion.json'), JSON.stringify(cancion))
}

/** Fines fijados bien después de la voz (pulsos cada 2 s): «Ajustar los silencios» los recorta. */
function conFinesLargos(datos: string): void {
  const cancion = leerCancion(datos, ID)
  const fines: Record<string, number> = { r1: 4500, r3: 11_000 }
  cancion.letra.lineas.forEach((l: { id: string; fin_ms: number | null }) => {
    if (l.id in fines) l.fin_ms = fines[l.id]!
  })
  writeFileSync(join(datos, 'biblioteca', ID, 'cancion.json'), JSON.stringify(cancion))
  // Voz con tramos de 1,2 s cada 3 s desde el segundo 2: entre ellos hay silencios reales.
  writeFileSync(
    join(datos, 'biblioteca', ID, 'pistas', 'voz.flac'),
    pulsosFlac({ segundos: 30, periodoMs: 3000, duracionPulsoMs: 1200, desfaseMs: 2000 })
  )
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

interface Opciones {
  dpr?: number
  temas?: boolean
  preparar?: (datos: string) => void
  reducido?: boolean
}

async function conApp(
  nombre: string,
  { dpr = 1, temas = false, preparar, reducido = false }: Opciones,
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

test.describe('capturas de revisión de la fase 5 de 0.2.0', () => {
  test.skip(!CAPTURAS, 'se generan solo con SHINOBI_CAPTURAS_5=1')
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
    await p.screenshot({ path: join(DIR, `${nombre}.png`) })
  }

  // ------------------------------------------------------------------ editor (F5-1)
  const FORMATOS_EDITOR = [
    { dpr: 1, escala: '100' },
    { dpr: 1.25, escala: '125' }
  ]
  const irAEstilo = async (v: Page): Promise<void> => {
    await v.getByRole('radio', { name: /^Estilo/ }).click()
    await expect(v.getByRole('heading', { name: T_ESPERA.titulo })).toBeAttached()
  }
  const verSeccion = (v: Page, titulo: string) =>
    v.getByRole('heading', { name: titulo }).scrollIntoViewIfNeeded()
  const pausarEn = async (v: Page, ms: number): Promise<void> => {
    await v
      .getByRole('region', { name: 'Reproducción' })
      .getByRole('button', { name: 'Reproducir', exact: true })
      .click()
    await v.getByRole('button', { name: 'Pausar', exact: true }).click()
    await v.getByRole('slider', { name: 'Tiempo de reproducción' }).fill(String(ms))
  }

  for (const f of FORMATOS_EDITOR) {
    test(`editor 1280x720 al ${f.escala} %`, async () => {
      const nombre = (estado: string) => `editor-1280x720-${f.escala}-${estado}`
      const css = { ancho: Math.round(1280 / f.dpr), alto: Math.round(720 / f.dpr) }
      const con = (
        id: string,
        opciones: Opciones,
        prueba: (v: Page, app: ElectronApplication, datos: string) => Promise<void>
      ) =>
        conApp(`fase5-cap-${id}`, { dpr: f.dpr, ...opciones }, async (v, app, datos) => {
          await ponerTamano(app, css.ancho, css.alto)
          await prueba(v, app, datos)
        })

      // Fondo radial, cónico en movimiento (a 12,3 s) y movimiento reducido.
      await intentar('fondo-radial', () =>
        con(
          'radial',
          { preparar: (d) => reescribir(d, 20, { estilo: estiloCon(RADIAL) }) },
          async (v) => {
            await abrirEditor(v, TITULO)
            await irAEstilo(v)
            await foto(v, nombre('fondo-radial'))
          }
        )
      )
      await intentar('fondo-conico-movimiento', () =>
        con(
          'conico',
          { preparar: (d) => reescribir(d, 20, { estilo: estiloCon(CONICO) }) },
          async (v) => {
            await abrirEditor(v, TITULO)
            await pausarEn(v, SEGUNDOS)
            await irAEstilo(v)
            await foto(v, nombre('fondo-conico-movimiento'))
          }
        )
      )
      await intentar('fondo-reducido', () =>
        con(
          'reducido',
          { reducido: true, preparar: (d) => reescribir(d, 20, { estilo: estiloCon(CONICO) }) },
          async (v) => {
            await abrirEditor(v, TITULO)
            await irAEstilo(v)
            await expect(v.getByText(E.fondoG.reducido)).toBeVisible()
            await foto(v, nombre('fondo-reducido'))
          }
        )
      )

      // Indicadores de espera: D2 (estilo propio), D1 con indicadores propios y el ejemplo.
      await intentar('espera-d2', () =>
        con(
          'espera-d2',
          {
            preparar: (d) =>
              reescribir(d, 20, { estilo: estiloCon(RADIAL, espera(true, true, false)) })
          },
          async (v) => {
            await abrirEditor(v, TITULO)
            await irAEstilo(v)
            await verSeccion(v, T_ESPERA.titulo)
            await foto(v, nombre('espera-d2'))
          }
        )
      )
      await intentar('espera-d1-propios', () =>
        con(
          'espera-d1',
          {
            temas: true,
            preparar: (d) =>
              reescribir(d, 20, {
                apariencia: {
                  modo: 'tema',
                  tema_id: TEMA_NEON,
                  tema_nombre: 'Neón',
                  reemplazos: { espera: espera(true, true, true) }
                }
              })
          },
          async (v) => {
            await abrirEditor(v, TITULO)
            await irAEstilo(v)
            await verSeccion(v, T_ESPERA.titulo)
            await foto(v, nombre('espera-d1-propios'))
          }
        )
      )
      await intentar('espera-ejemplo', () =>
        con(
          'espera-ejemplo',
          {
            preparar: (d) =>
              reescribir(d, 20, { estilo: estiloCon(RADIAL, espera(true, true, true)) })
          },
          async (v) => {
            await abrirEditor(v, TITULO)
            await irAEstilo(v)
            await verSeccion(v, T_ESPERA.titulo)
            await v.getByRole('button', { name: T_ESPERA.ejemplo }).click()
            await v.waitForTimeout(3500)
            await foto(v, nombre('espera-ejemplo'))
          }
        )
      )

      // Letra lista: dock y diálogo (borrador con todas las líneas sincronizadas).
      const borrador = (d: string): void =>
        reescribir(d, 20, {
          estado: 'borrador',
          pasos: {
            ...leerCancion(d, ID).pasos,
            edicion: { ...leerCancion(d, ID).pasos.edicion, estado: 'pendiente' }
          }
        })
      await intentar('dock-letra-lista', () =>
        con('dock', { preparar: borrador }, async (v) => {
          await abrirEditor(v, TITULO)
          await expect(v.getByRole('button', { name: LL.boton, exact: true })).toBeVisible()
          await foto(v, nombre('dock-letra-lista'))
        })
      )
      await intentar('dialogo-letra-lista', () =>
        con('dialogo-ll', { preparar: borrador }, async (v) => {
          await abrirEditor(v, TITULO)
          await v.getByRole('button', { name: LL.boton, exact: true }).click()
          await expect(v.getByRole('dialog', { name: LL.dialogoTitulo })).toBeVisible()
          await foto(v, nombre('dialogo-letra-lista'))
        })
      )

      // Ajustar los silencios: sin forma de onda (separación interrumpida), diálogo y aplicado.
      await intentar('silencios-no-disponible', () =>
        con('sil-no', {}, async (v) => {
          await abrirEditor(v, 'Editor: separación interrumpida')
          const boton = v.getByRole('button', { name: S.boton, exact: true })
          await boton.evaluate((el) => (el as HTMLElement).click())
          await v.waitForTimeout(1000)
          await foto(v, nombre('silencios-no-disponible'))
        })
      )
      await intentar('dialogo-silencios', () =>
        con('sil-dialogo', { preparar: conFinesLargos }, async (v) => {
          await abrirEditor(v, TITULO)
          await v.getByRole('button', { name: S.boton, exact: true }).click()
          const dialogo = v.getByRole('dialog', { name: S.dialogo.titulo })
          await expect(dialogo).toBeVisible({ timeout: 20_000 })
          await dialogo.getByRole('button', { name: S.verLineas(false) }).click()
          await foto(v, nombre('dialogo-silencios'))
        })
      )
      await intentar('silencios-aplicado', () =>
        con('sil-aplicado', { preparar: conFinesLargos }, async (v) => {
          await abrirEditor(v, TITULO)
          await v.getByRole('button', { name: S.boton, exact: true }).click()
          const dialogo = v.getByRole('dialog', { name: S.dialogo.titulo })
          await expect(dialogo).toBeVisible({ timeout: 20_000 })
          await dialogo.getByRole('button', { name: S.aplicar, exact: true }).click()
          await v.waitForTimeout(1000)
          await foto(v, nombre('silencios-aplicado'))
        })
      )
    })
  }

  // ------------------------------------------------------------------ reproductor (R14)
  const TAMANOS = [
    { ancho: 1920, alto: 1080 },
    { ancho: 1280, alto: 720 }
  ]
  /** Abre «Reproductor: lista» en la principal, en pausa en `ms`, y toma una captura por tamaño. */
  async function reproductor(
    estado: string,
    cambios: Cambios,
    ms: number,
    opciones: Opciones = {}
  ): Promise<void> {
    await intentar(`reproductor-${estado}`, () =>
      conApp(
        `fase5-rep-${estado}`,
        { ...opciones, preparar: (d) => reescribir(d, 20, cambios) },
        async (v, app) => {
          await ponerTamano(app, 1920, 1080)
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
          for (const t of TAMANOS) {
            await ponerTamano(app, t.ancho, t.alto)
            await foto(v, `reproductor-${t.ancho}x${t.alto}-${estado}`)
          }
        }
      )
    )
  }
  test('reproductor: huecos, Letra lista y fondos', async () => {
    // El hueco va de 12 s (pausa) a 16 s (r4); a 14,6 s faltan 1,4 s.
    await reproductor(
      'hueco-tres-indicadores',
      { estilo: estiloCon(RADIAL, espera(true, true, true)) },
      14_600
    )
    await reproductor(
      'hueco-cuenta',
      { estilo: estiloCon(RADIAL, espera(false, false, true)) },
      14_600
    )
    await reproductor(
      'hueco-barra',
      { estilo: estiloCon(RADIAL, espera(false, true, false)) },
      14_000
    )
    await reproductor('letra-lista', { estado: 'lista', modalidad: 'letra_lista' }, 5_500)
    await reproductor(
      'fondo-radial',
      { estilo: estiloCon({ ...RADIAL, movimiento: { periodo_s: 30, sentido: 'horario' } }) },
      SEGUNDOS
    )
    await reproductor('fondo-conico', { estilo: estiloCon(CONICO) }, SEGUNDOS)
  })

  // ------------------------------------------------------------------ biblioteca (LB7)
  test('biblioteca 1280x800 al 100 %: Lista, Letra lista, Letra lista incompleta y borrador', async () => {
    await intentar('biblioteca-letra-lista', () =>
      conApp(
        'fase5-cap-biblioteca',
        {
          preparar: (d) => {
            // Las cuatro, las más recientes, para que abran la rejilla.
            reescribir(d, 20, {
              estado: 'lista',
              modalidad: 'letra_lista',
              modificada: '2026-11-10T10:00:00Z'
            })
            reescribir(d, 21, {
              estado: 'lista',
              modalidad: 'letra_lista',
              modificada: '2026-11-09T10:00:00Z'
            })
            reescribir(d, 1, { modificada: '2026-11-08T10:00:00Z' })
            reescribir(d, 4, { modificada: '2026-11-07T10:00:00Z' })
          }
        },
        async (v, app) => {
          await ponerTamano(app, 1280, 800)
          await expect(tarjeta(v, TITULO)).toContainText('Letra lista')
          await foto(v, 'biblioteca-1280x800-100-letra-lista')
        }
      )
    )
  })
})
