import { resumenPrueba } from '../resumenPrueba'
import {
  aplicaA,
  contarAplica,
  motivoNoAplica,
  ordenarSeleccion,
  type ContextoAplica
} from './modelo'

const ctx = (extra: Partial<ContextoAplica> = {}): ContextoAplica => ({
  conTrabajo: new Set(),
  exportando: new Set(),
  activaId: null,
  ...extra
})

describe('A qué canciones aplica cada acción', () => {
  const lista = resumenPrueba({ id: 'l', estado: 'lista' })
  const borrador = resumenPrueba({ id: 'b', estado: 'borrador' })
  const danada = resumenPrueba({ id: 'd', estado: 'borrador', danada: true, motivo: 'pistas' })

  it('«A la cola» y «Exportar video» solo valen para las Listas', () => {
    expect(contarAplica('cola', [lista, borrador, danada], ctx())).toBe(1)
    expect(motivoNoAplica('cola', borrador, ctx())).toBe('noLista')
    expect(motivoNoAplica('exportar', danada, ctx())).toBe('danada')
  })

  it('no se exporta lo que ya se está exportando', () => {
    expect(motivoNoAplica('exportar', lista, ctx({ exportando: new Set(['l']) }))).toBe(
      'exportando'
    )
  })

  it('«Preparar» excluye Listas y lo que ya se prepara', () => {
    expect(motivoNoAplica('preparar', lista, ctx())).toBe('yaLista')
    expect(motivoNoAplica('preparar', borrador, ctx({ conTrabajo: new Set(['b']) }))).toBe(
      'enCurso'
    )
    expect(motivoNoAplica('preparar', danada, ctx())).toBe('danada')
  })

  it('la letra pide alguna línea con inicio y «Eliminar…» excluye la que suena', () => {
    expect(aplicaA('letra', resumenPrueba({ id: 'x', lineasConTiempo: 0 }), ctx())).toBe(false)
    expect(aplicaA('letra', resumenPrueba({ id: 'x', lineasConTiempo: 3 }), ctx())).toBe(true)
    expect(motivoNoAplica('eliminar', lista, ctx({ activaId: 'l' }))).toBe('activa')
    expect(aplicaA('datos', danada, ctx())).toBe(true)
  })

  it('ordena la selección como se ve y deja al final lo que está fuera de la vista', () => {
    const a = resumenPrueba({ id: 'a' })
    const b = resumenPrueba({ id: 'b' })
    const c = resumenPrueba({ id: 'c' })
    expect(ordenarSeleccion([a, b, c], ['c', 'a']).map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })
})
