import { describe, expect, it, vi } from 'vitest'
import { estimarCancion } from './estimar'

describe('estimarCancion', () => {
  it('usa la duración de los metadatos de la canción', () => {
    const estimarSeparacion = vi.fn(() => ({ min: 5, max: 6, origen: 'medido_equipo' as const }))
    const estimar = estimarCancion({
      obtener: (id) => (id === 'c1' ? { metadatos: { duracion_ms: 240_000 } } : null),
      estimarSeparacion
    })
    expect(estimar('c1')).toEqual({ min: 5, max: 6, origen: 'medido_equipo' })
    expect(estimarSeparacion).toHaveBeenCalledWith(240_000)
  })
  it('canción inexistente: null', () => {
    expect(estimarCancion({ obtener: () => null, estimarSeparacion: vi.fn() })('x')).toBeNull()
  })
})
