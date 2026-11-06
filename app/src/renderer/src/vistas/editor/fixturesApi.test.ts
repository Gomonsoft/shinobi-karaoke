import { describe, expect, it } from 'vitest'
import { cancionSchema } from '@shared/cancion'
import {
  apiEditorFalsa,
  cancionSinSincronizar,
  cancionSincronizadaLrclib,
  cancionConPalabras,
  cancionSeparando,
  cancionLista,
  cancionListaIncompleta
} from './fixturesApi'

describe('fixtures del editor', () => {
  it.each([
    cancionSinSincronizar,
    cancionSincronizadaLrclib,
    cancionConPalabras,
    cancionSeparando,
    cancionLista,
    cancionListaIncompleta
  ])('valida %s', (crear) => {
    expect(cancionSchema.parse(crear()).metadatos.duracion_ms).toBe(30_000)
  })

  it('persiste los tiempos y rechaza ids desactualizados', async () => {
    const cancion = cancionSinSincronizar()
    const { api } = apiEditorFalsa({ cancion })
    const tiempos = cancion.letra!.lineas.map(({ id }, i) => ({
      id,
      inicio_ms: i * 1000,
      fin_ms: null,
      palabras: null
    }))
    const peticion = { cancionId: cancion.id, offset_ms: -500, tiempos }
    await expect(api.letras.guardarTiempos!(peticion)).resolves.toMatchObject({
      lineasSinSincronizar: 0
    })
    await expect(api.biblioteca.obtener!(cancion.id)).resolves.toMatchObject({
      letra: { offset_ms: -500, lineas: tiempos.map((t) => expect.objectContaining(t)) }
    })
    await expect(api.letras.guardarTiempos!({ ...peticion, tiempos: [] })).rejects.toMatchObject({
      codigo: 'LETRA_DESACTUALIZADA'
    })
  })
})
