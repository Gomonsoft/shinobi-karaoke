import { describe, expect, it } from 'vitest'
import { letra, linea, pausa } from '@shared/__fixtures__'
import { fotogramaEn, fotogramaEstatico } from './render'

const contexto = { titulo: 'Inventada', artista: 'Shinobi', duracionMs: 30_000 }

describe('modelo de render', () => {
  it('barre la línea entre inicio y fin y omite una línea sin inicio en reproducción', () => {
    const l = letra([
      linea('a', 'El sol', 1000, { fin_ms: 3000 }),
      linea('b', 'Sin marcar', null),
      linea('c', 'La luna', 5000)
    ])
    expect(fotogramaEn(l, 2000, contexto)).toMatchObject({
      actual: { id: 'a', progreso: 0.5 },
      siguiente: { id: 'c', progreso: 0 }
    })
    expect(fotogramaEn(l, 3000, contexto)).toMatchObject({
      actual: null,
      siguiente: { id: 'c' },
      puntos: 0
    })
    expect(fotogramaEstatico(l, 'b')).toMatchObject({
      titulo: null,
      actual: { id: 'b', progreso: 0.5 },
      siguiente: { id: 'c', progreso: 0 },
      puntos: 0
    })
    expect(fotogramaEstatico(l, null).actual?.id).toBe('a')
  })

  it('resalta cada palabra según sus tiempos y muestra media línea en pausa', () => {
    const l = letra([
      linea('a', 'Sol y mar', 1000, {
        palabras: [
          { texto: 'Sol', inicio_ms: 1000, fin_ms: 1500 },
          { texto: 'y', inicio_ms: 1500, fin_ms: 2000 },
          { texto: 'mar', inicio_ms: 2000, fin_ms: 2500 }
        ]
      })
    ])
    expect(fotogramaEn(l, 1750, contexto).actual?.palabras?.map((p) => p.progreso)).toEqual([
      1, 0.5, 0
    ])
    expect(fotogramaEstatico(l, 'a').actual?.palabras?.map((p) => p.progreso)).toEqual([1, 0.5, 0])
  })

  it('usa el título hasta 4 s antes y limita el indicador a pausas largas', () => {
    const l = letra([linea('a', 'El sol', 8000), pausa('p', 10_000), linea('b', 'El mar', 17_000)])
    expect(fotogramaEn(l, 3999, contexto).titulo).toEqual({
      titulo: contexto.titulo,
      artista: contexto.artista
    })
    expect(fotogramaEn(l, 4000, contexto)).toMatchObject({ titulo: null, puntos: 0 })
    expect([5000, 6000, 7000, 8000].map((t) => fotogramaEn(l, t, contexto).puntos)).toEqual([
      3, 2, 1, 0
    ])
    expect(fotogramaEn(l, 9000, contexto).actual?.progreso).toBe(0.5)
    expect(fotogramaEn(l, 10_000, contexto).actual).toBeNull()
    expect([14_000, 15_000, 16_000, 17_000].map((t) => fotogramaEn(l, t, contexto).puntos)).toEqual(
      [3, 2, 1, 0]
    )
  })

  it('acota el fin de la última línea y conserva el título si no hay tiempos', () => {
    const l = letra([linea('a', 'Mar', 28_000)])
    expect(fotogramaEn(l, 29_000, contexto).actual?.progreso).toBe(0.5)
    expect(fotogramaEn(l, 30_000, contexto).actual).toBeNull()
    const sinTiempos = letra([linea('b', 'Nube', null)])
    expect(fotogramaEn(sinTiempos, 20_000, contexto)).toMatchObject({
      titulo: { titulo: 'Inventada' },
      actual: null,
      siguiente: null,
      puntos: 0
    })
  })

  it('resuelve mil fotogramas de una letra de 5000 líneas en menos de 200 ms', () => {
    const l = letra(Array.from({ length: 5000 }, (_, i) => linea(String(i), 'Nube', i * 300)))
    const ctx = { ...contexto, duracionMs: 5000 * 300 }
    const inicio = performance.now()
    let ultimo: string | undefined
    for (let i = 0; i < 1000; i++) ultimo = fotogramaEn(l, i * 1500, ctx).actual?.id
    expect(performance.now() - inicio).toBeLessThan(200)
    expect(ultimo).toBe('4995')
  })
})
