import { z } from 'zod'
import type { CodigoError } from '../../shared/errores'
import { ENTORNO_LRCLIB_URL, URL_BASE_LRCLIB, urlBaseLrclib } from '../../shared/letrasBusqueda'
import type { RegistroApp } from '../registro'

/** Cliente HTTP de bajo nivel de LRCLIB (0081; ADR 0005 Decisión §1 y Revisión 2026-11-05). */

export const URL_PROYECTO = 'https://github.com/Gomonsoft/shinobi-karaoke'
export const SEPARACION_MIN_MS = 250
export const TIEMPO_PETICION_MS = 10_000
export const PRESUPUESTO_BUSQUEDA_MS = 10_000
export const MAX_BYTES_RESPUESTA = 2 * 1024 * 1024
export const MAX_RESULTADOS_BUSQUEDA = 20
/** Margen aleatorio máximo que se suma a `Retry-After`. */
export const MARGEN_RETRY_AFTER = 0.3
/** Espera por defecto si el 429 no trae `Retry-After` interpretable. */
const RETRY_AFTER_POR_DEFECTO_MS = 1000

/** Error del cliente con código estable. El detalle técnico va al registro, no al renderer. */
export class ErrorLrclib extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string
  ) {
    super(mensaje)
    this.name = 'ErrorLrclib'
  }
}

/** Campos de un registro de LRCLIB que usa la app; se toleran los demás. */
export const registroLrclibSchema = z.object({
  id: z.number().int(),
  trackName: z.string().nullish().default(null),
  artistName: z.string().nullish().default(null),
  albumName: z.string().nullish().default(null),
  duration: z.number().nullish().default(null),
  instrumental: z.boolean().nullish().default(false),
  hasWordSync: z.boolean().nullish().default(false),
  plainLyrics: z.string().nullish().default(null),
  syncedLyrics: z.string().nullish().default(null),
  lyricsfile: z.string().nullish().default(null)
})
export type RegistroLrclib = z.infer<typeof registroLrclibSchema>

export interface RespuestaMinima {
  status: number
  headers: { get(nombre: string): string | null }
  body: ReadableStream<Uint8Array> | null
  text(): Promise<string>
}
export interface InitMinimo {
  method: 'GET'
  headers: Record<string, string>
  credentials: 'omit'
  signal: AbortSignal
}
export type FetchLrclib = (url: string, init: InitMinimo) => Promise<RespuestaMinima>

export interface OpcionesCliente {
  fetch: FetchLrclib
  /** `app.getVersion()`. */
  version: string
  registro: RegistroApp
  /** `process.env` (solo se lee `SHINOBI_LRCLIB_URL`). */
  env?: Record<string, string | undefined>
  empaquetada: boolean
  /** `net.isOnline()`. */
  enLinea?: () => boolean
  ahora?: () => number
  /** Espera `ms` o termina antes si se aborta la señal (rechaza con la razón). */
  dormir?: (ms: number, señal: AbortSignal) => Promise<void>
  /** Devuelve un número en [0, 1). */
  aleatorio?: () => number
  separacionMs?: number
  tiempoPeticionMs?: number
}

/** Opciones de una operación. `vencimiento`: instante (`ahora()`) en que acaba el presupuesto de la búsqueda. */
export interface OpcionesOperacion {
  vencimiento?: number
}

export interface ClienteLrclib {
  readonly urlBase: string
  get(
    datos: { titulo: string; artista: string; album?: string | null; duracionS?: number | null },
    señal: AbortSignal,
    op?: OpcionesOperacion
  ): Promise<RegistroLrclib | null>
  buscar(
    consulta: { titulo: string; artista: string } | { q: string },
    señal: AbortSignal,
    op?: OpcionesOperacion
  ): Promise<RegistroLrclib[]>
  porId(id: number, señal: AbortSignal, op?: OpcionesOperacion): Promise<RegistroLrclib | null>
}

const dormirReal = (ms: number, señal: AbortSignal): Promise<void> =>
  new Promise((resolver, rechazar) => {
    if (señal.aborted) return rechazar(señal.reason)
    const t = setTimeout(() => {
      señal.removeEventListener('abort', alAbortar)
      resolver()
    }, ms)
    const alAbortar = (): void => {
      clearTimeout(t)
      rechazar(señal.reason)
    }
    señal.addEventListener('abort', alAbortar, { once: true })
  })

/** `Retry-After`: segundos o fecha HTTP → milisegundos (o `null`). */
export function leerRetryAfter(valor: string | null, ahoraMs: number): number | null {
  if (!valor) return null
  const v = valor.trim()
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(Number(v) * 1000)
  const f = Date.parse(v)
  if (Number.isNaN(f)) return null
  return Math.max(0, f - ahoraMs)
}

const CODIGOS_SIN_CONEXION = [
  'ERR_INTERNET_DISCONNECTED',
  'ERR_NAME_NOT_RESOLVED',
  'ERR_NETWORK_CHANGED',
  'ERR_ADDRESS_UNREACHABLE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH'
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

export function crearClienteLrclib(o: OpcionesCliente): ClienteLrclib {
  const ahora = o.ahora ?? Date.now
  const dormir = o.dormir ?? dormirReal
  const aleatorio = o.aleatorio ?? Math.random
  const separacion = o.separacionMs ?? SEPARACION_MIN_MS
  const tiempoPeticion = o.tiempoPeticionMs ?? TIEMPO_PETICION_MS
  const valorEntorno = o.env?.[ENTORNO_LRCLIB_URL]
  const urlBase = urlBaseLrclib(valorEntorno, o.empaquetada)
  if (valorEntorno && !o.empaquetada && urlBase === URL_BASE_LRCLIB) {
    o.registro.escribir('aviso', 'lrclib', `${ENTORNO_LRCLIB_URL} ignorada: valor no admitido`)
  }
  o.registro.escribir('info', 'lrclib', `URL base: ${urlBase}`)

  const cabeceras = {
    'User-Agent': `ShinobiKaraoke/${o.version} (${URL_PROYECTO})`,
    Accept: 'application/json'
  }
  let ultimaPeticion = -Infinity
  let noAntes = 0
  let cola: Promise<unknown> = Promise.resolve()

  const abortado = (señal: AbortSignal): boolean => señal.aborted
  const cancelado = (): ErrorLrclib => new ErrorLrclib('CANCELADO', 'Operación cancelada')

  /** Una petición con sus tiempos; devuelve estado, cabecera Retry-After y cuerpo. */
  async function una(
    ruta: string,
    params: URLSearchParams | null,
    señal: AbortSignal
  ): Promise<{ status: number; retryAfter: string | null; cuerpo: string }> {
    const qs = params ? `?${params.toString()}` : ''
    const ctl = new AbortController()
    let tiempoAgotado = false
    const alAbortar = (): void => ctl.abort()
    señal.addEventListener('abort', alAbortar, { once: true })
    const t = setTimeout(() => {
      tiempoAgotado = true
      ctl.abort()
    }, tiempoPeticion)
    try {
      const r = await o.fetch(`${urlBase}${ruta}${qs}`, {
        method: 'GET',
        headers: { ...cabeceras },
        credentials: 'omit',
        signal: ctl.signal
      })
      if (r.status === 429) {
        void r.body?.cancel().catch(() => undefined)
        return { status: 429, retryAfter: r.headers.get('retry-after'), cuerpo: '' }
      }
      if (r.status !== 200) {
        void r.body?.cancel().catch(() => undefined)
        return { status: r.status, retryAfter: null, cuerpo: '' }
      }
      const cuerpo = await leerCuerpo(r, MAX_BYTES_RESPUESTA)
      return { status: 200, retryAfter: null, cuerpo }
    } catch (e) {
      if (abortado(señal)) throw cancelado()
      if (tiempoAgotado) throw fallo('SERVICIO_NO_DISPONIBLE', 'tiempo agotado', ruta)
      if (e instanceof CuerpoDemasiadoGrande) {
        throw fallo('SERVICIO_NO_DISPONIBLE', 'cuerpo de más de 2 MB', ruta)
      }
      const texto = textoError(e)
      if (CODIGOS_SIN_CONEXION.some((c) => texto.includes(c))) {
        throw fallo('SIN_CONEXION', texto, ruta)
      }
      throw fallo('SERVICIO_NO_DISPONIBLE', texto, ruta)
    } finally {
      clearTimeout(t)
      señal.removeEventListener('abort', alAbortar)
    }
  }

  function fallo(codigo: CodigoError, detalle: string, ruta: string): ErrorLrclib {
    o.registro.escribir('aviso', 'lrclib', `${codigo} en ${ruta}: ${detalle}`)
    return new ErrorLrclib(codigo, detalle)
  }

  async function esperarTurno(señal: AbortSignal): Promise<void> {
    const falta = ultimaPeticion + separacion - ahora()
    if (falta > 0) {
      try {
        await dormir(falta, señal)
      } catch {
        throw cancelado()
      }
    }
    if (abortado(señal)) throw cancelado()
  }

  async function peticion(
    ruta: string,
    params: URLSearchParams | null,
    señal: AbortSignal,
    op: OpcionesOperacion | undefined
  ): Promise<{ status: number; cuerpo: string }> {
    const vencimiento = op?.vencimiento ?? ahora() + PRESUPUESTO_BUSQUEDA_MS
    for (let intento = 0; ; intento++) {
      if (abortado(señal)) throw cancelado()
      if (ahora() < noAntes) throw new ErrorLrclib('SERVICIO_NO_DISPONIBLE', 'en espera por 429')
      if (o.enLinea && !o.enLinea()) throw fallo('SIN_CONEXION', 'sin conexión', ruta)
      await esperarTurno(señal)
      let r
      try {
        r = await una(ruta, params, señal)
      } finally {
        ultimaPeticion = ahora()
      }
      if (r.status !== 429) return r
      const base = leerRetryAfter(r.retryAfter, ahora()) ?? RETRY_AFTER_POR_DEFECTO_MS
      const espera = Math.round(base * (1 + MARGEN_RETRY_AFTER * aleatorio()))
      if (intento === 0 && ahora() + espera <= vencimiento) {
        try {
          await dormir(espera, señal)
        } catch {
          throw cancelado()
        }
        continue
      }
      noAntes = ahora() + espera
      throw fallo('SERVICIO_NO_DISPONIBLE', `429, sin espera posible (${espera} ms)`, ruta)
    }
  }

  function encolar<T>(trabajo: () => Promise<T>): Promise<T> {
    const p = cola.then(trabajo, trabajo)
    cola = p.catch(() => undefined)
    return p
  }

  function parsear(cuerpo: string, ruta: string): unknown {
    try {
      return JSON.parse(cuerpo)
    } catch {
      throw fallo('SERVICIO_NO_DISPONIBLE', 'JSON no válido', ruta)
    }
  }

  function validar(valor: unknown): RegistroLrclib | null {
    const r = registroLrclibSchema.safeParse(valor)
    if (r.success) return r.data
    const id = (valor as { id?: unknown } | null)?.id
    o.registro.escribir(
      'aviso',
      'lrclib',
      `registro descartado (id ${typeof id === 'number' ? id : '?'}): no válido`
    )
    return null
  }

  async function uno(
    ruta: string,
    params: URLSearchParams | null,
    señal: AbortSignal,
    op?: OpcionesOperacion
  ): Promise<RegistroLrclib | null> {
    const r = await encolar(() => peticion(ruta, params, señal, op))
    if (r.status === 404) return null
    if (r.status !== 200) throw fallo('SERVICIO_NO_DISPONIBLE', `HTTP ${r.status}`, ruta)
    return validar(parsear(r.cuerpo, ruta))
  }

  return {
    urlBase,
    get(datos, señal, op) {
      const p = new URLSearchParams()
      p.set('track_name', datos.titulo)
      p.set('artist_name', datos.artista)
      if (datos.album) p.set('album_name', datos.album)
      const d = datos.duracionS
      if (typeof d === 'number' && Number.isFinite(d)) {
        const e = Math.round(d)
        if (e >= 1 && e <= 3600) p.set('duration', String(e))
      }
      return uno('/api/get', p, señal, op)
    },
    async buscar(consulta, señal, op) {
      const p = new URLSearchParams()
      if ('q' in consulta) p.set('q', consulta.q)
      else {
        p.set('track_name', consulta.titulo)
        p.set('artist_name', consulta.artista)
      }
      const ruta = '/api/search'
      const r = await encolar(() => peticion(ruta, p, señal, op))
      if (r.status !== 200) throw fallo('SERVICIO_NO_DISPONIBLE', `HTTP ${r.status}`, ruta)
      const json = parsear(r.cuerpo, ruta)
      if (!Array.isArray(json))
        throw fallo('SERVICIO_NO_DISPONIBLE', 'respuesta no es una lista', ruta)
      const salida: RegistroLrclib[] = []
      for (const item of json) {
        const v = validar(item)
        if (v) salida.push(v)
        if (salida.length >= MAX_RESULTADOS_BUSQUEDA) break
      }
      return salida
    },
    porId(id, señal, op) {
      if (!Number.isInteger(id)) {
        return Promise.reject(new ErrorLrclib('ARGUMENTOS_NO_VALIDOS', 'id no válido'))
      }
      return uno(`/api/get/${id}`, null, señal, op)
    }
  }
}
