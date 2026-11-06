import { describe, expect, it, vi } from 'vitest'
import { MotorReproductor, type ModoAudio } from './motorReproductor'
import { urlPista } from './pistas'

function respuestaPendiente() {
  let resolve!: (respuesta: Response) => void
  const promise = new Promise<Response>((resolver) => {
    resolve = resolver
  })
  return { promise, resolve }
}

function doble(modo: ModoAudio = 'karaoke', conMarca = true) {
  const ganancia = () => ({ gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() })
  const fuente = () => ({
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null
  })
  const ganancias: ReturnType<typeof ganancia>[] = []
  const fuentes: ReturnType<typeof fuente>[] = []
  const latencia = 0.04
  const contexto = {
    currentTime: 1,
    state: 'suspended',
    baseLatency: 0.01,
    outputLatency: 0.03,
    getOutputTimestamp: conMarca
      ? () => ({ contextTime: contexto.currentTime - latencia, performanceTime: 1234 })
      : undefined,
    decodeAudioData: vi.fn(async () => ({ duration: 30 })),
    createGain: () => {
      const nueva = ganancia()
      ganancias.push(nueva)
      return nueva
    },
    destination: {},
    createBufferSource: () => {
      const nueva = fuente()
      fuentes.push(nueva)
      return nueva
    },
    resume: vi.fn(async () => {
      contexto.state = 'running'
    }),
    close: vi.fn(async () => {
      contexto.state = 'closed'
    })
  }
  const cargar = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([1, 2, 3])))
  const motor = new MotorReproductor({
    modo,
    cancionId: 'prueba',
    gananciaDb: -6,
    volumen: 0.6,
    silenciado: false,
    volumenVoz: 0.3,
    vozSilenciada: true,
    crearContexto: () => contexto as unknown as AudioContext,
    fetch: cargar,
    ahoraPerf: () => 1234
  })
  return { motor, contexto, fuentes, cargar, ganancias }
}

describe('MotorReproductor', () => {
  it('carga las dos pistas en paralelo y espera a que la voz termine antes de empezar', async () => {
    const { motor, fuentes, cargar, contexto } = doble()
    const voz = respuestaPendiente()
    cargar.mockImplementation(async (url) =>
      url === urlPista('prueba', 'voz') ? voz.promise : new Response()
    )
    const cargarPistas = motor.cargar()
    const reproduccion = motor.reproducir()
    await vi.waitFor(() => expect(contexto.decodeAudioData).toHaveBeenCalledOnce())
    expect(cargar.mock.calls.map(([url]) => url)).toEqual([
      urlPista('prueba', 'instrumental'),
      urlPista('prueba', 'voz')
    ])
    expect(motor.estado()).toMatchObject({ cargando: true, listo: false, sonando: false })
    expect(fuentes).toHaveLength(0)

    voz.resolve(new Response())
    await Promise.all([cargarPistas, reproduccion])
    expect(motor.estado()).toMatchObject({
      cargando: false,
      listo: true,
      sonando: true,
      vozDisponible: true,
      duracionMs: 30_000
    })
    expect(fuentes).toHaveLength(2)
    for (const fuente of fuentes) expect(fuente.start).toHaveBeenCalledWith(1, 0)
  })

  it('mezcla las pistas con ganancias independientes sin reiniciar las fuentes', async () => {
    const { motor, contexto, fuentes, ganancias } = doble()
    await motor.reproducir()
    const [maestra, voz] = ganancias
    expect(fuentes[0]?.connect).toHaveBeenCalledWith(maestra)
    expect(fuentes[1]?.connect).toHaveBeenCalledWith(voz)
    expect(maestra?.connect).toHaveBeenCalledWith(contexto.destination)
    expect(voz?.connect).toHaveBeenCalledWith(maestra)
    expect(maestra?.gain.value).toBeCloseTo(10 ** (-6 / 20) * 0.6)
    expect(voz?.gain.value).toBe(0)

    motor.fijarVoz(0.55, false)
    motor.fijarVolumen(0.8, true)
    expect(voz?.gain.value).toBe(0.55)
    expect(maestra?.gain.value).toBe(0)
    motor.fijarVolumen(0.8, false)
    expect(maestra?.gain.value).toBeCloseTo(10 ** (-6 / 20) * 0.8)
    expect(fuentes).toHaveLength(2)
    for (const fuente of fuentes) expect(fuente.stop).not.toHaveBeenCalled()
  })

  it.each([true, false])('ancla la posición audible con marca de salida=%s', async (conMarca) => {
    const { motor, contexto, fuentes } = doble('karaoke', conMarca)
    function comprobarPosicion(esperada: number) {
      expect(Math.abs(motor.posicionMs() - esperada)).toBeLessThanOrEqual(20)
    }
    await motor.reproducir({ desdeMs: -1500 })
    comprobarPosicion(-1500)
    expect(motor.estado().sonando).toBe(true)
    for (const fuente of fuentes) expect(fuente.start).toHaveBeenCalledWith(2.5, 0)

    contexto.currentTime = 1.54
    motor.pausar()
    for (const fuente of fuentes) expect(fuente.stop).toHaveBeenCalledOnce()
    contexto.currentTime = 3
    comprobarPosicion(-1000)
    await motor.reproducir()
    for (const fuente of fuentes.slice(2)) expect(fuente.start).toHaveBeenCalledWith(4, 0)
    contexto.currentTime = 4.03
    comprobarPosicion(-10)
    contexto.currentTime = 4.05
    comprobarPosicion(10)

    motor.buscar(5000)
    for (const fuente of fuentes.slice(4)) expect(fuente.start).toHaveBeenCalledWith(4.05, 5)
    comprobarPosicion(5000)
    contexto.currentTime = 4.59
    comprobarPosicion(5500)
  })

  it('buscar durante el silencio previo lo cancela y acota la posición', async () => {
    const { motor, fuentes } = doble()
    await motor.reproducir({ desdeMs: -1000 })
    motor.buscar(-1000)
    expect(motor.posicionMs()).toBe(0)
    expect(motor.estado().sonando).toBe(true)
    for (const fuente of fuentes.slice(2)) expect(fuente.start).toHaveBeenCalledWith(1, 0)
    motor.buscar(100_000)
    expect(motor.posicionMs()).toBe(30_000)
    expect(motor.estado()).toMatchObject({ sonando: false, finalizado: false })
  })

  it('termina con el instrumental, descarta finales obsoletos y permite volver a empezar', async () => {
    const { motor, fuentes } = doble()
    await motor.reproducir()
    const finalObsoleto = fuentes[0]?.onended
    motor.buscar(1000)
    finalObsoleto?.()
    expect(motor.estado()).toMatchObject({ sonando: true, finalizado: false })

    fuentes[2]?.onended?.()
    expect(fuentes[3]?.stop).toHaveBeenCalledOnce()
    expect(motor.estado()).toMatchObject({ sonando: false, finalizado: true })
    expect(motor.posicionMs()).toBe(30_000)
    await motor.reproducir()
    expect(fuentes[4]?.start).toHaveBeenCalledWith(1, 0)
    expect(motor.estado()).toMatchObject({ sonando: true, finalizado: false })
    fuentes[4]?.onended?.()
    motor.buscar(1000)
    expect(motor.estado().finalizado).toBe(false)
  })

  it('carga solo la mezcla en el modo original', async () => {
    const { motor, cargar, fuentes, ganancias } = doble('original')
    await motor.reproducir()
    expect(cargar).toHaveBeenCalledExactlyOnceWith(
      urlPista('prueba', 'original'),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(ganancias).toHaveLength(1)
    expect(fuentes).toHaveLength(1)
    expect(motor.estado()).toMatchObject({ listo: true, vozDisponible: false, errorVoz: null })
  })

  it.each([
    [404, 'no_encontrada'],
    [500, 'lectura']
  ])('clasifica el HTTP %s del instrumental como %s', async (status, tipo) => {
    const { motor, cargar, fuentes } = doble()
    cargar.mockResolvedValueOnce(new Response(null, { status }))
    await motor.reproducir()
    expect(motor.estado()).toMatchObject({
      listo: false,
      sonando: false,
      errorPrincipal: { tipo, detalle: `HTTP ${status}`, ruta: 'pistas/instrumental.flac' }
    })
    expect(fuentes).toHaveLength(0)
  })

  it('distingue un fallo de lectura de otro de decodificación y protege las rutas', async () => {
    const lectura = doble('original')
    lectura.cargar.mockRejectedValueOnce(new Error('Fallo de lectura'))
    await lectura.motor.cargar()
    expect(lectura.motor.estado().errorPrincipal).toEqual({
      tipo: 'lectura',
      detalle: 'Fallo de lectura',
      ruta: 'fuente/mezcla.flac'
    })

    const decodificacion = doble('original')
    decodificacion.contexto.decodeAudioData.mockRejectedValueOnce(
      new Error('FLAC inválido en /Users/ejemplo/mi pista.flac')
    )
    await decodificacion.motor.cargar()
    expect(decodificacion.motor.estado().errorPrincipal).toEqual({
      tipo: 'decodificacion',
      detalle: 'No se pudo decodificar el audio.',
      ruta: 'fuente/mezcla.flac'
    })
  })

  it('reproduce el instrumental si falta la voz', async () => {
    const { motor, cargar, fuentes } = doble()
    cargar
      .mockResolvedValueOnce(new Response())
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
    await motor.reproducir()
    expect(fuentes).toHaveLength(1)
    expect(motor.estado()).toMatchObject({
      sonando: true,
      listo: true,
      vozDisponible: false,
      errorPrincipal: null,
      errorVoz: { tipo: 'no_encontrada', ruta: 'pistas/voz.flac' }
    })
  })

  it('aborta las dos cargas y cierra el contexto una sola vez al destruirse', async () => {
    const { motor, cargar, contexto } = doble()
    const pendiente = respuestaPendiente()
    cargar.mockReturnValue(pendiente.promise)
    const cambio = vi.fn()
    motor.suscribir(cambio)
    const carga = motor.cargar()
    await vi.waitFor(() => expect(cargar).toHaveBeenCalledTimes(2))

    motor.destruir()
    motor.destruir()
    for (const [, opciones] of cargar.mock.calls) expect(opciones?.signal?.aborted).toBe(true)
    pendiente.resolve(new Response())
    await carga
    expect(contexto.close).toHaveBeenCalledOnce()
    expect(contexto.decodeAudioData).not.toHaveBeenCalled()
    expect(cambio).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ cargando: true }))
  })

  it('destruir detiene las fuentes programadas en el silencio previo', async () => {
    const { motor, fuentes } = doble()
    await motor.reproducir({ desdeMs: -3000 })
    motor.destruir()
    for (const fuente of fuentes) {
      expect(fuente.stop).toHaveBeenCalledOnce()
      expect(fuente.disconnect).toHaveBeenCalledOnce()
    }
    expect(motor.estado().sonando).toBe(false)
  })
})
