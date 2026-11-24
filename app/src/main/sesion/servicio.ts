import { randomUUID } from 'node:crypto'
import type { RolVentana } from '../../shared/canales'
import { CANALES } from '../../shared/canales'
import { modalidadEfectiva, type Cancion } from '../../shared/cancion'
import type { Config } from '../../shared/config'
import type { CodigoError } from '../../shared/errores'
import { ESTILO_PREDETERMINADO, conSubrayadoDelEquipo, type Estilo } from '../../shared/estilo'
import { numerosLineasSinInicio, type Letra } from '../../shared/letra'
import type {
  AbrirSesion,
  ComandoSecundariaIpc,
  DondeAgregar,
  EntradaCargarIpc,
  EstadoSecundariaIpc,
  EstadoSesionIpc,
  InformeSecundariaIpc,
  ListaPantallasIpc,
  MotivoNoDisponible,
  PantallaIpc,
  PosicionSesionIpc,
  SesionInicialIpc
} from '../../shared/sesion'
import type { ConfigParcial } from '../configuracion'
import type { EventoCancion, ResumenCancion } from '../biblioteca'
import type { GestorReposo } from '../ventana/reposo'
import {
  crearEstado,
  reducir,
  type CausaCierre,
  type ComandoMaquina,
  type Efecto,
  type EstadoMaquina,
  type Evento,
  type InicioApertura,
  type Resultado
} from './maquina'
import { aIpcPrincipal, aIpcSecundaria } from './proyeccion'
import type { ManejadorSecundaria, PeticionSecundaria } from './ventanaSecundaria'

/**
 * Servicio de la sesión en vivo (ADR 0017 §5 a §9): dueño del estado de `maquina.ts`. Serializa cada
 * evento, aplica `reducir` con un reloj inyectable y ejecuta los efectos (comandos a la secundaria,
 * temporizadores, revalidación, difusión, bloqueo de edición, silencio, reposo y preferencia de pantalla).
 */

/** Error con código estable de la IPC (`aErrorIpc` lo traduce). */
export class ErrorSesion extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje?: string
  ) {
    super(mensaje ?? codigo)
    this.name = 'ErrorSesion'
  }
}

/** Intervalo mínimo entre dos `sesion:posicion` (ADR 0017 §11). */
export const INTERVALO_POSICION_MS = 1000

const LETRA_VACIA: Letra = { origen: 'manual', lrclib_id: null, offset_ms: 0, lineas: [] }

/** Lo que el servicio usa de la biblioteca (se simula en las pruebas). */
export interface BibliotecaSesion {
  obtener(id: string): Cancion | null
  obtenerResumen(id: string): ResumenCancion | null
  /** Estilo resuelto con el catálogo vigente (ADR 0016). */
  estiloDe(cancion: Cancion): Estilo
  comprobarPistas(id: string): Promise<ResumenCancion | null>
  suscribir(cb: (evento: EventoCancion) => void): () => void
}

export interface DepsServicioSesion {
  biblioteca: BibliotecaSesion
  config: { obtener(): Config; actualizar(parcial: ConfigParcial): Promise<Config> }
  /** Crea la ventana en la pantalla elegida; lanza `ErrorPantallaNoDisponible` si ya no existe. */
  abrirVentana(peticion: PeticionSecundaria): ManejadorSecundaria
  pantallas: {
    listar(): ListaPantallasIpc
    /** Avisa de altas, bajas y cambios de métricas. Devuelve la baja. */
    observar(cb: () => void): () => void
  }
  /** Evento dirigido por rol (`RegistroVentanas.enviarA`). */
  enviarA(rol: RolVentana, canal: string, carga: unknown): void
  /** Silencio de la principal mientras dura la sesión (se restaura el valor previo). */
  principal: { estaSilenciada(): boolean; silenciar(silenciar: boolean): void }
  reposo: Pick<GestorReposo, 'retener' | 'liberar'>
  /** Libera la visita de letra que siguiera abierta al aceptar la sesión. */
  liberarVisitaLetra?(): void
  ahora?(): number
  /** `setTimeout` inyectable; devuelve la cancelación. */
  programar?(ms: number, cb: () => void): () => void
  nuevoId?(): string
  registrar?(nivel: 'aviso' | 'error', mensaje: string): void
}

/** Disponibilidad de una canción según su resumen (sin disco). */
export function disponibilidadDe(resumen: ResumenCancion | null): MotivoNoDisponible | 'ok' {
  if (!resumen) return 'no_encontrada'
  if (resumen.danada) return resumen.motivo === 'pistas' ? 'sin_pistas' : 'ilegible'
  return resumen.estado === 'lista' ? 'ok' : 'no_lista'
}

export class ServicioSesion {
  private estado: EstadoMaquina
  private cadena: Promise<unknown> = Promise.resolve()
  private readonly temporizadores = new Map<string, () => void>()
  /** Datos de `cargar` de las entradas en revalidación o ya cargadas (sin `silencioPrevio`). */
  private readonly paraCargar = new Map<string, Omit<EntradaCargarIpc, 'silencioPrevio'>>()
  private comandoActual: ComandoSecundariaIpc | null = null
  private ventana: ManejadorSecundaria | null = null
  private sesionIdVigente: string | null = null
  private causaCierre: CausaCierre | null = null
  private cerrandoDeVerdad = false
  private salidaConfirmada = false
  private bloqueada = false
  private silencioPrevio = false
  private ultimaPosicion: { entradaId: string; instante: number } | null = null
  private readonly bajas: (() => void)[] = []
  private readonly ahora: () => number
  private readonly programar: (ms: number, cb: () => void) => () => void
  private readonly nuevoId: () => string

  constructor(private readonly deps: DepsServicioSesion) {
    this.ahora = deps.ahora ?? (() => performance.now())
    this.programar =
      deps.programar ??
      ((ms, cb) => {
        const id = setTimeout(cb, ms)
        return () => clearTimeout(id)
      })
    this.nuevoId = deps.nuevoId ?? randomUUID
    this.estado = crearEstado({
      nuevoId: this.nuevoId,
      transicionS: () => deps.config.obtener().reproductor.transicion_s
    })
    this.bajas.push(
      deps.biblioteca.suscribir((e) => this.alCambiarCancion(e)),
      deps.pantallas.observar(() =>
        deps.enviarA('principal', CANALES.eventos.pantallasCambiadas, deps.pantallas.listar())
      )
    )
  }

  // --- Consultas síncronas ---------------------------------------------------------------------

  /** Autoridad del bloqueo de edición (ADR 0017 §9): vale desde que se acepta `abrir` hasta el fin. */
  edicionBloqueada(): boolean {
    return this.bloqueada
  }

  /** Hay sesión y no se está saliendo de la app. */
  sesionActiva(): boolean {
    return this.estado.sesion !== null && !this.salidaConfirmada
  }

  colaNoVacia(): boolean {
    if (this.salidaConfirmada) return false
    const { cola } = this.estado
    return cola.pendientes.length > 0 || cola.activa !== null
  }

  /** La canción es la activa de la sesión (no se elimina ni vuelve a borrador). */
  cancionActiva(cancionId: string): boolean {
    return this.estado.cola.activa?.cancionId === cancionId
  }

  esSecundariaVigente(sender: unknown): boolean {
    return this.ventana !== null && this.ventana.ventana.webContents === sender
  }

  pantallas(): ListaPantallasIpc {
    return this.deps.pantallas.listar()
  }

  estadoPrincipal(): EstadoSesionIpc {
    return aIpcPrincipal(this.estado, this.ahora())
  }

  estadoSecundaria(): EstadoSecundariaIpc | null {
    return aIpcSecundaria(this.estado, this.ahora(), (id) => this.estiloDe(id))
  }

  /** El estado que corresponde al rol que llama; la secundaria exige una sesión. */
  estadoDelRol(rol: RolVentana): EstadoSesionIpc | EstadoSecundariaIpc {
    if (rol === 'principal') return this.estadoPrincipal()
    const e = this.estadoSecundaria()
    if (!e) throw new ErrorSesion('SESION_NO_ACTIVA')
    return e
  }

  /** Espera a que se procesen los eventos pendientes (útil en pruebas). */
  esperar(): Promise<void> {
    return this.cadena.then(() => undefined)
  }

  // --- Apertura y ventana --------------------------------------------------------------------------

  async abrir(peticion: AbrirSesion): Promise<EstadoSesionIpc> {
    const lista = this.deps.pantallas.listar()
    const libre = lista.colocacion === 'libre'
    let pantalla: PantallaIpc | null = null
    if (libre) {
      pantalla = lista.pantallas.find((p) => p.id === peticion.pantallaId) ?? null
      if (!pantalla) throw new ErrorSesion('PANTALLA_NO_DISPONIBLE')
    }
    let inicio: InicioApertura
    if (peticion.inicio.tipo === 'cancion') {
      const resumen = this.deps.biblioteca.obtenerResumen(peticion.inicio.cancionId)
      if (!resumen) throw new ErrorSesion('CANCION_NO_DISPONIBLE')
      inicio = {
        tipo: 'cancion',
        cancionId: peticion.inicio.cancionId,
        titulo: resumen.titulo,
        artista: resumen.artista
      }
    } else {
      inicio = { tipo: peticion.inicio.tipo }
    }
    const sesionId = this.nuevoId()
    this.exigir(await this.enviar({ tipo: 'abrir', sesionId, inicio }))
    this.salidaConfirmada = false
    try {
      this.deps.liberarVisitaLetra?.()
    } catch (e) {
      this.deps.registrar?.('aviso', `sesión: no se pudo liberar la visita de letra: ${String(e)}`)
    }
    let manejador: ManejadorSecundaria
    try {
      manejador = this.deps.abrirVentana({
        pantalla,
        pantallaCompleta: peticion.pantallaCompleta,
        colocacion: lista.colocacion
      })
    } catch (e) {
      this.cerrandoDeVerdad = true
      await this.enviar({ tipo: 'cerrada', causa: 'forzada' })
      throw e
    }
    this.conectar(manejador, sesionId)
    await this.enviar({
      tipo: 'aceptadaApertura',
      sesionId,
      pantalla,
      pantallaCompleta: libre && peticion.pantallaCompleta
    })
    return this.estadoPrincipal()
  }

  mostrar(): void {
    this.ventanaActiva().mostrar()
  }

  async moverAPantalla(pantallaId: number): Promise<EstadoSesionIpc> {
    const ventana = this.ventanaActiva()
    const lista = this.deps.pantallas.listar()
    const pantalla =
      lista.colocacion === 'libre' ? lista.pantallas.find((p) => p.id === pantallaId) : null
    if (!pantalla) throw new ErrorSesion('PANTALLA_NO_DISPONIBLE')
    ventana.moverA(pantalla)
    await this.enviar({
      tipo: 'pantalla',
      cambio: {
        tipo: 'movida',
        pantalla,
        pantallaCompleta: this.estado.sesion?.pantallaCompleta ?? false
      }
    })
    return this.estadoPrincipal()
  }

  /** Pantalla completa de la secundaria (la pide la principal o la propia secundaria). */
  fijarPantallaCompleta(activa: boolean): void {
    this.ventanaActiva().fijarPantallaCompleta(activa)
  }

  estaEnPantallaCompleta(): boolean {
    return this.ventana?.estaEnPantallaCompleta() ?? false
  }

  // --- Control de la sesión -------------------------------------------------------------------------

  async transporte(
    accion: 'pausar' | 'reanudar' | 'reiniciar',
    entradaId: string
  ): Promise<EstadoSesionIpc> {
    this.exigir(await this.enviar({ tipo: 'transporte', accion, entradaId }))
    return this.estadoPrincipal()
  }

  async siguiente(desdeEntradaId: string): Promise<void> {
    await this.enviar({ tipo: 'siguiente', desdeEntradaId })
  }

  async empezar(candidataId: string): Promise<void> {
    await this.enviar({ tipo: 'empezar', candidataId })
  }

  async detenerTransicion(transicionId: string): Promise<void> {
    await this.enviar({ tipo: 'detenerTransicion', transicionId })
  }

  async repetir(entradaId: string): Promise<void> {
    await this.enviar({ tipo: 'repetir', entradaId })
  }

  async solicitarCierre(origen: Exclude<RolVentana, 'exportacion'>): Promise<void> {
    this.exigir(await this.enviar({ tipo: 'solicitarCierre', origen }))
  }

  async confirmarCierre(cola: 'eliminar' | 'conservar', revision: number): Promise<void> {
    this.exigir(await this.enviar({ tipo: 'confirmarCierre', cola, revision }))
  }

  async cancelarCierre(): Promise<void> {
    await this.enviar({ tipo: 'cancelarCierre' })
  }

  /** Destruye la secundaria (no responde) conservando la cola, como una caída sin la incidencia. */
  async forzarCierre(): Promise<EstadoSesionIpc> {
    const ventana = this.ventanaActiva()
    this.causaCierre = 'forzada'
    this.cerrandoDeVerdad = true
    ventana.destruir()
    await this.enviar({ tipo: 'cerrada', causa: 'forzada' })
    return this.estadoPrincipal()
  }

  /** La principal se cierra en macOS: la secundaria se cierra sin diálogo y la cola se conserva. */
  async cerrarConservando(): Promise<void> {
    if (!this.ventana) return
    this.causaCierre = 'forzada'
    this.cerrandoDeVerdad = true
    this.ventana.cerrar()
    await this.esperar()
  }

  /**
   * Se sale de la aplicación (confirmado o sin nada que preguntar): la secundaria se cierra sin el
   * diálogo de cola y ya no se vuelve a preguntar por la sesión ni la cola. Libera todo.
   */
  async prepararSalida(): Promise<void> {
    this.salidaConfirmada = true
    if (this.ventana) {
      this.causaCierre = 'salida'
      this.cerrandoDeVerdad = true
      await this.enviar({ tipo: 'cerrada', causa: 'salida' })
    }
  }

  // --- Informes y datos de la secundaria --------------------------------------------------------------

  async inicial(sender: unknown): Promise<SesionInicialIpc> {
    const sesion = this.estado.sesion
    if (!sesion || !this.esSecundariaVigente(sender)) throw new ErrorSesion('SESION_NO_ACTIVA')
    await this.enviar({ tipo: 'documentoListo', sesionId: sesion.sesionId })
    return {
      sesionId: sesion.sesionId,
      comandoActual: this.comandoActual,
      estado: this.estadoDelRol('secundaria') as EstadoSecundariaIpc
    }
  }

  async informar(informe: InformeSecundariaIpc, sender: unknown): Promise<{ aplicado: boolean }> {
    if (!this.esSecundariaVigente(sender)) return { aplicado: false }
    const r = await this.enviar({ tipo: 'informe', informe })
    const aplicado = r.aplicado ?? false
    if (!aplicado) {
      this.deps.registrar?.('aviso', `sesión: informe ${informe.tipo} ignorado`)
      return { aplicado }
    }
    if (informe.tipo === 'error' && informe.error.motivo === 'no_encontrada') {
      const activa = this.estado.cola.activa
      if (activa) void this.deps.biblioteca.comprobarPistas(activa.cancionId).catch(() => undefined)
    }
    if (
      informe.tipo === 'posicion' ||
      informe.tipo === 'reproduciendo' ||
      informe.tipo === 'pausada'
    ) {
      this.enviarPosicion()
    }
    return { aplicado }
  }

  // --- Cola ----------------------------------------------------------------------------------------

  async agregar(
    cancionId: string,
    donde: DondeAgregar
  ): Promise<{ estado: EstadoSesionIpc; entradaId: string }> {
    const resumen = this.deps.biblioteca.obtenerResumen(cancionId)
    if (!resumen) throw new ErrorSesion('CANCION_NO_DISPONIBLE')
    const r = this.exigir(
      await this.enviar({
        tipo: 'agregar',
        cancionId,
        titulo: resumen.titulo,
        artista: resumen.artista,
        donde
      })
    )
    const disponibilidad = disponibilidadDe(resumen)
    if (disponibilidad !== 'ok') {
      await this.enviar({ tipo: 'disponibilidad', cancionId, motivo: disponibilidad })
    }
    return { estado: this.estadoPrincipal(), entradaId: r.entradaId as string }
  }

  async mover(entradaId: string, antesDe: string | null): Promise<EstadoSesionIpc> {
    this.exigir(await this.enviar({ tipo: 'mover', entradaId, antesDe }))
    return this.estadoPrincipal()
  }

  async quitar(entradaId: string): Promise<{ estado: EstadoSesionIpc; antesDe: string | null }> {
    const r = this.exigir(await this.enviar({ tipo: 'quitar', entradaId }))
    return { estado: this.estadoPrincipal(), antesDe: r.antesDe ?? null }
  }

  async vaciar(contexto: boolean): Promise<EstadoSesionIpc> {
    this.exigir(await this.enviar({ tipo: 'vaciar', contexto }))
    return this.estadoPrincipal()
  }

  /** Da de baja las suscripciones y los temporizadores (no cierra la ventana). */
  cerrar(): void {
    for (const baja of this.bajas.splice(0)) baja()
    for (const cancelar of this.temporizadores.values()) cancelar()
    this.temporizadores.clear()
  }

  // --- Núcleo --------------------------------------------------------------------------------------

  /** Encola el evento: cada uno se aplica por completo antes de empezar el siguiente. */
  private enviar(evento: Evento): Promise<Resultado> {
    const tarea = this.cadena.then(() => this.aplicar(evento))
    this.cadena = tarea.catch(() => undefined)
    return tarea
  }

  private aplicar(evento: Evento): Resultado {
    const antes = this.estado
    const resultado = reducir(antes, evento, this.ahora())
    this.estado = resultado.estado
    for (const efecto of resultado.efectos) {
      try {
        this.ejecutar(efecto, resultado.estado)
      } catch (e) {
        this.deps.registrar?.('error', `sesión: falló el efecto ${efecto.tipo}: ${String(e)}`)
      }
    }
    if (antes.sesion && !resultado.estado.sesion) this.alTerminar()
    return resultado
  }

  private exigir(resultado: Resultado): Resultado {
    if (resultado.error) throw new ErrorSesion(resultado.error)
    return resultado
  }

  private ejecutar(efecto: Efecto, estado: EstadoMaquina): void {
    switch (efecto.tipo) {
      case 'comando':
        this.enviarComando(efecto.comando, estado)
        break
      case 'programar': {
        const { transicionId } = efecto
        this.temporizadores.get(transicionId)?.()
        this.temporizadores.set(
          transicionId,
          this.programar(efecto.ms, () => {
            this.temporizadores.delete(transicionId)
            void this.enviar({ tipo: 'vencida', transicionId })
          })
        )
        break
      }
      case 'cancelar':
        this.temporizadores.get(efecto.transicionId)?.()
        this.temporizadores.delete(efecto.transicionId)
        break
      case 'revalidar':
        void this.revalidar(efecto.entradaId, efecto.cancionId)
        break
      case 'difundir':
        this.difundir(estado)
        break
      case 'bloquearEdicion':
        this.bloquear()
        break
      case 'liberarEdicion':
        this.liberar()
        break
      case 'cerrarVentana':
        this.cerrandoDeVerdad = true
        this.causaCierre ??= 'confirmada'
        this.ventana?.cerrar()
        break
      case 'guardarPreferenciaPantalla':
        void this.deps.config
          .actualizar({
            reproductor: {
              secundaria: {
                pantalla: {
                  id: efecto.pantalla.id,
                  etiqueta: efecto.pantalla.etiqueta,
                  ancho: efecto.pantalla.ancho,
                  alto: efecto.pantalla.alto
                },
                pantalla_completa: efecto.pantallaCompleta
              }
            }
          })
          .catch((e: unknown) =>
            this.deps.registrar?.('aviso', `sesión: no se guardó la pantalla: ${String(e)}`)
          )
        break
    }
  }

  private enviarComando(c: ComandoMaquina, estado: EstadoMaquina): void {
    const sesionId = estado.sesion?.sesionId
    if (!sesionId) return
    const base = { sesionId, revision: estado.revision }
    let comando: ComandoSecundariaIpc
    if (c.tipo === 'cargar') {
      const datos = this.paraCargar.get(c.entradaId)
      if (!datos) return
      comando = {
        tipo: 'cargar',
        ...base,
        entrada: { ...datos, silencioPrevio: c.anuncio === 'inicio' },
        desdeMs: c.desdeMs,
        pausada: c.pausada,
        anuncio: c.anuncio
      }
    } else {
      comando = { ...c, ...base } as ComandoSecundariaIpc
    }
    // Solo los comandos que definen la pantalla se repiten a una secundaria que acaba de cargar.
    if (['cargar', 'transicion', 'fin_de_cola', 'error'].includes(comando.tipo)) {
      this.comandoActual = comando
    }
    this.deps.enviarA('secundaria', CANALES.eventos.sesionComando, comando)
  }

  private difundir(estado: EstadoMaquina): void {
    const ahora = this.ahora()
    this.deps.enviarA('principal', CANALES.eventos.sesionEstado, aIpcPrincipal(estado, ahora))
    const secundaria = aIpcSecundaria(estado, ahora, (id) => this.estiloDe(id))
    if (secundaria) {
      this.deps.enviarA('secundaria', CANALES.eventos.sesionEstadoSecundaria, secundaria)
    }
  }

  /** `sesion:posicion` como mucho una vez por segundo y entrada. */
  private enviarPosicion(): void {
    const { estado } = this
    const principal = aIpcPrincipal(estado, this.ahora())
    const activa = principal.activa
    const sesionId = principal.sesion?.sesionId
    if (!activa || !sesionId) return
    const ahora = this.ahora()
    const previa = this.ultimaPosicion
    if (
      previa &&
      previa.entradaId === activa.entradaId &&
      ahora - previa.instante < INTERVALO_POSICION_MS
    ) {
      return
    }
    this.ultimaPosicion = { entradaId: activa.entradaId, instante: ahora }
    const carga: PosicionSesionIpc = {
      sesionId,
      entradaId: activa.entradaId,
      posicionMs: activa.posicionMs,
      duracionMs: activa.duracionMs
    }
    this.deps.enviarA('principal', CANALES.eventos.sesionPosicion, carga)
  }

  private estiloDe(cancionId: string): Estilo {
    const cancion = this.deps.biblioteca.obtener(cancionId)
    return cancion ? this.estiloVisible(cancion) : structuredClone(ESTILO_PREDETERMINADO)
  }

  /** El estilo de la entrada con el subrayado que pide este equipo (se resuelve al cargarla). */
  private estiloVisible(cancion: Cancion): Estilo {
    return conSubrayadoDelEquipo(
      this.deps.biblioteca.estiloDe(cancion),
      this.deps.config.obtener().reproductor.subrayar_cantado
    )
  }

  // --- Revalidación (ADR 0017 §7) ------------------------------------------------------------------

  private async revalidar(entradaId: string, cancionId: string): Promise<void> {
    let evento: Extract<Evento, { tipo: 'revalidada' }>
    try {
      evento = await this.comprobar(entradaId, cancionId)
    } catch (e) {
      this.deps.registrar?.('aviso', `sesión: no se pudo revalidar ${cancionId}: ${String(e)}`)
      evento = { tipo: 'revalidada', entradaId, resultado: 'ilegible' }
    }
    await this.enviar(evento)
  }

  private async comprobar(
    entradaId: string,
    cancionId: string
  ): Promise<Extract<Evento, { tipo: 'revalidada' }>> {
    const { biblioteca } = this.deps
    const fallo = (resultado: MotivoNoDisponible) =>
      ({ tipo: 'revalidada', entradaId, resultado }) as const
    const cancion = biblioteca.obtener(cancionId)
    if (!cancion) {
      // Sin `cancion.json` legible: dañada por JSON (ilegible) o ya no existe.
      return fallo(biblioteca.obtenerResumen(cancionId) ? 'ilegible' : 'no_encontrada')
    }
    if (cancion.estado !== 'lista') return fallo('no_lista')
    const resumen = await biblioteca.comprobarPistas(cancionId)
    if (!resumen) return fallo('no_encontrada')
    if (resumen.danada) return fallo(resumen.motivo === 'pistas' ? 'sin_pistas' : 'ilegible')
    // Tras `comprobarPistas` la canción puede haber cambiado de estado: se lee otra vez.
    const vigente = biblioteca.obtener(cancionId) ?? cancion
    if (vigente.estado !== 'lista') return fallo('no_lista')
    if (!vigente.pistas) return fallo('sin_pistas')
    const letra = vigente.letra ?? LETRA_VACIA
    this.paraCargar.set(entradaId, {
      entradaId,
      cancionId,
      titulo: vigente.metadatos.titulo,
      artista: vigente.metadatos.artista,
      duracionMs: vigente.metadatos.duracion_ms,
      gananciaDb: Math.min(60, Math.max(-60, vigente.fuente.ganancia_db)),
      letra,
      estilo: this.estiloVisible(vigente),
      modalidad: modalidadEfectiva(vigente),
      lineasSinSincronizar: numerosLineasSinInicio(letra).length
    })
    const primera = letra.lineas.find((l) => l.tipo === 'linea' && l.inicio_ms !== null)
    return {
      tipo: 'revalidada',
      entradaId,
      resultado: 'ok',
      duracionMs: vigente.metadatos.duracion_ms,
      ...(primera && primera.tipo === 'linea' && primera.inicio_ms !== null
        ? { primeraLineaMs: primera.inicio_ms + letra.offset_ms }
        : {})
    }
  }

  // --- Biblioteca ----------------------------------------------------------------------------------

  private alCambiarCancion(e: EventoCancion): void {
    if (e.eliminada === true) {
      void this.enviar({ tipo: 'cancionEliminada', cancionId: e.id })
      return
    }
    const { resumen } = e
    void this.enviar({
      tipo: 'titulos',
      cancionId: e.id,
      titulo: resumen.titulo,
      artista: resumen.artista
    })
    void this.enviar({ tipo: 'disponibilidad', cancionId: e.id, motivo: disponibilidadDe(resumen) })
  }

  // --- Bloqueo, silencio y reposo --------------------------------------------------------------------

  private bloquear(): void {
    if (this.bloqueada) return
    this.bloqueada = true
    this.silencioPrevio = this.deps.principal.estaSilenciada()
    this.deps.principal.silenciar(true)
    this.deps.reposo.retener('sesion')
  }

  private liberar(): void {
    if (!this.bloqueada) return
    this.bloqueada = false
    this.deps.principal.silenciar(this.silencioPrevio)
    this.deps.reposo.liberar('sesion')
  }

  // --- Ventana --------------------------------------------------------------------------------------

  private ventanaActiva(): ManejadorSecundaria {
    if (!this.ventana) throw new ErrorSesion('SESION_NO_ACTIVA')
    return this.ventana
  }

  private conectar(m: ManejadorSecundaria, sesionId: string): void {
    this.ventana = m
    this.sesionIdVigente = sesionId
    this.causaCierre = null
    this.cerrandoDeVerdad = false
    const vigente = (): boolean => this.sesionIdVigente === sesionId
    const registrar = (e: unknown): void =>
      this.deps.registrar?.('error', `sesión: evento de la ventana: ${String(e)}`)

    m.alCerrarSolicitado((evento) => {
      if (this.cerrandoDeVerdad || !vigente()) return
      evento.preventDefault()
      this.solicitarCierre('secundaria').catch(registrar)
    })
    m.ventana.once('closed', () => {
      if (!vigente()) return
      const causa = this.causaCierre ?? 'confirmada'
      void this.enviar({ tipo: 'cerrada', causa })
    })
    m.alCaer((motivo) => {
      if (!vigente()) return
      this.deps.registrar?.('aviso', `sesión: la secundaria cayó (${motivo})`)
      this.causaCierre = 'caida'
      this.cerrandoDeVerdad = true
      m.destruir()
      void this.enviar({ tipo: 'cerrada', causa: 'caida' })
    })
    m.alNoResponder(() => vigente() && void this.enviar({ tipo: 'responde', responde: false }))
    m.alResponder(() => vigente() && void this.enviar({ tipo: 'responde', responde: true }))
    m.alPantallaPerdida((p) => {
      if (!vigente()) return
      // Se lee antes de que el sistema avise de que salió de pantalla completa.
      const estabaEnPantallaCompleta = this.estado.sesion?.pantallaCompleta ?? false
      const primaria = this.deps.pantallas.listar().pantallas.find((x) => x.principal) ?? null
      void this.enviar({
        tipo: 'pantalla',
        cambio: {
          tipo: 'perdida',
          etiqueta: p.etiqueta,
          estabaEnPantallaCompleta,
          pantalla: primaria
        }
      })
    })
    m.alPantallaReconectada((p) => {
      if (!vigente()) return
      void this.enviar({
        tipo: 'pantalla',
        cambio: { tipo: 'reconectada', etiqueta: p.etiqueta, pantallaId: p.id }
      })
    })
    m.alCambiarPantallaCompleta((activa) => {
      if (!vigente()) return
      void this.enviar({ tipo: 'pantallaCompleta', activa })
      this.deps.enviarA('secundaria', CANALES.eventos.pantallaCompleta, activa)
    })
  }

  /** La sesión terminó por cualquier causa: se suelta todo lo que dependía de ella. */
  private alTerminar(): void {
    for (const cancelar of this.temporizadores.values()) cancelar()
    this.temporizadores.clear()
    this.paraCargar.clear()
    this.comandoActual = null
    this.ultimaPosicion = null
    this.ventana = null
    this.sesionIdVigente = null
    this.causaCierre = null
    this.cerrandoDeVerdad = false
    this.liberar()
  }
}
