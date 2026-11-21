import { execFile } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { _electron as electron, expect, test } from '@playwright/test'
import { configPredeterminada } from '../src/shared/config'
import { crearTemporal } from './temporales'

const ejecutarElectron = promisify(execFile)

/** Dos pantallas simuladas: la primera es la primaria (ADR 0017 §13). */
const PANTALLAS = JSON.stringify([
  { id: 1, label: 'Principal', bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
  { id: 2, label: 'Escenario', bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
])

test('navegación bloqueada, enlaces por la lista blanca e instancia única', async () => {
  const datos = crearTemporal('seguridad')
  const config = configPredeterminada()
  config.instalacion.estado = 'completa'
  mkdirSync(datos, { recursive: true })
  writeFileSync(join(datos, 'config.json'), JSON.stringify(config))
  const env = { ...process.env, SHINOBI_DATOS: datos }
  const app = await electron.launch({ args: ['.'], cwd: process.cwd(), env })
  try {
    const ventana = await app.firstWindow()
    await expect(ventana.getByRole('banner')).toBeVisible()
    await app.evaluate(({ app, BrowserWindow, shell }) => {
      const g = globalThis as unknown as {
        __abiertos: string[]
        __navegacionBloqueada: boolean
        __segundaInstancia: boolean
      }
      g.__abiertos = []
      g.__navegacionBloqueada = false
      g.__segundaInstancia = false
      const contenido = BrowserWindow.getAllWindows()[0]!.webContents
      contenido.once('will-frame-navigate', (evento) => {
        g.__navegacionBloqueada = evento.defaultPrevented
      })
      app.once('second-instance', () => {
        g.__segundaInstancia = true
      })
      ;(shell as { openExternal: unknown }).openExternal = async (u: string) => {
        g.__abiertos.push(u)
      }
    })
    const urlAntes = ventana.url()
    await ventana.evaluate(
      "window.open('https://example.com'); setTimeout(() => { location.href = 'https://example.com/pagina' }, 0); undefined"
    )
    await ventana.evaluate("window.open('https://lrclib.net/')")
    await expect
      .poll(() =>
        app.evaluate(() => {
          const g = globalThis as unknown as {
            __abiertos: string[]
            __navegacionBloqueada: boolean
          }
          return { abiertos: g.__abiertos, bloqueada: g.__navegacionBloqueada }
        })
      )
      .toEqual({ abiertos: ['https://lrclib.net/'], bloqueada: true })
    expect(ventana.url()).toBe(urlAntes)
    expect(app.windows()).toHaveLength(1)

    // El bloqueo se verifica con la salida del proceso, sin abrir una sesión de depuración.
    const electronExe: string = createRequire(join(process.cwd(), 'package.json'))('electron')
    await ejecutarElectron(electronExe, ['.'], { cwd: process.cwd(), env, timeout: 10_000 })
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) => ({
          avisada: (globalThis as unknown as { __segundaInstancia: boolean }).__segundaInstancia,
          ventanas: BrowserWindow.getAllWindows().length
        }))
      )
      .toEqual({ avisada: true, ventanas: 1 })
  } finally {
    await app.close()
  }
})

test('la secundaria solo ve window.shinobiReproductor, no navega y second-instance enfoca la principal', async () => {
  const datos = crearTemporal('seguridad-secundaria')
  const config = configPredeterminada()
  config.instalacion.estado = 'completa'
  mkdirSync(datos, { recursive: true })
  writeFileSync(join(datos, 'config.json'), JSON.stringify(config))
  const env = { ...process.env, SHINOBI_DATOS: datos, SHINOBI_PANTALLAS_SIMULADAS: PANTALLAS }
  const app = await electron.launch({ args: ['.'], cwd: process.cwd(), env })
  try {
    const principal = await app.firstWindow()
    await expect(principal.getByRole('banner')).toBeVisible()
    // La sesión real (cola vacía): abre `reproductor.html` con el rol `secundaria` (0181).
    const nueva = app.waitForEvent('window')
    await principal.evaluate(() =>
      (
        window as unknown as {
          shinobi: { sesion: { abrir(p: unknown): Promise<unknown> } }
        }
      ).shinobi.sesion.abrir({ pantallaId: 2, pantallaCompleta: false, inicio: { tipo: 'cola' } })
    )
    const secundaria = await nueva
    await secundaria.waitForLoadState('domcontentloaded')
    expect(secundaria.url()).toMatch(/\/reproductor\.html$/)

    // Superficie mínima: solo `shinobiReproductor`, nunca `shinobi`.
    type ConApi = { shinobi?: unknown; shinobiReproductor?: unknown }
    expect(
      await secundaria.evaluate(() => ({
        shinobi: typeof (window as unknown as ConApi).shinobi,
        reproductor: typeof (window as unknown as ConApi).shinobiReproductor
      }))
    ).toEqual({ shinobi: 'undefined', reproductor: 'object' })
    expect(
      await principal.evaluate(() => typeof (window as unknown as ConApi).shinobiReproductor)
    ).toBe('undefined')

    // La secundaria no navega ni siquiera al documento de la principal.
    const urlAntes = secundaria.url()
    await secundaria.evaluate("setTimeout(() => { location.href = '/index.html' }, 0); undefined")
    await secundaria.waitForTimeout(500)
    expect(secundaria.url()).toBe(urlAntes)

    // `second-instance` enfoca la principal aunque la secundaria esté abierta.
    await app.evaluate(({ app: electronApp, BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((v) => !v.webContents.getURL().endsWith('/reproductor.html'))
        ?.minimize()
      electronApp.emit('second-instance', {}, [], '', {})
    })
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .filter((v) => !v.webContents.getURL().endsWith('/reproductor.html'))
            .map((v) => v.isMinimized())
        )
      )
      .toEqual([false])
  } finally {
    await app.close()
  }
})
