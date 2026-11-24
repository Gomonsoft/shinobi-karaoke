import { describe, expect, it } from 'vitest'
import { finEfectivo, type ElementoLetra } from '../letra'
import { exportarLrc, lrcALetra } from './index'

const el = (id: string, texto: string, inicio: number | null, p: Partial<ElementoLetra> = {}) =>
  ({
    id,
    tipo: 'linea',
    texto,
    inicio_ms: inicio,
    fin_ms: null,
    palabras: null,
    ...p
  }) as ElementoLetra
const pausa = (id: string, inicio: number | null): ElementoLetra =>
  el(id, '', inicio, { tipo: 'pausa' })
const letra = (lineas: ElementoLetra[], offset_ms = 0) => ({ lineas, offset_ms })
const datos = { titulo: 'Canción inventada', artista: 'Nadie', album: null, duracionMs: 125_000 }

describe('exportarLrc', () => {
  it('cabecera, marcas por línea y marca vacía solo con huecos de 2 s o más y al final', () => {
    const texto = exportarLrc(
      letra([
        el('a', 'Luna roja', 1000, { fin_ms: 2000 }), // hueco 1 s hasta la siguiente: sin marca
        el('b', 'Sol azul', 3000, { fin_ms: 4000 }), // hueco 3 s: marca vacía
        el('c', 'Fin del canto', 7000, { fin_ms: 9500 }) // última: marca vacía
      ]),
      { ...datos, album: 'Álbum de prueba' }
    )
    expect(texto).toBe(
      [
        '[ti:Canción inventada]',
        '[ar:Nadie]',
        '[al:Álbum de prueba]',
        '[length:02:05]',
        '[re:Shinobi Karaoke]',
        '[00:01.00]Luna roja',
        '[00:03.00]Sol azul',
        '[00:04.00]',
        '[00:07.00]Fin del canto',
        '[00:09.50]',
        ''
      ].join('\n')
    )
    expect(texto.startsWith('﻿')).toBe(false)
    expect(texto).not.toContain('\r')
  })

  it('aplica offset_ms (sin escribir [offset:]), omite líneas sin inicio y no escribe pausas aparte', () => {
    const texto = exportarLrc(
      letra(
        [
          el('a', 'Primera', 1000, { fin_ms: 1500 }),
          pausa('p', 1500),
          el('b', 'Sin tiempo', null),
          el('c', 'Tercera', 2000, { fin_ms: 2500 })
        ],
        250
      ),
      datos
    )
    expect(texto).not.toContain('offset')
    expect(texto.split('\n').slice(4)).toEqual([
      '[00:01.25]Primera',
      '[00:02.25]Tercera',
      '[00:02.75]',
      ''
    ])
  })

  it('un título con corchetes o saltos no rompe la cabecera', () => {
    const texto = exportarLrc(letra([]), { ...datos, titulo: 'A]\n[B' })
    expect(texto.split('\n')[0]).toBe('[ti:A [B]')
  })

  it('ida y vuelta con el importador: mismos inicios (±10 ms) y fines recuperados en huecos de 2 s o más', () => {
    const origen = letra([
      el('a', 'Luna roja', 1234, { fin_ms: 2000 }),
      el('b', 'Sol azul', 2345, { fin_ms: 4100 }), // hueco 2,9 s: el fin viaja
      el('c', 'Mar sin nombre', 7000, { fin_ms: 7800 }), // hueco 0,2 s: vuelve a automático
      el('d', 'Fin', 8000, { fin_ms: 9990 }) // última: marca final
    ])
    const { lineas, ignoradas } = lrcALetra(exportarLrc(origen, datos))
    expect(ignoradas).toBe(0)
    const dibujadas = lineas.filter((e) => e.tipo === 'linea')
    expect(dibujadas.map((e) => e.texto)).toEqual([
      'Luna roja',
      'Sol azul',
      'Mar sin nombre',
      'Fin'
    ])
    dibujadas.forEach((e, i) =>
      expect(Math.abs(e.inicio_ms! - origen.lineas[i]!.inicio_ms!)).toBeLessThanOrEqual(10)
    )
    const fin = (i: number) => finEfectivo({ lineas }, dibujadas[i]!.id, 125_000)!
    expect(Math.abs(fin(1) - 4100)).toBeLessThanOrEqual(10)
    expect(Math.abs(fin(3) - 9990)).toBeLessThanOrEqual(10)
    // El fin de «Mar sin nombre» (hueco menor de 2 s) no viaja: vuelve a ser automático.
    expect(dibujadas[2]!.fin_ms).toBeNull()
  })
})

describe('exportarLrc con reparto (0.2.3)', () => {
  const con = letra([
    el('a', 'Cruza el faro', 1000, { fin_ms: 2000 }),
    el('b', 'Eco de la plaza', 3000, { parte: 'coro', fin_ms: 4000 }),
    el('c', '(Ah, ah)', 5000, { parte: 'coro', fin_ms: 6000 }),
    el('d', 'Responde el viento', 7000, { parte: 'c2', fin_ms: 8000 })
  ])

  it('los coros salen entre paréntesis sin duplicarlos y no se escribe ninguna parte', () => {
    const texto = exportarLrc(con, datos)
    expect(texto).toContain('[00:03.00](Eco de la plaza)')
    expect(texto).toContain('[00:05.00](Ah, ah)\n')
    expect(texto).not.toContain('((')
    expect(texto).toContain('[00:07.00]Responde el viento')
  })

  it('ida y vuelta: al importar, los coros quedan entre paréntesis y el resto igual', () => {
    const vuelta = lrcALetra(exportarLrc(con, datos)).lineas.filter((l) => l.tipo === 'linea')
    expect(vuelta.map((l) => l.texto)).toEqual([
      'Cruza el faro',
      '(Eco de la plaza)',
      '(Ah, ah)',
      'Responde el viento'
    ])
    expect(vuelta.every((l) => l.parte === undefined)).toBe(true)
  })

  it('sin reparto la salida es la de siempre', () => {
    const sin = letra([el('a', 'Luna roja', 1000, { fin_ms: 2000 })])
    expect(exportarLrc(sin, datos)).toContain('[00:01.00]Luna roja\n')
  })
})
