import { z } from 'zod'
import type { CodigoError } from '../../shared/errores'
import { analizarEtiqueta, compararVersiones, esPrevia } from '../../shared/version'

/** Consulta a la API de Releases de GitHub y selección de la versión nueva (ADR 0023 §1, §2, §5). */

export const REPOSITORIO = 'Gomonsoft/shinobi-karaoke'
export const URL_GITHUB_API = 'https://api.github.com'
export const URL_PROYECTO = `https://github.com/${REPOSITORIO}`
export const ENTORNO_GITHUB_URL = 'SHINOBI_GITHUB_URL'
export const TIEMPO_PETICION_MS = 10_000
export const MAX_BYTES_RESPUESTA = 1024 * 1024

/** Un error con código estable de la IPC. El detalle técnico va al registro. */
export class ErrorConsulta extends Error {
  constructor(
    readonly codigo: Extract<CodigoError, 'SIN_CONEXION' | 'SERVICIO_NO_DISPONIBLE'>,
    mensaje: string
  ) {
    super(mensaje)
    this.name = 'ErrorConsulta'
  }
}

export interface RespuestaMinima {
  status: number
  headers: { get(nombre: string): string | null }
  body: ReadableStream<Uint8Array> | null
  text(): Promise<string>
}
export interface InitConsulta {
  method: 'GET'
  headers: Record<string, string>
  credentials: 'omit'
  cache: 'no-store'
  redirect: 'error'
  signal: AbortSignal
}
export type FetchConsulta = (url: string, init: InitConsulta) => Promise<RespuestaMinima>

/**
 * URL base de la API. Empaquetada se ignora la variable; sin empaquetar solo se admite
 * `http://127.0.0.1:<puerto>` y `http://github.invalid` (para probar `SIN_CONEXION`).
 */
export function urlBaseGithub(valor: string | undefined, empaquetada: boolean): string {
  if (empaquetada || !valor) return URL_GITHUB_API
  const t = valor.trim().replace(/\/+$/, '')
  if (/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(t) || t === 'http://github.invalid') return t
  return URL_GITHUB_API
}

const entradaSchema = z.object({
  tag_name: z.string(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  published_at: z.iso.datetime(),
  assets: z.array(z.object({ name: z.string().max(200) })).catch([])
})

export interface Release {
  version: string
  previa: boolean
  publicada: string
  recursos: string[]
}

/** Entradas válidas de la lista; una que no valida se descarta sola, no toda la respuesta. */
export function leerReleases(cuerpo: unknown): Release[] {
  if (!Array.isArray(cuerpo)) throw new ErrorConsulta('SERVICIO_NO_DISPONIBLE', 'no es una lista')
  const salida: Release[] = []
  for (const bruta of cuerpo) {
    const e = entradaSchema.safeParse(bruta)
    if (!e.success || e.data.draft) continue
    const etiqueta = analizarEtiqueta(e.data.tag_name)
    if (!etiqueta) continue
    salida.push({
      version: etiqueta.version,
      previa: etiqueta.previa || e.data.prerelease,
      publicada: e.data.published_at,
      recursos: e.data.assets.map((a) => a.name)
    })
  }
  return salida
}

/**
 * La mayor versión estrictamente superior a la instalada, o `null`. Una instalada estable solo ve
 * estables; una preliminar ve preliminares y estables.
 */
export function elegirNueva(releases: readonly Release[], instalada: string): Release | null {
  const cuentan = esPrevia(instalada) ? releases : releases.filter((r) => !r.previa)
  let mejor: Release | null = null
  for (const r of cuentan) {
    if (compararVersiones(r.version, instalada) <= 0) continue
    if (!mejor || compararVersiones(r.version, mejor.version) > 0) mejor = r
  }
  return mejor
}

export interface Enlaces {
  novedades: string
  descargar: string
  /** `descargar` es el instalador de este sistema; `false` si es la página de la versión. */
  directa: boolean
}

/** Nombre del instalador de este sistema (`app/electron-builder.yml`). */
export function archivoDeSistema(plataforma: string, appimage: boolean): string | null {
  if (plataforma === 'win32') return 'Shinobi-Karaoke-Windows-x64.exe'
  if (plataforma === 'darwin') return 'Shinobi-Karaoke-Mac-chip-Apple.dmg'
  if (plataforma === 'linux') {
    return appimage ? 'Shinobi-Karaoke-Linux-x64.AppImage' : 'shinobi-karaoke-linux-x64.deb'
  }
  return null
}

/** Los enlaces los construye la app; nunca se abre una dirección que venga en la respuesta. */
export function construirEnlaces(
  version: string,
  recursos: readonly string[],
  plataforma: string,
  appimage: boolean
): Enlaces {
  const novedades = `${URL_PROYECTO}/releases/tag/v${version}`
  const archivo = archivoDeSistema(plataforma, appimage)
  if (archivo && recursos.includes(archivo)) {
    return {
      novedades,
      descargar: `${URL_PROYECTO}/releases/download/v${version}/${archivo}`,
      directa: true
    }
  }
  return { novedades, descargar: novedades, directa: false }
}

const CODIGOS_SIN_CONEXION = [
  'ERR_INTERNET_DISCONNECTED',
  'ERR_NAME_NOT_RESOLVED',
  'ERR_NETWORK_CHANGED',
  'ERR_ADDRESS_UNREACHABLE',
  'ERR_CONNECTION_REFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ECONNREFUSED'
]

function textoError(e: unknown): string {
  const partes: string[] = []
  let actual: unknown = e
  for (let i = 0; i < 3 && actual; i++) {
    if (actual instanceof Error) {
      partes.push(actual.message)
      const code = (actual as { code?: unknown }).code
      if (typeof code === 'string') partes.push(code)
      actual = (actual as { cause?: unknown }).cause
    } else {
      partes.push(String(actual))
      break
    }
  }
  return partes.join(' | ')
}

class CuerpoDemasiadoGrande extends Error {}

async function leerCuerpo(r: RespuestaMinima, max: number): Promise<string> {
  if (!r.body) {
    const t = await r.text()
    if (Buffer.byteLength(t) > max) throw new CuerpoDemasiadoGrande()
    return t
  }
  const lector = r.body.getReader()
  const trozos: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await lector.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      void lector.cancel().catch(() => undefined)
      throw new CuerpoDemasiadoGrande()
    }
    trozos.push(value)
  }
  return Buffer.concat(trozos).toString('utf8')
}

export interface OpcionesConsulta {
  fetch: FetchConsulta
  urlBase: string
  /** `app.getVersion()` (para el `User-Agent`). */
  versionApp: string
  tiempoMs?: number
}

/** Cabeceras exactas de la petición (ADR 0023 §1). */
export const cabecerasConsulta = (versionApp: string): Record<string, string> => ({
  'User-Agent': `ShinobiKaraoke/${versionApp} (${URL_PROYECTO})`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
})

/** `GET /repos/…/releases?per_page=30`; lanza `ErrorConsulta` ante cualquier fallo. */
export async function consultarReleases(o: OpcionesConsulta): Promise<Release[]> {
  const ctl = new AbortController()
  let tiempoAgotado = false
  const t = setTimeout(() => {
    tiempoAgotado = true
    ctl.abort()
  }, o.tiempoMs ?? TIEMPO_PETICION_MS)
  try {
    const r = await o.fetch(`${o.urlBase}/repos/${REPOSITORIO}/releases?per_page=30`, {
      method: 'GET',
      headers: cabecerasConsulta(o.versionApp),
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: ctl.signal
    })
    if (r.status !== 200) {
      void r.body?.cancel().catch(() => undefined)
      throw new ErrorConsulta('SERVICIO_NO_DISPONIBLE', `HTTP ${r.status}`)
    }
    const texto = await leerCuerpo(r, MAX_BYTES_RESPUESTA)
    let json: unknown
    try {
      json = JSON.parse(texto)
    } catch {
      throw new ErrorConsulta('SERVICIO_NO_DISPONIBLE', 'cuerpo no es JSON')
    }
    return leerReleases(json)
  } catch (e) {
    if (e instanceof ErrorConsulta) throw e
    if (tiempoAgotado) throw new ErrorConsulta('SERVICIO_NO_DISPONIBLE', 'tiempo agotado')
    if (e instanceof CuerpoDemasiadoGrande) {
      throw new ErrorConsulta('SERVICIO_NO_DISPONIBLE', 'cuerpo de más de 1 MB')
    }
    const texto = textoError(e)
    throw new ErrorConsulta(
      CODIGOS_SIN_CONEXION.some((c) => texto.includes(c))
        ? 'SIN_CONEXION'
        : 'SERVICIO_NO_DISPONIBLE',
      texto
    )
  } finally {
    clearTimeout(t)
  }
}
