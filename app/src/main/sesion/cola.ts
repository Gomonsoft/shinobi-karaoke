import type { CodigoError } from '../../shared/errores'
import { MAXIMO_PENDIENTES, type EntradaIpc, type MotivoNoDisponible } from '../../shared/sesion'

/**
 * Modelo puro de la cola de reproducción (ADR 0017 §5 y §6). Sin Electron, sin disco y sin reloj.
 * Las operaciones no mutan: devuelven otra cola, o **la misma referencia** si no cambia nada
 * (así la máquina sabe que no hay que subir la revisión).
 */

/** Error de una operación de cola, con código estable. */
export class ErrorCola extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string
  ) {
    super(mensaje)
    this.name = 'ErrorCola'
  }
}

/** Última reproducida (spec 02): reanudable si no está terminada. */
export interface ContextoCola {
  entrada: EntradaIpc
  posicionMs: number | null
  pausada: boolean
  terminada: boolean
}

export interface EstadoCola {
  /** La entrada que suena, o la fallida. */
  activa: EntradaIpc | null
  /** En orden de reproducción. */
  pendientes: readonly EntradaIpc[]
  contexto: ContextoCola | null
}

export interface DatosEntrada {
  cancionId: string
  titulo: string
  artista: string
}

export type DondeCola = 'siguiente' | 'final' | { antesDe: string | null; siRevision: number }

export interface OpcionesAgregar {
  /** Genera el id de la entrada (inyectado: UUID en producción). */
  nuevoId: () => string
  /** Revisión vigente, para validar `siRevision`. */
  revision: number
}

export function colaVacia(): EstadoCola {
  return { activa: null, pendientes: [], contexto: null }
}

/** La primera pendiente, aunque se sepa no disponible (la máquina decide qué hacer). */
export function candidata(cola: EstadoCola): EntradaIpc | null {
  return cola.pendientes[0] ?? null
}

export function agregar(
  cola: EstadoCola,
  datos: DatosEntrada,
  donde: DondeCola,
  opciones: OpcionesAgregar
): { cola: EstadoCola; entrada: EntradaIpc } {
  if (cola.pendientes.length >= MAXIMO_PENDIENTES) {
    throw new ErrorCola('COLA_LLENA', 'La cola está llena.')
  }
  const entrada: EntradaIpc = {
    entradaId: opciones.nuevoId(),
    cancionId: datos.cancionId,
    titulo: datos.titulo,
    artista: datos.artista,
    disponibilidad: 'ok'
  }
  let indice = cola.pendientes.length
  if (donde === 'siguiente') {
    indice = 0
  } else if (typeof donde === 'object' && donde.siRevision === opciones.revision) {
    const destino =
      donde.antesDe === null ? -1 : cola.pendientes.findIndex((p) => p.entradaId === donde.antesDe)
    if (destino >= 0) indice = destino
  }
  const pendientes = [
    ...cola.pendientes.slice(0, indice),
    entrada,
    ...cola.pendientes.slice(indice)
  ]
  return { cola: { ...cola, pendientes }, entrada }
}

/** Coloca la entrada delante de `antesDe`, o al final con `null`. Mover a su sitio no cambia nada. */
export function mover(
  cola: EstadoCola,
  args: { entradaId: string; antesDe: string | null }
): EstadoCola {
  const { entradaId, antesDe } = args
  const origen = cola.pendientes.find((p) => p.entradaId === entradaId)
  if (!origen) throw new ErrorCola('ENTRADA_NO_ENCONTRADA', 'La entrada no está en la cola.')
  if (antesDe !== null && !cola.pendientes.some((p) => p.entradaId === antesDe)) {
    throw new ErrorCola('ENTRADA_NO_ENCONTRADA', 'La entrada de referencia no está en la cola.')
  }
  const resto = cola.pendientes.filter((p) => p.entradaId !== entradaId)
  const destino = antesDe === null ? resto.length : resto.findIndex((p) => p.entradaId === antesDe)
  const pendientes =
    antesDe === entradaId
      ? [...cola.pendientes]
      : [...resto.slice(0, destino), origen, ...resto.slice(destino)]
  const igual = pendientes.every((p, i) => p === cola.pendientes[i])
  return igual ? cola : { ...cola, pendientes }
}

/**
 * Quita una pendiente (o la activa; la máquina solo lo permite con la activa fallida).
 * `antesDe` es la entrada que la seguía, para «Deshacer».
 */
export function quitar(
  cola: EstadoCola,
  entradaId: string
): { cola: EstadoCola; antesDe: string | null } {
  const indice = cola.pendientes.findIndex((p) => p.entradaId === entradaId)
  if (indice >= 0) {
    return {
      cola: { ...cola, pendientes: cola.pendientes.filter((_, i) => i !== indice) },
      antesDe: cola.pendientes[indice + 1]?.entradaId ?? null
    }
  }
  if (cola.activa?.entradaId === entradaId) {
    return { cola: { ...cola, activa: null }, antesDe: null }
  }
  throw new ErrorCola('ENTRADA_NO_ENCONTRADA', 'La entrada no está en la cola.')
}

/** Quita las pendientes y, con `contexto`, también la última reproducida. */
export function vaciar(cola: EstadoCola, args: { contexto: boolean }): EstadoCola {
  const quitarContexto = args.contexto && cola.contexto !== null
  if (cola.pendientes.length === 0 && !quitarContexto) return cola
  return { ...cola, pendientes: [], contexto: args.contexto ? null : cola.contexto }
}

/** Marca la disponibilidad de las pendientes de una canción (`ok` la restablece). */
export function marcarDisponibilidad(
  cola: EstadoCola,
  cancionId: string,
  motivo: MotivoNoDisponible | 'ok'
): EstadoCola {
  if (!cola.pendientes.some((p) => p.cancionId === cancionId && p.disponibilidad !== motivo)) {
    return cola
  }
  return {
    ...cola,
    pendientes: cola.pendientes.map((p) =>
      p.cancionId === cancionId ? { ...p, disponibilidad: motivo } : p
    )
  }
}

/** La canción se eliminó: fuera sus pendientes y, si era la última reproducida, el contexto. */
export function quitarCancion(cola: EstadoCola, cancionId: string): EstadoCola {
  const hay = cola.pendientes.some((p) => p.cancionId === cancionId)
  const contextoAfectado = cola.contexto?.entrada.cancionId === cancionId
  if (!hay && !contextoAfectado) return cola
  return {
    ...cola,
    pendientes: cola.pendientes.filter((p) => p.cancionId !== cancionId),
    contexto: contextoAfectado ? null : cola.contexto
  }
}

/** Títulos vivos: actualiza activa, pendientes y contexto de esa canción. */
export function actualizarTitulos(
  cola: EstadoCola,
  cancionId: string,
  titulo: string,
  artista: string
): EstadoCola {
  const cambia = (e: EntradaIpc): boolean =>
    e.cancionId === cancionId && (e.titulo !== titulo || e.artista !== artista)
  const poner = (e: EntradaIpc): EntradaIpc => (cambia(e) ? { ...e, titulo, artista } : e)
  const activa = cola.activa
  const contexto = cola.contexto
  if (
    !cola.pendientes.some(cambia) &&
    !(activa && cambia(activa)) &&
    !(contexto && cambia(contexto.entrada))
  ) {
    return cola
  }
  return {
    activa: activa ? poner(activa) : null,
    pendientes: cola.pendientes.map(poner),
    contexto: contexto ? { ...contexto, entrada: poner(contexto.entrada) } : null
  }
}
