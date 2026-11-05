import { filasDePrevia, marcaDeTiempo } from './modelo'

describe('vista previa', () => {
  it('formatea [mm:ss.x]', () => {
    expect(marcaDeTiempo(0)).toBe('[00:00.0]')
    expect(marcaDeTiempo(4250)).toBe('[00:04.2]')
    expect(marcaDeTiempo(61999)).toBe('[01:01.9]')
  })

  it('las pausas son renglones vacíos y solo las líneas con tiempo llevan marca', () => {
    const f = filasDePrevia([
      { id: 'a', tipo: 'linea', texto: 'uno', inicio_ms: 1000, fin_ms: null, palabras: null },
      { id: 'b', tipo: 'pausa', texto: '', inicio_ms: null, fin_ms: null, palabras: null },
      { id: 'c', tipo: 'linea', texto: 'dos', inicio_ms: null, fin_ms: null, palabras: null }
    ])
    expect(f.map((x) => [x.pausa, x.marca, x.texto])).toEqual([
      [false, '[00:01.0]', 'uno'],
      [true, null, ''],
      [false, null, 'dos']
    ])
  })
})
