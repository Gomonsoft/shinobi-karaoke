import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sembrar } from '../src/main/biblioteca/semilla'
import type { EstadoSesionIpc } from '../src/shared/sesion'
import { crearTemporal } from './temporales'

/**
 * Integración de la sesión con dos renderers reales (0190, ADR 0017 §13): roles y ventanas, avance
 * de la cola, cierre conservando y caída. Lo demás (máquina, cola, cierre, bloqueo) lo cubre Vitest;
 * los duplicados de `fin` ya los comprueba `sesion-main.spec.ts`.
 */

const idSemilla = (n: number): string => `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`
const A = idSemilla(20)
const B = idSemilla(21)

const PANTALLAS = JSON.stringify([
  { id: 1, label: 'Principal', bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
  { id: 2, label: 'Escenario', bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
])

interface Api {
  shinobi: {
    sesion: { abrir(p: unknown): Promise<EstadoSesionIpc>; estado(): Promise<EstadoSesionIpc> }
    cola: { agregar(cancionId: string, donde: string): Promise<unknown> }
  }
  shinobiReproductor: { sesion: { informar(i: unknown): Promise<{ aplicado: boolean }> } }
}

/** Sale sin pasar por la confirmación de cierre (con la sesión abierta `app.close()` la espera). */
async function cerrar(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined)
}

interface Entorno {
  app: ElectronApplication
  principal: Page
  estado: () => Promise<EstadoSesionIpc>
  abrir: (inicio: unknown) => Promise<Page>
  agregar: (id: string) => Promise<void>
  informarFin: (secundaria: Page) => Promise<void>
}

async function lanzar(): Promise<Entorno> {
  const datos = crearTemporal('sesion-flujo')
  await sembrar(datos)
  // Cuenta corta (2 s) para que el avance quepa en la prueba.
  const rutaConfig = join(datos, 'config.json')
  const config = JSON.parse(await readFile(rutaConfig, 'utf8'))
  config.reproductor = { ...config.reproductor, transicion_s: 2 }
  await writeFile(rutaConfig, JSON.stringify(config, null, 2))
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHINOBI_DATOS: datos,
      SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
      SHINOBI_SILENCIAR_AUDIO: '1',
      SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1',
      SHINOBI_PANTALLAS_SIMULADAS: PANTALLAS,
      SHINOBI_PANTALLA_COMPLETA_SIMULADA: '1'
    }
  })
  const principal = await app.firstWindow()
  await expect(principal.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
  // El silencio de E2E de la principal se quita: así se ve que la sesión la silencia y la devuelve.
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.setAudioMuted(false))
  )
  return {
    app,
    principal,
    estado: () => principal.evaluate(() => (window as unknown as Api).shinobi.sesion.estado()),
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
      // Solo suena una ventana en la prueba: la secundaria se silencia para el entorno.
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .filter((w) => w.webContents.getURL().endsWith('reproductor.html'))
          .forEach((w) => w.webContents.setAudioMuted(true))
      )
      return secundaria
    },
    agregar: async (id) => {
      await principal.evaluate(
        (i) => (window as unknown as Api).shinobi.cola.agregar(i, 'final'),
        id
      )
    },
    informarFin: async (secundaria) => {
      const { sesion, activa } = await principal.evaluate(() =>
        (window as unknown as Api).shinobi.sesion.estado()
      )
      await secundaria.evaluate(
        ([sesionId, entradaId]) =>
          (window as unknown as Api).shinobiReproductor.sesion.informar({
            tipo: 'fin',
            sesionId,
            entradaId
          }),
        [sesion!.sesionId, activa!.entradaId] as const
      )
    }
  }
}

/** Canción que suena ahora (o `null` si la sesión no está en `reproduciendo`). */
const sonando = (e: Entorno) => async () => {
  const s = await e.estado()
  return s.sesion?.fase === 'reproduciendo' ? s.activa?.cancionId : null
}

/** Lo que solo main sabe: límites y foco de la secundaria, silencio de la principal y reposo. */
const ventanasDeMain = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow, powerSaveBlocker }) => {
    const todas = BrowserWindow.getAllWindows()
    const sec = todas.find((w) => w.webContents.getURL().endsWith('reproductor.html'))
    const pri = todas.find((w) => !w.webContents.getURL().endsWith('reproductor.html'))
    let reposo = false
    for (let id = 0; id < 100; id++) reposo ||= powerSaveBlocker.isStarted(id)
    return {
      secundaria: sec ? { bounds: sec.getBounds(), enfocada: sec.isFocused() } : null,
      principalSilenciada: pri?.webContents.isAudioMuted() ?? null,
      reposo
    }
  })

test.describe('sesión: flujo con dos ventanas', () => {
  test.describe.configure({ timeout: 90_000 })

  test('roles y ventanas: la secundaria sin `shinobi`, sin foco y la principal operable y silenciada', async () => {
    const e = await lanzar()
    try {
      const secundaria = await e.abrir({ tipo: 'cancion', cancionId: A, donde: 'ahora' })
      await expect.poll(sonando(e), { timeout: 30_000 }).toBe(A)

      const globales = await secundaria.evaluate(() => ({
        reproductor: typeof (window as unknown as Record<string, unknown>).shinobiReproductor,
        shinobi: typeof (window as unknown as Record<string, unknown>).shinobi
      }))
      expect(globales).toEqual({ reproductor: 'object', shinobi: 'undefined' })

      const v = await ventanasDeMain(e.app)
      expect(v.secundaria!.enfocada).toBe(false)
      // La colocación en la pantalla 2 la cubre `ventanaSecundaria.test.ts`: con una sola pantalla
      // real, macOS recoloca las ventanas simuladas fuera de ella. Aquí basta que exista y tenga tamaño.
      expect(v.secundaria!.bounds.width).toBeGreaterThan(0)
      expect(v.principalSilenciada).toBe(true)
      expect(v.reposo).toBe(true)

      // La principal sigue operable: encola y la cola lo refleja, sin abrir su reproductor local.
      await e.agregar(B)
      await expect.poll(async () => (await e.estado()).pendientes.length).toBe(1)
      await expect(e.principal.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
    } finally {
      await cerrar(e.app)
    }
  })

  test('fin y cuenta: la pendiente empieza tras la cuenta; sin pendientes, fin de cola y añadir arranca', async () => {
    const e = await lanzar()
    try {
      const secundaria = await e.abrir({ tipo: 'cancion', cancionId: A, donde: 'ahora' })
      await e.agregar(B)
      await expect.poll(sonando(e), { timeout: 30_000 }).toBe(A)

      await e.informarFin(secundaria)
      await expect.poll(async () => (await e.estado()).sesion?.fase).toBe('transicion')
      await expect.poll(sonando(e), { timeout: 15_000 }).toBe(B)
      expect((await e.estado()).pendientes).toHaveLength(0)

      await e.informarFin(secundaria)
      await expect.poll(async () => (await e.estado()).sesion?.fase).toBe('fin_de_cola')
      expect(secundaria.isClosed()).toBe(false)
      await expect(secundaria.getByText('Fin de la cola', { exact: true }).first()).toBeVisible()

      await e.agregar(A)
      await expect.poll(async () => (await e.estado()).sesion?.fase).toBe('transicion')
      await expect.poll(sonando(e), { timeout: 15_000 }).toBe(A)
    } finally {
      await cerrar(e.app)
    }
  })

  test('cierre conservando la cola y reanudación en su segundo; Esc no cierra', async () => {
    const e = await lanzar()
    try {
      const secundaria = await e.abrir({ tipo: 'cancion', cancionId: A, donde: 'ahora' })
      await e.agregar(B)
      await expect.poll(sonando(e), { timeout: 30_000 }).toBe(A)
      await expect
        .poll(async () => (await e.estado()).activa?.posicionMs ?? 0, { timeout: 20_000 })
        .toBeGreaterThan(3000)

      await secundaria.keyboard.press('Escape')
      await secundaria.waitForTimeout(500)
      expect((await e.estado()).sesion).not.toBeNull()
      expect(secundaria.isClosed()).toBe(false)

      await secundaria.keyboard.press('Control+w')
      await secundaria.getByRole('button', { name: 'Cerrar y conservar cola' }).click()
      await expect.poll(() => secundaria.isClosed()).toBe(true)
      await expect.poll(async () => (await e.estado()).sesion).toBeNull()
      const cerrada = await e.estado()
      expect(cerrada.pendientes.map((p) => p.cancionId)).toEqual([B])
      const interrumpida = cerrada.contexto?.posicionMs ?? cerrada.activa?.posicionMs ?? 0
      expect(interrumpida).toBeGreaterThan(3000)

      await e.abrir({ tipo: 'reanudar' })
      await expect.poll(sonando(e), { timeout: 30_000 }).toBe(A)
      const reanudada = (await e.estado()).activa!.posicionMs
      expect(Math.abs(reanudada - interrumpida)).toBeLessThanOrEqual(1000)
    } finally {
      await cerrar(e.app)
    }
  })

  test('caída de la secundaria: incidencia, cola conservada, edición y sonido de la principal liberados', async () => {
    const e = await lanzar()
    try {
      await e.abrir({ tipo: 'cancion', cancionId: A, donde: 'ahora' })
      await e.agregar(B)
      await expect.poll(sonando(e), { timeout: 30_000 }).toBe(A)
      expect((await ventanasDeMain(e.app)).reposo).toBe(true)

      await e.app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('reproductor.html'))!
          .webContents.forcefullyCrashRenderer()
      )

      await expect.poll(async () => (await e.estado()).sesion).toBeNull()
      const s = await e.estado()
      expect(s.incidencia).toEqual({ tipo: 'secundaria_caida' })
      expect(s.pendientes.map((p) => p.cancionId)).toEqual([B])
      await expect(e.principal.getByText(/se cerró de forma inesperada/)).toBeVisible()
      const v = await ventanasDeMain(e.app)
      expect(v.reposo).toBe(false)
      expect(v.principalSilenciada).toBe(false)
    } finally {
      await cerrar(e.app)
    }
  })
})
