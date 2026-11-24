import type { PuntoEnvolvente } from '@shared/coros'
import { gananciaLineal, urlPista, type Pista } from './pistas'
import { estirarEnWorker } from './estiramientoCliente'
import { mezclarCorosEnWorker } from './mezclaCorosCliente'
import { ctxOidoEn, msBucleEn, msCancionEn, type Anclaje, type IntervaloBucle } from './reloj'

export interface OpcionesMotor {
  cancionId: string
  gananciaDb: number
  volumen: number
  crearContexto?: () => AudioContext
  fetch?: typeof fetch
  ahoraPerf?: () => number
  maxBuffers?: number
  /** Estiramiento con el tono conservado (por defecto, el worker de la tarea 0274). */
  estirar?: (
    canales: Float32Array[],
    sampleRate: number,
    velocidad: 0.5 | 0.75,
    signal: AbortSignal
  ) => Promise<Float32Array[]>
  /** «Instrumental con coros» (ADR 0030 §4): por defecto, el worker de `mezclaCoros`. Recibe copias y las posee. */
  mezclarCoros?: (
    instrumental: Float32Array[],
    voz: Float32Array[],
    sampleRate: number,
    puntos: PuntoEnvolvente[],
    signal: AbortSignal
  ) => Promise<Float32Array[]>
  /** Espera tras el último cambio de los coros antes de recalcular (ADR 0030 §4: 300 ms). */
  esperaCorosMs?: number
  /** Si el cálculo pasa de esto, el estado marca `corosPreparando` (ADR 0030 §4: 500 ms). */
  avisoCorosMs?: number
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
  /** `false` solo si el estiramiento del tramo falló: la velocidad baja el tono (nota de la ventana). */
  tonoConservado: boolean
  /** El cálculo de la pista con coros lleva más de 500 ms (la interfaz dice «Preparando los coros…»). */
  corosPreparando?: boolean
  /** La mezcla de los coros falló: suena el instrumental solo. Se mantiene hasta una mezcla correcta. */
  corosError?: boolean
  /** Existe la pista «instrumental con coros» para los coros de ahora. */
  corosListos?: boolean
}

/** Tramo de la pista estirado, con el tono conservado, para una velocidad. */
interface Estirado {
  origen: AudioBuffer
  buffer: AudioBuffer
  velocidad: 0.5 | 0.75
  /** Límites del tramo alineados a muestra, en ms de la pista. */
  inicioMs: number
  finMs: number
}

interface ClaveEstirado {
  origen: AudioBuffer
  inicioMs: number
  finMs: number
  velocidad: number
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
  /** Buffer estirado que suena (los tiempos del nodo van en su base), si lo hay. */
  estirado?: Estirado
  /** Fuente anterior y contexto del relevo pendiente al estirado (en el paso por el inicio del bucle). */
  previa?: AudioBufferSourceNode
  cambioCtx?: number
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

/** Segundos del buffer estirado que corresponden a `ms` de la pista. */
function segundosEstirado(ms: number, e: Estirado): number {
  return Math.max(0, Math.min(e.buffer.duration, (ms - e.inicioMs) / (1000 * e.velocidad)))
}

function dentroDe(bucle: IntervaloBucle, e: Estirado): boolean {
  const holgura = 1000 / e.buffer.sampleRate
  return bucle.inicioMs >= e.inicioMs - holgura && bucle.finMs <= e.finMs + holgura
}

function configurarBucle(
  fuente: AudioBufferSourceNode,
  bucle: IntervaloBucle | null,
  estirado?: Estirado
): void {
  if (bucle) {
    fuente.loopStart = estirado ? segundosEstirado(bucle.inicioMs, estirado) : bucle.inicioMs / 1000
    fuente.loopEnd = estirado ? segundosEstirado(bucle.finMs, estirado) : bucle.finMs / 1000
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
  private tramoTono: IntervaloBucle | null = null
  private estirado: Estirado | null = null
  private preparando: { clave: ClaveEstirado; carga: AbortController } | null = null
  private fallido: ClaveEstirado | null = null
  private previoBucle = false
  private posicionEnPausa = 0
  private solicitudReproduccion = 0
  private audioLiberado = false
  private destruido = false
  // Pista derivada «instrumental con coros» (ADR 0030 §4). Va aparte del LRU: con ella el motor tiene a lo
  // sumo `maxBuffers` pistas más la derivada (el «3» del ADR).
  private puntosCoros: readonly PuntoEnvolvente[] = []
  private derivada: AudioBuffer | null = null
  private puntosDerivada: readonly PuntoEnvolvente[] | null = null
  private temporizadorCoros: ReturnType<typeof setTimeout> | null = null
  private calculoCoros: AbortController | null = null
  private forzarCoros = false

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
      volumen: acotar(opciones.volumen, 1),
      tonoConservado: true,
      corosPreparando: false,
      corosError: false,
      corosListos: false
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
      const efectivo = pista === 'instrumental' && this.derivada ? this.derivada : buffer
      this.arrancar(efectivo, this.posicionEnPausa, this.actual.velocidad, reproduccion.hastaMs)
    }
    this.publicar({
      pista,
      cargando: false,
      cargandoPista: null,
      duracionMs,
      sonando: this.reproduccion !== null,
      error: null
    })
    this.prepararEstirado()
    // Con «Instrumental» y coros que aún no tienen mezcla, se calcula ya (sin la espera de los cambios).
    if (this.necesitaCoros() && !this.corosVigentes()) this.programarCoros(0)
  }

  pistaCargando(): Pista | null {
    return this.actual.cargandoPista
  }

  async reproducir(
    opciones: { desdeMs?: number; hastaMs?: number; conCoros?: boolean } = {}
  ): Promise<void> {
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
    // `conCoros`: esta escucha usa la pista con coros aunque la elegida sea otra («Escuchar un coro»).
    this.forzarCoros = opciones.conCoros === true
    const buffer = this.bufferDe()
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
    // Con `conservarBucle` se puede empezar antes del bucle: suena el margen y luego envuelve.
    if (bucle && !contiene(bucle, desde) && !(this.previoBucle && desde < bucle.inicioMs)) {
      desde = bucle.inicioMs
    }
    if (!bucle || desde >= bucle.inicioMs) this.previoBucle = false
    this.posicionEnPausa = desde
    const finMs = Math.min(hastaMs ?? Infinity, duracionMs)
    if (finMs <= desde) return
    const estirado = this.estiradoUsable(buffer, velocidad, desde, hastaMs, bucle)
    const fuente = contexto.createBufferSource()
    fuente.buffer = estirado?.buffer ?? buffer
    fuente.playbackRate.value = estirado ? 1 : velocidad
    configurarBucle(fuente, bucle, estirado)
    fuente.connect(this.ganancia!)
    const ctxInicio = contexto.currentTime
    this.reproduccion = {
      fuente,
      tramos: [{ anclaje: { ctxInicio, posInicioMs: desde, velocidad }, bucle }],
      finMs,
      hastaMs,
      estirado
    }
    this.alTerminar(fuente, finMs)
    fuente.start(ctxInicio, estirado ? segundosEstirado(desde, estirado) : desde / 1000)
    if (hastaMs !== undefined) fuente.stop(ctxInicio + (finMs - desde) / (1000 * velocidad))
  }

  private alTerminar(fuente: AudioBufferSourceNode, finMs: number): void {
    fuente.onended = () => {
      if (this.reproduccion?.fuente !== fuente) return
      fuente.disconnect()
      this.reproduccion = null
      this.posicionEnPausa = finMs
      this.publicar({ sonando: false })
    }
  }

  private detenerFuente(): void {
    if (!this.reproduccion) return
    const { fuente, previa } = this.reproduccion
    this.reproduccion = null
    for (const nodo of previa ? [previa, fuente] : [fuente]) {
      nodo.onended = null
      nodo.stop()
      nodo.disconnect()
    }
  }

  /** El estirado se usa solo si la reproducción empieza y termina dentro del tramo. */
  private estiradoUsable(
    origen: AudioBuffer,
    velocidad: Velocidad,
    desdeMs: number,
    hastaMs: number | undefined,
    bucle: IntervaloBucle | null
  ): Estirado | undefined {
    const e = this.estirado
    if (!e || e.origen !== origen || e.velocidad !== velocidad) return undefined
    const holgura = 1000 / e.buffer.sampleRate
    if (bucle) return dentroDe(bucle, e) && desdeMs >= e.inicioMs - holgura ? e : undefined
    return hastaMs !== undefined && desdeMs >= e.inicioMs - holgura && hastaMs <= e.finMs + holgura
      ? e
      : undefined
  }

  /** Tramo de la ventana del editor preciso, en tiempo de audio; `null` al cerrarla. */
  fijarTramoConTono(intervalo: IntervaloBucle | null): void {
    if (this.destruido) return
    const valido =
      intervalo && Number.isFinite(intervalo.inicioMs) && Number.isFinite(intervalo.finMs)
    this.tramoTono = valido && intervalo.inicioMs < intervalo.finMs ? { ...intervalo } : null
    if (!this.tramoTono) this.invalidarEstirado()
    this.prepararEstirado()
  }

  private invalidarEstirado(): void {
    this.preparando?.carga.abort()
    this.preparando = null
    this.estirado = null
    this.fallido = null
    if (!this.actual.tonoConservado) this.publicar({ tonoConservado: true })
  }

  private claveActual(): ClaveEstirado | null {
    const origen = this.bufferDe()
    const tramo = this.tramoTono
    if (!origen || !tramo || this.actual.velocidad === 1 || this.audioLiberado) return null
    const sr = origen.sampleRate
    const inicio = Math.round((acotar(tramo.inicioMs, origen.duration * 1000) * sr) / 1000)
    const fin = Math.round((acotar(tramo.finMs, origen.duration * 1000) * sr) / 1000)
    if (fin <= inicio) return null
    return {
      origen,
      inicioMs: (inicio / sr) * 1000,
      finMs: (fin / sr) * 1000,
      velocidad: this.actual.velocidad
    }
  }

  private mismaClave(a: ClaveEstirado | null, b: ClaveEstirado | null): boolean {
    return (
      !!a &&
      !!b &&
      a.origen === b.origen &&
      a.inicioMs === b.inicioMs &&
      a.finMs === b.finMs &&
      a.velocidad === b.velocidad
    )
  }

  /** Deja listo el buffer estirado del tramo para (pista, tramo, velocidad); descarta el que no cuadra. */
  private prepararEstirado(): void {
    const clave = this.claveActual()
    if (this.estirado && !this.mismaClave(this.estirado, clave)) this.estirado = null
    if (this.preparando && !this.mismaClave(this.preparando.clave, clave)) {
      this.preparando.carga.abort()
      this.preparando = null
    }
    if (this.fallido && !this.mismaClave(this.fallido, clave)) this.fallido = null
    if (!clave) {
      if (!this.actual.tonoConservado) this.publicar({ tonoConservado: true })
      return
    }
    if (this.estirado || this.preparando || this.fallido) return
    if (!this.actual.tonoConservado) this.publicar({ tonoConservado: true })
    void this.estirarClave(clave)
  }

  private async estirarClave(clave: ClaveEstirado): Promise<void> {
    const carga = new AbortController()
    this.preparando = { clave, carga }
    const sr = clave.origen.sampleRate
    const inicio = Math.round((clave.inicioMs * sr) / 1000)
    const fin = Math.round((clave.finMs * sr) / 1000)
    const velocidad = clave.velocidad as 0.5 | 0.75
    try {
      const canales = Array.from({ length: clave.origen.numberOfChannels }, (_, c) =>
        clave.origen.getChannelData(c).slice(inicio, fin)
      )
      const estirar = this.opciones.estirar ?? estirarEnWorker
      const salida = await estirar(canales, sr, velocidad, carga.signal)
      if (carga.signal.aborted) return
      const esperado = Math.round((fin - inicio) / velocidad)
      if (
        salida.length !== canales.length ||
        salida.some((canal) => Math.abs(canal.length - esperado) > 1)
      ) {
        throw new Error('El estiramiento devolvió una duración inesperada.')
      }
      const buffer = this.prepararContexto().createBuffer(salida.length, salida[0]!.length, sr)
      salida.forEach((canal, c) => buffer.copyToChannel(canal as Float32Array<ArrayBuffer>, c))
      this.preparando = null
      this.estirado = { ...clave, buffer, velocidad }
      this.cambiarAEstirado()
    } catch (e) {
      if (carga.signal.aborted) return
      this.preparando = null
      this.fallido = clave
      console.warn('No se pudo estirar el tramo con el tono conservado; se usa la velocidad.', e)
      this.publicar({ tonoConservado: false })
    }
  }

  /**
   * Si suena el bucle con `playbackRate` y el estirado ya está listo, relevo en el siguiente
   * paso por el inicio del bucle: la fuente nueva arranca justo cuando la anterior termina
   * la vuelta, con un anclaje nuevo (misma fórmula del reloj).
   */
  private cambiarAEstirado(): void {
    const r = this.reproduccion
    const e = this.estirado
    const contexto = this.contexto
    if (!r || !e || !contexto || r.estirado || r.hastaMs !== undefined) return
    const ultimo = r.tramos.at(-1)!
    const bucle = ultimo.bucle
    const ahora = contexto.currentTime
    if (!bucle || !dentroDe(bucle, e) || ultimo.anclaje.velocidad !== e.velocidad) return
    if (r.cambioCtx !== undefined && r.cambioCtx > ahora) return
    const velocidad = e.velocidad
    const vuelta = (bucle.finMs - bucle.inicioMs) / (1000 * velocidad)
    let ctxCambio = ahora + (bucle.finMs - posicionEn(ahora, ultimo)) / (1000 * velocidad)
    if (ctxCambio - ahora < 0.02) ctxCambio += vuelta
    const fuente = contexto.createBufferSource()
    fuente.buffer = e.buffer
    fuente.playbackRate.value = 1
    configurarBucle(fuente, bucle, e)
    fuente.connect(this.ganancia!)
    fuente.start(ctxCambio, segundosEstirado(bucle.inicioMs, e))
    r.fuente.stop(ctxCambio)
    r.previa = r.fuente
    r.fuente = fuente
    r.estirado = e
    r.cambioCtx = ctxCambio
    r.tramos.push({
      anclaje: { ctxInicio: ctxCambio, posInicioMs: bucle.inicioMs, velocidad },
      bucle
    })
    this.alTerminar(fuente, r.finMs)
  }

  // --- Instrumental con coros (ADR 0030 §4) -----------------------------------------------------------

  /** La pista que suena: la derivada con «Instrumental» (o con `conCoros`) si existe; si no, la elegida. */
  private bufferDe(): AudioBuffer | undefined {
    if (this.derivada && (this.actual.pista === 'instrumental' || this.forzarCoros)) {
      return this.derivada
    }
    return this.buffers.get(this.actual.pista)
  }

  private necesitaCoros(): boolean {
    return this.puntosCoros.length > 0 && this.actual.pista === 'instrumental'
  }

  private corosVigentes(): boolean {
    const a = this.puntosDerivada
    const b = this.puntosCoros
    return (
      this.derivada !== null &&
      a !== null &&
      a.length === b.length &&
      a.every((p, i) => p[0] === b[i]![0] && p[1] === b[i]![1])
    )
  }

  /**
   * Puntos `[ms, nivel]` de la voz en los coros (`shared/coros`); `[]` = sin coros o nivel 0, y se vuelve
   * al instrumental. Una petición nueva cancela la anterior (solo vale la última) y el cálculo empieza tras
   * `esperaCorosMs` de calma; mientras tanto suena la mezcla anterior.
   */
  fijarCoros(puntos: readonly PuntoEnvolvente[]): void {
    if (this.destruido) return
    const nuevos = puntos.map(([ms, nivel]): PuntoEnvolvente => [ms, nivel])
    const iguales =
      nuevos.length === this.puntosCoros.length &&
      nuevos.every((p, i) => p[0] === this.puntosCoros[i]![0] && p[1] === this.puntosCoros[i]![1])
    if (iguales) return
    this.puntosCoros = nuevos
    this.cancelarCoros()
    if (this.puntosCoros.length === 0) {
      this.soltarDerivada()
      if (this.actual.corosError) this.publicar({ corosError: false })
      return
    }
    if (this.corosVigentes()) return
    if (this.necesitaCoros()) this.programarCoros(this.opciones.esperaCorosMs ?? 300)
  }

  /** Calcula ahora la pista con coros (sin esperar) y dice si quedó lista; para «Escuchar un coro». */
  async prepararCoros(): Promise<boolean> {
    if (this.destruido || this.puntosCoros.length === 0) return false
    if (this.corosVigentes()) return true
    this.cancelarCoros()
    return this.calcularCoros()
  }

  private programarCoros(esperaMs: number): void {
    if (this.temporizadorCoros) clearTimeout(this.temporizadorCoros)
    this.temporizadorCoros = setTimeout(() => {
      this.temporizadorCoros = null
      void this.calcularCoros()
    }, esperaMs)
  }

  private cancelarCoros(): void {
    if (this.temporizadorCoros) clearTimeout(this.temporizadorCoros)
    this.temporizadorCoros = null
    this.calculoCoros?.abort()
    this.calculoCoros = null
    if (this.actual.corosPreparando) this.publicar({ corosPreparando: false })
  }

  /** Lee y decodifica una pista que no está en el LRU (queda en una variable local, no en `buffers`). */
  private async pistaParaMezcla(pista: Pista, signal: AbortSignal): Promise<AudioBuffer> {
    const guardada = this.buffers.get(pista)
    if (guardada) return guardada
    const cargar = this.opciones.fetch ?? globalThis.fetch.bind(globalThis)
    const respuesta = await cargar(urlPista(this.opciones.cancionId, pista), { signal })
    if (!respuesta.ok) throw new Error('No se pudo leer la pista.')
    const bytes = await respuesta.arrayBuffer()
    return this.prepararContexto().decodeAudioData(bytes)
  }

  private async calcularCoros(): Promise<boolean> {
    const puntos = this.puntosCoros
    if (puntos.length === 0) return false
    const carga = new AbortController()
    this.calculoCoros = carga
    // El cliente mide el tiempo desde que empieza el cálculo: pasado el plazo, la interfaz lo avisa.
    const aviso = setTimeout(() => {
      if (!carga.signal.aborted) this.publicar({ corosPreparando: true })
    }, this.opciones.avisoCorosMs ?? 500)
    try {
      const [instrumental, voz] = await Promise.all([
        this.pistaParaMezcla('instrumental', carga.signal),
        this.pistaParaMezcla('voz', carga.signal)
      ])
      if (carga.signal.aborted) return false
      const sr = instrumental.sampleRate
      const copiar = (b: AudioBuffer): Float32Array[] =>
        Array.from({ length: b.numberOfChannels }, (_, c) => b.getChannelData(c).slice())
      const mezclar = this.opciones.mezclarCoros ?? mezclarCorosEnWorker
      const salida = await mezclar(
        copiar(instrumental),
        copiar(voz),
        sr,
        puntos.map(([ms, nivel]) => [ms, nivel]),
        carga.signal
      )
      if (carga.signal.aborted) return false
      const buffer = this.prepararContexto().createBuffer(salida.length, salida[0]!.length, sr)
      salida.forEach((canal, c) => buffer.copyToChannel(canal as Float32Array<ArrayBuffer>, c))
      this.adoptarDerivada(buffer, puntos)
      this.publicar({ corosPreparando: false, corosError: false, corosListos: true })
      return true
    } catch (e) {
      if (carga.signal.aborted) return false
      console.warn('No se pudo preparar la voz de los coros; suena el instrumental solo.', e)
      this.soltarDerivada()
      this.publicar({ corosPreparando: false, corosError: true })
      return false
    } finally {
      clearTimeout(aviso)
      if (this.calculoCoros === carga) this.calculoCoros = null
    }
  }

  /** Cambia la pista derivada; si suena la que se sustituye, relevo en el mismo punto. */
  private adoptarDerivada(buffer: AudioBuffer | null, puntos: readonly PuntoEnvolvente[] | null) {
    const enUso = this.actual.pista === 'instrumental' || this.forzarCoros
    this.derivada = buffer
    this.puntosDerivada = puntos
    const nuevo = this.bufferDe()
    if (this.reproduccion && enUso && nuevo) {
      this.arrancar(nuevo, this.posicionMs(), this.actual.velocidad, this.reproduccion.hastaMs)
      this.publicar({ sonando: this.reproduccion !== null })
    }
    this.prepararEstirado()
    if (this.actual.corosListos !== (buffer !== null))
      this.publicar({ corosListos: buffer !== null })
  }

  private soltarDerivada(): void {
    if (this.derivada) this.adoptarDerivada(null, null)
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
    const buffer = this.bufferDe()
    const bucle = intervalo && buffer ? intervaloAudible(intervalo, buffer.duration * 1000) : null
    if (intervalo && !bucle) return false
    if (!intervalo && this.bucle) this.solicitudReproduccion++
    if (intervalo?.inicioMs !== this.bucle?.inicioMs) this.previoBucle = false
    this.bucle = intervalo
    const reproduccion = this.reproduccion
    if (!reproduccion) {
      if (bucle && !contiene(bucle, this.posicionEnPausa)) {
        if (!(this.previoBucle && this.posicionEnPausa < bucle.inicioMs)) {
          this.posicionEnPausa = bucle.inicioMs
        }
      }
      return true
    }
    if (reproduccion.hastaMs !== undefined) return true
    const ultimo = reproduccion.tramos.at(-1)!
    if (ultimo.bucle?.inicioMs === bucle?.inicioMs && ultimo.bucle?.finMs === bucle?.finMs)
      return true

    const ctxInicio = this.contexto!.currentTime
    const posicion = this.posicionMs()
    const pendiente = reproduccion.cambioCtx !== undefined && reproduccion.cambioCtx > ctxInicio
    const estirado = reproduccion.estirado
    if (pendiente || (estirado && !(bucle && dentroDe(bucle, estirado)))) {
      // El relevo pendiente no se puede deshacer y el estirado no cubre los límites nuevos.
      this.arrancar(
        buffer!,
        bucle && !contiene(bucle, posicion) ? bucle.inicioMs : posicion,
        this.actual.velocidad
      )
      this.cambiarAEstirado()
      return true
    }
    const posInicioMs = posicionEn(ctxInicio, ultimo)
    if (bucle && (!contiene(bucle, posicion) || !contiene(bucle, posInicioMs))) {
      this.arrancar(
        buffer!,
        contiene(bucle, posicion) ? posicion : bucle.inicioMs,
        this.actual.velocidad
      )
      this.cambiarAEstirado()
      return true
    }

    // El audio que ya salió del quantum de render puede seguir en la cola de salida.
    // Conserva sus tramos hasta que el reloj audible alcance el cambio de límites.
    const ctxOido = this.contextoOidoEn(this.ahoraPerf())
    const indice = reproduccion.tramos.findLastIndex((tramo) => tramo.anclaje.ctxInicio <= ctxOido)
    if (indice > 0) reproduccion.tramos.splice(0, indice)
    if (ultimo.anclaje.ctxInicio === ctxInicio) reproduccion.tramos.pop()
    configurarBucle(reproduccion.fuente, bucle, estirado)
    reproduccion.tramos.push({
      anclaje: { ctxInicio, posInicioMs, velocidad: this.actual.velocidad },
      bucle
    })
    this.cambiarAEstirado()
    return true
  }

  /**
   * Con `conservarBucle`, buscar antes del inicio del bucle no lo suelta: suena ese tramo previo
   * una vez y después envuelve (escucha del margen previo sin rearmar el bucle). Buscar después
   * de su final sigue soltándolo.
   */
  buscar(ms: number, opciones: { conservarBucle?: boolean } = {}): void {
    this.posicionEnPausa = acotar(ms, this.actual.duracionMs ?? 0)
    this.previoBucle = false
    if (this.bucle) {
      const bucle = intervaloAudible(this.bucle, this.actual.duracionMs ?? 0)
      if (bucle && opciones.conservarBucle && this.posicionEnPausa < bucle.inicioMs) {
        this.previoBucle = true
      } else if (!bucle || !contiene(bucle, this.posicionEnPausa)) {
        this.bucle = null
        this.solicitudReproduccion++
      }
    }
    if (this.reproduccion) {
      this.arrancar(this.bufferDe()!, this.posicionEnPausa, this.actual.velocidad)
      if (!this.reproduccion) this.publicar({ sonando: false })
    }
  }

  fijarVelocidad(velocidad: Velocidad): void {
    if (velocidad === this.actual.velocidad) return
    if (this.reproduccion) {
      this.arrancar(this.bufferDe()!, this.posicionMs(), velocidad, this.reproduccion.hastaMs)
    }
    this.publicar({ velocidad, sonando: this.reproduccion !== null })
    this.prepararEstirado()
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
    this.invalidarEstirado()
    this.cancelarCoros()
    this.derivada = null
    this.puntosDerivada = null
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
    this.tramoTono = null
    this.invalidarEstirado()
    this.cancelarCoros()
    this.derivada = null
    this.puntosDerivada = null
    this.carga?.abort()
    this.carga = null
    this.buffers.clear()
    this.ganancia?.disconnect()
    void this.contexto?.close().catch(() => undefined)
  }
}
