import type { VelocidadEstiramiento } from './estiramiento'
import type { PeticionEstiramiento, RespuestaEstiramiento } from './estiramiento.worker'

/**
 * Estira un tramo en un Web Worker de módulo (servido desde 'self'; ADR 0021 §9).
 * Toma posesión de los `Float32Array` recibidos: sus buffers se transfieren al worker.
 * Cancelable con `signal`: termina el worker y rechaza con `AbortError`.
 */
export function estirarEnWorker(
  canales: Float32Array[],
  sampleRate: number,
  velocidad: VelocidadEstiramiento,
  signal?: AbortSignal
): Promise<Float32Array[]> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelado', 'AbortError'))
    const worker = new Worker(new URL('./estiramiento.worker.ts', import.meta.url), {
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
    worker.onmessage = (evento: MessageEvent<RespuestaEstiramiento>) => {
      terminar()
      if ('error' in evento.data) reject(new Error(evento.data.error))
      else resolve(evento.data.canales)
    }
    worker.onerror = (evento) => {
      terminar()
      reject(new Error(evento.message || 'Falló el worker de estiramiento'))
    }
    const peticion: PeticionEstiramiento = { canales, sampleRate, velocidad }
    worker.postMessage(
      peticion,
      canales.map((canal) => canal.buffer)
    )
  })
}
