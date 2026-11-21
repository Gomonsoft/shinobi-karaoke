import {
  entrada,
  estadoP1,
  estadoP2,
  estadoP3,
  estadoP4,
  estadoP4FinDeCola,
  estadoP5,
  estadoP6,
  estadoSinCola
} from '@shared/__fixtures__/sesion'
import { aplicarEstado, datosIndicador, edicionBloqueada, haySesion } from './estadoSesion'

describe('aplicarEstado', () => {
  it('acepta el primer estado y las revisiones mayores', () => {
    const viejo = estadoP1({ revision: 5 })
    const nuevo = estadoP1({ revision: 6 })
    expect(aplicarEstado(null, viejo)).toBe(viejo)
    expect(aplicarEstado(viejo, nuevo)).toBe(nuevo)
  })

  it('descarta las revisiones menores o iguales a la vigente', () => {
    const vigente = estadoP1({ revision: 7 })
    expect(aplicarEstado(vigente, estadoSinCola({ revision: 6 }))).toBe(vigente)
    expect(aplicarEstado(vigente, estadoSinCola({ revision: 7 }))).toBe(vigente)
  })
})

describe('bloqueo de edición', () => {
  it('hay sesión en P1–P4 y no en P5, P6 ni sin cola', () => {
    for (const e of [estadoP1(), estadoP2(), estadoP3(), estadoP4(), estadoP4FinDeCola()]) {
      expect(haySesion(e)).toBe(true)
      expect(edicionBloqueada(e)).toBe(true)
    }
    for (const e of [estadoP5(), estadoP6(), estadoSinCola(), null]) {
      expect(edicionBloqueada(e)).toBe(false)
    }
  })
})

describe('datosIndicador', () => {
  it('sin sesión ni cola no hay indicador', () => {
    expect(datosIndicador(null)).toBeNull()
    expect(datosIndicador(estadoSinCola())).toBeNull()
  })

  it('muestra el texto de cada fase', () => {
    expect(datosIndicador(estadoP1())?.texto).toBe('En otra pantalla')
    const pausada = estadoP1()
    pausada.sesion!.fase = 'pausada'
    expect(datosIndicador(pausada)?.texto).toBe('En pausa')
    expect(datosIndicador(estadoP2())?.texto).toBe('Siguiente en 3 s')
    expect(datosIndicador(estadoP4())?.texto).toBe('En espera')
    expect(datosIndicador(estadoP4FinDeCola())?.texto).toBe('En espera')
    expect(datosIndicador(estadoP3())?.texto).toBe('Requiere atención')
  })

  it('redondea la cuenta hacia arriba', () => {
    const e = estadoP2()
    e.sesion!.transicion!.restanteMs = 2100
    expect(datosIndicador(e)?.texto).toBe('Siguiente en 3 s')
  })

  it('una incidencia con la sesión abierta pide atención', () => {
    const e = estadoP1()
    e.sesion!.incidencia = {
      tipo: 'pantalla_perdida',
      etiqueta: 'Pantalla 2',
      estabaEnPantallaCompleta: true
    }
    expect(datosIndicador(e)?.tipo).toBe('atencion')
  })

  it('sin sesión: «Cola n» con la cola; con una caída, atención', () => {
    expect(datosIndicador(estadoP5())).toMatchObject({
      tipo: 'cola',
      texto: 'Cola 2',
      aria: 'Cola: 2 pendientes. Ir a la cola.'
    })
    expect(datosIndicador(estadoP6())?.texto).toBe('Cola 2')
    const caida = estadoP5({ incidencia: { tipo: 'secundaria_caida' } })
    expect(datosIndicador(caida)?.tipo).toBe('atencion')
    const soloCaida = estadoSinCola({ incidencia: { tipo: 'secundaria_caida' } })
    expect(datosIndicador(soloCaida)?.tipo).toBe('atencion')
  })

  it('no cuenta la entrada activa como pendiente', () => {
    const e = estadoP6({ pendientes: [entrada(1)] })
    expect(datosIndicador(e)?.texto).toBe('Cola 1')
  })
})
