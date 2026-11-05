import { MAX_ELEMENTOS_LETRA } from '../letrasBusqueda'
import { validarInvariantesLetra, type ElementoLetra, type Palabra } from '../letra'

/** Máximo de texto de entrada (bytes UTF-8) al importar una letra. */
export const MAX_BYTES_LETRA = 512 * 1024

/** La letra supera los límites de importación (ADR 0005). */
export class ErrorLetraDemasiadoGrande extends Error {
  readonly motivo: 'elementos' | 'tamano'
  constructor(motivo: 'elementos' | 'tamano') {
    super(
      motivo === 'elementos'
        ? `La letra tiene más de ${MAX_ELEMENTOS_LETRA} elementos`
        : `La letra ocupa más de ${MAX_BYTES_LETRA / 1024} KB`
    )
    this.name = 'ErrorLetraDemasiadoGrande'
    this.motivo = motivo
  }
}

export function comprobarTamanoTexto(texto: string): void {
  // Un carácter ocupa como mucho 3 bytes en UTF-8 por unidad UTF-16.
  if (texto.length > MAX_BYTES_LETRA || new TextEncoder().encode(texto).length > MAX_BYTES_LETRA) {
    throw new ErrorLetraDemasiadoGrande('tamano')
  }
}

export type GeneradorId = () => string

const generarIdPorDefecto: GeneradorId = () => globalThis.crypto.randomUUID()

/** Quita el BOM inicial y unifica los saltos de línea a `\n`. */
export function limpiarTexto(texto: string): string {
  return texto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

/**
 * Normaliza una lista de elementos para que cumpla `validarInvariantesLetra`
 * (ADR 0005, revisión 2026-11-04). No modifica la entrada. Ver tarea 0078.
 */
export function normalizarLetra(
  entrada: readonly ElementoLetra[],
  generarId: GeneradorId = generarIdPorDefecto
): ElementoLetra[] {
  if (entrada.length > MAX_ELEMENTOS_LETRA) throw new ErrorLetraDemasiadoGrande('elementos')

  // 1. Copia; las líneas sin texto pasan a pausas; las pausas se limpian.
  let els: ElementoLetra[] = entrada.map((e) => {
    const texto = e.texto.trim()
    if (e.tipo === 'pausa' || (texto === '' && !e.palabras?.length)) {
      return {
        id: '',
        tipo: 'pausa',
        texto: '',
        inicio_ms: e.inicio_ms,
        fin_ms: null,
        palabras: null
      }
    }
    return {
      id: '',
      tipo: 'linea',
      texto,
      inicio_ms: e.inicio_ms,
      fin_ms: e.fin_ms,
      palabras: e.palabras ? e.palabras.map((p) => ({ ...p })) : null
    }
  })

  // 2. Fundir pausas seguidas (se conserva el tiempo de la primera que lo tenga).
  const fundidas: ElementoLetra[] = []
  for (const e of els) {
    const previo = fundidas[fundidas.length - 1]
    if (e.tipo === 'pausa' && previo?.tipo === 'pausa') {
      if (previo.inicio_ms === null) previo.inicio_ms = e.inicio_ms
    } else {
      fundidas.push(e)
    }
  }
  // Descartar las del principio y del final.
  while (fundidas[0]?.tipo === 'pausa') fundidas.shift()
  while (fundidas[fundidas.length - 1]?.tipo === 'pausa') fundidas.pop()
  els = fundidas

  // 3. Inicios estrictamente crecientes (el posterior +1 ms, repetido si hace falta).
  let previo: number | null = null
  for (const e of els) {
    if (e.inicio_ms === null) continue
    if (previo !== null && e.inicio_ms <= previo) e.inicio_ms = previo + 1
    previo = e.inicio_ms
  }

  // 4. Fines fijados y palabras, contra el siguiente inicio.
  els.forEach((e, i) => {
    let limite: number | null = null
    for (let k = i + 1; k < els.length; k++) {
      const t = els[k]!.inicio_ms
      if (t !== null) {
        limite = t
        break
      }
    }
    if (e.inicio_ms === null) {
      e.fin_ms = null
      e.palabras = null
      return
    }
    const inicio = e.inicio_ms
    if (e.fin_ms !== null && (e.fin_ms <= inicio || (limite !== null && e.fin_ms > limite))) {
      e.fin_ms = null
    }
    if (e.palabras) e.palabras = depurarPalabras(e.palabras, inicio, limite)
  })

  // 5. Ids nuevos y únicos.
  const usados = new Set<string>()
  for (const e of els) {
    let id = generarId()
    for (let intento = 0; (id === '' || usados.has(id)) && intento < 100; intento++) {
      id = generarId()
    }
    if (id === '' || usados.has(id)) {
      let n = usados.size
      while (usados.has(`${id}-${n}`)) n++
      id = `${id}-${n}`
    }
    usados.add(id)
    e.id = id
  }

  // 6. Red de seguridad: si aun así hay problemas, se quitan todos los tiempos.
  if (validarInvariantesLetra(els).length > 0) {
    for (const e of els) {
      e.inicio_ms = null
      e.fin_ms = null
      e.palabras = null
    }
    return els.filter((e, i) => !(e.tipo === 'pausa' && els[i - 1]?.tipo === 'pausa'))
  }
  return els
}

function depurarPalabras(
  palabras: readonly Palabra[],
  inicioLinea: number,
  limite: number | null
): Palabra[] | null {
  const salida: Palabra[] = []
  let previo = -1
  for (const p of palabras) {
    if (p.texto === '' || p.texto.trim() === '') continue
    const inicio = Math.max(p.inicio_ms, inicioLinea, previo + 1)
    if (limite !== null && inicio >= limite) break
    const fin = limite === null ? p.fin_ms : Math.min(p.fin_ms, limite)
    if (fin <= inicio) continue
    salida.push({ texto: p.texto, inicio_ms: inicio, fin_ms: fin })
    previo = inicio
  }
  return salida.length > 0 ? salida : null
}
