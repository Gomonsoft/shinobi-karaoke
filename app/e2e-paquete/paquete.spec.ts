/// <reference lib="dom" />

import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
import { expect, test as base } from '@playwright/test'
import { configPredeterminada } from '../src/shared/config'
import type { ApiShinobi } from '../src/shared/ipc'
import {
  bytesTotalesInstalacion,
  plataformaSchema,
  perfilSchema,
  requisitosDe
} from '../src/shared/manifiesto'
import { iniciarProceso, lanzarPaquete } from './lanzar'
import {
  leerConfig,
  leerManifiesto,
  prepararRuntimeEnDisco,
  recursosDelBinario
} from './runtimeEnDisco'

const BIENVENIDA = 'Hola. Vamos a preparar tu estudio de karaoke.'
const URL_APP = 'shinobi-app://app/index.html'

const test = base.extend<{ carpeta: string }, { bin: string }>({
  bin: [
    // eslint-disable-next-line no-empty-pattern -- Playwright exige desestructurar las fixtures.
    async ({}, use) => {
      const bin = process.env.SHINOBI_PAQUETE_BIN
      if (!bin)
        throw new Error('Define SHINOBI_PAQUETE_BIN con la ruta del ejecutable empaquetado.')
      await use(await realpath(resolve(bin)))
    },
    { scope: 'worker', auto: true }
  ],
  // eslint-disable-next-line no-empty-pattern -- Esta fixture tampoco depende de otras.
  carpeta: async ({}, use) => {
    const carpeta = await mkdtemp(join(tmpdir(), 'shinobi-paquete-'))
    try {
      await use(carpeta)
    } finally {
      await rm(carpeta, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
    }
  }
})

function equipo() {
  const plataforma = plataformaSchema.parse(`${process.platform}-${process.arch}`)
  const perfil = perfilSchema.parse(
    process.env.SHINOBI_PAQUETE_PERFIL ?? (plataforma === 'darwin-arm64' ? 'mps' : 'cpu')
  )
  return { plataforma, perfil }
}

async function escribirConfigCompleta(datos: string): Promise<void> {
  const config = configPredeterminada()
  config.instalacion.estado = 'completa'
  config.instalacion.perfil_hardware = equipo().perfil
  config.ultima_comprobacion_ytdlp = new Date().toISOString()
  await writeFile(join(datos, 'config.json'), JSON.stringify(config))
}

const gb = (bytes: number): string => String(Math.round(bytes / 1e8) / 10).replace('.', ',')

test('B1 usa el manifiesto del paquete e ignora el entorno de pruebas', async ({
  bin,
  carpeta
}) => {
  const datos = join(carpeta, 'datos')
  const recursos = recursosDelBinario(bin)
  const manifiesto = await leerManifiesto(recursos)
  const { plataforma, perfil } = equipo()
  const req = requisitosDe(manifiesto, plataforma, perfil)
  const descarga = bytesTotalesInstalacion(manifiesto, plataforma, perfil)
  if (!req || descarga === null) throw new Error(`No hay cifras para ${plataforma}/${perfil}`)

  const escenario = join(carpeta, 'escenario.json')
  const separador = join(carpeta, 'separador.json')
  await writeFile(escenario, JSON.stringify({ plataforma, modelos: 'diminutos', espacioLibre: 1 }))
  await writeFile(separador, JSON.stringify({ segundos: 1, pasos: 2 }))
  const app = await lanzarPaquete({
    bin,
    datos,
    env: {
      SHINOBI_RUNTIME_FALSO: escenario,
      SHINOBI_UV: join(recursos, 'bin', process.platform === 'win32' ? 'uv.exe' : 'uv'),
      SHINOBI_LANZADOR: 'desarrollo',
      SHINOBI_DIALOGO_PRUEBAS: 'cancelar',
      SHINOBI_PAPELERA_PRUEBAS: join(carpeta, 'papelera.jsonl'),
      SHINOBI_AVISOS_PRUEBAS: join(carpeta, 'avisos.jsonl'),
      SHINOBI_YTDLP_FALSO: resolve('e2e/fixtures/youtube'),
      SHINOBI_SEPARADOR_FALSO: separador,
      SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1',
      SHINOBI_PANTALLA_COMPLETA_SIMULADA: '1',
      SHINOBI_SILENCIAR_AUDIO: '1',
      ELECTRON_RENDERER_URL: 'http://127.0.0.1:1'
    }
  })
  try {
    const { pagina } = app
    await expect(pagina.getByRole('heading', { name: BIENVENIDA })).toBeVisible()
    expect(pagina.url()).toBe(URL_APP)
    await expect(pagina).toHaveTitle('Shinobi Karaoke')
    await expect(pagina.getByText(`Descarga: unos ${gb(descarga)} GB para tu equipo`)).toBeVisible()
    await expect(
      pagina.getByText(
        new RegExp(`(?:necesitas al menos|Necesitas) ${gb(req.espacio_requerido)} GB libres`)
      )
    ).toBeVisible()
  } finally {
    await app.cerrar()
  }
  expect(existsSync(join(carpeta, 'llamadas.jsonl'))).toBe(false)
  const modelos = join(datos, 'modelos')
  expect(existsSync(modelos) ? await readdir(modelos) : []).toEqual([])
})

test('el IPC devuelve los textos legales empaquetados', async ({ bin, carpeta: datos }) => {
  const app = await lanzarPaquete({ bin, datos })
  try {
    await expect(app.pagina).toHaveURL(URL_APP)
    const textos = await app.pagina.evaluate(() => {
      const { sistema } = (globalThis as unknown as { shinobi: ApiShinobi }).shinobi
      return Promise.all([sistema.textoLegal('gpl'), sistema.textoLegal('terceros')])
    })
    expect(textos[0]).toContain('GNU GENERAL PUBLIC LICENSE')
    expect(textos[1]).toContain('Avisos de terceros')
  } finally {
    await app.cerrar()
  }
})

test('la Biblioteca carga la semilla, el audio sintético y la fuente', async ({
  bin,
  carpeta: datos
}) => {
  const { plataforma, perfil } = equipo()
  const id = await prepararRuntimeEnDisco(datos, plataforma, perfil, recursosDelBinario(bin))
  const app = await lanzarPaquete({ bin, datos })
  try {
    const { pagina } = app
    await expect(pagina.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible()
    await expect(pagina.getByRole('article', { name: /^Canción lista,/ })).toBeVisible()
    expect((await leerConfig(datos)).instalacion.estado).toBe('completa')
    expect(
      await pagina.evaluate(async (id) => {
        const respuesta = await fetch(`shinobi-media://${id}/pistas/instrumental.flac`)
        return respuesta.status
      }, id)
    ).toBe(200)
    expect(
      await pagina.evaluate(async () => {
        await document.fonts.ready
        return Array.from(document.fonts).some(
          (fuente) =>
            fuente.family.replace(/['"]/g, '') === 'Atkinson Hyperlegible Next' &&
            fuente.status === 'loaded'
        )
      })
    ).toBe(true)
  } finally {
    await app.cerrar()
  }
})

test('una instalación completa sin runtime llega a Reparar', async ({ bin, carpeta: datos }) => {
  await escribirConfigCompleta(datos)
  const app = await lanzarPaquete({ bin, datos })
  try {
    await expect(
      app.pagina.getByRole('heading', { name: 'Hay que reparar el motor de audio' })
    ).toBeVisible()
    await expect(app.pagina.getByRole('button', { name: 'Reparar', exact: true })).toBeVisible()
  } finally {
    await app.cerrar()
  }
})

/** Reserva o comprueba un puerto de loopback, sin conectar un depurador. */
async function comprobarPuerto(puerto = 0): Promise<number> {
  const servidor = createServer()
  return new Promise((resolve, reject) => {
    servidor.once('error', reject)
    servidor.listen(puerto, '127.0.0.1', () => {
      const direccion = servidor.address()
      servidor.close((error) => {
        if (error) reject(error)
        else if (!direccion || typeof direccion === 'string')
          reject(new Error('Puerto desconocido'))
        else resolve(direccion.port)
      })
    })
  })
}

test('los fuses desactivan RunAsNode, NODE_OPTIONS y el inspector de Node', async ({
  bin,
  carpeta
}) => {
  const marcaNode = join(carpeta, 'run-as-node.txt')
  const marcaOpciones = join(carpeta, 'node-options.txt')
  const modulo = join(carpeta, 'marca.cjs')
  const escribirMarca = (ruta: string): string =>
    `require('node:fs').writeFileSync(${JSON.stringify(ruta)}, 'ejecutado')`
  await writeFile(modulo, escribirMarca(marcaOpciones))
  const puerto = await comprobarPuerto()

  for (const { nombre, args, env } of [
    {
      nombre: 'run-as-node',
      args: ['-e', escribirMarca(marcaNode)],
      env: { ELECTRON_RUN_AS_NODE: '1' }
    },
    {
      nombre: 'node-options',
      env: { NODE_OPTIONS: `--require ${JSON.stringify(modulo.replaceAll('\\', '/'))}` }
    },
    { nombre: 'inspect', args: [`--inspect=${puerto}`] }
  ]) {
    await test.step(nombre, async () => {
      const datos = join(carpeta, nombre)
      await mkdir(datos)
      await escribirConfigCompleta(datos)
      const app = iniciarProceso({ bin, datos, args, env })
      try {
        // El cambio persistido en disco prueba que se ejecutó el proceso principal.
        await expect
          .poll(async () => (await leerConfig(datos)).instalacion.estado, {
            timeout: 15_000,
            message: `El paquete debe arrancar con ${nombre}`
          })
          .toBe('dañada')
        if (nombre === 'inspect') {
          await expect(comprobarPuerto(puerto)).resolves.toBe(puerto)
          expect(app.stderr()).not.toContain('Debugger listening')
        }
      } catch (error) {
        throw new Error(`Falló la comprobación ${nombre}.\n${app.logs()}`, { cause: error })
      } finally {
        await app.cerrar()
      }
      expect(existsSync(marcaNode)).toBe(false)
      expect(existsSync(marcaOpciones)).toBe(false)
    })
  }
})

test('el segundo proceso sale y la primera instancia sigue conectada', async ({
  bin,
  carpeta: datos
}) => {
  const app = await lanzarPaquete({ bin, datos })
  try {
    await expect(app.pagina.getByRole('heading', { name: BIENVENIDA })).toBeVisible()
    const segundo = iniciarProceso({ bin, datos })
    try {
      const codigo = await Promise.race([
        segundo.salida,
        esperar(15_000, undefined, { ref: false }).then(() => {
          throw new Error(`La segunda instancia sigue viva.\n${segundo.logs()}`)
        })
      ])
      expect(codigo, segundo.logs()).toBe(0)
      expect(app.navegador.isConnected()).toBe(true)
      await expect(app.pagina.getByRole('heading', { name: BIENVENIDA })).toBeVisible()
    } finally {
      await segundo.cerrar()
    }
  } finally {
    await app.cerrar()
  }
})
