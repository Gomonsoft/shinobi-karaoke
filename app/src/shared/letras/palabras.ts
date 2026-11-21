import {
  DURACION_MINIMA_PALABRA_MS as MIN,
  finEfectivo,
  moverInicioLinea,
  palabrasVisibles,
  tokenizarLinea,
  validarPalabrasManuales,
  type ElementoLetra,
  type Letra
} from '../letra'
import { limitesInicio } from './tiempos'

// Operaciones puras del editor preciso de línea (ADR 0021 §9; spec 06, fase 9).
// Sin DOM ni audio: el borrador se cambia siempre devolviendo una copia nueva y
// todas las operaciones dejan un borrador que cumple las reglas de validez
// (orden, dentro de la línea, sin solapes, ≥ 20 ms por palabra). Tiempos en
// tiempo de letra (sin `offset_ms`).

export interface PalabraBorrador {
  texto: string
  inicio_ms: number
  fin_ms: number
  /** El usuario fijó sus tiempos. Las no marcadas reciben el reparto automático. */
  marcada: boolean
  /**
   * Marcada con pulsación corta: su fin es provisional y lo resuelve la
   * siguiente marca (o el reparto). Se apaga al fijar el fin.
   */
  finAbierto?: boolean
}

export interface BorradorLinea {
  texto: string
  inicio_ms: number
  /** Fin efectivo de la línea. */
  fin_ms: number
  palabras: PalabraBorrador[]
  /** «Quitar los tiempos por palabra»: al aplicar la línea queda sin palabras. */
  quitar: boolean
}

export type LimitePalabra = 'anterior' | 'siguiente' | 'minimo'
export type LimiteLinea = 'editor' | 'linea'

/** Límites de la línea según las reglas del editor (ver `limitesEditorDe`). */
export interface LimitesEditor {
  inicioMin: number
  /** null = sin tope. */
  inicioMax: number | null
  /** Fin máximo: inicio de la siguiente con inicio o duración. */
  finMax: number
}

// ---------------------------------------------------------------------------
// Reparto
// ---------------------------------------------------------------------------

const peso = (texto: string): number => Math.max(1, texto.replace(/\s/g, '').length)

/** Reparte `n` palabras entre `s` y `e`: proporcional a sus caracteres, sin huecos, en ms enteros. */
function cortes(textos: readonly string[], s: number, e: number): number[] {
  const n = textos.length
  const total = e - s
  const pesos = textos.map(peso)
  const suma = pesos.reduce((a, b) => a + b, 0)
  const acumulado: number[] = [0]
  for (const p of pesos) acumulado.push(acumulado[acumulado.length - 1]! + p)

  if (total < MIN * n) return acumulado.map((_, j) => s + Math.round((total * j) / n))
  const directo = acumulado.map((c) => s + Math.round((total * c) / suma))
  if (directo.every((c, j) => j === 0 || c - directo[j - 1]! >= MIN)) return directo
  // Alguna palabra queda por debajo del mínimo: se reparte el sobrante tras garantizarlo.
  const sobrante = total - MIN * n
  return acumulado.map((c, j) => s + MIN * j + Math.round((sobrante * c) / suma))
}

/**
 * Reparte cada tramo de palabras sin marcar seguidas (y, al frente, una marcada
 * con el fin abierto) entre el fin de la marcada anterior o el inicio de la
 * línea y el inicio de la siguiente marcada o el fin de la línea (P5).
 */
export function repartir(borrador: BorradorLinea): BorradorLinea {
  const palabras = borrador.palabras.map((p) => ({ ...p }))
  const n = palabras.length
  let i = 0
  while (i < n) {
    const cabeza = palabras[i]!
    if (cabeza.marcada && !cabeza.finAbierto) {
      i++
      continue
    }
    const s = cabeza.marcada
      ? cabeza.inicio_ms
      : i > 0
        ? palabras[i - 1]!.fin_ms
        : borrador.inicio_ms
    let j = i + 1
    while (j < n && !palabras[j]!.marcada) j++
    const e = j < n ? palabras[j]!.inicio_ms : borrador.fin_ms
    const c = cortes(
      palabras.slice(i, j).map((p) => p.texto),
      s,
      e
    )
    for (let k = i; k < j; k++) {
      palabras[k]!.inicio_ms = c[k - i]!
      palabras[k]!.fin_ms = c[k - i + 1]!
    }
    i = j
  }
  return { ...borrador, palabras }
}

/** ¿Alguna palabra sin marcar se queda sin sitio (< 20 ms por palabra en su tramo)? Desmarca la marcada vecina hasta que quepan. */
function normalizar(borrador: BorradorLinea): BorradorLinea {
  const palabras = borrador.palabras.map((p) => ({ ...p }))
  const n = palabras.length
  for (let intentos = 0; intentos <= 2 * n + 2; intentos++) {
    let arreglado = true
    let i = 0
    while (i < n) {
      const cabeza = palabras[i]!
      if (cabeza.marcada && !cabeza.finAbierto) {
        i++
        continue
      }
      let j = i + 1
      while (j < n && !palabras[j]!.marcada) j++
      const s = cabeza.marcada
        ? cabeza.inicio_ms
        : i > 0
          ? palabras[i - 1]!.fin_ms
          : borrador.inicio_ms
      const e = j < n ? palabras[j]!.inicio_ms : borrador.fin_ms
      if (e - s < MIN * (j - i)) {
        // Primero se recorta el fin de la marcada anterior para hacer sitio.
        const previa = !cabeza.marcada && i > 0 ? palabras[i - 1]! : null
        if (previa && !previa.finAbierto) {
          const fin = Math.max(previa.inicio_ms + MIN, e - MIN * (j - i))
          if (fin < previa.fin_ms) {
            previa.fin_ms = fin
            arreglado = false
            i = j
            continue
          }
        }
        if (cabeza.marcada) {
          cabeza.marcada = false
          cabeza.finAbierto = false
          arreglado = false
          i = j
          continue
        }
        const vecina = j < n ? palabras[j]! : i > 0 ? palabras[i - 1]! : null
        if (vecina) {
          vecina.marcada = false
          vecina.finAbierto = false
          arreglado = false
        }
      }
      i = j
    }
    if (arreglado) break
  }
  return repartir({ ...borrador, palabras })
}

/** Problemas del borrador según las reglas de validez (vacío si es válido). */
export function validarBorrador(borrador: BorradorLinea): string[] {
  return validarPalabrasManuales(
    {
      texto: borrador.texto,
      inicio_ms: borrador.inicio_ms,
      palabras: borrador.palabras.map(({ texto, inicio_ms, fin_ms }) => ({
        texto,
        inicio_ms,
        fin_ms
      }))
    },
    borrador.fin_ms
  )
}

/** Devuelve `candidato` si es válido y, si no, `original` (garantía de las operaciones). */
function seValido(original: BorradorLinea, candidato: BorradorLinea): BorradorLinea {
  return validarBorrador(candidato).length === 0 ? candidato : original
}

// ---------------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------------

export interface BorradorCargado {
  borrador: BorradorLinea
  /** Había palabras hechas a mano que no cumplen las reglas (`edi.preciso.cargadasInvalidas`, P21). */
  invalidas: boolean
}

/**
 * Borrador de una línea con inicio. Palabras hechas a mano válidas: todas marcadas.
 * Si no (sin palabras, importadas o manuales no válidas): todas sin marcar con el reparto.
 */
export function cargarBorrador(letra: Letra, id: string, duracionMs: number): BorradorCargado {
  const el = letra.lineas.find((e) => e.id === id)
  if (!el || el.tipo !== 'linea') throw new RangeError(`No existe la línea «${id}»`)
  if (el.inicio_ms === null) throw new RangeError('La línea no tiene inicio')
  const i = letra.lineas.indexOf(el)
  const siguiente = letra.lineas.slice(i + 1).find((e) => e.inicio_ms !== null)
  const visibles = palabrasVisibles(el, siguiente?.inicio_ms ?? null)
  const fin = finEfectivo(letra, id, duracionMs) ?? el.inicio_ms + 1
  const base = { texto: el.texto, inicio_ms: el.inicio_ms, fin_ms: fin, quitar: false }

  if (visibles) {
    return {
      borrador: {
        ...base,
        palabras: visibles.map((p) => ({ ...p, marcada: true, finAbierto: false }))
      },
      invalidas: false
    }
  }
  return {
    borrador: repartirDeNuevo({ ...base, palabras: [] }),
    invalidas: el.origen_palabras === 'manual' && el.palabras !== null
  }
}

function sinMarcar(texto: string): PalabraBorrador[] {
  return tokenizarLinea(texto).map((t) => ({
    texto: t,
    inicio_ms: 0,
    fin_ms: 0,
    marcada: false,
    finAbierto: false
  }))
}

/** Todas las palabras vuelven a «sin marcar» con el reparto automático (también tras quitar). */
export function repartirDeNuevo(borrador: BorradorLinea): BorradorLinea {
  return repartir({ ...borrador, palabras: sinMarcar(borrador.texto), quitar: false })
}

/** «Quitar los tiempos por palabra»: el borrador queda sin palabras hechas a mano. */
export function quitarPalabras(borrador: BorradorLinea): BorradorLinea {
  return { ...repartirDeNuevo(borrador), quitar: true }
}

// ---------------------------------------------------------------------------
// Marcar al vuelo
// ---------------------------------------------------------------------------

export interface ResultadoMarca {
  borrador: BorradorLinea
  /** Palabra que pasa a estar seleccionada. */
  siguiente: number
  /** null = marcada. «fuera»: en el margen o sin sitio para el resto; «pronto»: antes de lo posible. */
  motivo: null | 'pronto' | 'fuera'
}

function marcadaAnterior(palabras: readonly PalabraBorrador[], k: number): number {
  for (let j = k - 1; j >= 0; j--) if (palabras[j]!.marcada) return j
  return -1
}

function marcadaPosterior(palabras: readonly PalabraBorrador[], k: number): number {
  for (let j = k + 1; j < palabras.length; j++) if (palabras[j]!.marcada) return j
  return palabras.length
}

/**
 * Marca el inicio de la palabra `k` en `ms`: recorta el fin de la anterior y
 * pasan a sin marcar las posteriores que ya no caben. El fin queda abierto
 * (lo resuelve la siguiente marca, `finAlSoltar` o el reparto).
 */
export function marcarAlVuelo(borrador: BorradorLinea, k: number, ms: number): ResultadoMarca {
  const n = borrador.palabras.length
  const mismo = { borrador, siguiente: Math.min(k + 1, n - 1) }
  if (k < 0 || k >= n) return { ...mismo, motivo: 'fuera' }
  if (ms < borrador.inicio_ms || ms >= borrador.fin_ms || ms + MIN * (n - k) > borrador.fin_ms) {
    return { ...mismo, motivo: 'fuera' }
  }
  const j = marcadaAnterior(borrador.palabras, k)
  const sinMarcarAntes = k - j - 1
  const minimo =
    (j >= 0 ? borrador.palabras[j]!.inicio_ms + MIN : borrador.inicio_ms) + MIN * sinMarcarAntes
  if (ms < minimo) return { ...mismo, motivo: 'pronto' }

  const palabras = borrador.palabras.map((p) => ({ ...p }))
  if (j >= 0) {
    const previa = palabras[j]!
    if (previa.finAbierto && sinMarcarAntes === 0) {
      previa.fin_ms = ms
      previa.finAbierto = false
    } else if (!previa.finAbierto) {
      previa.fin_ms = Math.min(previa.fin_ms, ms - MIN * sinMarcarAntes)
    }
  }
  palabras[k] = { ...palabras[k]!, inicio_ms: ms, marcada: true, finAbierto: true }
  for (let m = k + 1; m < n; m++) {
    const p = palabras[m]!
    if (p.marcada && p.inicio_ms < ms + MIN * (m - k)) {
      palabras[m] = { ...p, marcada: false, finAbierto: false }
    }
  }
  const resultado = seValido(borrador, normalizar({ ...borrador, palabras, quitar: false }))
  return resultado === borrador
    ? { ...mismo, motivo: 'pronto' }
    : { borrador: resultado, siguiente: Math.min(k + 1, n - 1), motivo: null }
}

/** Fija el fin de la palabra `k` (pulsación mantenida), limitado por la siguiente marcada y el fin de la línea. */
export function finAlSoltar(borrador: BorradorLinea, k: number, ms: number): BorradorLinea {
  const p = borrador.palabras[k]
  if (!p || !p.marcada) return borrador
  const m = marcadaPosterior(borrador.palabras, k)
  const tope = m < borrador.palabras.length ? borrador.palabras[m]!.inicio_ms : borrador.fin_ms
  const maximo = tope - MIN * (m - k - 1)
  const fin = Math.min(Math.max(ms, p.inicio_ms + MIN), maximo)
  const palabras = borrador.palabras.map((q, i) =>
    i === k ? { ...q, fin_ms: fin, finAbierto: false } : { ...q }
  )
  return seValido(borrador, normalizar({ ...borrador, palabras, quitar: false }))
}

// ---------------------------------------------------------------------------
// Tiradores, campos y teclado
// ---------------------------------------------------------------------------

export interface ResultadoMover {
  borrador: BorradorLinea
  /** Límite alcanzado (el valor se detuvo ahí), para `edi.preciso.limite.*`. */
  limite: LimitePalabra | null
}

/**
 * Mueve el inicio o el fin de la palabra `k` a `ms` y la marca. Se detiene en el
 * último valor válido (entre el fin de la marcada anterior o el inicio de la
 * línea y el inicio de la marcada siguiente o el fin de la línea, con 20 ms por
 * palabra). Las sin marcar vecinas se reparten de nuevo.
 */
export function moverPalabra(
  borrador: BorradorLinea,
  k: number,
  campo: 'inicio' | 'fin',
  ms: number
): ResultadoMover {
  const palabras = borrador.palabras
  const p = palabras[k]
  if (!p) return { borrador, limite: null }
  const a = marcadaAnterior(palabras, k)
  const m = marcadaPosterior(palabras, k)
  const previa = palabras[a]
  const piso = previa
    ? previa.finAbierto
      ? previa.inicio_ms + MIN
      : previa.fin_ms
    : borrador.inicio_ms
  const bajo = piso + MIN * (k - a - 1)
  const tope = m < palabras.length ? palabras[m]!.inicio_ms : borrador.fin_ms
  const alto = tope - MIN * (m - k - 1)
  const cerrada = p.marcada && !p.finAbierto

  let valor = Math.round(ms)
  let limite: LimitePalabra | null = null
  let fin = p.fin_ms
  if (campo === 'inicio') {
    const maximo = cerrada ? p.fin_ms - MIN : alto - MIN
    if (valor < bajo) [valor, limite] = [bajo, 'anterior']
    else if (valor > maximo) [valor, limite] = [maximo, cerrada ? 'minimo' : 'siguiente']
    if (!cerrada) fin = Math.max(p.fin_ms, valor + MIN)
  } else {
    const minimo = p.inicio_ms + MIN
    if (valor < minimo) [valor, limite] = [minimo, 'minimo']
    else if (valor > alto) [valor, limite] = [alto, 'siguiente']
    fin = valor
  }
  if (bajo > alto - MIN) return { borrador, limite }

  const nuevas = palabras.map((q, i) =>
    i === k
      ? {
          ...q,
          inicio_ms: campo === 'inicio' ? valor : q.inicio_ms,
          fin_ms: fin,
          marcada: true,
          finAbierto: false
        }
      : { ...q }
  )
  const resultado = seValido(borrador, repartir({ ...borrador, palabras: nuevas, quitar: false }))
  return { borrador: resultado, limite }
}

/** Alt/Ctrl + flechas: como `moverPalabra` desde el valor actual. */
export function ajustarPalabra(
  borrador: BorradorLinea,
  k: number,
  campo: 'inicio' | 'fin',
  deltaMs: number
): ResultadoMover {
  const p = borrador.palabras[k]
  if (!p) return { borrador, limite: null }
  return moverPalabra(borrador, k, campo, (campo === 'inicio' ? p.inicio_ms : p.fin_ms) + deltaMs)
}

// ---------------------------------------------------------------------------
// Límites de la línea
// ---------------------------------------------------------------------------

/** Límites de la línea para la ventana: `limitesInicio` y fin ≤ inicio de la siguiente (o la duración). */
export function limitesEditorDe(letra: Letra, id: string, duracionMs: number): LimitesEditor {
  const { min, max } = limitesInicio(letra, id)
  return { inicioMin: min, inicioMax: max, finMax: max === null ? duracionMs : max + 1 }
}

export interface ResultadoLimiteLinea {
  borrador: BorradorLinea
  /** «editor»: reglas del editor (vecinos, duración); «linea»: cortaría una palabra marcada. */
  limite: LimiteLinea | null
}

/**
 * Mueve el inicio o el fin de la línea dentro de las reglas del editor y sin
 * cruzar la primera o la última palabra marcada. Las sin marcar se reparten (P10).
 */
export function moverLimiteLinea(
  borrador: BorradorLinea,
  campo: 'inicio' | 'fin',
  ms: number,
  limites: LimitesEditor
): ResultadoLimiteLinea {
  const palabras = borrador.palabras
  const n = palabras.length
  const primera = palabras.findIndex((p) => p.marcada)
  const ultima = palabras.findLastIndex((p) => p.marcada)
  let valor = Math.round(ms)
  let limite: LimiteLinea | null = null

  if (campo === 'inicio') {
    const bajo = limites.inicioMin
    const porPalabras =
      primera >= 0
        ? palabras[primera]!.inicio_ms - MIN * primera
        : borrador.fin_ms - Math.max(MIN * n, 1)
    const alto = Math.min(limites.inicioMax ?? Infinity, porPalabras)
    if (valor < bajo) [valor, limite] = [bajo, 'editor']
    else if (valor > alto) {
      valor = alto
      limite = (limites.inicioMax ?? Infinity) <= porPalabras ? 'editor' : 'linea'
    }
    if (valor === borrador.inicio_ms) return { borrador, limite }
    return {
      borrador: seValido(borrador, repartir({ ...borrador, inicio_ms: valor })),
      limite
    }
  }

  const ultimaMarcada = palabras[ultima]
  const bajo = ultimaMarcada
    ? (ultimaMarcada.finAbierto ? ultimaMarcada.inicio_ms + MIN : ultimaMarcada.fin_ms) +
      MIN * (n - 1 - ultima)
    : borrador.inicio_ms + Math.max(MIN * n, 1)
  const alto = limites.finMax
  if (valor < bajo)
    [valor, limite] = [bajo, bajo > borrador.inicio_ms + Math.max(MIN * n, 1) ? 'linea' : 'editor']
  else if (valor > alto) [valor, limite] = [alto, 'editor']
  if (valor === borrador.fin_ms) return { borrador, limite }
  return { borrador: seValido(borrador, repartir({ ...borrador, fin_ms: valor })), limite }
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

/** Pares [antigua, nueva] de la subsecuencia común más larga por igualdad de texto. */
function emparejar(antiguas: readonly string[], nuevas: readonly string[]): [number, number][] {
  const filas = antiguas.length
  const columnas = nuevas.length
  const tabla = Array.from({ length: filas + 1 }, () => new Array<number>(columnas + 1).fill(0))
  for (let i = filas - 1; i >= 0; i--) {
    for (let j = columnas - 1; j >= 0; j--) {
      tabla[i]![j] =
        antiguas[i] === nuevas[j]
          ? tabla[i + 1]![j + 1]! + 1
          : Math.max(tabla[i + 1]![j]!, tabla[i]![j + 1]!)
    }
  }
  const pares: [number, number][] = []
  let i = 0
  let j = 0
  while (i < filas && j < columnas) {
    if (antiguas[i] === nuevas[j]) pares.push([i++, j++])
    else if (tabla[i + 1]![j]! >= tabla[i]![j + 1]!) i++
    else j++
  }
  return pares
}

export interface ResultadoTexto {
  borrador: BorradorLinea
  /** Palabras nuevas o cambiadas que quedan sin marcar y repartidas (`edi.preciso.texto.repartidas`). */
  repartidas: number
}

/**
 * Cambia el texto de la línea. Mismo número de palabras: cada una conserva los
 * tiempos y el estado de su posición. Distinto: se emparejan por igualdad de
 * texto y orden (LCS); las emparejadas conservan, las nuevas quedan sin marcar (P11).
 */
export function reaplicarTexto(borrador: BorradorLinea, textoNuevo: string): ResultadoTexto {
  const texto = textoNuevo.trim()
  const tokens = tokenizarLinea(texto)
  if (tokens.length === 0) return { borrador, repartidas: 0 }

  if (tokens.length === borrador.palabras.length) {
    const palabras = borrador.palabras.map((p, i) => ({ ...p, texto: tokens[i]! }))
    return { borrador: { ...borrador, texto, palabras }, repartidas: 0 }
  }
  const pares = emparejar(
    borrador.palabras.map((p) => p.texto),
    tokens
  )
  const deNueva = new Map(pares.map(([antigua, nueva]) => [nueva, antigua]))
  const palabras: PalabraBorrador[] = tokens.map((t, j) => {
    const antigua = deNueva.get(j)
    return antigua === undefined
      ? { texto: t, inicio_ms: 0, fin_ms: 0, marcada: false, finAbierto: false }
      : { ...borrador.palabras[antigua]! }
  })
  // Una nueva entre dos marcadas toma como provisional el inicio de la siguiente para no desordenar.
  const resultado = normalizar({ ...borrador, texto, palabras })
  return { borrador: resultado, repartidas: tokens.length - pares.length }
}

// ---------------------------------------------------------------------------
// Aplicar
// ---------------------------------------------------------------------------

/**
 * Escribe el borrador en la letra: texto, inicio (las vecinas se tratan con
 * `moverInicioLinea`, pero las palabras propias no se descartan), fin y palabras
 * con `origen_palabras: "manual"`, o ninguna si `quitar`. Si quedan palabras y
 * el fin era automático, el fin se fija (P13). Lanza RangeError si el borrador
 * incumple las reglas de validez o los límites del editor.
 */
export function aplicarEdicionPrecisa(
  letra: Letra,
  id: string,
  borrador: BorradorLinea,
  duracionMs: number
): Letra {
  const original = letra.lineas.find((e) => e.id === id)
  if (!original || original.tipo !== 'linea') throw new RangeError(`No existe la línea «${id}»`)
  const finOriginal = finEfectivo(letra, id, duracionMs)
  const repartido = repartir(borrador)
  const conPalabras = !repartido.quitar && repartido.palabras.length > 0
  if (conPalabras) {
    const problemas = validarBorrador(repartido)
    if (problemas.length > 0) throw new RangeError(problemas[0])
  }

  const movida =
    original.inicio_ms === repartido.inicio_ms
      ? letra
      : moverInicioLinea(letra, id, repartido.inicio_ms).letra
  const propia = movida.lineas.find((e) => e.id === id)!

  const fijarFin = conPalabras || original.fin_ms !== null || repartido.fin_ms !== finOriginal
  const nueva: ElementoLetra = {
    ...propia,
    texto: repartido.texto,
    inicio_ms: repartido.inicio_ms,
    fin_ms: fijarFin ? repartido.fin_ms : null,
    palabras: conPalabras
      ? repartido.palabras.map(({ texto, inicio_ms, fin_ms }) => ({ texto, inicio_ms, fin_ms }))
      : null,
    origen_palabras: conPalabras ? 'manual' : undefined
  }
  if (!conPalabras) delete nueva.origen_palabras
  return { ...movida, lineas: movida.lineas.map((e) => (e.id === id ? nueva : e)) }
}
