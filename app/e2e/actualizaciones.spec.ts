import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { sembrar } from '../src/main/biblioteca/semilla'
import { AJACT, PA_ACTUALIZACIONES } from '../src/renderer/src/vistas/acerca/textosActualizaciones'
import { salirSinConfirmar } from './salir'
import { crearTemporal } from './temporales'

/**
 * Aviso de versión nueva (0285, ADR 0023 §6, spec 08 · Feature 3) con un doble HTTP local de la API
 * de Releases (`SHINOBI_GITHUB_URL`, solo sin empaquetar). Sin red real. Los botones que abren el
 * navegador se comprueban en Vitest, no aquí.
 */

const VERSION = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
  .version as string
const USER_AGENT = `ShinobiKaraoke/${VERSION} (https://github.com/Gomonsoft/shinobi-karaoke)`

const RELEASES = [
  {
    tag_name: 'v0.2.2-alpha.2',
    draft: false,
    prerelease: true,
    published_at: '2026-11-25T18:00:00Z',
    html_url: 'https://evil.example/no-abrir',
    assets: [
      {
        name: 'Shinobi-Karaoke-Windows-x64.exe',
        browser_download_url: 'https://evil.example/x.exe'
      }
    ]
  },
  { tag_name: 'v0.2.2-alpha.3', draft: true, prerelease: true, published_at: null, assets: [] },
  {
    tag_name: 'v0.2.1',
    draft: false,
    prerelease: false,
    published_at: '2026-11-01T10:00:00Z',
    assets: []
  }
]

interface Doble {
  servidor: Server
  url: string
  peticiones: Array<{ url: string; cabeceras: Record<string, string> }>
}

async function iniciarDoble(): Promise<Doble> {
  const peticiones: Doble['peticiones'] = []
  const servidor = createServer((req, res) => {
    const cabeceras: Record<string, string> = {}
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      cabeceras[req.rawHeaders[i]!.toLowerCase()] = req.rawHeaders[i + 1]!
    }
    peticiones.push({ url: req.url ?? '', cabeceras })
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(RELEASES))
  })
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r))
  const { port } = servidor.address() as AddressInfo
  return { servidor, url: `http://127.0.0.1:${port}`, peticiones }
}

async function lanzar(
  nombre: string,
  doble: Doble,
  canal: string
): Promise<{ app: ElectronApplication; datos: string }> {
  const datos = crearTemporal(nombre)
  await sembrar(datos)
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHINOBI_DATOS: datos,
      SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
      SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1',
      SHINOBI_GITHUB_URL: doble.url,
      SHINOBI_ACTUALIZACIONES_VERSION: '0.2.2-alpha.1',
      SHINOBI_ACTUALIZACIONES_CANAL: canal
    }
  })
  return { app, datos }
}

test.describe('Aviso de versión nueva', () => {
  test.describe.configure({ timeout: 60_000 })

  test('canal publicada: punto en ⚙, aviso y línea en Ajustes, cabeceras exactas y sin abrir URLs de la respuesta', async () => {
    const doble = await iniciarDoble()
    const { app } = await lanzar('actualizaciones', doble, 'publicada')
    try {
      const v = await app.firstWindow()
      await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
      // La consulta sale 10 s después de mostrar la ventana, sin diálogo ni toast.
      const ajustes = v.getByRole('button', { name: AJACT.tooltip, exact: true })
      await expect(ajustes).toBeVisible({ timeout: 25_000 })
      await expect(v.locator('[data-punto-version]')).toHaveCount(1)
      await expect(v.getByRole('dialog')).toHaveCount(0)
      await expect(v.getByTestId('toast')).toHaveCount(0)
      expect(doble.peticiones).toHaveLength(1)

      const { url, cabeceras } = doble.peticiones[0]!
      expect(url).toBe('/repos/Gomonsoft/shinobi-karaoke/releases?per_page=30')
      expect(cabeceras['user-agent']).toBe(USER_AGENT)
      expect(cabeceras['accept']).toBe('application/vnd.github+json')
      expect(cabeceras['x-github-api-version']).toBe('2022-11-28')
      for (const prohibida of ['cookie', 'referer', 'origin', 'authorization', 'if-none-match']) {
        expect(cabeceras[prohibida]).toBeUndefined()
      }
      // La lista exacta: las tres del ADR y las técnicas de cualquier petición web (Chromium).
      expect(Object.keys(cabeceras).sort()).toEqual(
        [
          'accept',
          'accept-encoding',
          'accept-language',
          'connection',
          'host',
          'sec-fetch-dest',
          'sec-fetch-mode',
          'sec-fetch-site',
          'user-agent',
          'x-github-api-version'
        ].sort()
      )

      await ajustes.click()
      await expect(v.getByText(AJACT.banner('0.2.2-alpha.2'))).toBeVisible()
      await expect(
        v.getByText(`${AJACT.nueva('')}0.2.2-alpha.2${AJACT.preliminar}`, { exact: true })
      ).toBeVisible()
      await expect(v.getByText(AJACT.privacidad)).toBeVisible()
      await v.getByRole('button', { name: AJACT.ver, exact: true }).click()
      await expect(v.getByRole('heading', { name: AJACT.titulo, level: 3 })).toBeFocused()

      // Al volver, el punto ya no está; el aviso de Ajustes sigue.
      await v
        .getByRole('button', { name: /Volver|Biblioteca/ })
        .first()
        .click()
      await expect(v.getByRole('button', { name: 'Ajustes', exact: true })).toBeVisible()
      await expect(v.locator('[data-punto-version]')).toHaveCount(0)
    } finally {
      await salirSinConfirmar(app)
      doble.servidor.close()
    }
  })

  test('canal de desarrollo: ninguna consulta y el bloque solo lo dice', async () => {
    const doble = await iniciarDoble()
    const { app } = await lanzar('actualizaciones-dev', doble, 'desarrollo')
    try {
      const v = await app.firstWindow()
      await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
      await v.getByRole('button', { name: 'Ajustes', exact: true }).click()
      await expect(v.getByText(AJACT.desarrollo)).toBeVisible()
      await expect(v.getByRole('button', { name: AJACT.buscar })).toHaveCount(0)
      await v.waitForTimeout(12_000)
      expect(doble.peticiones).toHaveLength(0)
      await expect(v.locator('[data-punto-version]')).toHaveCount(0)
    } finally {
      await salirSinConfirmar(app)
      doble.servidor.close()
    }
  })

  for (const [ancho, alto] of [
    [1280, 800],
    [1024, 576]
  ] as const) {
    test(`primer arranque: la mención del aviso se ve y no hay scroll a ${ancho}x${alto} (F3-P1)`, async () => {
      const datos = crearTemporal('actualizaciones-pa')
      const carpeta = crearTemporal('actualizaciones-pa-esc')
      mkdirSync(carpeta, { recursive: true })
      const escenario = join(carpeta, 'escenario.json')
      writeFileSync(
        escenario,
        JSON.stringify({
          fases: {
            motor: { ms: 500 },
            componentes: { ms: 500 },
            diagnostico: { ms: 150 },
            modelo: { ms: 500 }
          }
        })
      )
      const doble = await iniciarDoble()
      const app = await electron.launch({
        args: ['.'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          SHINOBI_DATOS: datos,
          SHINOBI_LANZADOR: 'produccion',
          SHINOBI_RUNTIME_FALSO: escenario,
          SHINOBI_GITHUB_URL: doble.url,
          SHINOBI_ACTUALIZACIONES_CANAL: 'publicada'
        }
      })
      try {
        const v = await app.firstWindow()
        await app.evaluate(
          ({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0]!.setContentSize(w!, h!),
          [ancho, alto]
        )
        await expect(v.getByText('Hola. Vamos a preparar tu estudio de karaoke.')).toBeVisible()
        await expect(v.getByText(PA_ACTUALIZACIONES)).toBeVisible()
        const m = await v.evaluate(() => ({
          alto: document.documentElement.scrollHeight,
          ventana: window.innerHeight
        }))
        expect(m.alto).toBeLessThanOrEqual(m.ventana)
      } finally {
        await app.close()
        doble.servidor.close()
      }
    })
  }
})
