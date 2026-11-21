import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { sembrar } from '../src/main/biblioteca/semilla'
import { SES, COLA, EDI_BLOQUEO } from '../src/renderer/src/sesion/textos'
import type { EstadoSesionIpc } from '../src/shared/sesion'
import { crearTemporal } from './temporales'

/**
 * Capturas de revisión de la fase 4 (tarea 0190, `docs/ux/revision-fase-4/README.md`): S18, P16, E8
 * y AR4. Opt-in: `SHINOBI_CAPTURAS_4=1 npx playwright test e2e/sesion-capturas.spec.ts --workers=1`.
 * No escribe nada en el CI. Cada estado es independiente: si uno falla se anota y se sigue.
 */

const CAPTURAS = process.env.SHINOBI_CAPTURAS_4 === '1'
const DIR = join(process.cwd(), '..', 'docs', 'ux', 'revision-fase-4')
const idSemilla = (n: number): string => `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`
const A = idSemilla(20)
const B = idSemilla(21)
const BORRADOR = idSemilla(4)

const PANTALLAS = [
  { id: 1, label: 'Principal', bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
  { id: 2, label: 'Escenario', bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
]

interface Api {
  shinobi: {
    sesion: {
      abrir(p: unknown): Promise<EstadoSesionIpc>
      estado(): Promise<EstadoSesionIpc>
      solicitarCierre(): Promise<unknown>
    }
    cola: { agregar(cancionId: string, donde: string): Promise<unknown> }
  }
  shinobiReproductor: { sesion: { informar(i: unknown): Promise<{ aplicado: boolean }> } }
}

interface Entorno {
  app: ElectronApplication
  principal: Page
  estado: () => Promise<EstadoSesionIpc>
  abrir: (inicio: unknown) => Promise<Page>
  agregar: (id: string) => Promise<void>
  fin: (secundaria: Page) => Promise<void>
  tamano: (pagina: 'principal' | 'secundaria', ancho: number, alto: number) => Promise<void>
}

async function lanzar(
  dpr: number,
  opciones: { pantallas?: unknown[]; cuentaS?: number } = {}
): Promise<Entorno> {
  const datos = crearTemporal('sesion-capturas')
  await sembrar(datos)
  const rutaConfig = join(datos, 'config.json')
  const config = JSON.parse(readFileSync(rutaConfig, 'utf8'))
  config.reproductor = { ...config.reproductor, transicion_s: opciones.cuentaS ?? 15 }
  writeFileSync(rutaConfig, JSON.stringify(config, null, 2))
  const app = await electron.launch({
    args: ['.', `--force-device-scale-factor=${dpr}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHINOBI_DATOS: datos,
      SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
      SHINOBI_SILENCIAR_AUDIO: '1',
      SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1',
      SHINOBI_PANTALLAS_SIMULADAS: JSON.stringify(opciones.pantallas ?? PANTALLAS),
      SHINOBI_PANTALLA_COMPLETA_SIMULADA: '1'
    }
  })
  const principal = await app.firstWindow()
  await expect(principal.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
  const estado = () => principal.evaluate(() => (window as unknown as Api).shinobi.sesion.estado())
  return {
    app,
    principal,
    estado,
    abrir: async (inicio) => {
      const nueva = app.waitForEvent('window')
      await principal.evaluate(
        (i) =>
          (window as unknown as Api).shinobi.sesion.abrir({
            pantallaId: 2,
            pantallaCompleta: false,
            inicio: i
          }),
        inicio
      )
      const secundaria = await nueva
      await secundaria.waitForLoadState('domcontentloaded')
      return secundaria
    },
    agregar: async (id) => {
      await principal.evaluate(
        (i) => (window as unknown as Api).shinobi.cola.agregar(i, 'final'),
        id
      )
    },
    fin: async (secundaria) => {
      const { sesion, activa } = await estado()
      await secundaria.evaluate(
        ([sesionId, entradaId]) =>
          (window as unknown as Api).shinobiReproductor.sesion.informar({
            tipo: 'fin',
            sesionId,
            entradaId
          }),
        [sesion!.sesionId, activa!.entradaId] as const
      )
    },
    tamano: async (cual, ancho, alto) => {
      await app.evaluate(
        ({ BrowserWindow }, [quien, w, h]) => {
          const todas = BrowserWindow.getAllWindows()
          const sec = (x: Electron.BrowserWindow) =>
            x.webContents.getURL().endsWith('reproductor.html')
          todas
            .filter((x) => (quien === 'secundaria') === sec(x))
            .forEach((x) => {
              x.setContentSize(w as number, h as number)
            })
        },
        [cual, ancho, alto] as const
      )
      await new Promise((r) => setTimeout(r, 600))
    }
  }
}

/** Cierra la aplicación sin pasar por el diálogo de cierre de la sesión. */
async function cerrar(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined)
}

const fase = (e: Entorno) => async () => (await e.estado()).sesion?.fase ?? null

test.describe('capturas de revisión de la fase 4', () => {
  test.skip(!CAPTURAS, 'se generan solo con SHINOBI_CAPTURAS_4=1')
  test.describe.configure({ timeout: 600_000 })

  const fallos: string[] = []
  test.beforeAll(() => mkdirSync(DIR, { recursive: true }))
  test.afterAll(() => {
    if (fallos.length > 0) console.log(`Capturas no tomadas:\n${fallos.join('\n')}`)
  })

  /** Ejecuta un estado; si falla, lo anota y sigue con el siguiente. */
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
    await p.waitForTimeout(400)
    await p.screenshot({ path: join(DIR, `${nombre}.png`) })
  }

  // ------------------------------------------------------------------ biblioteca (S18)
  const FORMATOS_BIB = [
    { ancho: 1280, alto: 800, dpr: 1, escala: '100' },
    { ancho: 1280, alto: 720, dpr: 1.25, escala: '125' }
  ]
  for (const f of FORMATOS_BIB) {
    test(`biblioteca ${f.ancho}x${f.alto} al ${f.escala} %`, async () => {
      const nombre = (estado: string) => `biblioteca-${f.ancho}x${f.alto}-${f.escala}-${estado}`
      const dimensionar = (e: Entorno) =>
        e.tamano('principal', Math.round(f.ancho / f.dpr), Math.round(f.alto / f.dpr))

      // Con una sola pantalla.
      const una = await lanzar(f.dpr, { pantallas: [PANTALLAS[0]] })
      try {
        await dimensionar(una)
        await intentar('dialogo-una-pantalla', async () => {
          await una.principal.getByRole('button', { name: SES.abrirAria }).click()
          await expect(una.principal.getByRole('dialog', { name: SES.dialogoTitulo })).toBeVisible()
          await foto(una.principal, nombre('dialogo-una-pantalla'))
        })
      } finally {
        await cerrar(una.app)
      }

      const e = await lanzar(f.dpr)
      try {
        await dimensionar(e)
        await intentar('dialogo-pantalla', async () => {
          await e.principal.getByRole('button', { name: SES.abrirAria }).click()
          await expect(e.principal.getByRole('dialog', { name: SES.dialogoTitulo })).toBeVisible()
          await foto(e.principal, nombre('dialogo-pantalla'))
          await e.principal.keyboard.press('Escape')
        })

        // Sesión en marcha con una pendiente y una canción que fallará después.
        const sec = await e.abrir({ tipo: 'cancion', cancionId: A, donde: 'ahora' })
        await e.agregar(A)
        await e.agregar(BORRADOR)
        await e.agregar(B)
        await expect.poll(fase(e), { timeout: 30_000 }).toBe('reproduciendo')
        await intentar('tarjetas-sesion', async () => {
          await foto(e.principal, nombre('tarjetas-sesion'))
        })
        await intentar('sesion', async () => {
          await foto(e.principal, nombre('sesion'))
        })
        await intentar('cuenta', async () => {
          await e.fin(sec)
          await expect.poll(fase(e)).toBe('transicion')
          await foto(e.principal, nombre('cuenta'))
        })
        await intentar('fallo', async () => {
          await expect.poll(fase(e), { timeout: 30_000 }).toBe('reproduciendo')
          await e.fin(sec)
          await expect.poll(fase(e), { timeout: 30_000 }).toBe('error')
          await foto(e.principal, nombre('fallo'))
        })
        await intentar('dialogo-cierre', async () => {
          await e.principal.evaluate(() =>
            (window as unknown as Api).shinobi.sesion.solicitarCierre()
          )
          await expect(e.principal.getByRole('dialog')).toBeVisible()
          await foto(e.principal, nombre('dialogo-cierre'))
          await e.principal.getByRole('button', { name: 'Cancelar' }).click()
        })
        await intentar('monitor-desconectado', async () => {
          await e.app.evaluate(() => {
            const g = globalThis as unknown as {
              __shinobiPruebas: { pantallas: { quitar(id: number): void } }
            }
            g.__shinobiPruebas.pantallas.quitar(2)
          })
          await expect(e.principal.getByText(/Se desconectó/)).toBeVisible()
          await foto(e.principal, nombre('monitor-desconectado'))
        })
      } finally {
        await cerrar(e.app)
      }

      // Espera, fin de cola, cola conservada y caída (cada una con su sesión).
      const w = await lanzar(f.dpr)
      try {
        await dimensionar(w)
        const secW = await w.abrir({ tipo: 'cancion', cancionId: A, donde: 'ahora' })
        await w.agregar(B)
        await expect.poll(fase(w), { timeout: 30_000 }).toBe('reproduciendo')
        await intentar('espera', async () => {
          await w.fin(secW)
          await expect.poll(fase(w)).toBe('transicion')
          await secW.getByRole('button', { name: COLA.detener }).click()
          await expect.poll(fase(w)).toBe('espera')
          await foto(w.principal, nombre('espera'))
        })
      } finally {
        await cerrar(w.app)
      }

      const g = await lanzar(f.dpr)
      try {
        await dimensionar(g)
        const sec = await g.abrir({ tipo: 'cancion', cancionId: A, donde: 'ahora' })
        await expect.poll(fase(g), { timeout: 30_000 }).toBe('reproduciendo')
        await intentar('fin-cola', async () => {
          await g.fin(sec)
          await expect.poll(fase(g)).toBe('fin_de_cola')
          await foto(g.principal, nombre('fin-cola'))
        })
        await intentar('cola-conservada', async () => {
          await g.agregar(B)
          await sec.keyboard.press('Control+w')
          await sec.getByRole('button', { name: 'Cerrar y conservar cola' }).click()
          await expect.poll(async () => (await g.estado()).sesion).toBeNull()
          await foto(g.principal, nombre('cola-conservada'))
        })
      } finally {
        await cerrar(g.app)
      }

      const c = await lanzar(f.dpr)
      try {
        await dimensionar(c)
        await c.abrir({ tipo: 'cancion', cancionId: A, donde: 'ahora' })
        await c.agregar(B)
        await expect.poll(fase(c), { timeout: 30_000 }).toBe('reproduciendo')
        await intentar('caida', async () => {
          await c.app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()
              .find((x) => x.webContents.getURL().endsWith('reproductor.html'))!
              .webContents.forcefullyCrashRenderer()
          )
          await expect(c.principal.getByText(/se cerró de forma inesperada/)).toBeVisible()
          await foto(c.principal, nombre('caida'))
        })
      } finally {
        await cerrar(c.app)
      }
    })
  }

  // ------------------------------------------------------------------ reproductor (P16)
  for (const f of [
    { ancho: 1920, alto: 1080 },
    { ancho: 1280, alto: 720 }
  ]) {
    test(`reproductor ${f.ancho}x${f.alto}`, async () => {
      const nombre = (estado: string) => `reproductor-${f.ancho}x${f.alto}-${estado}`
      const e = await lanzar(1)
      try {
        const sec = await e.abrir({ tipo: 'cancion', cancionId: A, donde: 'ahora' })
        await e.tamano('secundaria', f.ancho, f.alto)
        await e.agregar(A)
        await e.agregar(BORRADOR)
        await e.agregar(B)
        await expect.poll(fase(e), { timeout: 30_000 }).toBe('reproduciendo')
        await intentar('cuenta', async () => {
          await e.fin(sec)
          await expect.poll(fase(e)).toBe('transicion')
          await foto(sec, nombre('cuenta'))
          await sec.emulateMedia({ reducedMotion: 'reduce' })
          await foto(sec, nombre('cuenta-reducido'))
          await sec.emulateMedia({ reducedMotion: 'no-preference' })
        })
        await intentar('fallo', async () => {
          await expect.poll(fase(e), { timeout: 30_000 }).toBe('reproduciendo')
          await e.fin(sec)
          await expect.poll(fase(e), { timeout: 30_000 }).toBe('error')
          await foto(sec, nombre('fallo'))
        })
        await intentar('fin-cola', async () => {
          await sec.getByRole('button', { name: COLA.pasar }).click()
          await expect.poll(fase(e), { timeout: 30_000 }).toBe('transicion')
          await expect.poll(fase(e), { timeout: 30_000 }).toBe('reproduciendo')
          await e.fin(sec)
          await expect.poll(fase(e)).toBe('fin_de_cola')
          await foto(sec, nombre('fin-cola'))
        })
        await intentar('reanudada', async () => {
          await e.agregar(A)
          await expect.poll(fase(e)).toBe('transicion')
          await expect.poll(fase(e), { timeout: 30_000 }).toBe('reproduciendo')
          await expect
            .poll(async () => (await e.estado()).activa?.posicionMs ?? 0, { timeout: 20_000 })
            .toBeGreaterThan(3000)
          await e.agregar(B)
          await sec.keyboard.press('Control+w')
          await sec.getByRole('button', { name: 'Cerrar y conservar cola' }).click()
          await expect.poll(async () => (await e.estado()).sesion).toBeNull()
          const nueva = await e.abrir({ tipo: 'reanudar' })
          await e.tamano('secundaria', f.ancho, f.alto)
          await foto(nueva, nombre('reanudada'))
        })
      } finally {
        await cerrar(e.app)
      }

      const v = await lanzar(1)
      try {
        const sec = await v.abrir({ tipo: 'cancion', cancionId: A, donde: 'ahora' })
        await v.tamano('secundaria', f.ancho, f.alto)
        await v.agregar(B)
        await expect.poll(fase(v), { timeout: 30_000 }).toBe('reproduciendo')
        await intentar('espera', async () => {
          await v.fin(sec)
          await expect.poll(fase(v)).toBe('transicion')
          await sec.getByRole('button', { name: COLA.detener }).click()
          await expect.poll(fase(v)).toBe('espera')
          await foto(sec, nombre('espera'))
        })
      } finally {
        await cerrar(v.app)
      }

      const z = await lanzar(1)
      try {
        const sec = await z.abrir({ tipo: 'cola' })
        await z.tamano('secundaria', f.ancho, f.alto)
        await intentar('espera-vacia', async () => {
          await expect.poll(fase(z), { timeout: 30_000 }).toBe('espera')
          await foto(sec, nombre('espera-vacia'))
        })
      } finally {
        await cerrar(z.app)
      }
    })
  }

  // ------------------------------------------------------------------ editor (E8) y ajustes (AR4)
  test('editor y ajustes 1280x800 al 100 %', async () => {
    const e = await lanzar(1, { cuentaS: 4 })
    try {
      await e.tamano('principal', 1280, 800)
      await intentar('ajustes', async () => {
        await e.principal.getByRole('button', { name: 'Ajustes', exact: true }).click()
        const sel = e.principal.getByText('Cuenta entre canciones').first()
        await sel.scrollIntoViewIfNeeded()
        await foto(e.principal, 'ajustes-1280x800-100-reproductor')
        await e.principal.getByRole('button', { name: /Biblioteca$/ }).click()
      })
      await e.abrir({ tipo: 'cancion', cancionId: A, donde: 'ahora' })
      await expect.poll(fase(e), { timeout: 30_000 }).toBe('reproduciendo')
      await intentar('dialogo-bloqueo', async () => {
        await e.principal.getByRole('searchbox', { name: /^Buscar título/ }).fill('Canción lista')
        const tarjeta = e.principal.getByRole('article').first()
        await tarjeta.getByRole('button', { name: /^Más acciones de/ }).click()
        await e.principal
          .getByRole('menuitem', { name: /^(Editar|Continuar)/ })
          .first()
          .dispatchEvent('click')
        await expect(e.principal.getByText(EDI_BLOQUEO.titulo).first()).toBeVisible()
        await foto(e.principal, 'editor-1280x800-100-dialogo-bloqueo')
      })
    } finally {
      await cerrar(e.app)
    }
  })
})
