import { describe, expect, it } from 'vitest'
import {
  borrarTiemposLinea,
  contarLineas,
  describirElemento,
  finEfectivo,
  letraSchema,
  moverInicioLinea,
  numerosLineasSinInicio,
  validarInvariantesLetra,
  type Letra
} from './letra'
import { letra, letraConPalabras, letraSincronizada, linea, pausa } from './__fixtures__'

const problemas = (l: Letra) => validarInvariantesLetra(l.lineas)

describe('invariantes de la letra', () => {
  it('acepta letras válidas', () => {
    expect(problemas(letraSincronizada())).toEqual([])
    expect(problemas(letraConPalabras())).toEqual([])
    expect(problemas(letra([]))).toEqual([])
    expect(letraSchema.safeParse(letraSincronizada()).success).toBe(true)
  })

  it('acepta líneas sin inicio y pausas con inicio', () => {
    expect(
      problemas(letra([linea('a', 'x', null), pausa('p', 5000), linea('b', 'y', 6000)]))
    ).toEqual([])
  })

  it('rechaza inicios no crecientes (incluidos iguales)', () => {
    expect(problemas(letra([linea('a', 'x', 5000), linea('b', 'y', 4000)]))[0]).toMatch(
      /orden creciente/
    )
    expect(problemas(letra([linea('a', 'x', 5000), linea('b', 'y', 5000)]))).toHaveLength(1)
  })

  it('compara con el elemento anterior que tiene inicio, saltando los que no', () => {
    expect(
      problemas(letra([linea('a', 'x', 5000), linea('b', 'y', null), linea('c', 'z', 4000)]))
    ).toHaveLength(1)
  })

  it('valida fin fijado: inicio < fin ≤ siguiente inicio', () => {
    const ok = letra([linea('a', 'x', 1000, { fin_ms: 2000 }), linea('b', 'y', 2000)])
    expect(problemas(ok)).toEqual([])
    expect(problemas(letra([linea('a', 'x', 1000, { fin_ms: 1000 })]))[0]).toMatch(
      /antes de empezar/
    )
    expect(
      problemas(letra([linea('a', 'x', 1000, { fin_ms: 2001 }), linea('b', 'y', 2000)]))[0]
    ).toMatch(/después del inicio de la siguiente/)
    expect(problemas(letra([linea('a', 'x', null, { fin_ms: 2000 })]))[0]).toMatch(
      /no tiene inicio/
    )
  })

  it('el fin fijado de la última línea no tiene límite superior', () => {
    expect(problemas(letra([linea('a', 'x', 1000, { fin_ms: 999999 })]))).toEqual([])
  })

  it('valida pausas: sin texto, sin palabras, no al principio/final ni consecutivas', () => {
    const conTexto = { ...pausa('p'), texto: 'hola' }
    expect(problemas(letra([linea('a', 'x', 1), conTexto, linea('b', 'y', 2)]))[0]).toMatch(
      /no puede tener texto/
    )
    const conPalabras = { ...pausa('p'), palabras: [{ texto: 'a', inicio_ms: 1, fin_ms: 2 }] }
    expect(problemas(letra([linea('a', 'x', 0), conPalabras, linea('b', 'y', 5)])).join()).toMatch(
      /no puede tener palabras/
    )
    expect(problemas(letra([pausa('p'), linea('a', 'x', 1)]))[0]).toMatch(/empezar con una pausa/)
    expect(problemas(letra([linea('a', 'x', 1), pausa('p')]))[0]).toMatch(/terminar con una pausa/)
    expect(
      problemas(letra([linea('a', 'x', 1), pausa('p'), pausa('q'), linea('b', 'y', 9)]))[0]
    ).toMatch(/dos pausas seguidas/)
  })

  it('rechaza ids repetidos', () => {
    expect(problemas(letra([linea('a', 'x', 1), linea('a', 'y', 2)]))[0]).toMatch(/repetido/)
  })

  describe('palabras', () => {
    const w = (i: number, f: number) => ({ texto: 'w', inicio_ms: i, fin_ms: f })
    it('solo en líneas con inicio', () => {
      expect(problemas(letra([linea('a', 'x', null, { palabras: [w(1, 2)] })]))[0]).toMatch(
        /no tiene inicio/
      )
    })
    it('rechaza lista vacía', () => {
      expect(problemas(letra([linea('a', 'x', 1, { palabras: [] })]))[0]).toMatch(/vacía/)
    })
    it('inicios crecientes e inicio < fin', () => {
      expect(
        problemas(letra([linea('a', 'x', 0, { palabras: [w(10, 20), w(10, 30)] })]))[0]
      ).toMatch(/creciente/)
      expect(problemas(letra([linea('a', 'x', 0, { palabras: [w(10, 10)] })]))[0]).toMatch(
        /termina antes de empezar/
      )
    })
    it('la primera no empieza antes que la línea', () => {
      expect(problemas(letra([linea('a', 'x', 100, { palabras: [w(99, 150)] })]))[0]).toMatch(
        /primera palabra/
      )
      expect(problemas(letra([linea('a', 'x', 100, { palabras: [w(100, 150)] })]))).toEqual([])
    })
    it('la última no pasa del inicio del siguiente elemento con inicio (aunque haya pausa o líneas sin inicio entre medias)', () => {
      const l = letra([
        linea('a', 'x', 100, { palabras: [w(100, 301)] }),
        pausa('p'),
        linea('b', 'y', null),
        linea('c', 'z', 300)
      ])
      expect(problemas(l)[0]).toMatch(/última palabra/)
      l.lineas[0]!.palabras = [w(100, 300)]
      expect(problemas(l)).toEqual([])
    })
  })

  it('el esquema reporta los problemas como issues con mensajes comprensibles', () => {
    const r = letraSchema.safeParse({
      origen: 'manual',
      lrclib_id: null,
      offset_ms: 0,
      lineas: [linea('a', 'Hola', 5), linea('b', 'Adiós', 4)]
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/La línea 2 \(«Adiós»\)/)
  })

  it('describe elementos de forma comprensible', () => {
    const l = letra([pausa('p0'), linea('a', 'x'.repeat(40), 1), pausa('p')])
    expect(describirElemento(l.lineas, 0)).toBe('la pausa del principio')
    expect(describirElemento(l.lineas, 1)).toContain('línea 1')
    expect(describirElemento(l.lineas, 1)).toContain('…')
    expect(describirElemento(l.lineas, 2)).toBe('la pausa tras la línea 1')
  })
})

describe('contarLineas / numerosLineasSinInicio', () => {
  it('excluye pausas y tolera null', () => {
    expect(contarLineas(letraSincronizada())).toBe(4)
    expect(contarLineas(null)).toBe(0)
    expect(contarLineas(undefined)).toBe(0)
    expect(contarLineas(letra([]))).toBe(0)
  })
  it('numera las líneas sin contar pausas', () => {
    const l = letra([linea('a', 'x', null), pausa('p'), linea('b', 'y', 3), linea('c', 'z', null)])
    expect(numerosLineasSinInicio(l)).toEqual([1, 3])
    expect(numerosLineasSinInicio(null)).toEqual([])
  })
})

describe('finEfectivo', () => {
  const D = 215000
  it('devuelve null si no existe o no tiene inicio', () => {
    const l = letra([linea('a', 'x', null)])
    expect(finEfectivo(l, 'a', D)).toBeNull()
    expect(finEfectivo(l, 'zz', D)).toBeNull()
  })
  it('1. fin fijado', () => {
    const l = letra([linea('a', 'x', 1000, { fin_ms: 1500 }), linea('b', 'y', 3000)])
    expect(finEfectivo(l, 'a', D)).toBe(1500)
  })
  it('2. fin de la última palabra', () => {
    expect(finEfectivo(letraConPalabras(), 'l1', D)).toBe(12000)
  })
  it('3. inicio de la pausa siguiente si tiene tiempo', () => {
    const l = letra([linea('a', 'x', 1000), pausa('p', 4000), linea('b', 'y', 9000)])
    expect(finEfectivo(l, 'a', D)).toBe(4000)
  })
  it('4. inicio de la línea siguiente si el hueco es ≤ 8 s', () => {
    expect(finEfectivo(letra([linea('a', 'x', 0), linea('b', 'y', 8000)]), 'a', D)).toBe(8000)
  })
  it('5. hueco > 8 s: inicio + min(hueco, máx(2000, 400 × palabras))', () => {
    const l = letra([linea('a', 'uno dos tres', 0), linea('b', 'y', 8001)])
    expect(finEfectivo(l, 'a', D)).toBe(2000)
    const largo = letra([linea('a', 'a b c d e f g h i j', 0), linea('b', 'y', 20000)])
    expect(finEfectivo(largo, 'a', D)).toBe(4000)
    const corto = letra([linea('a', 'a b c d e f g h i j', 0), linea('b', 'y', 9000)])
    expect(finEfectivo(corto, 'a', D)).toBe(4000)
  })
  it('5. pausa sin tiempo: acota con el hueco al siguiente elemento con inicio', () => {
    const l = letra([linea('a', 'uno', 1000), pausa('p'), linea('b', 'y', 1500)])
    expect(finEfectivo(l, 'a', D)).toBe(1500)
    const l2 = letra([linea('a', 'uno', 1000), pausa('p'), linea('b', 'y', 21000)])
    expect(finEfectivo(l2, 'a', D)).toBe(3000)
  })
  it('línea siguiente sin inicio: usa el siguiente elemento con inicio', () => {
    const l = letra([linea('a', 'uno', 1000), linea('b', 'y', null), linea('c', 'z', 3000)])
    expect(finEfectivo(l, 'a', D)).toBe(3000)
  })
  it('última línea: min(inicio + 5000, duración)', () => {
    expect(finEfectivo(letra([linea('a', 'x', 1000)]), 'a', D)).toBe(6000)
    expect(finEfectivo(letra([linea('a', 'x', 1000)]), 'a', 3000)).toBe(3000)
    expect(finEfectivo(letra([linea('a', 'x', 1000)]), 'a', 500)).toBe(1001)
  })
  it('texto vacío cuenta 0 palabras', () => {
    const l = letra([linea('a', '  ', 0), pausa('p'), linea('b', 'y', 20000)])
    expect(finEfectivo(l, 'a', D)).toBe(2000)
  })
})

describe('moverInicioLinea', () => {
  it('desplaza hacia delante las palabras el mismo delta', () => {
    const r = moverInicioLinea(letraConPalabras(), 'l1', 10500)
    const l1 = r.letra.lineas[0]!
    expect(l1.inicio_ms).toBe(10500)
    expect(l1.palabras!.map((p) => [p.inicio_ms, p.fin_ms])).toEqual([
      [10500, 11000],
      [11100, 11700],
      [11800, 12500]
    ])
    expect(r.palabrasDescartadas).toEqual([])
    expect(problemas(r.letra)).toEqual([])
  })

  it('desplaza hacia atrás las palabras el mismo delta', () => {
    const r = moverInicioLinea(letraConPalabras(), 'l2', 13000)
    expect(r.letra.lineas[1]!.palabras!.map((p) => p.inicio_ms)).toEqual([13000, 13900])
    expect(r.letra.lineas[1]!.palabras![1]!.fin_ms).toBe(14600)
    expect(r.palabrasDescartadas).toEqual([])
    expect(problemas(r.letra)).toEqual([])
  })

  it('no modifica la letra original (pura)', () => {
    const original = letraConPalabras()
    const copia = structuredClone(original)
    moverInicioLinea(original, 'l1', 10500)
    borrarTiemposLinea(original, 'l1')
    expect(original).toEqual(copia)
  })

  it('el límite exacto conserva las palabras; un ms más las descarta (línea movida)', () => {
    // l2 (siguiente con inicio: l3 = 20000). Última palabra termina en 15600 + delta.
    const justo = moverInicioLinea(letraConPalabras(), 'l2', 14000 + (20000 - 15600))
    // nuevo inicio 18400 → última palabra termina en 20000 = límite
    expect(justo.letra.lineas[1]!.palabras).not.toBeNull()
    expect(justo.palabrasDescartadas).toEqual([])
    const pasado = moverInicioLinea(letraConPalabras(), 'l2', 18401)
    expect(pasado.letra.lineas[1]!.palabras).toBeNull()
    expect(pasado.palabrasDescartadas).toEqual(['l2'])
    expect(problemas(pasado.letra)).toEqual([])
  })

  it('descarta las palabras de la línea anterior si ya no caben, en el límite', () => {
    // l1 palabras terminan en 12000; el inicio de l2 pasa de 14000 a 12000 (cabe) y a 11999 (no)
    const justo = moverInicioLinea(letraConPalabras(), 'l2', 12000)
    expect(justo.letra.lineas[0]!.palabras).not.toBeNull()
    expect(justo.palabrasDescartadas).toEqual([])
    const pasado = moverInicioLinea(letraConPalabras(), 'l2', 11999)
    expect(pasado.letra.lineas[0]!.palabras).toBeNull()
    expect(pasado.letra.lineas[1]!.palabras).not.toBeNull()
    expect(pasado.palabrasDescartadas).toEqual(['l1'])
    expect(problemas(pasado.letra)).toEqual([])
  })

  it('línea sin palabras: solo cambia el inicio', () => {
    const r = moverInicioLinea(letraSincronizada(), 'l2', 22000)
    expect(r.letra.lineas[1]).toEqual({ ...letraSincronizada().lineas[1], inicio_ms: 22000 })
    expect(r.palabrasDescartadas).toEqual([])
    expect(r.finesAutomaticos).toEqual([])
  })

  it('línea sin inicio previo: le asigna inicio', () => {
    const l = letra([linea('a', 'x', 1000), linea('b', 'y', null), linea('c', 'z', 5000)])
    const r = moverInicioLinea(l, 'b', 3000)
    expect(r.letra.lineas[1]!.inicio_ms).toBe(3000)
    expect(problemas(r.letra)).toEqual([])
  })

  it('no toca fin_ms si sigue siendo válido', () => {
    const l = letra([linea('a', 'x', 1000, { fin_ms: 1800 }), linea('b', 'y', 3000)])
    const r = moverInicioLinea(l, 'a', 1500)
    expect(r.letra.lineas[0]!.fin_ms).toBe(1800)
    expect(r.finesAutomaticos).toEqual([])
  })

  it('pasa a automático un fin fijado que deja de ser válido (inicio ≥ fin)', () => {
    const l = letra([linea('a', 'x', 1000, { fin_ms: 1800 }), linea('b', 'y', 3000)])
    const r = moverInicioLinea(l, 'a', 1800)
    expect(r.letra.lineas[0]!.fin_ms).toBeNull()
    expect(r.finesAutomaticos).toEqual(['a'])
    expect(problemas(r.letra)).toEqual([])
  })

  it('pasa a automático el fin fijado de la línea anterior si ahora pisa a la movida', () => {
    const l = letra([linea('a', 'x', 1000, { fin_ms: 2800 }), linea('b', 'y', 3000)])
    const r = moverInicioLinea(l, 'b', 2000)
    expect(r.letra.lineas[0]!.fin_ms).toBeNull()
    expect(r.finesAutomaticos).toEqual(['a'])
    const justo = moverInicioLinea(l, 'b', 2800)
    expect(justo.letra.lineas[0]!.fin_ms).toBe(2800)
    expect(justo.finesAutomaticos).toEqual([])
  })

  it('pasa a automático un fin fijado cuando hay una pausa sin tiempo entre líneas', () => {
    const l = letra([linea('a', 'x', 1000, { fin_ms: 1500 }), pausa('p'), linea('b', 'y', 5000)])
    const r = moverInicioLinea(l, 'a', 1500)
    expect(r.letra.lineas[0]!.fin_ms).toBeNull()
  })

  it('lanza RangeError con límites inválidos o id inexistente', () => {
    const l = letraSincronizada()
    expect(() => moverInicioLinea(l, 'nada', 100)).toThrow(RangeError)
    expect(() => moverInicioLinea(l, 'p1', 100)).toThrow(/una línea/)
    expect(() => moverInicioLinea(l, 'l2', -1)).toThrow(/entero/)
    expect(() => moverInicioLinea(l, 'l2', 1.5)).toThrow(/entero/)
    expect(() => moverInicioLinea(l, 'l2', 17000)).toThrow(/posterior/)
    expect(() => moverInicioLinea(l, 'l2', 30000)).toThrow(/anterior/)
    expect(() => moverInicioLinea(l, 'l2', 29999)).not.toThrow()
  })

  it('finEfectivo sigue siendo coherente tras mover', () => {
    const D = 60000
    const l = letraConPalabras()
    for (const [id, nuevo] of [
      ['l1', 9000],
      ['l1', 13000],
      ['l2', 12500],
      ['l2', 18000],
      ['l3', 15700],
      ['l3', 40000]
    ] as const) {
      const r = moverInicioLinea(l, id, nuevo)
      expect(problemas(r.letra)).toEqual([])
      r.letra.lineas.forEach((e, i) => {
        if (e.tipo !== 'linea' || e.inicio_ms === null) return
        const fin = finEfectivo(r.letra, e.id, D)!
        expect(fin).toBeGreaterThan(e.inicio_ms)
        const sig = r.letra.lineas.slice(i + 1).find((x) => x.inicio_ms !== null)
        if (sig) expect(fin).toBeLessThanOrEqual(sig.inicio_ms!)
      })
    }
  })

  it('el fin efectivo cambia con el inicio cuando no hay palabras', () => {
    const l = letra([linea('a', 'x', 1000), linea('b', 'y', 5000)])
    const r = moverInicioLinea(l, 'b', 6000)
    expect(finEfectivo(r.letra, 'a', 60000)).toBe(6000)
  })
})

describe('borrarTiemposLinea', () => {
  it('pone inicio, fin y palabras a null', () => {
    const r = borrarTiemposLinea(letraConPalabras(), 'l1')
    expect(r.lineas[0]).toMatchObject({
      inicio_ms: null,
      fin_ms: null,
      palabras: null,
      texto: 'Hola mundo cruel'
    })
    expect(r.lineas[1]).toEqual(letraConPalabras().lineas[1])
    expect(problemas(r)).toEqual([])
  })
  it('también borra el fin fijado', () => {
    const l = letra([linea('a', 'x', 1000, { fin_ms: 1500 })])
    expect(borrarTiemposLinea(l, 'a').lineas[0]).toMatchObject({ inicio_ms: null, fin_ms: null })
  })
  it('lanza si no existe el id', () => {
    expect(() => borrarTiemposLinea(letraSincronizada(), 'zz')).toThrow(RangeError)
  })
  it('la letra resultante sigue cumpliendo invariantes también al borrar la línea intermedia', () => {
    const r = borrarTiemposLinea(letraConPalabras(), 'l2')
    expect(problemas(r)).toEqual([])
    expect(numerosLineasSinInicio(r)).toEqual([2])
  })
})
