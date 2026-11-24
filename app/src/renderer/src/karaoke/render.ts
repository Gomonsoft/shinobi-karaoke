import { CUENTA_MS, ESPERA_LEGADA, UMBRAL_PRIMERA_ENTRADA_MS, type Espera } from '@shared/espera'
import {
  APARICION_BLOQUE_MS,
  DURACION_CAMBIO_MS,
  FRACCION_ENTRADA,
  FUNDIDO_RETIRADA_MS,
  MINIMO_ANIMADO_MS,
  PANTALLA_PREDETERMINADA,
  RETIRADA_MS,
  ZONA_OPACIDAD_INACTIVA,
  pasadasEfectivas,
  type Pantalla
} from '@shared/pantalla'
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

/** Una línea del bloque: su puesto antes y después del cambio en curso (ADR 0022 §2). */
export interface LineaEnPantalla extends LineaRender {
  /** Puesto entero antes del cambio en curso (o el actual si no hay cambio). 0 = activa, +k futuras, −k ya cantadas. */
  desde: number
  /** Puesto entero tras el cambio en curso. */
  hacia: number
  /** 0–1, ya con la curva; 1 si no hay cambio en curso. */
  avance: number
  /** Factor de opacidad 1→0 de la retirada a los 2 s (1 si no aplica). */
  retirada: number
}

export interface CambioEnCurso {
  tipo: 'desplazamiento' | 'fundido'
  inicioMs: number
  duracionMs: number
  avance: number
}

export interface FotogramaLetra {
  titulo: { titulo: string; artista: string } | null
  /** En orden de letra; en reposo como mucho N, durante un cambio N + 1. */
  lineas: LineaEnPantalla[]
  cambio: CambioEnCurso | null
  /** Factor 0→1 del fundido de aparición del bloque tras el título. */
  aparicion: number
  espera: EsperaFotograma | null
  /** 0–1: los indicadores aparecen con el avance de la salida en dos tiempos; 0 si no hay espera. */
  esperaAparicion: number
  /** Derivado con la semántica de 0.2.1: la línea que suena (null en un hueco, también en un relevo). */
  actual: LineaRender | null
  /** Derivado con la semántica de 0.2.1: la siguiente línea con inicio. */
  siguiente: LineaRender | null
  /** Ids visibles en orden: la vista solo vuelve a renderizar React cuando cambia. */
  claveLineas: string
  /**
   * Solo en zonas (`subidaAlSalir`): 1 mientras suena una línea de la zona y 0,55 si no, con el cambio
   * lineal en D (ADR 0029 §4 bis). Ausente fuera de las zonas.
   */
  opacidadZona?: number
}

export type ContextoRender = {
  duracionMs: number
  titulo: string
  artista: string
  espera?: Espera
  /** Ausente = PANTALLA_PREDETERMINADA. */
  pantalla?: Pantalla
  /** Ausente = completo. Con reducido, todas las duraciones valen 0. */
  movimiento?: 'completo' | 'reducido'
  /**
   * Solo para zonas (ADR 0029 §4 bis): sin líneas ya cantadas, el «dos tiempos» dejaría vacío el sitio
   * de la próxima; la salida de una línea y la subida de la siguiente van en un solo cambio, en el fin.
   */
  subidaAlSalir?: boolean
}
/** Solo se usa la lista de líneas: una subsecuencia de una letra da fotogramas independientes. */
type ConLineas = Pick<Letra, 'lineas'>
type LineaConInicio = ElementoLetra & { inicio_ms: number }

/** Estado en reposo del bloque: `a` es la línea activa (ocupado) o la última salida (vacío); −1 = antes de la primera. */
interface Estado {
  a: number
  ocupado: boolean
}
interface Suceso {
  inicio: number
  dur: number
  salida: boolean
  desde: Estado
  hacia: Estado
}
interface Indice {
  lineas: LineaConInicio[]
  fines: number[]
  /** Fin más tardío de las líneas hasta cada una: con voces a la vez, hay silencio solo después de él. */
  finesMax: number[]
  sucesos: Suceso[]
  /** Primera línea de la «frase» de cada línea: tras un hueco de más de RETIRADA_MS no hay ya cantadas anteriores. */
  cortes: number[]
  /** La línea cierra una frase (hueco posterior > RETIRADA_MS o es la última). */
  cierres: boolean[]
  cambioMs: number
  retiradaMs: number
  aparicionMs: number
  pantalla: Pantalla
  pasadas: number
  futuras: number
}

/** Los sucesos se cachean por la lista de líneas recibida (ADR 0029 §4 bis: una zona = una subsecuencia). */
const indices = new WeakMap<Letra['lineas'], Map<string, Indice>>()
const ANTES: Estado = { a: -1, ocupado: false }

export function curvaCambio(x: number): number {
  const c = Math.max(0, Math.min(1, x))
  return 1 - (1 - c) ** 3
}

export function puestoEn(e: Estado, j: number, subidaAlSalir = false): number {
  if (e.ocupado) return j - e.a
  if (subidaAlSalir) return j - e.a - 1
  return j <= e.a ? j - e.a - 1 : j - e.a
}

function duracionEntrada(nominal: number, inicio: number, fin: number): number {
  const d = Math.min(nominal, FRACCION_ENTRADA * Math.max(0, fin - inicio))
  return d < MINIMO_ANIMADO_MS ? 0 : d
}

function construirIndice(
  letra: ConLineas,
  duracionMs: number,
  pantalla: Pantalla,
  reducido: boolean
): Indice {
  const todas = letra.lineas
  // `finEfectivo` busca por id en la lista: se le da solo el trozo hasta la siguiente con inicio (O(1) por línea).
  const siguientes: number[] = new Array(todas.length)
  let proxima = -1
  for (let k = todas.length - 1; k >= 0; k--) {
    siguientes[k] = proxima
    if (todas[k]!.inicio_ms !== null) proxima = k
  }
  const lineas: LineaConInicio[] = []
  const fines: number[] = []
  todas.forEach((linea, k) => {
    if (linea.tipo !== 'linea' || linea.inicio_ms === null) return
    const trozo = todas.slice(k, siguientes[k]! === -1 ? k + 2 : siguientes[k]! + 1)
    lineas.push(linea as LineaConInicio)
    fines.push(Math.max(linea.inicio_ms, finEfectivo({ lineas: trozo }, linea.id, duracionMs)!))
  })
  const nominal = reducido ? 0 : DURACION_CAMBIO_MS[pantalla.transicion]
  const sucesos: Suceso[] = []
  const cortes: number[] = []
  const cierres: boolean[] = []
  let corte = 0
  lineas.forEach((linea, i) => {
    const siguiente = lineas[i + 1]
    const hueco = siguiente ? siguiente.inicio_ms - fines[i]! : Infinity
    if (i > 0 && lineas[i]!.inicio_ms - fines[i - 1]! > RETIRADA_MS) corte = i
    cortes.push(corte)
    cierres.push(hueco > RETIRADA_MS)
    const previo = sucesos.at(-1)
    sucesos.push({
      inicio: linea.inicio_ms,
      dur: duracionEntrada(nominal, linea.inicio_ms, fines[i]!),
      salida: false,
      desde: previo ? previo.hacia : ANTES,
      hacia: { a: i, ocupado: true }
    })
    if (siguiente && hueco < nominal) return // relevo: un solo cambio, en el inicio siguiente
    sucesos.push({
      inicio: fines[i]!,
      dur: nominal,
      salida: true,
      desde: { a: i, ocupado: true },
      hacia: { a: i, ocupado: false }
    })
  })
  const finesMax: number[] = []
  fines.forEach((fin, i) => finesMax.push(Math.max(fin, finesMax[i - 1] ?? -Infinity)))
  return {
    lineas,
    fines,
    finesMax,
    sucesos,
    cortes,
    cierres,
    cambioMs: nominal,
    retiradaMs: reducido ? 0 : FUNDIDO_RETIRADA_MS,
    aparicionMs: reducido ? 0 : APARICION_BLOQUE_MS,
    pantalla,
    pasadas: pasadasEfectivas(pantalla),
    futuras: pantalla.lineas - 1 - pasadasEfectivas(pantalla)
  }
}

function indicePara(letra: ConLineas, duracionMs: number, ctx: ContextoRender): Indice {
  const pantalla = ctx.pantalla ?? PANTALLA_PREDETERMINADA
  const reducido = ctx.movimiento === 'reducido'
  const clave = `${duracionMs}|${pantalla.lineas}|${pasadasEfectivas(pantalla)}|${pantalla.transicion}|${reducido}`
  let porClave = indices.get(letra.lineas)
  if (!porClave) {
    porClave = new Map()
    indices.set(letra.lineas, porClave)
  }
  let indice = porClave.get(clave)
  if (!indice) {
    indice = construirIndice(letra, duracionMs, pantalla, reducido)
    porClave.set(clave, indice)
  }
  return indice
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

function enPantalla(
  linea: LineaConInicio,
  t: number,
  fin: number,
  posicion: Pick<LineaEnPantalla, 'desde' | 'hacia' | 'avance' | 'retirada'>
): LineaEnPantalla {
  const activa = t >= linea.inicio_ms && t < fin
  const base = dibujar(linea, progreso(t, linea.inicio_ms, fin), (p) =>
    progreso(t, p.inicio_ms, p.fin_ms)
  )
  return { ...base, palabras: activa ? base.palabras : null, ...posicion }
}

function vacio(titulo: FotogramaLetra['titulo']): FotogramaLetra {
  return {
    titulo,
    lineas: [],
    cambio: null,
    aparicion: 0,
    espera: null,
    esperaAparicion: 0,
    actual: null,
    siguiente: null,
    claveLineas: ''
  }
}

export function fotogramaEn(
  letra: ConLineas,
  tLetraMs: number,
  ctx: ContextoRender
): FotogramaLetra {
  const { duracionMs, titulo, artista } = ctx
  const indice = indicePara(letra, duracionMs, ctx)
  const { lineas, fines, sucesos, pasadas, futuras } = indice
  const primera = lineas[0]
  if (!primera || tLetraMs < primera.inicio_ms - 4000) {
    return vacio({ titulo, artista })
  }
  const t = tLetraMs

  // Último suceso con inicio <= t (búsqueda binaria).
  let izq = 0
  let der = sucesos.length
  while (izq < der) {
    const centro = (izq + der) >>> 1
    if (sucesos[centro]!.inicio <= t) izq = centro + 1
    else der = centro
  }
  const suceso = sucesos[izq - 1]
  const enCurso = !!suceso && suceso.dur > 0 && t < suceso.inicio + suceso.dur
  const origen = suceso ? (enCurso ? suceso.desde : suceso.hacia) : ANTES
  const destino = suceso ? suceso.hacia : ANTES
  const avance = enCurso ? curvaCambio((t - suceso!.inicio) / suceso!.dur) : 1

  const corte = destino.a >= 0 ? indice.cortes[destino.a]! : 0
  const retiroDe = (e: number) => {
    const sobra = t - fines[e]! - RETIRADA_MS
    if (sobra < 0) return 1
    return indice.retiradaMs === 0 ? 0 : Math.max(0, 1 - sobra / indice.retiradaMs)
  }
  const enRango = (p: number) => p >= -pasadas && p <= futuras
  const salida: LineaEnPantalla[] = []

  // Ya cantadas de la frase anterior que aún se funden (retirada que se solapa con la entrada siguiente).
  if (corte > 0 && pasadas > 0) {
    const e = corte - 1
    const factor = retiroDe(e)
    if (factor > 0) {
      const salidaE: Estado = { a: e, ocupado: false }
      for (let j = Math.max(indice.cortes[e]!, e + 1 - pasadas); j <= e; j++) {
        const p = puestoEn(salidaE, j)
        salida.push(
          enPantalla(lineas[j]!, t, fines[j]!, { desde: p, hacia: p, avance: 1, retirada: factor })
        )
      }
    }
  }

  const subida = !!ctx.subidaAlSalir
  const bajo = (e: Estado) => (e.ocupado ? e.a - pasadas : e.a + 1 - pasadas)
  const alto = (e: Estado) => e.a + futuras + (subida && !e.ocupado ? 1 : 0)
  const cierre = !destino.ocupado && destino.a >= 0 && indice.cierres[destino.a]
  const factorRetirada = cierre ? retiroDe(destino.a) : 1
  for (
    let j = Math.max(corte, Math.min(bajo(origen), bajo(destino))),
      fin = Math.min(lineas.length - 1, Math.max(alto(origen), alto(destino)));
    j <= fin;
    j++
  ) {
    const desde = puestoEn(origen, j, subida)
    const hacia = puestoEn(destino, j, subida)
    if (!enRango(desde) && !enRango(hacia)) continue
    const retirada = cierre && j <= destino.a ? factorRetirada : 1
    if (retirada <= 0) continue
    salida.push(enPantalla(lineas[j]!, t, fines[j]!, { desde, hacia, avance, retirada }))
  }

  let desde = 0
  let hasta = lineas.length
  while (desde < hasta) {
    const centro = (desde + hasta) >>> 1
    if (lineas[centro]!.inicio_ms <= t) desde = centro + 1
    else hasta = centro
  }
  const previaPos = desde - 1
  const previa = lineas[previaPos]
  const sigLinea = lineas[previaPos + 1]
  const fin = previa ? fines[previaPos]! : 0
  const actual = previa && t < fin ? previa : null
  // Voces a la vez (0360): hay un hueco solo cuando ninguna línea suena, aunque la última en empezar ya acabase.
  const finHueco = previa ? indice.finesMax[previaPos]! : -Infinity
  const espera =
    !actual && t >= finHueco && sigLinea
      ? esperaEn(ctx.espera ?? ESPERA_LEGADA, t, previa ? finHueco : null, sigLinea.inicio_ms)
      : null
  const aparicion =
    indice.aparicionMs === 0
      ? 1
      : Math.min(1, Math.max(0, (t - (primera.inicio_ms - 4000)) / indice.aparicionMs))

  return {
    titulo: null,
    lineas: salida,
    cambio:
      enCurso && indice.pantalla.transicion !== 'ninguna'
        ? {
            tipo: indice.pantalla.transicion,
            inicioMs: suceso!.inicio,
            duracionMs: suceso!.dur,
            avance
          }
        : null,
    aparicion,
    espera,
    esperaAparicion: espera ? (enCurso && suceso!.salida ? avance : 1) : 0,
    actual: actual
      ? dibujar(actual, progreso(t, actual.inicio_ms, fin), (p) =>
          progreso(t, p.inicio_ms, p.fin_ms)
        )
      : null,
    siguiente: sigLinea ? dibujar(sigLinea, 0, () => 0) : null,
    claveLineas: salida.map((l) => l.id).join(','),
    ...(subida && { opacidadZona: opacidadDeZona(indice.cambioMs, t, previa, fin) })
  }
}

/** Opacidad de una zona (ADR 0029 §4 bis): 1 suena una línea suya, 0,55 si no; lineal en `D`, instantánea con 0. */
function opacidadDeZona(
  cambioMs: number,
  t: number,
  previa: LineaConInicio | undefined,
  fin: number
): number {
  const baja = ZONA_OPACIDAD_INACTIVA
  if (!previa) return baja
  if (t < fin) {
    const sube = cambioMs === 0 ? 1 : progreso(t, previa.inicio_ms, previa.inicio_ms + cambioMs)
    return baja + (1 - baja) * sube
  }
  const cae = cambioMs === 0 ? 1 : progreso(t, fin, fin + cambioMs)
  return 1 - (1 - baja) * cae
}

export function fotogramaEstatico(
  letra: ConLineas,
  id: string | null,
  pantalla: Pantalla = PANTALLA_PREDETERMINADA,
  /** Zona sin ninguna línea ya cantada: `activa` es si la línea `id` es suya (si no, se ve como próxima). */
  zona?: { activa: boolean }
): FotogramaLetra {
  const medio = zona && !zona.activa ? 0 : 0.5
  const todas = letra.lineas.filter((l) => l.tipo === 'linea')
  const indice =
    id === null
      ? 0
      : Math.max(
          0,
          todas.findIndex((l) => l.id === id)
        )
  const actual = todas[indice]
  const siguiente = todas[indice + 1]
  const mitad = (actual ? (palabrasVisibles(actual)?.length ?? 0) : 0) * medio
  const pasadas = pasadasEfectivas(pantalla)
  const futuras = pantalla.lineas - 1 - pasadas
  const visibles: LineaEnPantalla[] = []
  for (
    let j = Math.max(0, indice - pasadas);
    j <= Math.min(todas.length - 1, indice + futuras);
    j++
  ) {
    if (!actual) break
    const puesto = j - indice
    const linea = dibujar(
      todas[j]!,
      puesto === 0 ? medio : puesto < 0 ? 1 : 0,
      puesto === 0 ? (_p, i) => progreso(mitad, i, i + 1) : () => (puesto < 0 ? 1 : 0)
    )
    visibles.push({
      ...linea,
      palabras: puesto === 0 ? linea.palabras : null,
      desde: puesto,
      hacia: puesto,
      avance: 1,
      retirada: 1
    })
  }
  return {
    titulo: null,
    lineas: visibles,
    cambio: null,
    aparicion: 1,
    espera: null,
    esperaAparicion: 0,
    actual: actual ? dibujar(actual, medio, (_p, i) => progreso(mitad, i, i + 1)) : null,
    siguiente: siguiente ? dibujar(siguiente, 0, () => 0) : null,
    claveLineas: visibles.map((l) => l.id).join(','),
    ...(zona && { opacidadZona: zona.activa ? 1 : ZONA_OPACIDAD_INACTIVA })
  }
}
