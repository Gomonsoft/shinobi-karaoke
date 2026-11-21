// Versión única de app y worker (ADR 0020 §2 y §3): subirla y comprobarla. Sin dependencias.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta|rc)\.([1-9]\d*))?$/
const ORDEN_PREVIA = { alpha: 0, beta: 1, rc: 2 }
const SUFIJO_PEP440 = { alpha: 'a', beta: 'b', rc: 'rc' }

/**
 * Los sitios de la versión. `patron` aísla la línea: los grupos 1 y 3 se conservan y el 2 es el
 * número. `real` es el archivo en disco cuando el nombre mostrado añade un detalle.
 */
export const SITIOS = [
  { archivo: 'app/package.json', pep440: false, patron: /^(\s*"version":\s*")([^"]+)(")/m },
  { archivo: 'app/package-lock.json', pep440: false, patron: /^(\s*"version":\s*")([^"]+)(")/m },
  {
    archivo: 'app/package-lock.json (packages[""])',
    real: 'app/package-lock.json',
    pep440: false,
    patron: /("packages":\s*\{\s*""\s*:\s*\{[^}]*?"version":\s*")([^"]+)(")/
  },
  {
    archivo: 'worker/pyproject.toml',
    pep440: true,
    patron: /(\[project\][^[]*?^version\s*=\s*")([^"]+)(")/m
  },
  {
    archivo: 'worker/shinobi_worker/__init__.py',
    pep440: true,
    patron: /^(__version__\s*=\s*")([^"]+)(")/m
  },
  {
    archivo: 'worker/uv.lock',
    pep440: true,
    patron: /(\[\[package\]\]\r?\nname = "shinobi-worker"\r?\nversion = ")([^"]+)(")/
  }
]

/** @returns {boolean} */
export function validar(version) {
  return SEMVER.test(version)
}

/** @returns {{ numeros: number[], previa: { tipo: string, n: number } | null }} */
export function analizar(version) {
  const m = SEMVER.exec(version)
  if (!m) {
    throw new Error(`Versión no válida: «${version}» (esperado X.Y.Z o X.Y.Z-alpha|beta|rc.N)`)
  }
  return {
    numeros: [Number(m[1]), Number(m[2]), Number(m[3])],
    previa: m[4] ? { tipo: m[4], n: Number(m[5]) } : null
  }
}

/** Orden SemVer: negativo si a < b. Las previas van antes de la estable. */
export function comparar(a, b) {
  const x = analizar(a)
  const y = analizar(b)
  for (let i = 0; i < 3; i++) {
    if (x.numeros[i] !== y.numeros[i]) return x.numeros[i] - y.numeros[i]
  }
  if (!x.previa && !y.previa) return 0
  if (!x.previa) return 1
  if (!y.previa) return -1
  if (x.previa.tipo !== y.previa.tipo) {
    return ORDEN_PREVIA[x.previa.tipo] - ORDEN_PREVIA[y.previa.tipo]
  }
  return x.previa.n - y.previa.n
}

/** `0.2.0-alpha.1` → `0.2.0a1`. */
export function aPep440(version) {
  const { numeros, previa } = analizar(version)
  const base = numeros.join('.')
  return previa ? `${base}${SUFIJO_PEP440[previa.tipo]}${previa.n}` : base
}

/** Valida `vX.Y.Z[-previa.N]` y devuelve la versión SemVer sin la `v`. */
export function analizarEtiqueta(etiqueta) {
  if (!etiqueta.startsWith('v') || !validar(etiqueta.slice(1))) {
    throw new Error(`La etiqueta «${etiqueta}» no cumple vX.Y.Z o vX.Y.Z-(alpha|beta|rc).N`)
  }
  return etiqueta.slice(1)
}

export function esPrevia(version) {
  return analizar(version).previa !== null
}

function leer(raiz, ruta) {
  return readFileSync(join(raiz, ruta), 'utf8')
}

function rutaReal(sitio) {
  return sitio.real ?? sitio.archivo
}

/** Lee la versión de cada sitio. */
export function leerVersiones(raiz) {
  return SITIOS.map((sitio) => {
    const m = sitio.patron.exec(leer(raiz, rutaReal(sitio)))
    if (!m) throw new Error(`No se encontró la versión en ${sitio.archivo}`)
    return { archivo: sitio.archivo, valor: m[2], pep440: sitio.pep440 }
  })
}

/** Falla nombrando el archivo discrepante; devuelve la versión SemVer común. */
export function comprobarVersiones(raiz, { etiqueta } = {}) {
  const sitios = leerVersiones(raiz)
  const version = sitios[0].valor
  analizar(version)
  const pep = aPep440(version)
  for (const { archivo, valor, pep440 } of sitios) {
    const esperado = pep440 ? pep : version
    if (valor !== esperado) {
      throw new Error(
        `${archivo} dice «${valor}» y se esperaba «${esperado}» (app/package.json: ${version})`
      )
    }
  }
  if (etiqueta !== undefined && analizarEtiqueta(etiqueta) !== version) {
    throw new Error(`La etiqueta ${etiqueta} no coincide con la versión ${version}`)
  }
  return version
}

/** Escribe solo la línea de la versión de cada archivo. No toca git. */
export function subirVersion(raiz, nueva) {
  analizar(nueva)
  const actual = leerVersiones(raiz)[0].valor
  if (comparar(nueva, actual) <= 0) {
    throw new Error(`La versión ${nueva} no es mayor que la actual (${actual})`)
  }
  const pep = aPep440(nueva)
  const archivos = new Map()
  for (const sitio of SITIOS) {
    const ruta = rutaReal(sitio)
    const texto = archivos.get(ruta) ?? leer(raiz, ruta)
    if (!sitio.patron.test(texto)) throw new Error(`No se encontró la versión en ${sitio.archivo}`)
    const valor = sitio.pep440 ? pep : nueva
    archivos.set(
      ruta,
      texto.replace(sitio.patron, (_, antes, _viejo, despues) => `${antes}${valor}${despues}`)
    )
  }
  for (const [ruta, texto] of archivos) writeFileSync(join(raiz, ruta), texto)
  return { anterior: actual, nueva }
}

export function raizDelRepositorio() {
  return fileURLToPath(new URL('../../', import.meta.url))
}

function principal(argv) {
  const [orden, ...resto] = argv
  const raiz = raizDelRepositorio()
  if (orden === 'subir') {
    if (!resto[0]) throw new Error('Uso: version.mjs subir <semver>')
    const { anterior, nueva } = subirVersion(raiz, resto[0])
    console.log(`Versión ${anterior} → ${nueva} (worker: ${aPep440(nueva)})`)
    return
  }
  if (orden === 'comprobar') {
    const i = resto.indexOf('--etiqueta')
    const etiqueta = i >= 0 ? resto[i + 1] : undefined
    if (i >= 0 && !etiqueta) throw new Error('--etiqueta necesita un valor')
    const version = comprobarVersiones(raiz, { etiqueta })
    if (resto.includes('--salida-github')) {
      const salida = process.env.GITHUB_OUTPUT
      if (!salida) throw new Error('--salida-github necesita GITHUB_OUTPUT')
      appendFileSync(
        salida,
        `version=${version}\netiqueta=v${version}\nprevia=${esPrevia(version)}\nversion_pep440=${aPep440(version)}\n`
      )
    }
    console.log(version)
    return
  }
  throw new Error(
    'Uso: version.mjs subir <semver> | comprobar [--etiqueta vX.Y.Z] [--salida-github]'
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    principal(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
