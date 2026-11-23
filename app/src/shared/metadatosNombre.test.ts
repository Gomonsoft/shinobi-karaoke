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

describe('metadatosDeNombre', () => {
  it.each(CASOS)('%s', (nombre, titulo, artista, album, patron) => {
    expect(metadatosDeNombre(nombre)).toEqual({ titulo, artista, album, patron })
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
