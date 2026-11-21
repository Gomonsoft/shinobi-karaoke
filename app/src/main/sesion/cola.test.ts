import { describe, expect, it } from 'vitest'
import { MAXIMO_PENDIENTES, type EntradaIpc } from '../../shared/sesion'
import * as Cola from './cola'
import { ErrorCola, type EstadoCola } from './cola'

function generador(): () => string {
  let n = 0
  return () => `e${++n}`
}
const datos = (n: number): Cola.DatosEntrada => ({
  cancionId: `c${n}`,
  titulo: `T${n}`,
  artista: `A${n}`
})
const opciones = (revision = 0): Cola.OpcionesAgregar => ({ nuevoId: generador(), revision })

function conPendientes(...ns: number[]): EstadoCola {
  const nuevoId = generador()
  return ns.reduce(
    (cola, n) => Cola.agregar(cola, datos(n), 'final', { nuevoId, revision: 0 }).cola,
    Cola.colaVacia()
  )
}
type Cuatro = [EntradaIpc, EntradaIpc, EntradaIpc, EntradaIpc]
const pe = (c: EstadoCola): Cuatro => c.pendientes as unknown as Cuatro
const canciones = (c: EstadoCola): string[] => c.pendientes.map((p) => p.cancionId)

describe('cola.agregar', () => {
  it('añade al final y delante', () => {
    let cola = conPendientes(1, 2)
    cola = Cola.agregar(cola, datos(3), 'siguiente', opciones()).cola
    cola = Cola.agregar(cola, datos(4), 'final', opciones()).cola
    expect(canciones(cola)).toEqual(['c3', 'c1', 'c2', 'c4'])
  })

  it('la misma canción dos veces da entradas con ids distintos', () => {
    const nuevoId = generador()
    const a = Cola.agregar(Cola.colaVacia(), datos(1), 'final', { nuevoId, revision: 0 })
    const b = Cola.agregar(a.cola, datos(1), 'final', { nuevoId, revision: 0 })
    expect(a.entrada.entradaId).not.toBe(b.entrada.entradaId)
    expect(b.cola.pendientes).toHaveLength(2)
    expect(b.entrada.disponibilidad).toBe('ok')
  })

  it('deshacer: delante de antesDe si la revisión coincide, al final si no', () => {
    const cola = conPendientes(1, 2, 3)
    const [, p2] = pe(cola)
    const ok = Cola.agregar(cola, datos(9), { antesDe: p2.entradaId, siRevision: 7 }, opciones(7))
    expect(canciones(ok.cola)).toEqual(['c1', 'c9', 'c2', 'c3'])
    const vieja = Cola.agregar(
      cola,
      datos(9),
      { antesDe: p2.entradaId, siRevision: 6 },
      opciones(7)
    )
    expect(canciones(vieja.cola)).toEqual(['c1', 'c2', 'c3', 'c9'])
    const alFinal = Cola.agregar(cola, datos(9), { antesDe: null, siRevision: 7 }, opciones(7))
    expect(canciones(alFinal.cola)).toEqual(['c1', 'c2', 'c3', 'c9'])
    const perdida = Cola.agregar(cola, datos(9), { antesDe: 'nada', siRevision: 7 }, opciones(7))
    expect(canciones(perdida.cola)).toEqual(['c1', 'c2', 'c3', 'c9'])
  })

  it('rechaza con COLA_LLENA al llegar a 500 y no antes', () => {
    const nuevoId = generador()
    let cola = Cola.colaVacia()
    for (let i = 0; i < MAXIMO_PENDIENTES; i++) {
      cola = Cola.agregar(cola, datos(i), 'final', { nuevoId, revision: 0 }).cola
    }
    expect(cola.pendientes).toHaveLength(MAXIMO_PENDIENTES)
    expect(() => Cola.agregar(cola, datos(1), 'final', { nuevoId, revision: 0 })).toThrowError(
      expect.objectContaining({ codigo: 'COLA_LLENA' })
    )
  })
})

describe('cola.mover', () => {
  it('coloca delante de otra y al final', () => {
    const cola = conPendientes(1, 2, 3, 4)
    const [p1, p2, , p4] = pe(cola)
    expect(canciones(Cola.mover(cola, { entradaId: p4.entradaId, antesDe: p2.entradaId }))).toEqual(
      ['c1', 'c4', 'c2', 'c3']
    )
    expect(canciones(Cola.mover(cola, { entradaId: p1.entradaId, antesDe: null }))).toEqual([
      'c2',
      'c3',
      'c4',
      'c1'
    ])
    expect(canciones(Cola.mover(cola, { entradaId: p2.entradaId, antesDe: p1.entradaId }))).toEqual(
      ['c2', 'c1', 'c3', 'c4']
    )
  })

  it('a la misma posición devuelve la misma cola', () => {
    const cola = conPendientes(1, 2, 3)
    const [p1, p2, p3] = pe(cola)
    expect(Cola.mover(cola, { entradaId: p2.entradaId, antesDe: p3.entradaId })).toBe(cola)
    expect(Cola.mover(cola, { entradaId: p3.entradaId, antesDe: null })).toBe(cola)
    expect(Cola.mover(cola, { entradaId: p1.entradaId, antesDe: p2.entradaId })).toBe(cola)
    expect(Cola.mover(cola, { entradaId: p2.entradaId, antesDe: p2.entradaId })).toBe(cola)
  })

  it('con referencia inexistente o activa responde ENTRADA_NO_ENCONTRADA', () => {
    const activa: EntradaIpc = { ...conPendientes(9).pendientes[0]!, entradaId: 'activa' }
    const cola: EstadoCola = { ...conPendientes(1, 2), activa }
    const [p1] = pe(cola)
    const falla = (fn: () => unknown): void =>
      expect(fn).toThrowError(expect.objectContaining({ codigo: 'ENTRADA_NO_ENCONTRADA' }))
    falla(() => Cola.mover(cola, { entradaId: 'no', antesDe: null }))
    falla(() => Cola.mover(cola, { entradaId: p1.entradaId, antesDe: 'no' }))
    falla(() => Cola.mover(cola, { entradaId: p1.entradaId, antesDe: 'activa' }))
    falla(() => Cola.mover(cola, { entradaId: 'activa', antesDe: null }))
    expect(new ErrorCola('COLA_LLENA', 'x').name).toBe('ErrorCola')
  })
})

describe('cola.quitar, vaciar y candidata', () => {
  it('quitar devuelve la entrada que la seguía', () => {
    const cola = conPendientes(1, 2, 3)
    const [p1, , p3] = pe(cola)
    const a = Cola.quitar(cola, p1.entradaId)
    expect(a.antesDe).toBe(cola.pendientes[1]!.entradaId)
    expect(canciones(a.cola)).toEqual(['c2', 'c3'])
    expect(Cola.quitar(cola, p3.entradaId).antesDe).toBeNull()
    expect(() => Cola.quitar(cola, 'no')).toThrowError(
      expect.objectContaining({ codigo: 'ENTRADA_NO_ENCONTRADA' })
    )
  })

  it('quitar la activa la deja sin activa', () => {
    const cola: EstadoCola = {
      ...conPendientes(1),
      activa: { ...conPendientes(2).pendientes[0]!, entradaId: 'act' }
    }
    const r = Cola.quitar(cola, cola.activa!.entradaId)
    expect(r.cola.activa).toBeNull()
    expect(r.antesDe).toBeNull()
  })

  it('vaciar quita las pendientes y, si se pide, el contexto', () => {
    const entrada = conPendientes(5).pendientes[0]!
    const cola: EstadoCola = {
      ...conPendientes(1, 2),
      contexto: { entrada, posicionMs: null, pausada: false, terminada: true }
    }
    const sinContexto = Cola.vaciar(cola, { contexto: false })
    expect(sinContexto.pendientes).toEqual([])
    expect(sinContexto.contexto).not.toBeNull()
    expect(Cola.vaciar(sinContexto, { contexto: false })).toBe(sinContexto)
    expect(Cola.vaciar(cola, { contexto: true }).contexto).toBeNull()
    expect(Cola.vaciar(sinContexto, { contexto: true }).contexto).toBeNull()
    const vacia = Cola.colaVacia()
    expect(Cola.vaciar(vacia, { contexto: true })).toBe(vacia)
  })

  it('candidata es la primera pendiente aunque no esté disponible', () => {
    expect(Cola.candidata(Cola.colaVacia())).toBeNull()
    const cola = Cola.marcarDisponibilidad(conPendientes(1, 2), 'c1', 'sin_pistas')
    expect(Cola.candidata(cola)?.cancionId).toBe('c1')
    expect(Cola.candidata(cola)?.disponibilidad).toBe('sin_pistas')
  })
})

describe('cola: biblioteca', () => {
  it('marca y restablece la disponibilidad de todas las entradas de la canción', () => {
    const cola = conPendientes(1, 2, 1)
    const marcada = Cola.marcarDisponibilidad(cola, 'c1', 'no_lista')
    expect(marcada.pendientes.map((p) => p.disponibilidad)).toEqual(['no_lista', 'ok', 'no_lista'])
    expect(Cola.marcarDisponibilidad(marcada, 'c1', 'no_lista')).toBe(marcada)
    expect(Cola.marcarDisponibilidad(cola, 'zzz', 'no_lista')).toBe(cola)
    const restablecida = Cola.marcarDisponibilidad(marcada, 'c1', 'ok')
    expect(restablecida.pendientes.every((p) => p.disponibilidad === 'ok')).toBe(true)
  })

  it('quitarCancion quita sus pendientes y el contexto de esa canción', () => {
    const base = conPendientes(1, 2, 1)
    const cola: EstadoCola = {
      ...base,
      contexto: { entrada: base.pendientes[0]!, posicionMs: 5, pausada: false, terminada: false }
    }
    const r = Cola.quitarCancion(cola, 'c1')
    expect(canciones(r)).toEqual(['c2'])
    expect(r.contexto).toBeNull()
    expect(Cola.quitarCancion(cola, 'zzz')).toBe(cola)
    const soloContexto = Cola.quitarCancion({ ...Cola.colaVacia(), contexto: cola.contexto }, 'c1')
    expect(soloContexto.contexto).toBeNull()
    expect(Cola.quitarCancion(cola, 'c2').contexto).toBe(cola.contexto)
  })

  it('actualizarTitulos cambia activa, pendientes y contexto', () => {
    const base = conPendientes(1, 2)
    const cola: EstadoCola = {
      activa: { ...base.pendientes[0]!, entradaId: 'act' },
      pendientes: base.pendientes,
      contexto: {
        entrada: { ...base.pendientes[0]!, entradaId: 'ctx' },
        posicionMs: null,
        pausada: false,
        terminada: true
      }
    }
    const r = Cola.actualizarTitulos(cola, 'c1', 'Nuevo', 'Otro')
    expect(r.activa?.titulo).toBe('Nuevo')
    expect(r.pendientes[0]!.artista).toBe('Otro')
    expect(r.pendientes[1]!.titulo).toBe('T2')
    expect(r.contexto?.entrada.titulo).toBe('Nuevo')
    expect(Cola.actualizarTitulos(r, 'c1', 'Nuevo', 'Otro')).toBe(r)
    expect(Cola.actualizarTitulos(cola, 'zzz', 'x', 'y')).toBe(cola)
    const soloCtx = Cola.actualizarTitulos(
      { ...Cola.colaVacia(), contexto: cola.contexto },
      'c1',
      'N',
      'A'
    )
    expect(soloCtx.contexto?.entrada.titulo).toBe('N')
    const soloAct = Cola.actualizarTitulos(
      { ...Cola.colaVacia(), activa: cola.activa },
      'c1',
      'N',
      'A'
    )
    expect(soloAct.activa?.titulo).toBe('N')
  })
})
