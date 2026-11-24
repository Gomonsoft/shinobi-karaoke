import { describe, expect, it } from 'vitest'
import { generarPicos } from '../../shared/__fixtures__/picos'
import type { Letra } from '../../shared/letra'
import { contarDudosasGuardadas } from './dudosas'

const linea = (id: string, inicio: number, fin: number) => ({
  id,
  tipo: 'linea' as const,
  texto: 'frase inventada',
  inicio_ms: inicio,
  fin_ms: fin,
  palabras: null
})
const letra: Letra = {
  origen: 'manual',
  lrclib_id: null,
  offset_ms: 0,
  lineas: [linea('a', 1000, 3000), linea('b', 5000, 7000)]
}

describe('contarDudosasGuardadas', () => {
  it('con picos cuenta también los motivos de la voz', async () => {
    const picos = generarPicos({
      duracionMs: 10_000,
      tramos: [{ desdeMs: 1000, hastaMs: 3000, dbfs: -6 }]
    })
    const nivel = { pasoMs: picos.pasoMs, pares: picos.pares, duracionMs: 10_000 }
    const cuenta = await contarDudosasGuardadas(
      { picos: { nivelBase: async () => nivel } },
      { id: 'x', letra, metadatos: { duracion_ms: 10_000 } }
    )
    expect(cuenta).toEqual({ dudosas: 1, importantes: 1 }) // «b» cae donde no hay voz (`sinVoz`)
  })

  it('sin picos solo cuentan los motivos que no la necesitan; sin letra, null', async () => {
    const deps = { picos: { nivelBase: async () => null } }
    const cancion = { id: 'x', letra, metadatos: { duracion_ms: 10_000 } }
    expect(await contarDudosasGuardadas(deps, cancion)).toEqual({ dudosas: 0, importantes: 0 })
    expect(await contarDudosasGuardadas(deps, { ...cancion, letra: null })).toBeNull()
  })

  it('con voces a la vez no cuenta las líneas solapadas (la voz mezclada no las explica una a una)', async () => {
    const duo: Letra = {
      origen: 'manual',
      lrclib_id: null,
      offset_ms: 0,
      partes: {
        cantantes: [
          { id: 'c1', nombre: null },
          { id: 'c2', nombre: null }
        ]
      },
      // «a» y «b» se pisan; «c» está donde no hay voz y sí se cuenta.
      lineas: [
        linea('a', 1000, 5000),
        { ...linea('b', 2000, 4000), parte: 'c2' as const },
        linea('c', 7000, 8000)
      ]
    }
    const picos = generarPicos({
      duracionMs: 10_000,
      tramos: [{ desdeMs: 1000, hastaMs: 5000, dbfs: -6 }]
    })
    const nivel = { pasoMs: picos.pasoMs, pares: picos.pares, duracionMs: 10_000 }
    const cuenta = await contarDudosasGuardadas(
      { picos: { nivelBase: async () => nivel } },
      { id: 'x', letra: duo, metadatos: { duracion_ms: 10_000 } }
    )
    expect(cuenta).toEqual({ dudosas: 1, importantes: 1 })
  })
})
