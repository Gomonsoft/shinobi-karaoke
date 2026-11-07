import { execFile } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { _electron as electron, expect, test } from '@playwright/test'
import { configPredeterminada } from '../src/shared/config'
import { crearTemporal } from './temporales'

const ejecutarElectron = promisify(execFile)

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
