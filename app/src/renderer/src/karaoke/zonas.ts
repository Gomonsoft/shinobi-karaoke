import {
  PANTALLA_PREDETERMINADA,
  ZONAS_AREA_FIN,
  ZONAS_AREA_INICIO,
  ZONAS_SEPARACION_S,
  ZONA_CORO_ESCALA_MIN,
  ZONA_CORO_FRACCION_ALTO,
  ZONA_ESCALA_MIN,
  ZONA_ESCALA_SIGUIENTE,
  ZONA_LINEAS_CANTANTE,
  ZONA_LINEAS_CORO,
  ZONA_OPACIDAD_INACTIVA,
  zonasEfectivas,
  type Pantalla,
  type ZonasPantalla
} from '@shared/pantalla'
import { finEfectivo, type ElementoLetra, type Letra } from '@shared/letra'
import { cantantesDe, parteDe, tieneReparto, type Parte } from '@shared/reparto'
import { tamanoActiva, type Region } from './pantalla'
import { fotogramaEn, fotogramaEstatico, type ContextoRender, type FotogramaLetra } from './render'

/*
 * Zonas de pantalla (ADR 0029 §4 bis): cada parte tiene su franja fija, con su propia secuencia de
 * líneas. Sin reparto, o con `estilo.pantalla.zonas = "una"`, hay una sola que es el bloque de 0.2.2.
 */

export const ZONA_PANTALLA_ENTERA = 'todas'
export const ZONA_CORO = 'coro'

/** Una zona con su subsecuencia de líneas. La geometría depende del tamaño de la ventana: `geometriaDeZonas`. */
export interface ZonaLetra {
  id: string
  /** Subsecuencia de la letra (estable por letra: es la clave de la caché de sucesos). */
  lineas: Letra['lineas']
  /** Bloque único de 0.2.2 o zona de una parte. */
  modo: 'bloque' | 'parte'
  /** Partes que se dibujan en ella (vacío en el bloque único). `todos` va en todas las de cantante. */
  partes: Parte[]
  /** Líneas que muestra: 1 el coro, 2 un cantante (la en curso o próxima y la siguiente). */
  lineasVisibles: number
}

export interface GeometriaZona {
  region: Region
  /** `S_zona` en píxeles; ausente en el bloque único (usa `S`). */
  tamanoPx?: number
  /** `S_zona / S`: lo escribe el componente como `--k-escala-zona`. */
  escala: number
  /** Ancla (centro de la línea en curso) en píxeles; ausente en el bloque único. */
  ancla?: number
  /** Límites de la región, en fracciones de su alto. */
  limites?: readonly [number, number]
}

/** Zona tal como la describe el ADR: `zonasDePantalla`. */
export interface ZonaDePantalla {
  id: string
  partes: Parte[]
  region: Region
  lineas: number
  escala: number
}

/** Alto de la caja de una línea, en múltiplos de `S`. */
const INTERLINEA = 1.2
/** Alto de la zona del coro en `S`: dos renglones (2,4) y la fila de indicadores de espera (0,9). */
const ALTO_CORO_EN_S = 2 * INTERLINEA + 0.9
/** Alto del bloque de una línea de dos renglones y la siguiente al 70 %, con su separación (0,6 S). */
const ALTO_DOS_LINEAS = 2 * INTERLINEA + ZONA_ESCALA_SIGUIENTE * INTERLINEA
const SEPARACION_JUNTO_ACTIVA = 0.6

const cache = new WeakMap<Letra['lineas'], Map<string, ZonaLetra[]>>()

/** La línea con su fin efectivo ya resuelto en la letra entera (un hueco entre partes no alarga la línea). */
function conFin(
  letra: Pick<Letra, 'lineas'>,
  linea: ElementoLetra,
  duracionMs: number
): ElementoLetra {
  if (linea.fin_ms !== null || linea.inicio_ms === null) return linea
  const fin = finEfectivo(letra, linea.id, duracionMs)
  return fin === null ? linea : { ...linea, fin_ms: fin }
}

function zonaUnica(letra: Pick<Letra, 'lineas'>): ZonaLetra[] {
  return [
    {
      id: ZONA_PANTALLA_ENTERA,
      lineas: letra.lineas,
      modo: 'bloque',
      partes: [],
      lineasVisibles: 0
    }
  ]
}

/**
 * Zonas de una letra, de arriba abajo: el Coro (si tiene líneas de coro) y una por cantante, en orden de
 * ranura. Las líneas de «Todos» entran en la subsecuencia de cada cantante. Se cachea por letra.
 */
export function zonasDeLetra(
  letra: Pick<Letra, 'lineas' | 'partes'>,
  { zonas = 'por_parte', duracionMs = 0 }: { zonas?: ZonasPantalla; duracionMs?: number } = {}
): ZonaLetra[] {
  if (zonas === 'una' || !tieneReparto(letra)) return zonaUnica(letra)
  const clave = `${duracionMs}|${cantantesDe(letra).map((c) => c.id)}`
  let porClave = cache.get(letra.lineas)
  if (!porClave) cache.set(letra.lineas, (porClave = new Map()))
  const guardada = porClave.get(clave)
  if (guardada) return guardada

  const lineas = letra.lineas
    .filter((l) => l.tipo === 'linea')
    .map((l) => ({ linea: conFin(letra, l, duracionMs), parte: parteDe(l, letra) }))
  const resultado: ZonaLetra[] = []
  if (lineas.some((l) => l.parte === 'coro')) {
    resultado.push({
      id: ZONA_CORO,
      lineas: lineas.filter((l) => l.parte === 'coro').map((l) => l.linea),
      modo: 'parte',
      partes: ['coro'],
      lineasVisibles: ZONA_LINEAS_CORO
    })
  }
  for (const { id } of cantantesDe(letra)) {
    resultado.push({
      id,
      lineas: lineas.filter((l) => l.parte === id || l.parte === 'todos').map((l) => l.linea),
      modo: 'parte',
      partes: [id, 'todos'],
      lineasVisibles: ZONA_LINEAS_CANTANTE
    })
  }
  porClave.set(clave, resultado)
  return resultado
}

/** La pantalla que ven las zonas por parte: `N = lineas visibles` y `P = 0` («Líneas a la vez» y «ya cantadas» no se aplican). */
export function pantallaDeZona(pantalla: Pantalla, zona: ZonaLetra): Pantalla {
  if (zona.modo === 'bloque') return pantalla
  return { ...pantalla, lineas: zona.lineasVisibles, pasadas: 0 }
}

/**
 * Geometría de las zonas para una ventana (ADR 0029 §4 bis). Del 12 % al 86 % del alto, separadas
 * 0,3 × `S`; la del coro mide la mitad que una de cantante. `S_zona` es una sola para todas las de
 * cantante (mínimo 0,75 × `S`) y la del coro cabe en su alto (mínimo 0,5 × `S`): se calcula con el
 * tamaño de la ventana, no por línea.
 */
export function geometriaDeZonas(
  zonas: readonly ZonaLetra[],
  { altoPx, minimoTamanoPx = 32 }: { altoPx: number; minimoTamanoPx?: number }
): Record<string, GeometriaZona> {
  if (zonas.every((z) => z.modo === 'bloque')) {
    return Object.fromEntries(zonas.map((z) => [z.id, { region: { y0Px: 0, altoPx }, escala: 1 }]))
  }
  const S = tamanoActiva(altoPx, minimoTamanoPx)
  const area = (ZONAS_AREA_FIN - ZONAS_AREA_INICIO) * altoPx
  const separacion = ZONAS_SEPARACION_S * S
  const unidades = zonas.reduce(
    (suma, z) => suma + (z.id === ZONA_CORO ? ZONA_CORO_FRACCION_ALTO : 1),
    0
  )
  const unidad = Math.max(0, area - (zonas.length - 1) * separacion) / unidades
  const sCantante = Math.max(ZONA_ESCALA_MIN * S, Math.min(S, unidad / ALTO_DOS_LINEAS))
  const resultado: Record<string, GeometriaZona> = {}
  let y0 = ZONAS_AREA_INICIO * altoPx
  for (const zona of zonas) {
    const alto = zona.id === ZONA_CORO ? unidad * ZONA_CORO_FRACCION_ALTO : unidad
    const tamano =
      zona.id === ZONA_CORO
        ? Math.max(ZONA_CORO_ESCALA_MIN * S, Math.min(sCantante, alto / ALTO_CORO_EN_S))
        : sCantante
    // Con la siguiente a la vista el bloque se centra entero; si no cabe, solo la línea en curso.
    const conSiguiente = zona.lineasVisibles > 1 && ALTO_DOS_LINEAS * tamano <= alto
    const ancla = conSiguiente
      ? y0 +
        alto / 2 -
        ((SEPARACION_JUNTO_ACTIVA + ZONA_ESCALA_SIGUIENTE * INTERLINEA) * tamano) / 2
      : y0 + alto / 2
    resultado[zona.id] = {
      region: { y0Px: y0, altoPx: alto },
      tamanoPx: tamano,
      escala: tamano / S,
      ancla,
      limites: [0, 1]
    }
    y0 += alto + separacion
  }
  return resultado
}

/**
 * Las zonas con su geometría (ADR 0029 §4 bis): `[{ id, partes, region, lineas, escala }]`. Sin
 * reparto o con `zonas: "una"`, una sola que cubre la pantalla.
 */
export function zonasDePantalla(
  letra: Pick<Letra, 'lineas' | 'partes'>,
  pantalla: Pick<Pantalla, 'zonas'>,
  {
    altoPx,
    minimoTamanoPx,
    duracionMs
  }: { altoPx: number; minimoTamanoPx?: number; duracionMs?: number }
): ZonaDePantalla[] {
  const zonas = zonasDeLetra(letra, { zonas: zonasEfectivas(pantalla), duracionMs })
  const geometria = geometriaDeZonas(zonas, { altoPx, minimoTamanoPx })
  return zonas.map((z) => ({
    id: z.id,
    partes: z.partes,
    region: geometria[z.id]!.region,
    lineas: z.lineasVisibles,
    escala: geometria[z.id]!.escala
  }))
}

/** Zona que dibuja los indicadores de espera: la de la línea que viene (Todos, la del primer cantante). */
function zonaDeEspera(
  zonas: readonly ZonaLetra[],
  letra: Pick<Letra, 'lineas' | 'partes'>,
  idSiguiente: string | undefined
): string | undefined {
  const linea = letra.lineas.find((l) => l.id === idSiguiente)
  if (!linea) return undefined
  const parte = parteDe(linea, letra)
  const por = (id: string) => zonas.find((z) => z.id === id)?.id
  if (parte === 'coro') return por(ZONA_CORO)
  return por(parte) ?? zonas.find((z) => z.id !== ZONA_CORO)?.id
}

/**
 * El fotograma de cada zona en un instante. Sin zonas por parte es el de siempre. Con ellas, cada una
 * calcula su subsecuencia (`N = lineas`, `P = 0`, `subidaAlSalir`), y lo que es de la canción entera
 * (el título, la aparición y la espera) sale de la letra completa.
 */
export function fotogramasDeZonas(
  zonas: readonly ZonaLetra[],
  letra: Pick<Letra, 'lineas' | 'partes'>,
  tLetraMs: number,
  ctx: ContextoRender
): FotogramaLetra[] {
  if (zonas.every((z) => z.modo === 'bloque'))
    return zonas.map((z) => fotogramaEn(z, tLetraMs, ctx))
  const global = fotogramaEn(letra, tLetraMs, ctx)
  if (global.titulo) return zonas.map(() => global)
  const destino = global.espera ? zonaDeEspera(zonas, letra, global.siguiente?.id) : undefined
  return zonas.map((zona) => {
    const contexto = {
      ...ctx,
      pantalla: pantallaDeZona(ctx.pantalla ?? PANTALLA_PREDETERMINADA, zona),
      subidaAlSalir: true
    }
    let f = fotogramaEn(zona, tLetraMs, contexto)
    if (f.titulo) {
      // Su primera línea queda lejos, pero el título ya terminó: se ve como próxima, sin barrer.
      const primera = zona.lineas.find((l) => l.inicio_ms !== null)
      f = primera
        ? fotogramaEn(zona, primera.inicio_ms! - 4000, contexto)
        : { ...f, opacidadZona: ZONA_OPACIDAD_INACTIVA }
    }
    const esta = zona.id === destino
    return {
      ...f,
      titulo: null,
      aparicion: global.aparicion,
      espera: esta ? global.espera : null,
      esperaAparicion: esta ? global.esperaAparicion : 0,
      siguiente: global.siguiente
    }
  })
}

/** El fotograma sin reloj (la línea elegida en el editor) de cada zona. */
export function fotogramasEstaticosDeZonas(
  zonas: readonly ZonaLetra[],
  letra: Pick<Letra, 'lineas' | 'partes'>,
  id: string | null,
  pantalla: Pantalla
): FotogramaLetra[] {
  if (zonas.every((z) => z.modo === 'bloque'))
    return zonas.map((z) => fotogramaEstatico(z, id, pantalla))
  const orden = letra.lineas.filter((l) => l.tipo === 'linea').map((l) => l.id)
  const elegida = id === null ? 0 : Math.max(0, orden.indexOf(id))
  return zonas.map((zona) => {
    const suya = zona.lineas.find((l) => l.id === orden[elegida])
    // Si la elegida no es de esta zona, se ve su próxima línea (o la última, si no queda ninguna).
    const proxima =
      zona.lineas.find((l) => orden.indexOf(l.id) > elegida) ?? zona.lineas.at(-1) ?? null
    const f = fotogramaEstatico(
      zona,
      (suya ?? proxima)?.id ?? null,
      pantallaDeZona(pantalla, zona),
      {
        activa: !!suya
      }
    )
    return { ...f, siguiente: null }
  })
}
