import { describe, expect, it, vi } from 'vitest'
import { CANALES } from '../../shared'
import { crearManejadores, type DependenciasIpc, type FuenteLoteIpc } from './handlers'

/** Los canales del lote (0314) llaman al servicio con argumentos válidos (el rol lo exige `ROLES_POR_CANAL`). */
function montar(lote?: Partial<FuenteLoteIpc>, youtube?: { reintentar: () => Promise<void> }) {
  const servicio = {
    leerArchivos: vi.fn(() => Promise.resolve({ filas: [], rechazadas: 0 })),
    leerCarpeta: vi.fn(() => Promise.resolve(null)),
    infoLista: vi.fn(),
    lote: vi.fn(() => Promise.resolve({ creadas: [{ id: 'abc' }], omitidas: [] })),
    espacioLibre: vi.fn(() => Promise.resolve({ libreBytes: 42 as number | null })),
    reintentar: vi.fn(() => Promise.resolve(false)),
    cancelarLectura: vi.fn(),
    ...lote
  }
  const fuente = { cancelar: vi.fn(() => Promise.resolve()) }
  const deps = {
    lote: servicio,
    fuente,
    ...(youtube ? { youtube } : {})
  } as unknown as DependenciasIpc
  return { m: crearManejadores(deps), servicio, fuente }
}

describe('canales del lote (0314)', () => {
  it('leerArchivos y leerCarpeta pasan las rutas o ninguna (diálogo)', async () => {
    const { m, servicio } = montar()
    expect(await m[CANALES.fuente.leerArchivos]([{}])).toEqual({
      ok: true,
      valor: { filas: [], rechazadas: 0 }
    })
    expect(servicio.leerArchivos).toHaveBeenLastCalledWith(undefined)
    await m[CANALES.fuente.leerArchivos]([{ rutas: ['/a.mp3'] }])
    expect(servicio.leerArchivos).toHaveBeenLastCalledWith(['/a.mp3'])
    expect(await m[CANALES.fuente.leerCarpeta]([{}])).toEqual({ ok: true, valor: null })
    expect(await m[CANALES.fuente.leerArchivos]([{ rutas: [] }])).toMatchObject({
      ok: false,
      error: { codigo: 'ARGUMENTOS_NO_VALIDOS' }
    })
  })

  it('espacioLibre devuelve los bytes libres y no admite argumentos', async () => {
    const { m } = montar()
    expect(await m[CANALES.fuente.espacioLibre]([])).toEqual({
      ok: true,
      valor: { libreBytes: 42 }
    })
    expect(await m[CANALES.fuente.espacioLibre](['x'])).toMatchObject({
      ok: false,
      error: { codigo: 'ARGUMENTOS_NO_VALIDOS' }
    })
  })

  it('lote valida el contrato (50 como máximo, un metadato por entrada)', async () => {
    const { m, servicio } = montar()
    const ref = '3f2b8c64-5e0a-4d8e-9a39-7e6a1f0c2b11'
    const ok = await m[CANALES.fuente.lote]([
      {
        entradas: [{ tipo: 'archivo', ref }],
        metadatos: [{ titulo: 'Tema', artista: 'A', album: null }]
      }
    ])
    expect(ok).toEqual({ ok: true, valor: { creadas: [{ id: 'abc' }], omitidas: [] } })
    expect(servicio.lote).toHaveBeenCalledOnce()
    const desparejado = await m[CANALES.fuente.lote]([
      { entradas: [{ tipo: 'archivo', ref }], metadatos: [] }
    ])
    expect(desparejado).toMatchObject({ ok: false, error: { codigo: 'ARGUMENTOS_NO_VALIDOS' } })
    const muchas = await m[CANALES.fuente.lote]([
      {
        entradas: Array.from({ length: 51 }, () => ({ tipo: 'youtube', id: 'aaaaaaaaaaa' })),
        metadatos: Array.from({ length: 51 }, () => ({ titulo: 'x', artista: '', album: null }))
      }
    ])
    expect(muchas).toMatchObject({ ok: false, error: { codigo: 'ARGUMENTOS_NO_VALIDOS' } })
    expect(servicio.lote).toHaveBeenCalledOnce()
  })

  it('los errores con código llegan tal cual', async () => {
    const error = Object.assign(new Error('x'), { codigo: 'LISTA_NO_DISPONIBLE' })
    const { m } = montar({ infoLista: vi.fn(() => Promise.reject(error)) })
    expect(
      await m[CANALES.fuente.infoLista]([{ url: 'https://www.youtube.com/playlist?list=PL1' }])
    ).toMatchObject({ ok: false, error: { codigo: 'LISTA_NO_DISPONIBLE' } })
  })

  it('cancelar la importación sin id también cancela la lectura del lote', async () => {
    const { m, servicio, fuente } = montar()
    await m[CANALES.fuente.cancelarImportacion]([])
    expect(servicio.cancelarLectura).toHaveBeenCalledOnce()
    expect(fuente.cancelar).toHaveBeenCalledWith(undefined)
  })

  it('reintentar prueba primero el lote de archivos y, si no es suyo, YouTube', async () => {
    const youtube = { reintentar: vi.fn(() => Promise.resolve()) }
    const { m, servicio } = montar(undefined, youtube)
    await m[CANALES.fuente.reintentar](['abc'])
    expect(servicio.reintentar).toHaveBeenCalledWith('abc')
    expect(youtube.reintentar).toHaveBeenCalledOnce()
    vi.mocked(servicio.reintentar).mockResolvedValueOnce(true)
    await m[CANALES.fuente.reintentar](['abc'])
    expect(youtube.reintentar).toHaveBeenCalledOnce()
  })
})
