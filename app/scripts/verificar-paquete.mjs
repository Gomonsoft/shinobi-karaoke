import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listPackage } from '@electron/asar'
import { getCurrentFuseWire } from '@electron/fuses'

const DIRECTORIO = dirname(fileURLToPath(import.meta.url))
const UV = JSON.parse(readFileSync(join(DIRECTORIO, 'uv-binarios.json'), 'utf8'))

export const FUSES_ESPERADOS = Object.freeze({
  RunAsNode: false,
  EnableCookieEncryption: false,
  EnableNodeOptionsEnvironmentVariable: false,
  EnableNodeCliInspectArguments: false,
  EnableEmbeddedAsarIntegrityValidation: true,
  OnlyLoadAppFromAsar: true,
  LoadBrowserProcessSpecificV8Snapshot: false,
  GrantFileProtocolExtraPrivileges: false,
  WasmTrapHandlers: true
})

export const ENTRADAS_PROHIBIDAS = Object.freeze([
  'spikes',
  'tests',
  'e2e',
  'e2e-paquete',
  '.datos-dev',
  'docs',
  'src',
  '.venv',
  '__pycache__',
  'test_*.py',
  'conftest.py',
  '*.test.*',
  '*.map',
  '*.ts',
  'semilla',
  'scripts',
  'lucide-react',
  'react',
  'electron-builder'
])

const NUMEROS_FUSE = Object.freeze({
  RunAsNode: 0,
  EnableCookieEncryption: 1,
  EnableNodeOptionsEnvironmentVariable: 2,
  EnableNodeCliInspectArguments: 3,
  EnableEmbeddedAsarIntegrityValidation: 4,
  OnlyLoadAppFromAsar: 5,
  LoadBrowserProcessSpecificV8Snapshot: 6,
  GrantFileProtocolExtraPrivileges: 7,
  WasmTrapHandlers: 8
})
const VALORES_FUSE = Object.freeze({ false: 48, true: 49 })

function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje)
}

function caminar(raiz) {
  if (!existsSync(raiz)) return []
  const resultado = []
  const visitar = (ruta) => {
    for (const entrada of readdirSync(ruta, { withFileTypes: true })) {
      const rutaCompleta = join(ruta, entrada.name)
      resultado.push(rutaCompleta)
      if (entrada.isDirectory()) visitar(rutaCompleta)
    }
  }
  visitar(raiz)
  return resultado
}

function coincideProhibida(ruta) {
  const partes = ruta.split(/[\\/]/).filter(Boolean)
  const indiceModulos = partes.indexOf('node_modules')
  const paquete =
    indiceModulos >= 0
      ? partes[indiceModulos + 1]?.startsWith('@')
        ? `${partes[indiceModulos + 1]}/${partes[indiceModulos + 2]}`
        : partes[indiceModulos + 1]
      : null
  for (const parte of partes) {
    if (parte.endsWith('.d.ts') && (paquete === 'yaml' || paquete === 'zod')) continue
    for (const patron of ENTRADAS_PROHIBIDAS) {
      if (patron.includes('*')) {
        const expresion = new RegExp(
          `^${patron
            .split('*')
            .map((trozo) => trozo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*')}$`
        )
        if (expresion.test(parte)) return parte
      } else if (parte === patron) return parte
    }
  }
  return null
}

function determinarRaices(entrada, plataforma) {
  const ruta = resolve(entrada)
  if (plataforma === 'darwin') {
    const app = ruta.endsWith('.app')
      ? ruta
      : readdirSync(ruta)
          .map((nombre) => join(ruta, nombre))
          .find((p) => p.endsWith('.app'))
    exigir(app && existsSync(app), `No se encontró el bundle .app en ${ruta}`)
    const contenido = join(app, 'Contents')
    return {
      paquete: app,
      recursos: join(contenido, 'Resources'),
      ejecutable: join(contenido, 'MacOS', 'Shinobi Karaoke'),
      info: join(contenido, 'Info.plist')
    }
  }
  return {
    paquete: ruta,
    recursos: join(ruta, 'resources'),
    ejecutable: plataforma === 'win32' ? join(ruta, 'Shinobi Karaoke.exe') : null
  }
}

function requisitosDelManifiesto(recursos) {
  const manifiesto = JSON.parse(readFileSync(join(recursos, 'runtime-manifest.json'), 'utf8'))
  const resultados = new Map()
  for (const [plataforma, perfiles] of Object.entries(manifiesto.runtime ?? {})) {
    for (const [perfil, datos] of Object.entries(perfiles ?? {})) {
      const ruta = datos.requisitos
      if (typeof ruta === 'string')
        resultados.set(ruta, { plataforma, perfil, sha256: datos.sha256_requisitos })
    }
  }
  return resultados
}

function estaEjecutable(ruta, plataforma) {
  if (plataforma === 'win32') return extname(ruta).toLowerCase() === '.exe'
  return (statSync(ruta).mode & 0o111) !== 0
}

function verificarFirmaMac(raices, ejecutar) {
  ejecutar('codesign', ['--verify', '--deep', '--strict', raices.paquete])
  for (const ruta of [raices.paquete, join(raices.recursos, 'bin', 'uv')]) {
    const salida = ejecutar('codesign', ['-dv', '--verbose=4', ruta])
    exigir(/flags=0x2\(adhoc\)/.test(salida), `Firma de tipo ad hoc ausente en ${ruta}`)
  }
  const plist = ejecutar('plutil', ['-p', raices.info])
  exigir(plist.includes('"ElectronAsarIntegrity"'), `Falta ElectronAsarIntegrity en ${raices.info}`)
  const minimo = ejecutar('plutil', [
    '-extract',
    'LSMinimumSystemVersion',
    'raw',
    '-o',
    '-',
    raices.info
  ]).trim()
  exigir(
    Number(minimo) < 14 && Number(minimo) >= 13,
    `LSMinimumSystemVersion debe ser 13.x y menor que 14; recibido ${minimo}`
  )
  const arquitecturas = ejecutar('lipo', ['-archs', raices.ejecutable]).trim().split(/\s+/)
  exigir(
    arquitecturas.length === 1 && arquitecturas[0] === 'arm64',
    `Arquitectura del ejecutable debe ser solo arm64; recibido ${arquitecturas.join(', ')}`
  )
}

function verificarFuses(wire) {
  exigir(
    wire && wire.version === '1',
    `Versión de mapa de fuses desconocida: ${wire?.version ?? 'ausente'}`
  )
  const claves = Object.keys(wire).filter((clave) => clave !== 'version')
  const desconocidos = claves.filter(
    (clave) => !Object.values(NUMEROS_FUSE).includes(Number(clave))
  )
  exigir(desconocidos.length === 0, `Fuse desconocido en el ejecutable: ${desconocidos.join(', ')}`)
  const faltantes = Object.values(NUMEROS_FUSE).filter(
    (indice) => !Object.hasOwn(wire, String(indice))
  )
  exigir(faltantes.length === 0, `Faltan fuses en el ejecutable: ${faltantes.join(', ')}`)
  const encontrados = {}
  for (const [nombre, indice] of Object.entries(NUMEROS_FUSE)) {
    const valor = wire[String(indice)]
    const esperado = VALORES_FUSE[String(FUSES_ESPERADOS[nombre])]
    exigir(
      valor === esperado,
      `Fuse ${nombre}: esperado ${FUSES_ESPERADOS[nombre] ? 'activado' : 'desactivado'}, recibido ${valor}`
    )
    encontrados[nombre] = FUSES_ESPERADOS[nombre]
  }
  return encontrados
}

function verificarAsar(asar, listar) {
  exigir(asar, 'Falta resources/app.asar')
  const entradas = listar(asar, { isPack: false }).map((ruta) => ruta.replaceAll('\\', '/'))
  const conjunto = new Set(entradas)
  for (const requerido of ['/package.json', '/out/main', '/out/preload', '/out/renderer']) {
    exigir(
      [...conjunto].some((ruta) => ruta === requerido || ruta.startsWith(`${requerido}/`)),
      `Falta ${requerido} en app.asar`
    )
  }
  for (const ruta of entradas) {
    const partes = ruta.split('/').filter(Boolean)
    const i = partes.indexOf('node_modules')
    if (i >= 0) {
      const paquete = partes[i + 1]?.startsWith('@')
        ? `${partes[i + 1]}/${partes[i + 2]}`
        : partes[i + 1]
      exigir(
        ruta === '/node_modules' || paquete === 'yaml' || paquete === 'zod',
        `Dependencia no permitida en app.asar: ${paquete ?? ruta}`
      )
    }
    const prohibida = coincideProhibida(ruta)
    exigir(!prohibida, `Entrada prohibida en app.asar: ${ruta} (${prohibida})`)
  }
  return entradas
}

export async function verificarPaquete({
  entrada,
  plataforma = process.platform,
  leerFuses = getCurrentFuseWire,
  listarAsar = listPackage,
  ejecutar = (comando, argumentos) => {
    const resultado = spawnSync(comando, argumentos, { encoding: 'utf8' })
    if (resultado.error) throw resultado.error
    if (resultado.status !== 0) {
      throw new Error(`${comando} ${argumentos.join(' ')} falló: ${resultado.stderr.trim()}`)
    }
    return `${resultado.stdout}${resultado.stderr}`
  }
} = {}) {
  exigir(
    typeof entrada === 'string' && entrada.length > 0,
    'Indica la ruta al paquete desempaquetado o bundle .app'
  )
  exigir(
    ['darwin', 'win32', 'linux'].includes(plataforma),
    `Plataforma no admitida por el verificador: ${plataforma}`
  )
  const raices = determinarRaices(entrada, plataforma)
  exigir(existsSync(raices.recursos), `Falta la carpeta de recursos: ${raices.recursos}`)
  const obligatorios = [
    'app.asar',
    'runtime-manifest.json',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'worker/shinobi_worker/__main__.py',
    'worker/pyproject.toml',
    'worker/uv.lock',
    'worker/requisitos/exclusiones.txt'
  ]
  for (const ruta of obligatorios)
    exigir(existsSync(join(raices.recursos, ruta)), `Falta ${join(raices.recursos, ruta)}`)

  const rutaExclusiones = join(raices.recursos, 'worker/requisitos/exclusiones.txt')
  const exclusiones = readFileSync(rutaExclusiones, 'utf8').trim().split(/\r?\n/).sort()
  exigir(
    exclusiones.length === 2 && exclusiones[0] === 'diffq' && exclusiones[1] === 'diffq-fixed',
    `Exclusiones de DiffQ inesperadas en ${rutaExclusiones}`
  )

  const prohibidaRecursos = caminar(raices.recursos).map((ruta) =>
    relative(raices.recursos, ruta).split(sep).join('/')
  )
  for (const ruta of prohibidaRecursos) {
    const prohibida = coincideProhibida(ruta)
    exigir(!prohibida, `Entrada prohibida en resources: ${ruta} (${prohibida})`)
  }

  const rutasRequisitos = requisitosDelManifiesto(raices.recursos)
  exigir(rutasRequisitos.size > 0, 'runtime-manifest.json no cita ningún archivo de requisitos')
  for (const [rutaRelativa, datos] of rutasRequisitos) {
    const ruta = join(raices.recursos, rutaRelativa)
    exigir(
      existsSync(ruta),
      `Falta el archivo de requisitos ${rutaRelativa} (${datos.plataforma}/${datos.perfil})`
    )
    const sha = createHash('sha256').update(readFileSync(ruta)).digest('hex')
    exigir(
      sha === datos.sha256,
      `SHA-256 distinto en ${rutaRelativa}: esperado ${datos.sha256}, recibido ${sha}`
    )
  }

  const familias = readdirSync(join(raices.recursos, 'fonts'), { withFileTypes: true }).filter(
    (item) => item.isDirectory()
  )
  exigir(familias.length > 0, `No hay familias de fuentes en ${join(raices.recursos, 'fonts')}`)
  for (const familia of familias) {
    const carpeta = join(raices.recursos, 'fonts', familia.name)
    exigir(existsSync(join(carpeta, 'OFL.txt')), `Falta ${join(carpeta, 'OFL.txt')}`)
    exigir(
      readdirSync(carpeta).some((nombre) => nombre.endsWith('.woff2')),
      `Falta fuente .woff2 en ${carpeta}`
    )
  }

  const uvPath = join(raices.recursos, 'bin', plataforma === 'win32' ? 'uv.exe' : 'uv')
  exigir(existsSync(uvPath), `Falta el ejecutable ${uvPath}`)
  exigir(estaEjecutable(uvPath, plataforma), `${uvPath} no es ejecutable`)
  const uvConfig =
    UV.binarios[
      `${plataforma}-${process.arch === 'arm64' && plataforma === 'darwin' ? 'arm64' : 'x64'}`
    ]
  exigir(uvConfig, `No hay versión de uv fijada para ${plataforma}`)
  const uvSalida = ejecutar(uvPath, ['--version']).trim()
  exigir(
    new RegExp(`^uv ${UV.version}(?:\\s|$)`).test(uvSalida),
    `Versión incorrecta de uv: esperado ${UV.version}, recibido ${uvSalida}`
  )

  const asar = join(raices.recursos, 'app.asar')
  const entradasAsar = verificarAsar(asar, listarAsar)
  const ejecutableFuses =
    raices.ejecutable ??
    (plataforma === 'win32' ? raices.ejecutable : join(raices.paquete, 'shinobi-karaoke'))
  const fuses = verificarFuses(await leerFuses(ejecutableFuses))
  if (plataforma === 'darwin') verificarFirmaMac(raices, ejecutar)
  if (plataforma === 'win32') exigir(existsSync(raices.ejecutable), `Falta ${raices.ejecutable}`)
  if (plataforma === 'linux')
    exigir(
      existsSync(join(raices.recursos, 'apparmor-profile')),
      `Falta ${join(raices.recursos, 'apparmor-profile')}`
    )

  const tamano = caminar(raices.paquete).reduce((total, ruta) => {
    const info = lstatSync(ruta)
    return total + (info.isFile() ? info.size : 0)
  }, 0)
  return {
    plataforma,
    tamano_desempaquetado: tamano,
    fuses,
    comprobaciones: [
      ...obligatorios.map((ruta) => `resources/${ruta}`),
      ...rutasRequisitos.keys(),
      ...familias.map((familia) => `fonts/${familia.name}: OFL.txt y WOFF2`),
      `uv ${UV.version}`,
      `app.asar (${entradasAsar.length} entradas)`,
      'fuses',
      ...(plataforma === 'darwin' ? ['firma ad hoc, integridad y arm64'] : [])
    ]
  }
}

async function main(argumentos) {
  const entrada = argumentos[0]
  let rutaJson
  for (let i = 1; i < argumentos.length; i += 1) {
    if (argumentos[i] === '--json') rutaJson = argumentos[++i]
    else throw new Error(`Argumento desconocido: ${argumentos[i]}`)
  }
  if (rutaJson && !rutaJson.length) throw new Error('--json requiere una ruta de salida')
  const resultado = await verificarPaquete({ entrada })
  const salida = `${JSON.stringify(resultado, null, 2)}\n`
  if (rutaJson)
    await import('node:fs/promises').then(({ writeFile }) => writeFile(resolve(rutaJson), salida))
  process.stdout.write(salida)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`Verificación del paquete fallida: ${error.message}\n`)
    process.exitCode = 1
  })
}
