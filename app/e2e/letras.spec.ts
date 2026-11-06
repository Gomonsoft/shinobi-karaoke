import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { sembrar } from '../src/main/biblioteca/semilla'
import { cancionSchema } from '../src/shared/cancion'
import { leerFixtureLetra } from '../src/shared/__fixtures__/letras'
import { TEXTO } from '../src/renderer/src/vistas/letra/textos'
import { TEXTO_ELEGIDA } from '../src/renderer/src/vistas/letra/textosElegida'
import { TEXTO_IMPORTAR, TEXTO_SUSTITUIR } from '../src/renderer/src/vistas/letra/textosPegar'
import {
  cerrar,
  idDe,
  lanzar as lanzarSeparacion,
  leerCancion,
  preparar,
  tarjeta
} from './fixtures/separacion'
import { iniciarServidorLrclib, TITULOS, type ServidorLrclib } from './fixtures/lrclib/servidor'
import { crearTemporal } from './temporales'

/**
 * Letras sin red (0088, ADR 0005 Revisión 2026-11-05, ux/05): app compilada, LRCLIB sustituido por
 * un servidor HTTP local (`SHINOBI_LRCLIB_URL`, solo sin empaquetar) y letras siempre inventadas.
 * Empaquetada la variable se ignora: lo cubre `main/letras/lrclib.test.ts` (0081), no un E2E.
 */

const VERSION = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')).version
const USER_AGENT = `ShinobiKaraoke/${VERSION} (https://github.com/Gomonsoft/shinobi-karaoke)`
const idSemilla = (n: number): string => `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`
/** «Borrador sin letra»: separada y sin letra (la semilla no tiene otro modo de llegar a la vista Letra). */
const SIN_LETRA = 5

// --- Preparación ---

interface Datos {
  datos: string
  /** Archivo que "elige" el diálogo de importar (`SHINOBI_DIALOGO_PRUEBAS`). */
  archivo: string
}

/** Semilla de desarrollo con la canción `n` retitulada (duración 215 s, álbum inventado). */
async function sembrarCon(
  nombre: string,
  n: number,
  titulo: string,
  artista = 'Artista inventado'
): Promise<Datos & { id: string }> {
  const datos = crearTemporal(nombre)
  await sembrar(datos)
  const id = idSemilla(n)
  const ruta = join(datos, 'biblioteca', id, 'cancion.json')
  const c = JSON.parse(readFileSync(ruta, 'utf8'))
  c.metadatos = { ...c.metadatos, titulo, artista, album: 'Álbum inventado', duracion_ms: 215_000 }
  writeFileSync(ruta, JSON.stringify(c, null, 2))
  return { datos, id, archivo: join(crearTemporal(`${nombre}-archivo`), 'letra.txt') }
}

function lanzar(
  d: Datos,
  url: string,
  extra: Record<string, string> = {}
): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHINOBI_DATOS: d.datos,
      SHINOBI_PAPELERA_PRUEBAS: join(d.datos, 'papelera'),
      SHINOBI_DIALOGO_PRUEBAS: d.archivo,
      SHINOBI_LRCLIB_URL: url,
      ...extra
    }
  })
}

/** Prueba con servidor falso y app; cierra todo siempre. */
async function conApp(
  d: Datos,
  prueba: (v: Page, srv: ServidorLrclib, app: ElectronApplication) => Promise<void>,
  url?: string
): Promise<void> {
  const srv = await iniciarServidorLrclib()
  const app = await lanzar(d, url ?? srv.url)
  try {
    await prueba(await app.firstWindow(), srv, app)
  } finally {
    await app.close().catch(() => undefined)
    await srv.cerrar()
  }
}

/** Biblioteca → «Continuar» de la canción → vista Letra. */
async function abrirLetra(v: Page, titulo: string): Promise<void> {
  await tarjeta(v, titulo)
    .getByRole('button', { name: /^Continuar/ })
    .click()
  await expect(v.getByRole('heading', { level: 1, name: 'Letra' })).toBeVisible()
}

/** «‹ Biblioteca» de la cabecera de la canción. */
async function irABiblioteca(v: Page): Promise<void> {
  await v.getByRole('button', { name: 'Biblioteca', exact: true }).click()
  await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
}

const json = (d: Datos, id: string) => leerCancion(d.datos, id)
const lineasDe = (d: Datos, id: string) =>
  (json(d, id).letra.lineas as { tipo: string; texto: string }[]).filter((l) => l.tipo === 'linea')
const campoTitulo = (v: Page) => v.getByLabel(TEXTO.campoTitulo)
const campoArtista = (v: Page) => v.getByLabel(TEXTO.campoArtista)
const botonPegar = (v: Page) => v.getByRole('button', { name: TEXTO.pegar })
const botonImportar = (v: Page) => v.getByRole('button', { name: TEXTO.importar })
const usar = (v: Page) => v.getByRole('button', { name: TEXTO.usar })

/** Busca de nuevo con otro título (y artista) desde la vista A. */
async function buscarOtro(v: Page, titulo: string, artista = 'Artista inventado'): Promise<void> {
  await campoTitulo(v).fill(titulo)
  await campoArtista(v).fill(artista)
  await v.getByRole('button', { name: TEXTO.buscar, exact: true }).click()
}

test.describe('letras con el doble local de LRCLIB', () => {
  test.describe.configure({ timeout: 60_000 })

  test('recorrido feliz: importar, buscar mientras separa, elegir y conservar la letra', async () => {
    const env = preparar('letras-feliz', { segundos: 8, pasos: 16 })
    const srv = await iniciarServidorLrclib()
    const app = await lanzarSeparacion(env, { SHINOBI_LRCLIB_URL: srv.url })
    try {
      const v = await app.firstWindow()
      // Importar con título y artista para que la búsqueda use `get` (y la duración del WAV).
      await v.getByRole('button', { name: 'Añadir canción' }).first().click()
      await v.getByRole('button', { name: 'Elegir archivo…' }).click()
      await expect(v.getByRole('heading', { name: 'Revisa los datos de la canción' })).toBeVisible({
        timeout: 30_000
      })
      await v.getByLabel('Título').fill(TITULOS.completa)
      await v.getByLabel('Artista').fill('Artista inventado')
      await v.getByRole('button', { name: 'Continuar' }).click()

      await v.getByRole('button', { name: 'Buscar la letra mientras tanto' }).click({
        timeout: 30_000
      })
      // La búsqueda se lanza sola: tres resultados, palabra > línea > texto.
      const opciones = v.getByRole('option')
      await expect(opciones).toHaveCount(3)
      await expect(opciones.nth(0)).toContainText(TEXTO.sync.palabra)
      await expect(opciones.nth(1)).toContainText(TEXTO.sync.linea)
      await expect(opciones.nth(2)).toContainText(TEXTO.sync.texto)
      await expect(opciones.nth(0)).toContainText('5 s más larga que tu audio')
      await expect(opciones.nth(1)).toContainText(TEXTO.durIgual)
      await expect(opciones.nth(2)).toContainText(TEXTO.durMuyDif)

      const previa = v.getByRole('region', { name: TEXTO.vistaPrevia })
      await expect(previa).toContainText('Barcos de papel navegan')
      await v.getByRole('listbox').press('ArrowDown')
      await expect(previa).toContainText('Luciérnagas sobre el tejado')
      await v.getByRole('listbox').press('ArrowUp')
      await expect(previa).toContainText('Barcos de papel navegan')

      // Registro del doble: duración del WAV de prueba (15 s), cabeceras y turnos.
      const get = srv.peticiones.find((p) => p.ruta === '/api/get')
      expect(get?.parametros).toMatchObject({
        track_name: TITULOS.completa,
        artist_name: 'Artista inventado',
        duration: '15'
      })
      expect(srv.peticiones.length).toBeGreaterThan(0)
      for (const p of srv.peticiones) {
        expect(p.userAgent).toBe(USER_AGENT)
        expect(p.cookie).toBeUndefined()
      }
      expect(srv.maxSimultaneas).toBe(1)

      await usar(v).click()
      await expect(
        v.getByText('Letra actual · de LRCLIB · sincronizada por palabra · 2 líneas')
      ).toBeVisible()
      await expect(
        v.getByRole('button', { name: 'Paso 3, Letra, completado, paso actual' })
      ).toHaveAttribute('aria-current', 'step')
      await expect(v.getByRole('button', { name: /^Paso 4, Editor, pendiente/ })).toBeEnabled()
      await v.getByRole('button', { name: /^Paso 2, Separación/ }).click()
      await expect(v.getByRole('button', { name: /^Paso 3, Letra, completado/ })).toBeVisible()

      const id = idDe(env.datos, TITULOS.completa)
      await expect
        .poll(() => leerCancion(env.datos, id).pasos.separacion.estado, { timeout: 45_000 })
        .toBe('completado')
      const c = leerCancion(env.datos, id)
      expect(cancionSchema.safeParse(c).success).toBe(true)
      expect(c.letra).toMatchObject({ origen: 'lrclib', lrclib_id: 9002 })
      expect(c.letra.lineas[0].palabras.length).toBeGreaterThan(1)
      expect(c.pasos.letra.estado).toBe('completado')
      // La separación terminada no se llevó la letra por delante.
      await v.getByRole('button', { name: /^Paso 3, Letra/ }).click()
      await expect(
        v.getByText('Letra actual · de LRCLIB · sincronizada por palabra · 2 líneas')
      ).toBeVisible()

      // El cliente declara su URL base en `app.log`; nada va a lrclib.net.
      const log = readFileSync(join(env.datos, 'registros', 'app.log'), 'utf8')
      expect(log).toContain(`[lrclib] URL base: ${srv.url}`)
      expect(log).not.toContain('lrclib.net')
    } finally {
      await cerrar(app)
      await srv.cerrar()
    }
  })

  test('editar título y artista, buscar con Intro, guardarlos y abrir el enlace de LRCLIB', async () => {
    const d = await sembrarCon('letras-editar', SIN_LETRA, TITULOS.inexistente)
    await conApp(d, async (v, srv, app) => {
      await abrirLetra(v, TITULOS.inexistente)
      // No encontrada: el foco va a Título.
      await expect(v.getByText(TEXTO.error.LETRA_NO_ENCONTRADA.titulo)).toBeVisible()
      await expect(campoTitulo(v)).toBeFocused()

      await campoTitulo(v).fill(TITULOS.completa)
      await campoArtista(v).fill('Otro artista inventado')
      await campoArtista(v).press('Enter')
      await expect(v.getByRole('option')).toHaveCount(3)
      const get = srv.peticiones.filter((p) => p.ruta === '/api/get').at(-1)
      expect(get?.parametros).toMatchObject({
        track_name: TITULOS.completa,
        artist_name: 'Otro artista inventado',
        album_name: 'Álbum inventado',
        duration: '215'
      })
      await expect
        .poll(() => json(d, d.id).metadatos)
        .toMatchObject({ titulo: TITULOS.completa, artista: 'Otro artista inventado' })

      // Sin artista no hay `get`: se busca solo con `q`.
      srv.reiniciar()
      await campoArtista(v).fill('')
      await campoTitulo(v).press('Enter')
      await expect(v.getByRole('option')).toHaveCount(3)
      expect(srv.peticiones.some((p) => p.ruta === '/api/get')).toBe(false)
      expect(srv.peticiones.some((p) => p.parametros.q === TITULOS.completa)).toBe(true)

      // Enlace «Letra: LRCLIB» → `shell.openExternal` (sustituido).
      await app.evaluate(({ shell }) => {
        const g = globalThis as unknown as { __abiertos: string[] }
        g.__abiertos = []
        ;(shell as { openExternal: unknown }).openExternal = async (u: string) => {
          g.__abiertos.push(u)
        }
      })
      await v.getByRole('link', { name: TEXTO.atribucion }).click()
      await expect
        .poll(() =>
          app.evaluate(() => (globalThis as unknown as { __abiertos: string[] }).__abiertos)
        )
        .toEqual(['https://lrclib.net'])

      await irABiblioteca(v)
      await expect(tarjeta(v, TITULOS.completa)).toBeVisible()
      expect(json(d, d.id).metadatos.titulo).toBe(TITULOS.completa)
    })
  })

  test('banners de error de la búsqueda: siempre quedan Pegar e Importar', async () => {
    const d = await sembrarCon('letras-banners', SIN_LETRA, TITULOS.inexistente)
    await conApp(d, async (v, srv) => {
      await abrirLetra(v, TITULOS.inexistente)
      const disponibles = async (): Promise<void> => {
        await expect(botonPegar(v)).toBeEnabled()
        await expect(botonImportar(v)).toBeEnabled()
      }

      // No encontrada.
      await expect(v.getByText(TEXTO.error.LETRA_NO_ENCONTRADA.titulo)).toBeVisible()
      await expect(campoTitulo(v)).toBeFocused()
      await disponibles()

      // Instrumental.
      await buscarOtro(v, TITULOS.instrumental)
      await expect(v.getByText(TEXTO.error.INSTRUMENTAL.titulo)).toBeVisible()
      await disponibles()

      // Servicio caído (500).
      await buscarOtro(v, TITULOS.servicioRoto)
      await expect(v.getByText(TEXTO.error.SERVICIO_NO_DISPONIBLE.titulo)).toBeVisible()
      await expect(v.getByRole('button', { name: TEXTO.reintentar })).toBeVisible()
      await disponibles()

      // 429 corto: espera `Retry-After: 1` y llegan los resultados.
      srv.reiniciar()
      await buscarOtro(v, TITULOS.limiteCorto)
      await expect(v.getByRole('option')).toHaveCount(3, { timeout: 15_000 })
      const [primera, segunda] = srv.peticiones
      expect(primera?.estado).toBe(429)
      expect(segunda?.ruta).toBe(primera?.ruta)
      expect(segunda!.inicio - primera!.fin!).toBeGreaterThanOrEqual(900)
      await disponibles()

      // Tiempo agotado: el banner sale antes de 11 s.
      const antes = Date.now()
      await buscarOtro(v, TITULOS.lenta)
      await expect(v.getByText(TEXTO.error.SERVICIO_NO_DISPONIBLE.titulo)).toBeVisible({
        timeout: 11_000
      })
      expect(Date.now() - antes).toBeLessThan(11_000)
      await disponibles()

      // 429 largo (el último: el cliente se queda "en espera"): sin una segunda petición.
      srv.reiniciar()
      await buscarOtro(v, TITULOS.limiteLargo)
      await expect(v.getByText(TEXTO.error.SERVICIO_NO_DISPONIBLE.titulo)).toBeVisible()
      await disponibles()
      expect(srv.peticiones.filter((p) => p.escenario === 'limiteLargo')).toHaveLength(1)
    })
  })

  test('sin conexión: banner con Reintentar, Pegar e Importar', async () => {
    const d = await sembrarCon('letras-sinred', SIN_LETRA, TITULOS.completa)
    await conApp(
      d,
      async (v, srv) => {
        await abrirLetra(v, TITULOS.completa)
        await expect(v.getByText(TEXTO.error.SIN_CONEXION.titulo)).toBeVisible({ timeout: 15_000 })
        await expect(v.getByRole('button', { name: TEXTO.reintentar })).toBeVisible()
        await expect(botonPegar(v)).toBeEnabled()
        await expect(botonImportar(v)).toBeEnabled()
        expect(srv.peticiones).toHaveLength(0)
      },
      'http://lrclib.invalid'
    )
  })

  test('pegar texto con estrofas y texto LRC', async () => {
    const d = await sembrarCon('letras-pegar', SIN_LETRA, TITULOS.inexistente)
    await conApp(d, async (v) => {
      await abrirLetra(v, TITULOS.inexistente)
      await botonPegar(v).click()
      const area = v.getByRole('textbox', { name: 'Letra', exact: true })
      await area.fill(leerFixtureLetra('texto-plano.txt'))
      await expect(v.getByText('5 líneas · se sincronizarán en el editor')).toBeVisible()
      await usar(v).click()
      await expect(v.getByText('Letra actual · pegada · sin sincronizar · 5 líneas')).toBeVisible()
      let c = json(d, d.id)
      expect(c.letra.origen).toBe('manual')
      expect(c.letra.lineas.filter((l: { tipo: string }) => l.tipo === 'pausa')).toHaveLength(2)
      expect(c.letra.lineas.filter((l: { tipo: string }) => l.tipo === 'linea')).toHaveLength(5)
      expect(c.pasos.letra.estado).toBe('completado')

      // Texto LRC: aviso, tiempos conservados y la marca final como `fin_ms`.
      await v.getByRole('button', { name: TEXTO_ELEGIDA.otra }).click()
      await botonPegar(v).click()
      await v
        .getByRole('textbox', { name: 'Letra', exact: true })
        .fill('[00:12.00]Primera línea inventada\n[00:16.50]Segunda línea inventada\n[00:20.00]')
      await expect(
        v.getByText('Hemos detectado tiempos de sincronía y los conservaremos.')
      ).toBeVisible()
      await usar(v).click()
      await v.getByRole('dialog').getByRole('button', { name: TEXTO_SUSTITUIR.sustituir }).click()
      await expect(
        v.getByText('Letra actual · pegada · sincronizada por línea · 2 líneas')
      ).toBeVisible()
      c = json(d, d.id)
      const l = c.letra.lineas.filter((x: { tipo: string }) => x.tipo === 'linea')
      expect(l.map((x: { inicio_ms: number }) => x.inicio_ms)).toEqual([12000, 16500])
      expect(l[1].fin_ms).toBe(20000)
    })
  })

  test('importar .lrc mejorado, .txt en Windows-1252 y un archivo vacío', async () => {
    const d = await sembrarCon('letras-importar', SIN_LETRA, TITULOS.inexistente)
    await conApp(d, async (v) => {
      await abrirLetra(v, TITULOS.inexistente)

      // .lrc mejorado (sin letra previa: no pide confirmar).
      conArchivo(d, leerFixtureLetra('mejorado.lrc'))
      await botonImportar(v).click()
      await expect(
        v.getByText('Letra actual · de un archivo · sincronizada por palabra · 2 líneas')
      ).toBeVisible()
      let c = json(d, d.id)
      expect(c.letra.origen).toBe('archivo')
      expect(c.letra.lineas[0].palabras).toHaveLength(4)

      // .txt en Windows-1252: se decodifica bien y pide confirmar la sustitución.
      conArchivo(d, Buffer.from('Canción de añoranza\nÚltimo bis', 'latin1'))
      await v.getByRole('button', { name: 'Importar archivo', exact: true }).click()
      await expect(v.getByRole('dialog', { name: TEXTO_SUSTITUIR.titulo })).toBeVisible()
      await v.getByRole('button', { name: TEXTO_SUSTITUIR.sustituir }).click()
      await expect(
        v.getByText('Letra actual · de un archivo · sin sincronizar · 2 líneas')
      ).toBeVisible()
      c = json(d, d.id)
      expect(lineasDe(d, d.id).map((l) => l.texto)).toEqual(['Canción de añoranza', 'Último bis'])

      // Archivo vacío: error de archivo y la letra no cambia.
      conArchivo(d, '')
      await v.getByRole('button', { name: 'Importar archivo', exact: true }).click()
      await expect(
        v.getByRole('alert').filter({ hasText: TEXTO_IMPORTAR.errorArchivo })
      ).toBeVisible()
      await expect(v.getByRole('dialog')).toHaveCount(0)
      expect(json(d, d.id).letra).toEqual(c.letra)
    })
  })

  test('sustituir una letra sincronizada: Cancelar no cambia nada y Sustituir sí', async () => {
    const d = await sembrarCon('letras-sustituir', SIN_LETRA, TITULOS.completa)
    await conApp(d, async (v) => {
      await abrirLetra(v, TITULOS.completa)
      // Primera elección (sin letra previa, sin diálogo): la de palabra, 9002.
      await expect(v.getByRole('option')).toHaveCount(3)
      await usar(v).click()
      await expect(
        v.getByText(/^Letra actual · de LRCLIB · sincronizada por palabra/)
      ).toBeVisible()
      await v.getByRole('button', { name: TEXTO_ELEGIDA.otra }).click()
      await expect(v.getByRole('option')).toHaveCount(3)
      const antes = json(d, d.id).letra
      expect(antes.lrclib_id).toBe(9002)

      await usar(v).click()
      const dialogo = v.getByRole('dialog', { name: TEXTO_SUSTITUIR.titulo })
      await expect(dialogo).toContainText(TEXTO_SUSTITUIR.conSincronia)
      await dialogo.getByRole('button', { name: TEXTO_SUSTITUIR.cancelar }).click()
      await expect(dialogo).toHaveCount(0)
      expect(json(d, d.id).letra).toEqual(antes)

      await v.getByRole('listbox').press('ArrowDown')
      await usar(v).click()
      await v
        .getByRole('dialog', { name: TEXTO_SUSTITUIR.titulo })
        .getByRole('button', { name: TEXTO_SUSTITUIR.sustituir })
        .click()
      await expect(v.getByText(/^Letra actual · de LRCLIB · sincronizada por línea/)).toBeVisible()
      await expect.poll(() => json(d, d.id).letra.lrclib_id).toBe(9001)
    })
  })

  test('edición en C, tarjeta con líneas por sincronizar y relanzar la app', async () => {
    const d = await sembrarCon('letras-edicion', SIN_LETRA, 'Tema editado')
    const textos = [
      'Uno inventado',
      'Dos inventado',
      'Tres inventado',
      'Cuatro inventado',
      'Cinco inventado'
    ]
    const srv = await iniciarServidorLrclib()
    let app = await lanzar(d, srv.url)
    try {
      let v = await app.firstWindow()
      await abrirLetra(v, 'Tema editado')
      // Letra con tiempos pegada en formato LRC; C la muestra como texto.
      await botonPegar(v).click()
      await v
        .getByRole('textbox', { name: 'Letra', exact: true })
        .fill(textos.map((t, i) => `[00:${10 + i * 4}.00]${t}`).join('\n'))
      await usar(v).click()
      await expect(
        v.getByText(/^Letra actual · pegada · sincronizada por línea · 5 líneas/)
      ).toBeVisible()
      const ids = (json(d, d.id).letra.lineas as { id: string }[]).map((l) => l.id)
      const area = v.getByLabel(TEXTO_ELEGIDA.etiquetaArea)
      await expect(area).toHaveValue(textos.join('\n'))
      await area.fill(
        ['Uno cambiado', 'Dos   inventado ', 'Cuatro inventado', 'Cinco inventado'].join('\n')
      )
      await area.blur()
      await expect.poll(() => lineasDe(d, d.id).length).toBe(4)
      const l = json(d, d.id).letra.lineas
      expect(l[0]).toMatchObject({ texto: 'Uno cambiado', inicio_ms: null })
      expect(l[1]).toMatchObject({ id: ids[1], inicio_ms: 14_000 })
      expect(l[2]).toMatchObject({ id: ids[3], inicio_ms: 22_000 })
      expect(l[3]).toMatchObject({ id: ids[4], inicio_ms: 26_000 })

      await irABiblioteca(v)
      await expect(tarjeta(v, 'Tema editado')).toContainText('Falta 1 línea por sincronizar')

      // Cerrar y relanzar: la letra sigue igual y «Continuar» abre el Editor.
      const guardada = json(d, d.id).letra
      await app.close()
      app = await lanzar(d, srv.url)
      v = await app.firstWindow()
      expect(json(d, d.id).letra).toEqual(guardada)
      await expect(tarjeta(v, 'Tema editado')).toContainText('Falta 1 línea por sincronizar')
      await tarjeta(v, 'Tema editado')
        .getByRole('button', { name: /^Continuar/ })
        .click()
      await expect(v.getByRole('heading', { level: 1, name: 'Editor' })).toBeVisible()
    } finally {
      await app.close().catch(() => undefined)
      await srv.cerrar()
    }
  })
})

/** Escribe el archivo que "elige" el diálogo de pruebas (siempre la misma ruta). */
function conArchivo(d: Datos, contenido: string | Buffer): void {
  writeFileSync(d.archivo, contenido)
}
