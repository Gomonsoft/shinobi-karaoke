import { spawnSync } from 'node:child_process'
import {
  mkdtemp,
  readFile,
  readdir,
  readFile as leerArchivo,
  rm,
  writeFile
} from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { init } from 'license-checker-rseidelsohn'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = resolve(RAIZ, '..')
const ARCHIVO_AVISOS = join(REPO, 'THIRD_PARTY_NOTICES.md')
const MARCADOR_INICIO = '<!-- inicio:dependencias-js -->'
const MARCADOR_FIN = '<!-- fin:dependencias-js -->'
const LICENCIAS_ADMITIDAS = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'BlueOak-1.0.0'
])

function nombrePaqueteDesdeRuta(rutaFuente) {
  const ruta = rutaFuente.replaceAll('\\', '/')
  const coincidencia = ruta.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)(?:\/|$)/)
  return coincidencia?.[1] ?? null
}

export function paquetesDeMapas(mapas) {
  const nombres = new Set()
  for (const mapa of mapas) {
    for (const fuente of mapa.sources ?? []) {
      const nombre = nombrePaqueteDesdeRuta(fuente)
      if (nombre) nombres.add(nombre)
    }
  }
  return nombres
}

export function paquetesDeArbolNpm(arbol) {
  const nombres = new Set()
  const visitar = (dependencias = {}) => {
    for (const [nombre, paquete] of Object.entries(dependencias)) {
      nombres.add(nombre)
      visitar(paquete.dependencies)
    }
  }
  visitar(arbol.dependencies)
  return nombres
}

export function paquetesDistribuidos(mapas, arbolNpm) {
  return [...new Set([...paquetesDeMapas(mapas), ...paquetesDeArbolNpm(arbolNpm)])].sort((a, b) =>
    a.localeCompare(b, 'en')
  )
}

function versionDeClave(clave, nombre) {
  const prefijo = `${nombre}@`
  if (clave.startsWith(prefijo)) return clave.slice(prefijo.length)
  return null
}

function normalizarLicencias(licencias) {
  const lista = Array.isArray(licencias)
    ? licencias
    : String(licencias ?? '').split(/\s+(?:AND|OR)\s+/)
  return lista.map((licencia) => String(licencia).trim()).filter(Boolean)
}

export function generarBloque({ paquetes, inventario }) {
  const lineas = [MARCADOR_INICIO, '## Dependencias JavaScript incluidas en la aplicación', '']
  for (const nombre of [...paquetes].sort((a, b) => a.localeCompare(b, 'en'))) {
    const coincidencias = Object.entries(inventario)
      .map(([clave, datos]) => ({ clave, datos, version: versionDeClave(clave, nombre) }))
      .filter((elemento) => elemento.version)
    if (coincidencias.length !== 1)
      throw new Error(`No se encontró una versión única en license-checker para ${nombre}`)
    const { datos, version } = coincidencias[0]
    const licencias = normalizarLicencias(datos.licenses)
    if (!licencias.length || licencias.some((licencia) => !LICENCIAS_ADMITIDAS.has(licencia))) {
      throw new Error(
        `Licencia no admitida para ${nombre}@${version}: ${licencias.join(', ') || 'sin identificar'}`
      )
    }
    if (typeof datos.licenseText !== 'string' || !datos.licenseText.trim()) {
      throw new Error(`Falta el texto completo de licencia para ${nombre}@${version}`)
    }
    const repositorio = typeof datos.repository === 'string' ? datos.repository : datos.url
    lineas.push(`### ${nombre} ${version} — ${licencias.join(' AND ')}`)
    if (datos.copyright) lineas.push(`Copyright: ${datos.copyright}`)
    if (repositorio) lineas.push(`Proyecto: ${repositorio}`)
    lineas.push('', datos.licenseText.trim(), '')
  }
  lineas.push(MARCADOR_FIN)
  return lineas.join('\n')
}

export function reemplazarBloque(contenido, bloque) {
  const inicio = contenido.indexOf(MARCADOR_INICIO)
  const fin = contenido.indexOf(MARCADOR_FIN)
  if (
    inicio < 0 ||
    fin < inicio ||
    contenido.indexOf(MARCADOR_INICIO, inicio + 1) >= 0 ||
    contenido.indexOf(MARCADOR_FIN, fin + 1) >= 0
  ) {
    throw new Error(
      'THIRD_PARTY_NOTICES.md debe tener exactamente un par de marcadores de dependencias-js en orden'
    )
  }
  return `${contenido.slice(0, inicio)}${bloque}${contenido.slice(fin + MARCADOR_FIN.length)}`
}

function ejecutar(comando, argumentos, cwd) {
  const resultado = spawnSync(comando, argumentos, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  })
  if (resultado.error) throw resultado.error
  if (resultado.status !== 0)
    throw new Error(`${comando} ${argumentos.join(' ')} falló: ${resultado.stderr.trim()}`)
  return resultado.stdout
}

async function buscarMapas(directorio) {
  const mapas = []
  const visitar = async (ruta) => {
    for (const entrada of await readdir(ruta, { withFileTypes: true })) {
      const rutaCompleta = join(ruta, entrada.name)
      if (entrada.isDirectory()) await visitar(rutaCompleta)
      else if (entrada.isFile() && entrada.name.endsWith('.map')) {
        mapas.push(JSON.parse(await leerArchivo(rutaCompleta, 'utf8')))
      }
    }
  }
  await visitar(directorio)
  return mapas
}

function consultarLicencias() {
  return new Promise((resolvePromise, reject) => {
    init(
      { start: RAIZ, customFormat: { licenseText: true }, excludePrivatePackages: true },
      (error, resultado) => {
        if (error) reject(error)
        else resolvePromise(resultado)
      }
    )
  })
}

async function compilarBloque() {
  const temporal = await mkdtemp(join(tmpdir(), 'shinobi-licencias-js-'))
  try {
    const binario = join(RAIZ, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js')
    ejecutar(process.execPath, [binario, 'build', '--sourcemap', '--outDir', temporal], RAIZ)
    const mapas = await buscarMapas(temporal)
    if (!mapas.length) throw new Error('electron-vite no generó mapas de fuentes')
    const arbol = JSON.parse(ejecutar('npm', ['ls', '--omit=dev', '--all', '--json'], RAIZ))
    const paquetes = paquetesDistribuidos(mapas, arbol)
    const inventario = await consultarLicencias()
    return generarBloque({ paquetes, inventario })
  } finally {
    await rm(temporal, { recursive: true, force: true })
  }
}

async function obtenerBloqueUv() {
  const version = JSON.parse(
    await readFile(join(RAIZ, 'scripts', 'uv-binarios.json'), 'utf8')
  ).version
  const carpeta = join(RAIZ, 'resources', 'licencias')
  const apache = (await readFile(join(carpeta, 'LICENSE-APACHE.txt'), 'utf8')).trim()
  const mit = (await readFile(join(carpeta, 'LICENSE-MIT.txt'), 'utf8')).trim()
  if (
    !apache ||
    !mit ||
    !apache.includes('Apache License') ||
    !mit.includes('MIT License') ||
    !mit.includes('Astral Software Inc.')
  ) {
    throw new Error(
      'Los textos de Apache-2.0 y MIT de uv están ausentes o no parecen ser las licencias oficiales'
    )
  }
  return [
    '## uv',
    '',
    `uv ${version} © Astral Software Inc. — Apache-2.0 o MIT. Se incluyen ambos textos de licencia.`,
    '',
    '### Apache-2.0',
    '',
    apache,
    '',
    '### MIT',
    '',
    mit
  ].join('\n')
}

async function generarArchivo() {
  const [contenido, bloqueJs, bloqueUv] = await Promise.all([
    readFile(ARCHIVO_AVISOS, 'utf8'),
    compilarBloque(),
    obtenerBloqueUv()
  ])
  let nuevo = reemplazarBloque(contenido, bloqueJs)
  const inicioUv = nuevo.indexOf('## uv\n')
  const inicioWorker = inicioUv >= 0 ? nuevo.indexOf('\n## Worker Python', inicioUv) : -1
  const bloqueElectron =
    '## Electron\n\nElectron incluye sus avisos en `LICENSE.electron.txt` y `LICENSES.chromium.html`, presentes en cada paquete distribuido.'
  const seccionUvElectron = `${bloqueUv}\n\n${bloqueElectron}`
  if (inicioUv >= 0 && inicioWorker >= 0) {
    nuevo = `${nuevo.slice(0, inicioUv)}${seccionUvElectron}${nuevo.slice(inicioWorker)}`
  } else {
    const despuesJs = nuevo.indexOf(MARCADOR_FIN) + MARCADOR_FIN.length
    nuevo = `${nuevo.slice(0, despuesJs)}\n\n${seccionUvElectron}\n${nuevo.slice(despuesJs)}`
  }
  nuevo = nuevo.replace(/\n\(lista completa pendiente de la tarea de empaquetado\)\n?/g, '\n')
  nuevo = nuevo.replace(
    'Dependencias de ejecución actuales (se incluyen en el bundle de la app): React y React DOM (MIT). Electron (MIT) se distribuye con la app. El resto (electron-vite, Vite, TypeScript, ESLint, Prettier, Vitest, Testing Library, Playwright…) son herramientas de desarrollo, no se distribuyen.',
    'Las dependencias JavaScript incluidas en la aplicación se detallan a continuación; los avisos de Electron aparecen en su apartado.'
  )
  nuevo = nuevo.replace(
    'Electron y las dependencias JavaScript incluidas en la aplicación se detallan arriba.',
    'Las dependencias JavaScript incluidas en la aplicación se detallan a continuación; los avisos de Electron aparecen en su apartado.'
  )
  return nuevo
}

async function main(argumentos) {
  const comprobar = argumentos.includes('--comprobar')
  if (argumentos.some((argumento) => argumento !== '--comprobar'))
    throw new Error('Uso: node scripts/licencias-js.mjs [--comprobar]')
  const esperado = await generarArchivo()
  const actual = await readFile(ARCHIVO_AVISOS, 'utf8')
  if (comprobar) {
    if (actual !== esperado)
      throw new Error(
        'THIRD_PARTY_NOTICES.md no coincide con las licencias generadas; ejecuta npm run licencias'
      )
    process.stdout.write('Avisos JS y uv comprobados.\n')
  } else {
    await writeFile(ARCHIVO_AVISOS, esperado)
    process.stdout.write('Avisos JS y uv actualizados en THIRD_PARTY_NOTICES.md.\n')
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`No se pudieron generar los avisos JS: ${error.message}\n`)
    process.exitCode = 1
  })
}
