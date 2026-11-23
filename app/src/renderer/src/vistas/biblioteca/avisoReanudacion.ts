import { useSyncExternalStore } from 'react'

/**
 * Aviso de la Biblioteca al reabrir con preparaciones a medias (docs/ux/02 · Feature 5): retomadas
 * (`bib.prep.retomando`) o en pausa (`bib.prep.enPausa`). Vive fuera de la vista porque el evento
 * `preparacion:reanudada` puede llegar antes de que la Biblioteca esté montada.
 */
export interface AvisoReanudacion {
  tipo: 'retomando' | 'pausa'
  n: number
}

let aviso: AvisoReanudacion | null = null
const oyentes = new Set<() => void>()

function fijar(nuevo: AvisoReanudacion | null): void {
  aviso = nuevo
  oyentes.forEach((o) => o())
}

/** Suscribe el almacén a main (una vez, desde `main.tsx`). Devuelve la baja. */
export function iniciarAvisoReanudacion(): () => void {
  const api = window.shinobi?.preparacion
  if (!api) return () => undefined
  const bajaReanudada = api.alReanudar(({ total }) => {
    // La pausa guardada se reanuda en pausa: `config.preparacion.pausada` lo dice.
    void window.shinobi.config.obtener().then(
      (c) => fijar({ tipo: c.preparacion?.pausada ? 'pausa' : 'retomando', n: total }),
      () => fijar({ tipo: 'retomando', n: total })
    )
  })
  // «Se cierra solo cuando terminan».
  const bajaTanda = api.alTanda((t) => {
    if (aviso?.tipo === 'retomando' && (!t || t.terminadas >= t.total)) fijar(null)
  })
  return () => {
    bajaReanudada()
    bajaTanda()
  }
}

export interface ControlAvisoReanudacion {
  aviso: AvisoReanudacion | null
  cerrar(): void
  /** [Detener]: pausa la cola y pasa al aviso de pausa. */
  detener(): Promise<void>
  /** [Reanudar]: retoma la cola. */
  reanudar(): Promise<void>
}

const suscribir = (cb: () => void): (() => void) => {
  oyentes.add(cb)
  return () => oyentes.delete(cb)
}

export function useAvisoReanudacion(): ControlAvisoReanudacion {
  const actual = useSyncExternalStore(suscribir, () => aviso)
  return {
    aviso: actual,
    cerrar: () => fijar(null),
    detener: async () => {
      const n = aviso?.n ?? 0
      await window.shinobi.preparacion.pausar()
      fijar({ tipo: 'pausa', n })
    },
    reanudar: async () => {
      const n = aviso?.n ?? 0
      await window.shinobi.preparacion.reanudar()
      fijar({ tipo: 'retomando', n })
    }
  }
}

/** Solo para pruebas. */
export function publicarAvisoReanudacion(nuevo: AvisoReanudacion | null): void {
  fijar(nuevo)
}
