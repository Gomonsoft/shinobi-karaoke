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
import { iniciarServidorLrclib } from './fixtures/lrclib/servidor'

/**
 * Importar un archivo local con la app compilada y el worker real de desarrollo (0046).
 * El audio se genera aquí (sin archivos de terceros) y el selector nativo se sustituye con
 * `SHINOBI_DIALOGO_PRUEBAS` (se ignora empaquetada, ADR 0009 §8). Requiere `uv` y `av`.
 */

/** WAV PCM 16 bit mono con un tono de 440 Hz. */
function escribirWav(
  ruta: string,
  segundos = 30,
  tasa = 22050,
  etiquetas: Record<string, string> = {}
): void {
  const n = segundos * tasa
  // Etiquetas `LIST/INFO` (INAM título, IART artista, IPRD álbum): FFmpeg las lee como metadatos.
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
  writeFileSync(ruta, Buffer.concat([b.subarray(0, 36), lista, b.subarray(36)]))
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
  subdirs(join(datos, 'biblioteca')).filter(
    (x) => x !== '.importando' && !x.startsWith('temas.json')
  )
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

  test('un archivo etiquetado llega con sus datos y su procedencia, y se unifica con la biblioteca', async () => {
    const { datos } = preparar('etiquetas')
    const entrada = join(datos, '..', `etiquetadas-${Date.now()}`)
    mkdirSync(entrada, { recursive: true })
    const uno = join(entrada, 'pista01.wav')
    const dos = join(entrada, 'pista02.wav')
    escribirWav(uno, 30, 22050, { INAM: 'Tema Alfa', IART: 'Grupo Uno', IPRD: 'Querido…' })
    escribirWav(dos, 30, 22050, { INAM: 'Tema Beta', IART: 'grupo uno', IPRD: 'Querido...' })

    const anadir = async (app: ElectronApplication): Promise<Page> => {
      const v = await app.firstWindow()
      await irAAnadir(v)
      await v.getByRole('button', { name: 'Elegir archivo…' }).click()
      await expect(v.getByRole('heading', { name: 'Revisa los datos de la canción' })).toBeVisible({
        timeout: 30_000
      })
      return v
    }

    const app1 = await lanzar(datos, uno)
    try {
      const v = await anadir(app1)
      await expect(v.getByLabel('Título')).toHaveValue('Tema Alfa')
      await expect(v.getByLabel('Artista')).toHaveValue('Grupo Uno')
      await expect(v.getByLabel('Álbum')).toHaveValue('Querido…')
      await expect(v.getByText('De las etiquetas del archivo')).toHaveCount(3)
      // Si el usuario cambia un campo, su procedencia desaparece.
      await v.getByLabel('Título').fill('Tema Alfa 2')
      await expect(v.getByText('De las etiquetas del archivo')).toHaveCount(2)
      await v.getByRole('button', { name: 'Continuar' }).click()
      await expect(v.getByRole('heading', { level: 1 })).toBeVisible()
    } finally {
      await cerrar(app1)
    }
    const [id] = canciones(datos)
    const json = JSON.parse(readFileSync(join(datos, 'biblioteca', id!, 'cancion.json'), 'utf8'))
    expect(json.metadatos.origen).toEqual({ titulo: 'usuario', artista: 'fuente', album: 'fuente' })

    // Segunda canción: «Querido...» y «grupo uno» se proponen con la grafía de la biblioteca.
    const app2 = await lanzar(datos, dos)
    try {
      const v = await anadir(app2)
      await expect(v.getByLabel('Álbum')).toHaveValue('Querido…')
      await expect(v.getByLabel('Artista')).toHaveValue('Grupo Uno')
      // Artista y álbum se proponen con la grafía de la biblioteca (spec 03, F6 y respuesta a 0232).
      await expect(v.getByText('Como en tu biblioteca')).toHaveCount(2)
      // La lista se cierra sola cuando lo escrito coincide exactamente con la única opción (spec 03).
      await v.getByLabel('Álbum').focus()
      await v.keyboard.press('ArrowDown')
      await expect(v.getByRole('option')).toHaveCount(0)
      // Al escribir una parte, la lista vuelve a ofrecer el valor.
      await v.getByLabel('Álbum').fill('Quer')
      await expect(v.getByRole('option', { name: 'Querido…, 1 canción' })).toBeVisible()
      // Esc cierra la lista sin salir de la vista.
      await v.keyboard.press('Escape')
      await expect(v.getByRole('option')).toHaveCount(0)
      await expect(v.getByRole('heading', { name: 'Revisa los datos de la canción' })).toBeVisible()
    } finally {
      await cerrar(app2)
    }
  })

  test('privacidad: con «Buscar la letra automáticamente» apagado no sale ninguna petición a LRCLIB al añadir', async () => {
    const { datos } = preparar('privacidad')
    // El título coincide con una letra del doble: si saliera una petición, se vería.
    const titulado = join(datos, '..', `Tema completa-${Date.now()}.wav`)
    escribirWav(titulado, 30, 22050, { INAM: 'Tema completa', IART: 'Grupo inventado' })
    const config = JSON.parse(readFileSync(join(datos, 'config.json'), 'utf8'))
    writeFileSync(
      join(datos, 'config.json'),
      JSON.stringify({ ...config, preparacion: { automatica: false } })
    )
    const lrclib = await iniciarServidorLrclib()
    const app = await electron.launch({
      args: ['.'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        SHINOBI_DATOS: datos,
        SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
        SHINOBI_DIALOGO_PRUEBAS: titulado,
        SHINOBI_LRCLIB_URL: lrclib.url
      }
    })
    try {
      const v = await app.firstWindow()
      await irAAnadir(v)
      await v.getByRole('button', { name: 'Elegir archivo…' }).click()
      await expect(v.getByLabel('Título')).toHaveValue('Tema completa', { timeout: 30_000 })
      await v.getByRole('button', { name: 'Continuar' }).click()
      await expect(v.getByRole('heading', { level: 1 })).toBeVisible()
      const fila = v.getByRole('list', { name: 'Subpasos' }).getByRole('listitem').first()
      await expect(fila).toContainText('completado', { timeout: 30_000 })
      // Margen para cualquier búsqueda diferida: la cola automática empezaría en el acto.
      await v.waitForTimeout(3000)
      expect(lrclib.peticiones).toHaveLength(0)
      expect(canciones(datos)).toHaveLength(1)
    } finally {
      await cerrar(app)
      await lrclib.cerrar()
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
