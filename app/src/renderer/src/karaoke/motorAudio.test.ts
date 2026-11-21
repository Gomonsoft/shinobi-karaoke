import { describe, expect, it, vi } from 'vitest'
import { MotorAudio } from './motorAudio'
import { urlPista } from './pistas'

function respuestaPendiente() {
  let resolve!: (respuesta: Response) => void
  const promise = new Promise<Response>((resolver) => {
    resolve = resolver
  })
  return { promise, resolve }
}

function doble() {
  const ganancia = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }
  const fuente = () => ({
    buffer: null,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    playbackRate: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null
  })
  const fuentes: ReturnType<typeof fuente>[] = []
  const ctx = {
    currentTime: 1,
    get state() {
      return estado
    },
    baseLatency: 0.01,
    outputLatency: 0.03,
    getOutputTimestamp: () => ({ contextTime: ctx.currentTime - 0.04, performanceTime: 1234 }),
    decodeAudioData: vi.fn(async () => ({ duration: 30 })),
    createGain: () => ganancia,
    destination: {},
    createBufferSource: () => {
      const nueva = fuente()
      fuentes.push(nueva)
      return nueva
    },
    resume: vi.fn(async () => {
      estado = 'running'
    }),
    close: vi.fn(async () => {
      estado = 'closed'
    })
  }
  let estado = 'suspended'
  const cargar = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([1, 2, 3])))
  const motor = new MotorAudio({
    cancionId: 'prueba',
    gananciaDb: -6,
    volumen: 0.6,
    crearContexto: () => ctx as unknown as AudioContext,
    fetch: cargar,
    ahoraPerf: () => 1234
  })
  return { motor, ctx, fuentes, cargar, ganancia }
}

describe('MotorAudio', () => {
  it('actualiza límites sin reiniciar y respeta el audio que aún está en salida', async () => {
    const { motor, ctx, fuentes } = doble()
    await motor.usarPista('original')
    expect(motor.fijarBucle({ inicioMs: 2000, finMs: 4000 })).toBe(true)
    await motor.reproducir({ desdeMs: 2500 })
    const fuente = fuentes[0]!
    expect(fuente).toMatchObject({ loop: true, loopStart: 2, loopEnd: 4 })
    expect(fuente.stop).not.toHaveBeenCalled()
    ctx.currentTime = 2.49
    expect(motor.posicionMs()).toBeCloseTo(3950)
    expect(motor.fijarBucle({ inicioMs: 3000, finMs: 4500 })).toBe(true)
    expect(fuentes).toHaveLength(1)
    expect(fuente).toMatchObject({ loopStart: 3, loopEnd: 4.5 })
    expect(motor.posicionMs()).toBeCloseTo(3950)
    ctx.currentTime = 3.13
    expect(motor.posicionMs()).toBeCloseTo(3090)
    expect(motor.fijarBucle({ inicioMs: 3300, finMs: 4500 })).toBe(true)
    expect(fuente.stop).toHaveBeenCalledOnce()
    expect(fuentes.at(-1)?.start).toHaveBeenCalledWith(3.13, 3.3)
    expect(motor.posicionMs()).toBeCloseTo(3300)
  })

  it('acota a la pista y conserva fase al cambiar velocidad, pausar, buscar y cambiar pista', async () => {
    const { motor, ctx, fuentes } = doble()
    await motor.usarPista('original')
    expect(motor.fijarBucle({ inicioMs: 2000, finMs: 35_000 })).toBe(true)
    await motor.reproducir()
    expect(fuentes.at(-1)).toMatchObject({ loop: true, loopStart: 2, loopEnd: 30 })
    ctx.currentTime = 2.04
    motor.fijarVelocidad(0.5)
    expect(motor.posicionMs()).toBeCloseTo(3000)
    ctx.currentTime = 3.08
    motor.pausar()
    expect(motor.posicionMs()).toBeCloseTo(3500)
    await motor.reproducir()
    expect(fuentes.at(-1)?.start).toHaveBeenCalledWith(3.08, 3.5)
    motor.buscar(4000)
    expect(fuentes.at(-1)).toMatchObject({ loop: true, loopStart: 2 })
    ctx.decodeAudioData.mockResolvedValueOnce({ duration: 3 })
    await motor.usarPista('voz')
    expect(fuentes.at(-1)).toMatchObject({ loop: true, loopStart: 2, loopEnd: 3 })
    expect(fuentes.at(-1)?.start).toHaveBeenCalledWith(3.08, 2)
    motor.buscar(1000)
    expect(fuentes.at(-1)).toMatchObject({ loop: false })
    expect(motor.posicionMs()).toBe(1000)
  })

  it('rechaza bucles vacíos y mantiene independiente el fin de escucha puntual', async () => {
    const { motor, fuentes } = doble()
    expect(motor.fijarBucle({ inicioMs: 0, finMs: 4000 })).toBe(false)
    await motor.usarPista('original')
    expect(motor.fijarBucle({ inicioMs: 4000, finMs: 4000 })).toBe(false)
    expect(motor.fijarBucle({ inicioMs: 32_000, finMs: 34_000 })).toBe(false)
    expect(motor.fijarBucle({ inicioMs: 1000, finMs: 4000 })).toBe(true)
    await motor.reproducir({ desdeMs: 1500, hastaMs: 2000 })
    expect(fuentes[0]?.loop).toBe(false)
    expect(fuentes[0]?.stop).toHaveBeenCalledWith(1.5)
    const finalObsoleto = fuentes[0]?.onended
    await motor.reproducir()
    finalObsoleto?.()
    expect(motor.estado().sonando).toBe(true)
    expect(fuentes.at(-1)?.loop).toBe(true)
    motor.liberarAudio()
    await motor.reproducir()
    expect(fuentes.at(-1)?.loop).toBe(false)
    motor.destruir()
    expect(motor.estado().sonando).toBe(false)
  })

  it('ignora una reanudación pendiente al limpiar el bucle', async () => {
    const { motor, ctx, fuentes } = doble()
    await motor.usarPista('original')
    motor.fijarBucle({ inicioMs: 1000, finMs: 4000 })
    let terminar!: () => void
    ctx.resume.mockImplementationOnce(() => new Promise((resolver) => (terminar = resolver)))
    const anterior = motor.reproducir()
    motor.fijarBucle(null)
    terminar()
    await anterior
    expect(fuentes).toHaveLength(0)
    expect(motor.estado().sonando).toBe(false)
  })

  it('sigue sonando durante la carga y cambia de pista en la posición que se oye', async () => {
    const { motor, ctx, fuentes, cargar } = doble()
    await motor.usarPista('original')
    await motor.reproducir({ desdeMs: 5000 })
    const pendiente = respuestaPendiente()
    cargar.mockReturnValueOnce(pendiente.promise)
    const cambio = motor.usarPista('voz')
    expect(motor.estado()).toMatchObject({
      pista: 'original',
      cargandoPista: 'voz',
      sonando: true,
      cargando: false
    })
    expect(fuentes[0]?.stop).not.toHaveBeenCalled()
    ctx.currentTime = 2.04
    pendiente.resolve(new Response())
    await cambio
    expect(fuentes[0]?.stop).toHaveBeenCalledOnce()
    expect(fuentes[1]?.start).toHaveBeenCalledWith(2.04, 6)
    expect(motor.posicionMs()).toBeCloseTo(6000)
    expect(motor.estado()).toMatchObject({ pista: 'voz', cargandoPista: null, sonando: true })
  })

  it('descarta el buffer menos reciente al cargar la tercera pista', async () => {
    const { motor, cargar } = doble()
    for (const pista of [
      'original',
      'voz',
      'original',
      'instrumental',
      'original',
      'voz'
    ] as const) {
      await motor.usarPista(pista)
    }
    expect(cargar.mock.calls.map(([url]) => url)).toEqual(
      (['original', 'voz', 'instrumental', 'voz'] as const).map((pista) =>
        urlPista('prueba', pista)
      )
    )
  })

  it('distingue los fallos de descarga y decodificación y deja reintentar', async () => {
    const { motor, ctx, cargar } = doble()
    cargar.mockResolvedValueOnce(new Response(null, { status: 404 }))
    const promesa = motor.usarPista('original')
    expect(motor.estado().cargando).toBe(true)
    await promesa
    expect(motor.estado()).toMatchObject({ cargando: false, error: 'carga' })
    ctx.decodeAudioData.mockRejectedValueOnce(new Error('FLAC inválido'))
    await motor.usarPista('original')
    expect(motor.estado()).toMatchObject({ error: 'decodificacion' })
    await motor.usarPista('original')
    expect(motor.estado()).toMatchObject({ error: null, duracionMs: 30_000 })
  })

  it('programa el fin del fragmento con la velocidad vigente', async () => {
    const { motor, ctx, fuentes } = doble()
    await motor.usarPista('original')
    motor.fijarVelocidad(0.5)
    await motor.reproducir({ desdeMs: 5000, hastaMs: 6000 })
    expect(ctx.resume).toHaveBeenCalledOnce()
    expect(fuentes[0]?.playbackRate.value).toBe(0.5)
    expect(fuentes[0]?.stop).toHaveBeenCalledWith(3)
    fuentes[0]?.onended?.()
    expect(motor.estado().sonando).toBe(false)
    expect(motor.posicionMs()).toBe(6000)
    expect(motor.tiempoDeEvento(1234)).toBeNull()
  })

  it('reancla al cambiar la velocidad y al buscar, y acota la posición', async () => {
    const { motor, ctx, fuentes } = doble()
    await motor.usarPista('original')
    await motor.reproducir()
    ctx.currentTime = 2.04
    motor.fijarVelocidad(0.75)
    expect(motor.posicionMs()).toBeCloseTo(1000)
    ctx.currentTime = 3.08
    expect(motor.tiempoDeEvento(1234)).toBeCloseTo(1750)
    motor.buscar(10_000)
    expect(fuentes.at(-1)?.start).toHaveBeenCalledWith(3.08, 10)
    motor.buscar(40_000)
    expect(motor.posicionMs()).toBe(30_000)
    expect(motor.estado().sonando).toBe(false)
  })

  it('cancela una carga reemplazada y otra al destruir', async () => {
    const { motor, ctx, cargar } = doble()
    const pendiente = respuestaPendiente()
    cargar.mockReturnValueOnce(pendiente.promise)
    const original = motor.usarPista('original')
    await motor.usarPista('voz')
    expect(cargar.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    pendiente.resolve(new Response())
    await original
    expect(motor.estado().pista).toBe('voz')

    const siguiente = respuestaPendiente()
    cargar.mockReturnValueOnce(siguiente.promise)
    const instrumental = motor.usarPista('instrumental')
    motor.destruir()
    expect(cargar.mock.calls.at(-1)?.[1]?.signal?.aborted).toBe(true)
    siguiente.resolve(new Response())
    await instrumental
    expect(ctx.close).toHaveBeenCalledOnce()
    expect(ctx.decodeAudioData).toHaveBeenCalledOnce()
  })

  it('aplica la ganancia y el volumen al mismo GainNode', async () => {
    const { motor, ganancia } = doble()
    await motor.usarPista('original')
    expect(ganancia.gain.value).toBeCloseTo(10 ** (-6 / 20) * 0.6)
    motor.fijarVolumen(0.8)
    expect(ganancia.gain.value).toBeCloseTo(10 ** (-6 / 20) * 0.8)
    motor.fijarVolumen(-1)
    expect(ganancia.gain.value).toBe(0)
  })

  it('libera el audio y aborta una carga, conservando pista, posición y velocidad', async () => {
    const { motor, ctx, cargar, fuentes } = doble()
    await motor.usarPista('instrumental')
    motor.fijarVelocidad(0.75)
    await motor.reproducir({ desdeMs: 5000 })
    ctx.currentTime = 2.04
    const pendiente = respuestaPendiente()
    cargar.mockReturnValueOnce(pendiente.promise)
    const cambio = motor.usarPista('voz')
    motor.liberarAudio()

    expect(fuentes[0]?.stop).toHaveBeenCalledOnce()
    expect(cargar.mock.calls.at(-1)?.[1]?.signal?.aborted).toBe(true)
    expect(motor.estado()).toMatchObject({
      pista: 'instrumental',
      velocidad: 0.75,
      cargandoPista: null,
      sonando: false
    })
    expect(motor.posicionMs()).toBeCloseTo(5750)

    pendiente.resolve(new Response())
    await cambio
    await motor.usarPista('instrumental')
    expect(cargar.mock.calls.map(([url]) => url)).toEqual([
      urlPista('prueba', 'instrumental'),
      urlPista('prueba', 'voz'),
      urlPista('prueba', 'instrumental')
    ])
    expect(motor.posicionMs()).toBeCloseTo(5750)

    motor.liberarAudio()
    await motor.reproducir()
    expect(cargar).toHaveBeenCalledTimes(4)
    expect(fuentes.at(-1)?.start).toHaveBeenCalledWith(2.04, 5.75)
    expect(motor.estado().sonando).toBe(true)
  })
})

describe('MotorAudio: tramo con el tono conservado', () => {
  const SR = 1000

  function dobleTono(estirar?: (...args: unknown[]) => Promise<Float32Array[]>) {
    const base = doble()
    const origen = {
      duration: 30,
      sampleRate: SR,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(30 * SR)
    }
    base.ctx.decodeAudioData.mockResolvedValue(origen as never)
    const creados: { duration: number; sampleRate: number }[] = []
    Object.assign(base.ctx, {
      createBuffer: (_canales: number, longitud: number, sampleRate: number) => {
        const buffer = { duration: longitud / sampleRate, sampleRate, copyToChannel: vi.fn() }
        creados.push(buffer)
        return buffer
      }
    })
    const falso =
      estirar ??
      (async (canales: unknown, _sr: unknown, v: unknown) =>
        (canales as Float32Array[]).map(
          (c) => new Float32Array(Math.round(c.length / (v as number)))
        ))
    const estirarMock = vi.fn(falso)
    const motor = new MotorAudio({
      cancionId: 'prueba',
      gananciaDb: -6,
      volumen: 0.6,
      crearContexto: () => base.ctx as unknown as AudioContext,
      fetch: base.cargar,
      ahoraPerf: () => 1234,
      estirar: estirarMock as never
    })
    return { ...base, motor, estirarMock, creados }
  }

  const vaciar = () => new Promise((resolver) => setTimeout(resolver, 0))

  it('reproduce el bucle del tramo con el buffer estirado y la fórmula de reloj de siempre', async () => {
    const { motor, ctx, fuentes, estirarMock, creados } = dobleTono()
    await motor.usarPista('original')
    motor.fijarVelocidad(0.5)
    motor.fijarTramoConTono({ inicioMs: 1000, finMs: 5000 })
    await vaciar()
    expect(estirarMock).toHaveBeenCalledOnce()
    expect(estirarMock.mock.calls[0]![1]).toBe(SR)
    expect(creados).toHaveLength(1)
    expect(creados[0]!.duration).toBeCloseTo(8)
    expect(motor.fijarBucle({ inicioMs: 2000, finMs: 4000 })).toBe(true)
    await motor.reproducir({ desdeMs: 2500 })
    const fuente = fuentes[0]!
    expect(fuente.buffer).toBe(creados[0])
    expect(fuente).toMatchObject({ loop: true, loopStart: 2, loopEnd: 6 })
    expect(fuente.playbackRate.value).toBe(1)
    expect(fuente.start).toHaveBeenCalledWith(1, 3)
    // A 0,5× avanza media canción por segundo de contexto; el oído va 40 ms por detrás.
    ctx.currentTime = 2.04
    expect(motor.posicionMs()).toBeCloseTo(3000)
    // Al pasar el extremo envuelve igual que con playbackRate.
    ctx.currentTime = 5.04
    expect(motor.posicionMs()).toBeCloseTo(2000 + ((2500 + 2000 - 4000) % 2000))
  })

  it('usa playbackRate fuera del tramo y con 1x, y estira las escuchas puntuales dentro', async () => {
    const { motor, fuentes, creados } = dobleTono()
    await motor.usarPista('original')
    motor.fijarVelocidad(0.75)
    motor.fijarTramoConTono({ inicioMs: 1000, finMs: 5000 })
    await vaciar()
    await motor.reproducir({ desdeMs: 1500, hastaMs: 2500 })
    expect(fuentes[0]!.buffer).toBe(creados[0])
    expect(fuentes[0]!.start).toHaveBeenCalledWith(1, (1500 - 1000) / 1000 / 0.75)
    expect(fuentes[0]!.stop).toHaveBeenCalledWith(1 + 1000 / (1000 * 0.75))
    await motor.reproducir({ desdeMs: 500, hastaMs: 900 })
    expect(fuentes[1]!.buffer).not.toBe(creados[0])
    expect(fuentes[1]!.playbackRate.value).toBe(0.75)
    await motor.reproducir({ desdeMs: 1500 })
    expect(fuentes[2]!.playbackRate.value).toBe(0.75)
    motor.fijarVelocidad(1)
    await motor.reproducir({ desdeMs: 1500, hastaMs: 2500 })
    expect(fuentes.at(-1)!.playbackRate.value).toBe(1)
    expect(fuentes.at(-1)!.buffer).not.toBe(creados[0])
  })

  it('mientras se prepara suena con playbackRate y relevo al pasar por el inicio del bucle', async () => {
    let terminar!: (c: Float32Array[]) => void
    const { motor, ctx, fuentes, creados } = dobleTono(
      () => new Promise<Float32Array[]>((resolver) => (terminar = resolver))
    )
    await motor.usarPista('original')
    motor.fijarVelocidad(0.5)
    motor.fijarTramoConTono({ inicioMs: 1000, finMs: 5000 })
    motor.fijarBucle({ inicioMs: 2000, finMs: 4000 })
    await motor.reproducir({ desdeMs: 2500 })
    expect(fuentes[0]).toMatchObject({ loopStart: 2, loopEnd: 4 })
    expect(fuentes[0]!.playbackRate.value).toBe(0.5)
    ctx.currentTime = 1.5
    terminar([new Float32Array(8000)])
    await vaciar()
    // En 0,5 s de contexto lleva 250 ms: va por 2750 y faltan 1250 ms de canción = 2,5 s.
    expect(fuentes[0]!.stop).toHaveBeenCalledWith(4)
    expect(fuentes[1]!.buffer).toBe(creados[0])
    expect(fuentes[1]!.start).toHaveBeenCalledWith(4, 2)
    ctx.currentTime = 3.04
    expect(motor.posicionMs()).toBeCloseTo(2500 + 0.5 * 1000 * 2)
    ctx.currentTime = 4.54
    expect(motor.posicionMs()).toBeCloseTo(2000 + 0.5 * 500)
    motor.pausar()
    expect(fuentes[1]!.stop).toHaveBeenCalled()
    expect(motor.estado().sonando).toBe(false)
  })

  it('convierte los límites al mover el bucle dentro del tramo y reinicia al salir de él', async () => {
    const { motor, ctx, fuentes, creados } = dobleTono()
    await motor.usarPista('original')
    motor.fijarVelocidad(0.5)
    motor.fijarTramoConTono({ inicioMs: 1000, finMs: 5000 })
    await vaciar()
    motor.fijarBucle({ inicioMs: 2000, finMs: 4000 })
    await motor.reproducir({ desdeMs: 2500 })
    expect(motor.fijarBucle({ inicioMs: 1500, finMs: 4500 })).toBe(true)
    expect(fuentes).toHaveLength(1)
    expect(fuentes[0]).toMatchObject({ loopStart: 1, loopEnd: 7 })
    ctx.currentTime = 2.04
    expect(motor.fijarBucle({ inicioMs: 3000, finMs: 6000 })).toBe(true)
    expect(fuentes).toHaveLength(2)
    expect(fuentes[1]!.buffer).not.toBe(creados[0])
    expect(fuentes[1]!.playbackRate.value).toBe(0.5)
  })

  it('descarta la caché al cambiar tramo o velocidad y al cerrar la ventana', async () => {
    const { motor, fuentes, estirarMock, creados } = dobleTono()
    await motor.usarPista('original')
    motor.fijarVelocidad(0.5)
    motor.fijarTramoConTono({ inicioMs: 1000, finMs: 5000 })
    await vaciar()
    motor.fijarTramoConTono({ inicioMs: 1000, finMs: 5000 })
    expect(estirarMock).toHaveBeenCalledOnce()
    motor.fijarTramoConTono({ inicioMs: 1000, finMs: 6000 })
    await vaciar()
    expect(estirarMock).toHaveBeenCalledTimes(2)
    motor.fijarVelocidad(0.75)
    await vaciar()
    expect(estirarMock).toHaveBeenCalledTimes(3)
    expect(estirarMock.mock.calls[2]![2]).toBe(0.75)
    motor.fijarTramoConTono(null)
    await motor.reproducir({ desdeMs: 1500, hastaMs: 2500 })
    expect(fuentes[0]!.buffer).not.toBe(creados.at(-1))
    expect(fuentes[0]!.playbackRate.value).toBe(0.75)
    motor.fijarTramoConTono({ inicioMs: 1000, finMs: 6000 })
    motor.fijarVelocidad(1)
    motor.liberarAudio()
    motor.destruir()
    expect(estirarMock).toHaveBeenCalledTimes(4)
  })

  it('si el estiramiento falla o no cumple la duración, queda en playbackRate y lo comunica', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { motor, fuentes, estirarMock } = dobleTono(async () => {
      throw new Error('worker caído')
    })
    await motor.usarPista('original')
    expect(motor.estado().tonoConservado).toBe(true)
    motor.fijarVelocidad(0.5)
    motor.fijarTramoConTono({ inicioMs: 1000, finMs: 5000 })
    await vaciar()
    expect(motor.estado().tonoConservado).toBe(false)
    expect(aviso).toHaveBeenCalledOnce()
    motor.fijarBucle({ inicioMs: 2000, finMs: 4000 })
    await motor.reproducir({ desdeMs: 2500 })
    expect(fuentes[0]).toMatchObject({ loop: true, loopStart: 2, loopEnd: 4 })
    expect(fuentes[0]!.playbackRate.value).toBe(0.5)
    expect(estirarMock).toHaveBeenCalledOnce()
    motor.fijarVelocidad(1)
    expect(motor.estado().tonoConservado).toBe(true)

    estirarMock.mockResolvedValueOnce([new Float32Array(10)])
    motor.fijarVelocidad(0.75)
    await vaciar()
    expect(motor.estado().tonoConservado).toBe(false)
    aviso.mockRestore()
  })
})
