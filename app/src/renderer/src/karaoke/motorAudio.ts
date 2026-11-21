import { gananciaLineal, urlPista, type Pista } from './pistas'
import { ctxOidoEn, msBucleEn, msCancionEn, type Anclaje, type IntervaloBucle } from './reloj'

export interface OpcionesMotor {
  cancionId: string
  gananciaDb: number
  volumen: number
  crearContexto?: () => AudioContext
  fetch?: typeof fetch
  ahoraPerf?: () => number
  maxBuffers?: number
}

export type Velocidad = 0.5 | 0.75 | 1

export interface EstadoMotor {
  pista: Pista
  cargandoPista: Pista | null
  cargando: boolean
  error: 'carga' | 'decodificacion' | null
  sonando: boolean
  velocidad: Velocidad
  duracionMs: number | null
  volumen: number
}

interface Tramo {
  anclaje: Anclaje
  bucle: IntervaloBucle | null
}

interface Reproduccion {
  fuente: AudioBufferSourceNode
  tramos: Tramo[]
  finMs: number
  hastaMs?: number
}

function acotar(valor: number, maximo: number): number {
  return Math.max(0, Math.min(valor, maximo))
}

function intervaloAudible(bucle: IntervaloBucle, duracionMs: number): IntervaloBucle | null {
  if (!Number.isFinite(bucle.inicioMs) || !Number.isFinite(bucle.finMs)) return null
  const inicioMs = acotar(bucle.inicioMs, duracionMs)
  const finMs = acotar(bucle.finMs, duracionMs)
  return inicioMs < finMs ? { inicioMs, finMs } : null
}

function contiene(bucle: IntervaloBucle, ms: number): boolean {
  return ms >= bucle.inicioMs && ms < bucle.finMs
}

function posicionEn(ctx: number, { anclaje, bucle }: Tramo): number {
  const instante = Math.max(ctx, anclaje.ctxInicio)
  return bucle ? msBucleEn(instante, anclaje, bucle) : msCancionEn(instante, anclaje)
}

function configurarBucle(fuente: AudioBufferSourceNode, bucle: IntervaloBucle | null): void {
  if (bucle) {
    fuente.loopStart = bucle.inicioMs / 1000
    fuente.loopEnd = bucle.finMs / 1000
  }
  fuente.loop = bucle !== null
}

export class MotorAudio {
  private contexto: AudioContext | null = null
  private ganancia: GainNode | null = null
  private readonly buffers = new Map<Pista, AudioBuffer>()
  private readonly oyentes = new Set<(e: EstadoMotor) => void>()
  private readonly maxBuffers: number
  private readonly ahoraPerf: () => number
  private actual: EstadoMotor
  private carga: AbortController | null = null
  private reproduccion: Reproduccion | null = null
  private bucle: IntervaloBucle | null = null
  private posicionEnPausa = 0
  private solicitudReproduccion = 0
  private audioLiberado = false
  private destruido = false

  constructor(private readonly opciones: OpcionesMotor) {
    this.maxBuffers = Math.max(1, Math.min(2, Math.trunc(opciones.maxBuffers ?? 2)))
    this.ahoraPerf = opciones.ahoraPerf ?? (() => performance.now())
    this.actual = {
      pista: 'original',
      cargandoPista: null,
      cargando: false,
      error: null,
      sonando: false,
      velocidad: 1,
      duracionMs: null,
      volumen: acotar(opciones.volumen, 1)
    }
  }

  estado(): EstadoMotor {
    return this.actual
  }

  suscribir(cb: (e: EstadoMotor) => void): () => void {
    this.oyentes.add(cb)
    return () => this.oyentes.delete(cb)
  }

  private publicar(cambio: Partial<EstadoMotor>): void {
    this.actual = { ...this.actual, ...cambio }
    for (const oyente of this.oyentes) oyente(this.actual)
  }

  private prepararContexto(): AudioContext {
    if (this.contexto) return this.contexto
    const contexto = this.opciones.crearContexto?.() ?? new AudioContext()
    const ganancia = contexto.createGain()
    ganancia.gain.value = gananciaLineal(this.opciones.gananciaDb, this.actual.volumen)
    ganancia.connect(contexto.destination)
    this.ganancia = ganancia
    this.contexto = contexto
    return contexto
  }

  async usarPista(pista: Pista): Promise<void> {
    if (this.destruido) return
    this.carga?.abort()
    this.carga = null
    let buffer = this.buffers.get(pista)

    if (!buffer) {
      const carga = new AbortController()
      this.carga = carga
      this.publicar({
        cargando: this.actual.duracionMs === null,
        cargandoPista: pista,
        error: null
      })
      let error: NonNullable<EstadoMotor['error']> = 'carga'
      try {
        const cargar = this.opciones.fetch ?? globalThis.fetch.bind(globalThis)
        const respuesta = await cargar(urlPista(this.opciones.cancionId, pista), {
          signal: carga.signal
        })
        if (!respuesta.ok) throw new Error('No se pudo leer la pista.')
        const bytes = await respuesta.arrayBuffer()
        if (carga.signal.aborted) return
        error = 'decodificacion'
        buffer = await this.prepararContexto().decodeAudioData(bytes)
      } catch {
        if (!carga.signal.aborted) {
          this.carga = null
          this.publicar({ cargando: false, cargandoPista: null, error })
        }
        return
      }
      if (carga.signal.aborted) return
      this.carga = null
    }

    const reproduccion = this.reproduccion
    const posicion = this.posicionMs()
    this.audioLiberado = false
    this.buffers.delete(pista)
    this.buffers.set(pista, buffer)
    if (this.buffers.size > this.maxBuffers) {
      const primera = this.buffers.keys().next().value
      if (primera !== undefined) this.buffers.delete(primera)
    }

    const duracionMs = buffer.duration * 1000
    const bucle = this.bucle ? intervaloAudible(this.bucle, duracionMs) : null
    if (this.bucle && !bucle) this.bucle = null
    this.posicionEnPausa = acotar(posicion, duracionMs)
    if (!reproduccion && bucle && !contiene(bucle, this.posicionEnPausa)) {
      this.posicionEnPausa = bucle.inicioMs
    }
    if (reproduccion && this.actual.pista !== pista) {
      this.arrancar(buffer, this.posicionEnPausa, this.actual.velocidad, reproduccion.hastaMs)
    }
    this.publicar({
      pista,
      cargando: false,
      cargandoPista: null,
      duracionMs,
      sonando: this.reproduccion !== null,
      error: null
    })
  }

  pistaCargando(): Pista | null {
    return this.actual.cargandoPista
  }

  async reproducir(opciones: { desdeMs?: number; hastaMs?: number } = {}): Promise<void> {
    if (this.destruido) return
    const solicitud = ++this.solicitudReproduccion
    if (this.audioLiberado && !this.carga) {
      await this.usarPista(this.actual.pista)
      if (solicitud !== this.solicitudReproduccion) return
    }
    const contexto = this.contexto
    if (!contexto || this.actual.duracionMs === null) return
    try {
      if (contexto.state !== 'running') await contexto.resume()
    } catch {
      if (solicitud === this.solicitudReproduccion) this.publicar({ error: 'carga' })
      return
    }
    if (solicitud !== this.solicitudReproduccion) return
    const buffer = this.buffers.get(this.actual.pista)
    if (!buffer) return
    const duracionMs = buffer.duration * 1000
    const posicion = this.posicionMs()
    const desde = acotar(opciones.desdeMs ?? (posicion >= duracionMs ? 0 : posicion), duracionMs)
    this.arrancar(buffer, desde, this.actual.velocidad, opciones.hastaMs)
    this.publicar({ sonando: this.reproduccion !== null, error: null })
  }

  private arrancar(
    buffer: AudioBuffer,
    desde: number,
    velocidad: Velocidad,
    hastaMs?: number
  ): void {
    this.detenerFuente()
    const contexto = this.contexto!
    const duracionMs = buffer.duration * 1000
    const bucle =
      hastaMs === undefined && this.bucle ? intervaloAudible(this.bucle, duracionMs) : null
    if (bucle && !contiene(bucle, desde)) desde = bucle.inicioMs
    this.posicionEnPausa = desde
    const finMs = Math.min(hastaMs ?? Infinity, duracionMs)
    if (finMs <= desde) return
    const fuente = contexto.createBufferSource()
    fuente.buffer = buffer
    fuente.playbackRate.value = velocidad
    configurarBucle(fuente, bucle)
    fuente.connect(this.ganancia!)
    const ctxInicio = contexto.currentTime
    this.reproduccion = {
      fuente,
      tramos: [{ anclaje: { ctxInicio, posInicioMs: desde, velocidad }, bucle }],
      finMs,
      hastaMs
    }
    fuente.onended = () => {
      if (this.reproduccion?.fuente !== fuente) return
      fuente.disconnect()
      this.reproduccion = null
      this.posicionEnPausa = finMs
      this.publicar({ sonando: false })
    }
    fuente.start(ctxInicio, desde / 1000)
    if (hastaMs !== undefined) fuente.stop(ctxInicio + (finMs - desde) / (1000 * velocidad))
  }

  private detenerFuente(): void {
    if (!this.reproduccion) return
    const { fuente } = this.reproduccion
    this.reproduccion = null
    fuente.onended = null
    fuente.stop()
    fuente.disconnect()
  }

  pausar(): void {
    this.solicitudReproduccion++
    if (!this.reproduccion) return
    this.posicionEnPausa = this.posicionMs()
    this.detenerFuente()
    this.publicar({ sonando: false })
  }

  /** Establece límites en tiempo de audio. La escucha con hastaMs conserva su propio final. */
  fijarBucle(intervalo: IntervaloBucle | null): boolean {
    if (this.destruido) return false
    const buffer = this.buffers.get(this.actual.pista)
    const bucle = intervalo && buffer ? intervaloAudible(intervalo, buffer.duration * 1000) : null
    if (intervalo && !bucle) return false
    if (!intervalo && this.bucle) this.solicitudReproduccion++
    this.bucle = intervalo
    const reproduccion = this.reproduccion
    if (!reproduccion) {
      if (bucle && !contiene(bucle, this.posicionEnPausa)) this.posicionEnPausa = bucle.inicioMs
      return true
    }
    if (reproduccion.hastaMs !== undefined) return true
    const ultimo = reproduccion.tramos.at(-1)!
    if (ultimo.bucle?.inicioMs === bucle?.inicioMs && ultimo.bucle?.finMs === bucle?.finMs)
      return true

    const ctxInicio = this.contexto!.currentTime
    const posicion = this.posicionMs()
    const posInicioMs = posicionEn(ctxInicio, ultimo)
    if (bucle && (!contiene(bucle, posicion) || !contiene(bucle, posInicioMs))) {
      this.arrancar(
        buffer!,
        contiene(bucle, posicion) ? posicion : bucle.inicioMs,
        this.actual.velocidad
      )
      return true
    }

    // El audio que ya salió del quantum de render puede seguir en la cola de salida.
    // Conserva sus tramos hasta que el reloj audible alcance el cambio de límites.
    const ctxOido = this.contextoOidoEn(this.ahoraPerf())
    const indice = reproduccion.tramos.findLastIndex((tramo) => tramo.anclaje.ctxInicio <= ctxOido)
    if (indice > 0) reproduccion.tramos.splice(0, indice)
    if (ultimo.anclaje.ctxInicio === ctxInicio) reproduccion.tramos.pop()
    configurarBucle(reproduccion.fuente, bucle)
    reproduccion.tramos.push({
      anclaje: { ctxInicio, posInicioMs, velocidad: this.actual.velocidad },
      bucle
    })
    return true
  }

  buscar(ms: number): void {
    this.posicionEnPausa = acotar(ms, this.actual.duracionMs ?? 0)
    if (this.bucle) {
      const bucle = intervaloAudible(this.bucle, this.actual.duracionMs ?? 0)
      if (!bucle || !contiene(bucle, this.posicionEnPausa)) {
        this.bucle = null
        this.solicitudReproduccion++
      }
    }
    if (this.reproduccion) {
      this.arrancar(
        this.buffers.get(this.actual.pista)!,
        this.posicionEnPausa,
        this.actual.velocidad
      )
      if (!this.reproduccion) this.publicar({ sonando: false })
    }
  }

  fijarVelocidad(velocidad: Velocidad): void {
    if (velocidad === this.actual.velocidad) return
    if (this.reproduccion) {
      this.arrancar(
        this.buffers.get(this.actual.pista)!,
        this.posicionMs(),
        velocidad,
        this.reproduccion.hastaMs
      )
    }
    this.publicar({ velocidad, sonando: this.reproduccion !== null })
  }

  fijarVolumen(valor: number): void {
    const volumen = acotar(valor, 1)
    if (volumen === this.actual.volumen) return
    if (this.ganancia) this.ganancia.gain.value = gananciaLineal(this.opciones.gananciaDb, volumen)
    this.publicar({ volumen })
  }

  posicionMs(): number {
    return this.tiempoDeEvento(this.ahoraPerf()) ?? this.posicionEnPausa
  }

  tiempoDeEvento(timeStampMs: number): number | null {
    const reproduccion = this.reproduccion
    if (!this.contexto || !reproduccion) return null
    const ctx = this.contextoOidoEn(timeStampMs)
    const tramo =
      reproduccion.tramos.findLast((actual) => actual.anclaje.ctxInicio <= ctx) ??
      reproduccion.tramos[0]!
    return Math.min(reproduccion.finMs, posicionEn(ctx, tramo))
  }

  private contextoOidoEn(timeStampMs: number): number {
    const contexto = this.contexto!
    const marca = contexto.getOutputTimestamp?.()
    return ctxOidoEn(
      timeStampMs,
      marca?.contextTime !== undefined && marca.performanceTime !== undefined
        ? { contextTime: marca.contextTime, performanceTime: marca.performanceTime }
        : null,
      { ctx: contexto.currentTime, perf: this.ahoraPerf() },
      (contexto.outputLatency ?? 0) + (contexto.baseLatency ?? 0)
    )
  }

  /** Libera el audio de la escucha durante la prueba a pantalla completa. */
  liberarAudio(): void {
    if (this.destruido) return
    this.posicionEnPausa = this.posicionMs()
    this.solicitudReproduccion++
    this.detenerFuente()
    this.bucle = null
    this.carga?.abort()
    this.carga = null
    this.buffers.clear()
    this.audioLiberado = true
    this.publicar({ sonando: false, cargando: false, cargandoPista: null })
  }

  destruir(): void {
    if (this.destruido) return
    this.destruido = true
    this.oyentes.clear()
    this.pausar()
    this.bucle = null
    this.carga?.abort()
    this.carga = null
    this.buffers.clear()
    this.ganancia?.disconnect()
    void this.contexto?.close().catch(() => undefined)
  }
}
