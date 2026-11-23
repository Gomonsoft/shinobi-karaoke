import { describe, expect, it, vi } from 'vitest'
import { CANALES } from '../../shared/canales'
import { configPredeterminada } from '../../shared/config'
import { crearManejadores, type DependenciasIpc } from './handlers'

const principal = { rol: 'principal' as const, sender: null }
const secundaria = { rol: 'secundaria' as const, sender: null }
const UUID = 'a0000000-0000-4000-8000-000000000001'

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

describe('acciones por lotes de la Biblioteca (0318)', () => {
  it('llaman al servicio con sus argumentos y devuelven su resultado', async () => {
    const lotes = {
      previsualizarDatos: vi.fn(() => ({ version: 'v', canciones: [] })),
      ejecutarDatos: vi.fn(async () => ({ resultados: [] })),
      previsualizarEliminar: vi.fn(() => ({ version: 'v', canciones: [] })),
      ejecutarEliminar: vi.fn(async () => ({ resultados: [] })),
      agregarACola: vi.fn(async () => ({ entradaIds: ['e'], omitidas: [] })),
      quitarDeCola: vi.fn(async () => ({ estado: {}, antesDe: null }))
    }
    const m = crearManejadores(deps({ lotes } as never))
    await m[CANALES.biblioteca.editarDatosVariasPrevisualizar](
      [{ ids: ['a', 'b'], album: null }],
      principal
    )
    expect(lotes.previsualizarDatos).toHaveBeenCalledWith(['a', 'b'], {
      artista: undefined,
      album: null
    })
    await m[CANALES.biblioteca.editarDatosVariasEjecutar](
      [{ ids: ['a'], artista: 'Ana', version: 'v' }],
      principal
    )
    expect(lotes.ejecutarDatos).toHaveBeenCalledWith(
      ['a'],
      { artista: 'Ana', album: undefined },
      'v'
    )
    await m[CANALES.biblioteca.eliminarVariasPrevisualizar]([{ ids: ['a'] }], principal)
    expect(lotes.previsualizarEliminar).toHaveBeenCalledWith(['a'])
    await m[CANALES.biblioteca.eliminarVariasEjecutar]([{ ids: ['a'], version: 'v' }], principal)
    expect(lotes.ejecutarEliminar).toHaveBeenCalledWith(['a'], 'v')
    expect(await m[CANALES.cola.agregarVarias]([{ ids: ['a', 'b'] }], principal)).toEqual({
      ok: true,
      valor: { entradaIds: ['e'], omitidas: [] }
    })
    expect(lotes.agregarACola).toHaveBeenCalledWith(['a', 'b'])
    await m[CANALES.cola.quitarVarias]([{ entradaIds: [UUID] }], principal)
    expect(lotes.quitarDeCola).toHaveBeenCalledWith([UUID])
  })

  it('los ids repetidos de una petición se quedan en uno, en su orden', async () => {
    const lotes = {
      previsualizarEliminar: vi.fn(() => ({ version: 'v', canciones: [] }))
    }
    const m = crearManejadores(deps({ lotes } as never))
    await m[CANALES.biblioteca.eliminarVariasPrevisualizar](
      [{ ids: ['b', 'a', 'b', 'a'] }],
      principal
    )
    expect(lotes.previsualizarEliminar).toHaveBeenCalledWith(['b', 'a'])
  })

  it('validan los argumentos, exigen la principal y fallan sin servicio', async () => {
    const m = crearManejadores(deps({ lotes: {} as never }))
    expect(
      await m[CANALES.biblioteca.eliminarVariasEjecutar]([{ ids: [], version: 'v' }], principal)
    ).toMatchObject({
      error: { codigo: 'ARGUMENTOS_NO_VALIDOS' }
    })
    expect(
      await m[CANALES.biblioteca.eliminarVariasEjecutar]([{ ids: ['a'], version: 'v' }], secundaria)
    ).toMatchObject({ ok: false })
    const sin = crearManejadores(deps({}))
    expect(await sin[CANALES.cola.agregarVarias]([{ ids: ['a'] }], principal)).toMatchObject({
      error: { codigo: 'ERROR_INTERNO' }
    })
  })

  it('CONFIRMACION_OBSOLETA viaja con la vista previa nueva serializada', async () => {
    const error = Object.assign(new Error('La selección cambió'), {
      codigo: 'CONFIRMACION_OBSOLETA',
      detalles: { version: 'nueva', canciones: [] }
    })
    const m = crearManejadores(
      deps({ lotes: { ejecutarEliminar: vi.fn(() => Promise.reject(error)) } as never })
    )
    const r = await m[CANALES.biblioteca.eliminarVariasEjecutar](
      [{ ids: ['a'], version: 'v' }],
      principal
    )
    expect(r).toMatchObject({ ok: false, error: { codigo: 'CONFIRMACION_OBSOLETA' } })
    const detalles = r.ok === false ? r.error.detalles : undefined
    expect(JSON.parse(detalles ?? '{}')).toEqual({ version: 'nueva', canciones: [] })
  })
})

describe('exportar varias canciones (0319)', () => {
  it('destinoCarpeta, iniciarLote, cancelarLote y reintentarLote llaman al servicio', async () => {
    const exportacion = {
      destinoCarpeta: vi.fn(async () => null),
      iniciarLote: vi.fn(async () => ({ loteId: UUID, encoladas: [], omitidas: [] })),
      cancelarLote: vi.fn(async () => undefined),
      reintentarLote: vi.fn(async () => ({ loteId: UUID, encoladas: [], omitidas: [] }))
    }
    const m = crearManejadores(deps({ exportacion } as never))
    await m[CANALES.exportacion.destinoCarpeta]([{}], principal)
    expect(exportacion.destinoCarpeta).toHaveBeenCalledWith(undefined)
    await m[CANALES.exportacion.destinoCarpeta]([{ desdeCarpetaId: UUID }], principal)
    expect(exportacion.destinoCarpeta).toHaveBeenLastCalledWith(UUID)
    const peticion = {
      cancionIds: ['a'],
      formato: 'mkv_av1',
      ancho: 640,
      alto: 480,
      fps: 24,
      audio: 'instrumental',
      carpetaId: UUID,
      siExiste: 'numerar'
    }
    expect(await m[CANALES.exportacion.iniciarLote]([peticion], principal)).toMatchObject({
      ok: true
    })
    expect(exportacion.iniciarLote).toHaveBeenCalledWith(peticion)
    await m[CANALES.exportacion.cancelarLote]([{ loteId: UUID }], principal)
    expect(exportacion.cancelarLote).toHaveBeenCalledWith(UUID)
    await m[CANALES.exportacion.reintentarLote]([{ loteId: UUID }], principal)
    expect(exportacion.reintentarLote).toHaveBeenCalledWith(UUID)
    // Un perfil que no existe y la ventana secundaria se rechazan antes de llegar al servicio.
    expect(
      await m[CANALES.exportacion.iniciarLote]([{ ...peticion, alto: 481 }], principal)
    ).toMatchObject({ error: { codigo: 'ARGUMENTOS_NO_VALIDOS' } })
    expect(await m[CANALES.exportacion.cancelarLote]([{ loteId: UUID }], secundaria)).toMatchObject(
      {
        ok: false
      }
    )
    expect(exportacion.iniciarLote).toHaveBeenCalledTimes(1)
  })
})
