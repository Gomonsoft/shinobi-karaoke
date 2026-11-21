import { CUENTA_MS, ESPERA_LEGADA, UMBRAL_PRIMERA_ENTRADA_MS, type Espera } from '@shared/espera'
import { finEfectivo, palabrasVisibles, type ElementoLetra, type Letra } from '@shared/letra'

export interface LineaRender {
  id: string
  texto: string
  progreso: number
  palabras: { texto: string; progreso: number }[] | null
}

export interface EsperaFotograma {
  origenMs: number
  destinoMs: number
  restanteMs: number
  fraccion: number
  primera: boolean
  puntos: 0 | 1 | 2 | 3
  cuenta: 1 | 2 | 3 | null
  barra: boolean
  /** Identifica el hueco (`origen:destino`); solo cambia al empezar una espera. */
  clave: string
}

export interface FotogramaLetra {
  titulo: { titulo: string; artista: string } | null
  actual: LineaRender | null
  siguiente: LineaRender | null
  espera: EsperaFotograma | null
  claveTransicion: string
}

type ContextoRender = { duracionMs: number; titulo: string; artista: string; espera?: Espera }
type LineaConInicio = ElementoLetra & { inicio_ms: number }
type Indice = { lineas: LineaConInicio[]; fines: Map<string, number> }

const indices = new WeakMap<Letra, Map<number, Indice>>()

function indicePara(letra: Letra, duracionMs: number): Indice {
  let porDuracion = indices.get(letra)
  if (!porDuracion) {
    porDuracion = new Map()
    indices.set(letra, porDuracion)
  }
  let indice = porDuracion.get(duracionMs)
  if (!indice) {
    indice = {
      lineas: letra.lineas.filter(
        (linea): linea is LineaConInicio => linea.tipo === 'linea' && linea.inicio_ms !== null
      ),
      fines: new Map()
    }
    porDuracion.set(duracionMs, indice)
  }
  return indice
}

function finPara(letra: Letra, id: string, duracionMs: number, indice: Indice): number {
  const guardado = indice.fines.get(id)
  if (guardado !== undefined) return guardado
  const fin = finEfectivo(letra, id, duracionMs)!
  indice.fines.set(id, fin)
  return fin
}

function progreso(t: number, inicio: number, fin: number): number {
  return Math.max(0, Math.min(1, (t - inicio) / (fin - inicio)))
}

function dibujar(
  linea: ElementoLetra,
  proporcion: number,
  proporcionPalabra: (palabra: NonNullable<ElementoLetra['palabras']>[number], i: number) => number
): LineaRender {
  // Solo las palabras hechas a mano se pintan una a una; las importadas se barren con la línea.
  return {
    id: linea.id,
    texto: linea.texto,
    progreso: proporcion,
    palabras:
      palabrasVisibles(linea)?.map((p, i) => ({
        texto: p.texto,
        progreso: proporcionPalabra(p, i)
      })) ?? null
  }
}

function esperaEn(
  cfg: Espera,
  t: number,
  previaFin: number | null,
  destino: number
): EsperaFotograma | null {
  if (!cfg.puntos && !cfg.barra && !cfg.cuenta) return null
  const primera = previaFin === null
  if (primera && !cfg.primera_entrada) return null
  const origen = primera ? destino - UMBRAL_PRIMERA_ENTRADA_MS : previaFin
  if (!primera && destino - origen < cfg.umbral_ms) return null
  const restante = destino - t
  const cuentaActiva = restante <= CUENTA_MS
  const digito = Math.ceil(restante / 1000) as 1 | 2 | 3
  return {
    origenMs: origen,
    destinoMs: destino,
    restanteMs: restante,
    fraccion: progreso(t, origen, destino),
    primera,
    puntos: cfg.puntos && cuentaActiva ? digito : 0,
    cuenta: cfg.cuenta && cuentaActiva ? digito : null,
    barra: cfg.barra,
    clave: `${origen}:${destino}`
  }
}

export function fotogramaEn(letra: Letra, tLetraMs: number, ctx: ContextoRender): FotogramaLetra {
  const { duracionMs, titulo, artista } = ctx
  const indice = indicePara(letra, duracionMs)
  const { lineas } = indice
  const primera = lineas[0]
  if (!primera || tLetraMs < primera.inicio_ms - 4000) {
    return {
      titulo: { titulo, artista },
      actual: null,
      siguiente: null,
      espera: null,
      claveTransicion: 'titulo'
    }
  }

  let izq = 0
  let der = lineas.length
  while (izq < der) {
    const centro = (izq + der) >>> 1
    if (lineas[centro]!.inicio_ms <= tLetraMs) izq = centro + 1
    else der = centro
  }

  const previa = lineas[izq - 1]
  const siguiente = lineas[izq]
  const fin = previa ? finPara(letra, previa.id, duracionMs, indice) : 0
  const actual = previa && tLetraMs < fin ? previa : null
  const espera =
    !actual && siguiente
      ? esperaEn(ctx.espera ?? ESPERA_LEGADA, tLetraMs, previa ? fin : null, siguiente.inicio_ms)
      : null

  return {
    titulo: null,
    actual: actual
      ? dibujar(actual, progreso(tLetraMs, actual.inicio_ms, fin), (p) =>
          progreso(tLetraMs, p.inicio_ms, p.fin_ms)
        )
      : null,
    siguiente: siguiente ? dibujar(siguiente, 0, () => 0) : null,
    espera,
    claveTransicion: actual ? `actual:${actual.id}` : `espera:${siguiente?.id ?? ''}`
  }
}

export function fotogramaEstatico(letra: Letra, id: string | null): FotogramaLetra {
  const lineas = letra.lineas.filter((l) => l.tipo === 'linea')
  const indice =
    id === null
      ? 0
      : Math.max(
          0,
          lineas.findIndex((l) => l.id === id)
        )
  const actual = lineas[indice]
  const siguiente = lineas[indice + 1]
  const mitad = (actual ? (palabrasVisibles(actual)?.length ?? 0) : 0) / 2
  return {
    titulo: null,
    actual: actual ? dibujar(actual, 0.5, (_p, i) => progreso(mitad, i, i + 1)) : null,
    siguiente: siguiente ? dibujar(siguiente, 0, () => 0) : null,
    espera: null,
    claveTransicion: `pausa:${actual?.id ?? ''}`
  }
}
