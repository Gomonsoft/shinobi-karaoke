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

  it('respeta el fin independiente y reconstruye el silencio al volver con una búsqueda', () => {
    const l = {
      ...letra([
        linea('a', 'El sol', 12_400, { fin_ms: 15_800 }),
        pausa('p', 16_100),
        linea('b', 'La luna', 17_100, { fin_ms: 20_300 })
      ]),
      offset_ms: 250
    }
    const enAudio = (ms: number) => fotogramaEn(l, ms - l.offset_ms, contexto)
    expect(enAudio(16_049).actual?.id).toBe('a')
    const espera = { actual: null, siguiente: { id: 'b', progreso: 0 }, puntos: 0 }
    expect(enAudio(16_050)).toMatchObject(espera)
    expect(enAudio(17_349)).toMatchObject(espera)
    expect(enAudio(17_350).actual).toMatchObject({ id: 'b', progreso: 0 })
    expect(enAudio(16_350)).toMatchObject(espera)
  })

  it('conserva el final automático anterior que alcanza el inicio siguiente', () => {
    const l = letra([linea('a', 'El sol', 12_400), linea('b', 'La luna', 17_100)])
    expect(fotogramaEn(l, 17_099, contexto).actual?.id).toBe('a')
    expect(fotogramaEn(l, 17_100, contexto).actual?.id).toBe('b')
    expect(l.lineas[0]?.fin_ms).toBeNull()
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

  it.each([500, 3000, 5900, 20_000])('avisa la primera entrada a %i ms', (inicio) => {
    const l = letra([linea('omitida', 'Sin marcar', null), linea('a', 'El sol', inicio)])
    const comienzo = Math.min(0, inicio - 6000)
    for (const tiempo of [comienzo, inicio - 4001]) {
      expect(fotogramaEn(l, tiempo, contexto)).toMatchObject({
        titulo: { titulo: contexto.titulo, artista: contexto.artista },
        actual: null,
        siguiente: null,
        puntos: 0
      })
    }
    for (const tiempo of [inicio - 4000, inicio - 3001]) {
      expect(fotogramaEn(l, tiempo, contexto)).toMatchObject({
        titulo: null,
        actual: null,
        siguiente: { id: 'a' },
        puntos: 0
      })
    }
    expect(
      [-3000, -2001, -2000, -1001, -1000, -1].map(
        (delta) => fotogramaEn(l, inicio + delta, contexto).puntos
      )
    ).toEqual([3, 3, 2, 2, 1, 1])
    expect(fotogramaEn(l, inicio, contexto)).toMatchObject({
      actual: { id: 'a', progreso: 0 },
      puntos: 0
    })
  })

  it('muestra el indicador con un hueco de 4 s que incluye pausas y líneas omitidas', () => {
    const l = letra([
      linea('a', 'El sol', 8000),
      pausa('p', 10_000),
      linea('omitida', 'Sin marcar', null),
      linea('b', 'El mar', 14_000)
    ])
    expect(fotogramaEn(l, 9000, contexto).actual?.progreso).toBe(0.5)
    expect(fotogramaEn(l, 10_000, contexto)).toMatchObject({
      actual: null,
      siguiente: { id: 'b' },
      puntos: 0
    })
    expect([11_000, 12_000, 13_000, 14_000].map((t) => fotogramaEn(l, t, contexto).puntos)).toEqual(
      [3, 2, 1, 0]
    )
  })

  it('acota el fin de la última línea y conserva el título si no hay tiempos', () => {
    const l = letra([linea('a', 'Mar', 28_000)])
    expect(fotogramaEn(l, 29_000, contexto).actual?.progreso).toBe(0.5)
    expect(fotogramaEn(l, 30_000, contexto).actual).toBeNull()
    const sinTiempos = letra([linea('b', 'Nube', null)])
    for (const tiempo of [-6000, 0, 20_000]) {
      expect(fotogramaEn(sinTiempos, tiempo, contexto)).toMatchObject({
        titulo: { titulo: 'Inventada' },
        actual: null,
        siguiente: null,
        puntos: 0
      })
    }
  })

  it('resuelve mil fotogramas de una letra de 5000 líneas sin degradarse con el tamaño', () => {
    // Sin límite fijo ajustado (inestable bajo carga): límite holgado y comparación de complejidad.
    const medir = (n: number): { ms: number; ultimo: string | undefined } => {
      const l = letra(Array.from({ length: n }, (_, i) => linea(String(i), 'Nube', i * 300)))
      const ctx = { ...contexto, duracionMs: n * 300 }
      const inicio = performance.now()
      let ultimo: string | undefined
      for (let i = 0; i < 1000; i++) ultimo = fotogramaEn(l, (i * 1500) % (n * 300), ctx).actual?.id
      return { ms: performance.now() - inicio, ultimo }
    }
    const pequeno = medir(500)
    const grande = medir(5000)
    expect(grande.ultimo).toBe('4995')
    expect(grande.ms).toBeLessThan(2000)
    // Un algoritmo lineal por fotograma sería ~10 veces más lento con 10 veces más líneas.
    expect(grande.ms).toBeLessThan(Math.max(pequeno.ms, 25) * 8)
  })
})
