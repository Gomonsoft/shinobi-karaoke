import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Locator,
  type Page
} from '@playwright/test'
import { crearTemporal } from './temporales'

/**
 * Importar desde YouTube con la app compilada y el worker real de desarrollo, sin red (0053).
 * `SHINOBI_YTDLP_FALSO` apunta a una copia temporal de `e2e/fixtures/youtube/` (ADR 0009 §8): el
 * doble de yt-dlp lee los JSON y genera el audio con PyAV; "bloqueado una vez" guarda su estado
 * en esa copia. Requiere `uv` y `av` (como `importar-archivo.spec.ts`).
 */

const FIXTURES = join(process.cwd(), 'e2e', 'fixtures', 'youtube')
const URL_YT = (id: string): string => `https://www.youtube.com/watch?v=${id}`
const NORMAL = 'Normal_0001'
const OTRO = 'Normal_0002'
const NO_DISPONIBLE = 'NoDispon_01'
const BLOQ_UNA = 'Bloq_Una_01'
const BLOQ_SIEMPRE = 'Bloq_Siem_1'
const DIRECTO = 'Directo_001'

const TITULO_NORMAL = 'Artista Ejemplo - Canción de prueba (Official Video) [HD]'

interface Entorno {
  datos: string
  falsos: string
}

function preparar(nombre: string, avisoAceptado = true): Entorno {
  const datos = crearTemporal(nombre)
  const falsos = join(datos, '..', `falsos-${nombre}-${Date.now()}`)
  mkdirSync(falsos, { recursive: true })
  cpSync(FIXTURES, falsos, { recursive: true })
  // Instalación completa: sin ella arranca el Primer arranque en vez de la Biblioteca.
  escribirConfig(datos, avisoAceptado ? { aviso_youtube_aceptado: new Date().toISOString() } : {})
  return { datos, falsos }
}

function escribirConfig(datos: string, extra: Record<string, unknown>): void {
  writeFileSync(
    join(datos, 'config.json'),
    JSON.stringify({
      esquema: 1,
      instalacion: {
        estado: 'completa',
        fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' },
        perfil_hardware: 'cpu'
      },
      separacion: { modelos_descargados: ['calidad'] },
      ...extra
    })
  )
}

/** Cambia claves de una fixture en la copia temporal (p. ej. alargar la descarga). */
function ajustar(falsos: string, id: string, cambios: Record<string, unknown>): void {
  const ruta = join(falsos, `${id}.json`)
  writeFileSync(ruta, JSON.stringify({ ...JSON.parse(readFileSync(ruta, 'utf8')), ...cambios }))
}

async function lanzar(
  { datos, falsos }: Entorno,
  extra: Record<string, string> = {}
): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHINOBI_DATOS: datos,
      SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
      SHINOBI_YTDLP_FALSO: falsos,
      ...extra
    }
  })
}

const subdirs = (d: string): string[] => (existsSync(d) ? readdirSync(d) : [])
const canciones = (datos: string): string[] =>
  subdirs(join(datos, 'biblioteca')).filter((x) => x !== '.importando')
interface CancionJson {
  metadatos: { titulo: string }
  fuente: { tipo: string } & Record<string, unknown>
  pasos: { fuente: { estado: string; error: { codigo: string } } }
}
const leerCancion = (datos: string, id: string): CancionJson =>
  JSON.parse(readFileSync(join(datos, 'biblioteca', id, 'cancion.json'), 'utf8'))
const registrosWorker = (datos: string): string[] =>
  subdirs(join(datos, 'registros')).filter((n) => /^worker-.*\.log$/.test(n))

async function irAYoutube(v: Page): Promise<void> {
  await v.getByRole('button', { name: 'Añadir canción' }).first().click()
  await expect(v.getByRole('heading', { level: 1, name: 'Añadir canción' })).toBeVisible()
  await v.getByRole('radio', { name: 'Enlace de YouTube' }).click()
  await expect(campoUrl(v)).toBeVisible()
}

const campoUrl = (v: Page): Locator => v.getByLabel('Enlace del vídeo')

async function buscar(v: Page, url: string): Promise<void> {
  await campoUrl(v).fill(url)
  await v.getByRole('button', { name: 'Buscar vídeo' }).click()
}

async function vistaPrevia(v: Page): Promise<void> {
  await expect(v.getByRole('heading', { name: 'Revisa los datos de la canción' })).toBeVisible({
    timeout: 30_000
  })
}

const filaDescarga = (v: Page): Locator =>
  v.getByRole('list', { name: 'Subpasos' }).getByRole('listitem').first()
const filaPreparar = (v: Page): Locator =>
  v.getByRole('list', { name: 'Subpasos' }).getByRole('listitem').nth(1)

/** Añade `id` desde la pestaña YouTube hasta llegar a la vista de progreso. */
async function añadir(v: Page, id: string, titulo?: string): Promise<void> {
  await irAYoutube(v)
  await buscar(v, URL_YT(id))
  await vistaPrevia(v)
  if (titulo) await v.getByLabel('Título').fill(titulo)
  await v.getByRole('button', { name: 'Descargar y continuar' }).click()
  await expect(filaDescarga(v)).toContainText('Descargar de YouTube')
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

test.describe('importar desde YouTube (doble de yt-dlp, sin red)', () => {
  test.describe.configure({ timeout: 90_000 })

  test('primera vez: aviso legal, rechazarlo no guarda nada y aceptarlo se recuerda', async () => {
    const env = preparar('yt-aviso', false)
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await expect(v.getByText('Tu biblioteca está vacía')).toBeVisible()
      await v.getByRole('button', { name: 'Añadir canción' }).first().click()
      await v.getByRole('radio', { name: 'Enlace de YouTube' }).click()
      await expect(v.getByRole('heading', { name: 'Antes de usar YouTube' })).toBeVisible()
      await expect(campoUrl(v)).toHaveCount(0)

      await v.getByRole('button', { name: 'Usar un archivo en su lugar' }).click()
      await expect(v.getByRole('button', { name: 'Elegir archivo…' })).toBeVisible()
      const sinAceptar = JSON.parse(readFileSync(join(env.datos, 'config.json'), 'utf8'))
      expect(sinAceptar.aviso_youtube_aceptado ?? null).toBeNull()

      await v.getByRole('radio', { name: 'Enlace de YouTube' }).click()
      await expect(v.getByRole('heading', { name: 'Antes de usar YouTube' })).toBeVisible()
      await v.getByRole('button', { name: 'Entendido' }).click()
      await expect(campoUrl(v)).toBeVisible()
      await expect
        .poll(() => {
          const c = JSON.parse(readFileSync(join(env.datos, 'config.json'), 'utf8'))
          return typeof c.aviso_youtube_aceptado
        })
        .toBe('string')
    } finally {
      await cerrar(app)
    }

    const app2 = await lanzar(env)
    try {
      const v = await app2.firstWindow()
      await expect(v.getByText('Tu biblioteca está vacía')).toBeVisible()
      await v.getByRole('button', { name: 'Añadir canción' }).first().click()
      await v.getByRole('radio', { name: 'Enlace de YouTube' }).click()
      await expect(campoUrl(v)).toBeVisible()
      await expect(v.getByRole('heading', { name: 'Antes de usar YouTube' })).toHaveCount(0)
    } finally {
      await cerrar(app2)
    }
  })

  test('URL de otro sitio o de lista: error local sin lanzar el worker', async () => {
    const env = preparar('yt-urls')
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await irAYoutube(v)
      const antes = registrosWorker(env.datos)

      await buscar(v, 'https://vimeo.com/123456789')
      await expect(v.getByRole('alert')).toContainText('Este enlace no es de un vídeo de YouTube')
      await buscar(v, 'https://www.youtube.com/playlist?list=PLabcdefghijklmnop')
      await expect(v.getByRole('alert')).toContainText(
        'Las listas y los directos no se pueden usar'
      )

      // Tampoco hay vista previa ni canción, y el worker no escribió ningún registro nuevo.
      await expect(v.getByRole('heading', { name: 'Revisa los datos de la canción' })).toHaveCount(
        0
      )
      expect(registrosWorker(env.datos)).toEqual(antes)
      expect(canciones(env.datos)).toEqual([])
    } finally {
      await cerrar(app)
    }
  })

  test('descargar: vista previa, título editado, progreso, mezcla y miniatura en la tarjeta', async () => {
    const env = preparar('yt-descarga')
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await irAYoutube(v)
      await buscar(v, URL_YT(NORMAL))
      await vistaPrevia(v)
      // Datos que solo pueden venir de la fixture: el doble está activo y no hay red.
      await expect(v.getByText(TITULO_NORMAL)).toBeVisible()
      await expect(v.getByText('ArtistaEjemploVEVO · 0:35')).toBeVisible()
      await expect(
        v
          .getByRole('img', { name: /miniatura/i })
          .or(v.locator('[class*="miniatura" i]'))
          .first()
      ).toBeVisible()
      await v.getByLabel('Título').fill('Tema de YouTube')
      await v.getByRole('button', { name: 'Descargar y continuar' }).click()

      await expect(filaDescarga(v)).toContainText('Descargar de YouTube')
      await expect(filaDescarga(v)).toContainText(/Descargando… \d+ %/, { timeout: 30_000 })
      await expect(filaDescarga(v)).toContainText(/MB de /)
      await expect(filaPreparar(v)).toContainText('Preparar el audio')
      await expect(filaPreparar(v)).toContainText('completado', { timeout: 60_000 })
      await expect(filaDescarga(v)).toContainText('completado')

      const [id, ...resto] = canciones(env.datos)
      expect(resto).toEqual([])
      const carpeta = join(env.datos, 'biblioteca', id!)
      const json = leerCancion(env.datos, id!)
      expect(json.metadatos.titulo).toBe('Tema de YouTube')
      expect(json.fuente.tipo).toBe('youtube')
      expect(json.pasos.fuente.estado).toBe('completado')
      expect(
        readFileSync(join(carpeta, 'fuente', 'mezcla.flac'))
          .subarray(0, 4)
          .toString()
      ).toBe('fLaC')
      expect(existsSync(join(carpeta, 'fuente', 'miniatura.jpg'))).toBe(true)
      expect(readdirSync(join(carpeta, 'fuente')).filter((n) => /^descarga\./.test(n))).toEqual([])
      expect(existsSync(join(carpeta, 'fuente', 'mezcla.flac.tmp'))).toBe(false)

      await v.getByRole('button', { name: 'Volver a la biblioteca' }).click()
      const tarjeta = v.getByRole('article', { name: /^Tema de YouTube,/ })
      await expect(tarjeta).toBeVisible()
      await expect(tarjeta.locator('[style*="shinobi-media://"]')).toHaveCount(1)
      expect(await tarjeta.locator('[style*="shinobi-media://"]').getAttribute('style')).toContain(
        `${id}/fuente/miniatura.jpg`
      )
    } finally {
      await cerrar(app)
    }
  })

  test('vídeo no disponible: error en la vista previa y ninguna canción', async () => {
    const env = preparar('yt-nodisp')
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await irAYoutube(v)
      await buscar(v, URL_YT(NO_DISPONIBLE))
      await expect(v.getByRole('alert')).toContainText('Este vídeo no está disponible', {
        timeout: 30_000
      })
      await expect(v.getByRole('heading', { name: 'Revisa los datos de la canción' })).toHaveCount(
        0
      )
      // Un directo tampoco se admite.
      await buscar(v, URL_YT(DIRECTO))
      await expect(v.getByRole('alert')).toContainText(
        'Las listas y los directos no se pueden usar',
        {
          timeout: 30_000
        }
      )
      expect(canciones(env.datos)).toEqual([])
    } finally {
      await cerrar(app)
    }
  })

  test('bloqueado una vez: actualiza el descargador y termina bien', async () => {
    const env = preparar('yt-bloq-una')
    const app = await lanzar(env, { SHINOBI_YTDLP_ACTUALIZAR_MS: '3000' })
    try {
      const v = await app.firstWindow()
      await añadir(v, BLOQ_UNA)
      await expect(filaDescarga(v)).toContainText(
        'Actualizando el descargador de YouTube y reintentando…',
        { timeout: 30_000 }
      )
      await expect(filaPreparar(v)).toContainText('completado', { timeout: 60_000 })
      await expect(filaDescarga(v)).toContainText('completado')
      const [id] = canciones(env.datos)
      expect(leerCancion(env.datos, id!).pasos.fuente.estado).toBe('completado')
      expect(existsSync(join(env.falsos, `${BLOQ_UNA}.intentado`))).toBe(true)
    } finally {
      await cerrar(app)
    }
  })

  test('bloqueado siempre: error y Reintentar', async () => {
    const env = preparar('yt-bloq-siempre')
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await añadir(v, BLOQ_SIEMPRE)
      await expect(v.getByText('YouTube no permite la descarga ahora mismo.')).toBeVisible({
        timeout: 60_000
      })
      await expect(filaDescarga(v)).toContainText('error')
      const [id] = canciones(env.datos)
      expect(leerCancion(env.datos, id!).pasos.fuente.estado).toBe('error')
      expect(leerCancion(env.datos, id!).pasos.fuente.error.codigo).toBe('YOUTUBE_BLOQUEADO')
      const reintentar = v.getByRole('button', { name: 'Reintentar' })
      await expect(reintentar).toBeVisible()
      await reintentar.click()
      // Sigue bloqueado: vuelve a fallar con el mismo mensaje.
      await expect(v.getByText('YouTube no permite la descarga ahora mismo.')).toBeVisible({
        timeout: 60_000
      })
    } finally {
      await cerrar(app)
    }
  })

  test('cerrar la app durante la descarga: queda interrumpida y Reintentar la completa', async () => {
    const env = preparar('yt-cierre')
    ajustar(env.falsos, NORMAL, { ritmo: 60 })
    const app = await lanzar(env)
    const v = await app.firstWindow()
    await añadir(v, NORMAL, 'Tema interrumpido')
    await expect(filaDescarga(v)).toContainText(/Descargando… \d+ %/, { timeout: 30_000 })
    // Con un trabajo en curso, cerrar pide confirmación (0073): se confirma "Cerrar de todos modos".
    const cierre = app.close()
    await v.getByRole('dialog').getByRole('button', { name: 'Cerrar de todos modos' }).click()
    await cierre

    ajustar(env.falsos, NORMAL, { ritmo: 1 })
    const app2 = await lanzar(env)
    try {
      const v2 = await app2.firstWindow()
      const tarjeta = v2.getByRole('article', { name: /^Tema interrumpido,/ })
      await expect(tarjeta).toContainText('Interrumpido')
      await v2.getByRole('button', { name: 'Reintentar «Tema interrumpido»' }).click()
      // Desde 0070, Reintentar relanza el paso sin salir de la Biblioteca.
      await expect(v2.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
      await expect
        .poll(() => leerCancion(env.datos, canciones(env.datos)[0]!).pasos.fuente.estado, {
          timeout: 60_000
        })
        .toBe('completado')
      const [id, ...resto] = canciones(env.datos)
      expect(resto).toEqual([])
      const json = leerCancion(env.datos, id!)
      expect(json.pasos.fuente.estado).toBe('completado')
      expect(existsSync(join(env.datos, 'biblioteca', id!, 'fuente', 'mezcla.flac'))).toBe(true)
    } finally {
      await cerrar(app2)
    }
  })

  test('cancelar la descarga y continuar con otro enlace reutiliza la misma carpeta', async () => {
    const env = preparar('yt-cancelar')
    ajustar(env.falsos, NORMAL, { ritmo: 60 })
    const app = await lanzar(env)
    try {
      const v = await app.firstWindow()
      await añadir(v, NORMAL, 'Tema a cancelar')
      await expect(filaDescarga(v)).toContainText(/Descargando… \d+ %/, { timeout: 30_000 })
      await v.getByRole('button', { name: 'Cancelar descarga' }).click()
      await v.getByRole('dialog').getByRole('button', { name: 'Cancelar descarga' }).click()
      await expect(v.getByText('Falta descargar el audio.')).toBeVisible({ timeout: 30_000 })

      const [id, ...resto] = canciones(env.datos)
      expect(resto).toEqual([])
      const carpeta = join(env.datos, 'biblioteca', id!)
      expect(leerCancion(env.datos, id!).pasos.fuente.estado).toBe('pendiente')
      expect(readdirSync(join(carpeta, 'fuente')).filter((n) => /^descarga\./.test(n))).toEqual([])
      const antes = leerCancion(env.datos, id!).fuente
      const miniaturaAntes = readFileSync(join(carpeta, 'fuente', 'miniatura.jpg'))

      await v.getByRole('button', { name: 'Volver a la biblioteca' }).click()
      const tarjeta = v.getByRole('article', { name: /^Tema a cancelar,/ })
      await expect(tarjeta).toContainText('Falta descargar el audio')
      await v.getByRole('button', { name: 'Continuar «Tema a cancelar»' }).click()
      await v.getByRole('button', { name: 'Usar otro enlace' }).click()

      await expect(campoUrl(v)).toBeVisible()
      await buscar(v, URL_YT(OTRO))
      await vistaPrevia(v)
      await expect(v.getByText('Otro Artista - Segundo tema de prueba')).toBeVisible()
      await v.getByRole('button', { name: 'Descargar y continuar' }).click()
      await expect(filaPreparar(v)).toContainText('completado', { timeout: 60_000 })

      expect(canciones(env.datos)).toEqual([id])
      const despues = leerCancion(env.datos, id!)
      expect(despues.pasos.fuente.estado).toBe('completado')
      expect(JSON.stringify(despues.fuente)).toContain(OTRO)
      expect(JSON.stringify(despues.fuente)).not.toBe(JSON.stringify(antes))
      expect(
        Buffer.compare(readFileSync(join(carpeta, 'fuente', 'miniatura.jpg')), miniaturaAntes)
      ).not.toBe(0)
      expect(existsSync(join(carpeta, 'fuente', 'mezcla.flac'))).toBe(true)

      await v.getByRole('button', { name: 'Volver a la biblioteca' }).click()
      await expect(v.getByRole('article')).toHaveCount(1)
    } finally {
      await cerrar(app)
    }
  })

  test('durante la actualización de yt-dlp, la descarga en cola indica el mantenimiento', async () => {
    const env = preparar('yt-mantenimiento')
    const app = await lanzar(env, { SHINOBI_YTDLP_ACTUALIZAR_MS: '8000' })
    try {
      const v = await app.firstWindow()
      await añadir(v, BLOQ_UNA, 'Tema en mantenimiento')
      await expect(filaDescarga(v)).toContainText('Actualizando el descargador', {
        timeout: 30_000
      })
      // Se cancela la descarga: la actualización sigue y la cola queda libre.
      await v.getByRole('button', { name: 'Cancelar descarga' }).click()
      await v.getByRole('dialog').getByRole('button', { name: 'Cancelar descarga' }).click()
      await expect(v.getByText('Falta descargar el audio.')).toBeVisible({ timeout: 30_000 })
      // Nueva descarga mientras el descargador se actualiza: espera en cola.
      await v.getByRole('button', { name: 'Descargar ahora' }).click()
      await expect(filaDescarga(v)).toContainText(
        'En cola: el descargador de YouTube se está actualizando. Empezará enseguida.',
        { timeout: 15_000 }
      )
      // Al terminar la actualización empieza sola y se completa.
      await expect(filaPreparar(v)).toContainText('completado', { timeout: 60_000 })
    } finally {
      await cerrar(app)
    }
  })
})
