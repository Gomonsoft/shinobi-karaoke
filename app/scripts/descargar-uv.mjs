import { createHash } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, posix, resolve, win32 } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const DIRECTORIO_APP = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ARCHIVO_BINARIOS = join(DIRECTORIO_APP, 'scripts', 'uv-binarios.json')

export function clavePlataforma(plataforma, arquitectura) {
  if (plataforma === 'win32' && arquitectura === 'x64') return 'win32-x64'
  if (plataforma === 'darwin' && arquitectura === 'arm64') return 'darwin-arm64'
  if (plataforma === 'linux' && arquitectura === 'x64') return 'linux-x64'
  return null
}

export function esVersionEsperada(salida, version) {
  const escapada = version.replaceAll('.', '\\.')
  return new RegExp('^uv ' + escapada + '(?:\\s|$)').test(salida.trim())
}

function ejecutar(comando, argumentos, opciones = {}) {
  return execFileSync(comando, argumentos, { encoding: 'utf8', stdio: 'pipe', ...opciones })
}

function rutaBinario(raizApp, plataforma) {
  return join(raizApp, 'resources', 'bin', plataforma === 'win32' ? 'uv.exe' : 'uv')
}

function versionInstalada(ruta, version, ejecutarComando) {
  try {
    return esVersionEsperada(ejecutarComando(ruta, ['--version']), version)
  } catch {
    return false
  }
}

function extraerTar(archivoTemporal, directorioTemporal, nombreInterno, ejecutarComando) {
  ejecutarComando('tar', ['-xzf', basename(archivoTemporal), nombreInterno], {
    cwd: directorioTemporal
  })
}

function extraerZip(archivoTemporal, directorioTemporal, nombreInterno, ejecutarComando) {
  const tarWindows = win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
  ejecutarComando(tarWindows, ['-xf', basename(archivoTemporal), nombreInterno], {
    cwd: directorioTemporal
  })
}

/**
 * Descarga y verifica el uv fijado para la plataforma antes de extraerlo.
 * Las dependencias se pueden sustituir en pruebas; producción usa fetch y tar del sistema.
 */
export async function descargarUv({
  plataforma = process.platform,
  arquitectura = process.arch,
  raizApp = DIRECTORIO_APP,
  manifiesto: manifiestoPedido,
  fetchImpl = globalThis.fetch,
  ejecutarComando = ejecutar,
  extraer
} = {}) {
  const manifiesto = manifiestoPedido ?? JSON.parse(await readFile(ARCHIVO_BINARIOS, 'utf8'))
  const clave = clavePlataforma(plataforma, arquitectura)
  const binario = clave ? manifiesto.binarios[clave] : undefined
  if (!binario) {
    throw new Error(
      'No hay un binario de uv configurado para ' + plataforma + '-' + arquitectura + '.'
    )
  }

  const extraerArchivo = extraer ?? (plataforma === 'win32' ? extraerZip : extraerTar)
  const destino = rutaBinario(raizApp, plataforma)
  if (versionInstalada(destino, manifiesto.version, ejecutarComando)) {
    return { ruta: destino, version: manifiesto.version, descargado: false }
  }

  const url =
    'https://github.com/astral-sh/uv/releases/download/' +
    manifiesto.version +
    '/' +
    binario.archivo
  const temporal = await mkdtemp(join(tmpdir(), 'shinobi-uv-'))
  const descarga = join(temporal, binario.archivo)
  const nombreEjecutable = plataforma === 'win32' ? 'uv.exe' : 'uv'
  const carpetaArchivo = binario.archivo.replace(/\.zip$|\.tar\.gz$/, '')
  const rutaInterna =
    plataforma === 'win32' ? nombreEjecutable : posix.join(carpetaArchivo, nombreEjecutable)
  const binarioTemporal = join(temporal, nombreEjecutable)

  try {
    const respuesta = await fetchImpl(url)
    if (!respuesta.ok) {
      throw new Error(
        'No se pudo descargar uv (' + respuesta.status + ' ' + respuesta.statusText + ').'
      )
    }
    const bytes = Buffer.from(await respuesta.arrayBuffer())
    await writeFile(descarga, bytes)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    if (sha256 !== binario.sha256) {
      throw new Error(
        'SHA-256 incorrecto para ' +
          binario.archivo +
          ': esperado ' +
          binario.sha256 +
          ', recibido ' +
          sha256 +
          '.'
      )
    }

    await mkdir(dirname(destino), { recursive: true })
    await extraerArchivo(descarga, temporal, rutaInterna, ejecutarComando)
    const extraido = join(temporal, rutaInterna)
    if (!(await stat(extraido)).isFile()) {
      throw new Error('El archivo ' + nombreEjecutable + ' no aparece en ' + binario.archivo + '.')
    }
    await writeFile(binarioTemporal, await readFile(extraido))
    if (plataforma !== 'win32') await chmod(binarioTemporal, 0o755)
    const version = ejecutarComando(binarioTemporal, ['--version'])
    if (!esVersionEsperada(version, manifiesto.version)) {
      throw new Error(
        'La versión descargada no coincide: se esperaba uv ' +
          manifiesto.version +
          ', se recibió ' +
          version.trim() +
          '.'
      )
    }
    await rm(destino, { force: true })
    await writeFile(destino, await readFile(binarioTemporal))
    if (plataforma !== 'win32') await chmod(destino, 0o755)
    return { ruta: destino, version: manifiesto.version, descargado: true }
  } catch (error) {
    await rm(destino, { force: true })
    throw error
  } finally {
    await rm(temporal, { recursive: true, force: true })
  }
}

async function main() {
  const resultado = await descargarUv()
  console.log(
    (resultado.descargado ? 'Descargado' : 'Ya instalado') +
      ' uv ' +
      resultado.version +
      ': ' +
      resultado.ruta
  )
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(
      'No se pudo preparar uv: ' + (error instanceof Error ? error.message : String(error))
    )
    process.exitCode = 1
  })
}
