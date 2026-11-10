import {
  crearIndiceCatalogo,
  resolverApariencia,
  type Apariencia,
  type Cancion,
  type Catalogo
} from '../../shared'
import { esLegible, resolverCancion, type ImpactoCalculado } from './impacto'
import {
  Avance,
  escribirCancion,
  refrescarInstantanea,
  type ContextoOperaciones,
  type EstadoCancion,
  type ResultadoTemas
} from './operaciones'
import { pasoBorrado, type CancionIndice, type PasoBorrado } from './usos'

const MODULO = 'temas'
const colador = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

export interface PasoPlan {
  id: string
  paso: PasoBorrado
  titulo: string
  artista: string
}

/**
 * Canciones que hay que escribir ahora para borrar el tema, en orden de título. Se recalcula siempre
 * (también al reanudar): el diario solo sirve para el informe.
 */
export function planBorrado(
  catalogo: Catalogo,
  canciones: readonly CancionIndice[],
  temaId: string
): PasoPlan[] {
  const indice = crearIndiceCatalogo(catalogo)
  const plan: PasoPlan[] = []
  for (const c of canciones) {
    if (!esLegible(c)) continue
    const paso = pasoBorrado(resolverCancion(c, indice), c.apariencia, temaId)
    if (paso) {
      plan.push({
        id: c.id,
        paso,
        titulo: c.metadatos.titulo ?? '',
        artista: c.metadatos.artista ?? ''
      })
    }
  }
  plan.sort((a, b) => colador.compare(a.titulo, b.titulo) || a.id.localeCompare(b.id))
  return plan
}

const sinBase = (apariencia: Apariencia | undefined): Apariencia | undefined => {
  if (!apariencia) return apariencia
  const resto = { ...apariencia }
  delete resto.base
  return resto
}

/** Paso 2: escribe el diario. Si falla, no ha cambiado nada y el error sube al llamador. */
export async function iniciarBorrado(
  ctx: ContextoOperaciones,
  temaId: string,
  impacto: ImpactoCalculado
): Promise<void> {
  const c = ctx.catalogo()
  await ctx.confirmarCatalogo({
    ...c,
    borrado_pendiente: {
      tema_id: temaId,
      iniciado: ctx.ahora(),
      canciones: impacto.afectadas.map((a) => a.id)
    }
  })
}

/**
 * Pasos 3 y 4: congela cada canción que resuelve al tema, quita las bases que apuntan a él y retira el
 * tema. Idempotente; se detiene en el primer fallo y deja el tema en borrado. `ficha` es `null` al
 * reanudar.
 */
export async function continuarBorrado(
  ctx: ContextoOperaciones,
  temaId: string,
  ficha: string | null
): Promise<ResultadoTemas> {
  const catalogo = ctx.catalogo()
  const indice = crearIndiceCatalogo(catalogo)
  const plan = planBorrado(catalogo, ctx.puerto.indice(), temaId)
  const canciones: EstadoCancion[] = plan.map((p) => ({
    id: p.id,
    titulo: p.titulo,
    artista: p.artista,
    estado: 'pendiente'
  }))
  const avance = new Avance(ctx, { ficha, operacion: 'borrar', temaId }, plan.length)
  for (let i = 0; i < plan.length; i++) {
    const { id, paso, titulo, artista } = plan[i]!
    const mutador =
      paso === 'congelar'
        ? (cancion: Cancion): Cancion => ({
            ...cancion,
            estilo: structuredClone(resolverApariencia(cancion, indice).estilo),
            apariencia: { modo: 'propio' }
          })
        : (cancion: Cancion): Cancion => {
            const apariencia = sinBase(cancion.apariencia)
            return refrescarInstantanea(apariencia ? { ...cancion, apariencia } : cancion, indice)
          }
    const codigo = await escribirCancion(ctx, id, mutador)
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
  const c = ctx.catalogo()
  try {
    await ctx.confirmarCatalogo(retirarTema(c, temaId))
  } catch (e) {
    ctx.registro.escribir('error', MODULO, `no se pudo retirar el tema: ${String(e)}`)
    ctx.indiceCambiado()
    return { catalogoEscrito: false, canciones }
  }
  return { catalogoEscrito: true, canciones }
}

/** Catálogo sin el tema, sin sus asignaciones, sin predeterminado si era él y sin diario. */
export function retirarTema(c: Catalogo, temaId: string): Catalogo {
  return {
    ...c,
    predeterminado: c.predeterminado === temaId ? null : c.predeterminado,
    temas: c.temas.filter((t) => t.id !== temaId),
    asignaciones: {
      artistas: c.asignaciones.artistas.filter((a) => a.tema_id !== temaId),
      albumes: c.asignaciones.albumes.filter((a) => a.tema_id !== temaId)
    },
    borrado_pendiente: null
  }
}

/** Quita el diario; las canciones ya convertidas siguen como propias. */
export async function cancelarDiario(ctx: ContextoOperaciones): Promise<void> {
  const c = ctx.catalogo()
  if (c.borrado_pendiente === null) return
  await ctx.confirmarCatalogo({ ...c, borrado_pendiente: null })
}
