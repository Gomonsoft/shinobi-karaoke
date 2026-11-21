import { describe, expect, it } from 'vitest'
import { ColaApariencia } from './cola'

function diferida<T = void>(): {
  promesa: Promise<T>
  resolver: (v: T) => void
  rechazar: (e: unknown) => void
} {
  let resolver!: (v: T) => void
  let rechazar!: (e: unknown) => void
  const promesa = new Promise<T>((ok, ko) => {
    resolver = ok
    rechazar = ko
  })
  return { promesa, resolver, rechazar }
}

describe('ColaApariencia', () => {
  it('ejecuta las tareas una tras otra, en orden de llegada', async () => {
    const cola = new ColaApariencia()
    const registro: string[] = []
    const d1 = diferida()
    const p1 = cola.enCola(async () => {
      registro.push('inicio 1')
      await d1.promesa
      registro.push('fin 1')
      return 1
    })
    const p2 = cola.enCola(() => {
      registro.push('inicio 2')
      return 2
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(registro).toEqual(['inicio 1'])
    d1.resolver()
    expect(await Promise.all([p1, p2])).toEqual([1, 2])
    expect(registro).toEqual(['inicio 1', 'fin 1', 'inicio 2'])
  })

  it('un fallo rechaza su promesa sin bloquear la cola', async () => {
    const cola = new ColaApariencia()
    const p1 = cola.enCola(() => Promise.reject(new Error('falla')))
    const p2 = cola.enCola(() => 'sigue')
    await expect(p1).rejects.toThrow('falla')
    await expect(p2).resolves.toBe('sigue')
  })

  it('vaciada espera a lo encolado', async () => {
    const cola = new ColaApariencia()
    const d = diferida()
    let hecho = false
    void cola.enCola(async () => {
      await d.promesa
      hecho = true
    })
    const v = cola.vaciada()
    d.resolver()
    await v
    expect(hecho).toBe(true)
  })
})
