// Prepara lo que irá en la Release (ADR 0020 §4 y fase 10): comprueba los 4 instaladores y sus
// sumas, genera SHA256SUMS.txt y compone las notas. No publica nada. Sin dependencias.
// Canal de versiones (por defecto): notas.md (parte 1), pie.md y que-cambio.json; la parte 2 la
// compone `publicar`. Canal `desarrollo`: instaladores renombrados y notas.md con el cuerpo de la
// spec 09 §3b.
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const INSTALADORES = [
  'Shinobi-Karaoke-Linux-x64.AppImage',
  'Shinobi-Karaoke-Mac-chip-Apple.dmg',
  'Shinobi-Karaoke-Windows-x64.exe',
  'shinobi-karaoke-linux-x64.deb'
]
const EXTENSIONES = /\.(exe|dmg|AppImage|deb)$/
const MARCADORES = /⟦|\{[A-Z][A-Z0-9_]*\}/
const COMMIT = /^[0-9a-f]{40}$/
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
]
const CLAVES_DESARROLLO = {
  WINDOWS: 'Shinobi-Karaoke-Windows-x64.exe',
  MAC: 'Shinobi-Karaoke-Mac-chip-Apple.dmg',
  DEB: 'shinobi-karaoke-linux-x64.deb',
  APPIMAGE: 'Shinobi-Karaoke-Linux-x64.AppImage'
}

export function sha256(ruta) {
  return createHash('sha256').update(readFileSync(ruta)).digest('hex')
}

/** Comprueba que están exactamente los instaladores y que cada SHA256SUMS-<so>.txt es cierto. */
export function verificarInstaladores(carpeta) {
  const archivos = readdirSync(carpeta)
  const encontrados = archivos.filter((n) => EXTENSIONES.test(n)).sort()
  const esperados = [...INSTALADORES].sort()
  const faltan = esperados.filter((n) => !encontrados.includes(n))
  const sobran = encontrados.filter((n) => !esperados.includes(n))
  if (faltan.length || sobran.length) {
    throw new Error(
      `Instaladores incorrectos. Faltan: ${faltan.join(', ') || 'ninguno'}. Sobran: ${sobran.join(', ') || 'ninguno'}.`
    )
  }
  const cubiertos = new Set()
  for (const nombre of archivos.filter((n) => /^SHA256SUMS-.+\.txt$/.test(n))) {
    const lineas = readFileSync(join(carpeta, nombre), 'utf8').split('\n').filter(Boolean)
    for (const linea of lineas) {
      const m = /^([0-9a-f]{64}) {2}(.+)$/.exec(linea)
      if (!m) throw new Error(`${nombre}: línea con formato inválido «${linea}»`)
      const [, hash, instalador] = m
      if (!existsSync(join(carpeta, instalador))) {
        throw new Error(`${nombre} cita ${instalador}, que no está`)
      }
      if (sha256(join(carpeta, instalador)) !== hash) {
        throw new Error(`${nombre}: la suma de ${instalador} no coincide`)
      }
      cubiertos.add(instalador)
    }
  }
  const sinSuma = esperados.filter((n) => !cubiertos.has(n))
  if (sinSuma.length) throw new Error(`Sin suma de verificación: ${sinSuma.join(', ')}`)
}

/** `SHA256SUMS.txt` en formato sha256sum, ordenado por nombre. */
export function generarSumas(carpeta) {
  return (
    [...INSTALADORES]
      .sort()
      .map((nombre) => `${sha256(join(carpeta, nombre))}  ${nombre}`)
      .join('\n') + '\n'
  )
}

/** aviso (si es previa) → cabecera → notas de la versión. Falla con marcadores sin resolver. */
export function componerNotas({ aviso, cabecera, notas, previa }) {
  const partes = [previa ? aviso : null, cabecera, notas].filter((p) => p && p.trim() !== '')
  const texto = partes.map((p) => p.trim()).join('\n\n') + '\n'
  if (MARCADORES.test(texto)) {
    throw new Error('notas.md contiene un marcador ⟦…⟧ o {…} sin resolver')
  }
  return texto
}

export function rutaNotas(raiz, version) {
  const base = version.replace(/-.*$/, '')
  return join(raiz, 'lanzamientos', 'notas', base, `${version}.md`)
}

/** Sustituye cada `{MARCADOR}` por su valor, literalmente, y falla si queda alguno sin resolver. */
export function resolver(plantilla, valores, nombre) {
  let texto = plantilla
  for (const [clave, valor] of Object.entries(valores)) {
    texto = texto.split(`{${clave}}`).join(valor)
  }
  const resto = texto.match(MARCADORES)
  if (resto) throw new Error(`${nombre} contiene un marcador sin resolver: ${resto[0]}`)
  return texto
}

/** Notas a mano obligatorias al publicar (fase 10): devuelve los problemas; en una etiqueta lanza. */
export function revisarNotasAMano({ existe, texto, ensayo }) {
  const problemas = []
  if (!existe) problemas.push('No existen las notas escritas a mano de esta versión.')
  else if (/^> Borrador/m.test(texto)) problemas.push('Las notas conservan una línea «> Borrador».')
  if (problemas.length && !ensayo) throw new Error(problemas.join(' '))
  return problemas
}

/** Verifica y devuelve las plantillas de la parte 2 (`que-cambio.json`). */
export function leerQueCambio(texto) {
  const q = JSON.parse(texto)
  const claves = ['separador', 'encabezado', 'todosLosCambios', 'compilacion', 'sinPr']
  for (const clave of [...claves, 'primeraVersion']) {
    if (typeof q[clave] !== 'string' || !q[clave]) {
      throw new Error(`que-cambio.json: falta «${clave}»`)
    }
  }
  if (!Array.isArray(q.quitar) || !Array.isArray(q.sustituciones)) {
    throw new Error('que-cambio.json: faltan «quitar» o «sustituciones»')
  }
  return q
}

/** «Compilación» con los valores resueltos (`pie.md`). */
export function componerPie({ plantilla, compilacion, sha, ejecucion }) {
  if (!COMMIT.test(sha)) throw new Error('--sha debe tener 40 caracteres hexadecimales')
  const valores = {
    NUMERO: compilacion,
    HASH: sha.slice(0, 7),
    SHA_COMPLETO: sha,
    RUN_URL: ejecucion
  }
  return resolver(plantilla, valores, 'pie.md').trim() + '\n'
}

/** Reúne instaladores, sumas, notas y datos en `salida`. Devuelve los datos y el resumen. */
export function prepararPublicacion({
  entrada,
  salida,
  raiz,
  version,
  etiqueta,
  previa,
  ensayo,
  compilacion,
  sha,
  ejecucion
}) {
  verificarInstaladores(entrada)
  mkdirSync(salida, { recursive: true })
  for (const nombre of INSTALADORES) copyFileSync(join(entrada, nombre), join(salida, nombre))
  writeFileSync(join(salida, 'SHA256SUMS.txt'), generarSumas(salida))

  const plantillas = join(raiz, '.github', 'publicacion')
  const leer = (ruta) => readFileSync(ruta, 'utf8')
  const archivoNotas = rutaNotas(raiz, version)
  const hayNotas = existsSync(archivoNotas)
  const textoNotas = hayNotas ? leer(archivoNotas) : ''
  const avisos = revisarNotasAMano({ existe: hayNotas, texto: textoNotas, ensayo })
  const notas = componerNotas({
    aviso: leer(join(plantillas, 'aviso-previa.md')),
    cabecera: leer(join(plantillas, 'cabecera.md')),
    notas: textoNotas,
    previa
  })
  writeFileSync(join(salida, 'notas.md'), notas)
  const textosQueCambio = leer(join(plantillas, 'que-cambio.json'))
  const queCambio = leerQueCambio(textosQueCambio)
  writeFileSync(join(salida, 'que-cambio.json'), textosQueCambio)
  let pie = ''
  if (compilacion || sha || ejecucion) {
    if (!compilacion || !sha || !ejecucion) {
      throw new Error('--compilacion, --sha y --ejecucion se dan juntos')
    }
    pie = componerPie({ plantilla: queCambio.compilacion, compilacion, sha, ejecucion })
    writeFileSync(join(salida, 'pie.md'), pie)
  }
  const datos = { version, etiqueta, previa }
  writeFileSync(join(salida, 'datos.json'), JSON.stringify(datos, null, 2) + '\n')

  const filas = [...INSTALADORES, 'SHA256SUMS.txt'].sort().map((nombre) => {
    const mb = (statSync(join(salida, nombre)).size / 1e6).toFixed(1)
    const hash = nombre === 'SHA256SUMS.txt' ? '—' : `\`${sha256(join(salida, nombre))}\``
    return `| ${nombre} | ${mb} | ${hash} |`
  })
  const rutaRelativa = archivoNotas.slice(raiz.length).replaceAll('\\', '/').replace(/^\//, '')
  const resumen = [
    `## Publicación preparada: ${etiqueta}`,
    '',
    `Tipo: **${previa ? 'versión preliminar (pre-release)' : 'versión estable'}**. Etiqueta prevista: \`${etiqueta}\`.`,
    '',
    '| Recurso | MB | SHA-256 |',
    '|---|---:|---|',
    ...filas,
    '',
    ...avisos.flatMap((a) => [`**Aviso:** ${a} Con una etiqueta, la publicación fallaría.`, '']),
    ...(hayNotas ? [`Notas de la versión: \`${rutaRelativa}\`.`, ''] : []),
    '### Parte 1 de las notas (notas.md)',
    '',
    '````markdown',
    notas.trimEnd(),
    '````',
    '',
    ...(pie ? ['### Compilación (pie.md)', '', '````markdown', pie.trimEnd(), '````', ''] : []),
    '«Qué cambió» se genera al publicar.',
    '',
    ...(ensayo ? ['Ensayo: no se ha publicado nada.', ''] : [])
  ].join('\n')
  return { datos, resumen }
}

/** `Shinobi-Karaoke-Windows-x64.exe` → `Shinobi-Karaoke-desarrollo-<compilación>-Windows-x64.exe`. */
export function nombreDesarrollo(nombre, compilacion) {
  if (!INSTALADORES.includes(nombre)) throw new Error(`Instalador desconocido: ${nombre}`)
  return nombre.replace(/^(shinobi-karaoke)-/i, `$1-desarrollo-${compilacion}-`)
}

/** «22 de noviembre de 2026», en UTC. */
export function fechaLarga(fecha) {
  return `${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]} de ${fecha.getUTCFullYear()}`
}

/** Megabytes decimales con una cifra y coma: «152,3 MB». */
export function tamanoMB(bytes) {
  return `${(bytes / 1e6).toFixed(1).replace('.', ',')} MB`
}

/** Cuerpo de una compilación de desarrollo (spec 09 §3b). */
export function componerCuerpoDesarrollo({
  plantilla,
  compilacion,
  sha,
  anterior,
  ejecucion,
  fecha,
  archivos
}) {
  const hash = sha.slice(0, 7)
  const desde = anterior
    ? `[${anterior.slice(0, 7)}…${hash}](https://github.com/Gomonsoft/shinobi-karaoke/compare/${anterior}...${sha})`
    : 'Es la primera compilación de este canal.'
  const valores = {
    NUMERO: compilacion,
    FECHA: fechaLarga(fecha),
    HASH: hash,
    SHA_COMPLETO: sha,
    RUN_URL: ejecucion,
    CAMBIOS_DESDE: desde
  }
  for (const [clave, a] of Object.entries(archivos)) {
    valores[`ARCHIVO_${clave}`] = a.nombre
    valores[`TAMANO_${clave}`] = tamanoMB(a.bytes)
    valores[`SHA256_${clave}`] = a.sha256
  }
  return resolver(plantilla, valores, 'notas.md').trim() + '\n'
}

/** Canal de desarrollo: renombra los instaladores, genera sumas y compone `notas.md`. */
export function prepararDesarrollo({
  entrada,
  salida,
  raiz,
  version,
  compilacion,
  sha,
  anterior = '',
  ejecucion,
  fecha = new Date()
}) {
  if (!COMMIT.test(sha)) throw new Error('--sha debe tener 40 caracteres hexadecimales')
  if (anterior && !COMMIT.test(anterior)) {
    throw new Error('--anterior debe estar vacío o tener 40 caracteres hexadecimales')
  }
  if (
    !compilacion.startsWith(`${version}-`) ||
    !/^[1-9]\d*$/.test(compilacion.slice(version.length + 1))
  ) {
    throw new Error(`--compilacion debe ser <versión>-<N>; recibido «${compilacion}»`)
  }
  verificarInstaladores(entrada)
  mkdirSync(salida, { recursive: true })
  const archivos = {}
  for (const [clave, original] of Object.entries(CLAVES_DESARROLLO)) {
    const nombre = nombreDesarrollo(original, compilacion)
    copyFileSync(join(entrada, original), join(salida, nombre))
    archivos[clave] = {
      nombre,
      bytes: statSync(join(salida, nombre)).size,
      sha256: sha256(join(salida, nombre))
    }
  }
  const sumas = Object.values(archivos)
    .sort((a, b) => (a.nombre < b.nombre ? -1 : 1))
    .map((a) => `${a.sha256}  ${a.nombre}`)
  writeFileSync(join(salida, 'SHA256SUMS.txt'), sumas.join('\n') + '\n')
  const notas = componerCuerpoDesarrollo({
    plantilla: readFileSync(join(raiz, '.github', 'publicacion', 'cuerpo-desarrollo.md'), 'utf8'),
    compilacion,
    sha,
    anterior,
    ejecucion,
    fecha,
    archivos
  })
  writeFileSync(join(salida, 'notas.md'), notas)
  const datos = {
    etiqueta: `build-${sha}`,
    titulo: compilacion,
    version,
    sha,
    archivos: Object.values(archivos).map((a) => a.nombre)
  }
  writeFileSync(join(salida, 'datos.json'), JSON.stringify(datos, null, 2) + '\n')
  const resumen = [
    `## Compilación de desarrollo preparada: ${compilacion}`,
    '',
    `Etiqueta prevista en el canal: \`build-${sha}\`.`,
    '',
    '| Recurso | MB | SHA-256 |',
    '|---|---:|---|',
    ...Object.values(archivos).map(
      (a) => `| ${a.nombre} | ${tamanoMB(a.bytes)} | \`${a.sha256}\` |`
    ),
    '',
    '### notas.md',
    '',
    '````markdown',
    notas.trimEnd(),
    '````',
    ''
  ].join('\n')
  return { datos, resumen }
}

function valor(argv, nombre) {
  const i = argv.indexOf(nombre)
  if (i < 0 || !argv[i + 1]) throw new Error(`Falta ${nombre}`)
  return argv[i + 1]
}

/** Valor de una opción; `''` es válido (por ejemplo `--anterior ''`). */
function opcion(argv, nombre) {
  const i = argv.indexOf(nombre)
  return i < 0 ? undefined : argv[i + 1]
}

function principal(argv) {
  const raiz = fileURLToPath(new URL('../../', import.meta.url))
  const canal = opcion(argv, '--canal') ?? 'versiones'
  let resultado
  if (canal === 'desarrollo') {
    const anterior = opcion(argv, '--anterior')
    if (anterior === undefined) throw new Error('Falta --anterior (vacío si no hay)')
    resultado = prepararDesarrollo({
      entrada: valor(argv, '--entrada'),
      salida: valor(argv, '--salida'),
      raiz,
      version: valor(argv, '--version'),
      compilacion: valor(argv, '--compilacion'),
      sha: valor(argv, '--sha'),
      anterior,
      ejecucion: valor(argv, '--ejecucion')
    })
  } else if (canal === 'versiones') {
    resultado = prepararPublicacion({
      entrada: valor(argv, '--entrada'),
      salida: valor(argv, '--salida'),
      raiz,
      version: valor(argv, '--version'),
      etiqueta: valor(argv, '--etiqueta'),
      previa: valor(argv, '--previa') === 'true',
      ensayo: argv.includes('--ensayo'),
      compilacion: opcion(argv, '--compilacion'),
      sha: opcion(argv, '--sha'),
      ejecucion: opcion(argv, '--ejecucion')
    })
  } else {
    throw new Error(`--canal desconocido: ${canal} (versiones o desarrollo)`)
  }
  const { datos, resumen } = resultado
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumen + '\n')
  }
  console.log(JSON.stringify(datos))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    principal(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
