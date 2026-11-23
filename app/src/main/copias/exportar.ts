import { open, rename, rm, stat, type FileHandle } from 'node:fs/promises'
import { join } from 'node:path'
import { VERSION_ESQUEMA_CANCION, type Cancion } from '../../shared'
import type { ResultadoExportacionCopiaIpc } from '../../shared/ipc'
import { ajustesDeConfig } from './ajustes'
import type { Avance, PuertosCopias } from './contexto'
import {
  ENTRADA_AJUSTES,
  ENTRADA_MANIFIESTO,
  ENTRADA_TEMAS,
  ErrorPaquete,
  VERSION_FORMATO,
  rutaEnPaquete,
  type ArchivoCancion,
  type ArchivoManifiesto,
  type CancionManifiesto,
  type Manifiesto
} from './formato'
import { catalogoParaPaquete } from './temas'
import { ErrorCancelado, EscritorZip } from './zip'

/** Escribir un paquete de canciones o una copia de seguridad (ADR 0027 §1 y §2). */

export interface PeticionExportar {
  tipo: 'cancion' | 'copia'
  /** `null`: toda la biblioteca. */
  ids: readonly string[] | null
  conAudio: boolean
  /** Solo en una copia: incluir `ajustes.json`. */
  ajustes: boolean
  /** Ruta final y temporal (junto a ella). */
  destino: string
  temporal: string
  libreBytes: number | null
}

export type ResultadoExportar = ResultadoExportacionCopiaIpc & {
  /** Para `config.copias.ultima` (solo una copia de la biblioteca). */
  conAudio: boolean
}

interface ArchivoPlan {
  nombre: ArchivoCancion
  ruta: string
  bytes: number
}
interface CancionPlan {
  /** Instantánea que se escribe (con los pasos en curso vueltos a pendientes). */
  cancion: Cancion
  /** Tenía un trabajo en curso: entra sin lo que ese trabajo estaba escribiendo. */
  enCurso: boolean
  json: Buffer
  archivos: ArchivoPlan[]
}

const existeArchivo = async (ruta: string): Promise<number | null> => {
  try {
    const s = await stat(ruta)
    return s.isFile() ? s.size : null
  } catch {
    return null
  }
}

/** Serialización de la instantánea de una canción: la misma que escribe la biblioteca. */
export const jsonDeCancion = (c: Cancion): Buffer =>
  Buffer.from(`${JSON.stringify(c, null, 2)}\n`, 'utf8')

/**
 * Instantánea de una canción con trabajos en curso: cada paso en curso vuelve a `pendiente` (al importarla,
 * ese trabajo no existe) y, si era la separación, entra sin pistas y como borrador.
 */
function instantaneaConTrabajos(c: Cancion): Cancion {
  const r = structuredClone(c)
  for (const paso of Object.values(r.pasos)) {
    if (paso.estado === 'en_curso') {
      paso.estado = 'pendiente'
      paso.actualizado = null
      paso.error = null
      delete paso.progreso
    }
  }
  if (c.pasos.separacion.estado === 'en_curso') {
    r.pistas = null
    r.estado = 'borrador'
    delete r.modalidad
  }
  if (r.preparacion?.estado === 'en_curso') delete r.preparacion
  return r
}

/**
 * Canciones que entran, con sus archivos presentes en disco, y las que se omiten (ilegibles). Una canción
 * con un trabajo **en curso** entra: `cancion.json` y solo los archivos de pasos **completados**, nunca uno
 * que se esté escribiendo (la que se separa entra sin pistas, con `pasos.separacion = pendiente`).
 */
export async function planificarCanciones(
  p: PuertosCopias,
  ids: readonly string[] | null,
  conAudio: boolean
): Promise<{ plan: CancionPlan[]; omitidas: { id: string; motivo: string }[] }> {
  const lista = ids ?? p.biblioteca.listar().map((r) => r.id)
  const plan: CancionPlan[] = []
  const omitidas: { id: string; motivo: string }[] = []
  for (const id of new Set(lista)) {
    const original = p.biblioteca.obtener(id)
    if (!original) {
      omitidas.push({ id, motivo: 'CANCION_NO_DISPONIBLE' })
      continue
    }
    const enCurso = Object.values(original.pasos).some((paso) => paso.estado === 'en_curso')
    let cancion = enCurso ? instantaneaConTrabajos(original) : original
    if (cancion.fuente.ruta_pendiente !== undefined) {
      // La ruta del archivo original de una canción de lote es del equipo: no viaja (ADR 0027, pregunta 0324).
      cancion = structuredClone(cancion)
      delete cancion.fuente.ruta_pendiente
    }
    const carpeta = join(p.dirBiblioteca, id)
    const fuenteLista = original.pasos.fuente.estado === 'completado'
    const pistasListas = original.pasos.separacion.estado === 'completado'
    const nombres: ArchivoCancion[] = [
      ...(conAudio && fuenteLista ? (['fuente/mezcla.flac'] as const) : []),
      ...(conAudio && pistasListas
        ? (['pistas/voz.flac', 'pistas/instrumental.flac'] as const)
        : []),
      ...(fuenteLista && original.fuente.miniatura ? (['fuente/miniatura.jpg'] as const) : [])
    ]
    const archivos: ArchivoPlan[] = []
    for (const nombre of nombres) {
      const ruta = join(carpeta, ...nombre.split('/'))
      const bytes = await existeArchivo(ruta)
      if (bytes !== null) archivos.push({ nombre, ruta, bytes })
    }
    plan.push({ cancion, enCurso, json: jsonDeCancion(cancion), archivos })
  }
  return { plan, omitidas }
}

/** Suma de lo que ocupará (archivos, JSON y ~1 % de cabeceras ZIP). */
export const bytesDelPlan = (plan: readonly CancionPlan[]): number => {
  const suma = plan.reduce(
    (t, c) => t + c.json.length + c.archivos.reduce((s, a) => s + a.bytes, 0),
    0
  )
  return Math.ceil(suma * 1.01) + 64 * 1024
}

const motivoDeFs = (e: unknown): ErrorPaquete | null => {
  const c = (e as NodeJS.ErrnoException | null)?.code
  if (c === 'ENOSPC' || c === 'EDQUOT') return new ErrorPaquete('SIN_ESPACIO', 'Disco lleno.')
  if (c && ['EACCES', 'EPERM', 'EROFS', 'ENOENT', 'ENOTDIR', 'EBUSY'].includes(c)) {
    return new ErrorPaquete('DESTINO_NO_DISPONIBLE', 'No se puede escribir en el destino.')
  }
  return null
}

/** Traduce un fallo de escritura al código estable (la cancelación y los códigos propios pasan tal cual). */
export function codigoDeExportacion(e: unknown): string {
  if (e instanceof ErrorCancelado) return 'CANCELADO'
  if (e instanceof ErrorPaquete) return e.codigo
  return (motivoDeFs(e) ?? new ErrorPaquete('ERROR_INTERNO', '')).codigo
}

export async function exportarPaquete(
  p: PuertosCopias,
  peticion: PeticionExportar,
  signal: AbortSignal,
  avance: Avance
): Promise<ResultadoExportar> {
  const { plan, omitidas } = await planificarCanciones(p, peticion.ids, peticion.conAudio)
  if (plan.length === 0) {
    throw new ErrorPaquete('NADA_QUE_HACER', 'Ninguna canción se puede guardar ahora.')
  }
  if (peticion.libreBytes !== null && peticion.libreBytes < bytesDelPlan(plan)) {
    throw new ErrorPaquete('SIN_ESPACIO', 'No cabe en el destino.')
  }

  avance.total(bytesDelPlan(plan))
  let escritor: EscritorZip | null = null
  let enMarcha = false
  try {
    let acumulado = 0
    escritor = new EscritorZip(peticion.temporal, signal, (n) => {
      acumulado += n
      avance.bytes(acumulado)
    })
    enMarcha = true
    const canciones: CancionManifiesto[] = []
    const escritas: Cancion[] = []
    for (const [i, c] of plan.entries()) {
      if (signal.aborted) throw new ErrorCancelado()
      avance.cancion(i, plan.length, c.cancion.metadatos.titulo)
      // Se abren todos los archivos antes de escribir ninguno: una pista borrada a mitad omite la canción
      // entera, no deja un paquete con la canción a medias.
      const abiertos: { plan: ArchivoPlan; archivo: FileHandle }[] = []
      try {
        for (const a of c.archivos) abiertos.push({ plan: a, archivo: await open(a.ruta, 'r') })
      } catch {
        await Promise.all(abiertos.map((x) => x.archivo.close().catch(() => undefined)))
        omitidas.push({ id: c.cancion.id, motivo: 'ARCHIVO_NO_ENCONTRADO' })
        continue
      }
      const id = c.cancion.id
      const archivos: ArchivoManifiesto[] = []
      try {
        const json = await escritor.anadirBuffer(rutaEnPaquete(id, 'cancion.json'), c.json)
        archivos.push({ ruta: rutaEnPaquete(id, 'cancion.json'), ...json })
        for (const { plan: a, archivo } of abiertos) {
          const hecho = await escritor.anadirArchivo(rutaEnPaquete(id, a.nombre), archivo)
          archivos.push({ ruta: rutaEnPaquete(id, a.nombre), ...hecho })
        }
      } finally {
        await Promise.all(abiertos.map((x) => x.archivo.close().catch(() => undefined)))
      }
      const m = c.cancion
      canciones.push({
        id,
        titulo: m.metadatos.titulo,
        artista: m.metadatos.artista,
        esquema_cancion: VERSION_ESQUEMA_CANCION,
        modificada: m.modificada,
        creada: m.creada,
        album: m.metadatos.album,
        duracion_ms: m.metadatos.duracion_ms,
        estado: m.estado,
        archivos
      })
      escritas.push(m)
    }
    avance.cancion(plan.length, plan.length, '')

    const extras: ArchivoManifiesto[] = []
    const catalogo = p.temas?.datos() ?? null
    const temasPaquete = catalogo
      ? peticion.tipo === 'copia'
        ? catalogo
        : catalogoParaPaquete(catalogo, escritas)
      : null
    if (temasPaquete && (peticion.tipo === 'copia' || temasPaquete.temas.length > 0)) {
      const e = await escritor.anadirBuffer(
        ENTRADA_TEMAS,
        Buffer.from(`${JSON.stringify(temasPaquete, null, 2)}\n`)
      )
      extras.push({ ruta: ENTRADA_TEMAS, ...e })
    }
    if (peticion.tipo === 'copia' && peticion.ajustes) {
      const e = await escritor.anadirBuffer(
        ENTRADA_AJUSTES,
        Buffer.from(`${JSON.stringify(ajustesDeConfig(p.config.obtener()), null, 2)}\n`)
      )
      extras.push({ ruta: ENTRADA_AJUSTES, ...e })
    }

    const manifiesto: Manifiesto = {
      formato: 'shinobi',
      version_formato: VERSION_FORMATO,
      tipo: peticion.tipo,
      creado: (p.ahora?.() ?? new Date()).toISOString(),
      app: p.version,
      con_audio: peticion.conAudio,
      canciones,
      temas: temasPaquete?.temas.map((t) => t.id) ?? [],
      extras
    }
    await escritor.anadirBuffer(
      ENTRADA_MANIFIESTO,
      Buffer.from(`${JSON.stringify(manifiesto, null, 2)}\n`)
    )
    await escritor.terminar()
    enMarcha = false
    if (signal.aborted) throw new ErrorCancelado()
    try {
      await rename(peticion.temporal, peticion.destino)
    } catch (e) {
      throw motivoDeFs(e) ?? e
    }
    const { size } = await stat(peticion.destino)
    return {
      nombre: peticion.destino.split(/[\\/]/).pop() ?? '',
      bytes: size,
      canciones: canciones.length,
      omitidas,
      enCurso: plan.filter((c) => c.enCurso).length,
      ubicacionId: '',
      conAudio: peticion.conAudio
    }
  } catch (e) {
    if (enMarcha) await escritor?.abortar().catch(() => undefined)
    await rm(peticion.temporal, { force: true }).catch(() => undefined)
    throw e
  }
}
