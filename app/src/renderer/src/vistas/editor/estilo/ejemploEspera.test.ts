import { describe, expect, it } from 'vitest'
import { ESPERA_LEGADA } from '@shared/espera'
import { linea } from '@shared/__fixtures__'
import type { Letra } from '@shared/letra'
import { fotogramaEn } from '../../../karaoke/render'
import { crearEjemploEspera, HUECO_EJEMPLO_MS } from './ejemploEspera'

const letra: Letra = {
  origen: 'manual',
  lrclib_id: null,
  offset_ms: 0,
  lineas: [linea('a', 'Uno', 1000), linea('b', 'Dos', 5000), linea('c', 'Tres', 9000)]
}
const espera = { ...ESPERA_LEGADA, cuenta: true, umbral_ms: 20_000 }

describe('crearEjemploEspera', () => {
  it('une la línea seleccionada con la siguiente con un hueco de 6 s', () => {
    const e = crearEjemploEspera(letra, 'a', espera)
    const [a, b] = e.letra.lineas
    expect([a!.texto, b!.texto]).toStrictEqual(['Uno', 'Dos'])
    expect(b!.inicio_ms! - a!.fin_ms!).toBe(HUECO_EJEMPLO_MS)
    expect(e.finMs).toBeGreaterThan(b!.inicio_ms!)
  })

  it('con la última seleccionada usa la anterior y ella', () => {
    const e = crearEjemploEspera(letra, 'c', espera)
    expect(e.letra.lineas.map((l) => l.texto)).toStrictEqual(['Dos', 'Tres'])
  })

  it('con una sola línea la repite', () => {
    const una = { ...letra, lineas: [letra.lineas[0]!] }
    expect(crearEjemploEspera(una, null, espera).letra.lineas.map((l) => l.texto)).toStrictEqual([
      'Uno',
      'Uno'
    ])
  })

  it('el hueco muestra los indicadores aunque el umbral sea mayor', () => {
    const e = crearEjemploEspera(letra, 'a', espera)
    expect(e.espera.umbral_ms).toBe(HUECO_EJEMPLO_MS)
    const f = fotogramaEn(e.letra, e.inicioMs + 2500 + 1000, {
      duracionMs: e.duracionMs,
      titulo: 't',
      artista: 'a',
      espera: e.espera
    })
    expect(f.espera).not.toBeNull()
    expect(f.espera!.puntos).toBeGreaterThanOrEqual(0)
  })
})
