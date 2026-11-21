/**
 * Estiramiento temporal con el tono conservado (WSOLA, ADR 0021 §9).
 * Función pura: bloques de 40 ms que se solapan 8 ms; cada bloque se toma de la entrada
 * en la posición, dentro de ±7,5 ms de la nominal (la del centro del bloque, que reparte el error de ritmo), que mejor continúa el final del anterior
 * (correlación normalizada sobre la mezcla a mono, mismo desplazamiento en todos los canales)
 * y se enlaza con un fundido lineal. La posición nominal avanza con la velocidad, así que no
 * se acumula deriva.
 */

const SECUENCIA_MS = 40
const BUSQUEDA_MS = 15
const SOLAPE_MS = 8

export type VelocidadEstiramiento = 0.5 | 0.75

function aMuestras(ms: number, sampleRate: number): number {
  return Math.max(1, Math.round((ms * sampleRate) / 1000))
}

function mezclaMono(canales: Float32Array[], n: number): Float32Array {
  if (canales.length === 1) return canales[0]!
  const mono = new Float32Array(n)
  for (const canal of canales) for (let i = 0; i < n; i++) mono[i]! += canal[i]!
  const k = 1 / canales.length
  for (let i = 0; i < n; i++) mono[i]! *= k
  return mono
}

/** Media móvil causal de `ancho` muestras: filtro paso bajo barato para la búsqueda gruesa. */
function suavizar(mono: Float32Array, ancho: number): Float32Array {
  const suave = new Float32Array(mono.length)
  let suma = 0
  for (let i = 0; i < mono.length; i++) {
    suma += mono[i]!
    if (i >= ancho) suma -= mono[i - ancho]!
    suave[i] = suma / ancho
  }
  return suave
}

/** Posición de inicio de cada bloque elegido en la entrada. */
function planificar(
  mono: Float32Array,
  sampleRate: number,
  velocidad: number,
  longitudSalida: number
): Int32Array {
  const n = mono.length
  const seq = aMuestras(SECUENCIA_MS, sampleRate)
  const solape = aMuestras(SOLAPE_MS, sampleRate)
  const mitad = Math.floor(aMuestras(BUSQUEDA_MS, sampleRate) / 2)
  const salto = seq - solape
  const paso = sampleRate >= 32000 ? 4 : 2
  const suave = suavizar(mono, paso)
  const maximo = n - seq
  const bloques = Math.ceil(longitudSalida / salto)
  const inicios = new Int32Array(bloques)
  const acotar = (x: number): number => Math.max(0, Math.min(x, maximo))

  // Puntuación = correlación / raíz de la energía del candidato (la de la referencia es común).
  const puntuar = (x: Float32Array, referencia: number, candidato: number, cada: number) => {
    let dot = 0
    let energia = 0
    for (let j = 0; j < solape; j += cada) {
      const v = x[candidato + j]!
      dot += x[referencia + j]! * v
      energia += v * v
    }
    return energia > 1e-12 ? dot / Math.sqrt(energia) : 0
  }

  for (let k = 1; k < bloques; k++) {
    const referencia = inicios[k - 1]! + seq - solape
    const nominal = acotar(Math.round((k * salto + seq / 2) * velocidad - seq / 2))
    const desde = acotar(nominal - mitad)
    const hasta = acotar(nominal + mitad)
    // Búsqueda gruesa sobre la señal suavizada; el nominal gana los empates (silencio, tonos).
    let grueso = nominal
    let mejorPuntos = puntuar(suave, referencia, nominal, paso)
    for (let c = desde; c <= hasta; c += paso) {
      const puntos = puntuar(suave, referencia, c, paso)
      if (puntos > mejorPuntos * (1 + 1e-6) + 1e-12) {
        mejorPuntos = puntos
        grueso = c
      }
    }
    // Refinado a resolución completa alrededor del mejor candidato grueso.
    let mejor = grueso
    let finoPuntos = -Infinity
    for (let c = Math.max(desde, grueso - paso); c <= Math.min(hasta, grueso + paso); c++) {
      const puntos = puntuar(mono, referencia, c, 1)
      if (puntos > finoPuntos) {
        finoPuntos = puntos
        mejor = c
      }
    }
    inicios[k] = mejor
  }
  return inicios
}

/** Respaldo para tramos más cortos que un bloque: interpolación lineal (el tono sí cambia). */
function remuestrear(canal: Float32Array, longitud: number): Float32Array {
  const salida = new Float32Array(longitud)
  const k = canal.length / longitud
  for (let i = 0; i < longitud; i++) {
    const p = i * k
    const a = Math.floor(p)
    const f = p - a
    salida[i] = canal[a]! * (1 - f) + canal[Math.min(a + 1, canal.length - 1)]! * f
  }
  return salida
}

export function estirarTramo(
  canales: Float32Array[],
  sampleRate: number,
  velocidad: VelocidadEstiramiento
): Float32Array[] {
  const n = canales[0]?.length ?? 0
  const longitud = Math.round(n / velocidad)
  if (n === 0) return canales.map(() => new Float32Array(0))
  const seq = aMuestras(SECUENCIA_MS, sampleRate)
  const solape = aMuestras(SOLAPE_MS, sampleRate)
  if (n < 2 * seq) return canales.map((c) => remuestrear(c, longitud))

  const inicios = planificar(mezclaMono(canales, n), sampleRate, velocidad, longitud)
  const salto = seq - solape
  return canales.map((entrada) => {
    const salida = new Float32Array(longitud)
    for (let k = 0; k < inicios.length; k++) {
      const origen = inicios[k]!
      const destino = k * salto
      const total = Math.min(seq, longitud - destino)
      if (total <= 0) break
      const mezcla = k === 0 ? 0 : Math.min(solape, total)
      for (let i = 0; i < mezcla; i++) {
        const w = (i + 0.5) / solape
        salida[destino + i] = salida[destino + i]! * (1 - w) + entrada[origen + i]! * w
      }
      for (let i = mezcla; i < total; i++) salida[destino + i] = entrada[origen + i]!
    }
    return salida
  })
}
