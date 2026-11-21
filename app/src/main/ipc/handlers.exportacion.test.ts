import { describe, expect, it, vi } from 'vitest'
import { CANALES } from '../../shared/canales'
import { configPredeterminada } from '../../shared/config'
import {
  ID_DESTINO,
  ID_TRABAJO,
  exportacionCompletada
} from '../../shared/__fixtures__/exportacion'
import {
  crearManejadores,
  registrarIpc,
  type DependenciasIpc,
  type ExportacionServicioIpc,
  type IpcMainLike
} from './handlers'

const principal = { rol: 'principal' as const, sender: null }
const ventanaExportacion = { rol: 'exportacion' as const, sender: null }

function servicioFalso() {
  const oyentes = {
    cambio: [] as ((e: unknown) => void)[],
    progreso: [] as ((e: unknown) => void)[],
    aviso: [] as ((e: unknown) => void)[]
  }
  const baja = vi.fn()
  const servicio = {
    perfiles: vi.fn(async () => ({ formatos: [], perfiles: [] })),
    estimar: vi.fn(() => ({ bytes: 1, segundos: 2 })),
    destinoPropuesto: vi.fn(async () => ({
      destinoId: ID_DESTINO,
      ruta: '/v/a.mkv',
      existe: false,
      libreBytes: null,
      carpetaRecordadaNoDisponible: false
    })),
    elegirDestino: vi.fn(async () => null),
    iniciar: vi.fn(async () => ({ trabajoId: ID_TRABAJO })),
    cancelar: vi.fn(async () => undefined),
    cancelarTodas: vi.fn(async () => undefined),
    estado: vi.fn(() => [exportacionCompletada()]),
    mostrarEnCarpeta: vi.fn(async () => undefined),
    avisosPendientes: vi.fn(() => []),
    suscribir: vi.fn((cb: (e: unknown) => void) => {
      oyentes.cambio.push(cb)
      return baja
    }),
    suscribirProgreso: vi.fn((cb: (e: unknown) => void) => {
      oyentes.progreso.push(cb)
      return baja
    }),
    suscribirAviso: vi.fn((cb: (e: unknown) => void) => {
      oyentes.aviso.push(cb)
      return baja
    })
  }
  return { servicio, oyentes, baja }
}

function deps(servicio?: ExportacionServicioIpc): DependenciasIpc {
  const config = configPredeterminada()
  return {
    ...(servicio ? { exportacion: servicio } : {}),
    ventanaExportacion: () => ({ inicial: vi.fn(), confirmarListo: vi.fn() }) as never,
    biblioteca: { suscribir: vi.fn(() => vi.fn()) },
    config: { obtener: () => config, suscribir: vi.fn(() => vi.fn()) },
    trabajos: { suscribir: vi.fn(() => vi.fn()), suscribirProgreso: vi.fn(() => vi.fn()) },
    runtime: {
      instalar: vi.fn(),
      alProgreso: vi.fn(() => vi.fn()),
      alCambiar: vi.fn(() => vi.fn())
    }
  } as unknown as DependenciasIpc
}

describe('canales de exportación', () => {
  it('cada canal llama al servicio con sus argumentos', async () => {
    const { servicio } = servicioFalso()
    const m = crearManejadores(deps(servicio as never))
    const iniciar = {
      cancionId: 'c1',
      formato: 'mkv_av1',
      ancho: 640,
      alto: 480,
      fps: 24,
      audio: 'instrumental',
      destinoId: ID_DESTINO
    }
    expect(await m[CANALES.exportacion.perfiles]([], principal)).toMatchObject({ ok: true })
    await m[CANALES.exportacion.estimar](
      [
        {
          cancionId: 'c1',
          formato: 'mkv_av1',
          ancho: 640,
          alto: 480,
          fps: 24,
          audio: 'instrumental'
        }
      ],
      principal
    )
    expect(servicio.estimar).toHaveBeenCalledOnce()
    await m[CANALES.exportacion.destinoPropuesto](
      [{ cancionId: 'c1', formato: 'webm_vp9', desdeTrabajoId: ID_TRABAJO }],
      principal
    )
    expect(servicio.destinoPropuesto).toHaveBeenCalledWith({
      cancionId: 'c1',
      formato: 'webm_vp9',
      desdeTrabajoId: ID_TRABAJO
    })
    await m[CANALES.exportacion.elegirDestino]([{ destinoId: ID_DESTINO }], principal)
    expect(servicio.elegirDestino).toHaveBeenCalledWith(ID_DESTINO)
    expect(await m[CANALES.exportacion.iniciar]([iniciar], principal)).toEqual({
      ok: true,
      valor: { trabajoId: ID_TRABAJO }
    })
    await m[CANALES.exportacion.cancelar]([{ trabajoId: ID_TRABAJO }], principal)
    expect(servicio.cancelar).toHaveBeenCalledWith(ID_TRABAJO)
    expect(await m[CANALES.exportacion.estado]([], principal)).toMatchObject({ ok: true })
    await m[CANALES.exportacion.mostrarEnCarpeta]([{ avisoId: ID_TRABAJO }], principal)
    expect(servicio.mostrarEnCarpeta).toHaveBeenCalledWith({ avisoId: ID_TRABAJO })
    expect(await m[CANALES.exportacion.avisosPendientes]([], principal)).toEqual({
      ok: true,
      valor: []
    })
  })

  it('un error del servicio llega con su código', async () => {
    const { servicio } = servicioFalso()
    servicio.iniciar.mockRejectedValueOnce(
      Object.assign(new Error('otra'), { codigo: 'DESTINO_OCUPADO' })
    )
    const m = crearManejadores(deps(servicio as never))
    expect(
      await m[CANALES.exportacion.iniciar](
        [
          {
            cancionId: 'c1',
            formato: 'mkv_av1',
            ancho: 640,
            alto: 480,
            fps: 24,
            audio: 'instrumental',
            destinoId: ID_DESTINO
          }
        ],
        principal
      )
    ).toMatchObject({ ok: false, error: { codigo: 'DESTINO_OCUPADO' } })
  })

  it('valida los argumentos antes de llamar al servicio', async () => {
    const { servicio } = servicioFalso()
    const m = crearManejadores(deps(servicio as never))
    expect(
      await m[CANALES.exportacion.mostrarEnCarpeta]([{ ruta: '/etc/passwd' }], principal)
    ).toMatchObject({ ok: false, error: { codigo: 'ARGUMENTOS_NO_VALIDOS' } })
    expect(servicio.mostrarEnCarpeta).not.toHaveBeenCalled()
  })

  it('cada canal solo responde a su rol', async () => {
    const { servicio } = servicioFalso()
    const m = crearManejadores(deps(servicio as never))
    const secundaria = { rol: 'secundaria' as const, sender: null }
    expect(await m[CANALES.exportacion.estado]([], secundaria)).toMatchObject({
      ok: false,
      error: { codigo: 'ARGUMENTOS_NO_VALIDOS' }
    })
    expect(await m[CANALES.exportacion.estado]([], ventanaExportacion)).toMatchObject({ ok: false })
    expect(servicio.estado).not.toHaveBeenCalled()
    expect(await m[CANALES.exportacion.inicial]([], principal)).toMatchObject({ ok: false })
    expect(
      await m[CANALES.exportacion.listo]([{ trabajoId: ID_TRABAJO, n: 0 }], principal)
    ).toMatchObject({ ok: false })
    expect(await m[CANALES.exportacion.inicial]([], ventanaExportacion)).toMatchObject({ ok: true })
  })

  it('sin servicio responde ERROR_INTERNO', async () => {
    const m = crearManejadores(deps())
    expect(await m[CANALES.exportacion.perfiles]([], principal)).toMatchObject({
      ok: false,
      error: { codigo: 'ERROR_INTERNO' }
    })
  })

  it('«Reparar el motor» cancela antes las exportaciones', async () => {
    const { servicio } = servicioFalso()
    const d = deps(servicio as never)
    const m = crearManejadores(d)
    expect(await m[CANALES.runtime.instalar]([])).toMatchObject({ ok: true })
    expect(servicio.cancelarTodas).toHaveBeenCalledOnce()
    expect(d.runtime.instalar).toHaveBeenCalledOnce()
    const orden = servicio.cancelarTodas.mock.invocationCallOrder[0]!
    expect(vi.mocked(d.runtime.instalar).mock.invocationCallOrder[0]!).toBeGreaterThan(orden)
  })

  it('reenvía los eventos de la exportación a la principal y los da de baja', () => {
    const { servicio, oyentes, baja } = servicioFalso()
    const enviarA = vi.fn()
    const ipc: IpcMainLike = { handle: vi.fn(), removeHandler: vi.fn() }
    const desregistrar = registrarIpc(ipc, deps(servicio as never), { enviarA })
    oyentes.cambio[0]!({ a: 1 })
    oyentes.progreso[0]!({ b: 2 })
    oyentes.aviso[0]!({ c: 3 })
    expect(enviarA).toHaveBeenCalledWith('principal', CANALES.eventos.exportacionCambio, { a: 1 })
    expect(enviarA).toHaveBeenCalledWith('principal', CANALES.eventos.exportacionProgreso, { b: 2 })
    expect(enviarA).toHaveBeenCalledWith('principal', CANALES.eventos.exportacionAviso, { c: 3 })
    desregistrar()
    expect(baja).toHaveBeenCalledTimes(3)
  })
})
