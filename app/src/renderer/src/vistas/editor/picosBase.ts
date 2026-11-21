import { MAX_BLOQUES_PICOS, type ApiShinobi } from '../../../../shared/ipc'

const PASO_BASE_MS = 10
const VENTANA_MS = MAX_BLOQUES_PICOS * PASO_BASE_MS

export type ResultadoPicosBase =
  | { estado: 'lista'; generacion: string; pasoMs: 10; pares: Int16Array }
  | { estado: 'no_disponible' | 'generando' | 'error' }

type ApiPicos = { picos: Pick<ApiShinobi['picos'], 'solicitar' | 'leer'> }

const memo = new Map<string, Extract<ResultadoPicosBase, { estado: 'lista' }>>()

/** Vacía el memo de la visita (para pruebas o al cerrar el editor). */
export function olvidarPicosBase(): void {
  memo.clear()
}

type Pasada = ResultadoPicosBase | 'cambio'

async function leerUnaVez(
  api: ApiPicos,
  cancionId: string,
  duracionMs: number,
  signal?: AbortSignal
): Promise<Pasada> {
  const estado = await api.picos.solicitar(cancionId)
  if (estado.estado !== 'lista') return { estado: estado.estado }
  const { generacion } = estado
  const enMemo = memo.get(`${cancionId}:${generacion}`)
  if (enMemo) return enMemo

  const trozos: Int16Array[] = []
  for (let k = 0; k * VENTANA_MS < duracionMs; k++) {
    if (signal?.aborted) return { estado: 'error' }
    const lectura = await api.picos.leer({
      cancionId,
      inicioMs: k * VENTANA_MS,
      finMs: (k + 1) * VENTANA_MS,
      presupuesto: MAX_BLOQUES_PICOS
    })
    if (signal?.aborted) return { estado: 'error' }
    if (lectura === null) break
    if (lectura.generacion !== generacion) return 'cambio'
    if (lectura.pasoMs !== PASO_BASE_MS || lectura.primerBloque !== k * MAX_BLOQUES_PICOS) {
      return { estado: 'error' }
    }
    const { bytes } = lectura
    const datos = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const par = new Int16Array(bytes.length / 2)
    for (let i = 0; i < par.length; i++) par[i] = datos.getInt16(i * 2, true)
    trozos.push(par)
  }

  const pares = new Int16Array(trozos.reduce((n, t) => n + t.length, 0))
  let pos = 0
  for (const t of trozos) {
    pares.set(t, pos)
    pos += t.length
  }
  const resultado = { estado: 'lista' as const, generacion, pasoMs: PASO_BASE_MS as 10, pares }
  memo.set(`${cancionId}:${generacion}`, resultado)
  return resultado
}

/** Lee el nivel base completo (bloques de 10 ms) de la caché de picos de una canción. */
export async function leerPicosBase(
  api: ApiPicos,
  cancionId: string,
  duracionMs: number,
  opciones: { signal?: AbortSignal } = {}
): Promise<ResultadoPicosBase> {
  for (let intento = 0; intento < 2; intento++) {
    const r = await leerUnaVez(api, cancionId, duracionMs, opciones.signal)
    if (r !== 'cambio') return r
  }
  return { estado: 'generando' }
}
