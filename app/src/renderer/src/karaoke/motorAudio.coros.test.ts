import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PuntoEnvolvente } from '@shared/coros'
import { MotorAudio } from './motorAudio'
import { urlPista } from './pistas'

/** Pista derivada «instrumental con coros» del editor (0.2.3, tarea 0352; ADR 0030 §4). */

const SR = 1000
const PUNTOS_A: PuntoEnvolvente[] = [
  [1000, 0],
  [1150, 0.5],
  [2850, 0.5],
  [3000, 0]
]
const PUNTOS_B: PuntoEnvolvente[] = [
  [1000, 0],
  [1150, 0.2],
  [2850, 0.2],
  [3000, 0]
]

/** Buffer falso con datos: `valor` constante, 10 s a 1 kHz, un canal. */
function bufferFalso(valor: number, segundos = 10) {
  const datos = new Float32Array(segundos * SR).fill(valor)
  return {
    duration: segundos,
    sampleRate: SR,
    numberOfChannels: 1,
    getChannelData: () => datos,
    copyToChannel: vi.fn(function (this: { datos: Float32Array }, canal: Float32Array) {
      this.datos = canal
    }),
    datos
  }
}

function doble() {
  const fuente = () => ({
    buffer: null as unknown,
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
  const pistas: Record<string, ReturnType<typeof bufferFalso>> = {
    instrumental: bufferFalso(0.3),
    voz: bufferFalso(0.4),
    original: bufferFalso(0.5)
  }
  let estado = 'suspended'
  const ctx = {
    currentTime: 1,
    get state() {
      return estado
    },
    baseLatency: 0,
    outputLatency: 0,
    decodeAudioData: vi.fn(async (bytes: ArrayBuffer) => {
      const nombre = new TextDecoder().decode(bytes)
      return pistas[nombre]!
    }),
    createGain: () => ({ gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }),
    createBuffer: vi.fn((_c: number, longitud: number, sr: number) => ({
      ...bufferFalso(0, longitud / sr),
      sampleRate: sr
    })),
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
  // La respuesta lleva el nombre de la pista como bytes: `decodeAudioData` sabe cuál devolver.
  const cargar = vi.fn<typeof fetch>(async (url) => {
    const nombre = Object.keys(pistas).find((p) => url === urlPista('prueba', p as never))!
    return new Response(new TextEncoder().encode(nombre))
  })
  const mezclarCoros = vi.fn(
    async (...a: [Float32Array[], Float32Array[], number, PuntoEnvolvente[], AbortSignal]) =>
      a[0].map((c, i) => c.map((v, k) => v + a[1][i]![k]! * 0.5))
  )
  const motor = new MotorAudio({
    cancionId: 'prueba',
    gananciaDb: 0,
    volumen: 1,
    crearContexto: () => ctx as unknown as AudioContext,
    fetch: cargar,
    ahoraPerf: () => 1234,
    mezclarCoros
  })
  return { motor, ctx, fuentes, pistas, cargar, mezclarCoros }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

/** Avanza el reloj y deja correr las promesas del cálculo. */
const avanzar = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms)
}

describe('MotorAudio · pista con coros', () => {
  it('con «Instrumental» y coros, suena la mezcla (instrumental + voz × 0,5); la mezcla recibe copias', async () => {
    const { motor, fuentes, mezclarCoros, pistas } = doble()
    motor.fijarCoros(PUNTOS_A)
    await motor.usarPista('instrumental')
    await avanzar(0)
    expect(mezclarCoros).toHaveBeenCalledOnce()
    const [inst, voz, sr, puntos] = mezclarCoros.mock.calls[0]!
    expect(inst[0]).not.toBe(pistas.instrumental!.datos) // copia: el buffer del motor no se transfiere
    expect(voz[0]).not.toBe(pistas.voz!.datos)
    expect([sr, puntos]).toEqual([SR, PUNTOS_A])
    expect(motor.estado()).toMatchObject({ corosListos: true, corosError: false })
    await motor.reproducir({ desdeMs: 0 })
    const sonando = fuentes.at(-1)!.buffer as ReturnType<typeof bufferFalso>
    expect(sonando.copyToChannel).toHaveBeenCalled()
    expect(sonando.datos[2000]).toBeCloseTo(0.3 + 0.4 * 0.5)
  })

  it('C2-E3: con «Original» y «Voz» no se calcula ni cambia nada; la mezcla llega al volver a «Instrumental»', async () => {
    const { motor, mezclarCoros, cargar } = doble()
    motor.fijarCoros(PUNTOS_A)
    await motor.usarPista('original')
    await avanzar(1000)
    expect(mezclarCoros).not.toHaveBeenCalled()
    await motor.usarPista('voz')
    await avanzar(1000)
    expect(mezclarCoros).not.toHaveBeenCalled()
    expect(cargar.mock.calls.map(([u]) => u)).not.toContain(urlPista('prueba', 'instrumental'))
    await motor.usarPista('instrumental')
    await avanzar(0)
    expect(mezclarCoros).toHaveBeenCalledOnce()
  })

  it('C2-E6: recalcula 300 ms después del último cambio y solo vale la última petición', async () => {
    const { motor, mezclarCoros } = doble()
    await motor.usarPista('instrumental')
    motor.fijarCoros(PUNTOS_A)
    await avanzar(299)
    expect(mezclarCoros).not.toHaveBeenCalled()
    await avanzar(2)
    expect(mezclarCoros).toHaveBeenCalledOnce()
    mezclarCoros.mockClear()

    motor.fijarCoros(PUNTOS_B)
    await avanzar(200)
    motor.fijarCoros([...PUNTOS_B.slice(0, 3), [3100, 0]])
    await avanzar(299)
    expect(mezclarCoros).not.toHaveBeenCalled()
    await avanzar(2)
    expect(mezclarCoros).toHaveBeenCalledOnce()
    expect(mezclarCoros.mock.calls[0]![3][3]).toEqual([3100, 0])
  })

  it('una petición nueva cancela el cálculo en curso (su señal se aborta) y su resultado no vale', async () => {
    const { motor, mezclarCoros, fuentes } = doble()
    const resueltas: (() => void)[] = []
    mezclarCoros.mockImplementation(
      (inst) =>
        new Promise((resolver) => {
          resueltas.push(() => resolver(inst as never))
        })
    )
    await motor.usarPista('instrumental')
    motor.fijarCoros(PUNTOS_A)
    await avanzar(300)
    const senal = mezclarCoros.mock.calls[0]![4]
    motor.fijarCoros(PUNTOS_B)
    expect(senal.aborted).toBe(true)
    resueltas[0]!() // llega tarde: se ignora
    await avanzar(0)
    expect(motor.estado().corosListos).toBe(false)
    await motor.reproducir({ desdeMs: 0 })
    expect((fuentes.at(-1)!.buffer as { datos: Float32Array }).datos[2000]).toBeCloseTo(0.3)
  })

  it('«Preparando los coros…»: se marca si el cálculo pasa de 500 ms, y no antes; sin cortar el audio', async () => {
    const { motor, mezclarCoros, fuentes } = doble()
    await motor.usarPista('instrumental')
    await motor.reproducir({ desdeMs: 0 })
    const n = fuentes.length
    let acabar!: () => void
    mezclarCoros.mockImplementation(
      (inst) =>
        new Promise((resolver) => {
          acabar = () => resolver(inst as never)
        })
    )
    motor.fijarCoros(PUNTOS_A)
    await avanzar(300)
    await avanzar(499)
    expect(motor.estado().corosPreparando).toBe(false)
    await avanzar(2)
    expect(motor.estado().corosPreparando).toBe(true)
    expect(fuentes).toHaveLength(n) // el audio sigue sin tocarse mientras se calcula
    acabar()
    await avanzar(0)
    expect(motor.estado()).toMatchObject({ corosPreparando: false, corosListos: true })
    expect(fuentes).toHaveLength(n + 1) // relevo a la mezcla
  })

  it('un cálculo rápido no marca «preparando»', async () => {
    const { motor } = doble()
    const estados: (boolean | undefined)[] = []
    motor.suscribir((e) => estados.push(e.corosPreparando))
    await motor.usarPista('instrumental')
    motor.fijarCoros(PUNTOS_A)
    await avanzar(1000)
    expect(estados).not.toContain(true)
  })

  it('con un fallo de la mezcla vuelve al instrumental solo y marca el error una sola vez', async () => {
    const { motor, mezclarCoros, fuentes } = doble()
    const avisos: (boolean | undefined)[] = []
    motor.suscribir((e) => avisos.push(e.corosError))
    mezclarCoros.mockRejectedValue(new Error('sin memoria'))
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await motor.usarPista('instrumental')
    motor.fijarCoros(PUNTOS_A)
    await avanzar(300)
    expect(motor.estado()).toMatchObject({ corosError: true, corosListos: false })
    await motor.reproducir({ desdeMs: 0 })
    expect((fuentes.at(-1)!.buffer as { datos: Float32Array }).datos[2000]).toBeCloseTo(0.3)
    // Otro cambio que vuelve a fallar no vuelve a pasar de falso a verdadero.
    motor.fijarCoros(PUNTOS_B)
    await avanzar(400)
    const transiciones = avisos.filter((v, i) => v === true && avisos[i - 1] !== true)
    expect(transiciones).toHaveLength(1)
    // Cuando la mezcla vuelve a funcionar, el error se limpia.
    mezclarCoros.mockImplementation(async (inst) => inst as never)
    motor.fijarCoros(PUNTOS_A)
    await avanzar(400)
    expect(motor.estado()).toMatchObject({ corosError: false, corosListos: true })
  })

  it('un error del worker (el cliente lo rechaza) o una voz ilegible también caen al instrumental', async () => {
    const { motor, cargar } = doble()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await motor.usarPista('instrumental')
    cargar.mockImplementation(async (url) =>
      url === urlPista('prueba', 'voz')
        ? new Response(null, { status: 404 })
        : new Response(new TextEncoder().encode('instrumental'))
    )
    motor.fijarCoros(PUNTOS_A)
    await avanzar(400)
    expect(motor.estado()).toMatchObject({ corosError: true, corosListos: false })
  })

  it('sin coros (o nivel 0) se vuelve al instrumental de siempre', async () => {
    const { motor, fuentes } = doble()
    await motor.usarPista('instrumental')
    motor.fijarCoros(PUNTOS_A)
    await avanzar(300)
    await motor.reproducir({ desdeMs: 0 })
    motor.fijarCoros([])
    expect(motor.estado().corosListos).toBe(false)
    const sonando = fuentes.at(-1)!.buffer as { datos: Float32Array }
    expect(sonando.datos[2000]).toBeCloseTo(0.3)
  })

  it('C2-E4: el bucle y las velocidades funcionan con la pista derivada', async () => {
    const { motor, fuentes } = doble()
    await motor.usarPista('instrumental')
    motor.fijarCoros(PUNTOS_A)
    await avanzar(300)
    expect(motor.fijarBucle({ inicioMs: 1000, finMs: 3000 })).toBe(true)
    await motor.reproducir({ desdeMs: 1500 })
    const f = fuentes.at(-1)!
    expect(f).toMatchObject({ loop: true, loopStart: 1, loopEnd: 3 })
    expect((f.buffer as { datos: Float32Array }).datos[2000]).toBeCloseTo(0.5)
    motor.fijarVelocidad(0.5)
    const lenta = fuentes.at(-1)!
    expect(lenta).not.toBe(f)
    expect(lenta.playbackRate.value).toBe(0.5)
    expect(lenta.buffer).toBe(f.buffer) // la misma pista derivada
    expect(lenta).toMatchObject({ loop: true, loopStart: 1, loopEnd: 3 })
    expect(motor.posicionMs()).toBeGreaterThanOrEqual(1000)
  })

  it('conCoros: «Escuchar un coro» usa la mezcla aunque la pista elegida sea otra', async () => {
    const { motor, fuentes } = doble()
    await motor.usarPista('original')
    motor.fijarCoros(PUNTOS_A)
    expect(await motor.prepararCoros()).toBe(true)
    await motor.reproducir({ desdeMs: 0, hastaMs: 4000, conCoros: true })
    expect((fuentes.at(-1)!.buffer as { datos: Float32Array }).datos[2000]).toBeCloseTo(0.5)
    expect(motor.estado().pista).toBe('original')
    await motor.reproducir({ desdeMs: 0 })
    expect((fuentes.at(-1)!.buffer as { datos?: Float32Array }).datos?.[2000]).toBeCloseTo(0.5) // «original» (0,5)
  })

  it('regresión 0.2.2: sin coros no se carga la voz ni se calcula nada', async () => {
    const { motor, cargar, mezclarCoros } = doble()
    await motor.usarPista('instrumental')
    await motor.reproducir({ desdeMs: 0 })
    await avanzar(2000)
    expect(mezclarCoros).not.toHaveBeenCalled()
    expect(cargar).toHaveBeenCalledTimes(1)
    expect(motor.estado()).toMatchObject({ corosListos: false, corosError: false })
  })
})
