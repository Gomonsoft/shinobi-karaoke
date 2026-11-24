import type { PuntoEnvolvente } from '@shared/coros'
import type { PeticionMezclaCoros, RespuestaMezclaCoros } from './mezclaCoros.worker'

/**
 * Calcula el «instrumental con coros» en un Web Worker de módulo (ADR 0030 §4). Toma posesión de los
 * `Float32Array` recibidos (sus buffers se transfieren, sin copiar). Cancelable con `signal`: termina el
 * worker y rechaza con `AbortError`; un fallo del worker (también `onerror`) rechaza con `Error`.
 */
export function mezclarCorosEnWorker(
  instrumental: Float32Array[],
  voz: Float32Array[],
  sampleRate: number,
  puntos: PuntoEnvolvente[],
  signal?: AbortSignal
): Promise<Float32Array[]> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelado', 'AbortError'))
    const worker = new Worker(new URL('./mezclaCoros.worker.ts', import.meta.url), {
      type: 'module'
    })
    const terminar = (): void => {
      signal?.removeEventListener('abort', cancelar)
      worker.terminate()
    }
    const cancelar = (): void => {
      terminar()
      reject(new DOMException('Cancelado', 'AbortError'))
    }
    signal?.addEventListener('abort', cancelar, { once: true })
    worker.onmessage = (evento: MessageEvent<RespuestaMezclaCoros>) => {
      terminar()
      if ('error' in evento.data) reject(new Error(evento.data.error))
      else resolve(evento.data.canales)
    }
    worker.onerror = (evento) => {
      terminar()
      reject(new Error(evento.message || 'Falló el worker de la mezcla de coros'))
    }
    const peticion: PeticionMezclaCoros = { instrumental, voz, sampleRate, puntos }
    worker.postMessage(
      peticion,
      [...instrumental, ...voz].map((canal) => canal.buffer)
    )
  })
}
