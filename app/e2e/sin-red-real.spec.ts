import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { crearTemporal } from './temporales'

/**
 * Vigila la regla «sin red real en las pruebas»: con la configuración por defecto de Playwright (sin
 * tocar `SHINOBI_LRCLIB_URL` ni `preparacion.automatica`), añadir una canción lanza solo la búsqueda
 * de letra (0308) y esa petición debe salir hacia el sumidero local que fija `preparar-electron.ts`,
 * nunca hacia lrclib.net. Además la app arranca con una regla de Chromium que no resuelve ningún nombre
 * que no sea 127.0.0.1: aunque la protección fallara, nada saldría a internet desde esta prueba.
 */

const SUMIDERO = process.env.SHINOBI_LRCLIB_URL ?? ''
// Sin `test.skip`: si el globalSetup dejara de fijar el sumidero, esta spec debe fallar, no omitirse.
// (Quien defina su propio `SHINOBI_LRCLIB_URL` al ejecutar Playwright la verá fallar: es lo esperado.)

function escribirWav(ruta: string): void {
  const tasa = 22050
  const n = 12 * tasa
  const b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 2, 4)
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
  writeFileSync(ruta, b)
}

interface Recibida {
  metodo: string
  ruta: string
  host: string | undefined
}
const recibidas = async (): Promise<Recibida[]> =>
  (await (await fetch(`${SUMIDERO}/__sumidero`)).json()) as Recibida[]

test('la configuración por defecto apunta a un sumidero local y activa SHINOBI_E2E', () => {
  expect(SUMIDERO).toMatch(/^http:\/\/127\.0\.0\.1:\d{1,5}$/)
  expect(process.env.SHINOBI_E2E).toBe('1')
})

test('añadir una canción con la configuración por defecto solo habla con el sumidero local', async () => {
  test.setTimeout(90_000)
  const datos = crearTemporal('sin-red-real')
  const entrada = join(datos, '..', `entrada-sin-red-${Date.now()}`)
  mkdirSync(entrada, { recursive: true })
  const wav = join(entrada, 'Tema de vigilancia.wav')
  escribirWav(wav)
  // Instalación completa y nada más: la búsqueda automática queda con su valor por defecto (activada).
  writeFileSync(
    join(datos, 'config.json'),
    JSON.stringify({
      esquema: 1,
      instalacion: {
        estado: 'completa',
        fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' },
        perfil_hardware: 'cpu'
      },
      separacion: { modelos_descargados: ['calidad'] }
    })
  )
  const antes = (await recibidas()).length
  const app = await electron.launch({
    args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '.'],
    cwd: process.cwd(),
    // Sin tocar SHINOBI_LRCLIB_URL: se hereda el valor por defecto de `process.env`.
    env: {
      ...process.env,
      SHINOBI_DATOS: datos,
      SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
      SHINOBI_DIALOGO_PRUEBAS: wav
    }
  })
  try {
    const v = await app.firstWindow()
    await v.getByRole('button', { name: 'Añadir canción' }).first().click()
    await v.getByRole('button', { name: 'Elegir archivos…' }).click()
    await expect(v.getByLabel('Título')).toHaveValue('Tema de vigilancia', { timeout: 30_000 })
    await v.getByRole('button', { name: 'Continuar' }).click()
    // La cola automática empieza en el acto: la búsqueda llega al sumidero.
    await expect
      .poll(async () => (await recibidas()).length, { timeout: 30_000 })
      .toBeGreaterThan(antes)
    const nuevas = (await recibidas()).slice(antes)
    const host = new URL(SUMIDERO).host
    expect(nuevas.length).toBeGreaterThan(0)
    for (const p of nuevas) {
      expect(p.host).toBe(host)
      expect(p.ruta).toMatch(/^\/api\//)
    }
  } finally {
    const ventana = app.windows()[0]
    const cierre = app.close()
    await ventana
      ?.getByRole('dialog')
      .getByRole('button', { name: 'Cerrar de todos modos' })
      .click({ timeout: 3000 })
      .catch(() => undefined)
    await cierre
  }
})
