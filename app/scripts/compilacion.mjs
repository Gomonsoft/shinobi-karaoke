// Datos de compilación (ADR 0020, fase 10 §2): número N, commit y canal. Sin dependencias.
// Solo se leen al compilar (`electron.vite.config.ts`); la app recibe el resultado como constante.
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const CANALES_CI = ['publicada', 'desarrollo']
const COMMIT = /^[0-9a-f]{40}$/i

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

/** Cuenta los commits del historial y devuelve el commit actual. Falla en un clon superficial. */
export function contar({ cwd } = {}) {
  if (git(['rev-parse', '--is-shallow-repository'], cwd) === 'true') {
    throw new Error(
      'El clon es superficial: N saldría mal. Usa fetch-depth: 0 (git fetch --unshallow).'
    )
  }
  return {
    numero: Number(git(['rev-list', '--count', 'HEAD'], cwd)),
    commit: git(['rev-parse', 'HEAD'], cwd)
  }
}

/**
 * Valida y devuelve `{ canal, numero, commit }`. `git` (opcional) devuelve el commit actual o
 * lanza; solo se usa en el canal local.
 */
export function datosCompilacion({ env, git: commitGit } = {}) {
  const canal = env?.SHINOBI_COMPILACION_CANAL?.trim() || ''
  if (!canal) {
    let commit = null
    try {
      const c = commitGit ? commitGit() : git(['rev-parse', 'HEAD'])
      commit = COMMIT.test(c) ? c.toLowerCase() : null
    } catch {
      commit = null
    }
    return { canal: 'local', numero: null, commit }
  }
  if (!CANALES_CI.includes(canal)) {
    throw new Error(`SHINOBI_COMPILACION_CANAL no válido: «${canal}» (publicada o desarrollo).`)
  }
  const textoNumero = env.SHINOBI_COMPILACION_NUMERO?.trim() ?? ''
  if (!/^[1-9]\d*$/.test(textoNumero)) {
    throw new Error(
      `SHINOBI_COMPILACION_NUMERO debe ser un entero ≥ 1 (recibido «${textoNumero}»).`
    )
  }
  const commit = env.SHINOBI_COMPILACION_COMMIT?.trim() ?? ''
  if (!COMMIT.test(commit)) {
    throw new Error('SHINOBI_COMPILACION_COMMIT debe tener 40 caracteres hexadecimales.')
  }
  return { canal, numero: Number(textoNumero), commit: commit.toLowerCase() }
}

/**
 * Qué se hace con un commit (ADR 0020, fase 10, §1). `configurado` y `compilado` solo importan en
 * `schedule` y en `workflow_dispatch` contra `develop`; en lo demás se ignoran.
 */
export function decidir({ evento, ref, configurado = false, compilado = false, faltas = [], sha }) {
  if (evento === 'push' && ref.startsWith('refs/tags/v')) {
    return { desarrollo: 'omitir', construir: true, canal_app: 'publicada', motivo: '' }
  }
  const publicar = configurado && !compilado
  if (evento === 'schedule') {
    return {
      desarrollo: publicar ? 'publicar' : 'omitir',
      construir: publicar,
      canal_app: 'desarrollo',
      motivo: publicar ? '' : motivoSinCompilar({ configurado, faltas, sha })
    }
  }
  if (evento === 'workflow_dispatch') {
    const alPublicar = ref === 'refs/heads/develop' && publicar
    return {
      desarrollo: alPublicar ? 'publicar' : 'ensayo',
      construir: true,
      canal_app: 'desarrollo',
      motivo: ''
    }
  }
  throw new Error(`Evento sin decisión: ${evento} (${ref}).`)
}

function motivoSinCompilar({ configurado, faltas, sha }) {
  return configurado
    ? `Sin cambios: \`build-${sha}\` ya existe en el canal de desarrollo.`
    : `Canal de desarrollo sin configurar: falta ${faltas.join(', ') || 'la configuración'}.`
}

/**
 * Estado del canal. `gh(ruta)` devuelve el código HTTP de `gh api <ruta>` (200 si responde) o lanza
 * si no hay código. Configurado: repositorio no vacío, secreto presente y repositorio legible.
 */
export function consultarCanal({ repo, hayToken, sha, gh }) {
  const faltas = []
  if (!repo) faltas.push('la variable COMPILACIONES_REPO')
  else if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) faltas.push('un valor válido en COMPILACIONES_REPO')
  if (!hayToken) faltas.push('el secreto COMPILACIONES_TOKEN')
  if (!faltas.length) {
    let codigo
    try {
      codigo = gh(`repos/${repo}`)
    } catch (error) {
      codigo = error instanceof Error ? error.message : String(error)
    }
    if (codigo !== 200)
      faltas.push(`el repositorio ${repo} (responde ${codigo}; ¿existe y es público?)`)
  }
  if (faltas.length) return { configurado: false, compilado: false, faltas }
  const codigo = gh(`repos/${repo}/releases/tags/build-${sha}`)
  if (codigo !== 200 && codigo !== 404) {
    throw new Error(`No se pudo saber si build-${sha} existe: HTTP ${codigo}.`)
  }
  return { configurado: true, compilado: codigo === 200, faltas: [] }
}

/** Decisión completa a partir del entorno del workflow; consulta el canal solo si hace falta. */
export function resolverDecision({ evento, ref, sha, repo, hayToken, gh }) {
  const consulta =
    evento === 'schedule' || (evento === 'workflow_dispatch' && ref === 'refs/heads/develop')
  const canal = consulta
    ? consultarCanal({ repo, hayToken, sha, gh })
    : { configurado: false, compilado: false, faltas: [] }
  return { ...decidir({ evento, ref, sha, ...canal }), configurado: canal.configurado }
}

/** `gh api <ruta>`: 200 si responde, o el código que imprime gh en el error (`(HTTP 404)`). */
function ghApi(ruta) {
  const r = spawnSync('gh', ['api', ruta, '--silent'], { encoding: 'utf8' })
  if (r.error) throw r.error
  if (r.status === 0) return 200
  const m = /\(HTTP (\d{3})\)/.exec(r.stderr)
  if (!m) throw new Error(`gh api ${ruta}: ${r.stderr.trim() || `salió con ${r.status}`}`)
  return Number(m[1])
}

function salida(pares) {
  const archivo = process.env.GITHUB_OUTPUT
  if (!archivo) throw new Error('--salida-github necesita GITHUB_OUTPUT')
  appendFileSync(
    archivo,
    Object.entries(pares)
      .map(
        ([k, v]) => `${k}=${v}
`
      )
      .join('')
  )
}

function principal(argv) {
  const [orden, ...resto] = argv
  const github = resto.includes('--salida-github')
  if (orden === 'contar') {
    const { numero, commit } = contar({})
    if (github) salida({ numero, commit })
    console.log(`${numero} ${commit}`)
    return
  }
  if (orden === 'decidir') {
    const e = process.env
    const sha = e.SHA ?? ''
    if (!COMMIT.test(sha)) throw new Error('SHA debe tener 40 caracteres hexadecimales.')
    const { motivo, ...resultado } = resolverDecision({
      evento: e.GITHUB_EVENT_NAME ?? '',
      ref: e.GITHUB_REF ?? '',
      sha,
      repo: (e.REPO_COMPILACIONES ?? '').trim(),
      hayToken: e.HAY_TOKEN === 'true',
      gh: ghApi
    })
    if (github) salida(resultado)
    if (motivo && e.GITHUB_STEP_SUMMARY)
      appendFileSync(
        e.GITHUB_STEP_SUMMARY,
        `${motivo}
`
      )
    console.log(JSON.stringify({ ...resultado, motivo }))
    return
  }
  throw new Error('Uso: compilacion.mjs contar|decidir [--salida-github]')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    principal(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
