import { promises as fsp } from 'node:fs'
import { dirname } from 'node:path'

/** Operaciones de disco usadas por el módulo; inyectables para simular fallos en tests. */
export interface SistemaArchivos {
  escribirYSincronizar(ruta: string, contenido: string): Promise<void>
  copiar(origen: string, destino: string): Promise<void>
  renombrar(origen: string, destino: string): Promise<void>
  sincronizarDirectorio(ruta: string): Promise<void>
  leer(ruta: string): Promise<string>
  existe(ruta: string): Promise<boolean>
  borrar(ruta: string): Promise<void>
}

export const sistemaReal: SistemaArchivos = {
  async escribirYSincronizar(ruta, contenido) {
    const f = await fsp.open(ruta, 'w')
    try {
      await f.writeFile(contenido, 'utf8')
      await f.sync()
    } finally {
      await f.close()
    }
  },
  copiar: (origen, destino) => fsp.copyFile(origen, destino),
  renombrar: (origen, destino) => fsp.rename(origen, destino),
  async sincronizarDirectorio(ruta) {
    // Windows no permite abrir directorios: el fallo se ignora (best effort).
    let f
    try {
      f = await fsp.open(ruta, 'r')
      await f.sync()
    } catch {
      /* no soportado */
    } finally {
      await f?.close().catch(() => undefined)
    }
  },
  leer: (ruta) => fsp.readFile(ruta, 'utf8'),
  async existe(ruta) {
    try {
      await fsp.access(ruta)
      return true
    } catch {
      return false
    }
  },
  borrar: (ruta) => fsp.rm(ruta, { force: true })
}

export interface OpcionesEscritura {
  /** Espera (ms) para agrupar escrituras seguidas; 0/ausente = escribir ya. ADR 0006: ~1000 para el editor. */
  debounceMs?: number
  /** Solo pruebas. */
  sistema?: SistemaArchivos
  /** Solo pruebas. Por defecto `process.platform`. */
  plataforma?: NodeJS.Platform
  /** Solo pruebas: espera entre reintentos de renombrado (ms, por defecto 50 × intento). */
  esperaReintentoMs?: number
}

export interface OpcionesLectura {
  sistema?: SistemaArchivos
}

export type ResultadoLectura<T> =
  { ok: true; datos: T; recuperadoDeBak: boolean } | { ok: false; motivo: string }

/** Función que valida (y migra) el JSON ya parseado; lanza si no es válido (p. ej. `migrarCancion`). */
export type Validador<T> = (json: unknown) => T

const REINTENTOS_RENOMBRADO = 5

const esperar = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function codigoDe(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null ? (e as { code?: string }).code : undefined
}

async function renombrarConReintentos(
  sis: SistemaArchivos,
  origen: string,
  destino: string,
  plataforma: NodeJS.Platform,
  esperaMs: number | undefined
): Promise<void> {
  const reintenta = plataforma === 'win32'
  for (let intento = 1; ; intento++) {
    try {
      await sis.renombrar(origen, destino)
      return
    } catch (e) {
      const c = codigoDe(e)
      if (!reintenta || (c !== 'EPERM' && c !== 'EBUSY') || intento >= REINTENTOS_RENOMBRADO) {
        throw e
      }
      await esperar(esperaMs ?? 50 * intento)
    }
  }
}

async function escribirAhora(
  ruta: string,
  datos: unknown,
  opciones: OpcionesEscritura
): Promise<void> {
  const sis = opciones.sistema ?? sistemaReal
  const tmp = `${ruta}.tmp`
  const bak = `${ruta}.bak`
  const contenido = `${JSON.stringify(datos, null, 2)}\n`
  try {
    await sis.escribirYSincronizar(tmp, contenido)
    if (await sis.existe(ruta)) await sis.copiar(ruta, bak)
    await renombrarConReintentos(
      sis,
      tmp,
      ruta,
      opciones.plataforma ?? process.platform,
      opciones.esperaReintentoMs
    )
  } catch (e) {
    await sis.borrar(tmp).catch(() => undefined)
    throw e
  }
  await sis.sincronizarDirectorio(dirname(ruta))
}

interface Pendiente {
  datos: unknown
  opciones: OpcionesEscritura
  esperas: { ok: () => void; error: (e: unknown) => void }[]
  temporizador: NodeJS.Timeout | null
}

interface Cola {
  /** Cadena de escrituras en curso; siempre se resuelve (los errores se reportan a cada llamante). */
  cadena: Promise<void>
  ocupada: number
  pendiente: Pendiente | null
}

const colas = new Map<string, Cola>()

function colaDe(ruta: string): Cola {
  let c = colas.get(ruta)
  if (!c) {
    c = { cadena: Promise.resolve(), ocupada: 0, pendiente: null }
    colas.set(ruta, c)
  }
  return c
}

function encolar(ruta: string, cola: Cola, p: Pendiente): void {
  cola.ocupada++
  cola.cadena = cola.cadena.then(async () => {
    try {
      await escribirAhora(ruta, p.datos, p.opciones)
      p.esperas.forEach((e) => e.ok())
    } catch (e) {
      p.esperas.forEach((w) => w.error(e))
    } finally {
      cola.ocupada--
      if (cola.ocupada === 0 && !cola.pendiente) colas.delete(ruta)
    }
  })
}

function lanzarPendiente(ruta: string, cola: Cola): void {
  const p = cola.pendiente
  if (!p) return
  cola.pendiente = null
  if (p.temporizador) clearTimeout(p.temporizador)
  encolar(ruta, cola, p)
}

/**
 * Escribe `datos` como JSON de forma atómica: tmp → fsync → copia a .bak →
 * renombrado → fsync del directorio. Las escrituras al mismo archivo se
 * serializan; con `debounceMs` las seguidas se agrupan y solo se escribe el
 * último valor (todas las promesas se resuelven cuando termina esa escritura).
 */
export function escribirJsonAtomico(
  ruta: string,
  datos: unknown,
  opciones: OpcionesEscritura = {}
): Promise<void> {
  const cola = colaDe(ruta)
  return new Promise<void>((ok, error) => {
    const espera = { ok, error }
    const debounce = opciones.debounceMs ?? 0
    if (debounce <= 0) {
      // Una escritura inmediata absorbe la pendiente (el valor más reciente gana).
      const previa = cola.pendiente
      if (previa?.temporizador) clearTimeout(previa.temporizador)
      cola.pendiente = null
      encolar(ruta, cola, {
        datos,
        opciones,
        esperas: [...(previa?.esperas ?? []), espera],
        temporizador: null
      })
      return
    }
    const p: Pendiente = cola.pendiente ?? { datos, opciones, esperas: [], temporizador: null }
    p.datos = datos
    p.opciones = opciones
    p.esperas.push(espera)
    if (p.temporizador) clearTimeout(p.temporizador)
    p.temporizador = setTimeout(() => lanzarPendiente(ruta, cola), debounce)
    cola.pendiente = p
  })
}

/**
 * Fuerza la escritura de lo pendiente (de `ruta` o de todos los archivos) y
 * espera a que terminen las escrituras en curso. Llamar al cerrar la app.
 */
export async function flush(ruta?: string): Promise<void> {
  const objetivos = ruta === undefined ? [...colas.keys()] : colas.has(ruta) ? [ruta] : []
  for (const r of objetivos) {
    const cola = colas.get(r)
    if (cola) lanzarPendiente(r, cola)
  }
  await Promise.all(objetivos.map((r) => colas.get(r)?.cadena))
}

async function intentarLeer<T>(
  sis: SistemaArchivos,
  ruta: string,
  validar: Validador<T>
): Promise<{ ok: true; datos: T } | { ok: false; motivo: string }> {
  let texto: string
  try {
    texto = await sis.leer(ruta)
  } catch (e) {
    return {
      ok: false,
      motivo: codigoDe(e) === 'ENOENT' ? 'No existe' : `No se pudo leer: ${String(e)}`
    }
  }
  try {
    return { ok: true, datos: validar(JSON.parse(texto)) }
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Lee y valida un JSON. Si el principal no se puede leer o no es válido,
 * prueba `.bak`; si recupera de ahí, reescribe el principal. Elimina `.tmp`
 * huérfanos (salvo que haya una escritura en curso sobre ese archivo).
 */
export async function leerJson<T>(
  ruta: string,
  validar: Validador<T>,
  opciones: OpcionesLectura = {}
): Promise<ResultadoLectura<T>> {
  const sis = opciones.sistema ?? sistemaReal
  // Esperar a que lo ya encolado termine para no leer a mitad de escritura.
  await colas.get(ruta)?.cadena
  if (!colas.has(ruta)) await sis.borrar(`${ruta}.tmp`).catch(() => undefined)

  const principal = await intentarLeer(sis, ruta, validar)
  if (principal.ok) return { ok: true, datos: principal.datos, recuperadoDeBak: false }

  const respaldo = await intentarLeer(sis, `${ruta}.bak`, validar)
  if (!respaldo.ok) {
    return {
      ok: false,
      motivo: `Principal: ${principal.motivo}. Copia de seguridad: ${respaldo.motivo}`
    }
  }
  try {
    await escribirJsonAtomico(ruta, respaldo.datos, { sistema: opciones.sistema })
  } catch {
    // Los datos están recuperados aunque no se pudiera reescribir ahora.
  }
  return { ok: true, datos: respaldo.datos, recuperadoDeBak: true }
}
