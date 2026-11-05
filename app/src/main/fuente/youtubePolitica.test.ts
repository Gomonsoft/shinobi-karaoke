import { describe, expect, it } from 'vitest'
import { politicaReintentoDescarga } from './youtube'

const args = { url: 'https://www.youtube.com/watch?v=x', salida: '/c' }
const error = (codigo: string) => ({ codigo, mensaje: 'x', reintentable: true })

describe('política de reintento de la descarga de YouTube (0063)', () => {
  it.each(['SIN_CONEXION', 'SERVICIO_NO_DISPONIBLE'])(
    '%s: reintenta a los 5, 15 y 45 s con motivo red y los mismos args',
    (codigo) => {
      expect([1, 2, 3].map((i) => politicaReintentoDescarga(error(codigo), i, args))).toEqual([
        { args, esperaMs: 5000, motivo: 'red' },
        { args, esperaMs: 15_000, motivo: 'red' },
        { args, esperaMs: 45_000, motivo: 'red' }
      ])
    }
  )

  it('no hay un cuarto reintento', () => {
    expect(politicaReintentoDescarga(error('SIN_CONEXION'), 4, args)).toBeNull()
  })

  it.each(['YOUTUBE_BLOQUEADO', 'VIDEO_NO_DISPONIBLE', 'PROCESO_TERMINADO', 'ERROR_INTERNO'])(
    '%s: sin reintento',
    (codigo) => {
      expect(politicaReintentoDescarga(error(codigo), 1, args)).toBeNull()
    }
  )
})
