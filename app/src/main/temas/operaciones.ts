import {
  crearIndiceCatalogo,
  esCodigoError,
  estiloTemaSchema,
  resolverApariencia,
  type Apariencia,
  type Cancion,
  type Catalogo,
  type CodigoError,
  type IndiceCatalogo,
  type OrigenAparienciaIpc,
  type ProgresoTemaIpc,
  type ResultadoOperacionIpc
} from '../../shared'
import type { RegistroApp } from '../registro'
import { ErrorTemas } from './errores'
import {
  aparienciaAplicada,
  catalogoConAsignacion,
  esLegible,
  type CancionLegible,
  origenDe,
  resolverCancion,
  yaTieneSeleccion,
  type Afectada,
  type ImpactoCalculado,
  type OperacionDe
} from './impacto'
import type { PuertoCanciones } from './servicio'

const MODULO = 'temas'

/** Separación mínima entre eventos `temas:progreso` (el último siempre sale). */
export const INTERVALO_PROGRESO_MS = 100

/** Lo que las operaciones necesitan del servicio; todas se ejecutan dentro de su cola. */
export interface ContextoOperaciones {
  /** Catálogo vigente (cambia tras cada `confirmarCatalogo`). */
  catalogo(): Catalogo
  puerto: PuertoCanciones
  ahora(): string
  /** Reloj en milisegundos, para limitar el progreso. */
  reloj(): number
  /** Escribe el catálogo y solo entonces lo adopta y emite `temas:cambiado`. */
  confirmarCatalogo(nuevo: Catalogo): Promise<void>
  emitirProgreso(progreso: ProgresoTemaIpc): void
  /** Reemite `temas:cambiado` agrupado (cambió el índice de canciones). */
  indiceCambiado(): void
  registro: RegistroApp
}

/** Entrada del resultado, con `titulo` y `artista` del resumen (ADR 0016 rev. 3; tipo IPC en 0164). */
export type EstadoCancion = ResultadoOperacionIpc['canciones'][number] & {
  titulo: string
  artista: string
}

/** Resultado de una operación: el contrato IPC (0164). */
export type ResultadoTemas = ResultadoOperacionIpc

/** Código de error estable de una excepción de escritura de canción (sin rutas). */
export function codigoDe(e: unknown): CodigoError {
  const codigo = (e as { codigo?: unknown } | null)?.codigo
  return esCodigoError(codigo) ? codigo : 'ERROR_INTERNO'
}

/** Emisor de `temas:progreso`: tras cada canción, como mucho cada 100 ms y siempre al terminar. */
export class Avance {
  private hechas = 0
  private ultimoEmitido = -1
  private ultimaHora = Number.NEGATIVE_INFINITY

  constructor(
    private readonly ctx: ContextoOperaciones,
    private readonly base: Pick<ProgresoTemaIpc, 'ficha' | 'operacion' | 'temaId'>,
    private readonly total: number
  ) {}

  /** Una canción más procesada. */
  paso(): void {
    this.hechas++
    const ahora = this.ctx.reloj()
    if (this.hechas === this.total || ahora - this.ultimaHora >= INTERVALO_PROGRESO_MS) {
      this.emitir(ahora)
    }
  }

  /** Cierre: garantiza que el último avance salió. */
  fin(): void {
    if (this.hechas > 0 && this.ultimoEmitido !== this.hechas) this.emitir(this.ctx.reloj())
  }

  private emitir(ahora: number): void {
    this.ultimaHora = ahora
    this.ultimoEmitido = this.hechas
    this.ctx.emitirProgreso({ ...this.base, hechas: this.hechas, total: this.total })
  }
}

/** Escribe una canción por el puerto. Devuelve el código del error, o `null` si se escribió. */
export async function escribirCancion(
  ctx: ContextoOperaciones,
  id: string,
  mutador: (cancion: Cancion) => Cancion
): Promise<CodigoError | null> {
  try {
    await ctx.puerto.actualizar(id, mutador)
    return null
  } catch (e) {
    ctx.registro.escribir('error', MODULO, `no se pudo escribir la canción ${id}: ${String(e)}`)
    return codigoDe(e)
  }
}

/**
 * Refresca la instantánea de respaldo (`estilo` y `tema_nombre`) de una canción con apariencia
 * `tema` o `heredar`, con la resolución del catálogo vigente. Una canción `propio` queda igual.
 */
export function refrescarInstantanea(cancion: Cancion, indice: IndiceCatalogo): Cancion {
  if (!cancion.apariencia || cancion.apariencia.modo === 'propio') return cancion
  const r = resolverApariencia(cancion, indice)
  const apariencia: Apariencia = { ...cancion.apariencia }
  if (r.temaNombre !== null) apariencia.tema_nombre = r.temaNombre
  else delete apariencia.tema_nombre
  return { ...cancion, estilo: structuredClone(r.estilo), apariencia }
}

const vacio = (catalogoEscrito: boolean): ResultadoTemas => ({
  catalogoEscrito,
  canciones: []
})

// ---------------------------------------------------------------- editar

export async function ejecutarEditar(
  ctx: ContextoOperaciones,
  op: OperacionDe<'editar'>
): Promise<ResultadoTemas> {
  const c = ctx.catalogo()
  const estilo = estiloTemaSchema.safeParse(op.estilo)
  if (!estilo.success) {
    throw new ErrorTemas('ARGUMENTOS_NO_VALIDOS', 'El estilo del tema no es válido')
  }
  const ahora = ctx.ahora()
  await ctx.confirmarCatalogo({
    ...c,
    temas: c.temas.map((t) =>
      t.id === op.temaId
        ? {
            ...t,
            estilo: structuredClone(estilo.data),
            revision: t.revision + 1,
            modificado: ahora
          }
        : t
    )
  })
  return vacio(true)
}

// ---------------------------------------------------------------- asignarGrupo y predeterminado (a un tema)

export async function ejecutarGrupo(
  ctx: ContextoOperaciones,
  op: OperacionDe<'asignarGrupo'>
): Promise<ResultadoTemas> {
  const c = ctx.catalogo()
  const nuevo = catalogoConAsignacion(c, op)
  if (JSON.stringify(nuevo.asignaciones) === JSON.stringify(c.asignaciones)) return vacio(false)
  await ctx.confirmarCatalogo(nuevo)
  return vacio(true)
}

/** `predeterminado` hacia un tema (A1): una sola escritura del catálogo. */
export async function ejecutarPredeterminadoATema(
  ctx: ContextoOperaciones,
  temaId: string
): Promise<ResultadoTemas> {
  const c = ctx.catalogo()
  if (c.predeterminado === temaId) return vacio(false)
  await ctx.confirmarCatalogo({ ...c, predeterminado: temaId })
  return vacio(true)
}

// ---------------------------------------------------------------- predeterminado a null (B1)

/**
 * Quita el predeterminado X sin cambiar el aspecto de nadie (§6, B1): fija `predeterminado_anterior` X
 * en cada afectada, una a una, y después escribe el catálogo. Se detiene en el primer fallo, sin
 * escribir el catálogo: mientras X siga siendo el predeterminado, esas canciones resuelven igual.
 */
export async function ejecutarQuitarPredeterminado(
  ctx: ContextoOperaciones,
  ficha: string,
  afectadas: readonly Afectada[]
): Promise<ResultadoTemas> {
  const c = ctx.catalogo()
  const x = c.predeterminado
  if (x === null || afectadas.length === 0) {
    if (x !== null) await ctx.confirmarCatalogo({ ...c, predeterminado: null })
    return vacio(x !== null)
  }
  const indice = crearIndiceCatalogo(c)
  const canciones: EstadoCancion[] = afectadas.map((a) => ({
    id: a.id,
    titulo: a.titulo,
    artista: a.artista,
    estado: 'pendiente'
  }))
  const avance = new Avance(
    ctx,
    { ficha, operacion: 'predeterminado', temaId: x },
    afectadas.length
  )
  for (let i = 0; i < afectadas.length; i++) {
    const { id, titulo, artista } = canciones[i]!
    const codigo = await escribirCancion(ctx, id, (cancion) =>
      refrescarInstantanea(
        {
          ...cancion,
          apariencia: {
            ...(cancion.apariencia ?? { modo: 'heredar' }),
            base: { tipo: 'predeterminado_anterior', tema_id: x }
          }
        },
        indice
      )
    )
    if (codigo !== null) {
      canciones[i] = { id, titulo, artista, estado: 'error', codigo }
      avance.fin()
      ctx.indiceCambiado()
      return { catalogoEscrito: false, canciones }
    }
    canciones[i] = { id, titulo, artista, estado: 'aplicada' }
    avance.paso()
  }
  avance.fin()
  try {
    await ctx.confirmarCatalogo({ ...ctx.catalogo(), predeterminado: null })
  } catch (e) {
    ctx.registro.escribir('error', MODULO, `no se pudo escribir el catálogo: ${String(e)}`)
    ctx.indiceCambiado()
    return { catalogoEscrito: false, canciones }
  }
  return { catalogoEscrito: true, canciones }
}

// ---------------------------------------------------------------- aplicar (lote)

/** ¿Ya no se resuelve como cuando el usuario confirmó? */
function hayCambio(
  c: CancionLegible,
  indice: IndiceCatalogo,
  confirmado: OrigenAparienciaIpc | undefined
): boolean {
  const antes = origenDe(resolverCancion(c, indice))
  return (
    !confirmado ||
    antes.procedencia !== confirmado.procedencia ||
    antes.temaId !== confirmado.temaId
  )
}

/**
 * Aplica un tema (o «heredar») a las canciones indicadas, una a una y en el orden recibido. Las
 * canciones cuyo `antes` ya no coincide con lo confirmado quedan `omitida` (`cambio`); un error en una
 * no detiene las demás. Nunca devuelve `pendiente`.
 */
export async function ejecutarAplicar(
  ctx: ContextoOperaciones,
  ficha: string,
  op: OperacionDe<'aplicar'>,
  confirmado: ImpactoCalculado
): Promise<ResultadoTemas> {
  const c = ctx.catalogo()
  const indice = crearIndiceCatalogo(c)
  const porId = new Map(ctx.puerto.indice().map((x) => [x.id, x]))
  const confirmadas = new Map(confirmado.afectadas.map((a) => [a.id, a]))
  const antesConfirmado = new Map(confirmado.afectadas.map((a) => [a.id, a.antes]))
  const canciones: EstadoCancion[] = []
  const escribir: number[] = []
  for (const id of op.cancionIds) {
    const x = porId.get(id)
    const confirmada = confirmadas.get(id)
    const conf = confirmada?.antes
    const rotulo = {
      titulo: x?.metadatos.titulo ?? confirmada?.titulo ?? '',
      artista: x?.metadatos.artista ?? confirmada?.artista ?? ''
    }
    if (!x) {
      canciones.push({ id, ...rotulo, estado: 'omitida', motivo: 'no_existe' })
    } else if (!esLegible(x)) {
      canciones.push({ id, ...rotulo, estado: 'omitida', motivo: 'danada' })
    } else {
      if (hayCambio(x, indice, conf)) {
        canciones.push({ id, ...rotulo, estado: 'omitida', motivo: 'cambio' })
      } else if (yaTieneSeleccion(x, op.seleccion)) {
        canciones.push({ id, ...rotulo, estado: 'sin_cambios' })
      } else {
        escribir.push(canciones.length)
        canciones.push({ id, ...rotulo, estado: 'pendiente' })
      }
    }
  }
  const temaId = op.seleccion.modo === 'tema' ? op.seleccion.temaId : null
  const avance = new Avance(ctx, { ficha, operacion: 'aplicar', temaId }, escribir.length)
  let escritas = 0
  for (const i of escribir) {
    const { id, titulo, artista } = canciones[i]!
    // Otra operación pudo tocar la canción desde que se decidió: se vuelve a comprobar justo antes.
    const ahora = ctx.puerto.indice().find((x) => x.id === id)
    const motivo = !ahora
      ? 'no_existe'
      : !esLegible(ahora)
        ? 'danada'
        : hayCambio(ahora, indice, antesConfirmado.get(id))
          ? 'cambio'
          : null
    if (motivo) {
      canciones[i] = { id, titulo, artista, estado: 'omitida', motivo }
      avance.paso()
      continue
    }
    const codigo = await escribirCancion(ctx, id, (cancion) =>
      refrescarInstantanea(
        { ...cancion, apariencia: aparienciaAplicada(cancion.apariencia, op.seleccion) },
        indice
      )
    )
    if (codigo === null) {
      canciones[i] = { id, titulo, artista, estado: 'aplicada' }
      escritas++
    } else {
      canciones[i] = { id, titulo, artista, estado: 'error', codigo }
    }
    avance.paso()
  }
  avance.fin()
  if (escritas > 0) ctx.indiceCambiado()
  return { catalogoEscrito: false, canciones }
}
