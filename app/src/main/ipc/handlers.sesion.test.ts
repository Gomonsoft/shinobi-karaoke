import { describe, expect, it, vi } from 'vitest'
import { CANALES, configPredeterminada } from '../../shared'
import { estadoS1, estadoP1 } from '../../shared/__fixtures__/sesion'
import {
  crearManejadores,
  registrarIpc,
  type ContextoIpc,
  type DependenciasIpc,
  type IpcMainLike
} from './handlers'

const ID = '00000000-0000-4000-8000-000000000001'
const PRINCIPAL: ContextoIpc = { rol: 'principal', sender: 'p' }
const SECUNDARIA: ContextoIpc = { rol: 'secundaria', sender: 's' }

function crear() {
  const sesion = {
    edicionBloqueada: vi.fn(() => false),
    cancionActiva: vi.fn<(id: string) => boolean>(() => false),
    esSecundariaVigente: vi.fn((sender: unknown) => sender === 's'),
    pantallas: vi.fn(() => ({ pantallas: [], colocacion: 'libre' })),
    estadoPrincipal: vi.fn(() => estadoP1()),
    estadoDelRol: vi.fn((rol: string) => (rol === 'principal' ? estadoP1() : estadoS1())),
    abrir: vi.fn(async () => estadoP1()),
    mostrar: vi.fn(),
    moverAPantalla: vi.fn(),
    fijarPantallaCompleta: vi.fn(),
    estaEnPantallaCompleta: vi.fn(() => true),
    transporte: vi.fn(),
    siguiente: vi.fn(async () => undefined),
    empezar: vi.fn(async () => undefined),
    detenerTransicion: vi.fn(async () => undefined),
    repetir: vi.fn(async () => undefined),
    forzarCierre: vi.fn(),
    solicitarCierre: vi.fn(async () => undefined),
    confirmarCierre: vi.fn(async () => undefined),
    cancelarCierre: vi.fn(async () => undefined),
    inicial: vi.fn(),
    informar: vi.fn(async () => ({ aplicado: true })),
    agregar: vi.fn(),
    mover: vi.fn(),
    quitar: vi.fn(),
    vaciar: vi.fn()
  }
  const resumen = { id: 'c', titulo: 'T' }
  const letras = {
    abrirEdicion: vi.fn(() => null),
    guardarTiempos: vi.fn(async () => resumen),
    guardar: vi.fn(async () => resumen),
    editarTexto: vi.fn(async () => resumen),
    leerArchivo: vi.fn(async () => ({}))
  }
  const biblioteca = {
    guardarApariencia: vi.fn(async () => resumen),
    marcarLista: vi.fn(async () => resumen),
    volverABorrador: vi.fn(async () => resumen),
    eliminar: vi.fn(async () => undefined)
  }
  const ventana = {
    modoReproductor: vi.fn(),
    fijarPantallaCompleta: vi.fn(),
    estaEnPantallaCompleta: vi.fn(() => false),
    suscribir: vi.fn(() => () => undefined)
  }
  const config = {
    obtener: vi.fn(() => configPredeterminada()),
    actualizar: vi.fn(async () => configPredeterminada()),
    suscribir: vi.fn(() => () => undefined)
  }
  const guardadoPendiente = vi.fn(() => false)
  const deps = {
    sesion,
    letras,
    biblioteca: { ...biblioteca, suscribir: vi.fn(() => () => undefined) },
    ventana,
    config,
    guardadoPendiente,
    trabajos: {
      suscribir: vi.fn(() => () => undefined),
      suscribirProgreso: vi.fn(() => () => undefined)
    },
    runtime: { alProgreso: vi.fn(() => () => undefined), alCambiar: vi.fn(() => () => undefined) }
  } as unknown as DependenciasIpc
  return { deps, sesion, letras, biblioteca, ventana, config, guardadoPendiente }
}

const codigo = (r: unknown) => (r as { error?: { codigo?: string } }).error?.codigo

describe('defensas de la sesión (ADR 0017 §9 y §11)', () => {
  const resumenEdicion = '5eed0000-0000-4000-8000-000000000020'
  const llamadasDeEdicion = (m: ReturnType<typeof crearManejadores>) => [
    () => m[CANALES.letras.abrirEdicion]([resumenEdicion]),
    () => m[CANALES.letras.leerArchivo]([]),
    () =>
      m[CANALES.letras.guardarTiempos]([
        {
          cancionId: resumenEdicion,
          offset_ms: 0,
          tiempos: [{ id: 'l1', inicio_ms: 1200, fin_ms: null, palabras: null }]
        },
        '00000000-0000-4000-8000-000000000009'
      ]),
    () =>
      m[CANALES.letras.guardar]([
        {
          cancionId: resumenEdicion,
          origen: 'manual',
          lrclib_id: null,
          lineas: [
            { id: 'l1', tipo: 'linea', texto: 'a', inicio_ms: null, fin_ms: null, palabras: null }
          ]
        }
      ]),
    () => m[CANALES.letras.editarTexto]([{ cancionId: resumenEdicion, texto: 'a' }]),
    () => m[CANALES.biblioteca.marcarLista]([resumenEdicion]),
    () => m[CANALES.biblioteca.guardarApariencia]([resumenEdicion, { modo: 'heredar' }])
  ]

  it('con sesión, las escrituras de edición responden EDICION_BLOQUEADA y no llegan al servicio', async () => {
    const { deps, sesion, letras, biblioteca } = crear()
    sesion.edicionBloqueada.mockReturnValue(true)
    const m = crearManejadores(deps)
    for (const llamar of llamadasDeEdicion(m)) {
      expect(codigo(await llamar())).toBe('EDICION_BLOQUEADA')
    }
    expect(letras.abrirEdicion).not.toHaveBeenCalled()
    expect(letras.leerArchivo).not.toHaveBeenCalled()
    expect(letras.guardarTiempos).not.toHaveBeenCalled()
    expect(letras.guardar).not.toHaveBeenCalled()
    expect(letras.editarTexto).not.toHaveBeenCalled()
    expect(biblioteca.marcarLista).not.toHaveBeenCalled()
    expect(biblioteca.guardarApariencia).not.toHaveBeenCalled()
  })

  it('tras cerrar, vuelven a funcionar', async () => {
    const { deps, sesion, letras, biblioteca } = crear()
    sesion.edicionBloqueada.mockReturnValue(true)
    const m = crearManejadores(deps)
    expect(codigo(await m[CANALES.biblioteca.marcarLista]([resumenEdicion]))).toBe(
      'EDICION_BLOQUEADA'
    )
    sesion.edicionBloqueada.mockReturnValue(false)
    expect(await m[CANALES.biblioteca.marcarLista]([resumenEdicion])).toMatchObject({ ok: true })
    expect(await m[CANALES.letras.abrirEdicion]([resumenEdicion])).toMatchObject({ ok: true })
    expect(biblioteca.marcarLista).toHaveBeenCalledOnce()
    expect(letras.abrirEdicion).toHaveBeenCalledOnce()
  })

  it('cerrar una visita de letra no se bloquea', async () => {
    const { deps, sesion, letras } = crear()
    sesion.edicionBloqueada.mockReturnValue(true)
    const m = crearManejadores({
      ...deps,
      letras: { ...letras, cerrarEdicion: vi.fn() } as never
    })
    expect(
      await m[CANALES.letras.cerrarEdicion](['00000000-0000-4000-8000-000000000009'])
    ).toMatchObject({ ok: true })
  })

  it('ventana.modoReproductor(true) responde SESION_EN_CURSO; salir del modo sigue funcionando', async () => {
    const { deps, sesion, ventana } = crear()
    sesion.edicionBloqueada.mockReturnValue(true)
    const m = crearManejadores(deps)
    expect(codigo(await m[CANALES.ventana.modoReproductor]([true]))).toBe('SESION_EN_CURSO')
    expect(ventana.modoReproductor).not.toHaveBeenCalled()
    expect(await m[CANALES.ventana.modoReproductor]([false])).toMatchObject({ ok: true })
    expect(ventana.modoReproductor).toHaveBeenCalledWith(false)
  })

  it('eliminar y volver a borrador la canción activa responden CANCION_EN_REPRODUCCION', async () => {
    const { deps, sesion, biblioteca } = crear()
    sesion.cancionActiva.mockImplementation((id: string) => id === 'activa')
    const m = crearManejadores(deps)
    expect(codigo(await m[CANALES.biblioteca.eliminar](['activa']))).toBe('CANCION_EN_REPRODUCCION')
    expect(codigo(await m[CANALES.biblioteca.volverABorrador](['activa']))).toBe(
      'CANCION_EN_REPRODUCCION'
    )
    expect(biblioteca.eliminar).not.toHaveBeenCalled()
    expect(biblioteca.volverABorrador).not.toHaveBeenCalled()
    expect(await m[CANALES.biblioteca.eliminar](['otra'])).toMatchObject({ ok: true })
    expect(biblioteca.eliminar).toHaveBeenCalledWith('otra')
  })

  it('sesion.abrir con un guardado pendiente responde GUARDADO_PENDIENTE y no abre nada', async () => {
    const { deps, sesion, guardadoPendiente } = crear()
    guardadoPendiente.mockReturnValue(true)
    const m = crearManejadores(deps)
    const peticion = { pantallaId: 1, pantallaCompleta: false, inicio: { tipo: 'cola' } }
    expect(codigo(await m[CANALES.sesion.abrir]([peticion]))).toBe('GUARDADO_PENDIENTE')
    expect(sesion.abrir).not.toHaveBeenCalled()
    guardadoPendiente.mockReturnValue(false)
    expect(await m[CANALES.sesion.abrir]([peticion])).toMatchObject({ ok: true })
    expect(sesion.abrir).toHaveBeenCalledOnce()
  })
})

describe('canales de sesión', () => {
  it('la secundaria recibe su estado reducido y la principal el completo', async () => {
    const { deps, sesion } = crear()
    const m = crearManejadores(deps)
    const desde = { desdeEntradaId: ID }
    expect(await m[CANALES.sesion.siguiente]([desde], PRINCIPAL)).toEqual({
      ok: true,
      valor: estadoP1()
    })
    expect(await m[CANALES.sesion.siguiente]([desde], SECUNDARIA)).toEqual({
      ok: true,
      valor: estadoS1()
    })
    expect(sesion.siguiente).toHaveBeenCalledTimes(2)
  })

  it('un webContents de otra sesión no puede actuar ni informar', async () => {
    const { deps, sesion } = crear()
    const m = crearManejadores(deps)
    const viejo: ContextoIpc = { rol: 'secundaria', sender: 'viejo' }
    expect(codigo(await m[CANALES.sesion.siguiente]([{ desdeEntradaId: ID }], viejo))).toBe(
      'SESION_NO_ACTIVA'
    )
    expect(codigo(await m[CANALES.sesion.solicitarCierre]([], viejo))).toBe('SESION_NO_ACTIVA')
    expect(codigo(await m[CANALES.sesion.preferencias]([], viejo))).toBe('SESION_NO_ACTIVA')
    expect(codigo(await m[CANALES.ventana.fijarPantallaCompleta]([true], viejo))).toBe(
      'SESION_NO_ACTIVA'
    )
    expect(sesion.siguiente).not.toHaveBeenCalled()
    // El informe se delega con el remitente: el servicio responde `aplicado: false`.
    sesion.informar.mockResolvedValue({ aplicado: false })
    const informe = { tipo: 'fin', sesionId: ID, entradaId: ID }
    expect(await m[CANALES.sesion.informar]([informe], viejo)).toEqual({
      ok: true,
      valor: { aplicado: false }
    })
    expect(sesion.informar).toHaveBeenCalledWith(informe, 'viejo')
  })

  it('la pantalla completa de la secundaria actúa sobre su ventana, no sobre la principal', async () => {
    const { deps, sesion, ventana } = crear()
    const m = crearManejadores(deps)
    await m[CANALES.ventana.fijarPantallaCompleta]([true], SECUNDARIA)
    expect(sesion.fijarPantallaCompleta).toHaveBeenCalledWith(true)
    expect(ventana.fijarPantallaCompleta).not.toHaveBeenCalled()
    await m[CANALES.ventana.fijarPantallaCompleta]([true], PRINCIPAL)
    expect(ventana.fijarPantallaCompleta).toHaveBeenCalledWith(true)
    expect(await m[CANALES.ventana.estaEnPantallaCompleta]([], SECUNDARIA)).toEqual({
      ok: true,
      valor: true
    })
  })

  it('las preferencias de la secundaria solo escriben `config.reproductor`', async () => {
    const { deps, config } = crear()
    const m = crearManejadores(deps)
    await m[CANALES.sesion.guardarPreferencias]([{ volumen: 0.5 }], SECUNDARIA)
    expect(config.actualizar).toHaveBeenCalledWith({ reproductor: { volumen: 0.5 } })
    // Un parcial con `transicion_s` o `secundaria` no pasa la validación.
    expect(
      codigo(await m[CANALES.sesion.guardarPreferencias]([{ transicion_s: 5 }], SECUNDARIA))
    ).toBe('ARGUMENTOS_NO_VALIDOS')
  })

  it('sin servicio de sesión, los canales responden ERROR_INTERNO', async () => {
    const { deps } = crear()
    const m = crearManejadores({ ...deps, sesion: undefined })
    expect(codigo(await m[CANALES.sesion.estado]([]))).toBe('ERROR_INTERNO')
    expect(codigo(await m[CANALES.cola.vaciar]([{ contexto: true }]))).toBe('ERROR_INTERNO')
  })
})

describe('registrarIpc y la sesión', () => {
  it('pasa el rol y el remitente al manejador y envía `config.reproductor` a la secundaria solo si cambia', async () => {
    const { deps, sesion, config } = crear()
    const manejadores = new Map<string, (e: unknown, ...a: unknown[]) => unknown>()
    const ipc: IpcMainLike = {
      handle: (c, f) => void manejadores.set(c, f),
      removeHandler: () => undefined
    }
    let emitirConfig: ((c: ReturnType<typeof configPredeterminada>) => void) | undefined
    config.suscribir.mockImplementation(((cb: typeof emitirConfig) => {
      emitirConfig = cb
      return () => undefined
    }) as never)
    const enviarA = vi.fn()
    registrarIpc(ipc, deps, {
      remitenteValido: () => true,
      rolDe: (e) => ((e as { sender: string }).sender === 's' ? 'secundaria' : 'principal'),
      enviarA
    })
    await manejadores.get(CANALES.sesion.siguiente)!({ sender: 's' }, { desdeEntradaId: ID })
    expect(sesion.estadoDelRol).toHaveBeenLastCalledWith('secundaria')
    await manejadores.get(CANALES.sesion.siguiente)!({ sender: 'p' }, { desdeEntradaId: ID })
    expect(sesion.estadoDelRol).toHaveBeenLastCalledWith('principal')

    const igual = configPredeterminada()
    emitirConfig!(igual)
    expect(enviarA).not.toHaveBeenCalledWith('secundaria', expect.anything(), expect.anything())
    const otra = configPredeterminada()
    otra.reproductor.volumen = 0.2
    emitirConfig!(otra)
    expect(enviarA).toHaveBeenCalledWith(
      'secundaria',
      CANALES.eventos.sesionPreferencias,
      otra.reproductor
    )
  })
})
