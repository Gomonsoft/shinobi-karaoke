import { createHash } from 'node:crypto'
import { createReadStream, promises as fsp } from 'node:fs'
import { join } from 'node:path'
import type { CodigoError, ModeloManifiesto } from '../../shared'
import { escribirJsonAtomico, leerJson } from '../persistencia'
import type { RegistroApp } from '../registro/registroApp'

/** Error de la descarga de modelos con código estable (catálogo de `shared/errores`). */
export class ErrorModelo extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
    readonly reintentable = false
  ) {
    super(mensaje)
    this.name = 'ErrorModelo'
  }
}

export interface ProgresoModelo {
  bytes: number
  total: number
}

export interface OpcionesDescarga {
  dirModelos: string
  señal?: AbortSignal
  alProgreso?: (p: ProgresoModelo) => void
  registro?: RegistroApp
  /** Solo pruebas: `fetch` alternativo. */
  fetch?: typeof fetch
  /** Solo pruebas: intervalo mínimo entre eventos de progreso (ms; por defecto 250). */
  intervaloProgresoMs?: number
}

interface ArchivoModelo {
  archivo: string
  urls: string[]
  bytes: number
  sha256: string
}

const SUFIJO_DESCARGA = '.descarga'
const ARCHIVO_VERIFICADOS = 'verificados.json'

const archivosDe = (m: ModeloManifiesto): ArchivoModelo[] => [
  { archivo: m.archivo, urls: m.urls, bytes: m.bytes, sha256: m.sha256 },
  ...m.extra.map((e) => ({ archivo: e.archivo, urls: e.urls, bytes: e.bytes, sha256: e.sha256 }))
]

const codigoDe = (e: unknown): string | undefined =>
  typeof e === 'object' && e !== null && 'code' in e
    ? String((e as { code: unknown }).code)
    : undefined

const CODIGOS_RED = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT'
])

/** Fallo de un intento con una URL. */
class FalloUrl extends Error {
  constructor(
    readonly tipo: 'red' | 'http',
    mensaje: string
  ) {
    super(mensaje)
  }
}

class VerificacionIncorrecta extends Error {}

const esAborto = (e: unknown): boolean => e instanceof Error && e.name === 'AbortError'

function clasificarRed(e: unknown): FalloUrl {
  // undici: TypeError('fetch failed') con `cause`; o un error de flujo cortado.
  const causa = (e as { cause?: unknown }).cause
  const cod = codigoDe(causa) ?? codigoDe(e)
  const msg = e instanceof Error ? e.message : String(e)
  if (cod && CODIGOS_RED.has(cod)) return new FalloUrl('red', `${cod}: ${msg}`)
  if (e instanceof TypeError) return new FalloUrl('red', msg)
  throw e
}

async function hashDeArchivo(ruta: string, señal?: AbortSignal): Promise<string> {
  const h = createHash('sha256')
  for await (const trozo of createReadStream(ruta)) {
    señal?.throwIfAborted()
    h.update(trozo as Buffer)
  }
  return h.digest('hex')
}

async function tamano(ruta: string): Promise<number | null> {
  try {
    return (await fsp.stat(ruta)).size
  } catch {
    return null
  }
}

/** Mide cuántos bytes cuenta el progreso: principal + extras. */
export const totalModelo = (m: ModeloManifiesto): number =>
  archivosDe(m).reduce((a, f) => a + f.bytes, 0)

interface RegistroVerificado {
  bytes: number
  sha256: string
  mtimeMs: number
}
type Verificados = Record<string, RegistroVerificado>

async function leerVerificados(dir: string): Promise<Verificados> {
  const r = await leerJson<Verificados>(join(dir, ARCHIVO_VERIFICADOS), (j) => {
    if (typeof j !== 'object' || j === null || Array.isArray(j)) throw new Error('no válido')
    return j as Verificados
  })
  return r.ok ? r.datos : {}
}

/** ¿Está `archivo` íntegro? Usa `verificados.json` salvo con `completo`. Actualiza el índice. */
async function verificarArchivo(
  f: ArchivoModelo,
  dir: string,
  verificados: Verificados,
  completo: boolean,
  señal?: AbortSignal
): Promise<{ ok: boolean; cambio: boolean }> {
  const ruta = join(dir, f.archivo)
  let st
  try {
    st = await fsp.stat(ruta)
  } catch {
    return {
      ok: false,
      cambio: verificados[f.archivo] !== undefined && delete verificados[f.archivo]
    }
  }
  if (st.size !== f.bytes) return { ok: false, cambio: false }
  const previo = verificados[f.archivo]
  if (
    !completo &&
    previo &&
    previo.bytes === st.size &&
    previo.sha256 === f.sha256 &&
    previo.mtimeMs === Math.trunc(st.mtimeMs)
  ) {
    return { ok: true, cambio: false }
  }
  if ((await hashDeArchivo(ruta, señal)) !== f.sha256) {
    return { ok: false, cambio: delete verificados[f.archivo] }
  }
  verificados[f.archivo] = { bytes: st.size, sha256: f.sha256, mtimeMs: Math.trunc(st.mtimeMs) }
  return { ok: true, cambio: true }
}

/**
 * ¿Están el modelo y sus extras completos y con el SHA-256 correcto? Con `verificados.json`
 * no recalcula si bytes y mtime no cambiaron; `completo: true` recalcula siempre.
 */
export async function verificarModelo(
  modelo: ModeloManifiesto,
  dirModelos: string,
  opciones: { completo?: boolean; señal?: AbortSignal } = {}
): Promise<boolean> {
  const verificados = await leerVerificados(dirModelos)
  let todos = true
  let cambio = false
  for (const f of archivosDe(modelo)) {
    const r = await verificarArchivo(
      f,
      dirModelos,
      verificados,
      opciones.completo === true,
      opciones.señal
    )
    cambio ||= r.cambio
    if (!r.ok) todos = false
  }
  if (cambio) {
    await escribirJsonAtomico(join(dirModelos, ARCHIVO_VERIFICADOS), verificados).catch(
      () => undefined
    )
  }
  return todos
}

/** Comprobación barata (sin SHA-256): ¿existen el modelo y sus extras con el tamaño esperado? */
export async function modeloPresente(
  modelo: ModeloManifiesto,
  dirModelos: string
): Promise<boolean> {
  for (const f of archivosDe(modelo)) {
    if ((await tamano(join(dirModelos, f.archivo))) !== f.bytes) return false
  }
  return true
}

/** Borra los `*.partial` de audio-separator. No toca los `*.descarga` (reanudables). */
export async function limpiarModelos(dirModelos: string): Promise<string[]> {
  let nombres: string[]
  try {
    nombres = await fsp.readdir(dirModelos)
  } catch {
    return []
  }
  const borrados: string[] = []
  for (const n of nombres.filter((x) => x.endsWith('.partial'))) {
    try {
      await fsp.rm(join(dirModelos, n), { force: true, recursive: true })
      borrados.push(n)
    } catch {
      /* se reintentará en el próximo arranque */
    }
  }
  return borrados
}

/**
 * Descarga un modelo del manifiesto (y sus `extra`) a `dirModelos`, con reanudación (`Range`),
 * SHA-256 en streaming y progreso en bytes. Cancelar deja el `.descarga` para reanudar.
 */
export async function descargarModelo(
  modelo: ModeloManifiesto,
  opciones: OpcionesDescarga
): Promise<void> {
  const { dirModelos, señal } = opciones
  const registro = opciones.registro
  await fsp.mkdir(dirModelos, { recursive: true })
  if (modelo.licencia === 'no declarada') {
    registro?.escribir(
      'aviso',
      'modelos',
      `Se descarga el modelo "${modelo.id}" (${modelo.archivo}) con licencia no declarada (provisional: ${modelo.provisional}).`
    )
  }
  const total = totalModelo(modelo)
  let acumulado = 0
  let ultimo = 0
  const intervalo = opciones.intervaloProgresoMs ?? 250
  const emitir = (bytes: number, forzar = false): void => {
    if (!opciones.alProgreso) return
    const t = Date.now()
    if (!forzar && t - ultimo < intervalo) return
    ultimo = t
    opciones.alProgreso({ bytes: Math.min(bytes, total), total })
  }

  const verificados = await leerVerificados(dirModelos)
  try {
    for (const f of archivosDe(modelo)) {
      señal?.throwIfAborted()
      const base = acumulado
      const v = await verificarArchivo(f, dirModelos, verificados, false, señal)
      if (!v.ok) {
        await descargarArchivo(f, dirModelos, opciones, (b) => emitir(base + b), registro)
        const st = await fsp.stat(join(dirModelos, f.archivo))
        verificados[f.archivo] = {
          bytes: f.bytes,
          sha256: f.sha256,
          mtimeMs: Math.trunc(st.mtimeMs)
        }
        await escribirJsonAtomico(join(dirModelos, ARCHIVO_VERIFICADOS), verificados)
      }
      acumulado += f.bytes
      emitir(acumulado, true)
    }
  } catch (e) {
    if (esAborto(e) || señal?.aborted) {
      await limpiarModelos(dirModelos)
      throw new ErrorModelo('CANCELADO', 'Descarga cancelada.')
    }
    throw e
  }
}

async function descargarArchivo(
  f: ArchivoModelo,
  dir: string,
  opciones: OpcionesDescarga,
  progreso: (bytes: number) => void,
  registro?: RegistroApp
): Promise<void> {
  const parcial = join(dir, f.archivo + SUFIJO_DESCARGA)
  for (let intento = 0; intento < 2; intento++) {
    try {
      await descargarConUrls(f, parcial, opciones, progreso, registro)
      await fsp.rename(parcial, join(dir, f.archivo))
      return
    } catch (e) {
      if (!(e instanceof VerificacionIncorrecta)) throw e
      await fsp.rm(parcial, { force: true })
      registro?.escribir(
        'aviso',
        'modelos',
        `Verificación fallida de ${f.archivo} (intento ${intento + 1}).`
      )
    }
  }
  throw new ErrorModelo(
    'VERIFICACION_FALLIDA',
    `El archivo ${f.archivo} no coincide con el SHA-256 esperado.`,
    true
  )
}

async function descargarConUrls(
  f: ArchivoModelo,
  parcial: string,
  opciones: OpcionesDescarga,
  progreso: (bytes: number) => void,
  registro?: RegistroApp
): Promise<void> {
  const fallos: FalloUrl[] = []
  for (const url of f.urls) {
    opciones.señal?.throwIfAborted()
    try {
      await descargarDeUrl(url, f, parcial, opciones, progreso)
      return
    } catch (e) {
      if (e instanceof VerificacionIncorrecta || e instanceof ErrorModelo) throw e
      if (esAborto(e) || opciones.señal?.aborted) throw e
      if (codigoDe(e) === 'ENOSPC') {
        throw new ErrorModelo('SIN_ESPACIO', 'No hay espacio suficiente en el disco.')
      }
      const fallo = e instanceof FalloUrl ? e : clasificarRed(e)
      registro?.escribir('aviso', 'modelos', `Falló ${url}: ${fallo.message}`)
      fallos.push(fallo)
    }
  }
  if (fallos.every((x) => x.tipo === 'red')) {
    throw new ErrorModelo('SIN_CONEXION', 'No hay conexión con el servidor de modelos.', true)
  }
  throw new ErrorModelo(
    'SERVICIO_NO_DISPONIBLE',
    'El servidor de modelos no está disponible.',
    true
  )
}

async function descargarDeUrl(
  url: string,
  f: ArchivoModelo,
  parcial: string,
  opciones: OpcionesDescarga,
  progreso: (bytes: number) => void
): Promise<void> {
  const hacerFetch = opciones.fetch ?? fetch
  let previo = (await tamano(parcial)) ?? 0
  if (previo > f.bytes) {
    await fsp.rm(parcial, { force: true })
    previo = 0
  }
  const hash = createHash('sha256')
  let recibidos = 0

  if (previo < f.bytes) {
    const cabeceras: Record<string, string> = { 'Accept-Encoding': 'identity' }
    if (previo > 0) cabeceras.Range = `bytes=${previo}-`
    const resp = await hacerFetch(url, {
      headers: cabeceras,
      signal: opciones.señal,
      redirect: 'follow'
    })
    if (resp.status === 416 && previo > 0) {
      await resp.body?.cancel().catch(() => undefined)
      await fsp.rm(parcial, { force: true })
      throw new FalloUrl('http', `HTTP 416 en ${url}`)
    }
    if (resp.status >= 400 || !resp.body) {
      await resp.body?.cancel().catch(() => undefined)
      throw new FalloUrl('http', `HTTP ${resp.status} en ${url}`)
    }
    let reanudar = previo > 0 && resp.status === 206
    if (!reanudar && previo > 0) previo = 0 // el servidor ignora Range: de cero
    if (reanudar) {
      // Debe empezar donde pedimos.
      const m = /^bytes (\d+)-/.exec(resp.headers.get('content-range') ?? '')
      if (m && Number(m[1]) !== previo) {
        await resp.body.cancel().catch(() => undefined)
        await fsp.rm(parcial, { force: true })
        throw new FalloUrl('http', 'Content-Range inesperado')
      }
    }
    if (reanudar) await actualizarHash(hash, parcial)
    reanudar = previo > 0
    const archivo = await fsp.open(parcial, reanudar ? 'a' : 'w')
    recibidos = previo
    try {
      progreso(recibidos)
      const lector = resp.body.getReader()
      for (;;) {
        const { done, value } = await lector.read()
        if (done) break
        recibidos += value.byteLength
        if (recibidos > f.bytes) {
          await lector.cancel().catch(() => undefined)
          throw new VerificacionIncorrecta('Más bytes de los esperados')
        }
        hash.update(value)
        await archivo.write(value)
        progreso(recibidos)
      }
    } finally {
      await archivo.close()
    }
  } else {
    await actualizarHash(hash, parcial)
    recibidos = previo
  }

  if (recibidos !== f.bytes || hash.digest('hex') !== f.sha256) {
    if (recibidos < f.bytes) throw new FalloUrl('red', 'Respuesta cortada antes de tiempo')
    throw new VerificacionIncorrecta('SHA-256 o tamaño incorrectos')
  }
}

async function actualizarHash(hash: ReturnType<typeof createHash>, ruta: string): Promise<void> {
  for await (const trozo of createReadStream(ruta)) hash.update(trozo as Buffer)
}
