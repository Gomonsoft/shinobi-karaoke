import {
  FORMATOS_ID,
  FPS,
  RESOLUCIONES,
  proporcionDe,
  type AudioExportacion,
  type Fps,
  type FormatoId,
  type PerfilesIpc,
  type PerfilIpc,
  type Proporcion,
  type Resolucion
} from '@shared/exportacion'

/**
 * Reglas del formulario de exportación (docs/ux/10 «Perfil no soportado» y «Proporción»): qué
 * combinaciones están soportadas y cómo se corrigen las opciones al cambiar proporción o formato.
 * Todo puro: lo prueba `modelo.test.ts` sin interfaz.
 */

export interface OpcionesExportacion {
  audio: AudioExportacion
  formato: FormatoId
  ancho: number
  alto: number
  fps: Fps
}

export interface CambioAutomatico {
  /** FPS anterior si hubo que cambiarlo (`exp.anuncio.fps`). */
  fps?: { anterior: number; nuevo: number }
  /** Resolución nueva si hubo que cambiarla (`exp.anuncio.resolucion`). */
  resolucion?: { ancho: number; alto: number }
}

export interface Ajuste {
  opciones: OpcionesExportacion
  cambio: CambioAutomatico
}

export const resolucionesDe = (proporcion: Proporcion): Resolucion[] =>
  RESOLUCIONES.filter((r) => r.proporcion === proporcion)

export const proporcionDeOpciones = (o: Pick<OpcionesExportacion, 'ancho' | 'alto'>): Proporcion =>
  proporcionDe(o.ancho, o.alto) ?? '16:9'

export function buscarPerfil(
  perfiles: PerfilesIpc,
  formato: FormatoId,
  ancho: number,
  alto: number,
  fps: number
): PerfilIpc | undefined {
  return perfiles.perfiles.find(
    (p) => p.formato === formato && p.ancho === ancho && p.alto === alto && p.fps === fps
  )
}

export const perfilSoportado = (
  perfiles: PerfilesIpc,
  formato: FormatoId,
  ancho: number,
  alto: number,
  fps: number
): boolean => buscarPerfil(perfiles, formato, ancho, alto, fps)?.soportado === true

/** Soportada a algún FPS con ese formato. */
export const resolucionSoportada = (
  perfiles: PerfilesIpc,
  formato: FormatoId,
  r: { ancho: number; alto: number }
): boolean => FPS.some((fps) => perfilSoportado(perfiles, formato, r.ancho, r.alto, fps))

export const formatoSoportado = (perfiles: PerfilesIpc, formato: FormatoId): boolean =>
  perfiles.perfiles.some((p) => p.formato === formato && p.soportado)

export const proporcionSoportada = (
  perfiles: PerfilesIpc,
  formato: FormatoId,
  proporcion: Proporcion
): boolean => resolucionesDe(proporcion).some((r) => resolucionSoportada(perfiles, formato, r))

/** Ningún perfil de ningún formato está soportado (estado F). */
export const sinPerfiles = (perfiles: PerfilesIpc): boolean =>
  !perfiles.perfiles.some((p) => p.soportado)

export type CausaSinPerfiles = 'codificador' | 'no_comprobado'

/** Causa del estado F según los motivos (`codificador` o, si no, `no_comprobado`). */
export function causaSinPerfiles(perfiles: PerfilesIpc): CausaSinPerfiles {
  const motivos = perfiles.perfiles.map((p) => p.motivo)
  return motivos.length > 0 && motivos.every((m) => m === 'codificador')
    ? 'codificador'
    : 'no_comprobado'
}

/** FPS soportado más alto que no supere al elegido; si no hay, el más bajo soportado. */
export function ajustarFps(
  perfiles: PerfilesIpc,
  formato: FormatoId,
  ancho: number,
  alto: number,
  fps: Fps
): Fps {
  const soportados = FPS.filter((f) => perfilSoportado(perfiles, formato, ancho, alto, f))
  if (soportados.length === 0 || soportados.includes(fps)) return fps
  const debajo = soportados.filter((f) => f <= fps)
  return debajo.length > 0 ? debajo[debajo.length - 1]! : soportados[0]!
}

/** Resolución equivalente de la otra proporción: misma altura, o la más cercana por debajo, o la menor. */
export function equivalente(desde: { alto: number }, proporcion: Proporcion): Resolucion {
  const candidatas = resolucionesDe(proporcion)
  const igual = candidatas.find((r) => r.alto === desde.alto)
  if (igual) return igual
  const debajo = candidatas.filter((r) => r.alto < desde.alto)
  return debajo.length > 0 ? debajo[debajo.length - 1]! : candidatas[0]!
}

/** La soportada más alta que no supere a `objetivo`, o la más baja soportada; `null` si ninguna. */
function soportadaCercana(
  perfiles: PerfilesIpc,
  formato: FormatoId,
  proporcion: Proporcion,
  objetivo: { alto: number }
): Resolucion | null {
  const soportadas = resolucionesDe(proporcion).filter((r) =>
    resolucionSoportada(perfiles, formato, r)
  )
  if (soportadas.length === 0) return null
  const debajo = soportadas.filter((r) => r.alto <= objetivo.alto)
  return debajo.length > 0 ? debajo[debajo.length - 1]! : soportadas[0]!
}

function conFps(perfiles: PerfilesIpc, o: OpcionesExportacion, cambio: CambioAutomatico): Ajuste {
  const fps = ajustarFps(perfiles, o.formato, o.ancho, o.alto, o.fps)
  if (fps === o.fps) return { opciones: o, cambio }
  return { opciones: { ...o, fps }, cambio: { ...cambio, fps: { anterior: o.fps, nuevo: fps } } }
}

/** Cambiar de proporción: resolución equivalente soportada y FPS corregido. */
export function cambiarProporcion(
  perfiles: PerfilesIpc,
  o: OpcionesExportacion,
  proporcion: Proporcion
): Ajuste {
  if (proporcion === proporcionDeOpciones(o)) return { opciones: o, cambio: {} }
  const nueva =
    soportadaCercana(perfiles, o.formato, proporcion, equivalente(o, proporcion)) ??
    equivalente(o, proporcion)
  return conFps(
    perfiles,
    { ...o, ancho: nueva.ancho, alto: nueva.alto },
    { resolucion: { ancho: nueva.ancho, alto: nueva.alto } }
  )
}

/** Cambiar de resolución (misma proporción): solo corrige el FPS. */
export function cambiarResolucion(
  perfiles: PerfilesIpc,
  o: OpcionesExportacion,
  r: { ancho: number; alto: number }
): Ajuste {
  return conFps(perfiles, { ...o, ancho: r.ancho, alto: r.alto }, {})
}

/**
 * Deja las opciones en una combinación soportada: elige otro formato si el actual no lo está, y
 * baja la resolución y los FPS lo mínimo. El llamante decide si muestra el aviso (con las
 * opciones recordadas no se muestra).
 */
export function normalizar(perfiles: PerfilesIpc, o: OpcionesExportacion): Ajuste {
  let formato = o.formato
  if (!formatoSoportado(perfiles, formato)) {
    formato = FORMATOS_ID.find((f) => formatoSoportado(perfiles, f)) ?? formato
  }
  const cambio: CambioAutomatico = {}
  let { ancho, alto } = o
  if (!resolucionSoportada(perfiles, formato, { ancho, alto })) {
    const actual = proporcionDeOpciones(o)
    const otra: Proporcion = actual === '16:9' ? '4:3' : '16:9'
    const objetivo = { ancho, alto }
    const nueva =
      soportadaCercana(perfiles, formato, actual, objetivo) ??
      soportadaCercana(perfiles, formato, otra, equivalente(objetivo, otra))
    if (nueva) {
      ancho = nueva.ancho
      alto = nueva.alto
      cambio.resolucion = { ancho, alto }
    }
  }
  return conFps(perfiles, { ...o, formato, ancho, alto }, cambio)
}

/** Cambiar de formato: aplica `normalizar` con el formato nuevo. */
export function cambiarFormato(
  perfiles: PerfilesIpc,
  o: OpcionesExportacion,
  formato: FormatoId
): Ajuste {
  return normalizar(perfiles, { ...o, formato })
}

// --- Perfil costoso y espacio -----------------------------------------------------

const MAX_SEGUNDOS_BARATO = 30 * 60
const MAX_BYTES_BARATO = 4_000_000_000

/** `exp.nota.costoso`: más de 30 minutos, más de 4 GB, o 2160 líneas a 60 FPS. */
export function esCostoso(
  o: Pick<OpcionesExportacion, 'alto' | 'fps'>,
  estimacion: { bytes: number | null; segundos: number | null } | null
): boolean {
  return (
    (estimacion?.segundos ?? 0) > MAX_SEGUNDOS_BARATO ||
    (estimacion?.bytes ?? 0) > MAX_BYTES_BARATO ||
    (o.alto >= 2160 && o.fps === 60)
  )
}

/** `exp.aviso.espacio`: solo si las dos cifras se conocen. */
export const faltaEspacio = (bytes: number | null, libreBytes: number | null): boolean =>
  bytes !== null && libreBytes !== null && bytes > libreBytes

/** Nombre de archivo de una ruta (admite `/` y `\`). */
export const nombreDeRuta = (ruta: string): string => ruta.split(/[\\/]/).pop() ?? ruta

/** Carpeta de una ruta (sin la barra final). */
export function carpetaDeRuta(ruta: string): string {
  const i = Math.max(ruta.lastIndexOf('/'), ruta.lastIndexOf('\\'))
  return i > 0 ? ruta.slice(0, i) : ruta
}

/** Ruta sin la extensión del nombre (para comparar destinos al cambiar de formato). */
export const sinExtension = (ruta: string): string => ruta.replace(/\.[^./\\]+$/, '')
