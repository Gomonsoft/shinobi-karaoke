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
 *
 * --inicios (tarea 0385, pregunta 0295): además imprime la señal por INICIOS de línea (arranques de voz tras una
 * pausa, corregidos por el azar) por canción y el barrido de reglas con el criterio de adopción. Solo medida
 * (`calibrar-inicios.ts`); no cambia ningún veredicto. Solo ids (8 primeros caracteres) y cifras.
 *
 * Tarea 0381 (ADR 0024, revisión 2026-11-22): además de lo anterior imprime, por canción propia, la densidad de
 * voz, el contraste, la limitación y el veredicto sin guardas (`veredictoBase`), y una línea «Criterio de
 * seguridad»: SÍ si no hay ajenas aceptadas, ni desplazadas de ≥ 0,8 s que digan «coincide», ni propias
 * «desfasada», ni correcciones con error > 200 ms (en «tal cual» y, con --variantes, en «sin fines»).
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import {
  evaluarEncajeConPicos,
  PARAMETROS_ENCAJE,
  type ParametrosEncaje,
  type ResultadoEncaje
} from '../src/shared/encaje'
import { leerNivelBase, type NivelBase } from '../src/main/picos/formato'
import { letraSchema, type Letra } from '../src/shared/letra'
import { detectarVoz, proponerAjusteSilencios } from '../src/shared/silencios'
import { ESPERA_LEGADA } from '../src/shared/espera'
import {
  DESPLAZAMIENTOS_INICIOS_MS,
  formatearInicios,
  medirTodoInicios,
  type EntradaInicios,
  type ResultadoInicios,
  type VeredictosEncaje
} from './calibrar-inicios'

const CACHE = /^\.picos-voz-v1-[a-f0-9]{64}\.bin$/
export const DESPLAZAMIENTOS_MS = [-3000, -1500, -800, -400, 400, 800, 1500, 3000] as const
export const TOLERANCIA_RECUPERADO_MS = 50
export const TOLERANCIA_CORRECCION_MS = 200
export const DESFASE_MINIMO_MS = 500
/** Desplazamiento mínimo del que un «coincide» es un falso «coincide» (el que la comprobación debe notar). */
export const DESFASE_SENSIBLE_MS = 800

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
  /** Voz detectada entre la primera y la última línea, en %. */
  densidadVozPct: number
  contrasteF: number
  limitacion: string | null
  /** Veredicto antes de las guardas de fiabilidad. */
  veredictoBase: string
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
/**
 * «Elección sin comprobar» (tarea 0393, ADR 0025 revisión 2026-11-23): letras tal cual que la preparación
 * elegiría sin poder comprobarlas (`dudosa` con limitación; la duración y el texto se miran en la elección).
 */
export interface EleccionSinComprobar {
  propias: { elegibles: number; de: number; ids: string[] }
  /** Pares letra→voz elegibles; `enDuracion` los de pares con duraciones a ≤ 2000 ms. */
  ajenas: {
    elegibles: number
    de: number
    enDuracion: { elegibles: number; de: number; pares: string[] }
  }
  /** Letras propias movidas ±0,8 s o más. */
  desplazadas: { elegibles: number; de: number }
}
export interface ResultadoEncajeCalibracion {
  canciones: string[]
  avisos: string[]
  propias: FilaPropia[]
  desplazadas: FilaDesplazada[]
  ajenas: FilaAjena[]
  resumen: ResumenVariante
  sinComprobar: EleccionSinComprobar
  seguridad: CriterioSeguridad
  /** Solo con `--variantes`. */
  variantes?: ResultadoVariantes
  /** Solo con `--inicios`. */
  inicios?: ResultadoInicios
}
export interface ResumenVariante {
  /** Propias `coincide` (con guardas). */
  propiasAceptadas: number
  /** Propias que serían `coincide` sin guardas (`veredictoBase`). */
  propiasSinGuardas: number
  propias: number
  /** Propias `desfasada`: falsas correcciones. */
  propiasDesfasadas: number
  ajenasAceptadas: number
  pares: number
  /** Desplazadas de ≥ 0,8 s que salen `coincide`: falsos «coincide». */
  falsosCoincide: number
  /** Desplazadas `desfasada` con |error| > 200 ms: correcciones equivocadas. */
  correccionesEquivocadas: number
  /** Desplazadas ≥ 0,5 s recuperadas (±50 ms). */
  recuperadas: number
  /** Ídem con ±200 ms. */
  recuperadas200: number
  desplazadas: number
}
export interface CriterioSeguridad {
  /** 0 ajenas aceptadas, 0 falsos «coincide», 0 propias `desfasada` y 0 correcciones equivocadas. */
  cumple: boolean
  /** Variantes en las que se ha comprobado. */
  en: NombreVariante[]
}
export const seguro = (r: ResumenVariante): boolean =>
  r.ajenasAceptadas === 0 &&
  r.falsosCoincide === 0 &&
  r.propiasDesfasadas === 0 &&
  r.correccionesEquivocadas === 0
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

const evaluar = (letra: Letra, nivel: NivelBase, p: ParametrosEncaje): ResultadoEncaje =>
  evaluarEncajeConPicos(
    letra,
    { pasoMs: nivel.pasoMs, pares: nivel.pares },
    {
      duracionMs: nivel.duracionMs,
      p
    }
  )

const elegibleSinComprobar = (r: ResultadoEncaje): boolean =>
  r.veredicto === 'dudosa' && r.limitacion != null
/** Misma tolerancia de duración que `elegirLetra` (ADR 0025 §3). */
const DURACION_MAXIMA_MS = 2000

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

/** Todas las cifras de una variante: propias, desplazadas y ajenas, con las guardas puestas. */
function medirVariante(
  nombre: NombreVariante,
  canciones: Cancion[],
  p: ParametrosEncaje
): ResumenVariante {
  const r: ResumenVariante = {
    propiasAceptadas: 0,
    propiasSinGuardas: 0,
    propias: 0,
    propiasDesfasadas: 0,
    ajenasAceptadas: 0,
    pares: 0,
    falsosCoincide: 0,
    correccionesEquivocadas: 0,
    recuperadas: 0,
    recuperadas200: 0,
    desplazadas: 0
  }
  for (const c of canciones) {
    r.propias++
    const propia = evaluar(variante(nombre, c.letra, c.nivel), c.nivel, p)
    if (propia.veredicto === 'coincide') r.propiasAceptadas++
    if (propia.veredicto === 'desfasada') r.propiasDesfasadas++
    if (propia.veredictoBase === 'coincide') r.propiasSinGuardas++
    for (const desplazamientoMs of DESPLAZAMIENTOS_MS) {
      const grande = Math.abs(desplazamientoMs) >= DESFASE_MINIMO_MS
      const movida = { ...c.letra, offset_ms: desplazamientoMs }
      const d = evaluar(variante(nombre, movida, c.nivel), c.nivel, p)
      if (d.veredicto === 'coincide' && Math.abs(desplazamientoMs) >= DESFASE_SENSIBLE_MS) {
        r.falsosCoincide++
      }
      if (!grande) continue
      r.desplazadas++
      if (d.veredicto !== 'desfasada') continue
      const error = Math.abs(d.desfaseMs + desplazamientoMs)
      if (error <= TOLERANCIA_RECUPERADO_MS) r.recuperadas++
      if (error <= TOLERANCIA_CORRECCION_MS) r.recuperadas200++
      else r.correccionesEquivocadas++
    }
    for (const otra of canciones) {
      if (otra.id === c.id) continue
      r.pares++
      const a = evaluar(variante(nombre, c.letra, otra.nivel), otra.nivel, p).veredicto
      if (a === 'coincide' || a === 'desfasada') r.ajenasAceptadas++
    }
  }
  return r
}

function resumirVariantes(canciones: Cancion[], p: ParametrosEncaje): ResultadoVariantes {
  const resumen = {} as Record<NombreVariante, ResumenVariante>
  for (const nombre of VARIANTES) resumen[nombre] = medirVariante(nombre, canciones, p)
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

/** Lo que el encaje actual dice de cada letra de la canción en una variante (para aplicar la regla por inicios). */
function veredictosDe(
  nombre: NombreVariante,
  c: Cancion,
  canciones: Cancion[],
  p: ParametrosEncaje
): VeredictosEncaje {
  const veredicto = (letra: Letra, nivel: NivelBase): string =>
    evaluar(variante(nombre, letra, nivel), nivel, p).veredicto
  const desplazadas: Record<number, string> = {}
  for (const s of DESPLAZAMIENTOS_INICIOS_MS) {
    desplazadas[s] = veredicto({ ...c.letra, offset_ms: s }, c.nivel)
  }
  const ajenas: Record<string, string> = {}
  for (const otra of canciones)
    if (otra.id !== c.id) ajenas[otra.id] = veredicto(c.letra, otra.nivel)
  return { propia: veredicto(c.letra, c.nivel), desplazadas, ajenas }
}

function medirIniciosCanciones(canciones: Cancion[], p: ParametrosEncaje): ResultadoInicios {
  const entrada: EntradaInicios[] = canciones.map((c) => ({
    id: c.id,
    inicios: c.letra.lineas.flatMap((e) =>
      e.tipo === 'linea' && e.inicio_ms !== null ? [e.inicio_ms] : []
    ),
    intervalos: detectarVoz({ pasoMs: c.nivel.pasoMs, pares: c.nivel.pares }).intervalos,
    duracionMs: c.nivel.duracionMs,
    veredictoBase: evaluar(c.letra, c.nivel, p).veredictoBase,
    veredictos: {
      talCual: veredictosDe('talCual', c, canciones, p),
      sinFines: veredictosDe('sinFines', c, canciones, p)
    }
  }))
  return medirTodoInicios(entrada)
}

export async function calibrarEncaje(
  raiz: string,
  {
    ids,
    variantes = false,
    inicios = false,
    parametros
  }: {
    ids?: string[]
    variantes?: boolean
    inicios?: boolean
    parametros?: Partial<ParametrosEncaje>
  } = {}
): Promise<ResultadoEncajeCalibracion> {
  const p: ParametrosEncaje = { ...PARAMETROS_ENCAJE, ...parametros }
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

  const sc: EleccionSinComprobar = {
    propias: { elegibles: 0, de: 0, ids: [] },
    ajenas: { elegibles: 0, de: 0, enDuracion: { elegibles: 0, de: 0, pares: [] } },
    desplazadas: { elegibles: 0, de: 0 }
  }
  const propias: FilaPropia[] = []
  const desplazadas: FilaDesplazada[] = []
  const ajenas: FilaAjena[] = []
  for (const c of canciones) {
    const r = evaluar(c.letra, c.nivel, p)
    sc.propias.de++
    if (elegibleSinComprobar(r)) {
      sc.propias.elegibles++
      sc.propias.ids.push(c.id.slice(0, 8))
    }
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
      desfaseVariable: r.desfaseVariable,
      densidadVozPct: Math.round(r.densidadVoz * 100),
      contrasteF: redondear(r.contrasteF),
      limitacion: r.limitacion,
      veredictoBase: r.veredictoBase
    })
    for (const desplazamientoMs of DESPLAZAMIENTOS_MS) {
      const d = evaluar({ ...c.letra, offset_ms: desplazamientoMs }, c.nivel, p)
      const errorMs = Math.abs(d.desfaseMs + desplazamientoMs)
      if (Math.abs(desplazamientoMs) >= DESFASE_SENSIBLE_MS) {
        sc.desplazadas.de++
        if (elegibleSinComprobar(d)) sc.desplazadas.elegibles++
      }
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
      const a = evaluar(c.letra, otra.nivel, p)
      const cerca = Math.abs(c.nivel.duracionMs - otra.nivel.duracionMs) <= DURACION_MAXIMA_MS
      sc.ajenas.de++
      if (cerca) sc.ajenas.enDuracion.de++
      if (elegibleSinComprobar(a)) {
        sc.ajenas.elegibles++
        if (cerca) {
          sc.ajenas.enDuracion.elegibles++
          sc.ajenas.enDuracion.pares.push(`${c.id.slice(0, 8)}→${otra.id.slice(0, 8)}`)
        }
      }
      ajenas.push({
        letra: c.id,
        voz: otra.id,
        veredicto: a.veredicto,
        aceptada: a.veredicto === 'coincide' || a.veredicto === 'desfasada'
      })
    }
  }
  const resumen = medirVariante('talCual', canciones, p)
  const variantesResultado = variantes ? resumirVariantes(canciones, p) : undefined
  const comprobadas: NombreVariante[] = variantesResultado ? ['talCual', 'sinFines'] : ['talCual']
  const resumenDe = (n: NombreVariante): ResumenVariante =>
    n === 'talCual' ? resumen : variantesResultado!.resumen[n]
  return {
    canciones: canciones.map((c) => c.id),
    avisos,
    propias,
    desplazadas,
    ajenas,
    resumen,
    sinComprobar: sc,
    seguridad: { cumple: comprobadas.every((n) => seguro(resumenDe(n))), en: comprobadas },
    ...(variantesResultado ? { variantes: variantesResultado } : {}),
    ...(inicios ? { inicios: medirIniciosCanciones(canciones, p) } : {})
  }
}

const sg = (ms: number): string => `${ms > 0 ? '+' : ''}${(ms / 1000).toFixed(1)}s`

export function formatearEncaje(r: ResultadoEncajeCalibracion): string {
  const col = (v: string | number, n: number): string => String(v).padStart(n)
  const salida = [
    ...r.avisos.map((a) => `AVISO ${a}`),
    `Canciones: ${r.canciones.length}. Propias (letra contra su voz, offset 0):`,
    'id        líneas  veredicto       F(0)   I(0)     d*    F(d*)  ganancia  variable  voz%  contraste  limitación    sin guardas   título'
  ]
  for (const p of r.propias) {
    salida.push(
      `${p.id.slice(0, 8).padEnd(8)} ${col(p.lineas, 7)}  ${p.veredicto.padEnd(13)} ${col(p.f0, 6)} ${col(p.i0, 6)} ` +
        `${col(p.desfaseMs, 6)} ${col(p.fDesfase, 8)} ${col(p.ganancia, 9)}  ${col(p.desfaseVariable ? 'sí' : 'no', 8)}  ${col(p.densidadVozPct, 4)}  ${col(p.contrasteF, 9)}  ${(p.limitacion ?? '-').padEnd(12)}  ${p.veredictoBase.padEnd(12)}  ${p.titulo}`
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
    `  propias aceptadas (coincide): ${s.propiasAceptadas}/${s.propias}; sin guardas: ${s.propiasSinGuardas}/${s.propias}`,
    `  propias desfasada (falsas correcciones): ${s.propiasDesfasadas}`,
    `  ajenas aceptadas (coincide o desfasada): ${s.ajenasAceptadas}/${s.pares}`,
    `  desplazadas ≥ 0,8 s que dicen coincide: ${s.falsosCoincide}`,
    `  correcciones con error > ${TOLERANCIA_CORRECCION_MS} ms: ${s.correccionesEquivocadas}`,
    `  desplazamientos ≥ 0,5 s recuperados: ${s.recuperadas}/${s.desplazadas} (±${TOLERANCIA_RECUPERADO_MS} ms), ${s.recuperadas200}/${s.desplazadas} (±${TOLERANCIA_CORRECCION_MS} ms)`
  )
  if (r.variantes) {
    const { resumen, criterio } = r.variantes
    const nombres: Record<NombreVariante, string> = {
      talCual: 'tal cual',
      sinFines: 'sin fines',
      sinFinesPrudentes: 'sin fines + prudentes'
    }
    const pct = (a: number, n: number): string => (n === 0 ? '-' : `${Math.round((a / n) * 100)} %`)
    salida.push('', 'Variantes:')
    for (const n of VARIANTES) {
      const v = resumen[n]
      salida.push(
        `  ${nombres[n].padEnd(22)} propias ${v.propiasAceptadas}/${v.propias} (${pct(v.propiasAceptadas, v.propias)}; sin guardas ${v.propiasSinGuardas})` +
          `  propias desfasada ${v.propiasDesfasadas}  ajenas ${v.ajenasAceptadas}/${v.pares}` +
          `  falsos coincide ${v.falsosCoincide}  correcciones malas ${v.correccionesEquivocadas}` +
          `  recuperados ${v.recuperadas}/${v.desplazadas} (±200 ms: ${v.recuperadas200})`
      )
    }
    const si = (b: boolean): string => (b ? 'sí' : 'no')
    salida.push(
      `Criterio de adopción (pregunta 0222): ${criterio.cumple ? 'SÍ' : 'NO'} se cumple` +
        ` (sin fines < 90 %: ${si(criterio.sinFinesBajan)}; prudentes ≥ 90 %: ${si(criterio.prudentesRecuperan)};` +
        ` ajenas = 0 en las tres: ${si(criterio.ajenasEnCero)})`
    )
  }
  const sc = r.sinComprobar
  salida.push(
    `Elección sin comprobar (ADR 0025, 2026-11-23): propias elegibles ${sc.propias.elegibles}/${sc.propias.de}` +
      (sc.propias.ids.length > 0 ? ` [${sc.propias.ids.join(', ')}]` : '') +
      `; ajenas elegibles ${sc.ajenas.elegibles}/${sc.ajenas.de}, con duraciones a ≤ ${DURACION_MAXIMA_MS} ms ` +
      `${sc.ajenas.enDuracion.elegibles}/${sc.ajenas.enDuracion.de}` +
      (sc.ajenas.enDuracion.pares.length > 0 ? ` [${sc.ajenas.enDuracion.pares.join(', ')}]` : '') +
      `; desplazadas ±0,8 s o más elegibles ${sc.desplazadas.elegibles}/${sc.desplazadas.de}`
  )
  salida.push(
    `Criterio de seguridad (ADR 0024, revisión 2026-11-22): ${r.seguridad.cumple ? 'SÍ' : 'NO'}` +
      ` (${r.seguridad.en.map((n) => (n === 'talCual' ? 'tal cual' : 'sin fines')).join(' y ')}: 0 ajenas aceptadas, 0 falsos coincide, 0 propias desfasada, 0 correcciones malas)`
  )
  if (r.inicios) salida.push(...formatearInicios(r.inicios))
  return salida.join('\n')
}
