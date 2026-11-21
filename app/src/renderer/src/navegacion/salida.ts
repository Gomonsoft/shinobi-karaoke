import type { Vista } from './estado'

export type GuardaSalida = (destino: Vista) => Promise<boolean>
type Vaciado = () => Promise<boolean>

export function crearNavegacionGuardada(navegar: (v: Vista) => void) {
  let guarda: GuardaSalida | null = null
  let esperando = false

  return {
    ir(destino: Vista, alNavegar?: () => void): void {
      if (esperando) return
      const actual = guarda
      if (!actual) {
        navegar(destino)
        alNavegar?.()
        return
      }
      esperando = true
      void Promise.resolve()
        .then(() => actual(destino))
        .then((aceptar) => {
          if (aceptar && guarda === actual) {
            navegar(destino)
            alNavegar?.()
          }
        })
        .catch(() => undefined)
        .finally(() => {
          esperando = false
        })
    },
    registrarGuardaSalida(fn: GuardaSalida): () => void {
      guarda = fn
      return () => {
        if (guarda === fn) guarda = null
      }
    }
  }
}

let vaciado: Vaciado | null = null

export function registrarVaciadoAlCerrar(fn: Vaciado): () => void {
  vaciado = fn
  return () => {
    if (vaciado === fn) vaciado = null
  }
}

export async function vaciarAlCerrar(topeMs = 2000): Promise<void> {
  if (!vaciado) return
  let plazo: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      vaciado(),
      new Promise<void>((resolver) => {
        plazo = setTimeout(resolver, topeMs)
      })
    ])
  } catch {
    // La ventana continúa el cierre tras el intento de vaciado.
  } finally {
    clearTimeout(plazo)
  }
}

type DecisionBorrador = () => Promise<boolean>
let borradorAlCerrar: DecisionBorrador | null = null

/**
 * Borrador de tema sin guardar (0171, ADR 0016 §10): al cerrar la ventana, el editor pregunta con
 * `tema.dialogo.salir`. La función devuelve `true` si se puede cerrar y `false` si el usuario
 * decide seguir editando.
 */
export function registrarBorradorAlCerrar(fn: DecisionBorrador): () => void {
  borradorAlCerrar = fn
  return () => {
    if (borradorAlCerrar === fn) borradorAlCerrar = null
  }
}

/** `true` si no hay borrador de tema o el usuario acepta cerrar (guardando o descartando). */
export async function confirmarBorradorAlCerrar(): Promise<boolean> {
  if (!borradorAlCerrar) return true
  try {
    return await borradorAlCerrar()
  } catch {
    return false
  }
}
