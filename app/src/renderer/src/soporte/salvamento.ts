/**
 * Lo pendiente del editor cuando la interfaz falla (spec «Pantalla de error de la interfaz», «El trabajo del
 * editor»). El límite de errores llama a `iniciarSalvamento()` en cuanto atrapa un fallo, antes de que React
 * ejecute las limpiezas de la vista desmontada: así el lote pendiente se envía (hoy `destruir()` lo descartaría) y
 * la pantalla de error sabe si quedó guardado. Sin dependencias de React ni de la app: la pantalla de error no usa
 * contextos.
 */
import { useSyncExternalStore } from 'react'

export type EstadoSalvamento = 'ninguno' | 'guardando' | 'guardado' | 'fallo'

/** Tope de espera de «Volver a cargar» al guardado en vuelo (spec: 2 s). */
export const TOPE_SALVAMENTO_MS = 2000

type Salvador = () => Promise<boolean>
const salvadores = new Set<Salvador>()
const oyentes = new Set<() => void>()
let estado: EstadoSalvamento = 'ninguno'
let enCurso: Promise<void> | null = null

function fijar(nuevo: EstadoSalvamento): void {
  if (estado === nuevo) return
  estado = nuevo
  oyentes.forEach((o) => o())
}

/** Una vista con trabajo sin enviar se apunta aquí mientras está montada; devuelve cómo quitarse. */
export function registrarSalvador(salvador: Salvador): () => void {
  salvadores.add(salvador)
  return () => void salvadores.delete(salvador)
}

/** Se dispara una sola vez por fallo; sin salvadores, queda «guardado» (nada pendiente). */
export function iniciarSalvamento(): Promise<void> {
  if (enCurso) return enCurso
  const lista = [...salvadores]
  if (lista.length === 0) {
    fijar('guardado')
    return (enCurso = Promise.resolve())
  }
  fijar('guardando')
  enCurso = Promise.all(
    // Síncrono: el salvador lee la sesión de edición, que las limpiezas de React cierran en este mismo turno.
    lista.map((s) => {
      try {
        return Promise.resolve(s()).catch(() => false)
      } catch {
        return Promise.resolve(false)
      }
    })
  ).then((resultados) => fijar(resultados.every(Boolean) ? 'guardado' : 'fallo'))
  return enCurso
}

/** Espera al salvamento en marcha, como mucho `topeMs`. Sin salvamento, vuelve al momento. */
export function esperarSalvamento(topeMs = TOPE_SALVAMENTO_MS): Promise<void> {
  if (!enCurso) return Promise.resolve()
  return Promise.race([enCurso, new Promise<void>((resolver) => setTimeout(resolver, topeMs))])
}

/** `true` mientras hay un fallo atendido y la vista aún no se ha vuelto a montar. */
export function hayFalloDeInterfaz(): boolean {
  return enCurso !== null
}

/** Al volver a montar la vista o navegar a otra: el siguiente fallo empieza de cero. */
export function reiniciarSalvamento(): void {
  enCurso = null
  fijar('ninguno')
}

export function useEstadoSalvamento(): EstadoSalvamento {
  return useSyncExternalStore(
    (cb) => {
      oyentes.add(cb)
      return () => void oyentes.delete(cb)
    },
    () => estado
  )
}
