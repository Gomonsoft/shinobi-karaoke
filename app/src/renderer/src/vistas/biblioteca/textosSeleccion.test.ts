import type { ResultadoOperacionIpc } from '@shared/ipc'
import { afectada, origen } from '../../temas/pruebas'
import { ID_TEMA_PRUEBA } from './temasFalsos'
import { LOTE, resumirLote } from './textosSeleccion'

const NEON = '11111111-1111-4111-8111-111111111111'

describe('LOTE.nota (bib.lote.nota.*)', () => {
  const nota = (antes: ReturnType<typeof origen>, efecto: 'cambia' | 'sin_cambios' = 'cambia') =>
    LOTE.nota(afectada('1', { antes, efecto }), NEON)

  it('personalizado, asignado, heredado, igual y no disponible', () => {
    expect(nota(origen('propio'))).toEqual({
      texto: '⚠ Sustituye su tema personalizado',
      aviso: true
    })
    expect(nota(origen('cancion', 'Sol', ID_TEMA_PRUEBA)).texto).toBe(
      'Sustituye el tema asignado «Sol»'
    )
    expect(nota(origen('artista', 'Noche ninja')).texto).toBe(
      'Ahora usa «Noche ninja» (del artista)'
    )
    expect(nota(origen('predeterminado_anterior', 'Sol')).texto).toBe(
      'Ahora usa «Sol» (predeterminado anterior)'
    )
    expect(nota(origen('cancion', 'Neón', NEON), 'sin_cambios').texto).toBe(
      'Ya tiene asignado «Neón»: no cambia'
    )
    expect(nota(origen('respaldo')).texto).toBe('Sustituye un tema no disponible')
  })

  it('textos con singular y plural', () => {
    expect(LOTE.avisoPersonalizado(1)).toBe('⚠ 1 canción perderá su tema personalizado.')
    expect(LOTE.avisoPersonalizado(2)).toBe('⚠ 2 canciones perderán su tema personalizado.')
    expect(LOTE.aplicar(1)).toBe('Aplicar a 1 canción')
    expect(LOTE.aplicar(3)).toBe('Aplicar a 3 canciones')
    expect(LOTE.titulo(4)).toBe('Aplicar tema a 4 canciones')
    expect(LOTE.aplicando(0, 3)).toBe('Aplicando… 0 de 3')
    expect(LOTE.resultado('Neón', 2, 3)).toBe('«Neón» se aplicó a 2 de 3 canciones.')
    expect(LOTE.resultado('Neón', 3, 3)).toBe('«Neón» se aplicó a 3 canciones.')
  })
})

describe('resumirLote', () => {
  const resultado = (
    canciones: Partial<ResultadoOperacionIpc['canciones'][number]>[]
  ): ResultadoOperacionIpc => ({
    catalogoEscrito: false,
    canciones: canciones.map((c, i) => ({
      id: String(i + 1),
      titulo: '',
      artista: '',
      estado: 'aplicada',
      ...c
    }))
  })

  it('cuenta aplicadas y las que ya lo tenían; reintenta solo error y omitida por cambio', () => {
    const r = resumirLote(
      resultado([
        { estado: 'aplicada' },
        { estado: 'sin_cambios' },
        { estado: 'error', codigo: 'ERROR_INTERNO' },
        { estado: 'omitida', motivo: 'cambio' },
        { estado: 'omitida', motivo: 'no_existe' },
        { estado: 'omitida', motivo: 'danada' }
      ])
    )
    expect(r).toEqual({ correctas: 2, total: 6, reintentables: ['3', '4'], conFallos: true })
  })

  it('un lote correcto no tiene fallos', () => {
    const r = resumirLote(resultado([{}, { estado: 'sin_cambios' }]))
    expect(r.conFallos).toBe(false)
    expect(r.reintentables).toEqual([])
  })
})
