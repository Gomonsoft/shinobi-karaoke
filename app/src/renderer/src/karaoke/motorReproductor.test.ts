import { describe, expect, it, vi } from 'vitest'
import { envolvente, tramosCoro } from '@shared/coros'
import type { ElementoLetra } from '@shared/letra'
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
  // El parámetro `gain` guarda los sucesos programados (`eventos`) para poder evaluar la curva.
  const ganancia = () => {
    const eventos: { tipo: 'fijo' | 'rampa'; valor: number; t: number }[] = []
    const gain = {
      value: 0,
      eventos,
      cancelScheduledValues: vi.fn((t: number) => {
        for (let i = eventos.length - 1; i >= 0; i--) if (eventos[i]!.t >= t) eventos.splice(i, 1)
      }),
      setValueAtTime: vi.fn(
        (valor: number, t: number) => void eventos.push({ tipo: 'fijo', valor, t })
      ),
      linearRampToValueAtTime: vi.fn(
        (valor: number, t: number) => void eventos.push({ tipo: 'rampa', valor, t })
      )
    }
    return { gain, connect: vi.fn(), disconnect: vi.fn() }
  }
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

/** Voz en los coros (0.2.3, tarea 0351; ADR 0030 §1 y §3). */
describe('MotorReproductor · voz en los coros', () => {
  type Evento = { tipo: 'fijo' | 'rampa'; valor: number; t: number }
  /** Valor de la ganancia en el instante `t` del contexto a partir de los sucesos programados. */
  const valorEn = (eventos: Evento[], t: number): number => {
    let i = -1
    eventos.forEach((e, k) => {
      if (e.t <= t) i = k
    })
    if (i < 0) return eventos[0]?.valor ?? 0
    const sig = eventos[i + 1]
    if (!sig || sig.tipo !== 'rampa') return eventos[i]!.valor
    const a = eventos[i]!
    return a.valor + ((sig.valor - a.valor) * (t - a.t)) / (sig.t - a.t)
  }
  const coro = (id: string, inicio: number, fin: number): ElementoLetra => ({
    id,
    tipo: 'linea',
    texto: 'Eco inventado',
    inicio_ms: inicio,
    fin_ms: fin,
    palabras: null,
    parte: 'coro'
  })
  const puntos = (lineas: ElementoLetra[], nivel = 0.5) =>
    envolvente(tramosCoro({ lineas, offset_ms: 0 }, 30_000), nivel)
  /** Con el contexto falso, la canción empieza en `currentTime = 1`: `ms` de canción = `1 + ms / 1000`. */
  const ctx = (ms: number): number => 1 + ms / 1000

  it('C2-R1: voz guía silenciada y coros al 50 %: 0,5 en el centro, 0 fuera y rampas lineales de 150 ms', async () => {
    const { motor, ganancias } = doble()
    motor.fijarCoros(puntos([coro('a', 10_000, 14_000)]))
    await motor.reproducir({ desdeMs: 0 })
    const { eventos } = ganancias[1]!.gain
    expect(valorEn(eventos, ctx(12_000))).toBeCloseTo(0.5)
    expect(valorEn(eventos, ctx(9_000))).toBe(0)
    expect(valorEn(eventos, ctx(14_450 + 100))).toBe(0)
    // Rampa de entrada: de 9 850 a 10 000 ms, lineal (a la mitad, 0,25).
    expect(valorEn(eventos, ctx(9_850))).toBeCloseTo(0, 5)
    expect(valorEn(eventos, ctx(9_925))).toBeCloseTo(0.25, 5)
    expect(valorEn(eventos, ctx(10_000))).toBeCloseTo(0.5, 5)
    // Rampa de salida: de 14 150 a 14 300 ms + 150 (el tramo acaba 300 ms tras el fin).
    expect(valorEn(eventos, ctx(14_150))).toBeCloseTo(0.5, 5)
    expect(valorEn(eventos, ctx(14_225))).toBeCloseTo(0.25, 5)
    expect(valorEn(eventos, ctx(14_300))).toBeCloseTo(0, 5)
  })

  it('C2-R2: 800 ms entre dos coros no baja el nivel; 1,2 s sí', async () => {
    const unidos = doble()
    unidos.motor.fijarCoros(puntos([coro('a', 10_000, 11_000), coro('b', 12_250, 13_000)]))
    await unidos.motor.reproducir({ desdeMs: 0 })
    expect(valorEn(unidos.ganancias[1]!.gain.eventos, ctx(11_800))).toBeCloseTo(0.5)

    const separados = doble()
    separados.motor.fijarCoros(puntos([coro('a', 10_000, 11_000), coro('b', 12_650, 13_000)]))
    await separados.motor.reproducir({ desdeMs: 0 })
    expect(valorEn(separados.ganancias[1]!.gain.eventos, ctx(11_900))).toBe(0)
  })

  it('C2-R3: con la voz guía al 30 % es 0,3 fuera y 0,5 dentro; al 80 %, 0,8 en todas partes', async () => {
    const { motor, ganancias } = doble()
    motor.fijarCoros(puntos([coro('a', 10_000, 14_000)]))
    await motor.reproducir({ desdeMs: 0 })
    motor.fijarVoz(0.3, false)
    let { eventos } = ganancias[1]!.gain
    expect(valorEn(eventos, ctx(5_000))).toBeCloseTo(0.3)
    expect(valorEn(eventos, ctx(12_000))).toBeCloseTo(0.5)
    motor.fijarVoz(0.8, false)
    ;({ eventos } = ganancias[1]!.gain)
    for (const ms of [5_000, 9_925, 12_000, 20_000])
      expect(valorEn(eventos, ctx(ms))).toBeCloseTo(0.8)
  })

  it('C2-R4: buscar al centro de un coro deja 0,5 desde el primer instante; pausar y reanudar no lo cambian', async () => {
    const { motor, ganancias, contexto } = doble()
    motor.fijarCoros(puntos([coro('a', 10_000, 14_000)]))
    await motor.reproducir({ desdeMs: 0 })
    contexto.currentTime = 3
    motor.buscar(12_000)
    let { eventos } = ganancias[1]!.gain
    // El primer suceso es el nivel del instante, en el mismo `when` que las fuentes (currentTime).
    expect(eventos.find((e) => e.t === 3)).toEqual({ tipo: 'fijo', valor: 0.5, t: 3 })
    expect(valorEn(eventos, 3)).toBe(0.5)
    // Lo programado antes de buscar para el futuro se canceló.
    expect(ganancias[1]!.gain.cancelScheduledValues).toHaveBeenLastCalledWith(3)

    contexto.currentTime = 3.5
    motor.pausar()
    contexto.currentTime = 4
    await motor.reproducir()
    ;({ eventos } = ganancias[1]!.gain)
    expect(eventos.find((e) => e.t === 4)).toEqual({ tipo: 'fijo', valor: 0.5, t: 4 })
    expect(valorEn(eventos, 4)).toBe(0.5)
  })

  it('el nivel se programa con el anclaje de las fuentes, también con silencio previo', async () => {
    const { motor, ganancias, fuentes } = doble()
    motor.fijarCoros(puntos([coro('a', 500, 1_500)]))
    await motor.reproducir({ desdeMs: -2_000 })
    const { eventos } = ganancias[1]!.gain
    // La canción (ms = 0) empieza en 1 + 2 = 3 s de contexto, como la fuente.
    expect(fuentes[0]!.start).toHaveBeenCalledWith(3, 0)
    expect(valorEn(eventos, 3 + 1)).toBeCloseTo(0.5)
    expect(valorEn(eventos, 2.9)).toBe(0)
  })

  it('fijarCoros con la canción sonando reprograma desde el instante actual', async () => {
    const { motor, ganancias, contexto } = doble()
    await motor.reproducir({ desdeMs: 0 })
    contexto.currentTime = 11 // ms = 10 000
    motor.fijarCoros(puntos([coro('a', 10_000, 14_000)]))
    const { eventos } = ganancias[1]!.gain
    expect(valorEn(eventos, 11)).toBeCloseTo(0.5)
    motor.fijarCoros([])
    expect(ganancias[1]!.gain.value).toBe(0)
    expect(eventos).toHaveLength(0)
  })

  it('regresión 0.2.2: sin coros la ganancia de la voz es fija y no hay sucesos programados', async () => {
    const { motor, ganancias } = doble()
    await motor.reproducir()
    motor.fijarVoz(0.55, false)
    const { gain } = ganancias[1]!
    expect(gain.value).toBe(0.55)
    expect(gain.setValueAtTime).not.toHaveBeenCalled()
    expect(gain.linearRampToValueAtTime).not.toHaveBeenCalled()
    expect(gain.cancelScheduledValues).not.toHaveBeenCalled()
  })
})
