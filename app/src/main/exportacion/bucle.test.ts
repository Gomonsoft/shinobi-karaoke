import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { ejecutarBucle, type DestinoFotogramas } from './bucle'

const ANCHO = 2
const ALTO = 2
const TAM = ANCHO * ALTO * 4

/** Writable falso lento: vacía un fotograma por tick y emite `drain` al quedar vacío. */
function destinoLento() {
  const ev = new EventEmitter()
  const recibidos: number[] = []
  let cola = 0
  let maxPendientes = 0
  let drenando = false
  const drenar = (): void => {
    if (drenando) return
    drenando = true
    const paso = (): void => {
      if (cola === 0) {
        drenando = false
        ev.emit('drain')
        return
      }
      cola -= TAM
      setTimeout(paso, 1)
    }
    setTimeout(paso, 1)
  }
  const destino: DestinoFotogramas = {
    write(b) {
      recibidos.push(b.readUInt8(0))
      cola += TAM
      maxPendientes = Math.max(maxPendientes, cola / TAM)
      drenar()
      return false
    },
    get writableLength() {
      return cola
    },
    once: (e, cb) => ev.once(e, cb),
    off: (e, cb) => ev.off(e, cb)
  }
  return { destino, recibidos, maxPendientes: () => maxPendientes }
}

const capturar = (n: number): Promise<Buffer> => Promise.resolve(Buffer.alloc(TAM, n))

describe('ejecutarBucle', () => {
  it('con un destino lento no supera 3 fotogramas en cola y llegan en orden', async () => {
    const d = destinoLento()
    const r = await ejecutarBucle({
      total: 20,
      ancho: ANCHO,
      alto: ALTO,
      pintar: async () => undefined,
      capturar,
      destino: d.destino
    })
    expect(r).toEqual({ estado: 'completo', escritos: 20 })
    expect(d.recibidos).toEqual(Array.from({ length: 20 }, (_, i) => i))
    // Se pide el siguiente mientras haya ≤ 2 pendientes, así que al escribir hay a lo sumo 3.
    expect(d.maxPendientes()).toBeLessThanOrEqual(3)
  })

  it('al cancelar deja de pedir fotogramas en ≤ 1 fotograma', async () => {
    const d = destinoLento()
    const ac = new AbortController()
    const pedidos: number[] = []
    const r = await ejecutarBucle({
      total: 50,
      ancho: ANCHO,
      alto: ALTO,
      pintar: async (n) => {
        pedidos.push(n)
        if (n === 5) ac.abort()
      },
      capturar,
      destino: d.destino,
      señal: ac.signal
    })
    expect(r.estado).toBe('cancelado')
    expect(pedidos.length).toBeLessThanOrEqual(7)
    expect(d.recibidos.length).toBeLessThanOrEqual(5)
  })

  it('un Buffer de tamaño incorrecto termina con PERFIL_NO_SOPORTADO', async () => {
    const d = destinoLento()
    await expect(
      ejecutarBucle({
        total: 3,
        ancho: ANCHO,
        alto: ALTO,
        pintar: async () => undefined,
        capturar: async () => Buffer.alloc(TAM - 1),
        destino: d.destino
      })
    ).rejects.toMatchObject({ codigo: 'PERFIL_NO_SOPORTADO' })
    expect(d.recibidos).toEqual([])
  })
})
