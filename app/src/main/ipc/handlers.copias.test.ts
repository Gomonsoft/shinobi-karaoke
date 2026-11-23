import { describe, expect, it, vi } from 'vitest'
import { CANALES } from '../../shared/canales'
import { configPredeterminada } from '../../shared/config'
import { ErrorPaquete } from '../copias'
import { crearManejadores, type DependenciasIpc } from './handlers'

const principal = { rol: 'principal' as const, sender: null }
const UUID = 'a0000000-0000-4000-8000-000000000001'
const UUID2 = 'a0000000-0000-4000-8000-000000000002'

function deps(extra: Partial<DependenciasIpc>): DependenciasIpc {
  const config = configPredeterminada()
  return {
    biblioteca: { suscribir: vi.fn(() => vi.fn()) },
    config: { obtener: () => config, suscribir: vi.fn(() => vi.fn()) },
    trabajos: { suscribir: vi.fn(() => vi.fn()), suscribirProgreso: vi.fn(() => vi.fn()) },
    runtime: {
      instalar: vi.fn(),
      alProgreso: vi.fn(() => vi.fn()),
      alCambiar: vi.fn(() => vi.fn())
    },
    ...extra
  } as unknown as DependenciasIpc
}

describe('canales de copias y de exportar la letra', () => {
  it('llaman al servicio con sus argumentos y devuelven su resultado', async () => {
    const copias = {
      destinoPropuesto: vi.fn(async () => ({ destinoId: UUID })),
      elegirDestino: vi.fn(async () => null),
      exportarCanciones: vi.fn(async () => ({ trabajoId: UUID2 })),
      exportarBiblioteca: vi.fn(async () => ({ trabajoId: UUID2 })),
      elegirOrigen: vi.fn(async () => null),
      leer: vi.fn(async () => ({ tipo: 'paquete' })),
      importar: vi.fn(async () => ({ trabajoId: UUID2 })),
      origenDesdeRuta: vi.fn(async () => null),
      cancelar: vi.fn()
    }
    const lrc = {
      exportarUna: vi.fn(async () => null),
      exportarVarias: vi.fn(async () => null),
      mostrarEnCarpeta: vi.fn()
    }
    const m = crearManejadores(deps({ copias, lrc } as never))
    expect(
      await m[CANALES.copias.exportarCanciones](
        [{ ids: ['c1'], conAudio: false, destinoId: UUID }],
        principal
      )
    ).toEqual({ ok: true, valor: { trabajoId: UUID2 } })
    expect(copias.exportarCanciones).toHaveBeenCalledWith({
      ids: ['c1'],
      conAudio: false,
      destinoId: UUID
    })
    await m[CANALES.copias.leer]([{ origenId: UUID }], principal)
    expect(copias.leer).toHaveBeenCalledWith(UUID)
    expect(
      await m[CANALES.copias.importar](
        [{ origenId: UUID, conflictos: 'omitir', ajustes: false }],
        principal
      )
    ).toEqual({ ok: true, valor: { trabajoId: UUID2 } })
    await m[CANALES.copias.origenDesdeRuta]([{ ruta: '/tmp/a.shinobi' }], principal)
    expect(copias.origenDesdeRuta).toHaveBeenCalledWith('/tmp/a.shinobi')
    await m[CANALES.copias.cancelar]([{ trabajoId: UUID }], principal)
    expect(copias.cancelar).toHaveBeenCalledWith(UUID)
    expect(await m[CANALES.letras.exportarLrc]([{ cancionId: 'c1' }], principal)).toEqual({
      ok: true,
      valor: null
    })
    await m[CANALES.letras.exportarLrcVarias]([{ ids: ['c1', 'c2'] }], principal)
    expect(lrc.exportarVarias).toHaveBeenCalledWith(['c1', 'c2'])
    await m[CANALES.letras.mostrarEnCarpeta]([{ ubicacionId: UUID }], principal)
    expect(lrc.mostrarEnCarpeta).toHaveBeenCalledWith(UUID)
  })

  it('un error del servicio llega con su código; los argumentos inválidos se rechazan', async () => {
    const copias = {
      leer: vi.fn(async () => {
        throw new ErrorPaquete('PAQUETE_INCOMPLETO', 'cortado')
      })
    }
    const m = crearManejadores(deps({ copias } as never))
    expect(await m[CANALES.copias.leer]([{ origenId: UUID }], principal)).toMatchObject({
      ok: false,
      error: { codigo: 'PAQUETE_INCOMPLETO' }
    })
    expect(await m[CANALES.copias.leer]([{ origenId: '../x' }], principal)).toMatchObject({
      ok: false,
      error: { codigo: 'ARGUMENTOS_NO_VALIDOS' }
    })
    // Sin servicio, ya no responde «No implementado» de la 0339 sino ERROR_INTERNO por falta de servicio.
    expect(
      await crearManejadores(deps({}))[CANALES.copias.leer]([{ origenId: UUID }], principal)
    ).toMatchObject({ ok: false, error: { codigo: 'ERROR_INTERNO' } })
  })
})
