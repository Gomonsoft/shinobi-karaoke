import { describe, expect, it } from 'vitest'
import {
  claveAlbum,
  claveAlbumTexto,
  claveArtista,
  claveNombreTema,
  claveTexto,
  nombreVisibleGrupo,
  normalizarNombreTema
} from './identidad'

describe('claveTexto', () => {
  it('une mayúsculas y espacios sobrantes', () => {
    expect(claveTexto('Queen')).toBe('queen')
    expect(claveTexto('QUEEN ')).toBe('queen')
    expect(claveTexto('queen')).toBe('queen')
  })
  it('colapsa espacios dobles, NBSP e ideográficos', () => {
    expect(claveTexto('Jarabe  de Palo')).toBe('jarabe de palo')
    expect(claveTexto('jarabe　de palo')).toBe('jarabe de palo')
  })
  it('NFC y NFD dan la misma clave; conserva diacríticos', () => {
    expect(claveTexto('Canción')).toBe(claveTexto('Canción'))
    expect(claveTexto('Canción')).not.toBe(claveTexto('Cancion'))
  })
  it('İstanbul produce una clave NFC estable', () => {
    const k = claveTexto('İstanbul')
    expect(k).toBe(k?.normalize('NFC'))
    expect(claveTexto('İstanbul')).toBe(k)
    expect(k?.endsWith('stanbul')).toBe(true)
  })
  it('vacío, espacios, null y undefined dan null', () => {
    expect(claveTexto('')).toBeNull()
    expect(claveTexto('   ')).toBeNull()
    expect(claveTexto(null)).toBeNull()
    expect(claveTexto(undefined)).toBeNull()
  })
})

describe('claves de artista y álbum', () => {
  it('el álbum es el par artista y álbum', () => {
    expect(claveAlbum({ artista: 'Queen', album: 'A Night  at the Opera' })).toEqual({
      artista: 'queen',
      album: 'a night at the opera'
    })
    expect(claveArtista({ artista: ' Queen ', album: null })).toBe('queen')
  })
  it('álbum sin artista o artista sin álbum: null', () => {
    expect(claveAlbum({ artista: '  ', album: 'X' })).toBeNull()
    expect(claveAlbum({ artista: 'Queen', album: null })).toBeNull()
    expect(claveAlbum({ artista: 'Queen', album: ' ' })).toBeNull()
  })
  it('claveAlbumTexto es estable y distingue pares', () => {
    const a = claveAlbumTexto({ artista: 'a', album: 'b c' })
    expect(a).toBe(claveAlbumTexto({ artista: 'a', album: 'b c' }))
    expect(a).not.toBe(claveAlbumTexto({ artista: 'a b', album: 'c' }))
  })
})

describe('nombreVisibleGrupo', () => {
  it('devuelve la grafía de la canción modificada más reciente, normalizada', () => {
    expect(
      nombreVisibleGrupo([
        { texto: 'queen', modificada: '2026-01-01T00:00:00Z' },
        { texto: '  QUEEN  ', modificada: '2026-03-01T00:00:00Z' },
        { texto: 'Queen', modificada: '2026-02-01T00:00:00Z' }
      ])
    ).toBe('QUEEN')
  })
  it('en empate gana la primera; lista vacía da cadena vacía', () => {
    const f = '2026-01-01T00:00:00Z'
    expect(
      nombreVisibleGrupo([
        { texto: 'A', modificada: f },
        { texto: 'a', modificada: f }
      ])
    ).toBe('A')
    expect(nombreVisibleGrupo([])).toBe('')
  })
})

describe('nombres de tema', () => {
  it('normaliza y compara por clave', () => {
    expect(normalizarNombreTema('  Noche   ninja ')).toBe('Noche ninja')
    expect(claveNombreTema('Noche Ninja')).toBe(claveNombreTema('noche  ninja'))
  })
})
