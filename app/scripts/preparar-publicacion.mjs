// Prepara lo que irá en la Release (ADR 0020 §4): comprueba los 4 instaladores y sus sumas,
// genera SHA256SUMS.txt y compone notas.md. No publica nada. Sin dependencias.
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
const MARCADORES = /⟦|\{ENLACE_/

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
    throw new Error('notas.md contiene un marcador ⟦…⟧ o {ENLACE_…} sin resolver')
  }
  return texto
}

export function rutaNotas(raiz, version) {
  const base = version.replace(/-.*$/, '')
  return join(raiz, 'docs', 'versiones', base, 'notas', `${version}.md`)
}

/** Reúne instaladores, sumas, notas y datos en `salida`. Devuelve los datos y el resumen. */
export function prepararPublicacion({ entrada, salida, raiz, version, etiqueta, previa, ensayo }) {
  verificarInstaladores(entrada)
  mkdirSync(salida, { recursive: true })
  for (const nombre of INSTALADORES) copyFileSync(join(entrada, nombre), join(salida, nombre))
  const sumas = generarSumas(salida)
  writeFileSync(join(salida, 'SHA256SUMS.txt'), sumas)

  const plantillas = join(raiz, '.github', 'publicacion')
  const leer = (ruta) => readFileSync(ruta, 'utf8')
  const archivoNotas = rutaNotas(raiz, version)
  const hayNotas = existsSync(archivoNotas)
  const notas = componerNotas({
    aviso: leer(join(plantillas, 'aviso-previa.md')),
    cabecera: leer(join(plantillas, 'cabecera.md')),
    notas: hayNotas ? leer(archivoNotas) : '',
    previa
  })
  writeFileSync(join(salida, 'notas.md'), notas)
  const datos = { version, etiqueta, previa, generar_notas: !hayNotas }
  writeFileSync(join(salida, 'datos.json'), JSON.stringify(datos, null, 2) + '\n')

  const filas = [...INSTALADORES, 'SHA256SUMS.txt'].sort().map((nombre) => {
    const mb = (statSync(join(salida, nombre)).size / 1e6).toFixed(1)
    const hash = nombre === 'SHA256SUMS.txt' ? '—' : `\`${sha256(join(salida, nombre))}\``
    return `| ${nombre} | ${mb} | ${hash} |`
  })
  const resumen = [
    `## Publicación preparada: ${etiqueta}`,
    '',
    `Tipo: **${previa ? 'versión previa (pre-release)' : 'versión estable'}**. Etiqueta prevista: \`${etiqueta}\`.`,
    '',
    '| Recurso | MB | SHA-256 |',
    '|---|---:|---|',
    ...filas,
    '',
    hayNotas
      ? `Notas de la versión: \`${archivoNotas.slice(raiz.length).replaceAll('\\', '/').replace(/^\//, '')}\`.`
      : '**Aviso:** no hay notas escritas para esta versión; se usarán las generadas por GitHub.',
    '',
    '### notas.md',
    '',
    '````markdown',
    notas.trimEnd(),
    '````',
    '',
    ...(ensayo ? ['Ensayo: no se ha publicado nada.', ''] : [])
  ].join('\n')
  return { datos, resumen }
}

function valor(argv, nombre) {
  const i = argv.indexOf(nombre)
  if (i < 0 || !argv[i + 1]) throw new Error(`Falta ${nombre}`)
  return argv[i + 1]
}

function principal(argv) {
  const raiz = fileURLToPath(new URL('../../', import.meta.url))
  const previa = valor(argv, '--previa') === 'true'
  const { datos, resumen } = prepararPublicacion({
    entrada: valor(argv, '--entrada'),
    salida: valor(argv, '--salida'),
    raiz,
    version: valor(argv, '--version'),
    etiqueta: valor(argv, '--etiqueta'),
    previa,
    ensayo: argv.includes('--ensayo')
  })
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumen + '\n')
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
