import { describe, expect, it } from 'vitest'
import { PROCEDENCIAS } from '@shared/ipc'
import {
  AJ_TEMAS,
  BIB_GRUPO,
  ORIGEN_ANTERIOR,
  TEMA,
  destinoHeredar,
  lineasDesglose,
  nombreCancion,
  nombreArtista,
  procedenciaCorta,
  procedenciaLarga
} from './textos'

const cero = {
  cancion: 0,
  album: 0,
  artista: 0,
  predeterminado: 0,
  aleatorio: 0,
  predeterminadoAnterior: 0,
  propio: 0,
  respaldo: 0,
  incluido: 0
}

describe('textos de temas', () => {
  it('desglose con singulares, orden y sin líneas a 0; propio no se pinta', () => {
    expect(
      lineasDesglose({
        ...cero,
        cancion: 1,
        album: 2,
        artista: 1,
        predeterminadoAnterior: 1,
        propio: 3
      })
    ).toEqual([
      '1 lo tiene asignado',
      '3 lo heredan de su álbum o artista',
      '1 lo conserva como predeterminado anterior'
    ])
    expect(
      lineasDesglose({
        ...cero,
        cancion: 3,
        predeterminado: 2,
        aleatorio: 1,
        predeterminadoAnterior: 4
      })
    ).toEqual([
      '3 lo tienen asignado',
      '2 lo usan como tema predeterminado',
      '1 lo recibió al azar',
      '4 lo conservan como predeterminado anterior'
    ])
    expect(lineasDesglose({ ...cero, propio: 5, respaldo: 1, incluido: 2 })).toEqual([])
  })

  it('tema.origen.anterior y aj.temas.origen.anterior son la misma constante', () => {
    expect(AJ_TEMAS.origenAnterior).toBe(ORIGEN_ANTERIOR)
    expect(procedenciaLarga('predeterminado_anterior')).toBe(ORIGEN_ANTERIOR)
    expect(procedenciaCorta('predeterminado_anterior')).toBe('predeterminado anterior')
    expect(procedenciaCorta('respaldo')).toBe('no disponible')
  })

  it('cubre las nueve procedencias', () => {
    for (const p of PROCEDENCIAS) {
      expect(procedenciaCorta(p)).not.toBe('')
      expect(procedenciaLarga(p, { album: 'A', artista: 'B' })).not.toBe('')
    }
    expect(procedenciaLarga('album', { album: 'Opera', artista: 'Queen' })).toBe(
      'Del álbum «Opera» de Queen'
    )
    expect(procedenciaLarga('artista', { artista: 'Queen' })).toBe('Del artista Queen')
  })

  it('destino de volver a heredar', () => {
    expect(
      destinoHeredar({ procedencia: 'artista', temaNombre: 'Neón' }, { artista: 'Queen' })
    ).toBe('Usará «Neón», del artista Queen.')
    expect(destinoHeredar({ procedencia: 'predeterminado_anterior', temaNombre: 'Neón' })).toBe(
      'Usará «Neón», el tema predeterminado anterior.'
    )
    expect(destinoHeredar({ procedencia: 'incluido', temaNombre: null })).toBe(
      'Usará el estilo incluido de Shinobi Karaoke.'
    )
  })

  it('valores por defecto de título y artista', () => {
    expect(nombreCancion(' ')).toBe('Canción sin nombre')
    expect(nombreArtista('')).toBe('Sin artista')
  })

  it('textos parciales con variante f = 1 y sin «{k} de {n}»', () => {
    expect(TEMA.eliminar.parcial('La flaca', 3)).toContain('Faltan 3 canciones')
    expect(TEMA.eliminar.parcial('La flaca', 1)).toContain('Falta esa canción')
    expect(AJ_TEMAS.quitar.parcial('X', 3, 'Noche ninja')).toContain('Faltan 3 canciones')
    expect(AJ_TEMAS.quitar.parcial('X', 1, 'Noche ninja')).toContain('Falta esa canción')
    const todos = [
      TEMA.eliminar.parcial('a', 2),
      TEMA.parcial.notaPendientes,
      AJ_TEMAS.quitar.parcial('a', 2, 'b')
    ].join(' ')
    expect(todos).not.toMatch(/\d+ de \d+|estas no se pudieron guardar/)
  })

  it('plurales de usos, eliminar y grupos', () => {
    expect(TEMA.usos(0)).toBe('Ninguna canción lo usa.')
    expect(TEMA.usos(1)).toBe('Lo usa 1 canción.')
    expect(TEMA.usos(12)).toBe('Lo usan 12 canciones.')
    expect(TEMA.eliminar.grupos(1, 2)).toBe('También se quitará de 1 artista y 2 álbumes.')
    expect(TEMA.eliminar.grupos(0, 0)).toBeNull()
    expect(BIB_GRUPO.impactoTodasNoDisponibles(1)).toContain('1 canción se verá')
    expect(BIB_GRUPO.noDisponible(1)).toContain('1 de ellas quedará')
    expect(AJ_TEMAS.predet.cuerpo(5, null)).toContain('estilo incluido')
  })
})
