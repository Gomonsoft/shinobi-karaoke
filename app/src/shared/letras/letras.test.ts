import { describe, expect, it } from 'vitest'
import { letraSchema, validarInvariantesLetra, type ElementoLetra } from '../letra'
import {
  ErrorLetraDemasiadoGrande,
  esLrc,
  letraALrc,
  letraALrcMejorado,
  lrcALetra,
  normalizarLetra,
  textoPlanoALetra
} from './index'

const contador = () => {
  let n = 0
  return () => `id${++n}`
}
const el = (p: Partial<ElementoLetra>): ElementoLetra => ({
  id: 'x',
  tipo: 'linea',
  texto: 'a',
  inicio_ms: null,
  fin_ms: null,
  palabras: null,
  ...p
})
const letraDe = (lineas: ElementoLetra[]) => ({
  origen: 'manual' as const,
  lrclib_id: null,
  offset_ms: 0,
  lineas
})
const resumen = (ls: ElementoLetra[]) => ls.map((l) => [l.tipo, l.texto, l.inicio_ms, l.fin_ms])

describe('textoPlanoALetra', () => {
  it('crea líneas sin tiempos, funde pausas y descarta las de los extremos', () => {
    const r = textoPlanoALetra('\n\n  Luna roja  \r\nSol azul\r\r\n  \n\nFin [x2]\n\n', contador())
    expect(resumen(r)).toEqual([
      ['linea', 'Luna roja', null, null],
      ['linea', 'Sol azul', null, null],
      ['pausa', '', null, null],
      ['linea', 'Fin [x2]', null, null]
    ])
    expect(r.map((e) => e.id)).toEqual(['id1', 'id2', 'id3', 'id4'])
  })
  it('solo pausas → cero líneas; texto con BOM', () => {
    expect(textoPlanoALetra('\n \n\n')).toEqual([])
    expect(textoPlanoALetra('﻿Hola')[0]!.texto).toBe('Hola')
  })
  it('rechaza textos demasiado grandes', () => {
    expect(() => textoPlanoALetra('a'.repeat(512 * 1024 + 1))).toThrow(ErrorLetraDemasiadoGrande)
    expect(() => textoPlanoALetra('€'.repeat(200000))).toThrow(/KB/)
    expect(() => textoPlanoALetra('a\n'.repeat(5001))).toThrow(/elementos/)
  })
})

describe('esLrc', () => {
  it('detecta marcas en distintos formatos', () => {
    expect(esLrc('[ti:Canción]\n[00:01.00]a\n[00:02]b')).toBe(true)
    expect(esLrc('[100:01.5]a\n[01:02:50]b\n[00:03.123]c')).toBe(true)
  })
  it('exige la mitad de los renglones', () => {
    expect(esLrc('[00:01.00]a\nb\nc')).toBe(false)
    expect(esLrc('[00:01.00]a\nb')).toBe(true)
    expect(esLrc('[Estribillo]\nhola')).toBe(false)
    expect(esLrc('[ar:x]\n\n')).toBe(false)
    expect(esLrc('')).toBe(false)
  })
})

describe('lrcALetra', () => {
  it('lee marcas, ignora etiquetas y cuenta renglones sin marca', () => {
    const r = lrcALetra(
      '﻿[ar:Nadie]\r\n[ti:Nada]\r\n[00:01.50]Hola\r\nsin marca\r\n[00:03.5]Mundo\r\n#x',
      contador()
    )
    expect(resumen(r.lineas)).toEqual([
      ['linea', 'Hola', 1500, null],
      ['linea', 'Mundo', 3500, null]
    ])
    expect(r.ignoradas).toBe(2)
  })
  it('varias marcas generan copias ordenadas; desordenado', () => {
    const r = lrcALetra('[00:10.00]b\n[00:01.00][00:20.00]a\n[00:05.00]c')
    expect(r.lineas.map((l) => [l.texto, l.inicio_ms])).toEqual([
      ['a', 1000],
      ['c', 5000],
      ['b', 10000],
      ['a', 20000]
    ])
  })
  it('dúo con inicios iguales: +1 ms repetido', () => {
    const r = lrcALetra('[00:01.00]a\n[00:01.00]b\n[00:01.00]c')
    expect(r.lineas.map((l) => l.inicio_ms)).toEqual([1000, 1001, 1002])
    expect(validarInvariantesLetra(r.lineas)).toEqual([])
  })
  it('offset positivo y negativo, con mínimo 0', () => {
    expect(
      lrcALetra('[offset:+500]\n[00:00.20]a\n[00:02.00]b').lineas.map((l) => l.inicio_ms)
    ).toEqual([0, 1500])
    expect(lrcALetra('[00:01.00]a\n[offset: -250]').lineas[0]!.inicio_ms).toBe(1250)
  })
  it('marca final vacía pasa a ser el fin de la última línea', () => {
    const r = lrcALetra('[00:01.00]a\n[00:03.00]b\n[00:05.00]\n[00:09.00]').lineas
    expect(resumen(r)).toEqual([
      ['linea', 'a', 1000, null],
      ['linea', 'b', 3000, 5000]
    ])
  })
  it('marca final vacía no posterior al inicio se descarta sin fin', () => {
    expect(lrcALetra('[00:03.00]b\n[00:03.00]').lineas[0]!.fin_ms).toBeNull()
  })
  it('marca vacía al principio se descarta y en medio es pausa con tiempo', () => {
    const r = lrcALetra('[00:00.00]\n[00:01.00]a\n[00:03.00]\n[00:05.00]b').lineas
    expect(resumen(r)).toEqual([
      ['linea', 'a', 1000, null],
      ['pausa', '', 3000, null],
      ['linea', 'b', 5000, null]
    ])
  })
  it('LRC mejorado: palabras, cierre y fin por defecto', () => {
    const r = lrcALetra(
      '[00:01.00]<00:01.00>Hola <00:01.50>mundo<00:02.20>\n[00:04.00]<00:04.00>Adiós <00:04.30>luna\n[00:08.00]x'
    ).lineas
    expect(r[0]!.texto).toBe('Hola mundo')
    expect(r[0]!.palabras).toEqual([
      { texto: 'Hola ', inicio_ms: 1000, fin_ms: 1500 },
      { texto: 'mundo', inicio_ms: 1500, fin_ms: 2200 }
    ])
    expect(r[1]!.palabras![1]).toEqual({ texto: 'luna', inicio_ms: 4300, fin_ms: 5300 })
  })
  it('LRC mejorado sin marca de línea y con palabras vacías', () => {
    const r = lrcALetra('<00:02.00>Uno <00:02.50> <00:03.00>dos<00:03.50>').lineas
    expect(r[0]!.inicio_ms).toBe(2000)
    expect(r[0]!.texto).toBe('Uno dos')
    expect(r[0]!.palabras).toHaveLength(2)
    expect(lrcALetra('<00:02.00>').lineas).toEqual([])
  })
  it('palabras fuera de su línea se recortan o descartan', () => {
    const r = lrcALetra(
      '[00:02.00]<00:01.00>Antes <00:02.50>medio <00:09.00>tarde<00:10.00>\n[00:04.00]sig'
    ).lineas
    expect(r[0]!.palabras).toEqual([
      { texto: 'Antes ', inicio_ms: 2000, fin_ms: 2500 },
      { texto: 'medio ', inicio_ms: 2500, fin_ms: 4000 }
    ])
  })
  it('varias marcas con palabras: solo la primera copia las conserva', () => {
    const r = lrcALetra('[00:01.00][00:20.00]<00:01.00>a<00:01.50>').lineas
    expect(r[0]!.palabras).toHaveLength(1)
    expect(r[1]!.palabras).toBeNull()
  })
  it('solo pausas → cero líneas', () => {
    expect(lrcALetra('[00:01.00]\n[00:02.00]').lineas).toEqual([])
  })
})

describe('normalizarLetra', () => {
  it('corrige ids, pausas, listas vacías y fines', () => {
    const r = normalizarLetra(
      [
        el({ tipo: 'pausa', texto: 'x', inicio_ms: 1 }),
        el({ texto: ' a ', inicio_ms: 1000, fin_ms: 9999, palabras: [] }),
        el({ tipo: 'pausa', inicio_ms: null }),
        el({ tipo: 'pausa', inicio_ms: 1500 }),
        el({ texto: '', inicio_ms: 2000 }),
        el({ texto: 'b', inicio_ms: 1000, fin_ms: 1500 }),
        el({
          texto: 'c',
          inicio_ms: null,
          fin_ms: 5,
          palabras: [{ texto: 'c', inicio_ms: 1, fin_ms: 2 }]
        }),
        el({ tipo: 'pausa' })
      ],
      contador()
    )
    expect(resumen(r)).toEqual([
      ['linea', 'a', 1000, null],
      ['pausa', '', 1500, null],
      ['linea', 'b', 1501, null],
      ['linea', 'c', null, null]
    ])
    expect(r[3]!.palabras).toBeNull()
    expect(new Set(r.map((e) => e.id)).size).toBe(4)
  })
  it('ids únicos aunque el generador repita', () => {
    const r = normalizarLetra([el({}), el({}), el({})], () => 'dup')
    expect(new Set(r.map((e) => e.id)).size).toBe(3)
    const v = normalizarLetra([el({}), el({})], () => '')
    expect(new Set(v.map((e) => e.id)).size).toBe(2)
    expect(normalizarLetra([el({})])[0]!.id.length).toBeGreaterThan(0)
  })
  it('depura palabras vacías y las que no caben', () => {
    const r = normalizarLetra(
      [
        el({
          inicio_ms: 100,
          palabras: [
            { texto: ' ', inicio_ms: 100, fin_ms: 150 },
            { texto: 'a ', inicio_ms: 50, fin_ms: 200 },
            { texto: 'b ', inicio_ms: 100, fin_ms: 300 },
            { texto: 'c ', inicio_ms: 250, fin_ms: 250 },
            { texto: 'd', inicio_ms: 600, fin_ms: 700 }
          ]
        }),
        el({ texto: 'z', inicio_ms: 500 })
      ],
      contador()
    )
    expect(r[0]!.palabras).toEqual([
      { texto: 'a ', inicio_ms: 100, fin_ms: 200 },
      { texto: 'b ', inicio_ms: 101, fin_ms: 300 }
    ])
  })
  it('rechaza más de 5000 elementos', () => {
    expect(() => normalizarLetra(Array.from({ length: 5001 }, () => el({})))).toThrow(
      ErrorLetraDemasiadoGrande
    )
  })
  it('propiedad: toda salida cumple letraSchema', () => {
    let semilla = 12345
    const azar = (n: number) => {
      semilla = (semilla * 1103515245 + 12345) & 0x7fffffff
      return semilla % n
    }
    const tiempo = () => (azar(4) === 0 ? null : azar(20) * 50)
    for (let ronda = 0; ronda < 300; ronda++) {
      const entrada = Array.from({ length: azar(10) }, () => {
        const inicio = tiempo()
        const ini = inicio ?? 0
        return el({
          tipo: azar(4) === 0 ? 'pausa' : 'linea',
          texto: ['', 'a', ' b '][azar(3)]!,
          inicio_ms: inicio,
          fin_ms: tiempo(),
          palabras:
            azar(2) === 0
              ? null
              : Array.from({ length: azar(4) }, () => ({
                  texto: ['', 'w ', 'x'][azar(3)]!,
                  inicio_ms: ini + azar(10) * 50,
                  fin_ms: ini + azar(10) * 50
                }))
        })
      })
      const salida = normalizarLetra(entrada, contador())
      const r = letraSchema.safeParse(letraDe(salida))
      expect(r.success, JSON.stringify(entrada)).toBe(true)
    }
  })
})

describe('exportación', () => {
  it('ida y vuelta LRC → letra → LRC', () => {
    const lrc = '[00:01.20]Hola\n[00:03.00]\n[01:05.55]Mundo\n[01:08.00]'
    const l = lrcALetra(lrc).lineas
    expect(letraALrc(letraDe(l))).toBe(lrc)
  })
  it('omite líneas sin tiempo', () => {
    expect(letraALrc(letraDe(textoPlanoALetra('a\nb')))).toBe('')
  })
  it('ida y vuelta LRC mejorado', () => {
    const lrc = '[00:01.00]<00:01.00>Hola <00:01.50>mundo<00:02.20>\n[00:04.00]sola'
    const l = lrcALetra(lrc).lineas
    expect(letraALrcMejorado(letraDe(l))).toBe(lrc)
    expect(letraALrc(letraDe(l))).toBe('[00:01.00]Hola mundo\n[00:04.00]sola')
  })
  it('un LRC sin tiempos fallidos produce solo textos si fallan invariantes', () => {
    const r = normalizarLetra(
      [el({ inicio_ms: 5, texto: 'a' }), el({ tipo: 'pausa', inicio_ms: 3 })],
      contador()
    )
    expect(validarInvariantesLetra(r)).toEqual([])
  })
})
