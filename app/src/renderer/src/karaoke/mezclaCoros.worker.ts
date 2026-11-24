import type { PuntoEnvolvente } from '@shared/coros'
import { mezclarCoros } from './mezclaCoros'

export interface PeticionMezclaCoros {
  instrumental: Float32Array[]
  voz: Float32Array[]
  sampleRate: number
  puntos: PuntoEnvolvente[]
}

export type RespuestaMezclaCoros = { canales: Float32Array[] } | { error: string }

self.onmessage = (evento: MessageEvent<PeticionMezclaCoros>) => {
  const { instrumental, voz, sampleRate, puntos } = evento.data
  try {
    const salida = mezclarCoros(instrumental, voz, sampleRate, puntos)
    const respuesta: RespuestaMezclaCoros = { canales: salida }
    ;(self as unknown as Worker).postMessage(
      respuesta,
      salida.map((canal) => canal.buffer)
    )
  } catch (e) {
    const respuesta: RespuestaMezclaCoros = { error: e instanceof Error ? e.message : String(e) }
    ;(self as unknown as Worker).postMessage(respuesta)
  }
}
