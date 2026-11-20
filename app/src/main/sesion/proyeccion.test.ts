import { describe, expect, it } from 'vitest'
import { estiloPredeterminado } from '../../shared/estilo'
import { estadoSecundariaIpcSchema, estadoSesionIpcSchema } from '../../shared/sesion'
import { crearEstado, reducir, type EstadoMaquina, type Evento } from './maquina'
import { aIpcPrincipal, aIpcSecundaria } from './proyeccion'

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const SESION = uuid(1)

function ejecutar(eventos: Evento[], ahora = 0): EstadoMaquina {
  let contador = 0
  let estado = crearEstado({ nuevoId: () => uuid(100 + ++contador), transicionS: () => 4 })
  for (const e of eventos) estado = reducir(estado, e, ahora).estado
  return estado
}
const agregar = (n: number): Evento => ({
  tipo: 'agregar',
  cancionId: `c${n}`,
  titulo: `T${n}`,
  artista: `A${n}`,
  donde: 'final'
})

describe('proyecciones', () => {
  it('sin sesión: principal con la cola y secundaria nula', () => {
    const e = ejecutar([agregar(1)])
    const p = aIpcPrincipal(e, 0)
    expect(estadoSesionIpcSchema.parse(p)).toEqual(p)
    expect(p.sesion).toBeNull()
    expect(p.activa).toBeNull()
    expect(p.pendientes).toHaveLength(1)
    expect(aIpcSecundaria(e, 0)).toBeNull()
  })

  it('reproduciendo: activa con posición extrapolada y duración; ambos esquemas válidos', () => {
    const base = ejecutar([
      agregar(1),
      agregar(2),
      { tipo: 'abrir', sesionId: SESION, inicio: { tipo: 'cola' } }
    ])
    const listo = reducir(base, { tipo: 'documentoListo', sesionId: SESION }, 0).estado
    const id = listo.cola.activa!.entradaId
    let e = reducir(
      listo,
      { tipo: 'revalidada', entradaId: id, resultado: 'ok', duracionMs: 90_000 },
      0
    ).estado
    e = reducir(
      e,
      {
        tipo: 'informe',
        informe: { tipo: 'reproduciendo', sesionId: SESION, entradaId: id, posicionMs: 1000 }
      },
      0
    ).estado
    const p = aIpcPrincipal(e, 500)
    expect(estadoSesionIpcSchema.parse(p)).toEqual(p)
    expect(p.activa).toMatchObject({ cancionId: 'c1', posicionMs: 1500, duracionMs: 90_000 })
    const s = aIpcSecundaria(e, 500)!
    expect(estadoSecundariaIpcSchema.parse(s)).toEqual(s)
    expect(s).toMatchObject({
      fase: 'reproduciendo',
      candidata: null,
      hayPendientes: true,
      motivoFallo: null
    })
  })

  it('transición: restante calculado del reloj y candidata con el estilo resuelto', () => {
    let e = ejecutar([
      agregar(1),
      agregar(2),
      { tipo: 'abrir', sesionId: SESION, inicio: { tipo: 'cola' } }
    ])
    e = reducir(e, { tipo: 'documentoListo', sesionId: SESION }, 0).estado
    const id = e.cola.activa!.entradaId
    e = reducir(e, { tipo: 'revalidada', entradaId: id, resultado: 'ok' }, 0).estado
    e = reducir(
      e,
      { tipo: 'informe', informe: { tipo: 'reproduciendo', sesionId: SESION, entradaId: id } },
      0
    ).estado
    e = reducir(
      e,
      { tipo: 'informe', informe: { tipo: 'fin', sesionId: SESION, entradaId: id } },
      10_000
    ).estado

    const estilo = { ...estiloPredeterminado(), version: 1 as const }
    const consultados: string[] = []
    const s = aIpcSecundaria(e, 11_000, (cancionId) => {
      consultados.push(cancionId)
      return estilo
    })!
    expect(estadoSecundariaIpcSchema.parse(s)).toEqual(s)
    expect(consultados).toEqual(['c2'])
    expect(s.candidata).toMatchObject({ titulo: 'T2', artista: 'A2' })
    expect(s.transicion).toMatchObject({ restanteMs: 3000, duracionMs: 4000, congelada: false })
    expect(aIpcPrincipal(e, 20_000).sesion?.transicion?.restanteMs).toBe(0)
    // Sin estiloDe usa el predeterminado.
    expect(aIpcSecundaria(e, 11_000)!.candidata?.estilo).toEqual(estiloPredeterminado())
  })

  it('error: la secundaria recibe el motivo y no la candidata', () => {
    let e = ejecutar([agregar(1), { tipo: 'abrir', sesionId: SESION, inicio: { tipo: 'cola' } }])
    e = reducir(e, { tipo: 'documentoListo', sesionId: SESION }, 0).estado
    e = reducir(
      e,
      { tipo: 'revalidada', entradaId: e.cola.activa!.entradaId, resultado: 'sin_pistas' },
      0
    ).estado
    const s = aIpcSecundaria(e, 0)!
    expect(estadoSecundariaIpcSchema.parse(s)).toEqual(s)
    expect(s).toMatchObject({ fase: 'error', motivoFallo: 'sin_pistas', candidata: null })
    const p = aIpcPrincipal(e, 0)
    expect(estadoSesionIpcSchema.parse(p)).toEqual(p)
    expect(p.sesion?.error).toMatchObject({ motivo: 'sin_pistas', codigo: 'CANCION_NO_DISPONIBLE' })
  })

  it('un fallo sin detalle se proyecta como «otro»', () => {
    let e = ejecutar([agregar(1), { tipo: 'abrir', sesionId: SESION, inicio: { tipo: 'cola' } }])
    e = reducir(e, { tipo: 'documentoListo', sesionId: SESION }, 0).estado
    const sinError = { ...e, sesion: { ...e.sesion!, fase: 'error' as const, error: null } }
    expect(aIpcSecundaria(sinError, 0)?.motivoFallo).toBe('otro')
  })

  it('con el cierre pendiente la cuenta queda congelada en ambas proyecciones', () => {
    let e = ejecutar([
      agregar(1),
      agregar(2),
      agregar(3),
      { tipo: 'abrir', sesionId: SESION, inicio: { tipo: 'cola' } }
    ])
    e = reducir(e, { tipo: 'documentoListo', sesionId: SESION }, 0).estado
    const id = e.cola.activa!.entradaId
    e = reducir(e, { tipo: 'revalidada', entradaId: id, resultado: 'ok' }, 0).estado
    e = reducir(
      e,
      { tipo: 'informe', informe: { tipo: 'reproduciendo', sesionId: SESION, entradaId: id } },
      0
    ).estado
    e = reducir(
      e,
      { tipo: 'informe', informe: { tipo: 'fin', sesionId: SESION, entradaId: id } },
      0
    ).estado
    e = reducir(e, { tipo: 'solicitarCierre', origen: 'secundaria' }, 1600).estado
    for (const t of [1600, 6600]) {
      expect(aIpcPrincipal(e, t).sesion?.transicion).toMatchObject({
        restanteMs: 2400,
        congelada: true
      })
      expect(aIpcSecundaria(e, t)).toMatchObject({
        cierrePendiente: { origen: 'secundaria' },
        transicion: { restanteMs: 2400, congelada: true }
      })
    }
  })
})
