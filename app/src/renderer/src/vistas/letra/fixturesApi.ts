import type { ApiShinobi, ErrorIpc, ResumenCancionIpc } from '@shared/ipc'
import type { ElementoLetra } from '@shared/letra'
import { identidadResumenPrueba } from '../biblioteca/resumenPrueba'
import { sincroniaDe, type ArchivoLetraLeido, type CandidatoLetra } from '@shared/letrasBusqueda'

/** API falsa de `letras.*` para 0084–0086 hasta que existan 0082 y 0083. */

const el = (
  id: string,
  texto: string,
  inicio: number | null,
  palabras: ElementoLetra['palabras'] = null
): ElementoLetra => ({ id, tipo: 'linea', texto, inicio_ms: inicio, fin_ms: null, palabras })

/** Letra inventada con sincronía por palabra. */
export const lineasPorPalabra = (): ElementoLetra[] => [
  el('a1', 'Barcos de papel navegan', 10000, [
    { texto: 'Barcos', inicio_ms: 10000, fin_ms: 10600 },
    { texto: 'de', inicio_ms: 10600, fin_ms: 10900 },
    { texto: 'papel', inicio_ms: 10900, fin_ms: 11500 },
    { texto: 'navegan', inicio_ms: 11500, fin_ms: 12500 }
  ]),
  el('a2', 'Por el río seco', 14000)
]
export const lineasPorLinea = (): ElementoLetra[] => [
  el('b1', 'Luciérnagas sobre el tejado', 12000),
  el('b2', 'Cuentan estrellas sin prisa', 16500),
  el('b3', 'El viento ordena las nubes', 21000)
]
export const lineasTexto = (): ElementoLetra[] => [
  el('c1', 'Primera estrofa inventada', null),
  el('c2', 'con dos renglones', null),
  { id: 'c3', tipo: 'pausa', texto: '', inicio_ms: null, fin_ms: null, palabras: null },
  el('c4', 'Segunda estrofa inventada', null)
]

function candidato(
  id: number,
  titulo: string,
  duracion_ms: number,
  diferencia_ms: number,
  lineas: ElementoLetra[]
): CandidatoLetra {
  return {
    lrclib_id: id,
    titulo,
    artista: 'Artista inventado',
    album: id === 9002 ? null : 'Álbum inventado',
    duracion_ms,
    sincronia: sincroniaDe(lineas),
    diferencia_ms,
    lineas
  }
}

/** Un candidato de cada sincronía: igual de largo, 4 s más largo y muy distinto. */
export const candidatosDeEjemplo = (): CandidatoLetra[] => [
  candidato(9001, 'Canción inventada', 215000, 0, lineasPorLinea()),
  candidato(9002, 'Canción inventada (en directo)', 219000, 4000, lineasPorPalabra()),
  candidato(9003, 'Canción inventada (versión texto)', 190000, -25000, lineasTexto())
]

export type ErrorLetraFalso =
  'LETRA_NO_ENCONTRADA' | 'INSTRUMENTAL' | 'SIN_CONEXION' | 'SERVICIO_NO_DISPONIBLE'

export interface OpcionesApiLetrasFalsa {
  /** Retardo simulado de cada llamada, en ms (por defecto 0). */
  retardoMs?: number
  candidatos?: CandidatoLetra[]
  /** Si se indica, `buscar` rechaza con ese error. */
  errorBuscar?: ErrorLetraFalso
  /** Resultado de `leerArchivo`; por defecto, un archivo con sincronía por línea. */
  archivo?: ArchivoLetraLeido
  /** Si es true, `leerArchivo` rechaza con `ARCHIVO_SIN_LETRA`. */
  errorArchivo?: boolean
  /** Resumen que devuelven `guardar` y `editarTexto`. */
  resumen?: Partial<ResumenCancionIpc>
}

const MENSAJES: Record<string, string> = {
  LETRA_NO_ENCONTRADA: 'No se encontró la letra.',
  INSTRUMENTAL: 'La canción es instrumental.',
  SIN_CONEXION: 'Sin conexión.',
  SERVICIO_NO_DISPONIBLE: 'El servicio de letras no responde.',
  ARCHIVO_SIN_LETRA: 'El archivo no contiene letra.'
}

const rechazo = (codigo: string): ErrorIpc =>
  ({ codigo, mensaje: MENSAJES[codigo] ?? '' }) as ErrorIpc

/** `window.shinobi.letras` configurable, con llamadas registradas en `llamadas`. */
export function apiLetrasFalsa(opciones: OpcionesApiLetrasFalsa = {}): {
  letras: ApiShinobi['letras']
  llamadas: { canal: string; args: unknown[] }[]
} {
  const llamadas: { canal: string; args: unknown[] }[] = []
  const espera = (): Promise<void> => new Promise((r) => setTimeout(r, opciones.retardoMs ?? 0))
  const resumen = (id: string): ResumenCancionIpc => ({
    id,
    titulo: 'Canción de prueba',
    artista: 'Artista inventado',
    duracionMs: 215000,
    estado: 'borrador',
    modificada: '2026-11-05T10:00:00Z',
    estilo: null,
    ...identidadResumenPrueba(),
    miniatura: null,
    pasos: null,
    incompleta: false,
    lineasSinSincronizar: 0,
    danada: false,
    motivo: null,
    ...opciones.resumen
  })
  const letras: ApiShinobi['letras'] = {
    async buscar(p) {
      llamadas.push({ canal: 'buscar', args: [p] })
      await espera()
      if (opciones.errorBuscar) throw rechazo(opciones.errorBuscar)
      return { candidatos: opciones.candidatos ?? candidatosDeEjemplo(), instrumental: false }
    },
    async guardar(p) {
      llamadas.push({ canal: 'guardar', args: [p] })
      await espera()
      return resumen(p.cancionId)
    },
    async editarTexto(p) {
      llamadas.push({ canal: 'editarTexto', args: [p] })
      await espera()
      return resumen(p.cancionId)
    },
    async abrirEdicion(id) {
      llamadas.push({ canal: 'abrirEdicion', args: [id] })
      return null
    },
    async cerrarEdicion(id) {
      llamadas.push({ canal: 'cerrarEdicion', args: [id] })
    },
    async guardarTiempos(p) {
      llamadas.push({ canal: 'guardarTiempos', args: [p] })
      await espera()
      return resumen(p.cancionId)
    },
    async leerArchivo() {
      llamadas.push({ canal: 'leerArchivo', args: [] })
      await espera()
      if (opciones.errorArchivo) throw rechazo('ARCHIVO_SIN_LETRA')
      return (
        opciones.archivo ?? {
          cancelado: false,
          nombre: 'inventada.lrc',
          lineas: lineasPorLinea(),
          sincronia: 'linea',
          ignoradas: 0
        }
      )
    }
  }
  return { letras, llamadas }
}
