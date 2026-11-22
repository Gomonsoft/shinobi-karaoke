import { estirarTramo, type VelocidadEstiramiento } from './estiramiento'

export interface PeticionEstiramiento {
  canales: Float32Array[]
  sampleRate: number
  velocidad: VelocidadEstiramiento
}

export type RespuestaEstiramiento = { canales: Float32Array[] } | { error: string }

self.onmessage = (evento: MessageEvent<PeticionEstiramiento>) => {
  const { canales, sampleRate, velocidad } = evento.data
  try {
    const salida = estirarTramo(canales, sampleRate, velocidad)
    const respuesta: RespuestaEstiramiento = { canales: salida }
    ;(self as unknown as Worker).postMessage(
      respuesta,
      salida.map((canal) => canal.buffer)
    )
  } catch (e) {
    const respuesta: RespuestaEstiramiento = { error: e instanceof Error ? e.message : String(e) }
    ;(self as unknown as Worker).postMessage(respuesta)
  }
}
