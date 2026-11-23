import { createHash } from 'node:crypto'
import type {
  Cancion,
  CodigoError,
  PrevisualizacionVariasIpc,
  ProgresoLoteIpc,
  ResultadoVariasIpc
} from '../../shared'
import type { EstadoSesionIpc } from '../../shared/sesion'
import { origenTrasEdicion } from './origen'
import type { CambioCancion } from './operaciones'
import type { ResumenCancion } from './resumen'

/**
 * Acciones por lotes de la Biblioteca (ADR 0026 §4): editar datos, eliminar y «A la cola» de varias
 * canciones. Mismo patrón que «Aplicar tema…» (ADR 0016 §7): `previsualizar` dice, por canción, si aplica
 * y qué arrastra, con una `version` de la selección; `ejecutar` la recalcula y, si difiere, responde
 * `CONFIRMACION_OBSOLETA` sin tocar nada. Después va canción a canción (lo hecho queda hecho).
 */

/** Error con código estable; `detalles` (solo `CONFIRMACION_OBSOLETA`) es la previsualización nueva. */
export class ErrorLotes extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
    readonly detalles?: unknown
  ) {
    super(mensaje)
    this.name = 'ErrorLotes'
  }
}

/** Subconjunto de `ServicioBiblioteca` que usan los lotes. */
export interface BibliotecaLotes {
  obtener(id: string): Cancion | null
  obtenerResumen(id: string): ResumenCancion | null
  actualizar(id: string, cambio: CambioCancion): Promise<ResumenCancion>
  /** Resolución de la apariencia con el catálogo vigente (para saber si cambia de tema). */
  resolver(cancion: Cancion): { procedencia: string; temaId: string | null }
}

/** Subconjunto de `ServicioSesion`. */
export interface SesionLotes {
  edicionBloqueada(): boolean
  cancionActiva(cancionId: string): boolean
  estadoPrincipal(): EstadoSesionIpc
  agregar(cancionId: string, donde: 'final'): Promise<{ entradaId: string }>
  quitar(entradaId: string): Promise<{ estado: EstadoSesionIpc; antesDe: string | null }>
}

export interface DependenciasLotes {
  biblioteca: BibliotecaLotes
  /** Mueve la canción a la papelera cancelando antes sus trabajos (la de `biblioteca.eliminar`). */
  eliminar(id: string): Promise<void>
  /** Sin sesión (pruebas o arranque), las comprobaciones de la sesión no aplican. */
  sesion?: SesionLotes
  /** Trabajos vivos de la canción que se cancelarían al eliminarla (descarga, separación, preparación, exportación…). */
  trabajosDe?(cancionId: string): number
  /** Una exportación en curso o en cola de la canción (no se pone en la cola ni se duplica). */
  exportandoCancion?(cancionId: string): boolean
  emitirProgreso(progreso: ProgresoLoteIpc): void
  /** Detalle de un fallo por canción, para el registro de la app. */
  registrar?(mensaje: string): void
}

export interface DatosVarias {
  artista?: string | undefined
  /** `null` vacía el álbum; `undefined` no lo toca. */
  album?: string | null | undefined
}

export type ResultadoColaVarias = {
  entradaIds: string[]
  omitidas: { id: string; motivo: string }[]
}

const hash = (x: unknown): string => createHash('sha1').update(JSON.stringify(x)).digest('hex')

/** Lo que identifica el estado de una canción para la `version` (sin el progreso, que cambia solo). */
const huellaDe = (r: ResumenCancion | null): unknown =>
  r === null
    ? null
    : [
        r.estado,
        r.danada,
        r.titulo,
        r.artista,
        r.album,
        r.pasos ? Object.values(r.pasos).map((p) => p.estado) : null
      ]

const codigoDe = (e: unknown): { codigo: CodigoError; mensaje: string } => {
  const codigo = (e as { codigo?: unknown } | null)?.codigo
  const mensaje = e instanceof Error ? e.message : String(e)
  return { codigo: typeof codigo === 'string' ? (codigo as CodigoError) : 'ERROR_INTERNO', mensaje }
}

export class ServicioLotes {
  private enCurso = false

  constructor(private readonly deps: DependenciasLotes) {}

  // --- Editar datos ------------------------------------------------------------------------------

  previsualizarDatos(ids: readonly string[], datos: DatosVarias): PrevisualizacionVariasIpc {
    const { biblioteca, sesion } = this.deps
    const canciones = ids.map((id) => {
      const c = biblioteca.obtener(id)
      const resumen = biblioteca.obtenerResumen(id)
      const base = { id, trabajos: 0, entradasCola: 0, cambiaTema: false }
      if (!c || !resumen || resumen.danada) {
        return { ...base, aplica: false, motivo: 'CANCION_NO_DISPONIBLE' }
      }
      // La canción que suena no cambia mientras suena (ADR 0017 §9).
      if (sesion?.edicionBloqueada() && sesion.cancionActiva(id)) {
        return { ...base, aplica: false, motivo: 'EDICION_BLOQUEADA' }
      }
      const nuevos = this.metadatosNuevos(c, datos)
      if (!nuevos) return { ...base, aplica: false, motivo: 'NADA_QUE_HACER' }
      const antes = biblioteca.resolver(c)
      const despues = biblioteca.resolver({ ...c, metadatos: { ...c.metadatos, ...nuevos } })
      const cambiaTema =
        antes.temaId !== despues.temaId || antes.procedencia !== despues.procedencia
      return { ...base, aplica: true, cambiaTema }
    })
    return { version: this.version('datos', canciones, ids, datos), canciones }
  }

  async ejecutarDatos(
    ids: readonly string[],
    datos: DatosVarias,
    version: string
  ): Promise<ResultadoVariasIpc> {
    return this.correr(
      ids,
      version,
      () => this.previsualizarDatos(ids, datos),
      async (id) => {
        const c = this.deps.biblioteca.obtener(id)
        const nuevos = c ? this.metadatosNuevos(c, datos) : null
        if (!c || !nuevos) return 'omitida'
        // Como en `ejecutarEliminar`: una canción que empezó a sonar a mitad del lote no se edita.
        if (this.deps.sesion?.edicionBloqueada() && this.deps.sesion.cancionActiva(id)) {
          return { omitida: 'EDICION_BLOQUEADA' }
        }
        // Lo que el usuario cambia pasa a ser suyo y nada lo sustituye solo (ADR 0025 §6).
        const origen = origenTrasEdicion(c.metadatos, { ...c.metadatos, ...nuevos })
        await this.deps.biblioteca.actualizar(id, {
          metadatos: { ...nuevos, ...(origen ? { origen } : {}) }
        })
        return 'hecho'
      }
    )
  }

  /** Los campos que de verdad cambiarían; `null` si ninguno. */
  private metadatosNuevos(c: Cancion, datos: DatosVarias): Partial<Cancion['metadatos']> | null {
    const nuevos: Partial<Cancion['metadatos']> = {}
    if (datos.artista !== undefined) {
      const artista = datos.artista.trim()
      if (artista !== c.metadatos.artista.trim()) nuevos.artista = artista
    }
    if (datos.album !== undefined) {
      const album = datos.album === null ? null : datos.album.trim() || null
      if ((album ?? '') !== (c.metadatos.album ?? '').trim()) nuevos.album = album
    }
    return Object.keys(nuevos).length > 0 ? nuevos : null
  }

  // --- Eliminar ----------------------------------------------------------------------------------

  previsualizarEliminar(ids: readonly string[]): PrevisualizacionVariasIpc {
    const { biblioteca, sesion } = this.deps
    const pendientes = sesion?.estadoPrincipal().pendientes ?? []
    const canciones = ids.map((id) => {
      const resumen = biblioteca.obtenerResumen(id)
      if (!resumen) {
        return {
          id,
          aplica: false,
          motivo: 'CANCION_NO_DISPONIBLE',
          trabajos: 0,
          entradasCola: 0,
          cambiaTema: false
        }
      }
      const entradasCola = pendientes.filter((p) => p.cancionId === id).length
      if (sesion?.cancionActiva(id)) {
        return {
          id,
          aplica: false,
          motivo: 'CANCION_EN_REPRODUCCION',
          trabajos: 0,
          entradasCola,
          cambiaTema: false
        }
      }
      return {
        id,
        aplica: true,
        trabajos: this.deps.trabajosDe?.(id) ?? 0,
        entradasCola,
        cambiaTema: false
      }
    })
    return { version: this.version('eliminar', canciones, ids), canciones }
  }

  async ejecutarEliminar(ids: readonly string[], version: string): Promise<ResultadoVariasIpc> {
    return this.correr(
      ids,
      version,
      () => this.previsualizarEliminar(ids),
      async (id) => {
        // La que suena en la otra pantalla no se elimina, aunque cambie entre la vista previa y ahora.
        if (this.deps.sesion?.cancionActiva(id)) {
          throw new ErrorLotes('CANCION_EN_REPRODUCCION', 'La canción está en reproducción.')
        }
        // Cancela trabajos, preparación y exportación (con limpieza) y la quita de la cola de la sesión.
        await this.deps.eliminar(id)
        return 'hecho'
      }
    )
  }

  // --- A la cola ---------------------------------------------------------------------------------

  /**
   * Una a una, al final y en el orden dado. Solo las Listas (también incompletas); `COLA_LLENA` corta el
   * resto con ese motivo. Sin diálogo, así que no hay `version`.
   */
  async agregarACola(ids: readonly string[]): Promise<ResultadoColaVarias> {
    const { biblioteca, sesion } = this.deps
    if (!sesion) throw new ErrorLotes('ERROR_INTERNO', 'El servicio de sesión no está disponible.')
    const entradaIds: string[] = []
    const omitidas: ResultadoColaVarias['omitidas'] = []
    let llena = false
    for (const id of ids) {
      if (llena) {
        omitidas.push({ id, motivo: 'COLA_LLENA' })
        continue
      }
      const r = biblioteca.obtenerResumen(id)
      if (!r || r.danada || r.estado !== 'lista') {
        omitidas.push({ id, motivo: 'CANCION_NO_DISPONIBLE' })
        continue
      }
      try {
        entradaIds.push((await sesion.agregar(id, 'final')).entradaId)
      } catch (e) {
        const { codigo } = codigoDe(e)
        if (codigo === 'COLA_LLENA') llena = true
        omitidas.push({ id, motivo: codigo })
      }
    }
    return { entradaIds, omitidas }
  }

  /**
   * Deshace `agregarACola`: quita solo las entradas que aún están pendientes (las ya consumidas o
   * quitadas a mano se ignoran). La respuesta es la de `cola.quitar` con la última quitada.
   */
  async quitarDeCola(
    entradaIds: readonly string[]
  ): Promise<{ estado: EstadoSesionIpc; antesDe: string | null }> {
    const { sesion } = this.deps
    if (!sesion) throw new ErrorLotes('ERROR_INTERNO', 'El servicio de sesión no está disponible.')
    let ultima: { estado: EstadoSesionIpc; antesDe: string | null } | null = null
    for (const entradaId of entradaIds) {
      try {
        ultima = await sesion.quitar(entradaId)
      } catch (e) {
        if (codigoDe(e).codigo !== 'ENTRADA_NO_ENCONTRADA') throw e
      }
    }
    if (ultima) return ultima
    // Nada que quitar: se devuelve el estado como está.
    return { estado: sesion.estadoPrincipal(), antesDe: null }
  }

  // --- Común -------------------------------------------------------------------------------------

  /** Huella de la selección: cambia si cambia el estado de una canción o lo que arrastra la acción. */
  private version(
    accion: string,
    canciones: PrevisualizacionVariasIpc['canciones'],
    ids: readonly string[],
    datos?: DatosVarias
  ): string {
    return hash([
      accion,
      datos ?? null,
      canciones.map((c, i) => [c, huellaDe(this.deps.biblioteca.obtenerResumen(ids[i] as string))])
    ])
  }

  private async correr(
    ids: readonly string[],
    version: string,
    previsualizar: () => PrevisualizacionVariasIpc,
    hacer: (id: string) => Promise<'hecho' | 'omitida' | { omitida: string }>
  ): Promise<ResultadoVariasIpc> {
    if (this.enCurso) throw new ErrorLotes('EN_CURSO', 'Ya hay una acción por lotes en marcha.')
    this.enCurso = true
    try {
      const ahora = previsualizar()
      if (ahora.version !== version) {
        throw new ErrorLotes(
          'CONFIRMACION_OBSOLETA',
          'La selección cambió desde que la viste.',
          ahora
        )
      }
      const resultados: ResultadoVariasIpc['resultados'] = []
      this.deps.emitirProgreso({ hechas: 0, total: ids.length })
      for (const [i, plan] of ahora.canciones.entries()) {
        if (!plan.aplica) {
          resultados.push({
            id: plan.id,
            resultado: 'omitida',
            motivo: plan.motivo ?? 'NADA_QUE_HACER'
          })
        } else {
          try {
            const r = await hacer(plan.id)
            resultados.push(
              typeof r === 'string'
                ? { id: plan.id, resultado: r }
                : { id: plan.id, resultado: 'omitida', motivo: r.omitida }
            )
          } catch (e) {
            const { codigo, mensaje } = codigoDe(e)
            resultados.push({ id: plan.id, resultado: 'error', motivo: codigo })
            this.deps.registrar?.(`lote: ${plan.id}: ${mensaje}`)
          }
        }
        this.deps.emitirProgreso({ hechas: i + 1, total: ids.length })
      }
      return { resultados }
    } finally {
      this.enCurso = false
    }
  }
}
