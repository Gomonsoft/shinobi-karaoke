import { generarPicos } from '@shared/__fixtures__/picos'
import { MAX_BLOQUES_PICOS, type ApiShinobi, type EstadoPicos } from '@shared/ipc'
import type { ElementoLetra } from '@shared/letra'

/** Dobles de picos de voz sintéticos para probar la comprobación de la letra (feature 4). */
export const DURACION_PICOS_MS = 60_000
export const GENERACION_PICOS = 'a'.repeat(64)

/** Cantos de duración irregular y determinista: [inicio, fin) en tiempo de audio. */
export function cantosDeEjemplo(n = 12): [number, number][] {
  const r: [number, number][] = []
  let t = 3000
  for (let i = 0; i < n; i++) {
    const dur = 1500 + ((i * 7919) % 5) * 500
    const hueco = 800 + ((i * 104729) % 4) * 400
    r.push([t, t + dur])
    t += dur + hueco
  }
  return r
}

/** Líneas inventadas sobre los cantos, adelantadas `desfaseMs` (positivo = salen antes que la voz). */
export function lineasSobreCantos(cantos: [number, number][], desfaseMs = 0): ElementoLetra[] {
  return cantos.map(([a, b], i) => ({
    id: `p${i}`,
    tipo: 'linea',
    texto: `Verso inventado ${i + 1}`,
    inicio_ms: a - desfaseMs,
    fin_ms: b - desfaseMs,
    palabras: null
  }))
}

/** `picos` de la API con la voz sobre los cantos; `estado` distinto de `lista` no sirve lecturas. */
export function apiPicosFalsa(
  cantos: [number, number][],
  estado: EstadoPicos['estado'] = 'lista'
): ApiShinobi['picos'] {
  const { pares } = generarPicos({
    duracionMs: DURACION_PICOS_MS,
    tramos: cantos.map(([desdeMs, hastaMs]) => ({ desdeMs, hastaMs, dbfs: -6 }))
  })
  return {
    solicitar: () =>
      Promise.resolve(
        estado === 'lista' ? { estado: 'lista' as const, generacion: GENERACION_PICOS } : { estado }
      ),
    leer: ({ inicioMs, finMs }) => {
      const desde = Math.round(inicioMs / 10)
      const hasta = Math.min(Math.round(finMs / 10), pares.length / 2, desde + MAX_BLOQUES_PICOS)
      if (desde >= hasta) return Promise.resolve(null)
      const trozo = pares.slice(desde * 2, hasta * 2)
      const bytes = new Uint8Array(trozo.length * 2)
      const datos = new DataView(bytes.buffer)
      trozo.forEach((v, i) => datos.setInt16(i * 2, v, true))
      return Promise.resolve({
        generacion: GENERACION_PICOS,
        pasoMs: 10,
        primerBloque: desde,
        bytes
      })
    }
  } as ApiShinobi['picos']
}
