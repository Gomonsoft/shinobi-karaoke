import { describe, expect, it, vi } from 'vitest'
import type { Cancion } from '../../shared'
import { origenTrasEdicion, rellenarAlbumDesdeLrclib } from './origen'

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

describe('rellenarAlbumDesdeLrclib', () => {
  const registro = { titulo: 'Otro título', artista: 'Otro artista', album: 'Disco de LRCLIB' }
  const montar = (metadatos: Partial<Cancion['metadatos']>) => {
    const cancion = { metadatos: { ...previos, album: null, ...metadatos } } as Cancion
    const actualizar = vi.fn(
      async (_id: string, c: { metadatos: Partial<Cancion['metadatos']> }) => {
        Object.assign(cancion.metadatos, c.metadatos)
      }
    )
    return { cancion, actualizar, biblioteca: { obtener: () => cancion, actualizar } }
  }

  it('rellena un álbum vacío con origen lrclib y no toca título ni artista', async () => {
    const { biblioteca, actualizar } = montar({})
    expect(await rellenarAlbumDesdeLrclib(biblioteca, 'c1', registro)).toBe(true)
    expect(actualizar).toHaveBeenCalledWith('c1', {
      metadatos: { album: 'Disco de LRCLIB', origen: { album: 'lrclib' } }
    })
  })

  it('no sobrescribe un álbum previo ni uno vacío con origen usuario (tras «Quitar»)', async () => {
    const previo = montar({ album: 'Mi disco' })
    expect(await rellenarAlbumDesdeLrclib(previo.biblioteca, 'c1', registro)).toBe(false)
    const quitado = montar({ album: null, origen: { album: 'usuario' } })
    expect(await rellenarAlbumDesdeLrclib(quitado.biblioteca, 'c1', registro)).toBe(false)
    expect(previo.actualizar).not.toHaveBeenCalled()
    expect(quitado.actualizar).not.toHaveBeenCalled()
  })

  it('un registro sin álbum no hace nada', async () => {
    const { biblioteca, actualizar } = montar({})
    expect(await rellenarAlbumDesdeLrclib(biblioteca, 'c1', { ...registro, album: ' ' })).toBe(
      false
    )
    expect(actualizar).not.toHaveBeenCalled()
  })
})
