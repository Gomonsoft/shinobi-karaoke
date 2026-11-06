import { gananciaLineal, urlPista, type Pista } from './pistas'
import { ctxOidoEn, msCancionEn, type Anclaje } from './reloj'

export type ModoAudio = 'karaoke' | 'original'
export type ErrorPista = 'no_encontrada' | 'lectura' | 'decodificacion'

export interface OpcionesMotorReproductor {
  cancionId: string
  modo: ModoAudio
  gananciaDb: number
  volumen: number
  silenciado: boolean
  volumenVoz: number
  vozSilenciada: boolean
  crearContexto?: () => AudioContext
  fetch?: typeof fetch
  ahoraPerf?: () => number
}

interface FalloPista {
  tipo: ErrorPista
  detalle: string
  ruta: string
}

export interface EstadoMotorReproductor {
  listo: boolean
  cargando: boolean
  sonando: boolean
  finalizado: boolean
  duracionMs: number | null
  vozDisponible: boolean
  errorPrincipal: FalloPista | null
  errorVoz: FalloPista | null
}

type CargaPista = { buffer: AudioBuffer; error: null } | { buffer: null; error: FalloPista }

interface Reproduccion {
  principal: AudioBufferSourceNode
  voz: AudioBufferSourceNode | null
  anclaje: Anclaje
}

function detalleSeguro(error: unknown, tipo: ErrorPista): string {
  const mensaje = error instanceof Error ? error.message : ''
  // Los detalles se pueden copiar. Un mensaje con una ruta puede incluir datos personales.
  const tieneRuta = /:\/\/|[a-z]:[\\/]|(?:^|[\s"'(:])[/\\]/i.test(mensaje)
  if (mensaje && !tieneRuta) return mensaje
  return tipo === 'decodificacion'
    ? 'No se pudo decodificar el audio.'
    : 'No se pudo leer el audio.'
}

export class MotorReproductor {
  private readonly oyentes = new Set<(e: EstadoMotorReproductor) => void>()
  private readonly aborto = new AbortController()
  private readonly ahoraPerf: () => number
  private readonly pistaPrincipal: Pista
  private readonly cargarArchivo: typeof fetch
  private contexto: AudioContext | null = null
  private maestra: GainNode | null = null
  private gananciaVoz: GainNode | null = null
  private gananciaGeneral: number
  private nivelVoz: number
  private carga: Promise<void> | null = null
  private principal: AudioBuffer | null = null
  private voz: AudioBuffer | null = null
  private reproduccion: Reproduccion | null = null
  private posicionEnPausa = 0
  private solicitudReproduccion = 0
  private actual: EstadoMotorReproductor = {
    listo: false,
    cargando: false,
    sonando: false,
    finalizado: false,
    duracionMs: null,
    vozDisponible: false,
    errorPrincipal: null,
    errorVoz: null
  }

  constructor(private readonly opciones: OpcionesMotorReproductor) {
    this.pistaPrincipal = opciones.modo === 'karaoke' ? 'instrumental' : 'original'
    this.ahoraPerf = opciones.ahoraPerf ?? (() => performance.now())
    this.cargarArchivo = opciones.fetch ?? globalThis.fetch.bind(globalThis)
    this.gananciaGeneral = opciones.silenciado
      ? 0
      : gananciaLineal(opciones.gananciaDb, opciones.volumen)
    this.nivelVoz = opciones.vozSilenciada ? 0 : opciones.volumenVoz
  }

  estado(): EstadoMotorReproductor {
    return this.actual
  }

  suscribir(cb: (e: EstadoMotorReproductor) => void): () => void {
    this.oyentes.add(cb)
    return () => this.oyentes.delete(cb)
  }

  private publicar(cambio: Partial<EstadoMotorReproductor>): void {
    this.actual = { ...this.actual, ...cambio }
    for (const oyente of this.oyentes) oyente(this.actual)
  }

  cargar(): Promise<void> {
    if (this.aborto.signal.aborted) return Promise.resolve()
    if (this.carga) return this.carga
    this.carga = Promise.resolve().then(() => this.cargarPistas())
    this.publicar({ cargando: true })
    return this.carga
  }

  private async cargarPistas(): Promise<void> {
    if (this.aborto.signal.aborted) return
    let contexto: AudioContext
    try {
      contexto = this.opciones.crearContexto?.() ?? new AudioContext()
      this.contexto = contexto
      this.maestra = contexto.createGain()
      this.maestra.gain.value = this.gananciaGeneral
      this.maestra.connect(contexto.destination)
      if (this.pistaPrincipal === 'instrumental') {
        this.gananciaVoz = contexto.createGain()
        this.gananciaVoz.gain.value = this.nivelVoz
        this.gananciaVoz.connect(this.maestra)
      }
    } catch (error) {
      this.publicar({ cargando: false, errorPrincipal: this.errorDePrincipal(error) })
      return
    }

    const [principal, voz] = await Promise.all([
      this.leerPista(contexto, this.pistaPrincipal),
      this.gananciaVoz ? this.leerPista(contexto, 'voz') : null
    ])
    if (this.aborto.signal.aborted) return
    this.principal = principal?.buffer ?? null
    this.voz = voz?.buffer ?? null
    this.publicar({
      cargando: false,
      listo: this.principal !== null,
      duracionMs: this.principal ? this.principal.duration * 1000 : null,
      vozDisponible: this.voz !== null,
      errorPrincipal: principal?.error ?? null,
      errorVoz: voz?.error ?? null
    })
  }

  private errorDePrincipal(error: unknown): FalloPista {
    const url = urlPista(this.opciones.cancionId, this.pistaPrincipal)
    return {
      tipo: 'lectura',
      detalle: detalleSeguro(error, 'lectura'),
      ruta: new URL(url).pathname.slice(1)
    }
  }

  private async leerPista(contexto: AudioContext, pista: Pista): Promise<CargaPista | null> {
    const url = urlPista(this.opciones.cancionId, pista)
    const ruta = new URL(url).pathname.slice(1)
    const { signal } = this.aborto
    let tipo: ErrorPista = 'lectura'
    try {
      const respuesta = await this.cargarArchivo(url, { signal })
      if (!respuesta.ok) {
        tipo = respuesta.status === 404 ? 'no_encontrada' : 'lectura'
        return { buffer: null, error: { tipo, ruta, detalle: `HTTP ${respuesta.status}` } }
      }
      const bytes = await respuesta.arrayBuffer()
      if (signal.aborted) return null
      tipo = 'decodificacion'
      return { buffer: await contexto.decodeAudioData(bytes), error: null }
    } catch (error) {
      return signal.aborted
        ? null
        : { buffer: null, error: { tipo, ruta, detalle: detalleSeguro(error, tipo) } }
    }
  }

  async reproducir({ desdeMs }: { desdeMs?: number } = {}): Promise<void> {
    const solicitud = ++this.solicitudReproduccion
    await this.cargar()
    const contexto = this.contexto
    const duracion = this.actual.duracionMs
    if (solicitud !== this.solicitudReproduccion || !contexto || duracion === null) return
    try {
      if (contexto.state !== 'running') await contexto.resume()
    } catch (error) {
      if (solicitud === this.solicitudReproduccion) {
        this.pausar()
        this.publicar({ errorPrincipal: this.errorDePrincipal(error) })
      }
      return
    }
    if (solicitud !== this.solicitudReproduccion) return
    const posicion = this.posicionMs()
    this.arrancar(Math.min(desdeMs ?? (posicion >= duracion ? 0 : posicion), duracion))
    this.publicar({ sonando: this.reproduccion !== null, finalizado: false, errorPrincipal: null })
  }

  private arrancar(desdeMs: number): void {
    this.detenerFuentes()
    this.posicionEnPausa = desdeMs
    const contexto = this.contexto!
    const duracionMs = this.actual.duracionMs!
    if (desdeMs >= duracionMs) return

    const principal = contexto.createBufferSource()
    principal.buffer = this.principal
    principal.connect(this.maestra!)
    let voz: AudioBufferSourceNode | null = null
    if (this.voz) {
      voz = contexto.createBufferSource()
      voz.buffer = this.voz
      voz.connect(this.gananciaVoz!)
    }

    const ctxInicio = contexto.currentTime
    const cuando = ctxInicio + Math.max(0, -desdeMs) / 1000
    const offset = Math.max(0, desdeMs) / 1000
    this.reproduccion = {
      principal,
      voz,
      anclaje: { ctxInicio, posInicioMs: desdeMs, velocidad: 1 }
    }
    principal.onended = () => {
      if (this.reproduccion?.principal !== principal) return
      this.detenerFuentes()
      this.posicionEnPausa = duracionMs
      this.publicar({ sonando: false, finalizado: true })
    }
    principal.start(cuando, offset)
    voz?.start(cuando, offset)
    if (this.voz && this.voz.duration * 1000 > duracionMs) {
      voz?.stop(ctxInicio + (duracionMs - desdeMs) / 1000)
    }
  }

  private detenerFuentes(): void {
    if (!this.reproduccion) return
    const { principal, voz } = this.reproduccion
    this.reproduccion = null
    principal.onended = null
    for (const fuente of [principal, voz]) {
      fuente?.stop()
      fuente?.disconnect()
    }
  }

  pausar(): void {
    this.solicitudReproduccion++
    if (!this.reproduccion) return
    this.posicionEnPausa = this.posicionMs()
    this.detenerFuentes()
    this.publicar({ sonando: false })
  }

  buscar(ms: number): void {
    this.solicitudReproduccion++
    this.posicionEnPausa = Math.max(0, Math.min(ms, this.actual.duracionMs ?? 0))
    if (this.reproduccion) this.arrancar(this.posicionEnPausa)
    this.publicar({ sonando: this.reproduccion !== null, finalizado: false })
  }

  posicionMs(): number {
    const contexto = this.contexto
    const anclaje = this.reproduccion?.anclaje
    if (!contexto || !anclaje) return this.posicionEnPausa
    const marca = contexto.getOutputTimestamp?.()
    const perf = this.ahoraPerf()
    const oido = ctxOidoEn(
      perf,
      marca?.contextTime !== undefined && marca.performanceTime !== undefined
        ? { contextTime: marca.contextTime, performanceTime: marca.performanceTime }
        : null,
      { ctx: contexto.currentTime, perf },
      (contexto.outputLatency ?? 0) + (contexto.baseLatency ?? 0)
    )
    return Math.min(
      this.actual.duracionMs!,
      msCancionEn(Math.max(oido, anclaje.ctxInicio), anclaje)
    )
  }

  fijarVolumen(v: number, silenciado: boolean): void {
    this.gananciaGeneral = silenciado ? 0 : gananciaLineal(this.opciones.gananciaDb, v)
    if (this.maestra) this.maestra.gain.value = this.gananciaGeneral
  }

  fijarVoz(v: number, silenciada: boolean): void {
    this.nivelVoz = silenciada ? 0 : v
    if (this.gananciaVoz) this.gananciaVoz.gain.value = this.nivelVoz
  }

  destruir(): void {
    if (this.aborto.signal.aborted) return
    this.oyentes.clear()
    this.pausar()
    this.aborto.abort()
    this.principal = null
    this.voz = null
    this.gananciaVoz?.disconnect()
    this.maestra?.disconnect()
    void this.contexto?.close().catch(() => undefined)
    this.contexto = null
    this.gananciaVoz = null
    this.maestra = null
    this.publicar({ cargando: false, listo: false, vozDisponible: false })
  }
}
