import type {
  ResultadoExportacionCopiaIpc,
  ResultadoImportacionIpc,
  ResumenPaqueteIpc
} from '@shared/ipc'
import { PAQ } from './textos'

/** Qué hacer con una canción que ya está en la biblioteca (los valores de `copias.importar`). */
export type Decision = 'omitir' | 'sustituir' | 'conservar_ambas'
export type DecisionGeneral = Decision | 'mixto'
export type CancionPaquete = ResumenPaqueteIpc['canciones'][number]
export type EstadoFila = 'nueva' | 'existe' | 'igual'

const FECHA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })

/** «21 nov 2026» (sin el punto de la abreviatura). */
export function fechaCorta(iso: string | null | undefined): string | null {
  if (!iso) return null
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return null
  return FECHA.format(fecha).replace(/\./g, '')
}

/** `Nueva` (✚), `Ya la tienes` (⟲) o `Ya la tienes igual` (=). */
export function estadoDe(c: CancionPaquete): EstadoFila {
  if (!c.existe) return 'nueva'
  return c.igual === true ? 'igual' : 'existe'
}

/** `true` si la del paquete es más reciente que la local (por su fecha de modificación). */
export function paqueteMasReciente(c: CancionPaquete): boolean {
  return (c.modificada ?? '') > (c.modificadaLocal ?? '')
}

export interface Decisiones {
  /** La respuesta de todas las «Ya la tienes». */
  general: Decision
  /** Las que el usuario cambió fila a fila. */
  porCancion: Readonly<Record<string, Decision>>
}

export const DECISIONES_INICIALES: Decisiones = { general: 'omitir', porCancion: {} }

/** Lo que se hará con una canción: solo las «Ya la tienes» (no iguales) admiten decisión. */
export function decisionEfectiva(
  c: CancionPaquete,
  d: Decisiones,
  bloqueadas: ReadonlySet<string> = new Set()
): Decision | null {
  if (estadoDe(c) !== 'existe') return null
  const elegida = d.porCancion[c.id] ?? d.general
  return elegida === 'sustituir' && bloqueadas.has(c.id) ? 'omitir' : elegida
}

/** El control general: la respuesta común de las «Ya la tienes», o «Mixto». */
export function decisionGeneral(
  canciones: readonly CancionPaquete[],
  d: Decisiones,
  bloqueadas: ReadonlySet<string> = new Set()
): DecisionGeneral {
  const efectivas = canciones
    .filter((c) => !bloqueadas.has(c.id))
    .map((c) => decisionEfectiva(c, d, bloqueadas))
    .filter((x): x is Decision => x !== null)
  const primera = efectivas[0]
  if (!primera) return d.general
  return efectivas.every((x) => x === primera) ? primera : 'mixto'
}

/** Cuántas entrarán: las nuevas, las que se sustituyen y las que se conservan las dos. */
export function contarAImportar(
  canciones: readonly CancionPaquete[],
  d: Decisiones,
  bloqueadas?: ReadonlySet<string>
): number {
  return canciones.filter((c) => {
    const e = estadoDe(c)
    if (e === 'nueva') return true
    if (e === 'igual') return false
    return decisionEfectiva(c, d, bloqueadas) !== 'omitir'
  }).length
}

/** Bytes que ocupará lo que entra (`paq.imp.espacio`). */
export function bytesAImportar(
  canciones: readonly CancionPaquete[],
  d: Decisiones,
  bloqueadas?: ReadonlySet<string>
): number {
  return canciones.reduce((suma, c) => {
    const e = estadoDe(c)
    const entra =
      e === 'nueva' || (e === 'existe' && decisionEfectiva(c, d, bloqueadas) !== 'omitir')
    return entra ? suma + (c.bytes ?? 0) : suma
  }, 0)
}

/** El paquete trae solo letra y estilo: se importa sin audio. */
export const esLigero = (resumen: ResumenPaqueteIpc): boolean => !resumen.conAudio

/** El `porCancion` que se envía a main: solo lo que se aparta de la respuesta general. */
export function porCancionParaEnviar(
  canciones: readonly CancionPaquete[],
  d: Decisiones
): Record<string, Decision> {
  const salida: Record<string, Decision> = {}
  for (const c of canciones) {
    if (estadoDe(c) !== 'existe') continue
    const elegida = d.porCancion[c.id]
    if (elegida !== undefined && elegida !== d.general) salida[c.id] = elegida
  }
  return salida
}

export type TipoFila = 'ok' | 'omitida' | 'error'
export interface FilaResultado {
  id: string
  tipo: TipoFila
  texto: string
  /** Solo en un error: lo que copia [Copiar detalles]. */
  detalles?: string
}

/** Icono y texto de cada resultado (tabla «Motivos del resultado por canción»). */
export function filaDeResultado(
  r: ResultadoImportacionIpc['resultados'][number],
  titulo: string
): FilaResultado {
  if (r.resultado === 'importada') {
    // «Conservar las dos»: entra con otro identificador.
    const comoCopia = r.idLocal !== undefined && r.idLocal !== r.id
    return {
      id: r.id,
      tipo: 'ok',
      texto: comoCopia ? PAQ.fila.copia(titulo) : PAQ.fila.importada
    }
  }
  if (r.resultado === 'sustituida') {
    return {
      id: r.id,
      tipo: 'ok',
      texto: r.ligera === true ? PAQ.fila.sustituidaLigera : PAQ.fila.sustituida
    }
  }
  if (r.resultado === 'omitida') {
    const texto = (r.motivo !== undefined ? PAQ.motivo[r.motivo] : undefined) ?? PAQ.motivo.OMITIDA
    return { id: r.id, tipo: 'omitida', texto: texto as string }
  }
  const texto = (r.motivo !== undefined ? PAQ.fallo[r.motivo] : undefined) ?? PAQ.fallo.guardar
  return {
    id: r.id,
    tipo: 'error',
    texto: texto as string,
    detalles: `${r.resultado}: ${r.motivo ?? 'ERROR_INTERNO'} (${r.id})`
  }
}

/** `paq.imp.resultado` cuenta como importadas las ✓. */
export function contarImportadas(r: ResultadoImportacionIpc): number {
  return r.resultados.filter((x) => x.resultado === 'importada' || x.resultado === 'sustituida')
    .length
}

/** Ids de la biblioteca de las que entraron (para resaltarlas al volver). */
export function idsImportadas(r: ResultadoImportacionIpc): string[] {
  return r.resultados
    .filter((x) => x.resultado === 'importada' || x.resultado === 'sustituida')
    .map((x) => x.idLocal ?? x.id)
}

export const esResultadoImportacion = (
  r: ResultadoExportacionCopiaIpc | ResultadoImportacionIpc | undefined
): r is ResultadoImportacionIpc => r !== undefined && 'resultados' in r

export const esResultadoExportacion = (
  r: ResultadoExportacionCopiaIpc | ResultadoImportacionIpc | undefined
): r is ResultadoExportacionCopiaIpc => r !== undefined && 'ubicacionId' in r

/** Texto de las canciones que no entraron en un paquete (nota por canción de la lista de exportar). */
export function notaDeExportar(c: {
  sinAudio: boolean
  enCurso: boolean
  separando: boolean
}): string | null {
  if (c.separando) return PAQ.exp.notaEnCursoSeparando
  if (c.enCurso) return PAQ.exp.notaEnCurso
  if (c.sinAudio) return PAQ.exp.notaSinAudio
  return null
}
