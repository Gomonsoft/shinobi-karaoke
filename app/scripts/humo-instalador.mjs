import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { appendFile, cp, mkdir, mkdtemp, readFile, readlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect } from '@playwright/test'
import { lanzarPaquete } from '../e2e-paquete/lanzar.ts'

const bin = process.env.SHINOBI_PAQUETE_BIN
const modo = process.argv[2]
assert(bin, 'Define SHINOBI_PAQUETE_BIN')
assert(['datos', 'deb', 'appimage'].includes(modo), 'Modo esperado: datos, deb o appimage')

async function salida(nombre, valor) {
  console.log(`${nombre}=${valor}`)
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${nombre}=${valor}\n`)
  }
}

async function comprobarArranque(datos, recursosHumo) {
  // Sin datos explícitos, el lanzador elimina SHINOBI_DATOS del entorno heredado.
  const app = await lanzarPaquete({ bin, datos })
  try {
    await expect(
      app.pagina.getByRole('heading', {
        name: 'Hola. Vamos a preparar tu estudio de karaoke.'
      })
    ).toBeVisible()
    if (process.platform !== 'linux') return

    const sesion = await app.navegador.newBrowserCDPSession()
    const { processInfo } = await sesion.send('SystemInfo.getProcessInfo')
    const tipos = ['browser', 'renderer']
    const procesos = processInfo.filter(({ type }) => tipos.includes(type))
    const principal = procesos.findIndex(({ type }) => type === 'browser')
    assert(principal !== -1, 'Falta el proceso principal')
    assert(
      procesos.some(({ type }) => type === 'renderer'),
      'Falta el renderer'
    )
    const observaciones = await Promise.all(
      procesos.map(async ({ id, type }) => {
        const args = (await readFile(`/proc/${id}/cmdline`, 'utf8')).split('\0')
        const sinSandbox = args.includes('--no-sandbox')
        console.log(`${type} (${id}): --no-sandbox ${sinSandbox ? 'sí' : 'no'}`)
        return sinSandbox
      })
    )
    await salida('sandbox', observaciones.some(Boolean) ? 'sí' : 'no')
    const esperado = process.env.SHINOBI_ESPERA_SIN_SANDBOX === '1'
    assert.equal(observaciones[principal], esperado, '--no-sandbox en el proceso principal')
    if (!esperado) assert(!observaciones.some(Boolean), 'Un renderer lleva --no-sandbox')
    if (recursosHumo) {
      // La suite busca el manifiesto y uv junto a SHINOBI_PAQUETE_BIN.
      // Se copian desde el proceso real mientras su AppDir sigue disponible.
      const ejecutable = await readlink(`/proc/${procesos[principal].id}/exe`)
      const origen = join(dirname(ejecutable), 'resources')
      await cp(join(origen, 'runtime-manifest.json'), join(recursosHumo, 'runtime-manifest.json'))
      await cp(join(origen, 'bin'), join(recursosHumo, 'bin'), { recursive: true })
    }
  } finally {
    await app.cerrar()
  }
}

if (modo === 'appimage') {
  const datos = await mkdtemp(join(tmpdir(), 'shinobi-appimage-'))
  const recursos = join(dirname(bin), 'resources')
  delete process.env.APPIMAGE_EXTRACT_AND_RUN
  try {
    await mkdir(recursos)
    try {
      try {
        await comprobarArranque(datos, recursos)
        await salida('fuse', 'sí')
      } catch (error) {
        // Solo un error de montaje de FUSE justifica cambiar el modo de ejecución.
        const falloFuse =
          /Cannot mount AppImage, please check your FUSE setup|fuse: (?:device not found|failed to open \/dev\/fuse)|dlopen\(\): error loading libfuse/i
        if (!falloFuse.test(String(error))) throw error
        console.warn(String(error))
        await salida('fuse', 'no disponible')
        process.env.APPIMAGE_EXTRACT_AND_RUN = '1'
        await comprobarArranque(datos, recursos)
      }
      execFileSync('npm', ['run', 'test:paquete'], { stdio: 'inherit' })
    } finally {
      await rm(recursos, { recursive: true, force: true })
    }
  } finally {
    await rm(datos, { recursive: true, force: true })
  }
} else {
  await comprobarArranque()
}
