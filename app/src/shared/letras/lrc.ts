import type { ElementoLetra, Letra, Palabra } from '../letra'
import { comprobarTamanoTexto, limpiarTexto, normalizarLetra, type GeneradorId } from './normalizar'

const MARCA_LINEA = /^\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/
const MARCA_PALABRA = /<(\d+):(\d{2})(?:[.:](\d{1,3}))?>/g
const ETIQUETA = /^\[\s*(#|[A-Za-z][\w ]*:)/
const OFFSET = /^\[offset:\s*([+-]?\d+)\s*\]/i
const DURACION_MAXIMA_ULTIMA_PALABRA_MS = 1000

function aMs(m: string, s: string, f: string | undefined): number {
  const frac = f === undefined ? 0 : Number(f.padEnd(3, '0'))
  return Number(m) * 60000 + Number(s) * 1000 + frac
}

/** ¿Parece un LRC? Al menos la mitad de los renglones con texto (sin etiquetas) llevan marca. */
export function esLrc(texto: string): boolean {
  let total = 0
  let conMarca = 0
  for (const r of limpiarTexto(texto).split('\n')) {
    const t = r.trim()
    if (t === '') continue
    if (!MARCA_LINEA.test(t) && ETIQUETA.test(t)) continue
    total++
    if (MARCA_LINEA.test(t)) conMarca++
  }
  return total > 0 && conMarca * 2 >= total
}

export interface ResultadoLrc {
  lineas: ElementoLetra[]
  /** Renglones con texto pero sin marca de tiempo, descartados. */
  ignoradas: number
}

interface Crudo {
  inicio: number
  texto: string
  palabras: Palabra[] | null
  /** Última palabra sin marca de cierre: su fin se resuelve tras ordenar. */
  ultimaAbierta: boolean
}

/** LRC (simple o mejorado) → elementos. Ver ADR 0005 y la tarea 0078. */
export function lrcALetra(texto: string, generarId?: GeneradorId): ResultadoLrc {
  comprobarTamanoTexto(texto)
  const renglones = limpiarTexto(texto).split('\n')
  let offset = 0
  for (const r of renglones) {
    const m = OFFSET.exec(r.trim())
    if (m) offset = Number(m[1])
  }
  const t = (ms: number) => Math.max(0, ms - offset)

  const crudos: Crudo[] = []
  let ignoradas = 0
  for (const bruto of renglones) {
    let resto = bruto.trim()
    if (resto === '') continue
    const marcas: number[] = []
    for (let m = MARCA_LINEA.exec(resto); m; m = MARCA_LINEA.exec(resto)) {
      marcas.push(t(aMs(m[1]!, m[2]!, m[3])))
      resto = resto.slice(m[0].length)
    }
    const { texto: textoLinea, palabras, primera, abierta } = analizarPalabras(resto, t)
    if (marcas.length === 0) {
      if (primera === null) {
        if (!ETIQUETA.test(resto)) ignoradas++
        continue
      }
      marcas.push(primera)
    }
    const inicios = marcas
    inicios.forEach((inicio, k) => {
      crudos.push({
        inicio,
        texto: textoLinea,
        palabras: k === 0 ? palabras : null,
        ultimaAbierta: k === 0 && abierta
      })
    })
  }

  // Orden estable por tiempo.
  crudos.sort((a, b) => a.inicio - b.inicio)

  const els: ElementoLetra[] = crudos.map((c, i) => {
    let palabras = c.palabras
    if (palabras && c.ultimaAbierta) {
      const ultima = palabras[palabras.length - 1]!
      const siguiente = crudos[i + 1]?.inicio
      const fin = Math.min(
        siguiente ?? Infinity,
        ultima.inicio_ms + DURACION_MAXIMA_ULTIMA_PALABRA_MS
      )
      palabras = [...palabras.slice(0, -1), { ...ultima, fin_ms: fin }]
    }
    const esPausa = c.texto === '' && !palabras?.length
    return {
      id: '',
      tipo: esPausa ? 'pausa' : 'linea',
      texto: c.texto,
      inicio_ms: c.inicio,
      fin_ms: null,
      palabras
    }
  })

  // Marca final vacía → fin de la última línea.
  let primeraFinal = els.length
  while (primeraFinal > 0 && els[primeraFinal - 1]!.tipo === 'pausa') primeraFinal--
  if (primeraFinal < els.length && primeraFinal > 0) {
    const ultima = els[primeraFinal - 1]!
    const cierre = els[primeraFinal]!.inicio_ms!
    if (ultima.inicio_ms! < cierre) ultima.fin_ms = cierre
  }

  return { lineas: normalizarLetra(els, generarId), ignoradas }
}

function analizarPalabras(
  resto: string,
  t: (ms: number) => number
): { texto: string; palabras: Palabra[] | null; primera: number | null; abierta: boolean } {
  const marcas = [...resto.matchAll(MARCA_PALABRA)]
  if (marcas.length === 0)
    return { texto: resto.trim(), palabras: null, primera: null, abierta: false }

  const palabras: Palabra[] = []
  let abierta = false
  marcas.forEach((m, k) => {
    const inicio = t(aMs(m[1]!, m[2]!, m[3]))
    const desde = m.index + m[0].length
    const hasta = marcas[k + 1]?.index ?? resto.length
    const tramo = resto.slice(desde, hasta)
    const siguiente = marcas[k + 1]
    const finMarca = siguiente ? t(aMs(siguiente[1]!, siguiente[2]!, siguiente[3])) : null
    if (tramo.trim() === '') return // marca de cierre o palabra vacía
    palabras.push({ texto: tramo, inicio_ms: inicio, fin_ms: finMarca ?? inicio })
    if (finMarca === null) abierta = true
  })
  const texto = palabras
    .map((p) => p.texto)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  return {
    texto,
    palabras: palabras.length > 0 ? palabras : null,
    primera: palabras[0]?.inicio_ms ?? t(aMs(marcas[0]![1]!, marcas[0]![2]!, marcas[0]![3])),
    abierta
  }
}

// ---------------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------------

function formatear(ms: number, abre: string, cierra: string): string {
  const cs = Math.round(ms / 10)
  const min = Math.floor(cs / 6000)
  const seg = Math.floor((cs % 6000) / 100)
  const c = cs % 100
  const p = (n: number) => String(n).padStart(2, '0')
  return `${abre}${p(min)}:${p(seg)}.${p(c)}${cierra}`
}

function exportar(letra: Pick<Letra, 'lineas'>, mejorado: boolean): string {
  const salida: string[] = []
  const lineas = letra.lineas
  lineas.forEach((e, i) => {
    if (e.inicio_ms === null) return
    const marca = formatear(e.inicio_ms, '[', ']')
    if (e.tipo === 'pausa') {
      salida.push(marca)
      return
    }
    if (mejorado && e.palabras && e.palabras.length > 0) {
      const ps = e.palabras
      const cuerpo = ps.map((p) => formatear(p.inicio_ms, '<', '>') + p.texto).join('')
      salida.push(`${marca}${cuerpo}${formatear(ps[ps.length - 1]!.fin_ms, '<', '>')}`)
    } else {
      salida.push(`${marca}${e.texto}`)
    }
    const esUltima = lineas.slice(i + 1).every((x) => x.inicio_ms === null)
    if (esUltima && e.fin_ms !== null) salida.push(formatear(e.fin_ms, '[', ']'))
  })
  return salida.join('\n')
}

/** Letra → LRC simple (pausas con tiempo como marcas vacías; sin las líneas sin tiempo). */
export function letraALrc(letra: Pick<Letra, 'lineas'>): string {
  return exportar(letra, false)
}

/** Letra → LRC mejorado (con marcas `<mm:ss.xx>` por palabra cuando las hay). */
export function letraALrcMejorado(letra: Pick<Letra, 'lineas'>): string {
  return exportar(letra, true)
}
