import type { ErrorTrabajo } from '../trabajos/worker'

/** Puerto de escritura: el subconjunto de `Writable` que usa el bucle. */
export interface DestinoFotogramas {
  write(trozo: Buffer): boolean
  readonly writableLength: number
  once(evento: 'drain', cb: () => void): unknown
  off?(evento: 'drain', cb: () => void): unknown
}

export interface OpcionesBucle {
  total: number
  ancho: number
  alto: number
  /** Deja el fotograma `n` listo para capturar. */
  pintar: (n: number) => Promise<void>
  /** Captura el fotograma `n` en BGRA (`ancho × alto × 4` bytes). */
  capturar: (n: number) => Promise<Buffer>
  destino: DestinoFotogramas
  señal?: AbortSignal
  /** Se llama tras escribir cada fotograma. */
  alFotograma?: (n: number) => void
}

export type ResultadoBucle = { estado: 'completo' | 'cancelado'; escritos: number }

/** Máximo de fotogramas pendientes en la tubería antes de esperar `drain`. */
export const FOTOGRAMAS_PENDIENTES_MAX = 2

/** Mueve los fotogramas 0..total-1 de la fuente a la tubería, en orden y con contrapresión (ADR 0019 §1). */
export async function ejecutarBucle(o: OpcionesBucle): Promise<ResultadoBucle> {
  const tamaño = o.ancho * o.alto * 4
  let escritos = 0
  for (let n = 0; n < o.total; n++) {
    if (o.señal?.aborted) return { estado: 'cancelado', escritos }
    await esperarHueco(o, tamaño)
    if (o.señal?.aborted) return { estado: 'cancelado', escritos }
    await o.pintar(n)
    const fotograma = await o.capturar(n)
    if (o.señal?.aborted) return { estado: 'cancelado', escritos }
    if (fotograma.length !== tamaño) {
      const e: ErrorTrabajo = {
        codigo: 'PERFIL_NO_SOPORTADO',
        mensaje: `El fotograma ${n} tiene ${fotograma.length} bytes y se esperaban ${tamaño}`,
        reintentable: false
      }
      throw e
    }
    o.destino.write(fotograma)
    escritos++
    o.alFotograma?.(n)
  }
  return { estado: 'completo', escritos }
}

/** Espera `drain` mientras haya más de 2 fotogramas pendientes; se libera también al cancelar. */
function esperarHueco(o: OpcionesBucle, tamaño: number): Promise<void> {
  if (o.destino.writableLength <= FOTOGRAMAS_PENDIENTES_MAX * tamaño) return Promise.resolve()
  return new Promise((resolver) => {
    const listo = (): void => {
      o.señal?.removeEventListener('abort', listo)
      o.destino.off?.('drain', listo)
      resolver()
    }
    o.señal?.addEventListener('abort', listo, { once: true })
    o.destino.once('drain', listo)
  })
}
