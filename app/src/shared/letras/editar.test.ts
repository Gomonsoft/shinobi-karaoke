import { describe, expect, it } from 'vitest'
import { letraSchema, type ElementoLetra, type Letra } from '../letra'
import { aplicarTextoEditado, letraATexto } from './index'

const contador = () => {
  let n = 0
  return () => `nuevo${++n}`
}
const lin = (
  id: string,
  texto: string,
  inicio: number | null,
  extra: Partial<ElementoLetra> = {}
) =>
  ({
    id,
    tipo: 'linea',
    texto,
    inicio_ms: inicio,
    fin_ms: null,
    palabras: null,
    ...extra
  }) as ElementoLetra
const pausa = (id: string, inicio: number | null = null): ElementoLetra => ({
  id,
  tipo: 'pausa',
  texto: '',
  inicio_ms: inicio,
  fin_ms: null,
  palabras: null
})
const letraDe = (lineas: ElementoLetra[]): Letra => ({
  origen: 'lrclib',
  lrclib_id: 7,
  offset_ms: -120,
  lineas
})
const base = () =>
  letraDe([
    lin('a', 'Luna roja', 1000, { fin_ms: 2500 }),
    lin('b', 'Sol azul', 3000),
    pausa('p', 5000),
    lin('c', 'Mar de fuego', 6000)
  ])
const ids = (l: Letra) => l.lineas.map((e) => e.id)
const textos = (l: Letra) => l.lineas.map((e) => e.texto)

describe('aplicarTextoEditado', () => {
  it('letraATexto y vuelta dejan la letra igual', () => {
    const l = base()
    expect(letraATexto(l)).toBe('Luna roja\nSol azul\n\nMar de fuego')
    expect(aplicarTextoEditado(l, letraATexto(l), contador())).toEqual(l)
  })

  it('editar una línea del medio la deja sin tiempos con id nuevo', () => {
    const r = aplicarTextoEditado(base(), 'Luna roja\nSol rojo\n\nMar de fuego', contador())
    expect(ids(r).filter((i) => i.startsWith('nuevo'))).toHaveLength(1)
    expect(r.lineas[1]).toMatchObject({ texto: 'Sol rojo', inicio_ms: null, fin_ms: null })
    expect(r.lineas[0]).toMatchObject({ id: 'a', inicio_ms: 1000, fin_ms: 2500 })
    expect(r.lineas[2]).toMatchObject({ id: 'p', inicio_ms: 5000 })
    expect(r.lineas[3]).toMatchObject({ id: 'c', inicio_ms: 6000 })
    expect(r.origen).toBe('lrclib')
    expect(r.lrclib_id).toBe(7)
    expect(r.offset_ms).toBe(-120)
    expect(letraSchema.safeParse(r).success).toBe(true)
  })

  it('inserta, borra y reordena', () => {
    const ins = aplicarTextoEditado(
      base(),
      'Luna roja\nSol azul\nNueva\n\nMar de fuego',
      contador()
    )
    expect(textos(ins)).toEqual(['Luna roja', 'Sol azul', 'Nueva', '', 'Mar de fuego'])
    expect(ids(ins).map((i) => (i.startsWith('nuevo') ? 'N' : i))).toEqual([
      'a',
      'b',
      'N',
      'p',
      'c'
    ])

    const bor = aplicarTextoEditado(base(), 'Luna roja\n\nMar de fuego', contador())
    expect(ids(bor)).toEqual(['a', 'p', 'c'])

    // Reordenar: la LCS conserva una de las dos; la otra pasa a nueva.
    const reo = aplicarTextoEditado(base(), 'Sol azul\nLuna roja\n\nMar de fuego', contador())
    expect(textos(reo)).toEqual(['Sol azul', 'Luna roja', '', 'Mar de fuego'])
    expect(reo.lineas.filter((e) => e.inicio_ms === null)).toHaveLength(1)
    expect(letraSchema.safeParse(reo).success).toBe(true)
  })

  it('estribillo repetido: empareja la primera aparición con la primera', () => {
    const l = letraDe([
      lin('e1', 'La la la', 1000),
      lin('v', 'Verso', 2000),
      lin('e2', 'La la la', 3000)
    ])
    const r = aplicarTextoEditado(l, 'La la la\nVerso\nLa la la!', contador())
    expect(r.lineas.map((e) => [e.id === 'e1' || e.id === 'v', e.inicio_ms])).toEqual([
      [true, 1000],
      [true, 2000],
      [false, null]
    ])
    const r2 = aplicarTextoEditado(l, 'La la la', contador())
    expect(ids(r2)).toEqual(['e1'])
  })

  it('solo cambios de espacios conservan todo', () => {
    const r = aplicarTextoEditado(
      base(),
      '  Luna   roja \nSol  azul\n   \nMar de fuego  ',
      contador()
    )
    expect(ids(r)).toEqual(['a', 'b', 'p', 'c'])
    expect(textos(r)).toEqual(['Luna   roja', 'Sol  azul', '', 'Mar de fuego'])
    expect(r.lineas[0]!.inicio_ms).toBe(1000)
  })

  it('las mayúsculas cuentan como cambio', () => {
    const r = aplicarTextoEditado(base(), 'luna roja\nSol azul\n\nMar de fuego', contador())
    expect(r.lineas[0]!.id).toMatch(/^nuevo/)
    expect(r.lineas[0]!.inicio_ms).toBeNull()
    expect(r.lineas[1]!.id).toBe('b')
  })

  it('borrar todo da cero líneas', () => {
    expect(aplicarTextoEditado(base(), '', contador()).lineas).toEqual([])
    expect(aplicarTextoEditado(base(), '\n  \n', contador()).lineas).toEqual([])
  })

  it('conserva las palabras de la línea emparejada', () => {
    const palabras = [
      { texto: 'Luna ', inicio_ms: 1000, fin_ms: 1500 },
      { texto: 'roja', inicio_ms: 1500, fin_ms: 2000 }
    ]
    const l = letraDe([
      lin('a', 'Luna roja', 1000, { fin_ms: 2200, palabras }),
      lin('b', 'Sol', 3000)
    ])
    const r = aplicarTextoEditado(l, 'Luna roja\nOtra\nSol', contador())
    expect(r.lineas[0]).toMatchObject({ id: 'a', fin_ms: 2200, palabras })
  })

  it('pausa con tiempo conservada y pausas fundidas al borrar la línea que las separa', () => {
    const l = letraDe([
      lin('a', 'Uno', 1000),
      pausa('p1'),
      lin('b', 'Dos', 3000),
      pausa('p2', 4000),
      lin('c', 'Tres', 5000)
    ])
    const r = aplicarTextoEditado(l, 'Uno\n\nTres'.replace('\n\n', '\n\n\n\n'), contador())
    // Dos pausas seguidas se funden; se conserva el tiempo de la primera que lo tenga.
    expect(r.lineas.map((e) => e.tipo)).toEqual(['linea', 'pausa', 'linea'])
    expect(r.lineas[1]!.inicio_ms).toBeNull()
    expect(r.lineas[2]).toMatchObject({ id: 'c', inicio_ms: 5000 })

    const r2 = aplicarTextoEditado(l, 'Uno\n\nDos\n\nTres', contador())
    expect(ids(r2)).toEqual(['a', 'p1', 'b', 'p2', 'c'])
    expect(r2.lineas[3]!.inicio_ms).toBe(4000)

    const r3 = aplicarTextoEditado(
      letraDe([
        lin('a', 'Uno', 1000),
        pausa('p1', 2000),
        lin('b', 'Dos', 3000),
        pausa('p2'),
        lin('c', 'Tres', 5000)
      ]),
      'Uno\n\nTres',
      contador()
    )
    expect(r3.lineas.map((e) => e.id)).toEqual(['a', 'p1', 'c'])
    expect(r3.lineas[1]!.inicio_ms).toBe(2000)
  })

  it('acepta CRLF y trata las marcas [mm:ss] como texto literal', () => {
    const r = aplicarTextoEditado(
      base(),
      'Luna roja\r\nSol azul\r\n\r\nMar de fuego\r\n[00:10.00] Fin',
      contador()
    )
    expect(ids(r).slice(0, 4)).toEqual(['a', 'b', 'p', 'c'])
    expect(r.lineas[4]).toMatchObject({ texto: '[00:10.00] Fin', inicio_ms: null })
  })

  it('no repite ids aunque el generador coincida con uno conservado', () => {
    const r = aplicarTextoEditado(base(), 'Luna roja\nX\n\nMar de fuego', () => 'a')
    expect(new Set(ids(r)).size).toBe(ids(r).length)
    expect(r.lineas[0]!.id).toBe('a')
  })

  it('con 2000 líneas sigue siendo rápido (límites holgados para la CI)', () => {
    const lineas = Array.from({ length: 2000 }, (_, i) => lin(`i${i}`, `Línea ${i}`, i * 100))
    const l = letraDe(lineas)
    const medir = (texto: string) => {
      let n = 0
      const t0 = performance.now()
      const r = aplicarTextoEditado(l, texto, () => `z${n++}`)
      return { ms: performance.now() - t0, r }
    }
    // Edición típica: la poda del prefijo y del sufijo deja un DP minúsculo.
    const tipico = lineas.map((e, i) => (i === 1000 ? 'Editada' : e.texto)).join('\n')
    const a = medir(tipico)
    expect(a.r.lineas).toHaveLength(2000)
    expect(a.r.lineas.filter((e) => e.id.startsWith('i'))).toHaveLength(1999)
    expect(a.ms).toBeLessThan(1000)
    // Peor caso (la mitad de las líneas cambia): LCS O(n·m) completo.
    const peor = lineas.map((e, i) => (i % 2 === 0 ? `${e.texto}!` : e.texto)).join('\n')
    const b = medir(peor)
    expect(b.r.lineas).toHaveLength(2000)
    expect(b.ms).toBeLessThan(3000)
  })
})
