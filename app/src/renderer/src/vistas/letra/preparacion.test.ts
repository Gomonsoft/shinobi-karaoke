import { describe, expect, it } from 'vitest'
import { motivoElige } from './preparacion'

describe('motivoElige (let.prep.motivo.*)', () => {
  it('con el artista vacío manda sinArtista sobre cualquier otro motivo', () => {
    const m = motivoElige('sinExacta', { artistaVacio: true, algunaEncaja: true })
    expect(m).toBe('falta el artista de la canción: escríbelo arriba y vuelve a buscar, o elige tú')
  })

  it('con artista, sinExacta dice «aunque alguna encaja» solo si alguna encaja', () => {
    expect(motivoElige('sinExacta', { artistaVacio: false, algunaEncaja: true })).toBe(
      'aunque alguna encaja con tu audio, ninguna coincide a la vez en título, artista y duración con tu canción'
    )
    expect(motivoElige('sinExacta', { artistaVacio: false, algunaEncaja: false })).toBe(
      'ninguna coincide a la vez en título, artista y duración con tu canción'
    )
  })

  it('sin dato, «no está claro»', () => {
    expect(motivoElige(null, { artistaVacio: false, algunaEncaja: false })).toBe(
      'no está claro que coincida con tu audio'
    )
  })

  it('duda con el mejor candidato dudoso por una limitación: motivo propio (let.prep.motivo.limitada)', () => {
    const m = motivoElige('duda', { artistaVacio: false, algunaEncaja: false, limitada: true })
    expect(m).toContain('no podemos comprobarlas con tu audio')
    expect(motivoElige('duda', { artistaVacio: false, algunaEncaja: false })).toContain(
      'no está claro'
    )
  })
})
