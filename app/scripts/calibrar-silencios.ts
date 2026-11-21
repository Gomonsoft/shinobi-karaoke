/**
 * Calibración de «Ajustar los silencios» (tarea 0210, ADR 0018 §6.4). Herramienta de desarrollo:
 * NO se empaqueta y es de SOLO LECTURA (abre los archivos en modo lectura y no escribe nada).
 *
 * Uso: npm run calibrar:silencios -- <carpeta-de-biblioteca> [--ids a,b,c]
 *
 * Por cada canción (carpeta con `cancion.json` y `pistas/.picos-voz-v1-<hash>.bin` válido):
 *  - toma como verdad los fines fijados a mano (`fin_ms` numérico) de las líneas sin palabras;
 *  - los borra en una copia y ejecuta `proponerAjusteSilencios` con una rejilla de parámetros
 *    (umbral relativo −24…−40 dB, silencio mínimo 250…700 ms, margen 50…200 ms);
 *  - agrega por combinación: error medio y máximo (ms), líneas sin silencio detectado, cortes
 *    (propuesta más de 150 ms antes de la verdad) y huecos largos.
 *
 * «Sin silencio detectado» incluye las líneas donde el fin propuesto coincide con el fin automático
 * (el algoritmo no escribe nada); en ese caso el error se mide contra el fin automático.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { conPicos, leerVentana } from '../src/main/picos/formato'
import { ESPERA_LEGADA, esperaSchema, type Espera } from '../src/shared/espera'
import { finEfectivo, letraSchema, type Letra } from '../src/shared/letra'
import {
  PARAMETROS_SILENCIOS,
  detectarVoz,
  proponerAjusteSilencios,
  type ParametrosSilencios
} from '../src/shared/silencios'

const CACHE = /^\.picos-voz-v1-[a-f0-9]{64}\.bin$/
export const UMBRAL_CORTE_MS = 150

export const REJILLA = {
  umbralRelativoDb: [-24, -26, -28, -30, -32, -34, -36, -38, -40],
  silencioMinimoMs: [250, 400, 550, 700],
  margenColaMs: [50, 100, 150, 200]
} as const

export interface CancionCalibracion {
  id: string
  letra: Letra
  espera: Espera
  duracionMs: number
  picos: { pasoMs: number; pares: Int16Array }
}

export interface FilaCalibracion {
  umbralRelativoDb: number
  silencioMinimoMs: number
  margenColaMs: number
  porDefecto: boolean
  lineas: number
  errorMedioMs: number
  errorMaximoMs: number
  sinSilencio: number
  cortes: number
  huecosLargos: number
}

export interface ResultadoCalibracion {
  canciones: string[]
  avisos: string[]
  filas: FilaCalibracion[]
}

async function leerPicos(carpeta: string): Promise<CancionCalibracion['picos'] | null> {
  let nombres: string[]
  try {
    nombres = (await readdir(join(carpeta, 'pistas'))).filter((n) => CACHE.test(n))
  } catch {
    return null
  }
  for (const nombre of nombres) {
    const leido = await conPicos(join(carpeta, 'pistas', nombre), async (archivo, formato) => {
      const v = await leerVentana(archivo, formato, {
        cancionId: 'calibracion',
        inicioMs: 0,
        finMs: formato.duracionMs,
        presupuesto: Number.MAX_SAFE_INTEGER
      })
      return v && v.pasoMs === 10 ? v.bytes : null
    })
    if (leido) {
      const pares = new Int16Array(leido.buffer, leido.byteOffset, leido.byteLength >> 1)
      return { pasoMs: 10, pares }
    }
  }
  return null
}

async function leerCancion(
  raiz: string,
  id: string,
  avisos: string[]
): Promise<CancionCalibracion | null> {
  const carpeta = join(raiz, id)
  let json: { letra?: unknown; estilo?: { espera?: unknown }; metadatos?: { duracion_ms?: number } }
  try {
    json = JSON.parse(await readFile(join(carpeta, 'cancion.json'), 'utf8'))
  } catch {
    avisos.push(`${id}: no se pudo leer cancion.json; se omite`)
    return null
  }
  const letra = letraSchema.safeParse(json.letra)
  const duracionMs = json.metadatos?.duracion_ms
  if (!letra.success || !duracionMs) {
    avisos.push(`${id}: sin letra válida o sin duración; se omite`)
    return null
  }
  const picos = await leerPicos(carpeta)
  if (!picos) {
    avisos.push(`${id}: sin caché de picos válida (ábrela una vez en el editor); se omite`)
    return null
  }
  const espera = esperaSchema.safeParse(json.estilo?.espera)
  return {
    id,
    letra: letra.data,
    espera: espera.success ? espera.data : ESPERA_LEGADA,
    duracionMs,
    picos
  }
}

/** Líneas sin palabras con fin fijado: id → fin de la verdad. */
function verdades(letra: Letra): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of letra.lineas) {
    if (e.tipo === 'linea' && e.inicio_ms !== null && e.palabras === null && e.fin_ms !== null) {
      m.set(e.id, e.fin_ms)
    }
  }
  return m
}

export async function calibrar(
  raiz: string,
  { ids }: { ids?: string[] } = {}
): Promise<ResultadoCalibracion> {
  const avisos: string[] = []
  const candidatas =
    ids ??
    (await readdir(raiz, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  const canciones: CancionCalibracion[] = []
  for (const id of candidatas) {
    if (!(await stat(join(raiz, id, 'cancion.json')).catch(() => null))) {
      if (ids) avisos.push(`${id}: no existe; se omite`)
      continue
    }
    const c = await leerCancion(raiz, id, avisos)
    if (c) canciones.push(c)
  }

  const preparadas = canciones.map((c) => {
    const verdad = verdades(c.letra)
    const sinFines: Letra = {
      ...c.letra,
      lineas: c.letra.lineas.map((e) => (verdad.has(e.id) ? { ...e, fin_ms: null } : e))
    }
    return { c, verdad, sinFines }
  })

  const filas: FilaCalibracion[] = []
  for (const umbralRelativoDb of REJILLA.umbralRelativoDb) {
    const voces = preparadas.map(({ c }) =>
      detectarVoz(c.picos, { ...PARAMETROS_SILENCIOS, umbralRelativoDb })
    )
    for (const silencioMinimoMs of REJILLA.silencioMinimoMs) {
      for (const margenColaMs of REJILLA.margenColaMs) {
        const p: ParametrosSilencios = {
          ...PARAMETROS_SILENCIOS,
          umbralRelativoDb,
          silencioMinimoMs,
          margenColaMs
        }
        let lineas = 0
        let suma = 0
        let maximo = 0
        let sinSilencio = 0
        let cortes = 0
        let huecosLargos = 0
        preparadas.forEach(({ c, verdad, sinFines }, k) => {
          const r = proponerAjusteSilencios(sinFines, voces[k]!, {
            duracionMs: c.duracionMs,
            espera: c.espera,
            p
          })
          huecosLargos += r.huecosLargos
          for (const [id, real] of verdad) {
            const fin = r.letra.lineas.find((e) => e.id === id)!.fin_ms
            if (fin === null) sinSilencio++
            const propuesta = fin ?? finEfectivo(r.letra, id, c.duracionMs) ?? real
            const error = Math.abs(propuesta - real)
            lineas++
            suma += error
            maximo = Math.max(maximo, error)
            if (real - propuesta > UMBRAL_CORTE_MS) cortes++
          }
        })
        filas.push({
          umbralRelativoDb,
          silencioMinimoMs,
          margenColaMs,
          porDefecto:
            umbralRelativoDb === PARAMETROS_SILENCIOS.umbralRelativoDb &&
            silencioMinimoMs === PARAMETROS_SILENCIOS.silencioMinimoMs &&
            margenColaMs === PARAMETROS_SILENCIOS.margenColaMs,
          lineas,
          errorMedioMs: lineas ? Math.round(suma / lineas) : 0,
          errorMaximoMs: maximo,
          sinSilencio,
          cortes,
          huecosLargos
        })
      }
    }
  }
  filas.sort((a, b) => a.errorMedioMs - b.errorMedioMs || a.cortes - b.cortes)
  return { canciones: canciones.map((c) => c.id), avisos, filas }
}

export function formatearTabla({ canciones, avisos, filas }: ResultadoCalibracion): string {
  const col = (v: string | number, n: number): string => String(v).padStart(n)
  const salida = [
    ...avisos.map((a) => `AVISO ${a}`),
    `Canciones: ${canciones.length} (${canciones.join(', ') || 'ninguna'}). * = valores actuales`,
    ' umbral  silencio  margen  líneas  err.medio  err.máx  sin silencio  cortes  huecos largos'
  ]
  for (const f of filas) {
    salida.push(
      `${f.porDefecto ? '*' : ' '}${col(f.umbralRelativoDb, 5)}dB ${col(f.silencioMinimoMs, 7)}ms ` +
        `${col(f.margenColaMs, 5)}ms ${col(f.lineas, 7)} ${col(f.errorMedioMs, 8)}ms ` +
        `${col(f.errorMaximoMs, 6)}ms ${col(f.sinSilencio, 12)} ${col(f.cortes, 7)} ${col(f.huecosLargos, 13)}`
    )
  }
  return salida.join('\n')
}
