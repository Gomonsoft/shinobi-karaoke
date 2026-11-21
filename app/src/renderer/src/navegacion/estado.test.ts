import { describe, expect, it } from 'vitest'
import { origenAjustes, vistaAjustesDesde, vistaDeOrigen } from './estado'
import { destinoDeAtajo } from './useAtajosGlobales'

describe('origen de Ajustes (A10)', () => {
  it('desde el editor recuerda la canción; desde cualquier otra vista, la Biblioteca', () => {
    expect(origenAjustes({ tipo: 'cancion', id: 'c1', paso: 'editor' })).toEqual({
      tipo: 'editor',
      id: 'c1'
    })
    expect(origenAjustes({ tipo: 'cancion', id: 'c1', paso: 'letra' })).toEqual({
      tipo: 'biblioteca'
    })
    expect(origenAjustes({ tipo: 'biblioteca' })).toEqual({ tipo: 'biblioteca' })
    expect(origenAjustes({ tipo: 'anadir' })).toEqual({ tipo: 'biblioteca' })
  })

  it('volver al editor reabre la canción con la pestaña Estilo; si no, la Biblioteca', () => {
    expect(vistaDeOrigen({ tipo: 'editor', id: 'c1' })).toEqual({
      tipo: 'cancion',
      id: 'c1',
      paso: 'editor',
      pestana: 'estilo'
    })
    expect(vistaDeOrigen({ tipo: 'biblioteca' })).toEqual({ tipo: 'biblioteca' })
    expect(vistaDeOrigen(undefined)).toEqual({ tipo: 'biblioteca' })
  })

  it('«Administrar temas…» abre con la sección inicial', () => {
    expect(vistaAjustesDesde({ tipo: 'cancion', id: 'c1', paso: 'editor' }, 'temas')).toEqual({
      tipo: 'ajustes',
      origen: { tipo: 'editor', id: 'c1' },
      seccion: 'temas'
    })
    expect(vistaAjustesDesde({ tipo: 'biblioteca' })).toEqual({
      tipo: 'ajustes',
      origen: { tipo: 'biblioteca' }
    })
  })

  it('Ctrl/Cmd + , lleva a Ajustes recordando el origen y no hace nada dentro de Ajustes', () => {
    expect(destinoDeAtajo('ajustes', { tipo: 'cancion', id: 'c1', paso: 'editor' })).toEqual({
      tipo: 'ajustes',
      origen: { tipo: 'editor', id: 'c1' }
    })
    expect(destinoDeAtajo('ajustes', { tipo: 'ajustes' })).toBeNull()
    expect(destinoDeAtajo('ajustes', { tipo: 'primer-arranque' })).toBeNull()
  })
})
