import { describe, expect, it, vi } from 'vitest'
import { GestorReposo } from './reposo'

function montar() {
  const activos = new Set<number>()
  let siguiente = 1
  const bloqueador = {
    start: vi.fn(() => {
      const id = siguiente++
      activos.add(id)
      return id
    }),
    stop: vi.fn((id: number) => void activos.delete(id)),
    isStarted: vi.fn((id: number) => activos.has(id))
  }
  return { gestor: new GestorReposo(bloqueador), bloqueador, activos }
}

describe('GestorReposo', () => {
  it('mantiene el bloqueo mientras quede un titular', () => {
    const { gestor, bloqueador, activos } = montar()
    gestor.retener('local')
    gestor.retener('sesion')
    expect(bloqueador.start).toHaveBeenCalledTimes(1)
    gestor.liberar('local')
    expect(activos.size).toBe(1)
    gestor.liberar('sesion')
    expect(activos.size).toBe(0)
    expect(bloqueador.stop).toHaveBeenCalledTimes(1)
  })

  it('liberar sin retener no hace nada', () => {
    const { gestor, bloqueador } = montar()
    gestor.liberar('local')
    expect(bloqueador.stop).not.toHaveBeenCalled()
  })

  it('liberarTodo lo suelta siempre', () => {
    const { gestor, activos } = montar()
    gestor.retener('local')
    gestor.retener('sesion')
    gestor.liberarTodo()
    expect(activos.size).toBe(0)
  })

  it('vuelve a iniciar si el bloqueo se perdió', () => {
    const { gestor, bloqueador, activos } = montar()
    gestor.retener('local')
    activos.clear()
    gestor.retener('local')
    expect(bloqueador.start).toHaveBeenCalledTimes(2)
  })
})
