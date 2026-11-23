import { describe, expect, it, vi } from 'vitest'
import type { Cancion } from '../../shared'
import type { EventoCancion } from './operaciones'
import { RecuentoRevision } from './recuentoRevision'
import { revisionDeResumen } from './resumen'

function montar(estado: string | null = 'lista_para_revisar') {
  let oyente: (e: EventoCancion) => void = () => undefined
  const c = { id: 'a', modificada: 'v1' } as unknown as Cancion
  const contar = vi.fn(() => Promise.resolve({ dudosas: 3, importantes: 1 }))
  const r = new RecuentoRevision({
    biblioteca: {
      listar: () => [{ id: 'a', modificada: c.modificada, estadoPreparacion: estado }],
      obtener: () => c,
      suscribir: (cb) => ((oyente = cb), () => undefined)
    },
    contar
  })
  return { r, c, contar, emitir: (e: EventoCancion) => oyente(e) }
}

describe('recuento de revisión en memoria', () => {
  it('calcula en segundo plano una «Lista para revisar» sin registro y avisa', async () => {
    const { r, contar } = montar()
    const aviso = vi.fn()
    r.suscribir(aviso)
    expect(r.valor('a', 'v1')).toBeUndefined()
    r.arrancar()
    await vi.waitFor(() => expect(aviso).toHaveBeenCalledWith('a'))
    expect(r.valor('a', 'v1')).toEqual({ dudosas: 3, dudosasImportantes: 1 })
    expect(contar).toHaveBeenCalledTimes(1)
  })

  it('no calcula las que no están listas para revisar; una escritura de la letra invalida y recalcula', async () => {
    const otra = montar('borrador')
    otra.r.arrancar()
    await Promise.resolve()
    expect(otra.contar).not.toHaveBeenCalled()

    const { r, c, contar, emitir } = montar()
    r.arrancar()
    await vi.waitFor(() => expect(r.valor('a', 'v1')).toBeDefined())
    c.modificada = 'v2'
    expect(r.valor('a', 'v2')).toBeUndefined()
    emitir({
      id: 'a',
      resumen: { modificada: 'v2', estadoPreparacion: 'lista_para_revisar' }
    } as never)
    await vi.waitFor(() => expect(r.valor('a', 'v2')).toBeDefined())
    expect(contar).toHaveBeenCalledTimes(2)
  })

  it('el resumen usa la memoria y, sin ella, lo guardado en el registro', () => {
    const p = { preparacion: { dudosas: 4, dudosasImportantes: 2 } } as never
    expect(revisionDeResumen(p, { dudosas: 1, dudosasImportantes: 1 })).toEqual({
      dudosas: 1,
      dudosasImportantes: 1
    })
    expect(revisionDeResumen(p, undefined)).toEqual({ dudosas: 4, dudosasImportantes: 2 })
    expect(revisionDeResumen({ preparacion: null }, undefined)).toBeNull()
  })
})
