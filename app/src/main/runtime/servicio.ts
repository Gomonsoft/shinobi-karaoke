import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  FASES_RUNTIME,
  esCodigoError,
  estimarSegundosSeparacion,
  rangoDescargaPlataforma,
  requisitosDe,
  type Config,
  type EstadoRuntimeIpc,
  type EstimacionSeparacion,
  type Manifiesto,
  type OrigenRapido,
  type PerfilHardware,
  type ProgresoRuntimeIpc,
  type RequisitosRuntimeIpc
} from '../../shared'
import { modoSeparacionVigente, type ServicioConfig } from '../configuracion'
import type { GestorRuntime, ResultadoInstalacion } from './gestor'
import type { ServicioDeteccion } from './deteccion'
import { totalModelo } from './modelos'
import { ErrorRuntime } from './uv'

/**
 * Fachada del runtime para la IPC (tarea 0036): estado persistido + estado vivo del gestor,
 * requisitos, detalles para soporte y estimación de la separación. Sin Electron.
 */

export const LINEAS_DETALLES = 50
export const MARCADOR_DATOS = '<datos>'
/** Espacio libre que debe sobrar, además del modelo Rápido, para ofrecerlo por `SIN_ESPACIO` (0057). */
export const MARGEN_ESPACIO_RAPIDO = 100e6

/** Subconjunto del gestor (0034) que usa la fachada. */
export type GestorParaServicio = Pick<
  GestorRuntime,
  'instalar' | 'pausar' | 'instalando' | 'suscribir' | 'descargarModelo'
>

export interface ServicioRuntime {
  estado(): Promise<EstadoRuntimeIpc>
  /** Síncrono: `true` solo con la instalación completa y verificada (menú, primer arranque). */
  completa(): boolean
  /** Hay una instalación ejecutándose ahora mismo. */
  instalando(): boolean
  requisitos(recalcularEspacio: boolean): Promise<RequisitosRuntimeIpc>
  /** Lanza la instalación y vuelve al momento. */
  instalar(): void
  pausar(): Promise<void>
  detalles(): Promise<string>
  estimarSeparacion(duracionMs: number, modelo?: 'calidad' | 'rapido'): EstimacionSeparacion
  /**
   * Puerta única del modelo Rápido (0057, preguntas/0019 y 0021): guarda el consentimiento, lo
   * descarga y verifica, y solo entonces lo fija como modo. Responde al terminar. Sin oferta
   * vigente ni Rápido pendiente rechaza con `ARGUMENTOS_NO_VALIDOS`. Dos llamadas comparten promesa.
   */
  aceptarYUsarRapido(origen: OrigenRapido): Promise<void>
  /** Descarga Calidad si falta y la fija como modo; Rápido y el consentimiento se conservan. */
  volverACalidad(): Promise<void>
  cancelarVolverACalidad(): void
  /** La comprobación al arrancar (0035) marca aquí que está verificando el runtime. */
  fijarVerificando(verificando: boolean): void
  alProgreso(cb: (p: ProgresoRuntimeIpc) => void): () => void
  alCambiar(cb: (e: EstadoRuntimeIpc) => void): () => void
  /** Vuelve a calcular y difundir el estado (p. ej. cambió la oferta de Rápido de la separación). */
  refrescar(): void
  cerrar(): void
}

export interface DependenciasServicioRuntime {
  gestor: GestorParaServicio
  config: Pick<ServicioConfig, 'obtener' | 'actualizar'> & {
    suscribir(cb: (c: Config) => void): () => void
  }
  deteccion: Pick<ServicioDeteccion, 'requisitosPrevios'>
  manifiesto: Manifiesto
  /** Directorio de datos: sus rutas se ocultan en los detalles. */
  datos: string
  versionApp: string
  /** `so` legible, p. ej. `Darwin 24.1.0`. */
  descripcionSo: string
  /** Últimas líneas del registro del runtime (más antigua primero). */
  ultimasLineasRegistro(n: number): Promise<string[]>
  directorioUsuario?: string
  /** Para informar de fallos de la instalación lanzada sin esperar y del consentimiento de Rápido. */
  registrar?(nivel: 'info' | 'aviso' | 'error', mensaje: string): void
  /**
   * ¿Hay una oferta de Rápido vigente en la separación (trabajo terminado en `MEMORIA_INSUFICIENTE`
   * o `MODELO_NO_DISPONIBLE` con Calidad)? Lo conecta la tarea 0066; por defecto, no.
   */
  ofertaSeparacionVigente?(): boolean
}

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g
const escapar = (t: string): string => t.replace(ESCAPE_RE, '\\$&')

/**
 * Quita de un texto las rutas absolutas del usuario (el directorio de datos, su carpeta personal
 * y cualquier `/Users/<n>`, `/home/<n>` o `C:\Users\<n>`), sustituyéndolas por `<datos>`.
 */
export function ocultarRutas(texto: string, datos: string, usuario?: string): string {
  let t = texto
  for (const ruta of [datos, usuario]) {
    if (!ruta || ruta.length < 3) continue
    t = t.replace(
      new RegExp(escapar(ruta).replace(/\\\\|\//g, '[\\\\/]') + '[^\\s"\']*', 'g'),
      MARCADOR_DATOS
    )
  }
  t = t.replace(/(?:[A-Za-z]:[\\/]+Users[\\/]+|\/(?:Users|home)\/)[^\s"']+/g, MARCADOR_DATOS)
  return t
}

/** Últimas `n` líneas de `app.log` con el módulo indicado. Nunca lanza. */
export async function ultimasLineasDeRegistro(
  dirRegistros: string,
  modulo: string,
  n: number
): Promise<string[]> {
  const marca = `[${modulo}]`
  const salida: string[] = []
  // Archivos de más nuevo a más viejo; se corta al reunir `n` líneas.
  for (const nombre of ['app.log', 'app.1.log', 'app.2.log']) {
    let texto: string
    try {
      texto = await readFile(join(dirRegistros, nombre), 'utf8')
    } catch {
      continue
    }
    const lineas = texto.split(/\r?\n/).filter((l) => l.includes(marca))
    salida.unshift(...lineas)
    if (salida.length >= n) break
  }
  return salida.slice(-n)
}

export function crearServicioRuntime(deps: DependenciasServicioRuntime): ServicioRuntime {
  const usuario = deps.directorioUsuario ?? homedir()
  const oyentesCambio = new Set<(e: EstadoRuntimeIpc) => void>()
  let verificando = false
  let ultimoError: { fase: string; codigo: string; detalles: string } | null = null
  let ultimaClave = ''
  let secuencia = 0
  const oyentesProgreso = new Set<(p: ProgresoRuntimeIpc) => void>()
  let rapidoEnCurso: Promise<void> | null = null
  let controlRapido: AbortController | null = null
  let volverPromesa: Promise<void> | null = null
  let volverControl: AbortController | null = null
  let volverEstado: EstadoRuntimeIpc['volverACalidad'] = null

  const emitirProgreso = (p: ProgresoRuntimeIpc): void => {
    for (const cb of [...oyentesProgreso]) cb(p)
  }
  const bajaGestor = deps.gestor.suscribir(emitirProgreso)

  const modeloManifiesto = (id: 'calidad' | 'rapido') =>
    deps.manifiesto.modelos.find((m) => m.id === id)
  const bytesModelo = (id: 'calidad' | 'rapido'): number => {
    const m = modeloManifiesto(id)
    return m ? totalModelo(m) : 0
  }

  /** Aceptó Rápido y la descarga no terminó (derivado de `config.json`, preguntas/0021 §1). */
  const esRapidoPendiente = (c: Config): boolean =>
    c.separacion.rapido_aceptado !== null &&
    c.separacion.modo === 'calidad' &&
    !c.separacion.modelos_descargados.includes('rapido')

  /** Evento de progreso de una descarga suelta (Rápido o Calidad fuera de la instalación). */
  function eventoDescarga(modelo: 'calidad' | 'rapido', bytes: number, total: number) {
    const f = deps.config.obtener().instalacion.fases
    const evento: ProgresoRuntimeIpc = {
      faseVisible: 'modelo',
      estados: { motor: f.motor, componentes: f.componentes, modelo: 'en_curso' },
      bytes,
      total,
      totalGlobal: total,
      porcentajeGlobal: total > 0 ? Math.min(99, Math.floor((100 * bytes) / total)) : 0,
      etaSegundos: null,
      modo: modelo,
      motivoRebaja: null,
      comprobando: false
    }
    return evento
  }

  /**
   * `ofrecerRapido` (0057): fallo definitivo de la fase de modelo con Calidad por verificación,
   * servidores no disponibles o falta de espacio habiendo para Rápido. Nunca con `SIN_CONEXION`,
   * con otra fase ni mientras Rápido está pendiente.
   */
  async function calcularOfrecerRapido(
    c: Config,
    previos: { espacioLibre: number } | null
  ): Promise<boolean> {
    if (await calcularOfertaInstalacion(c, previos)) return true
    // Separación (0066): Calidad falló por memoria o sin poder descargarse, sin Rápido pendiente.
    return (
      !esRapidoPendiente(c) &&
      !deps.gestor.instalando() &&
      modoSeparacionVigente(c) === 'calidad' &&
      deps.ofertaSeparacionVigente?.() === true
    )
  }

  async function calcularOfertaInstalacion(
    c: Config,
    previos: { espacioLibre: number } | null
  ): Promise<boolean> {
    const error = c.instalacion.error
    if (error === null || error.fase !== 'modelo') return false
    if (esRapidoPendiente(c) || deps.gestor.instalando()) return false
    if (modoSeparacionVigente(c) !== 'calidad') return false
    switch (error.codigo) {
      case 'VERIFICACION_FALLIDA':
      case 'SERVICIO_NO_DISPONIBLE':
        return true
      case 'SIN_ESPACIO': {
        const libre = (previos ?? (await deps.deteccion.requisitosPrevios())).espacioLibre
        return libre >= bytesModelo('rapido') + MARGEN_ESPACIO_RAPIDO
      }
      default:
        return false
    }
  }

  const perfilVigente = (c: Config): PerfilHardware | null =>
    c.instalacion.perfil_hardware ?? c.instalacion.perfil_previsto

  function estadoPersistido(c: Config): EstadoRuntimeIpc['estado'] {
    if (verificando) return 'verificando'
    if (deps.gestor.instalando()) return 'en_curso'
    // `en_curso` guardado sin proceso vivo = la app se cerró a medias: hay que continuar.
    return c.instalacion.estado === 'en_curso' ? 'pendiente' : c.instalacion.estado
  }

  async function estado(): Promise<EstadoRuntimeIpc> {
    const c = deps.config.obtener()
    const volver = volverEstado === null ? null : { ...volverEstado }
    const perfil = perfilVigente(c)
    let bytesRestantes: number | null = null
    let previos: Awaited<ReturnType<ServicioDeteccion['requisitosPrevios']>> | null = null
    if (perfil !== null) {
      previos = await deps.deteccion.requisitosPrevios()
      bytesRestantes = bytesPorDescargar(c, perfil, previos.plataforma)
    }
    return {
      estado: estadoPersistido(c),
      fases: { ...c.instalacion.fases },
      error: c.instalacion.error,
      perfilPrevisto: c.instalacion.perfil_previsto,
      perfil: c.instalacion.perfil_hardware,
      motivoRebaja: c.instalacion.motivo_rebaja,
      modo: perfil === null ? null : modoSeparacionVigente(c),
      bytesRestantes,
      rapidoPendiente: esRapidoPendiente(c),
      ofrecerRapido: await calcularOfrecerRapido(c, previos),
      volverACalidad: volver
    }
  }

  function bytesPorDescargar(
    c: Config,
    perfil: PerfilHardware,
    plataforma: RequisitosRuntimeIpc['plataforma']
  ): number | null {
    if (plataforma === null) return null
    const req = requisitosDe(deps.manifiesto, plataforma, perfil)
    if (req === null) return null
    const modelo = deps.manifiesto.modelos.find((m) => m.id === modoSeparacionVigente(c))
    const total = {
      motor: deps.manifiesto.python.bytes_descarga[plataforma] ?? 0,
      componentes: req.bytes_descarga,
      modelo: modelo ? modelo.bytes + modelo.extra.reduce((a, e) => a + e.bytes, 0) : 0
    }
    return FASES_RUNTIME.reduce(
      (a, f) => a + (c.instalacion.fases[f] === 'completada' ? 0 : total[f]),
      0
    )
  }

  /** Difunde el estado si cambió (fase, estado o error); descarta respuestas ya superadas. */
  function notificar(): void {
    if (oyentesCambio.size === 0) return
    const mia = ++secuencia
    void estado()
      .then((e) => {
        if (mia !== secuencia) return
        const clave = JSON.stringify(e)
        if (clave === ultimaClave) return
        ultimaClave = clave
        for (const cb of [...oyentesCambio]) cb(e)
      })
      .catch((e: unknown) =>
        deps.registrar?.('aviso', `runtime: no se pudo leer el estado: ${String(e)}`)
      )
  }

  const bajaConfig = deps.config.suscribir(() => notificar())

  const rechazo = (mensaje: string): ErrorRuntime =>
    new ErrorRuntime('ARGUMENTOS_NO_VALIDOS', mensaje)

  /** ¿Se acepta Rápido ahora? Oferta vigente del origen o Rápido pendiente (preguntas/0021 §1). */
  async function puedeAceptarRapido(origen: OrigenRapido): Promise<boolean> {
    const c = deps.config.obtener()
    if (esRapidoPendiente(c)) return true
    if (origen === 'separacion') return deps.ofertaSeparacionVigente?.() === true
    return calcularOfertaInstalacion(c, null)
  }

  async function ejecutarAceptarRapido(origen: OrigenRapido): Promise<void> {
    if (deps.gestor.instalando()) throw rechazo('Hay una instalación en curso.')
    if (!(await puedeAceptarRapido(origen))) {
      throw rechazo('No hay ninguna oferta del modelo Rápido vigente.')
    }
    // 1. Consentimiento: se conserva la primera fecha.
    let c = deps.config.obtener()
    if (c.separacion.rapido_aceptado === null) {
      await deps.config.actualizar({ separacion: { rapido_aceptado: new Date().toISOString() } })
      c = deps.config.obtener()
    }
    deps.registrar?.(
      'info',
      `runtime: el usuario usa el modelo Rápido (origen: ${origen}, consentimiento: ${String(c.separacion.rapido_aceptado)})`
    )
    // 2-3. Descarga y verificación; `modo = 'rapido'` solo con el modelo verificado.
    if (c.instalacion.estado !== 'completa') {
      // Primer arranque: la fase de modelo de la instalación (B2 con su progreso) y el modo, al final.
      const instalacion = deps.gestor.instalar({ modelo: 'rapido' })
      notificar()
      const r = await instalacion.then(
        (res) => res,
        (e: unknown) => {
          notificar()
          throw e
        }
      )
      alTerminar(r)
      if (r.estado === 'error') {
        throw new ErrorRuntime(r.error.codigo, r.error.mensaje, r.error.detalles)
      }
      if (r.estado === 'pausada') throw new ErrorRuntime('CANCELADO', 'Descarga cancelada.')
      return
    }
    const control = new AbortController()
    controlRapido = control
    await deps.gestor.descargarModelo('rapido', control.signal, (p) =>
      emitirProgreso(eventoDescarga('rapido', p.bytes, p.total))
    )
    await deps.config.actualizar({ separacion: { modo: 'rapido' } })
  }

  function aceptarYUsarRapido(origen: OrigenRapido): Promise<void> {
    if (rapidoEnCurso) return rapidoEnCurso
    const p = ejecutarAceptarRapido(origen).finally(() => {
      rapidoEnCurso = null
      controlRapido = null
      notificar()
    })
    rapidoEnCurso = p
    return p
  }

  function volverACalidad(): Promise<void> {
    if (volverPromesa) return volverPromesa
    const control = new AbortController()
    volverControl = control
    const total = bytesModelo('calidad')
    volverEstado = { estado: 'descargando', bytes: 0, total, error: null }
    const p = (async () => {
      try {
        await deps.gestor.descargarModelo('calidad', control.signal, (pr) => {
          // El estado guarda el último avance sin difundirse: el progreso va por `alProgreso`.
          volverEstado = { estado: 'descargando', bytes: pr.bytes, total: pr.total, error: null }
          emitirProgreso(eventoDescarga('calidad', pr.bytes, pr.total))
        })
        await deps.config.actualizar({ separacion: { modo: 'calidad' } })
        volverEstado = null
      } catch (e) {
        if (control.signal.aborted) {
          volverEstado = null
          throw new ErrorRuntime('CANCELADO', 'Descarga cancelada.')
        }
        const codigo = (e as { codigo?: unknown }).codigo
        volverEstado = {
          estado: 'error',
          bytes: volverEstado?.bytes ?? 0,
          total,
          error: {
            codigo: esCodigoError(codigo) ? codigo : 'ERROR_INTERNO',
            mensaje: e instanceof Error ? e.message : String(e)
          }
        }
        throw e
      } finally {
        volverPromesa = null
        volverControl = null
        notificar()
      }
    })()
    volverPromesa = p
    notificar()
    return p
  }

  function alTerminar(r: ResultadoInstalacion): void {
    ultimoError = r.estado === 'error' ? r.error : null
    notificar()
  }

  return {
    estado,
    completa: () =>
      !verificando &&
      !deps.gestor.instalando() &&
      estadoPersistido(deps.config.obtener()) === 'completa',
    instalando: () => deps.gestor.instalando(),
    async requisitos(recalcularEspacio) {
      // `requisitosPrevios()` ya vuelve a leer el espacio libre en cada llamada (0031).
      void recalcularEspacio
      const r = await deps.deteccion.requisitosPrevios()
      return {
        plataforma: r.plataforma,
        motivo: r.motivo,
        versionMinimaSo: r.versionMinimaSo,
        equipo: r.equipo,
        emulada: r.emulada,
        perfil: r.perfil,
        gpu: r.gpu === null ? null : { nombre: r.gpu.nombre, vramMb: r.gpu.vramMb },
        bytesDescarga: r.bytesDescarga,
        rangoDescarga:
          r.plataforma === null ? null : rangoDescargaPlataforma(deps.manifiesto, r.plataforma),
        espacioRequerido: r.espacioRequerido,
        espacioLibre: r.espacioLibre,
        modoPrevisto: r.modoPrevisto,
        bytesRapido: modeloManifiesto('rapido') ? bytesModelo('rapido') : null,
        rapidoDescargado: deps.config.obtener().separacion.modelos_descargados.includes('rapido'),
        bytesCalidad: modeloManifiesto('calidad') ? bytesModelo('calidad') : null,
        calidadDescargado: deps.config.obtener().separacion.modelos_descargados.includes('calidad')
      }
    },
    instalar() {
      const p = deps.gestor.instalar()
      notificar()
      p.then(alTerminar, (e: unknown) => {
        deps.registrar?.('error', `runtime: la instalación terminó con una excepción: ${String(e)}`)
        notificar()
      })
    },
    async pausar() {
      controlRapido?.abort()
      await deps.gestor.pausar()
      notificar()
    },
    aceptarYUsarRapido,
    volverACalidad,
    cancelarVolverACalidad() {
      volverControl?.abort()
    },
    async detalles() {
      const c = deps.config.obtener()
      const previos = await deps.deteccion.requisitosPrevios()
      const fase =
        c.instalacion.error?.fase ??
        FASES_RUNTIME.find((f) => c.instalacion.fases[f] !== 'completada') ??
        'completa'
      const error = c.instalacion.error
      const lineas = [
        `Shinobi Karaoke ${deps.versionApp}`,
        `SO: ${deps.descripcionSo}`,
        `Equipo: ${previos.equipo.so} ${previos.equipo.versionSo} ${previos.equipo.arquitectura}${previos.emulada ? ' (emulada)' : ''}`,
        `Estado: ${estadoPersistido(c)}`,
        `Fase: ${fase}`,
        `Código de error: ${error?.codigo ?? '-'}`
      ]
      if (error?.mensaje) lineas.push(`Mensaje: ${error.mensaje}`)
      if (previos.plataforma === null) {
        lineas.push(
          previos.motivo === 'so_antiguo' && previos.versionMinimaSo
            ? `macos por debajo del mínimo (${previos.versionMinimaSo.version})`
            : 'plataforma no compatible'
        )
      }
      if (ultimoError?.detalles) {
        lineas.push(
          '',
          'Salida de la última instalación:',
          ...ultimoError.detalles.split(/\r?\n/).slice(-20)
        )
      }
      const registro = await deps.ultimasLineasRegistro(LINEAS_DETALLES).catch(() => [] as string[])
      lineas.push(
        '',
        `Registro del runtime (últimas ${String(LINEAS_DETALLES)} líneas):`,
        ...registro
      )
      return ocultarRutas(lineas.join('\n'), deps.datos, usuario)
    },
    estimarSeparacion(duracionMs, modeloPedido) {
      const c = deps.config.obtener()
      const perfil = perfilVigente(c)
      if (perfil === null) return null
      const modo = modeloPedido ?? modoSeparacionVigente(c)
      const r = estimarSegundosSeparacion(
        duracionMs,
        perfil,
        modo,
        c.separacion.factores_medidos,
        deps.manifiesto
      )
      if (r === null) return null
      return { min: r.min / 60, max: r.max / 60, origen: r.origen }
    },
    fijarVerificando(v) {
      if (verificando === v) return
      verificando = v
      notificar()
    },
    alProgreso(cb) {
      oyentesProgreso.add(cb)
      return () => oyentesProgreso.delete(cb)
    },
    alCambiar(cb) {
      oyentesCambio.add(cb)
      return () => oyentesCambio.delete(cb)
    },
    refrescar() {
      notificar()
    },
    cerrar() {
      // Al salir se aborta sin preguntar; el `.descarga` queda para reanudar (preguntas/0021 §2).
      volverControl?.abort()
      controlRapido?.abort()
      bajaConfig()
      bajaGestor()
      oyentesCambio.clear()
      oyentesProgreso.clear()
    }
  }
}
