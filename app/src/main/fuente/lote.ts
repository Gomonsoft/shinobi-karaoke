import { randomUUID } from 'node:crypto'
import { access, constants, realpath, stat } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  claveFlexible,
  cuantasCaben,
  esCodigoError,
  MAX_LOTE,
  metadatosEditablesSchema,
  resultadoImportarArchivoSchema,
  type CodigoError,
  type LecturaLoteIpc,
  type ListaYoutubeIpc,
  type LoteIpc,
  type ValoresDatosIpc
} from '../../shared'
import type { Cancion } from '../../shared'
import type { CambioCancion, DatosNuevaCancion, ResumenCancion } from '../biblioteca'
import type { ErrorTrabajo, OpcionesEjecucion, PeticionTrabajo } from '../trabajos'
import {
  esAudioOVideo,
  MAX_ARCHIVOS_CARPETA,
  recorrerCarpeta,
  type ArchivoDeCarpeta
} from './carpeta'
import { EXTENSIONES_AUDIO_VIDEO, type DialogoArchivos } from './archivo'
import { resultadoLeerEtiquetasSchema, type ResultadoLeerEtiquetas } from './lista'
import { origenAlConfirmar, proponerDatos, type ResultadoPropuesta } from './propuestaDatos'
import type { ServicioYoutube } from './youtube'

/** Vida de una `ref` y tope de refs vivas (500 filas por lectura; un par de lecturas seguidas). */
export const VIDA_REF_MS = 30 * 60_000
const MAX_REFS = 1000
/** Un archivo se considera el mismo si el nombre y la duración (±1 s) coinciden, o título y artista (±2 s). */
const TOLERANCIA_NOMBRE_MS = 1000
const TOLERANCIA_IDENTIDAD_MS = 2000

/** Menos de 10 s no es una canción (el worker lo rechaza con `AUDIO_DEMASIADO_CORTO`). */
const DURACION_MINIMA_MS = 10_000
const MEZCLA = 'fuente/mezcla.flac'

export class ErrorLote extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
    readonly detalles?: string
  ) {
    super(mensaje)
    this.name = 'ErrorLote'
  }
}

export interface DialogoLote {
  /** Selección múltiple de archivos; `null` si se cancela. */
  elegirArchivos(): Promise<string[] | null>
  /** Una carpeta; `null` si se cancela. */
  elegirCarpeta(): Promise<string | null>
}

/** Diálogos de «Elegir archivos…» (selección múltiple) y «Elegir carpeta…». */
export function crearDialogoLote(dialogo: DialogoArchivos): DialogoLote {
  return {
    async elegirArchivos() {
      const r = await dialogo.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Audio y vídeo', extensions: [...EXTENSIONES_AUDIO_VIDEO] },
          { name: 'Todos los archivos', extensions: ['*'] }
        ]
      })
      return r.canceled || r.filePaths.length === 0 ? null : r.filePaths
    },
    async elegirCarpeta() {
      const r = await dialogo.showOpenDialog({ properties: ['openDirectory'] })
      return r.canceled || r.filePaths.length === 0 ? null : (r.filePaths[0] ?? null)
    }
  }
}

export interface BibliotecaLote {
  crear(datos: DatosNuevaCancion): Promise<ResumenCancion>
  obtener(id: string): Cancion | null
  actualizar(id: string, cambio: CambioCancion): Promise<ResumenCancion>
  valoresDatos(): ValoresDatosIpc
  indiceDuplicados(): {
    youtubeId: string | null
    nombreOriginal: string | null
    titulo: string
    artista: string
    duracionMs: number
  }[]
}

export interface GestorLote {
  encolar(peticion: PeticionTrabajo): unknown
  listar(): { cancionId: string }[]
}

export interface DependenciasLote {
  biblioteca: BibliotecaLote
  gestor: GestorLote
  /** Cliente del worker (0013). */
  ejecutar: (
    comando: string,
    args: Record<string, unknown>,
    opciones?: OpcionesEjecucion
  ) => Promise<Record<string, unknown>>
  /** Servicio de YouTube; ausente con el módulo desactivado (ADR 0003). */
  youtube?: Pick<ServicioYoutube, 'leerLista' | 'crearDeLote' | 'esDuplicado'>
  dialogo: DialogoLote
  /** Directorio de datos de la app: no se importa nada desde dentro. */
  dirDatos: string
  /** Bytes libres del volumen de la biblioteca (`null` si no se sabe: no se bloquea). */
  espacioLibre?: (ruta: string) => Promise<number | null>
  /** Minutos de proceso por minuto de audio con el factor medido en este equipo (`null` si no hay). */
  factorMinutos?: () => number | null
  ahora?: () => Date
  registrar?: (nivel: 'aviso' | 'error', mensaje: string) => void
}

interface RefArchivo {
  ruta: string
  nombre: string
  duracionMs: number | null
  propuesta: ResultadoPropuesta
  creada: number
  /** Fila sin casilla: no se puede crear una canción con ella. */
  problema: 'ilegible' | 'corta' | null
}

const noValido = (mensaje: string): ErrorLote => new ErrorLote('ARGUMENTOS_NO_VALIDOS', mensaje)

/**
 * Importación por lotes en main (ADR 0026, tarea 0314): lee archivos, carpetas y listas sin decodificar,
 * detecta duplicados y, al confirmar, crea todas las canciones con la fuente pendiente y las encola.
 * Nada se crea hasta `lote`; el renderer nunca envía rutas (solo `ref`).
 */
export class ServicioLote {
  private readonly refs = new Map<string, RefArchivo>()
  private lectura: AbortController | null = null

  constructor(private readonly deps: DependenciasLote) {}

  private ahora(): Date {
    return this.deps.ahora?.() ?? new Date()
  }

  /** `fuente.leerArchivos`: sin rutas, abre el diálogo del sistema (`null` si se cancela). */
  async leerArchivos(rutas?: string[]): Promise<LecturaLoteIpc | null> {
    const elegidas = rutas ?? (await this.deps.dialogo.elegirArchivos())
    if (elegidas === null || elegidas.length === 0) return null
    return this.leer(elegidas)
  }

  /** `fuente.leerCarpeta`: sin ruta, abre el selector de carpetas (`null` si se cancela). */
  async leerCarpeta(ruta?: string): Promise<LecturaLoteIpc | null> {
    const elegida = ruta ?? (await this.deps.dialogo.elegirCarpeta())
    if (elegida === null) return null
    const lectura = await this.leer([elegida])
    // Solo el nombre de la carpeta, nunca la ruta (el renderer no maneja rutas).
    const nombre = basename(elegida)
    return nombre === '' ? lectura : { ...lectura, carpeta: nombre }
  }

  /** `fuente.infoLista`: la lista o el álbum en modo plano, con `duplicado` por entrada. */
  async infoLista(url: string): Promise<ListaYoutubeIpc> {
    const youtube = this.youtubeActivo()
    const lista = await youtube.leerLista(url)
    return {
      ...(await this.estimacion()),
      titulo: lista.titulo,
      tipo: lista.tipo,
      recortada: lista.recortada,
      entradas: lista.entradas.map((e) => ({
        id: e.id,
        titulo: e.titulo,
        canal: e.canal,
        duracionS: e.duracion_s,
        disponible: e.problema === null,
        problema: e.problema,
        duplicado: youtube.esDuplicado(e.id) ? 'YA_EN_BIBLIOTECA' : null
      }))
    }
  }

  /**
   * `fuente.espacioLibre`: bytes libres de la unidad de la biblioteca (`null` si no se sabe) y el factor
   * de separación de este equipo (`null` sin medir), para estimar el tiempo de un lote de enlaces sueltos.
   */
  async espacioLibre(): Promise<{ libreBytes: number | null; factorMinutos: number | null }> {
    const libre = await this.deps
      .espacioLibre?.(join(this.deps.dirDatos, 'biblioteca'))
      .catch(() => null)
    return { libreBytes: libre ?? null, factorMinutos: this.deps.factorMinutos?.() ?? null }
  }

  private estimacion(): Promise<{ libreBytes: number | null; factorMinutos: number | null }> {
    return this.espacioLibre()
  }

  /** Cancela la lectura de etiquetas en curso (el worker termina; no queda nada que limpiar). */
  cancelarLectura(): void {
    this.lectura?.abort()
  }

  /**
   * `fuente.lote`: crea las canciones en el orden de la tabla y encola su fuente. Una fila que no se puede
   * crear (referencia caducada, vídeo no válido, error de escritura) sale en `omitidas` y el resto sigue.
   * Si no cabe en el disco, no se crea nada y falla con `SIN_ESPACIO` (`detalles`: `{"caben":n}`).
   */
  async lote(peticion: LoteIpc): Promise<{
    creadas: { id: string }[]
    omitidas: { fila: number; motivo: string }[]
  }> {
    const { entradas, metadatos } = peticion
    if (entradas.length > MAX_LOTE || entradas.length !== metadatos.length) {
      throw noValido('El lote no es válido.')
    }
    this.purgar()
    const omitidas: { fila: number; motivo: string }[] = []
    const validas: number[] = []
    entradas.forEach((e, fila) => {
      const ref = e.tipo === 'archivo' ? this.refs.get(e.ref) : undefined
      if (e.tipo === 'archivo' && !ref) {
        omitidas.push({ fila, motivo: 'ARCHIVO_NO_ENCONTRADO' })
      } else if (ref?.problema) {
        omitidas.push({
          fila,
          motivo: ref.problema === 'corta' ? 'AUDIO_DEMASIADO_CORTO' : 'FORMATO_NO_SOPORTADO'
        })
      } else validas.push(fila)
    })
    if (validas.some((f) => entradas[f]?.tipo === 'youtube')) this.youtubeActivo()

    await this.comprobarEspacio(validas.map((f) => this.duracionDe(entradas[f]!)))

    const creadas: { id: string }[] = []
    for (const fila of validas) {
      const entrada = entradas[fila]!
      try {
        const m = metadatosEditablesSchema.parse(metadatos[fila])
        const resumen =
          entrada.tipo === 'archivo'
            ? await this.crearDeArchivo(this.refs.get(entrada.ref)!, m)
            : await this.youtubeActivo().crearDeLote(entrada.id, m)
        creadas.push({ id: resumen.id })
      } catch (e) {
        const codigo = (e as { codigo?: unknown } | null)?.codigo
        omitidas.push({ fila, motivo: esCodigoError(codigo) ? codigo : 'ERROR_INTERNO' })
        this.deps.registrar?.('error', `lote: la fila ${fila} no se pudo crear: ${String(e)}`)
      }
    }
    omitidas.sort((a, b) => a.fila - b.fila)
    return { creadas, omitidas }
  }

  /**
   * Reintento de la fuente de una canción de lote que viene de un archivo (`fuente.reintentar`). Devuelve
   * `false` si la canción no es de ese tipo (el llamador prueba con YouTube).
   */
  async reintentar(cancionId: string): Promise<boolean> {
    const c = this.deps.biblioteca.obtener(cancionId)
    if (!c || c.fuente.tipo !== 'archivo' || !c.fuente.ruta_pendiente) return false
    if (
      !['pendiente', 'error', 'interrumpido'].includes(c.pasos.fuente.estado) ||
      this.deps.gestor.listar().some((t) => t.cancionId === cancionId)
    ) {
      throw noValido('No se puede reintentar la importación de esta canción.')
    }
    await this.deps.biblioteca.actualizar(cancionId, {
      pasos: {
        fuente: {
          estado: 'pendiente',
          actualizado: this.ahora().toISOString(),
          error: null,
          progreso: null
        }
      }
    })
    this.encolar(cancionId)
    return true
  }

  async cerrar(): Promise<void> {
    this.cancelarLectura()
    this.refs.clear()
  }

  /** Ruta de una fila de la última lectura (`fuente.importarArchivo({ ref })`); caducada o desconocida, no válida. */
  rutaDeRef(ref: string): string {
    this.purgar()
    const r = this.refs.get(ref)
    if (!r) throw noValido('La lectura del archivo caducó. Vuelve a elegirlo.')
    return r.ruta
  }

  // --- Lectura ---

  private async leer(rutas: string[]): Promise<LecturaLoteIpc> {
    this.cancelarLectura()
    const controlador = new AbortController()
    this.lectura = controlador
    try {
      const { candidatos, rechazadas, truncada } = await this.candidatos(rutas)
      const legibles = candidatos.filter((c) => !c.ilegible)
      let leidos: ResultadoLeerEtiquetas['archivos'] = []
      if (legibles.length > 0) {
        const bruto = await this.deps.ejecutar(
          'leer-etiquetas',
          { rutas: legibles.map((c) => c.ruta) },
          { señal: controlador.signal }
        )
        if (controlador.signal.aborted) throw new ErrorLote('CANCELADO', 'Lectura cancelada.')
        const r = resultadoLeerEtiquetasSchema.safeParse(bruto)
        if (!r.success || r.data.archivos.length !== legibles.length) {
          throw new ErrorLote('ERROR_INTERNO', 'El worker devolvió un resultado no válido.')
        }
        leidos = r.data.archivos
      }
      const valores = this.deps.biblioteca.valoresDatos()
      const indice = this.deps.biblioteca.indiceDuplicados()
      this.purgar()
      let siguiente = 0
      const filas: LecturaLoteIpc['filas'] = candidatos.map((c) => {
        const a = c.ilegible ? null : leidos[siguiente++]
        const leida = a?.ok ? a : null
        const nombre = basename(c.ruta)
        const duracionMs = leida?.duracion_ms ?? null
        const propuesta = proponerDatos(
          { tipo: 'archivo', nombre, etiquetas: leida?.etiquetas ?? {}, carpeta: c.carpeta },
          valores
        )
        const problema =
          leida === null
            ? 'ilegible'
            : duracionMs !== null && duracionMs < DURACION_MINIMA_MS
              ? 'corta'
              : null
        const ref = randomUUID()
        this.refs.set(ref, {
          ruta: c.ruta,
          nombre,
          duracionMs,
          propuesta,
          creada: this.ahora().getTime(),
          problema
        })
        const metadatos = {
          titulo: propuesta.datos.titulo.valor,
          artista: propuesta.datos.artista.valor,
          album: propuesta.datos.album.valor === '' ? null : propuesta.datos.album.valor
        }
        return {
          ref,
          nombre,
          duracionMs,
          metadatos,
          datos: propuesta.datos,
          duplicado: esDuplicadoArchivo(indice, {
            nombre,
            duracionMs,
            ...metadatos,
            artista: metadatos.artista
          })
            ? ('YA_EN_BIBLIOTECA' as const)
            : null,
          problema
        }
      })
      this.recortarRefs()
      return { filas, rechazadas, truncada, ...(await this.estimacion()) }
    } catch (e) {
      throw this.aErrorLote(e, 'leer-etiquetas')
    } finally {
      if (this.lectura === controlador) this.lectura = null
    }
  }

  /**
   * Archivos de audio que se leerán: las rutas sueltas y el recorrido de cada carpeta, sin repetidos, sin nada
   * del directorio de datos y como mucho 500. Un audio que no se puede abrir es una fila `ilegible`;
   * `rechazadas` cuenta solo lo que no se muestra (no es audio, está en la carpeta de datos o pasa de 500).
   */
  private async candidatos(rutas: string[]): Promise<{
    candidatos: (ArchivoDeCarpeta & { ilegible?: true })[]
    rechazadas: number
    truncada: boolean
  }> {
    const datos = await realpath(this.deps.dirDatos).catch(() => resolve(this.deps.dirDatos))
    const vistos = new Set<string>()
    const candidatos: (ArchivoDeCarpeta & { ilegible?: true })[] = []
    let rechazadas = 0
    let truncada = false
    const admitir = async (ruta: string, carpeta: string): Promise<void> => {
      const real = await realpath(ruta).catch(() => null)
      if (real === null || this.dentroDeDatos(real, datos)) {
        rechazadas++
        return
      }
      if (vistos.has(real)) return
      if (candidatos.length >= MAX_ARCHIVOS_CARPETA) {
        rechazadas++
        truncada = true
        return
      }
      const legible =
        (await stat(real).then(
          (s) => s.isFile(),
          () => false
        )) &&
        (await access(real, constants.R_OK).then(
          () => true,
          () => false
        ))
      vistos.add(real)
      candidatos.push({ ruta: real, carpeta, ...(legible ? {} : { ilegible: true as const }) })
    }
    for (const ruta of rutas) {
      if (!isAbsolute(ruta)) throw noValido('La ruta debe ser absoluta.')
      const info = await stat(ruta).catch(() => null)
      if (info === null) {
        rechazadas++
      } else if (info.isDirectory()) {
        const real = await realpath(ruta)
        if (this.dentroDeDatos(real, datos)) {
          rechazadas++
          continue
        }
        const recorrido = await recorrerCarpeta(real)
        rechazadas += recorrido.ignorados
        if (recorrido.truncado) truncada = true
        for (const a of recorrido.archivos) await admitir(a.ruta, a.carpeta)
      } else if (esAudioOVideo(ruta)) {
        await admitir(ruta, '')
      } else {
        rechazadas++
      }
    }
    return { candidatos, rechazadas, truncada }
  }

  private dentroDeDatos(real: string, datos: string): boolean {
    const rel = relative(datos, real)
    return rel === '' || (rel.split(sep)[0] !== '..' && !isAbsolute(rel))
  }

  // --- Creación ---

  private duracionDe(entrada: LoteIpc['entradas'][number]): number | null {
    return entrada.tipo === 'archivo' ? (this.refs.get(entrada.ref)?.duracionMs ?? null) : null
  }

  private async comprobarEspacio(duraciones: (number | null)[]): Promise<void> {
    const libre = await this.deps
      .espacioLibre?.(join(this.deps.dirDatos, 'biblioteca'))
      .catch(() => null)
    if (libre === null || libre === undefined) return
    const caben = cuantasCaben(duraciones, libre)
    if (caben < duraciones.length) {
      throw new ErrorLote(
        'SIN_ESPACIO',
        'No hay espacio en el disco para todo el lote.',
        JSON.stringify({ caben })
      )
    }
  }

  private async crearDeArchivo(
    ref: RefArchivo,
    m: { titulo: string; artista: string; album: string | null }
  ): Promise<ResumenCancion> {
    const titulo = m.titulo.trim()
    const artista = m.artista.trim()
    const album = (m.album?.trim() ?? '') === '' ? null : (m.album?.trim() ?? null)
    const origen = origenAlConfirmar(ref.propuesta, { titulo, artista, album })
    const resumen = await this.deps.biblioteca.crear({
      metadatos: {
        titulo,
        artista,
        album,
        duracion_ms: Math.max(1, ref.duracionMs ?? 1),
        ...(origen ? { origen } : {})
      },
      fuente: {
        tipo: 'archivo',
        nombre_original: ref.nombre,
        url: null,
        youtube_id: null,
        mezcla: MEZCLA,
        miniatura: null,
        ganancia_db: 0,
        ruta_pendiente: ref.ruta
      },
      pasos: {
        fuente: { estado: 'pendiente', actualizado: this.ahora().toISOString(), error: null }
      }
    })
    this.encolar(resumen.id)
    return resumen
  }

  /** `importar-archivo-cola` en la cola `ligera`: la ruta se lee al empezar y se comprueba entonces. */
  private encolar(cancionId: string): void {
    const salida = join(this.deps.dirDatos, 'biblioteca', cancionId)
    this.deps.gestor.encolar({
      cancionId,
      paso: 'fuente',
      cola: 'ligera',
      comando: 'importar-archivo-cola',
      args: { salida },
      alEmpezar: async () => {
        const entrada = await this.comprobarOriginal(cancionId)
        return { args: { entrada, salida, borrar_entrada: false } }
      },
      alResultado: (bruto) => {
        const r = resultadoImportarArchivoSchema.safeParse(bruto)
        if (!r.success || r.data.mezcla !== MEZCLA) {
          throw new ErrorLote('ERROR_INTERNO', 'El worker devolvió un resultado no válido.')
        }
        return {
          fuente: {
            mezcla: r.data.mezcla,
            ganancia_db: r.data.ganancia_db,
            ruta_pendiente: undefined
          },
          ...(r.data.duracion_ms > 0 ? { metadatos: { duracion_ms: r.data.duracion_ms } } : {})
        }
      }
    })
  }

  /** El original debe seguir en su sitio al llegarle el turno: si no, `ARCHIVO_NO_ENCONTRADO`. */
  private async comprobarOriginal(cancionId: string): Promise<string> {
    const ruta = this.deps.biblioteca.obtener(cancionId)?.fuente.ruta_pendiente
    const falta = (): never => {
      throw Object.assign(new Error('El archivo ya no está donde estaba.'), {
        codigo: 'ARCHIVO_NO_ENCONTRADO' as const,
        mensaje: 'El archivo ya no está donde estaba.'
      })
    }
    if (!ruta) return falta()
    const real = await realpath(ruta).catch(() => null)
    if (real === null) return falta()
    const ok = await stat(real)
      .then((s) => s.isFile())
      .catch(() => false)
    if (!ok) return falta()
    const datos = await realpath(this.deps.dirDatos).catch(() => resolve(this.deps.dirDatos))
    if (this.dentroDeDatos(real, datos)) return falta()
    return real
  }

  // --- internos ---

  private youtubeActivo(): NonNullable<DependenciasLote['youtube']> {
    if (!this.deps.youtube) throw noValido('YouTube no está disponible en esta versión.')
    return this.deps.youtube
  }

  private purgar(): void {
    const limite = this.ahora().getTime() - VIDA_REF_MS
    for (const [ref, r] of this.refs) if (r.creada < limite) this.refs.delete(ref)
  }

  private recortarRefs(): void {
    while (this.refs.size > MAX_REFS) {
      const mas = this.refs.keys().next().value
      if (mas === undefined) break
      this.refs.delete(mas)
    }
  }

  private aErrorLote(e: unknown, contexto: string): Error {
    if (e instanceof ErrorLote) return e
    const t = e as Partial<ErrorTrabajo> | null
    if (t && typeof t.codigo === 'string' && typeof t.mensaje === 'string') {
      const codigo = esCodigoError(t.codigo) ? t.codigo : 'ERROR_INTERNO'
      return new ErrorLote(codigo, t.mensaje, t.detalles)
    }
    this.deps.registrar?.('error', `${contexto}: ${String(e)}`)
    return new ErrorLote('ERROR_INTERNO', 'Algo salió mal.')
  }
}

/** Regla de la spec (ADR 0026 §1): mismo nombre de archivo y duración ±1 s, o mismo título y artista ±2 s. */
export function esDuplicadoArchivo(
  indice: ReturnType<BibliotecaLote['indiceDuplicados']>,
  fila: { nombre: string; duracionMs: number | null; titulo: string; artista: string }
): boolean {
  if (fila.duracionMs === null) return false
  const titulo = claveFlexible(fila.titulo)
  const artista = claveFlexible(fila.artista)
  return indice.some((c) => {
    const dif = Math.abs(c.duracionMs - (fila.duracionMs ?? 0))
    if (c.nombreOriginal === fila.nombre && dif <= TOLERANCIA_NOMBRE_MS) return true
    return (
      titulo !== null &&
      artista !== null &&
      dif <= TOLERANCIA_IDENTIDAD_MS &&
      claveFlexible(c.titulo) === titulo &&
      claveFlexible(c.artista) === artista
    )
  })
}
