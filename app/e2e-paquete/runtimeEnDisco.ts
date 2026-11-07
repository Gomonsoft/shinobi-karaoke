import { execFile } from 'node:child_process'
import { mkdir, readFile, truncate, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { sembrar } from '../src/main/biblioteca/semilla'
import { configSchema } from '../src/shared/config'
import {
  manifiestoSchema,
  requisitosDe,
  type PerfilHardware,
  type Plataforma
} from '../src/shared/manifiesto'

export function recursosDelBinario(bin: string): string {
  return join(dirname(bin), process.platform === 'darwin' ? '../Resources' : 'resources')
}

export async function leerManifiesto(recursos: string) {
  return manifiestoSchema.parse(
    JSON.parse(await readFile(join(recursos, 'runtime-manifest.json'), 'utf8'))
  )
}

export async function leerConfig(datos: string) {
  return configSchema.parse(JSON.parse(await readFile(join(datos, 'config.json'), 'utf8')))
}

export async function prepararRuntimeEnDisco(
  datos: string,
  plataforma: Plataforma,
  perfil: PerfilHardware,
  recursos: string
) {
  const manifiesto = await leerManifiesto(recursos)
  const requisitos = requisitosDe(manifiesto, plataforma, perfil)
  const calidad = manifiesto.modelos.find((modelo) => modelo.id === 'calidad')
  if (!requisitos || !calidad)
    throw new Error(`El paquete no tiene requisitos para ${plataforma}/${perfil} o modelo Calidad`)

  const { creadas } = await sembrar(datos)
  const config = await leerConfig(datos)
  const ahora = new Date().toISOString()
  config.instalacion.perfil_hardware = perfil
  config.instalacion.perfil_previsto = perfil
  config.ultima_comprobacion_ytdlp = ahora
  await writeFile(join(datos, 'config.json'), JSON.stringify(config))

  const runtime = join(datos, 'runtime')
  const python = plataforma === 'win32-x64' ? join('Scripts', 'python.exe') : join('bin', 'python')
  const interprete = join(runtime, 'venv', python)
  await mkdir(dirname(interprete), { recursive: true })
  await writeFile(interprete, '')
  await writeFile(
    join(runtime, 'instalado.json'),
    JSON.stringify({
      manifiesto_version: manifiesto.version,
      plataforma,
      perfil,
      python: manifiesto.python.version,
      sha256_requisitos: requisitos.sha256_requisitos,
      fecha: ahora
    })
  )

  const modelos = join(datos, 'modelos')
  await mkdir(modelos, { recursive: true })
  for (const { archivo, bytes } of [calidad, ...calidad.extra]) {
    const ruta = join(modelos, archivo)
    await writeFile(ruta, '')
    if (plataforma === 'win32-x64') {
      await promisify(execFile)('fsutil', ['sparse', 'setflag', ruta], { windowsHide: true })
    }
    await truncate(ruta, bytes)
  }

  const id = creadas[0]
  if (!id) throw new Error('La semilla no creó la primera canción')
  return id
}
