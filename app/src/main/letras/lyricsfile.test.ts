import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { leerFixtureLetra } from '../../shared/__fixtures__/letras'
import { validarInvariantesLetra } from '../../shared/letra'
import { convertirLyricsfile, ErrorLyricsfileDemasiadoGrande } from './lyricsfile'

let n = 0
const id = (): string => `id-${n++}`
const conv = (t: string) => convertirLyricsfile(t, id)

describe('convertirLyricsfile', () => {
  it('con palabras: no importa palabras y fija el fin de la línea', () => {
    const r = conv(leerFixtureLetra('con-palabras.lyricsfile.yaml'))!
    expect(validarInvariantesLetra(r)).toEqual([])
    expect(r).toHaveLength(2)
    // end_ms 12500 < siguiente inicio 14000: hueco real -> fijado.
    expect(r[0]).toMatchObject({
      texto: 'Barcos de papel navegan',
      inicio_ms: 10000,
      fin_ms: 12500
    })
    // Ya no se importan tiempos por palabra (ADR 0021 §5).
    expect(r.map((e) => e.palabras)).toEqual([null, null])
    // Última línea sin end_ms de línea ni de su última palabra: fin automático.
    expect(r[1]!.fin_ms).toBeNull()
  })

  it('sin palabras: líneas con inicio y sin fines fijados', () => {
    const r = conv(leerFixtureLetra('sin-palabras.lyricsfile.yaml'))!
    expect(r.map((e) => [e.texto, e.inicio_ms, e.fin_ms, e.palabras])).toEqual([
      ['Luciérnagas sobre el tejado', 12000, null, null],
      ['Cuentan estrellas sin prisa', 16500, null, null],
      ['El viento ordena las nubes', 21000, null, null]
    ])
  })

  const base = (lineas: string, meta = ''): string =>
    `metadata:\n  offset_ms: 0\n${meta}lines:\n${lineas}`

  it('end_ms derivados (= siguiente inicio) no se fijan; un hueco real sí; la última sí', () => {
    const r = conv(
      base(
        `  - {text: "a", start_ms: 1000, end_ms: 2000}\n  - {text: "b", start_ms: 2000, end_ms: 3000}\n  - {text: "c", start_ms: 4000, end_ms: 5000}\n`
      )
    )!
    expect(r.map((e) => e.fin_ms)).toEqual([null, 3000, 5000])
  })

  it('el hueco real fija el fin', () => {
    const r = conv(
      base(`  - {text: "a", start_ms: 1000, end_ms: 1500}\n  - {text: "b", start_ms: 2000}\n`)
    )!
    expect(r.map((e) => e.fin_ms)).toEqual([1500, null])
  })

  it('text vacío es una pausa con tiempo', () => {
    const r = conv(
      base(
        `  - {text: "a", start_ms: 1000}\n  - {text: "", start_ms: 2000}\n  - {text: "b", start_ms: 3000}\n`
      )
    )!
    expect(r.map((e) => [e.tipo, e.inicio_ms])).toEqual([
      ['linea', 1000],
      ['pausa', 2000],
      ['linea', 3000]
    ])
  })

  it('aplica offset_ms con mínimo 0', () => {
    const r = conv(
      `metadata:\n  offset_ms: 1500\nlines:\n  - {text: "a", start_ms: 1000}\n  - {text: "b", start_ms: 4000, end_ms: 5000}\n`
    )!
    expect(r.map((e) => [e.inicio_ms, e.fin_ms])).toEqual([
      [0, null],
      [2500, 3500]
    ])
  })

  it('sin end_ms de línea, el fin sale del end_ms de su última palabra si cumple la regla', () => {
    const r = conv(
      base(
        `  - text: "a b"\n    start_ms: 1000\n    words:\n      - {text: "a ", start_ms: 1000}\n      - {text: "b", start_ms: 1200, end_ms: 1400}\n  - text: "c d"\n    start_ms: 1500\n    words:\n      - {text: "c ", start_ms: 1500}\n      - {text: "d", start_ms: 1700, end_ms: 1500}\n  - text: "e"\n    start_ms: 3000\n    words:\n      - {text: "e", start_ms: 3000}\n`
      )
    )!
    // Fin de la última palabra; fin de palabra no válido (≤ inicio); sin end_ms en ningún lado.
    expect(r.map((e) => [e.fin_ms, e.palabras])).toEqual([
      [1400, null],
      [null, null],
      [null, null]
    ])
  })

  it('lines vacío o instrumental dan []', () => {
    expect(conv('lines: []\n')).toEqual([])
    expect(conv('metadata:\n  instrumental: true\nlines:\n  - {text: "a", start_ms: 1}\n')).toEqual(
      []
    )
  })

  it('YAML roto o estructura no reconocida dan null', () => {
    expect(conv('lines: [\n  - {')).toBeNull()
    expect(conv('hola: 1\n')).toBeNull()
    expect(conv('lines:\n  - {text: "a"}\n')).toBeNull()
    expect(conv('')).toBeNull()
  })

  it('alias en bomba: error controlado (null) y sin colgarse', () => {
    let y = 'a0: &a0 [x, x, x, x, x, x, x, x, x]\n'
    for (let i = 1; i < 9; i++) {
      const p = `*a${i - 1}`
      y += `a${i}: &a${i} [${Array(9).fill(p).join(', ')}]\n`
    }
    y += 'lines: *a8\n'
    const t0 = Date.now()
    expect(conv(y)).toBeNull()
    expect(Date.now() - t0).toBeLessThan(2000)
  })

  it('más de 2 MB lanza error', () => {
    expect(() => conv('#' + 'x'.repeat(2 * 1024 * 1024))).toThrow(ErrorLyricsfileDemasiadoGrande)
  })
})

describe('aislamiento de la dependencia yaml', () => {
  it('nada bajo src/renderer ni src/shared importa yaml', () => {
    const raiz = join(__dirname, '..', '..')
    const hallados: string[] = []
    const recorrer = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, e.name)
        if (e.isDirectory()) recorrer(ruta)
        else if (/\.(ts|tsx|mts|js)$/.test(e.name) && !e.name.includes('lyricsfile.test')) {
          if (
            /from\s+['"]yaml['"]|require\(\s*['"]yaml['"]|import\(\s*['"]yaml['"]/.test(
              readFileSync(ruta, 'utf8')
            )
          )
            hallados.push(ruta)
        }
      }
    }
    recorrer(join(raiz, 'renderer'))
    recorrer(join(raiz, 'shared'))
    expect(hallados).toEqual([])
  })
})
