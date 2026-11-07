import { promises as fsp } from 'node:fs'
import { join } from 'node:path'
import {
  esCodigoError,
  requisitosDe,
  type CodigoError,
  type Config,
  type Manifiesto,
  type ModeloManifiesto,
  type PerfilHardware,
  type Plataforma
} from '../../shared'
import { modoSeparacionVigente, type ServicioConfig } from '../configuracion'
import { escribirJsonAtomico, leerJson } from '../persistencia'
import type { RegistroApp } from '../registro/registroApp'
import { EstimadorProgreso } from '../trabajos/progreso'
import { crearClienteWorker } from '../trabajos/worker'
import type { EspacioLibre, ServicioDeteccion } from './deteccion'
import {
  descargarModelo,
  limpiarModelos,
  modeloPresente,
  totalModelo,
  verificarModelo,
  type OpcionesDescarga
} from './modelos'
import { ErrorRuntime, clasificarStderr, entornoUv, type EjecutorUv } from './uv'

/**
 * Gestor de runtime (tarea 0034, ADR 0009 §3, §6 y §8): primer arranque con uv.
 * Fases técnicas idempotentes y reanudables, agrupadas en tres fases visibles.
 */

export const FASES_VISIBLES = ['motor', 'componentes', 'modelo'] as const
export type FaseVisible = (typeof FASES_VISIBLES)[number]
export type EstadoFase = 'pendiente' | 'en_curso' | 'completada' | 'error'
export type MotivoRebaja = 'memoria' | 'generico'

export interface ProgresoRuntime {
  faseVisible: FaseVisible | null
  estados: Record<FaseVisible, EstadoFase>
  /** Bytes hechos y totales de la fase visible actual. */
  bytes: number
  total: number
  totalGlobal: number
  /** 0–100, entero y nunca decreciente (máximo 99 hasta terminar). */
  porcentajeGlobal: number
  etaSegundos: number | null
  modo: 'calidad' | 'rapido' | null
  motivoRebaja: MotivoRebaja | null
  /** "Comprobando tu equipo…" (diagnóstico, dentro de `componentes`). */
  comprobando: boolean
  /** "Comprobando tu instalación…": verificación completa al arrancar (0035). */
  verificando: boolean
}

/** Resultado de `comprobarAlArrancar` (ADR 0009 §6). */
export type ResultadoComprobacion =
  | { resultado: 'completa' }
  /** Instalación completa pero con algo roto: `estado = "dañada"` (B5). */
  | { resultado: 'dañada'; motivo: 'venv' | 'marcador' | 'modelo' }
  /** `config.json` recreado con runtime válido: reconstruida sin descargar nada. */
  | { resultado: 'reutilizada' }
  /** No completa: se instalará desde la primera fase no válida. */
  | { resultado: 'pendiente' }

export interface ErrorInstalacion {
  codigo: CodigoError
  mensaje: string
  /** Fase visible, o `plataforma` si falló la comprobación previa. */
  fase: FaseVisible | 'plataforma'
  detalles: string
}

export type ResultadoInstalacion =
  { estado: 'completa' } | { estado: 'pausada' } | { estado: 'error'; error: ErrorInstalacion }

export interface ResultadoDiagnostico {
  perfil: PerfilHardware
  gpu: string | null
  vram_mb: number | null
  motivo_rebaja: MotivoRebaja | null
}

/** Puertos (ADR 0009 §8). `EjecutorUv`, `EspacioLibre` y la detección viven en `uv.ts` y `deteccion.ts`. */
export interface Diagnosticador {
  diagnosticar(o: {
    perfilPrevisto: PerfilHardware
    interprete: string
    rutaCodigoWorker: string
    señal?: AbortSignal
  }): Promise<ResultadoDiagnostico>
}

export interface DescargadorModelos {
  descargar(modelo: ModeloManifiesto, opciones: OpcionesDescarga): Promise<void>
}

export interface MedidorDirectorio {
  /** Bytes que ocupa `ruta` (0 si no existe). */
  bytes(ruta: string): Promise<number>
}

export const medidorReal: MedidorDirectorio = {
  async bytes(ruta) {
    let total = 0
    const pila = [ruta]
    while (pila.length > 0) {
      const dir = pila.pop() as string
      let entradas
      try {
        entradas = await fsp.readdir(dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const e of entradas) {
        const p = join(dir, e.name)
        if (e.isDirectory()) pila.push(p)
        else if (e.isFile()) {
          try {
            total += (await fsp.stat(p)).size
          } catch {
            // desapareció mientras se medía
          }
        }
      }
    }
    return total
  }
}

export const descargadorModelosReal: DescargadorModelos = {
  descargar: (modelo, opciones) => descargarModelo(modelo, opciones)
}

/** Diagnóstico real: `python -m shinobi_worker diagnostico` con el intérprete del venv. */
export const diagnosticadorReal: Diagnosticador = {
  async diagnosticar({ perfilPrevisto, interprete, rutaCodigoWorker, señal }) {
    const cliente = crearClienteWorker({
      lanzador: {
        comando: interprete,
        argsBase: ['-m', 'shinobi_worker'],
        env: { PYTHONPATH: rutaCodigoWorker, PYTHONDONTWRITEBYTECODE: '1' }
      }
    })
    let r
    try {
      r = await cliente.ejecutar(
        'diagnostico',
        { perfil_previsto: perfilPrevisto },
        señal ? { señal } : {}
      )
    } catch (e) {
      const err = e as { codigo?: string; mensaje?: string; detalles?: string }
      if (err.codigo === 'CANCELADO') throw e
      throw new ErrorRuntime(
        esCodigoError(err.codigo) ? err.codigo : 'ERROR_INTERNO',
        err.mensaje ?? String(e),
        err.detalles ?? ''
      )
    }
    const motivo = r.motivo_rebaja
    return {
      perfil: r.perfil as PerfilHardware,
      gpu: typeof r.gpu === 'string' ? r.gpu : null,
      vram_mb: typeof r.vram_mb === 'number' ? r.vram_mb : null,
      motivo_rebaja: motivo === 'memoria' || motivo === 'generico' ? motivo : null
    }
  }
}

/** Contenido de `runtime/instalado.json` (ADR 0009 §3). */
export interface Marcador {
  manifiesto_version: number
  plataforma: Plataforma
  perfil: PerfilHardware
  sha256_requisitos: string
  python: string
  fecha: string
}

function validarMarcador(j: unknown): Marcador {
  const m = j as Partial<Marcador> | null
  if (
    typeof m !== 'object' ||
    m === null ||
    typeof m.manifiesto_version !== 'number' ||
    typeof m.plataforma !== 'string' ||
    typeof m.perfil !== 'string' ||
    typeof m.sha256_requisitos !== 'string' ||
    typeof m.python !== 'string' ||
    typeof m.fecha !== 'string'
  )
    throw new Error('marcador no válido')
  return m as Marcador
}

export async function leerMarcador(dirRuntime: string): Promise<Marcador | null> {
  const r = await leerJson(join(dirRuntime, 'instalado.json'), validarMarcador)
  return r.ok ? r.datos : null
}

/** Rutas del intérprete del venv. */
export function interpreteVenv(dirRuntime: string, plataforma: NodeJS.Platform): string {
  const venv = join(dirRuntime, 'venv')
  return plataforma === 'win32' ? join(venv, 'Scripts', 'python.exe') : join(venv, 'bin', 'python')
}

const SO_UV: Record<string, string> = { macos: 'macos', windows: 'windows', linux: 'linux' }
const ARQ_UV: Record<string, string> = { x64: 'x86_64', arm64: 'aarch64' }

const COMPROBAR_SIN_DIFFQ = [
  'from importlib.metadata import distributions',
  'from importlib.util import find_spec',
  'nombres = {(d.metadata.get("Name") or "").lower().replace("_", "-").replace(".", "-") for d in distributions()}',
  'if nombres & {"diffq", "diffq-fixed"} or find_spec("diffq") is not None:',
  '    raise SystemExit("El entorno todavía contiene DiffQ")'
].join('\n')

/** Variante de libc en la clave de uv: Linux exige `gnu` (o `musl`); macOS y Windows usan `none`. */
const LIBC_UV: Record<string, string> = { macos: 'none', windows: 'none', linux: 'gnu' }

/**
 * Petición de Python con arquitectura explícita, p. ej. `cpython-3.12.16-macos-aarch64-none`
 * o `cpython-3.12.16-linux-x86_64-gnu` (uv no tiene descargas `linux-…-none`).
 */
export function peticionPython(version: string, so: string, arquitectura: string): string | null {
  const s = SO_UV[so]
  const a = ARQ_UV[arquitectura]
  const libc = LIBC_UV[so]
  return s && a && libc ? `cpython-${version}-${s}-${a}-${libc}` : null
}

export interface DependenciasGestor {
  /** Directorio de datos (`SHINOBI_DATOS`). */
  datos: string
  manifiesto: Manifiesto
  config: Pick<ServicioConfig, 'obtener' | 'actualizar'>
  deteccion: Pick<ServicioDeteccion, 'requisitosPrevios'>
  ejecutorUv: EjecutorUv
  diagnosticador: Diagnosticador
  descargador: DescargadorModelos
  medidor: MedidorDirectorio
  espacio: EspacioLibre
  /** Carpeta que contiene `worker/requisitos/` (empaquetado: `resources/`; si no, la raíz del repo). */
  raizRecursos: string
  /** Código del worker (empaquetado: `resources/worker`; si no, `<repo>/worker`). */
  rutaCodigoWorker: string
  registro?: RegistroApp
  /** Entorno del que parte el de uv (por defecto `process.env`). */
  envBase?: Record<string, string | undefined>
  plataformaSO?: NodeJS.Platform
  /** Ms entre mediciones de directorios (500). */
  intervaloMedicionMs?: number
  /** Ms mínimos entre eventos de progreso (250: ≤ 4/s). */
  intervaloEmisionMs?: number
  ahora?: () => number
}

export interface GestorRuntime {
  /**
   * Instala (o continúa). Llamadas concurrentes devuelven la misma promesa. `modelo: 'rapido'`
   * (solo con `rapido_aceptado`, 0057) descarga Rápido en la fase de modelo y, ya verificado, fija
   * `separacion.modo = 'rapido'`.
   */
  instalar(opciones?: OpcionesInstalar): Promise<ResultadoInstalacion>
  reintentar(): Promise<ResultadoInstalacion>
  /** Cancela lo que esté en curso; resuelve cuando no queda ningún proceso hijo. */
  pausar(): Promise<void>
  instalando(): boolean
  /**
   * Descarga un modelo suelto, con progreso. `rapido` sin `rapido_aceptado` lanza
   * `ARGUMENTOS_NO_VALIDOS`.
   */
  descargarModelo(
    id: ModeloManifiesto['id'],
    señal?: AbortSignal,
    alProgreso?: (p: { bytes: number; total: number }) => void
  ): Promise<void>
  /** Comprobación de arranque (ADR 0009 §6): barata si `completa`; verificación completa si no. */
  comprobarAlArrancar(): Promise<ResultadoComprobacion>
  marcarDanada(motivo: 'componentes'): Promise<void>
  suscribir(cb: (p: ProgresoRuntime) => void): () => void
}

export interface OpcionesInstalar {
  /** Modelo que descarga la fase de modelo en vez del vigente (solo `rapido`, 0057). */
  modelo?: ModeloManifiesto['id']
}

class Pausa extends Error {}

const MODULO = 'runtime'

export function crearGestorRuntime(deps: DependenciasGestor): GestorRuntime {
  const so = deps.plataformaSO ?? process.platform
  const ahora = deps.ahora ?? Date.now
  const dirRuntime = join(deps.datos, 'runtime')
  const dirModelos = join(deps.datos, 'modelos')
  const dirPython = join(dirRuntime, 'python')
  const dirCache = join(dirRuntime, 'cache-uv')
  const dirVenv = join(dirRuntime, 'venv')
  const python = interpreteVenv(dirRuntime, so)
  const oyentes = new Set<(p: ProgresoRuntime) => void>()
  const log = (nivel: 'info' | 'aviso' | 'error', m: string): void =>
    deps.registro?.escribir(nivel, MODULO, m)

  let actual: Promise<ResultadoInstalacion> | null = null
  let control: AbortController | null = null
  let invalidacion: Promise<void> | null = null

  const existe = (r: string): Promise<boolean> =>
    fsp.access(r).then(
      () => true,
      () => false
    )

  /** Modelo del modo vigente: Calidad, o Rápido solo con `modo === 'rapido'` y consentimiento. */
  function modeloVigente(cfg: Config = deps.config.obtener()): ModeloManifiesto | undefined {
    const id = modoSeparacionVigente(cfg)
    return deps.manifiesto.modelos.find((m) => m.id === id)
  }

  /** Defensa: Rápido nunca se descarga sin el consentimiento guardado. */
  function exigirConsentimiento(id: ModeloManifiesto['id']): void {
    if (id === 'rapido' && deps.config.obtener().separacion.rapido_aceptado === null)
      throw new ErrorRuntime(
        'ARGUMENTOS_NO_VALIDOS',
        'El modelo Rápido solo se descarga con el consentimiento del usuario'
      )
  }

  /** Descarga un modelo suelto (Rápido solo con consentimiento; lo usa 0057). */
  async function descargarModelo(
    id: ModeloManifiesto['id'],
    señal?: AbortSignal,
    alProgreso?: (p: { bytes: number; total: number }) => void
  ): Promise<void> {
    exigirConsentimiento(id)
    const modelo = deps.manifiesto.modelos.find((m) => m.id === id)
    if (!modelo) throw new ErrorRuntime('MODELO_NO_DISPONIBLE', `El manifiesto no tiene ${id}`)
    await deps.descargador.descargar(modelo, {
      dirModelos,
      ...(señal ? { señal } : {}),
      ...(alProgreso ? { alProgreso } : {}),
      ...(deps.registro ? { registro: deps.registro } : {})
    })
    const lista = deps.config.obtener().separacion.modelos_descargados
    await deps.config.actualizar({
      separacion: { modelos_descargados: [...new Set([...lista, modelo.id])] }
    })
  }

  async function ejecutar(
    señal: AbortSignal,
    forzado?: ModeloManifiesto['id']
  ): Promise<ResultadoInstalacion> {
    // Modelo de la fase de modelo: el pedido (Rápido tras el consentimiento) o el vigente.
    const modeloObjetivo = (): ModeloManifiesto | undefined =>
      forzado ? deps.manifiesto.modelos.find((m) => m.id === forzado) : modeloVigente()
    if (invalidacion) await invalidacion
    const cfg0 = deps.config.obtener()
    const reinstalarComponentes = cfg0.instalacion.reinstalar_componentes
    const previos = await deps.deteccion.requisitosPrevios()
    const plataforma = previos.plataforma
    const perfilInstalado = previos.perfil
    const req =
      plataforma !== null && perfilInstalado !== null
        ? requisitosDe(deps.manifiesto, plataforma, perfilInstalado)
        : null

    // ---- Estado de progreso -------------------------------------------------
    const estados: Record<FaseVisible, EstadoFase> = {
      motor: cfg0.instalacion.fases.motor === 'completada' ? 'completada' : 'pendiente',
      componentes: cfg0.instalacion.fases.componentes === 'completada' ? 'completada' : 'pendiente',
      modelo: cfg0.instalacion.fases.modelo === 'completada' ? 'completada' : 'pendiente'
    }
    let perfilFinal: PerfilHardware | null = cfg0.instalacion.perfil_hardware
    let motivo: MotivoRebaja | null = cfg0.instalacion.motivo_rebaja
    const totales: Record<FaseVisible, number> = { motor: 0, componentes: 0, modelo: 0 }
    const hechos: Record<FaseVisible, number> = { motor: 0, componentes: 0, modelo: 0 }
    const recalcularTotales = (): void => {
      totales.motor = plataforma ? (deps.manifiesto.python.bytes_descarga[plataforma] ?? 0) : 0
      totales.componentes = req?.bytes_descarga ?? 0
      const m = modeloObjetivo()
      totales.modelo = m ? totalModelo(m) : 0
      for (const f of FASES_VISIBLES) if (estados[f] === 'completada') hechos[f] = totales[f]
    }
    recalcularTotales()

    let faseActual: FaseVisible | null = null
    let comprobando = false
    let porcentaje = 0
    let etaMostrada: number | null = null
    let etaDesde = 0
    let ultimaEmision = 0
    const estimador = new EstimadorProgreso(10)
    const intervaloEmision = deps.intervaloEmisionMs ?? 250

    const publicar = (forzar = false): void => {
      const t = ahora()
      if (!forzar && t - ultimaEmision < intervaloEmision) return
      ultimaEmision = t
      const totalGlobal = FASES_VISIBLES.reduce((a, f) => a + totales[f], 0)
      const hechoGlobal = FASES_VISIBLES.reduce((a, f) => a + Math.min(hechos[f], totales[f]), 0)
      const todas = FASES_VISIBLES.every((f) => estados[f] === 'completada')
      const calculado = todas
        ? 100
        : Math.min(99, totalGlobal > 0 ? Math.floor((100 * hechoGlobal) / totalGlobal) : 0)
      porcentaje = Math.max(porcentaje, calculado) // nunca retrocede, ni tras una rebaja
      const eta = estimador.registrar('instalacion', porcentaje / 100, t).etaSegundos
      if (eta === null || todas) {
        etaMostrada = todas ? null : eta
        etaDesde = t
      } else if (etaMostrada === null || t - etaDesde >= 1000) {
        etaMostrada = eta
        etaDesde = t
      }
      const evento: ProgresoRuntime = {
        faseVisible: faseActual,
        estados: { ...estados },
        bytes: faseActual ? Math.min(hechos[faseActual], totales[faseActual]) : 0,
        total: faseActual ? totales[faseActual] : 0,
        totalGlobal,
        porcentajeGlobal: porcentaje,
        etaSegundos: etaMostrada,
        modo: forzado ?? modoSeparacionVigente(deps.config.obtener()),
        motivoRebaja: motivo,
        comprobando,
        verificando: false
      }
      for (const cb of [...oyentes]) cb(evento)
    }

    const guardarFase = async (
      f: FaseVisible,
      e: EstadoFase,
      extra: { codigo?: string; mensaje?: string } = {}
    ): Promise<void> => {
      estados[f] = e
      await deps.config.actualizar({
        instalacion: {
          fases: { [f]: e },
          ...(f === 'componentes' && e === 'completada' ? { reinstalar_componentes: false } : {}),
          error:
            e === 'error'
              ? { codigo: extra.codigo ?? 'ERROR_INTERNO', mensaje: extra.mensaje ?? '', fase: f }
              : null
        }
      })
      publicar(true)
    }

    const fallo = async (
      e: ErrorRuntime,
      fase: ErrorInstalacion['fase']
    ): Promise<ResultadoInstalacion> => {
      log('error', `Instalación fallida en "${fase}": ${e.codigo}: ${e.message}`)
      const error: ErrorInstalacion = {
        codigo: e.codigo,
        mensaje: e.message,
        fase,
        detalles: e.detalles
      }
      if (fase === 'plataforma') {
        await deps.config.actualizar({
          instalacion: { error: { codigo: e.codigo, mensaje: e.message, fase } }
        })
      } else {
        await guardarFase(fase, 'error', { codigo: e.codigo, mensaje: e.message })
      }
      return { estado: 'error', error }
    }

    // ---- 1. Plataforma ------------------------------------------------------
    if (plataforma === null || perfilInstalado === null || req === null) {
      return fallo(
        new ErrorRuntime(
          'PLATAFORMA_NO_SOPORTADA',
          `Plataforma no soportada: ${previos.equipo.so} ${previos.equipo.versionSo} ${previos.equipo.arquitectura}`
        ),
        'plataforma'
      )
    }
    const peticion = peticionPython(
      deps.manifiesto.python.version,
      previos.equipo.so,
      previos.equipo.arquitectura
    )
    if (peticion === null) {
      return fallo(
        new ErrorRuntime('PLATAFORMA_NO_SOPORTADA', 'Arquitectura sin Python gestionado'),
        'plataforma'
      )
    }

    await deps.config.actualizar({ instalacion: { estado: 'en_curso', error: null } })

    const env = entornoUv(dirRuntime, deps.envBase)
    const uv = async (args: string[]): Promise<{ stdout: string }> => {
      const r = await deps.ejecutorUv.ejecutar(['--no-config', ...args], { env, señal })
      if (r.cancelado || señal.aborted) throw new Pausa()
      if (r.codigo !== 0) {
        const texto = r.ultimasLineas.join('\n')
        throw new ErrorRuntime(
          clasificarStderr(texto),
          `uv ${args[0] ?? ''} terminó con código ${String(r.codigo)}`,
          texto
        )
      }
      return { stdout: r.stdout }
    }

    const comprobarEspacio = async (necesario: number): Promise<void> => {
      if (necesario <= 0) return
      const libre = await deps.espacio.bytesLibres(deps.datos)
      if (libre < necesario) {
        throw new ErrorRuntime(
          'SIN_ESPACIO',
          `Faltan ${String(Math.ceil(necesario - libre))} bytes de espacio libre`
        )
      }
    }

    const rutaMarcador = join(dirRuntime, 'instalado.json')
    const crearVenvLimpio = async (): Promise<void> => {
      const encontrado = await uv(['python', 'find', peticion])
      const interprete = encontrado.stdout.split(/\r?\n/).find((l) => l.trim() !== '')
      if (!interprete) throw new ErrorRuntime('ERROR_INTERNO', 'uv no devolvió el intérprete')
      // Un cierre durante `venv --clear` no debe permitir reutilizar el marcador anterior.
      await fsp.rm(`${rutaMarcador}.bak`, { force: true })
      await fsp.rm(rutaMarcador, { force: true })
      await uv(['venv', '--clear', '--python', interprete.trim(), dirVenv])
    }

    /** Mide directorios cada `intervaloMedicionMs` mientras dura `fn`; `medir` devuelve los bytes hechos. */
    const conMedicion = async <T>(
      fase: FaseVisible,
      medir: () => Promise<number>,
      fn: () => Promise<T>,
      /** Bytes que mide `medir` al terminar la fase (por defecto, los de la interfaz). */
      denominador?: number
    ): Promise<T> => {
      let vivo = true
      let midiendo = false
      const tope = Math.floor(totales[fase] * 0.99)
      const tick = (): void => {
        if (midiendo || !vivo) return
        midiendo = true
        medir()
          .then((b) => {
            if (!vivo) return
            // Se convierte proporcionalmente a la cifra que ve el usuario (bytes_descarga).
            const escalado =
              denominador !== undefined && denominador > 0 ? (b * totales[fase]) / denominador : b
            hechos[fase] = Math.max(hechos[fase], Math.min(escalado, tope))
            publicar()
          })
          .catch(() => undefined)
          .finally(() => {
            midiendo = false
          })
      }
      const t = setInterval(tick, deps.intervaloMedicionMs ?? 500)
      try {
        return await fn()
      } finally {
        vivo = false
        clearInterval(t)
      }
    }

    /** Ejecuta una fase visible con persistencia de su estado. */
    const fase = async (f: FaseVisible, fn: () => Promise<void>): Promise<void> => {
      faseActual = f
      await guardarFase(f, 'en_curso')
      try {
        await fn()
      } catch (e) {
        if (e instanceof Pausa || señal.aborted) {
          await guardarFase(f, 'pendiente')
          throw new Pausa()
        }
        throw Object.assign(e instanceof Error ? e : new Error(String(e)), { fase: f })
      }
      hechos[f] = totales[f]
      await guardarFase(f, 'completada')
    }

    try {
      publicar(true)

      // ---- 2. Motor ---------------------------------------------------------
      const motorHecho = estados.motor === 'completada' && (await existe(python))
      if (!motorHecho) {
        estados.motor = 'pendiente'
        hechos.motor = 0
        await fase('motor', async () => {
          await comprobarEspacio(req.espacio_requerido - (await deps.medidor.bytes(dirRuntime)))
          await conMedicion(
            'motor',
            async () =>
              (await deps.medidor.bytes(dirPython)) + (await deps.medidor.bytes(dirCache)),
            async () => {
              await uv(['python', 'install', peticion])
              await crearVenvLimpio()
            }
          )
        })
      }

      // ---- 3-4. Componentes y diagnóstico ----------------------------------
      const marcador = reinstalarComponentes ? null : await leerMarcador(dirRuntime)
      const marcadorValido =
        marcador !== null &&
        marcador.manifiesto_version === deps.manifiesto.version &&
        marcador.plataforma === plataforma &&
        marcador.perfil === perfilInstalado &&
        marcador.sha256_requisitos === req.sha256_requisitos
      const componentesHechos =
        estados.componentes === 'completada' &&
        marcadorValido &&
        perfilFinal !== null &&
        (await existe(python))
      if (!componentesHechos) {
        estados.componentes = 'pendiente'
        hechos.componentes = 0
        await fase('componentes', async () => {
          if (!marcadorValido) {
            // ADR 0014: una instalación incremental deja dependencias huérfanas.
            if (motorHecho) await crearVenvLimpio()
            await comprobarEspacio(req.espacio_requerido - (await deps.medidor.bytes(dirRuntime)))
            const baseCache =
              estados.motor === 'completada' && !motorHecho ? await deps.medidor.bytes(dirCache) : 0
            await conMedicion(
              'componentes',
              async () => Math.max(0, (await deps.medidor.bytes(dirCache)) - baseCache),
              async () => {
                await uv([
                  'pip',
                  'install',
                  '--python',
                  python,
                  '--require-hashes',
                  '--excludes',
                  join(deps.rutaCodigoWorker, 'requisitos', 'exclusiones.txt'),
                  '--index-strategy',
                  'unsafe-best-match',
                  '-r',
                  join(deps.raizRecursos, req.requisitos)
                ])
                await uv([
                  'run',
                  '--offline',
                  '--no-project',
                  '--no-python-downloads',
                  '--python',
                  python,
                  '--',
                  python,
                  '-I',
                  '-c',
                  COMPROBAR_SIN_DIFFQ
                ])
              },
              // La caché de uv va descomprimida: su progreso se mide contra bytes_cache.
              req.bytes_cache ?? req.bytes_descarga
            )
            const nuevo: Marcador = {
              manifiesto_version: deps.manifiesto.version,
              plataforma,
              perfil: perfilInstalado,
              sha256_requisitos: req.sha256_requisitos,
              python: deps.manifiesto.python.version,
              fecha: new Date().toISOString()
            }
            await escribirJsonAtomico(rutaMarcador, nuevo)
            try {
              await uv(['cache', 'clean'])
            } catch (e) {
              if (e instanceof Pausa) throw e
              log('aviso', `uv cache clean falló: ${String(e)}`) // no es fatal
            }
          }
          // Diagnóstico: "Comprobando tu equipo…"
          hechos.componentes = Math.max(hechos.componentes, Math.floor(totales.componentes * 0.99))
          comprobando = true
          publicar(true)
          try {
            const d = await deps.diagnosticador.diagnosticar({
              perfilPrevisto: perfilInstalado,
              interprete: python,
              rutaCodigoWorker: deps.rutaCodigoWorker,
              señal
            })
            perfilFinal = d.perfil
            motivo = d.motivo_rebaja
            await deps.config.actualizar({
              instalacion: {
                perfil_hardware: d.perfil,
                motivo_rebaja: d.motivo_rebaja,
                hardware: { gpu: d.gpu, vram_mb: d.vram_mb }
              }
            })
            recalcularTotales() // la rebaja cuda → cpu no cambia el modelo (Calidad): el total no baja
          } catch (e) {
            if (señal.aborted) throw new Pausa()
            const err = e as { codigo?: string; mensaje?: string; message?: string }
            if (e instanceof ErrorRuntime) throw e
            throw new ErrorRuntime(
              esCodigoError(err.codigo) ? err.codigo : 'ERROR_INTERNO',
              err.mensaje ?? err.message ?? String(e)
            )
          } finally {
            comprobando = false
          }
        })
      }

      // ---- 5. Modelo --------------------------------------------------------
      const modelo = modeloObjetivo()
      if (!modelo) {
        throw Object.assign(
          new ErrorRuntime('MODELO_NO_DISPONIBLE', 'El manifiesto no tiene el modelo vigente'),
          {
            fase: 'modelo'
          }
        )
      }
      recalcularTotales()
      const yaTieneModelo =
        estados.modelo === 'completada' &&
        deps.config.obtener().separacion.modelos_descargados.includes(modelo.id)
      if (!yaTieneModelo) {
        estados.modelo = 'pendiente'
        hechos.modelo = 0
        await fase('modelo', async () => {
          exigirConsentimiento(modelo.id)
          await limpiarModelos(dirModelos)
          await comprobarEspacio(totalModelo(modelo) - (await deps.medidor.bytes(dirModelos)))
          await deps.descargador.descargar(modelo, {
            dirModelos,
            señal,
            alProgreso: (p) => {
              hechos.modelo = Math.min(p.bytes, totales.modelo)
              publicar()
            },
            ...(deps.registro ? { registro: deps.registro } : {})
          })
          const lista = deps.config.obtener().separacion.modelos_descargados
          await deps.config.actualizar({
            separacion: { modelos_descargados: [...new Set([...lista, modelo.id])] }
          })
        })
      }

      // Rápido ya descargado y verificado: solo ahora pasa a ser el modo (0057).
      if (forzado && modoSeparacionVigente(deps.config.obtener()) !== forzado) {
        await deps.config.actualizar({ separacion: { modo: forzado } })
      }
      await deps.config.actualizar({
        instalacion: {
          estado: 'completa',
          version_manifiesto: deps.manifiesto.version,
          error: null
        }
      })
      faseActual = null
      publicar(true)
      return { estado: 'completa' }
    } catch (e) {
      if (e instanceof Pausa || señal.aborted) {
        await deps.config.actualizar({ instalacion: { error: null } })
        faseActual = null
        publicar(true)
        return { estado: 'pausada' }
      }
      const f = (e as { fase?: FaseVisible }).fase ?? 'motor'
      if (e instanceof ErrorRuntime) return fallo(e, f)
      const mensaje = e instanceof Error ? e.message : String(e)
      const codigo = (e as { codigo?: unknown }).codigo
      return fallo(new ErrorRuntime(esCodigoError(codigo) ? codigo : 'ERROR_INTERNO', mensaje), f)
    }
  }

  /** ¿Marcador de esta versión del manifiesto, plataforma y perfil? */
  function marcadorCoincide(
    m: Marcador | null,
    plataforma: Plataforma,
    perfil: PerfilHardware,
    sha: string
  ): boolean {
    return (
      m !== null &&
      m.manifiesto_version === deps.manifiesto.version &&
      m.plataforma === plataforma &&
      m.perfil === perfil &&
      m.sha256_requisitos === sha
    )
  }

  function emitirVerificando(verificando: boolean): void {
    const f = deps.config.obtener().instalacion.fases
    const evento: ProgresoRuntime = {
      faseVisible: null,
      estados: { motor: f.motor, componentes: f.componentes, modelo: f.modelo },
      bytes: 0,
      total: 0,
      totalGlobal: 0,
      porcentajeGlobal: 0,
      etaSegundos: null,
      modo: null,
      motivoRebaja: null,
      comprobando: false,
      verificando
    }
    for (const cb of [...oyentes]) cb(evento)
  }

  async function comprobarAlArrancar(): Promise<ResultadoComprobacion> {
    const t0 = ahora()
    await limpiarModelos(dirModelos) // siempre: restos `*.partial` de audio-separator
    const cfg = deps.config.obtener()
    const previos = await deps.deteccion.requisitosPrevios()
    const plataforma = previos.plataforma
    const perfilPrev = previos.perfil
    const req =
      plataforma !== null && perfilPrev !== null
        ? requisitosDe(deps.manifiesto, plataforma, perfilPrev)
        : null
    // Si la app se cerró después de guardar el diagnóstico, un marcador residual no se reutiliza.
    const marcador = cfg.instalacion.reinstalar_componentes ? null : await leerMarcador(dirRuntime)
    const hayVenv = await existe(python)

    // ---- completa: comprobación barata -------------------------------------
    if (cfg.instalacion.estado === 'completa') {
      let motivo: 'venv' | 'marcador' | 'modelo' | null = null
      const modelo = modeloVigente(cfg)
      if (!hayVenv) motivo = 'venv'
      else if (
        plataforma === null ||
        perfilPrev === null ||
        req === null ||
        !marcadorCoincide(marcador, plataforma, perfilPrev, req.sha256_requisitos)
      )
        motivo = 'marcador'
      else if (!modelo || !(await modeloPresente(modelo, dirModelos))) motivo = 'modelo'
      log('info', `Comprobación barata del runtime: ${motivo ?? 'correcta'} (${ahora() - t0} ms)`)
      if (motivo === null) return { resultado: 'completa' }
      await deps.config.actualizar({
        instalacion: {
          estado: 'dañada',
          fases: {
            motor: motivo === 'venv' ? 'pendiente' : cfg.instalacion.fases.motor,
            componentes: motivo === 'modelo' ? cfg.instalacion.fases.componentes : 'pendiente',
            modelo:
              motivo === 'modelo' || motivo === 'venv' ? 'pendiente' : cfg.instalacion.fases.modelo
          },
          error: null
        },
        ...(motivo === 'modelo' && modelo
          ? {
              separacion: {
                modelos_descargados: cfg.separacion.modelos_descargados.filter(
                  (m) => m !== modelo.id
                )
              }
            }
          : {})
      })
      return { resultado: 'dañada', motivo }
    }

    // ---- no completa: ¿marcador válido? → verificación completa ------------
    if (
      !hayVenv ||
      plataforma === null ||
      perfilPrev === null ||
      req === null ||
      !marcadorCoincide(marcador, plataforma, perfilPrev, req.sha256_requisitos)
    ) {
      return { resultado: 'pendiente' }
    }
    emitirVerificando(true)
    try {
      let diag: ResultadoDiagnostico | null = null
      try {
        diag = await deps.diagnosticador.diagnosticar({
          perfilPrevisto: perfilPrev,
          interprete: python,
          rutaCodigoWorker: deps.rutaCodigoWorker
        })
      } catch (e) {
        log('aviso', `Diagnóstico al reutilizar el runtime falló: ${String(e)}`)
      }
      // SHA-256 de los modelos presentes.
      const validos: ModeloManifiesto['id'][] = []
      for (const m of deps.manifiesto.modelos) {
        if (
          (await modeloPresente(m, dirModelos)) &&
          (await verificarModelo(m, dirModelos, { completo: true }))
        )
          validos.push(m.id)
      }
      if (diag === null) {
        // Sin diagnóstico válido solo se da por buena la fase de motor.
        await deps.config.actualizar({
          instalacion: {
            fases: { motor: 'completada', componentes: 'pendiente', modelo: 'pendiente' }
          },
          separacion: { modelos_descargados: validos }
        })
        log('info', `Verificación del runtime: diagnóstico fallido (${ahora() - t0} ms)`)
        return { resultado: 'pendiente' }
      }
      const modelo = modeloVigente(deps.config.obtener())
      const modeloOk = modelo !== undefined && validos.includes(modelo.id)
      await deps.config.actualizar({
        instalacion: {
          estado: modeloOk ? 'completa' : 'pendiente',
          fases: {
            motor: 'completada',
            componentes: 'completada',
            modelo: modeloOk ? 'completada' : 'pendiente'
          },
          perfil_hardware: diag.perfil,
          motivo_rebaja: diag.motivo_rebaja,
          hardware: { gpu: diag.gpu, vram_mb: diag.vram_mb },
          version_manifiesto: modeloOk ? deps.manifiesto.version : null,
          error: null
        },
        separacion: { modelos_descargados: validos }
      })
      log(
        'info',
        `Verificación completa del runtime: ${modeloOk ? 'reutilizado' : 'falta el modelo'} (${ahora() - t0} ms)`
      )
      return { resultado: modeloOk ? 'reutilizada' : 'pendiente' }
    } finally {
      emitirVerificando(false)
    }
  }

  function marcarDanada(motivo: 'componentes'): Promise<void> {
    if (invalidacion) return invalidacion
    if (deps.config.obtener().instalacion.estado !== 'completa') return Promise.resolve()
    const marcador = join(dirRuntime, 'instalado.json')
    invalidacion = deps.config
      .actualizar({
        instalacion: {
          estado: 'dañada',
          fases: { [motivo]: 'pendiente' },
          error: null,
          reinstalar_componentes: true
        }
      })
      .then(async () => {
        await fsp.rm(`${marcador}.bak`, { force: true })
        await fsp.rm(marcador, { force: true })
      })
      .finally(() => {
        invalidacion = null
      })
    return invalidacion
  }

  function instalar(opciones: OpcionesInstalar = {}): Promise<ResultadoInstalacion> {
    if (actual) return actual
    if (opciones.modelo) {
      try {
        exigirConsentimiento(opciones.modelo)
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(String(e)))
      }
    }
    const ctrl = new AbortController()
    control = ctrl
    actual = ejecutar(ctrl.signal, opciones.modelo).finally(() => {
      actual = null
      control = null
    })
    return actual
  }

  return {
    instalar,
    reintentar: () => instalar(),
    async pausar() {
      const en = actual
      if (!en) return
      control?.abort()
      await en.catch(() => undefined)
    },
    instalando: () => actual !== null,
    descargarModelo,
    comprobarAlArrancar,
    marcarDanada,
    suscribir(cb) {
      oyentes.add(cb)
      return () => oyentes.delete(cb)
    }
  }
}
