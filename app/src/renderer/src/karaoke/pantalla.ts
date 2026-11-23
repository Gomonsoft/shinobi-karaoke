import { pasadasEfectivas, type Pantalla } from '@shared/pantalla'
import type { CambioEnCurso, LineaEnPantalla } from './render'

/*
 * Del modelo de puestos (render.ts) a píxeles (ADR 0022 §3). Puro: las alturas de las líneas
 * (su caja a tamaño S) las inyecta quien las mide; aquí no hay DOM.
 */

const OPACIDAD_PUESTO: Record<number, number> = {
  [-2]: 0.4,
  [-1]: 0.55,
  0: 1,
  1: 1,
  2: 0.8,
  3: 0.65,
  4: 0.55,
  5: 0.5,
  6: 0.45
}
const SEPARACION_JUNTO_ACTIVA = 0.6
const SEPARACION_ENTRE_DEMAS = 0.25
const INTERLINEA = 1.2
const DESPLAZAMIENTO_FUNDIDO = 0.3
const ANCLA_DOS_LINEAS = 0.45
const CENTRO_BLOQUE = 0.47
const LIMITE_SUPERIOR = 0.1
const LIMITE_INFERIOR = 0.86
const BARRA_SOBRE_ANCLA = 0.9

export interface Region {
  y0Px: number
  altoPx: number
}

export function escalaDePuesto(puesto: number): number {
  return puesto === 0 ? 1 : puesto === 1 ? 0.7 : 0.6
}

/** Opacidad objetivo de un puesto; 0 fuera de [−P, F] (puestos «de paso»). */
export function objetivoOpacidad(puesto: number, pasadas: number, futuras: number): number {
  if (puesto < -pasadas || puesto > futuras) return 0
  return OPACIDAD_PUESTO[puesto] ?? 0
}

/**
 * Tamaño de la línea activa: `máx(32 px, 7,5 % del alto)`. No depende del número de líneas. La vista
 * previa del editor pasa `minimoPx = 0`: es el fotograma del reproductor reducido (spec 06).
 */
export function tamanoActiva(altoPx: number, minimoPx = 32): number {
  return Math.max(minimoPx, 0.075 * altoPx)
}

/** Ancla (y del centro de la activa): bloque de líneas de un renglón centrado en el 47 %; 45 % con 2 líneas. */
export function anclaDeBloque(pantalla: Pantalla, region: Region, tamano: number): number {
  if (pantalla.lineas === 2) return region.y0Px + ANCLA_DOS_LINEAS * region.altoPx
  const pasadas = pasadasEfectivas(pantalla)
  const futuras = pantalla.lineas - 1 - pasadas
  const caja = (puesto: number) => INTERLINEA * escalaDePuesto(puesto) * tamano
  const separacion = (k: number) =>
    (k === 1 ? SEPARACION_JUNTO_ACTIVA : SEPARACION_ENTRE_DEMAS) * tamano
  let encima = 0
  for (let k = 1; k <= pasadas; k++) encima += separacion(k) + caja(-k)
  let debajo = 0
  for (let k = 1; k <= futuras; k++) debajo += separacion(k) + caja(k)
  return region.y0Px + CENTRO_BLOQUE * region.altoPx + (encima - debajo) / 2
}

interface Colocada {
  centro: number
  escala: number
  opacidad: number
  gris: number
  dibujar: boolean
}

type Posicion = 'desde' | 'hacia'

/** Apila las líneas de un instante en reposo: la activa en el ancla y el resto hacia fuera. */
function apilar(
  lineas: readonly LineaEnPantalla[],
  cual: Posicion,
  altura: (id: string) => number,
  ctx: { ancla: number; tamano: number; pasadas: number; futuras: number; region: Region }
): Map<string, Colocada> {
  const { ancla, tamano, pasadas, futuras, region } = ctx
  const porPuesto = new Map(lineas.map((l) => [l[cual], l]))
  const puestos = [...porPuesto.keys()]
  const activa = porPuesto.get(0)
  const mitadActiva = (activa ? altura(activa.id) : INTERLINEA * tamano) / 2
  const resultado = new Map<string, Colocada>()
  const colocar = (linea: LineaEnPantalla, centro: number) => {
    const puesto = linea[cual]
    resultado.set(linea.id, {
      centro,
      escala: escalaDePuesto(puesto),
      opacidad: objetivoOpacidad(puesto, pasadas, futuras),
      gris: puesto < 0 ? 1 : 0,
      dibujar: true
    })
  }
  if (activa) colocar(activa, ancla)
  const limiteBajo = region.y0Px + LIMITE_INFERIOR * region.altoPx
  const limiteAlto = region.y0Px + LIMITE_SUPERIOR * region.altoPx
  for (const signo of [1, -1]) {
    let borde = ancla + signo * mitadActiva
    let cortado = false
    const ordenados = puestos.filter((p) => p * signo > 0).sort((a, b) => signo * (a - b))
    ordenados.forEach((puesto, orden) => {
      const linea = porPuesto.get(puesto)!
      const alto = altura(linea.id) * escalaDePuesto(puesto)
      const separacion = (orden === 0 ? SEPARACION_JUNTO_ACTIVA : SEPARACION_ENTRE_DEMAS) * tamano
      const centro = borde + signo * (separacion + alto / 2)
      borde = centro + signo * (alto / 2)
      colocar(linea, centro)
      // Nunca se dibuja una línea cortada, ni las que van detrás.
      if (signo > 0 ? borde > limiteBajo : borde < limiteAlto) cortado = true
      if (cortado) resultado.get(linea.id)!.dibujar = false
    })
  }
  return resultado
}

export interface CopiaDispuesta {
  rol: 'unica' | 'saliente' | 'entrante'
  /** Centro en píxeles de la ventana (ya con `y0Px`). */
  centroY: number
  escala: number
  /** Ya con suelo de contraste, retirada y aparición. */
  opacidad: number
  /** 0–1: mezcla hacia el gris de la letra. */
  mezclaGris: number
  dibujar: boolean
}

export interface LineaDispuesta {
  id: string
  copias: CopiaDispuesta[]
}

export interface BloqueDispuesto {
  ancla: number
  /** Tamaño de la línea activa en píxeles. */
  tamano: number
  lineas: LineaDispuesta[]
  /** Posiciones de los indicadores de espera, relativas al ancla (no dependen de N ni de P). */
  indicadores: { barraY: number; cuentaY: number; puntosY: number }
}

export interface EntradaBloque {
  lineas: readonly LineaEnPantalla[]
  /** Alto de la caja de cada línea a tamaño S (renglones × 1,2 × S), por id. */
  alturas: Readonly<Record<string, number>>
  pantalla: Pantalla
  /** Zona donde se dispone el bloque. En 0.2.2, siempre toda la pantalla. */
  region: Region
  /** Alto de la pantalla entera para calcular S; ausente = el de la región. */
  altoPantallaPx?: number
  /** Mínimo de S en píxeles (32 en pantallas reales, 0 en la vista previa del editor). */
  minimoTamanoPx?: number
  cambio: Pick<CambioEnCurso, 'tipo'> | null
  /** Factor 0–1 del fundido de aparición del bloque (1 si no aplica). */
  aparicion?: number
  /** Opacidad mínima por puesto (`suelosDeOpacidad`). */
  suelos?: Readonly<Record<number, number>>
}

const mezclar = (a: number, b: number, t: number) => a + (b - a) * t

export function disponerBloque(entrada: EntradaBloque): BloqueDispuesto {
  const { lineas, alturas, pantalla, region, suelos = {}, aparicion = 1 } = entrada
  const tamano = tamanoActiva(entrada.altoPantallaPx ?? region.altoPx, entrada.minimoTamanoPx)
  const pasadas = pasadasEfectivas(pantalla)
  const futuras = pantalla.lineas - 1 - pasadas
  const ancla = anclaDeBloque(pantalla, region, tamano)
  const ctx = { ancla, tamano, pasadas, futuras, region }
  const altura = (id: string) => alturas[id] ?? INTERLINEA * tamano
  const origen = apilar(lineas, 'desde', altura, ctx)
  const destino = apilar(lineas, 'hacia', altura, ctx)
  // El suelo es de un puesto: una línea que se va (objetivo 0) sigue llegando a 0.
  const conSuelo = (c: Colocada, puesto: number) =>
    c.opacidad > 0 ? Math.max(c.opacidad, suelos[puesto] ?? 0) : 0
  const fundido = entrada.cambio?.tipo === 'fundido'

  const resultado = lineas.map((linea): LineaDispuesta => {
    const a = origen.get(linea.id)!
    const b = destino.get(linea.id)!
    const oa = conSuelo(a, linea.desde)
    const ob = conSuelo(b, linea.hacia)
    const factor = linea.retirada * aparicion
    const x = linea.avance
    if (fundido && linea.desde !== linea.hacia) {
      const salto = DESPLAZAMIENTO_FUNDIDO * tamano
      return {
        id: linea.id,
        copias: [
          {
            rol: 'saliente',
            centroY: a.centro - salto * x,
            escala: a.escala,
            opacidad: oa * (1 - x) * factor,
            mezclaGris: a.gris,
            dibujar: a.dibujar && oa * (1 - x) * factor > 0
          },
          {
            rol: 'entrante',
            centroY: b.centro + salto * (1 - x),
            escala: b.escala,
            opacidad: ob * x * factor,
            mezclaGris: b.gris,
            dibujar: b.dibujar && ob * x * factor > 0
          }
        ]
      }
    }
    // Una línea que deja de caber (o vuelve a caber) se funde con el avance.
    const visible = mezclar(a.dibujar ? 1 : 0, b.dibujar ? 1 : 0, x)
    const opacidad = mezclar(oa, ob, x) * visible * factor
    return {
      id: linea.id,
      copias: [
        {
          rol: 'unica',
          centroY: mezclar(a.centro, b.centro, x),
          escala: mezclar(a.escala, b.escala, x),
          opacidad,
          mezclaGris: mezclar(a.gris, b.gris, x),
          dibujar: (a.dibujar || b.dibujar) && opacidad > 0
        }
      ]
    }
  })

  return {
    ancla,
    tamano,
    lineas: resultado,
    indicadores: {
      barraY: ancla - BARRA_SOBRE_ANCLA * tamano,
      cuentaY: ancla,
      // A mitad del hueco entre la caja de la activa y la de la +1 (spec, revisión de capturas).
      puntosY: ancla + (INTERLINEA / 2 + SEPARACION_JUNTO_ACTIVA / 2) * tamano
    }
  }
}
