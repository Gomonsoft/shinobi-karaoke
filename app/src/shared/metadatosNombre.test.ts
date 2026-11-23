import { describe, expect, it } from 'vitest'
import { metadatosDeCarpeta, metadatosDeNombre, tituloConRestos } from './metadatosNombre'

// Nombres anonimizados: grupos, discos y temas inventados.
const CASOS: [string, string, string, string, string][] = [
  // nombre, título, artista, álbum, patrón
  ['Grupo Uno - Tema Alfa.mp3', 'Tema Alfa', 'Grupo Uno', '', 'artista-titulo'],
  ['Grupo Uno – Tema Alfa.flac', 'Tema Alfa', 'Grupo Uno', '', 'artista-titulo'],
  ['Grupo Uno — Tema Alfa.m4a', 'Tema Alfa', 'Grupo Uno', '', 'artista-titulo'],
  ['03 - Tema Alfa.flac', 'Tema Alfa', '', '', 'pista-titulo'],
  ['03. Tema Alfa.mp3', 'Tema Alfa', '', '', 'pista-titulo'],
  ['03 Tema Alfa.mp3', 'Tema Alfa', '', '', 'pista-titulo'],
  ['1-03 Tema Alfa.mp3', 'Tema Alfa', '', '', 'pista-titulo'],
  ['03 Grupo Uno - Tema Alfa.mp3', 'Tema Alfa', 'Grupo Uno', '', 'artista-titulo'],
  ['01 - Grupo Uno - Tema Alfa.ogg', 'Tema Alfa', 'Grupo Uno', '', 'artista-titulo'],
  [
    'Grupo Uno - Disco Beta - 03 - Tema Alfa.mp3',
    'Tema Alfa',
    'Grupo Uno',
    'Disco Beta',
    'artista-album-pista-titulo'
  ],
  ['Grupo_Uno_-_Tema_Alfa.mp3', 'Tema Alfa', 'Grupo Uno', '', 'artista-titulo'],
  ['audio_final2.wav', 'audio final2', '', '', 'ninguno'],
  ['1999.mp3', '1999', '', '', 'ninguno'],
  ['A-B.mp3', 'A-B', '', '', 'ninguno'],
  ['  Grupo Dos  -  Tema   Gamma .wav', 'Tema Gamma', 'Grupo Dos', '', 'artista-titulo'],
  ['歌手 - 歌.mp3', '歌', '歌手', '', 'artista-titulo'],
  ['Grupo Tres - Tema - Versión.mp3', 'Tema - Versión', 'Grupo Tres', '', 'artista-titulo']
]

// Número descartado solo por un espacio (con cero a la izquierda): el campo que sigue es dudoso (0231).
const NUMERO_DUDOSO = ['03 Tema Alfa.mp3', '03 Grupo Uno - Tema Alfa.mp3']

describe('metadatosDeNombre', () => {
  it.each(CASOS)('%s', (nombre, titulo, artista, album, patron) => {
    expect(metadatosDeNombre(nombre)).toEqual({
      titulo,
      artista,
      album,
      patron,
      numeroDudoso: NUMERO_DUDOSO.includes(nombre)
    })
  })

  // F6-N12: un número inicial solo es pista con puntuación o con cero a la izquierda.
  it.each([
    ['3 Doors Down - Kryptonite.mp3', '3 Doors Down', 'Kryptonite'],
    ['50 Cent - In Da Club.mp3', '50 Cent', 'In Da Club'],
    ['03_Título.mp3', '', 'Título'],
    ['3. Título.mp3', '', 'Título'],
    ['3) Título.mp3', '', 'Título'],
    ['03 - Título.mp3', '', 'Título'],
    ['03 Artista - Título.mp3', 'Artista', 'Título']
  ])('F6-N12: %s', (nombre, artista, titulo) => {
    const r = metadatosDeNombre(nombre)
    expect({ artista: r.artista, titulo: r.titulo }).toEqual({ artista, titulo })
  })

  it('F6-N12: «21 Guns» se conserva entero y «03 Artista - Título» marca el número como dudoso', () => {
    expect(metadatosDeNombre('21 Guns.mp3')).toMatchObject({
      titulo: '21 Guns',
      patron: 'ninguno',
      numeroDudoso: false
    })
    expect(metadatosDeNombre('03 Artista - Título.mp3').numeroDudoso).toBe(true)
    expect(metadatosDeNombre('3. Título.mp3').numeroDudoso).toBe(false)
    expect(metadatosDeNombre('03_Título.mp3').numeroDudoso).toBe(false)
  })
})

describe('tituloConRestos', () => {
  it('detecta paréntesis, corchetes, barra y guion con espacios', () => {
    for (const t of ['Tema (live)', 'Tema [x]', 'Tema | otro', 'Tema - Versión']) {
      expect(tituloConRestos(t)).toBe(true)
    }
    expect(tituloConRestos('Tema Alfa')).toBe(false)
    expect(tituloConRestos('A-B')).toBe(false)
  })
})

describe('metadatosDeCarpeta', () => {
  it('Artista - Álbum o solo álbum', () => {
    expect(metadatosDeCarpeta('Grupo Uno - Disco Beta')).toEqual({
      artista: 'Grupo Uno',
      album: 'Disco Beta'
    })
    expect(metadatosDeCarpeta('Disco_Beta')).toEqual({ artista: '', album: 'Disco Beta' })
  })
})
