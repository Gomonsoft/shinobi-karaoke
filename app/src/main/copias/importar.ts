import { createHash, randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import {
  CODIGOS_ERROR,
  VERSION_ESQUEMA_CANCION,
  claveTexto,
  crearIndiceCatalogo,
  migrarCancion,
  migrarCatalogo,
  resolverApariencia,
  type Cancion,
  type Catalogo,
  type Tema
} from '../../shared'
import type { ResultadoImportacionIpc, ResumenPaqueteIpc } from '../../shared/ipc'
import type { ResumenCancion } from '../biblioteca/resumen'
import { escribirJsonAtomico } from '../persistencia'
import { ajustesQueViajan } from './ajustes'
import type { Avance, PuertosCopias } from './contexto'
import {
  ARCHIVOS_CANCION,
  ENTRADA_AJUSTES,
  ENTRADA_MANIFIESTO,
  ENTRADA_TEMAS,
  ErrorPaquete,
  LIMITES,
  rutaEnPaquete,
  validarManifiesto,
  type ArchivoCancion,
  type CancionManifiesto,
  type Manifiesto
} from './formato'
import {
  aparienciaImportada,
  buscarTema,
  planificarTemas,
  previsualizarAsignaciones,
  type PlanTemas
} from './temas'
import { ErrorCancelado, PaqueteLector } from './zip'

/** Leer un paquete, importar sus canciones y restaurar una copia (ADR 0027 §3). */

const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex')

/** Suma máxima de los `cancion.json` declarados: se leen enteros en memoria antes de importar. */
const MAX_JSON_TOTAL = 256 * 1024 * 1024
const MARGEN_DURACION_PARECIDA_MS = 2000

export interface PaqueteAbierto {
  lector: PaqueteLector
  manifiesto: Manifiesto
  /** Catálogo de temas del paquete (`null` si no trae `temas.json`). */
  temas: Catalogo | null
  bytesArchivo: number
}

/**
 * Abre el paquete y valida lo común a leer e importar: ZIP legible, manifiesto de la versión que
 * entendemos, `temas.json` íntegro. Una canción con archivos dañados NO se detecta aquí: falla sola luego.
 */
export async function abrirPaquete(ruta: string): Promise<PaqueteAbierto> {
  const lector = await PaqueteLector.abrir(ruta)
  try {
    const bytesArchivo = (await stat(ruta)).size
    let json: unknown
    try {
      json = JSON.parse(
        (await lector.leerBuffer(ENTRADA_MANIFIESTO, LIMITES.maxManifiesto)).toString('utf8')
      )
    } catch (e) {
      if (e instanceof ErrorPaquete) throw e
      throw new ErrorPaquete('PAQUETE_NO_VALIDO', 'El manifiesto no es un JSON válido.')
    }
    const manifiesto = validarManifiesto(json)
    const jsonTotal = manifiesto.canciones.reduce(
      (t, c) =>
        t + (c.archivos.find((a) => a.ruta === rutaEnPaquete(c.id, 'cancion.json'))?.bytes ?? 0),
      0
    )
    if (jsonTotal > MAX_JSON_TOTAL) throw new ErrorPaquete('PAQUETE_NO_VALIDO', 'Demasiados datos.')

    let temas: Catalogo | null = null
    const declarado = manifiesto.extras.find((e) => e.ruta === ENTRADA_TEMAS)
    if (declarado) {
      const buf = await leerExtra(lector, declarado, LIMITES.maxTemas)
      let crudo: unknown
      try {
        crudo = JSON.parse(buf.toString('utf8'))
      } catch {
        throw new ErrorPaquete('PAQUETE_NO_VALIDO', 'temas.json no es un JSON válido.')
      }
      const r = migrarCatalogo(crudo)
      if (r.tipo === 'mas_nuevo') {
        throw new ErrorPaquete('PAQUETE_VERSION_NUEVA', 'Los temas son de una versión más nueva.')
      }
      if (r.tipo === 'invalido')
        throw new ErrorPaquete('PAQUETE_NO_VALIDO', 'temas.json no es válido.')
      temas = r.catalogo
    }
    return { lector, manifiesto, temas, bytesArchivo }
  } catch (e) {
    lector.cerrar()
    throw e
  }
}

/** `temas.json` o `ajustes.json`: declarado en el manifiesto, presente y con la comprobación correcta. */
async function leerExtra(
  lector: PaqueteLector,
  declarado: { ruta: string; bytes: number; sha256: string },
  max: number
): Promise<Buffer> {
  const entrada = lector.entradas.get(declarado.ruta)
  if (!entrada) throw new ErrorPaquete('PAQUETE_INCOMPLETO', `Falta ${declarado.ruta}.`)
  if (entrada.uncompressedSize !== declarado.bytes) {
    throw new ErrorPaquete('PAQUETE_INCOMPLETO', `${declarado.ruta} no coincide con el manifiesto.`)
  }
  const buf = await lector.leerBuffer(declarado.ruta, max).catch((e: unknown) => {
    throw e instanceof ErrorPaquete && e.codigo === 'PAQUETE_NO_VALIDO'
      ? new ErrorPaquete('PAQUETE_INCOMPLETO', 'No coincide con el manifiesto.')
      : e
  })
  if (buf.length !== declarado.bytes || sha256(buf) !== declarado.sha256) {
    throw new ErrorPaquete('PAQUETE_INCOMPLETO', `${declarado.ruta} está dañado.`)
  }
  return buf
}

const declarado = (c: CancionManifiesto, nombre: ArchivoCancion) =>
  c.archivos.find((a) => a.ruta === rutaEnPaquete(c.id, nombre))
const bytesDe = (c: CancionManifiesto): number => c.archivos.reduce((t, a) => t + a.bytes, 0)
const tienePistas = (c: CancionManifiesto): boolean =>
  declarado(c, 'pistas/voz.flac') !== undefined &&
  declarado(c, 'pistas/instrumental.flac') !== undefined
const tieneAudio = (c: CancionManifiesto): boolean =>
  declarado(c, 'fuente/mezcla.flac') !== undefined || tienePistas(c)

// ---------------------------------------------------------------------------------------------
// Leer (paso 1 del diálogo)
// ---------------------------------------------------------------------------------------------

export async function resumirPaquete(
  p: PuertosCopias,
  paquete: PaqueteAbierto,
  nombre: string
): Promise<ResumenPaqueteIpc> {
  const { manifiesto: m } = paquete
  const locales = p.biblioteca.listar()
  const catalogo = p.temas?.datos() ?? null
  const clave = (c: { titulo: string; artista: string }): string =>
    `${claveTexto(c.titulo) ?? ''}\u0000${claveTexto(c.artista) ?? ''}`
  const resumen: ResumenPaqueteIpc = {
    tipo: m.tipo === 'copia' ? 'copia' : 'paquete',
    conAudio: m.con_audio,
    canciones: m.canciones.map((c) => {
      const local = p.biblioteca.obtenerResumen(c.id)
      const parecida =
        !local &&
        c.duracion_ms !== undefined &&
        locales.some(
          (l) =>
            clave({ titulo: l.titulo, artista: l.artista }) === clave(c) &&
            l.duracionMs !== null &&
            Math.abs(l.duracionMs - c.duracion_ms!) <= MARGEN_DURACION_PARECIDA_MS
        )
      return {
        id: c.id,
        titulo: c.titulo,
        artista: c.artista,
        existe: local !== null,
        ...(c.modificada ? { modificada: c.modificada } : {}),
        modificadaLocal: local?.modificada ?? null,
        igual: local !== null && c.modificada !== undefined && c.modificada === local.modificada,
        parecida,
        conAudio: tieneAudio(c),
        bytes: bytesDe(c)
      }
    }),
    temas: (paquete.temas?.temas ?? []).map((t) => ({
      id: t.id,
      nombre: t.nombre,
      existe: buscarTema(t, catalogo).existe
    })),
    nombre,
    creado: m.creado,
    app: m.app,
    bytes: paquete.bytesArchivo,
    libreBytes: await p.libreBytes(p.dirBiblioteca),
    ajustes: m.tipo === 'copia' && m.extras.some((e) => e.ruta === ENTRADA_AJUSTES),
    temasSoloLectura: p.temas !== undefined && catalogo === null
  }
  if (m.tipo === 'copia' && paquete.temas) {
    resumen.asignaciones = previsualizarAsignaciones(paquete.temas, catalogo)
  }
  return resumen
}

// ---------------------------------------------------------------------------------------------
// Importar (pasos 3 y 4)
// ---------------------------------------------------------------------------------------------

export interface PeticionImportar {
  conflictos: 'sustituir' | 'conservar_ambas' | 'omitir'
  porCancion?: Record<string, 'sustituir' | 'conservar_ambas' | 'omitir'> | undefined
  ajustes: boolean
}

type Resultado = ResultadoImportacionIpc['resultados'][number]
type Modo = 'nueva' | 'sustituir' | 'conservar'
interface Accion {
  cm: CancionManifiesto
  modo: Modo
  local: ResumenCancion | null
  cancion?: Cancion
}

/** Un fallo de una canción, con el código estable que muestra el resultado. */
export function codigoDeImportacion(e: unknown): string {
  if (e instanceof ErrorCancelado) return 'CANCELADO'
  if (e instanceof ErrorPaquete) return e.codigo
  const sys = e as NodeJS.ErrnoException | null
  if (sys?.code === 'ENOSPC' || sys?.code === 'EDQUOT') return 'SIN_ESPACIO'
  // Un error de disco (con `syscall`) es nuestro; el resto salió del ZIP o de zlib: archivo dañado.
  if (sys && 'syscall' in sys) return 'ERROR_INTERNO'
  const codigo = (e as { codigo?: unknown } | null)?.codigo
  if (typeof codigo === 'string' && (CODIGOS_ERROR as readonly string[]).includes(codigo)) {
    return codigo
  }
  return 'PAQUETE_INCOMPLETO'
}

/** `cancion.json` de una canción: íntegro respecto al manifiesto, de un esquema que entendemos y válido. */
async function leerCancionJson(paquete: PaqueteAbierto, cm: CancionManifiesto): Promise<Cancion> {
  const a = declarado(cm, 'cancion.json')
  if (!a) throw new ErrorPaquete('PAQUETE_INCOMPLETO', 'Falta cancion.json en el manifiesto.')
  if (cm.esquema_cancion > VERSION_ESQUEMA_CANCION) {
    throw new ErrorPaquete('CANCION_MAS_NUEVA', 'La canción es de una versión más nueva.')
  }
  const entrada = paquete.lector.entradas.get(a.ruta)
  if (!entrada || entrada.uncompressedSize !== a.bytes) {
    throw new ErrorPaquete('PAQUETE_INCOMPLETO', 'cancion.json no coincide con el manifiesto.')
  }
  let buf: Buffer
  try {
    buf = await paquete.lector.leerBuffer(a.ruta, LIMITES.maxCancionJson)
  } catch {
    throw new ErrorPaquete('PAQUETE_INCOMPLETO', 'cancion.json no se pudo leer.')
  }
  if (buf.length !== a.bytes || sha256(buf) !== a.sha256) {
    throw new ErrorPaquete('PAQUETE_INCOMPLETO', 'cancion.json está dañado.')
  }
  let json: unknown
  try {
    json = JSON.parse(buf.toString('utf8'))
  } catch {
    throw new ErrorPaquete('PAQUETE_NO_VALIDO', 'cancion.json no es un JSON válido.')
  }
  const esquema = (json as { esquema?: unknown } | null)?.esquema
  if (typeof esquema === 'number' && esquema > VERSION_ESQUEMA_CANCION) {
    throw new ErrorPaquete('CANCION_MAS_NUEVA', 'La canción es de una versión más nueva.')
  }
  let c: Cancion
  try {
    c = migrarCancion(json)
  } catch {
    throw new ErrorPaquete('PAQUETE_NO_VALIDO', 'cancion.json no es una canción válida.')
  }
  if (c.id !== cm.id) throw new ErrorPaquete('PAQUETE_NO_VALIDO', 'La canción no es la declarada.')
  return c
}

/** Extrae una entrada declarada a `destino`: solo ese archivo, solo esa ruta, con tamaño y SHA-256 comprobados. */
async function extraer(
  paquete: PaqueteAbierto,
  cm: CancionManifiesto,
  nombre: ArchivoCancion,
  destino: string,
  signal: AbortSignal,
  alBytes: (n: number) => void
): Promise<void> {
  const a = declarado(cm, nombre)
  if (!a) throw new ErrorPaquete('PAQUETE_INCOMPLETO', `Falta ${nombre}.`)
  const entrada = paquete.lector.entradas.get(a.ruta)
  if (!entrada || entrada.uncompressedSize !== a.bytes) {
    throw new ErrorPaquete('PAQUETE_INCOMPLETO', `${nombre} no coincide con el manifiesto.`)
  }
  const flujo = await paquete.lector.abrirLectura(a.ruta)
  const hash = createHash('sha256')
  let bytes = 0
  const medidor = new Transform({
    transform: (trozo: Buffer, _c, listo) => {
      bytes += trozo.length
      if (bytes > a.bytes) {
        listo(new ErrorPaquete('PAQUETE_INCOMPLETO', `${nombre} es más grande de lo declarado.`))
        return
      }
      hash.update(trozo)
      alBytes(trozo.length)
      listo(null, trozo)
    }
  })
  await mkdir(dirname(destino), { recursive: true })
  const alAbortar = (): void => {
    flujo.destroy(new ErrorCancelado())
  }
  if (signal.aborted) alAbortar()
  signal.addEventListener('abort', alAbortar, { once: true })
  try {
    // `wx`: nunca sobrescribe ni sigue un enlace que hubiera en esa ruta.
    await pipeline(flujo, medidor, createWriteStream(destino, { flags: 'wx' }))
  } finally {
    signal.removeEventListener('abort', alAbortar)
  }
  if (bytes !== a.bytes || hash.digest('hex') !== a.sha256) {
    throw new ErrorPaquete('PAQUETE_INCOMPLETO', `${nombre} está dañado.`)
  }
}

const pasoPendiente = () => ({ estado: 'pendiente' as const, actualizado: null, error: null })

/** Sin mezcla o sin pistas en el paquete: borrador con la fuente pendiente (ADR 0027 §3, 0157 §7). */
function comoBorradorSinAudio(
  c: Cancion,
  d: { mezcla: boolean; pistas: boolean; miniatura: boolean }
): Cancion {
  const r = structuredClone(c)
  if (!d.pistas && (r.pistas !== null || r.pasos.separacion.estado === 'completado')) {
    r.pistas = null
    r.pasos.separacion = pasoPendiente()
    r.estado = 'borrador'
    delete r.modalidad
  }
  if (!d.mezcla && r.pasos.fuente.estado === 'completado') {
    r.pasos.fuente = pasoPendiente()
    r.estado = 'borrador'
    delete r.modalidad
  }
  if (!d.miniatura) r.fuente.miniatura = null
  if (r.preparacion?.estado === 'en_curso') delete r.preparacion
  return r
}

/** Paquete ligero sobre una canción que ya tiene audio: lo de la canción, con el audio y su estado de pasos locales. */
function fusionarLigero(local: Cancion, importada: Cancion): Cancion {
  const r = structuredClone(importada)
  r.id = local.id
  r.fuente = structuredClone(local.fuente)
  r.pistas = structuredClone(local.pistas)
  r.pasos = { ...r.pasos, fuente: local.pasos.fuente, separacion: local.pasos.separacion }
  r.metadatos = { ...r.metadatos, duracion_ms: local.metadatos.duracion_ms }
  if (local.pistas === null || local.pasos.separacion.estado !== 'completado') {
    r.estado = 'borrador'
    delete r.modalidad
  }
  if (r.preparacion?.estado === 'en_curso') delete r.preparacion
  return r
}

const enCurso = (c: Cancion | null): boolean =>
  c !== null && Object.values(c.pasos).some((paso) => paso.estado === 'en_curso')

export async function importarPaquete(
  p: PuertosCopias,
  paquete: PaqueteAbierto,
  peticion: PeticionImportar,
  signal: AbortSignal,
  avance: Avance
): Promise<ResultadoImportacionIpc> {
  const { manifiesto: m } = paquete
  const resultados = new Map<string, Resultado>()
  const acciones: Accion[] = []

  // 1. Qué se hace con cada canción.
  for (const cm of m.canciones) {
    const local = p.biblioteca.obtenerResumen(cm.id)
    if (cm.esquema_cancion > VERSION_ESQUEMA_CANCION) {
      resultados.set(cm.id, { id: cm.id, resultado: 'omitida', motivo: 'CANCION_MAS_NUEVA' })
    } else if (!local) {
      acciones.push({ cm, modo: 'nueva', local })
    } else if (cm.modificada !== undefined && cm.modificada === local.modificada) {
      resultados.set(cm.id, { id: cm.id, resultado: 'omitida', motivo: 'IGUAL' })
    } else {
      const eleccion = peticion.porCancion?.[cm.id] ?? peticion.conflictos
      if (eleccion === 'omitir') {
        resultados.set(cm.id, { id: cm.id, resultado: 'omitida', motivo: 'OMITIDA' })
      } else if (eleccion === 'conservar_ambas') {
        acciones.push({ cm, modo: 'conservar', local })
      } else if (p.puedeSustituir?.(cm.id) === false) {
        resultados.set(cm.id, {
          id: cm.id,
          resultado: 'omitida',
          motivo: 'CANCION_EN_REPRODUCCION'
        })
      } else if (enCurso(p.biblioteca.obtener(cm.id))) {
        resultados.set(cm.id, { id: cm.id, resultado: 'omitida', motivo: 'EN_CURSO' })
      } else {
        acciones.push({ cm, modo: 'sustituir', local })
      }
    }
  }

  // 2. Espacio: lo que se va a extraer frente al espacio libre de la biblioteca.
  const necesario = acciones.reduce((t, a) => {
    const ligeroSobreLocal = a.modo === 'sustituir' && !tienePistas(a.cm)
    return t + (ligeroSobreLocal ? 0 : bytesDe(a.cm))
  }, 0)
  avance.total(necesario)
  const libre = await p.libreBytes(p.dirBiblioteca)
  if (libre !== null && libre < necesario) {
    throw new ErrorPaquete('SIN_ESPACIO', 'No hay espacio para importar el paquete.')
  }

  // 3. `cancion.json` de las que entran (íntegros y de un esquema que entendemos).
  const vivas: Accion[] = []
  for (const a of acciones) {
    try {
      a.cancion = await leerCancionJson(paquete, a.cm)
      vivas.push(a)
    } catch (e) {
      const motivo = codigoDeImportacion(e)
      resultados.set(a.cm.id, {
        id: a.cm.id,
        resultado: motivo === 'CANCION_MAS_NUEVA' ? 'omitida' : 'error',
        motivo
      })
    }
  }

  // 4. Temas (una sola vez, por `ServicioTemas`): los de las canciones que entran o, en una copia, todos.
  const plan = await importarTemas(p, paquete, vivas)
  const temasLocales = plan.catalogo
  const mapa = new Map<string, Tema>()
  for (const [idPaquete, idLocal] of plan.plan?.mapa ?? []) {
    const t = temasLocales?.temas.find((x) => x.id === idLocal)
    if (t) mapa.set(idPaquete, t)
  }

  // 5. Canción a canción, cada una en `.importando/` y con `rename` al terminar.
  let detenido: string | null = null
  for (const [i, a] of vivas.entries()) {
    const id = a.cm.id
    if (detenido !== null) {
      resultados.set(id, { id, resultado: 'omitida', motivo: detenido })
      continue
    }
    if (signal.aborted) {
      detenido = 'CANCELADO'
      resultados.set(id, { id, resultado: 'omitida', motivo: detenido })
      continue
    }
    avance.cancion(i, vivas.length, a.cm.titulo)
    try {
      resultados.set(
        id,
        await importarCancion(p, paquete, a, {
          tipo: m.tipo,
          mapa,
          temasEscribibles: plan.escribible,
          signal,
          alBytes: avance.bytes
        })
      )
    } catch (e) {
      const motivo = codigoDeImportacion(e)
      resultados.set(id, { id, resultado: motivo === 'CANCELADO' ? 'omitida' : 'error', motivo })
      p.registrar?.('aviso', `importar ${id}: ${motivo}`)
      if (motivo === 'CANCELADO' || motivo === 'SIN_ESPACIO') detenido = motivo
    }
  }
  avance.cancion(vivas.length, vivas.length, '')

  // 6. Ajustes: solo una copia, solo si el usuario lo pidió.
  let ajustes = false
  const extraAjustes = m.extras.find((e) => e.ruta === ENTRADA_AJUSTES)
  if (peticion.ajustes && m.tipo === 'copia' && extraAjustes && detenido !== 'CANCELADO') {
    try {
      const buf = await leerExtra(paquete.lector, extraAjustes, LIMITES.maxAjustes)
      await p.config.actualizar(ajustesQueViajan(JSON.parse(buf.toString('utf8'))))
      ajustes = true
    } catch (e) {
      p.registrar?.('aviso', `importar ajustes: ${String(e)}`)
    }
  }

  return {
    resultados: m.canciones.map((c) => resultados.get(c.id)!).filter(Boolean),
    ...(plan.plan
      ? {
          temas: { importados: plan.plan.importados, reutilizados: plan.plan.reutilizados },
          ...(m.tipo === 'copia'
            ? {
                asignaciones: {
                  restauradas: plan.plan.asignaciones.restauradas,
                  noAplicadas: plan.plan.asignaciones.omitidas
                }
              }
            : {})
        }
      : {}),
    ajustes
  }
}

interface TemasImportados {
  plan: PlanTemas | null
  /** Catálogo de este equipo tras importar (`null` si es de solo lectura o no hay servicio). */
  catalogo: Catalogo | null
  escribible: boolean
}

async function importarTemas(
  p: PuertosCopias,
  paquete: PaqueteAbierto,
  vivas: readonly Accion[]
): Promise<TemasImportados> {
  const servicio = p.temas
  if (!servicio) return { plan: null, catalogo: null, escribible: false }
  if (servicio.datos() === null) return { plan: null, catalogo: null, escribible: false }
  const delPaquete = paquete.temas
  if (!delPaquete) {
    return { plan: null, catalogo: servicio.datos() as Catalogo, escribible: true }
  }
  const esCopia = paquete.manifiesto.tipo === 'copia'
  const ids = new Set<string>()
  if (esCopia) for (const t of delPaquete.temas) ids.add(t.id)
  else {
    const indice = crearIndiceCatalogo(delPaquete)
    for (const a of vivas) {
      const c = a.cancion
      if (!c?.apariencia || c.apariencia.modo === 'propio') continue
      const r = resolverApariencia(c, indice)
      if (r.temaId !== null && indice.porId.has(r.temaId)) ids.add(r.temaId)
    }
  }
  return servicio.enCola(async () => {
    const local = servicio.datos() as Catalogo | null
    if (!local) return { plan: null, catalogo: null, escribible: false }
    const plan = planificarTemas({
      paquete: delPaquete,
      local,
      ids,
      restaurarAsignaciones: esCopia,
      nuevoId: p.uuid ?? randomUUID,
      ahora: () => (p.ahora?.() ?? new Date()).toISOString()
    })
    if (plan.nuevo) await servicio.confirmarCatalogo(plan.nuevo)
    return { plan, catalogo: plan.nuevo ?? local, escribible: true }
  })
}

interface ContextoCancion {
  tipo: Manifiesto['tipo']
  mapa: ReadonlyMap<string, Tema>
  temasEscribibles: boolean
  signal: AbortSignal
  alBytes: (n: number) => void
}

async function importarCancion(
  p: PuertosCopias,
  paquete: PaqueteAbierto,
  a: Accion,
  ctx: ContextoCancion
): Promise<Resultado> {
  const { cm } = a
  const idFinal = a.modo === 'conservar' ? (p.uuid ?? randomUUID)() : cm.id
  const d = {
    mezcla: declarado(cm, 'fuente/mezcla.flac') !== undefined,
    pistas:
      declarado(cm, 'pistas/voz.flac') !== undefined &&
      declarado(cm, 'pistas/instrumental.flac') !== undefined,
    miniatura: declarado(cm, 'fuente/miniatura.jpg') !== undefined
  }
  let c = aparienciaImportada(a.cancion!, {
    tipo: ctx.tipo,
    paquete: paquete.temas,
    mapa: ctx.mapa,
    temasEscribibles: ctx.temasEscribibles
  })

  // Paquete ligero (o sin pistas, como una canción que se estaba separando) sobre una canción local: solo
  // se sustituye `cancion.json` y se conserva el audio local.
  const local = a.modo === 'sustituir' ? p.biblioteca.obtener(cm.id) : null
  if (a.modo === 'sustituir' && !d.pistas && local) {
    const fusionada = migrarCancion(fusionarLigero(local, c))
    await p.biblioteca.puerto().actualizar(cm.id, () => fusionada)
    return { id: cm.id, resultado: 'sustituida', ligera: true, idLocal: cm.id }
  }

  const carpeta = join(p.dirBiblioteca, '.importando', idFinal)
  await rm(carpeta, { recursive: true, force: true })
  try {
    await mkdir(carpeta, { recursive: true })
    for (const nombre of ARCHIVOS_CANCION) {
      if (nombre === 'cancion.json' || !declarado(cm, nombre)) continue
      await extraer(
        paquete,
        cm,
        nombre,
        join(carpeta, ...nombre.split('/')),
        ctx.signal,
        ctx.alBytes
      )
    }
    c = comoBorradorSinAudio(c, d)
    c.id = idFinal
    if (a.modo === 'conservar') c.metadatos.titulo = `${c.metadatos.titulo} (importada)`
    const valida = migrarCancion(c)
    await escribirJsonAtomico(join(carpeta, 'cancion.json'), valida)
    if (ctx.signal.aborted) throw new ErrorCancelado()
    // La existente va a la papelera solo cuando la importada ya está completa y verificada.
    if (a.modo === 'sustituir') await p.biblioteca.eliminar(cm.id)
    await rename(carpeta, join(p.dirBiblioteca, idFinal))
    await p.biblioteca.incorporar(idFinal, valida)
  } catch (e) {
    await rm(carpeta, { recursive: true, force: true }).catch(() => undefined)
    throw e
  }
  return {
    id: cm.id,
    resultado: a.modo === 'sustituir' ? 'sustituida' : 'importada',
    idLocal: idFinal
  }
}
