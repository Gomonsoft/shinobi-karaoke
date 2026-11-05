import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { crearTemporal } from './temporales'

/**
 * Importar un archivo local con la app compilada y el worker real de desarrollo (0046).
 * El audio se genera aquí (sin archivos de terceros) y el selector nativo se sustituye con
 * `SHINOBI_DIALOGO_PRUEBAS` (se ignora empaquetada, ADR 0009 §8). Requiere `uv` y `av`.
 */

/** WAV PCM 16 bit mono con un tono de 440 Hz. */
function escribirWav(ruta: string, segundos = 30, tasa = 22050): void {
  const n = segundos * tasa
  const b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 2, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20) // PCM
  b.writeUInt16LE(1, 22) // mono
  b.writeUInt32LE(tasa, 24)
  b.writeUInt32LE(tasa * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / tasa)), 44 + i * 2)
  }
  writeFileSync(ruta, b)
}

const sha = (ruta: string): string => createHash('sha256').update(readFileSync(ruta)).digest('hex')

interface Entorno {
  datos: string
  wav: string
  falso: string
}

function preparar(nombre: string): Entorno {
  const datos = crearTemporal(nombre)
  const entrada = join(datos, '..', `entrada-${nombre}-${Date.now()}`)
  mkdirSync(entrada, { recursive: true })
  const wav = join(entrada, 'Mi tema de prueba.wav')
  const falso = join(entrada, 'falso.mp3')
  escribirWav(wav)
  // Instalación completa: sin ella arranca el Primer arranque en vez de la Biblioteca.
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
  writeFileSync(falso, 'esto no es audio, es texto')
  return { datos, wav, falso }
}

async function lanzar(datos: string, dialogo?: string): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHINOBI_DATOS: datos,
      SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
      ...(dialogo ? { SHINOBI_DIALOGO_PRUEBAS: dialogo } : {})
    }
  })
}

/**
 * Cierra la app. La importación encadena la separación (0065) y, sin modelo, el trabajo puede seguir
 * vivo al cerrar: entonces se confirma "Cerrar de todos modos" (0073).
 */
async function cerrar(app: ElectronApplication): Promise<void> {
  const ventana = app.windows()[0]
  const cierre = app.close()
  await ventana
    ?.getByRole('dialog')
    .getByRole('button', { name: 'Cerrar de todos modos' })
    .click({ timeout: 3000 })
    .catch(() => undefined)
  await cierre
}

const subdirs = (d: string): string[] => (existsSync(d) ? readdirSync(d) : [])
const canciones = (datos: string): string[] =>
  subdirs(join(datos, 'biblioteca')).filter((x) => x !== '.importando')
const importando = (datos: string): string[] => subdirs(join(datos, 'biblioteca', '.importando'))

async function irAAnadir(v: Page): Promise<void> {
  await v.getByRole('button', { name: 'Añadir canción' }).first().click()
  await expect(v.getByRole('heading', { level: 1, name: 'Añadir canción' })).toBeVisible()
}

test.describe('importar un archivo local', () => {
  test.describe.configure({ timeout: 60_000 })

  test('elegir: título del archivo, cambiarlo y llegar a la canción con la mezcla', async () => {
    const { datos, wav } = preparar('importar')
    const shaAntes = sha(wav)
    const app = await lanzar(datos, wav)
    try {
      const v = await app.firstWindow()
      await expect(v.getByText('Tu biblioteca está vacía')).toBeVisible()
      await irAAnadir(v)
      await v.getByRole('button', { name: 'Elegir archivo…' }).click()
      await expect(v.getByRole('heading', { name: 'Revisa los datos de la canción' })).toBeVisible({
        timeout: 30_000
      })
      const titulo = v.getByLabel('Título')
      await expect(titulo).toHaveValue('Mi tema de prueba')
      await titulo.fill('Tema importado')
      await v.getByRole('button', { name: 'Continuar' }).click()

      await expect(v.getByRole('heading', { level: 1 })).toBeVisible()
      const fila = v.getByRole('list', { name: 'Subpasos' }).getByRole('listitem').first()
      await expect(fila).toContainText('Preparar el audio')
      await expect(fila).toContainText('completado', { timeout: 30_000 })
      await v.getByRole('button', { name: 'Volver a la biblioteca' }).click()

      const tarjeta = v.getByRole('article', { name: /^Tema importado,/ })
      await expect(tarjeta).toBeVisible()
      // La separación se encadena sola al importar (0065); sin modelo falla, y aquí no se comprueba.

      const [id, ...resto] = canciones(datos)
      expect(resto).toEqual([])
      const carpeta = join(datos, 'biblioteca', id!)
      const json = JSON.parse(readFileSync(join(carpeta, 'cancion.json'), 'utf8'))
      expect(json.metadatos.titulo).toBe('Tema importado')
      expect(json.fuente.tipo).toBe('archivo')
      expect(json.pasos.fuente.estado).toBe('completado')
      expect(typeof json.fuente.ganancia_db).toBe('number')
      expect(
        readFileSync(join(carpeta, 'fuente', 'mezcla.flac'))
          .subarray(0, 4)
          .toString()
      ).toBe('fLaC')
      expect(importando(datos)).toEqual([])
      expect(sha(wav)).toBe(shaAntes)
    } finally {
      await cerrar(app)
    }
  })

  test('cancelar en el formulario no deja nada', async () => {
    const { datos, wav } = preparar('cancelar')
    const app = await lanzar(datos, wav)
    try {
      const v = await app.firstWindow()
      await irAAnadir(v)
      await v.getByRole('button', { name: 'Elegir archivo…' }).click()
      await expect(v.getByRole('heading', { name: 'Revisa los datos de la canción' })).toBeVisible({
        timeout: 30_000
      })
      await v.getByRole('button', { name: 'Cancelar' }).click()
      await expect(v.getByText('Tu biblioteca está vacía')).toBeVisible()
      await expect(v.getByRole('article')).toHaveCount(0)
      expect(canciones(datos)).toEqual([])
      expect(importando(datos)).toEqual([])
    } finally {
      await cerrar(app)
    }
  })

  test('un archivo de texto con extensión .mp3 muestra el error y no deja restos', async () => {
    const { datos, falso } = preparar('falso')
    const app = await lanzar(datos, falso)
    try {
      const v = await app.firstWindow()
      await irAAnadir(v)
      await v.getByRole('button', { name: 'Elegir archivo…' }).click()
      await expect(v.getByRole('alert')).toContainText('No podemos leer este archivo', {
        timeout: 30_000
      })
      expect(canciones(datos)).toEqual([])
      expect(importando(datos)).toEqual([])
    } finally {
      await cerrar(app)
    }
  })

  test('arrastrar el WAV sobre la Biblioteca lee el audio automáticamente', async () => {
    const { datos, wav } = preparar('arrastrar')
    const app = await lanzar(datos)
    try {
      const v = await app.firstWindow()
      await expect(v.getByText('Tu biblioteca está vacía')).toBeVisible()
      // Arrastre real de archivos por CDP: así `webUtils.getPathForFile` devuelve la ruta.
      const cdp = await v.context().newCDPSession(v)
      const punto = { x: 400, y: 300 }
      const data = { items: [], files: [wav], dragOperationsMask: 1 }
      for (const type of ['dragEnter', 'dragOver', 'drop'] as const) {
        await cdp.send('Input.dispatchDragEvent', { type, ...punto, data })
      }
      await expect(v.getByRole('heading', { name: 'Revisa los datos de la canción' })).toBeVisible({
        timeout: 30_000
      })
      await expect(v.getByLabel('Título')).toHaveValue('Mi tema de prueba')
    } finally {
      await cerrar(app)
    }
  })

  test('cerrar la app con el formulario abierto no deja ninguna canción', async () => {
    const { datos, wav } = preparar('cierre')
    const app = await lanzar(datos, wav)
    const v = await app.firstWindow()
    await irAAnadir(v)
    await v.getByRole('button', { name: 'Elegir archivo…' }).click()
    await expect(v.getByRole('heading', { name: 'Revisa los datos de la canción' })).toBeVisible({
      timeout: 30_000
    })
    await cerrar(app)

    const app2 = await lanzar(datos)
    try {
      const v2 = await app2.firstWindow()
      await expect(v2.getByText('Tu biblioteca está vacía')).toBeVisible()
      expect(canciones(datos)).toEqual([])
      expect(importando(datos)).toEqual([])
    } finally {
      await cerrar(app2)
    }
  })
})
