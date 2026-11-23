import type { Preparacion } from '@shared/cancion'
import type { Letra } from '@shared/letra'
import { bloquePreparacion, fechaCorta } from './modelo'

const registro = (extra: Partial<Preparacion> = {}): Preparacion =>
  ({
    estado: 'lista_para_revisar',
    paso: null,
    origen: 'automatica',
    actualizado: '2026-11-21T10:00:00Z',
    dudosas: 0,
    revisada: false,
    eleccion: { por: 'app', fecha: '2026-11-21T10:00:00Z', lrclib_id: 7 },
    ...extra
  }) as Preparacion

const linea = (id: string, origen_fin?: 'preparacion' | 'letra'): Letra['lineas'][number] => ({
  id,
  tipo: 'linea',
  texto: id,
  inicio_ms: 1000,
  fin_ms: 2000,
  palabras: null,
  ...(origen_fin ? { origen_fin } : null)
})
const letra = (extra: Partial<Letra> = {}): Letra => ({
  origen: 'lrclib',
  lrclib_id: 7,
  offset_ms: 0,
  lineas: [linea('a', 'preparacion'), linea('b', 'preparacion'), linea('c')],
  ...extra
})

describe('bloquePreparacion', () => {
  it('lista solo lo que sigue en pie', () => {
    const b = bloquePreparacion(registro(), letra({ desfase_corregido_ms: 800 }))
    expect(b).toMatchObject({ letra: 'app', desfaseMs: 800, fines: 2 })
    expect(b?.fecha).toMatch(/2026/)
  })

  it('una letra sustituida, sin corrección y sin fines no deja ningún renglón', () => {
    expect(bloquePreparacion(registro(), letra({ lrclib_id: 99, lineas: [linea('a')] }))).toBeNull()
  })

  it('sin registro no hay bloque (F5-E4)', () => {
    expect(bloquePreparacion(undefined, letra())).toBeNull()
  })

  it('una letra elegida por el usuario entre las candidatas dice «elegida por ti»', () => {
    const r = registro({
      eleccion: { por: 'usuario', fecha: '2026-11-21T10:00:00Z', lrclib_id: 7 }
    })
    expect(bloquePreparacion(r, letra())?.letra).toBe('usuario')
  })

  it('una línea cuyo fin se tocó a mano (sin origen_fin) no cuenta', () => {
    const b = bloquePreparacion(
      registro(),
      letra({ lineas: [linea('a', 'preparacion'), linea('b')] })
    )
    expect(b?.fines).toBe(1)
  })

  it('fechaCorta con una fecha ilegible devuelve vacío', () => {
    expect(fechaCorta('nada')).toBe('')
  })
})
