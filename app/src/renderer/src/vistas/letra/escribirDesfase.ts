import { quitarCorreccion } from '@shared/encaje'
import type { ResumenCancionIpc } from '@shared/ipc'
import type { Letra } from '@shared/letra'
import { aPeticionTiempos } from '@shared/letras/tiempos'

type Correccion = Pick<Letra, 'offset_ms' | 'desfase_corregido_ms'>

/**
 * Cambia `offset_ms` y `desfase_corregido_ms` de la letra guardada fuera del editor (vista Letra, toast
 * de la corrección diferida): `abrirEdicion` → `guardarTiempos` → `cerrarEdicion`, el camino de cualquier
 * otra escritura de tiempos (ADR 0024, revisión de la pregunta 0210). Ningún tiempo de línea cambia;
 * main retira `revisada` si cambia el offset y aquí se refleja igual.
 */
export async function escribirDesfaseGuardado(
  cancionId: string,
  calcular: (guardada: Letra) => Correccion
): Promise<{ resumen: ResumenCancionIpc; letra: Letra }> {
  const abierta = await window.shinobi.letras.abrirEdicion(cancionId)
  if (!abierta?.cancion.letra) throw new Error('sin letra')
  const { sesionId } = abierta
  try {
    const guardada = abierta.cancion.letra
    // La corrección define los dos campos: sin `desfase_corregido_ms` se borra el que hubiera.
    const c = calcular(guardada)
    const nueva: Letra = { ...guardada, offset_ms: c.offset_ms }
    if (c.desfase_corregido_ms === undefined) delete nueva.desfase_corregido_ms
    else nueva.desfase_corregido_ms = c.desfase_corregido_ms
    const resumen = await window.shinobi.letras.guardarTiempos(
      aPeticionTiempos(cancionId, nueva),
      sesionId
    )
    const letra: Letra =
      nueva.offset_ms === guardada.offset_ms
        ? nueva
        : {
            ...nueva,
            lineas: nueva.lineas.map((l) => {
              const resto = { ...l }
              delete resto.revisada
              return resto
            })
          }
    return { resumen, letra }
  } finally {
    void window.shinobi.letras.cerrarEdicion(sesionId).catch(() => undefined)
  }
}

/** «Quitar la corrección» / [Deshacer] del toast de la corrección diferida. */
export const quitarCorreccionGuardada = (cancionId: string) =>
  escribirDesfaseGuardado(cancionId, quitarCorreccion)
