import { readdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { EXTENSIONES_AUDIO_VIDEO } from './archivo'

/**
 * Subcarpetas que se recorren por debajo de la elegida, archivos de audio que se devuelven como máximo y
 * entradas que se listan como máximo para no recorrer un disco entero (ADR 0026 §1, pregunta 0261).
 */
export const MAX_NIVELES_CARPETA = 3
export const MAX_ARCHIVOS_CARPETA = 500
export const MAX_ENTRADAS_LISTADAS = 5000

export interface ArchivoDeCarpeta {
  ruta: string
  /** Nombre de la carpeta que lo contiene (para proponer el álbum, ADR 0025 §6). */
  carpeta: string
}

export interface RecorridoCarpeta {
  archivos: ArchivoDeCarpeta[]
  /** Elementos que no son audio ni vídeo reconocidos (se cuentan, no se leen). */
  ignorados: number
  /** Se llegó a uno de los dos topes: puede haber más sin ver. */
  truncado: boolean
}

const EXTENSIONES = new Set<string>(EXTENSIONES_AUDIO_VIDEO)
const ORDEN = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

/** ¿La ruta tiene una extensión de audio o vídeo admitida? */
export const esAudioOVideo = (ruta: string): boolean =>
  EXTENSIONES.has(extname(ruta).slice(1).toLowerCase())

/**
 * Recorre una carpeta hasta 3 niveles de subcarpetas, 500 archivos de audio y 5 000 entradas listadas, en orden natural por nombre
 * (cada subcarpeta se recorre en su sitio, así un álbum queda junto). Ignora los ocultos y los enlaces
 * simbólicos y filtra por extensión. Una carpeta ilegible no falla: se salta.
 */
export async function recorrerCarpeta(raiz: string): Promise<RecorridoCarpeta> {
  const salida: RecorridoCarpeta = { archivos: [], ignorados: 0, truncado: false }
  let listados = 0

  async function visitar(dir: string, nivel: number): Promise<void> {
    const entradas = await readdir(dir, { withFileTypes: true }).catch(() => [])
    entradas.sort((a, b) => ORDEN.compare(a.name, b.name))
    for (const e of entradas) {
      if (salida.truncado) return
      if (e.name.startsWith('.') || e.isSymbolicLink()) continue
      if (++listados > MAX_ENTRADAS_LISTADAS) {
        salida.truncado = true
        return
      }
      const ruta = join(dir, e.name)
      if (e.isDirectory()) {
        if (nivel < MAX_NIVELES_CARPETA) await visitar(ruta, nivel + 1)
      } else if (e.isFile()) {
        if (!esAudioOVideo(e.name)) salida.ignorados++
        else if (salida.archivos.length >= MAX_ARCHIVOS_CARPETA) salida.truncado = true
        else salida.archivos.push({ ruta, carpeta: basename(dir) })
      }
    }
  }

  await visitar(raiz, 0)
  return salida
}
