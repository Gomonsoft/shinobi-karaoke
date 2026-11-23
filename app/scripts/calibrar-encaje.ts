/**
 * Calibración del encaje de la letra con la voz (tarea 0368, ADR 0024 §1). Herramienta de desarrollo:
 * NO se empaqueta y es de SOLO LECTURA (abre los archivos en modo lectura y no escribe nada, ni cachés
 * ni temporales). Solo imprime ids, títulos y cifras; nunca texto de letra.
 *
 * Uso: npm run calibrar:encaje -- <carpeta-de-biblioteca> [--ids a,b,c] [--json] [--variantes]
 *
 * --variantes (tarea 0371, pregunta 0222): repite todo en tres casos: la letra tal cual, sin fines (como un LRC
 * de LRCLIB) y sin fines + fines prudentes (los de «Ajustar los silencios» con soloFinesAutomaticos, en memoria),
 * e imprime si se cumple el criterio de adopción. Para la guía 0312: `npm run calibrar:encaje -- <biblioteca> --variantes`
 * y leer la línea «Criterio de adopción» (SÍ/NO) y las tres filas de propias/ajenas aceptadas.
 *
 * Por cada canción con `cancion.json`, letra con tiempos y picos ya generados (`pistas/.picos-voz-v1-<hash>.bin`;
 * el script no los genera):
 *  - propias: la letra contra su voz (con `offset_ms: 0`, los tiempos tal como están en el archivo);
 *  - ajenas: cada letra contra la voz de cada otra canción (N × (N − 1) pares);
 *  - desplazadas: cada letra propia movida ±0,4, ±0,8, ±1,5 y ±3 s (con `offset_ms`).
 * «Aceptada» = `coincide` (propias) o `coincide`/`desfasada` (ajenas: la preparación las daría por buenas).
 * Un desplazamiento ≥ 0,5 s está «recuperado» si sale `desfasada` y d* = −desplazamiento (± 50 ms).
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { evaluarEncajeConPicos, type ResultadoEncaje } from '../src/shared/encaje'
import { leerNivelBase, type NivelBase } from '../src/main/picos/formato'
import { letraSchema, type Letra } from '../src/shared/letra'
import { detectarVoz, proponerAjusteSilencios } from '../src/shared/silencios'
import { ESPERA_LEGADA } from '../src/shared/espera'

const CACHE = /^\.picos-voz-v1-[a-f0-9]{64}\.bin$/
export const DESPLAZAMIENTOS_MS = [-3000, -1500, -800, -400, 400, 800, 1500, 3000] as const
export const TOLERANCIA_RECUPERADO_MS = 50
export const DESFASE_MINIMO_MS = 500

export interface FilaPropia {
  id: string
  titulo: string
  lineas: number
  veredicto: string
  f0: number
  i0: number
  desfaseMs: number
  fDesfase: number
  ganancia: number
  desfaseVariable: boolean
}
export interface FilaDesplazada {
  id: string
  desplazamientoMs: number
  veredicto: string
  desfaseMs: number
  /** |d* + desplazamiento|: lo lejos que queda la corrección de la que hace falta. */
  errorMs: number
  recuperado: boolean
}
export interface FilaAjena {
  letra: string
  voz: string
  veredicto: string
  aceptada: boolean
}
export interface ResultadoEncajeCalibracion {
  canciones: string[]
  avisos: string[]
  propias: FilaPropia[]
  desplazadas: FilaDesplazada[]
  ajenas: FilaAjena[]
  resumen: ResumenVariante
  /** Solo con `--variantes`. */
  variantes?: ResultadoVariantes
}
export interface ResumenVariante {
  propiasAceptadas: number
  propias: number
  ajenasAceptadas: number
  pares: number
  recuperadas: number
  desplazadas: number
}
export const VARIANTES = ['talCual', 'sinFines', 'sinFinesPrudentes'] as const
export type NombreVariante = (typeof VARIANTES)[number]
export interface ResultadoVariantes {
  resumen: Record<NombreVariante, ResumenVariante>
  criterio: {
    /** Con «sin fines», las propias aceptadas son < 90 %. */
    sinFinesBajan: boolean
    /** Con «sin fines + prudentes», ≥ 90 %. */
    prudentesRecuperan: boolean
    /** Ajenas aceptadas = 0 en las tres variantes. */
    ajenasEnCero: boolean
    cumple: boolean
  }
}

interface Cancion {
  id: string
  titulo: string
  letra: Letra
  nivel: NivelBase
}

const redondear = (n: number): number => Math.round(n * 1000) / 1000
const lineasConInicio = (l: Letra): number =>
  l.lineas.filter((e) => e.tipo === 'linea' && e.inicio_ms !== null).length

export async function leerNivel(carpeta: string): Promise<NivelBase | null> {
  let nombres: string[]
  try {
    nombres = (await readdir(join(carpeta, 'pistas'))).filter((n) => CACHE.test(n)).sort()
  } catch {
    return null
  }
  for (const nombre of nombres) {
    const nivel = await leerNivelBase(join(carpeta, 'pistas', nombre))
    if (nivel) return nivel
  }
  return null
}

async function leerCancion(raiz: string, id: string, avisos: string[]): Promise<Cancion | null> {
  const carpeta = join(raiz, id)
  let json: { letra?: unknown; metadatos?: { titulo?: unknown } }
  try {
    json = JSON.parse(await readFile(join(carpeta, 'cancion.json'), 'utf8'))
  } catch {
    avisos.push(`${id}: no se pudo leer cancion.json; se omite`)
    return null
  }
  const letra = letraSchema.safeParse(json.letra)
  if (!letra.success || lineasConInicio(letra.data) === 0) {
    avisos.push(`${id}: sin letra con tiempos; se omite`)
    return null
  }
  const nivel = await leerNivel(carpeta)
  if (!nivel) {
    avisos.push(`${id}: sin caché de picos válida (ábrela una vez en el editor); se omite`)
    return null
  }
  const titulo = typeof json.metadatos?.titulo === 'string' ? json.metadatos.titulo : id
  // Los tiempos tal como están en el archivo, sin ninguna corrección previa.
  return { id, titulo, letra: { ...letra.data, offset_ms: 0 }, nivel }
}

const evaluar = (letra: Letra, nivel: NivelBase): ResultadoEncaje =>
  evaluarEncajeConPicos(
    letra,
    { pasoMs: nivel.pasoMs, pares: nivel.pares },
    {
      duracionMs: nivel.duracionMs
    }
  )

const sinFines = (l: Letra): Letra => ({
  ...l,
  lineas: l.lineas.map((e) => (e.tipo === 'linea' ? { ...e, fin_ms: null } : e))
})

/** La letra tal como se evaluaría en cada variante (todo en memoria; el `offset_ms` de entrada se conserva). */
function variante(nombre: NombreVariante, letra: Letra, nivel: NivelBase): Letra {
  if (nombre === 'talCual') return letra
  const base = sinFines(letra)
  if (nombre === 'sinFines') return base
  return proponerAjusteSilencios(base, detectarVoz({ pasoMs: nivel.pasoMs, pares: nivel.pares }), {
    duracionMs: nivel.duracionMs,
    espera: ESPERA_LEGADA,
    soloFinesAutomaticos: true,
    activarComodin: false
  }).letra
}

function resumirVariantes(canciones: Cancion[]): ResultadoVariantes {
  const resumen = {} as Record<NombreVariante, ResumenVariante>
  for (const nombre of VARIANTES) {
    const r: ResumenVariante = {
      propiasAceptadas: 0,
      propias: 0,
      ajenasAceptadas: 0,
      pares: 0,
      recuperadas: 0,
      desplazadas: 0
    }
    for (const c of canciones) {
      r.propias++
      if (evaluar(variante(nombre, c.letra, c.nivel), c.nivel).veredicto === 'coincide') {
        r.propiasAceptadas++
      }
      for (const desplazamientoMs of DESPLAZAMIENTOS_MS) {
        if (Math.abs(desplazamientoMs) < DESFASE_MINIMO_MS) continue
        r.desplazadas++
        const movida = { ...c.letra, offset_ms: desplazamientoMs }
        const d = evaluar(variante(nombre, movida, c.nivel), c.nivel)
        if (
          d.veredicto === 'desfasada' &&
          Math.abs(d.desfaseMs + desplazamientoMs) <= TOLERANCIA_RECUPERADO_MS
        ) {
          r.recuperadas++
        }
      }
      for (const otra of canciones) {
        if (otra.id === c.id) continue
        r.pares++
        const a = evaluar(variante(nombre, c.letra, otra.nivel), otra.nivel).veredicto
        if (a === 'coincide' || a === 'desfasada') r.ajenasAceptadas++
      }
    }
    resumen[nombre] = r
  }
  const prop = (n: NombreVariante): number =>
    resumen[n].propias === 0 ? 0 : resumen[n].propiasAceptadas / resumen[n].propias
  const sinFinesBajan = prop('sinFines') < 0.9
  const prudentesRecuperan = canciones.length > 0 && prop('sinFinesPrudentes') >= 0.9
  const ajenasEnCero = VARIANTES.every((n) => resumen[n].ajenasAceptadas === 0)
  return {
    resumen,
    criterio: {
      sinFinesBajan,
      prudentesRecuperan,
      ajenasEnCero,
      cumple: sinFinesBajan && prudentesRecuperan && ajenasEnCero
    }
  }
}

export async function calibrarEncaje(
  raiz: string,
  { ids, variantes = false }: { ids?: string[]; variantes?: boolean } = {}
): Promise<ResultadoEncajeCalibracion> {
  const avisos: string[] = []
  const candidatas =
    ids ??
    (await readdir(raiz, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  const canciones: Cancion[] = []
  for (const id of candidatas) {
    if (!(await stat(join(raiz, id, 'cancion.json')).catch(() => null))) {
      if (ids) avisos.push(`${id}: no existe; se omite`)
      continue
    }
    const c = await leerCancion(raiz, id, avisos)
    if (c) canciones.push(c)
  }

  const propias: FilaPropia[] = []
  const desplazadas: FilaDesplazada[] = []
  const ajenas: FilaAjena[] = []
  for (const c of canciones) {
    const r = evaluar(c.letra, c.nivel)
    propias.push({
      id: c.id,
      titulo: c.titulo,
      lineas: lineasConInicio(c.letra),
      veredicto: r.veredicto,
      f0: redondear(r.f0),
      i0: redondear(r.i0),
      desfaseMs: r.desfaseMs,
      fDesfase: redondear(r.fDesfase),
      ganancia: redondear(r.fDesfase - r.f0),
      desfaseVariable: r.desfaseVariable
    })
    for (const desplazamientoMs of DESPLAZAMIENTOS_MS) {
      const d = evaluar({ ...c.letra, offset_ms: desplazamientoMs }, c.nivel)
      const errorMs = Math.abs(d.desfaseMs + desplazamientoMs)
      desplazadas.push({
        id: c.id,
        desplazamientoMs,
        veredicto: d.veredicto,
        desfaseMs: d.desfaseMs,
        errorMs,
        recuperado:
          Math.abs(desplazamientoMs) >= DESFASE_MINIMO_MS &&
          d.veredicto === 'desfasada' &&
          errorMs <= TOLERANCIA_RECUPERADO_MS
      })
    }
    for (const otra of canciones) {
      if (otra.id === c.id) continue
      const a = evaluar(c.letra, otra.nivel)
      ajenas.push({
        letra: c.id,
        voz: otra.id,
        veredicto: a.veredicto,
        aceptada: a.veredicto === 'coincide' || a.veredicto === 'desfasada'
      })
    }
  }
  const grandes = desplazadas.filter((d) => Math.abs(d.desplazamientoMs) >= DESFASE_MINIMO_MS)
  return {
    canciones: canciones.map((c) => c.id),
    avisos,
    propias,
    desplazadas,
    ajenas,
    resumen: {
      propiasAceptadas: propias.filter((p) => p.veredicto === 'coincide').length,
      propias: propias.length,
      ajenasAceptadas: ajenas.filter((a) => a.aceptada).length,
      pares: ajenas.length,
      recuperadas: grandes.filter((d) => d.recuperado).length,
      desplazadas: grandes.length
    },
    ...(variantes ? { variantes: resumirVariantes(canciones) } : {})
  }
}

const sg = (ms: number): string => `${ms > 0 ? '+' : ''}${(ms / 1000).toFixed(1)}s`

export function formatearEncaje(r: ResultadoEncajeCalibracion): string {
  const col = (v: string | number, n: number): string => String(v).padStart(n)
  const salida = [
    ...r.avisos.map((a) => `AVISO ${a}`),
    `Canciones: ${r.canciones.length}. Propias (letra contra su voz, offset 0):`,
    'id        líneas  veredicto       F(0)   I(0)     d*    F(d*)  ganancia  variable  título'
  ]
  for (const p of r.propias) {
    salida.push(
      `${p.id.slice(0, 8).padEnd(8)} ${col(p.lineas, 7)}  ${p.veredicto.padEnd(13)} ${col(p.f0, 6)} ${col(p.i0, 6)} ` +
        `${col(p.desfaseMs, 6)} ${col(p.fDesfase, 8)} ${col(p.ganancia, 9)}  ${col(p.desfaseVariable ? 'sí' : 'no', 8)}  ${p.titulo}`
    )
  }
  salida.push('', 'Desplazadas (letra propia movida; d* esperado = −desplazamiento):')
  salida.push('id        desplaz.  veredicto          d*  error')
  for (const d of r.desplazadas) {
    salida.push(
      `${d.id.slice(0, 8).padEnd(8)} ${col(sg(d.desplazamientoMs), 9)}  ${d.veredicto.padEnd(13)} ${col(d.desfaseMs, 6)} ${col(d.errorMs, 6)}${d.recuperado ? '  recuperada' : ''}`
    )
  }
  const s = r.resumen
  salida.push(
    '',
    'Resumen:',
    `  propias aceptadas (coincide): ${s.propiasAceptadas}/${s.propias}`,
    `  ajenas aceptadas (coincide o desfasada): ${s.ajenasAceptadas}/${s.pares}`,
    `  desplazamientos ≥ 0,5 s recuperados (±${TOLERANCIA_RECUPERADO_MS} ms): ${s.recuperadas}/${s.desplazadas}`
  )
  if (r.variantes) {
    const { resumen, criterio } = r.variantes
    const nombres: Record<NombreVariante, string> = {
      talCual: 'tal cual',
      sinFines: 'sin fines',
      sinFinesPrudentes: 'sin fines + prudentes'
    }
    const pct = (a: number, n: number): string => (n === 0 ? '-' : `${Math.round((a / n) * 100)} %`)
    salida.push(
      '',
      'Variantes (propias aceptadas / ajenas aceptadas / desplazamientos recuperados):'
    )
    for (const n of VARIANTES) {
      const v = resumen[n]
      salida.push(
        `  ${nombres[n].padEnd(22)} propias ${v.propiasAceptadas}/${v.propias} (${pct(v.propiasAceptadas, v.propias)})` +
          `  ajenas ${v.ajenasAceptadas}/${v.pares}  recuperados ${v.recuperadas}/${v.desplazadas}`
      )
    }
    const si = (b: boolean): string => (b ? 'sí' : 'no')
    salida.push(
      `Criterio de adopción (pregunta 0222): ${criterio.cumple ? 'SÍ' : 'NO'} se cumple` +
        ` (sin fines < 90 %: ${si(criterio.sinFinesBajan)}; prudentes ≥ 90 %: ${si(criterio.prudentesRecuperan)};` +
        ` ajenas = 0 en las tres: ${si(criterio.ajenasEnCero)})`
    )
  }
  return salida.join('\n')
}
