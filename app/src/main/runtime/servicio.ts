import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  FASES_RUNTIME,
  estimarMinutosSeparacion,
  modeloDelPerfil,
  requisitosDe,
  type Config,
  type EstadoRuntimeIpc,
  type EstimacionSeparacion,
  type Manifiesto,
  type PerfilHardware,
  type ProgresoRuntimeIpc,
  type RequisitosRuntimeIpc
} from '../../shared'
import type { ServicioConfig } from '../configuracion'
import type { GestorRuntime, ResultadoInstalacion } from './gestor'
import type { ServicioDeteccion } from './deteccion'

/**
 * Fachada del runtime para la IPC (tarea 0036): estado persistido + estado vivo del gestor,
 * requisitos, detalles para soporte y estimación de la separación. Sin Electron.
 */

export const LINEAS_DETALLES = 50
export const MARCADOR_DATOS = '<datos>'

/** Subconjunto del gestor (0034) que usa la fachada. */
export type GestorParaServicio = Pick<
  GestorRuntime,
  'instalar' | 'pausar' | 'instalando' | 'suscribir'
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
  estimarSeparacion(duracionMs: number): EstimacionSeparacion
  /** La comprobación al arrancar (0035) marca aquí que está verificando el runtime. */
  fijarVerificando(verificando: boolean): void
  alProgreso(cb: (p: ProgresoRuntimeIpc) => void): () => void
  alCambiar(cb: (e: EstadoRuntimeIpc) => void): () => void
  cerrar(): void
}

export interface DependenciasServicioRuntime {
  gestor: GestorParaServicio
  config: Pick<ServicioConfig, 'obtener'> & { suscribir(cb: (c: Config) => void): () => void }
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
  /** Para informar de fallos de la instalación lanzada sin esperar. */
  registrar?(nivel: 'aviso' | 'error', mensaje: string): void
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
    const perfil = perfilVigente(c)
    let bytesRestantes: number | null = null
    if (perfil !== null) {
      const previos = await deps.deteccion.requisitosPrevios()
      bytesRestantes = bytesPorDescargar(c, perfil, previos.plataforma)
    }
    return {
      estado: estadoPersistido(c),
      fases: { ...c.instalacion.fases },
      error: c.instalacion.error,
      perfilPrevisto: c.instalacion.perfil_previsto,
      perfil: c.instalacion.perfil_hardware,
      motivoRebaja: c.instalacion.motivo_rebaja,
      modo: perfil === null ? null : modeloDelPerfil(perfil) === 'calidad' ? 'calidad' : 'rapido',
      bytesRestantes
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
    const modelo = deps.manifiesto.modelos.find((m) => m.id === modeloDelPerfil(perfil))
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
        espacioRequerido: r.espacioRequerido,
        espacioLibre: r.espacioLibre,
        modoPrevisto: r.modoPrevisto
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
      await deps.gestor.pausar()
      notificar()
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
    estimarSeparacion(duracionMs) {
      const c = deps.config.obtener()
      const perfil = perfilVigente(c)
      if (perfil === null) return null
      const modo = c.separacion.modo === 'automatico' ? modeloDelPerfil(perfil) : c.separacion.modo
      const r = estimarMinutosSeparacion(
        duracionMs,
        perfil,
        modo,
        c.separacion.factores_medidos,
        deps.manifiesto
      )
      return r === null ? null : { min: r.min, max: r.max }
    },
    fijarVerificando(v) {
      if (verificando === v) return
      verificando = v
      notificar()
    },
    alProgreso: (cb) => deps.gestor.suscribir(cb),
    alCambiar(cb) {
      oyentesCambio.add(cb)
      return () => oyentesCambio.delete(cb)
    },
    cerrar() {
      bajaConfig()
      oyentesCambio.clear()
    }
  }
}
