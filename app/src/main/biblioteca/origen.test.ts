import { describe, expect, it } from 'vitest'
import { origenTrasEdicion } from './origen'

const previos = {
  titulo: 'Tema',
  artista: 'Grupo',
  album: 'Disco' as string | null,
  duracion_ms: 1
}

describe('origenTrasEdicion', () => {
  it('solo marca como usuario lo que cambia', () => {
    expect(origenTrasEdicion(previos, { titulo: 'Tema', artista: 'Otro', album: 'Disco' })).toEqual(
      {
        artista: 'usuario'
      }
    )
  })
  it('vaciar el álbum (Quitar) también es del usuario', () => {
    expect(origenTrasEdicion(previos, { titulo: 'Tema', artista: 'Grupo', album: null })).toEqual({
      album: 'usuario'
    })
  })
  it('sin cambios, nada', () => {
    expect(
      origenTrasEdicion(previos, { titulo: ' Tema ', artista: 'Grupo', album: 'Disco' })
    ).toBeUndefined()
  })
})
