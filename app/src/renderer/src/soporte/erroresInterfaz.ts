/**
 * Errores de la interfaz hacia `app.log` (tarea 0396, incidencia I-1): `window.onerror`, promesas rechazadas y
 * los que atrapa el límite de errores de React. Solo se envía el mensaje, la pila y dos datos de contexto (vista e
 * id de la canción): nunca el contenido de la letra. Main vuelve a validar y limita; aquí además se evita repetir
 * el mismo error en bucle para no saturar el canal.
 */
import type { ErrorRendererIpc } from '../../../shared/ipc'

export interface ContextoError {
  vista?: string
  cancionId?: string
}

const MAX_MENSAJE = 500
const MAX_PILA = 3000
const MAX_ENVIOS = 30

let contexto: ContextoError = {}
let enviados = 0
let ultimo = ''

export function fijarContextoError(nuevo: ContextoError): void {
  contexto = nuevo
}

export function leerContextoError(): ContextoError {
  return contexto
}

/** Solo para las pruebas. */
export function reiniciarErroresInterfaz(): void {
  contexto = {}
  enviados = 0
  ultimo = ''
}

const recortar = (t: string, max: number): string =>
  t.length > max ? `${t.slice(0, max - 1)}…` : t

function describir(e: unknown): { mensaje: string; pila?: string } {
  if (e instanceof Error) {
    return {
      mensaje: recortar(`${e.name}: ${e.message}`, MAX_MENSAJE),
      ...(e.stack ? { pila: recortar(e.stack, MAX_PILA) } : {})
    }
  }
  let texto: string
  try {
    texto = typeof e === 'string' ? e : (JSON.stringify(e) ?? String(e))
  } catch {
    texto = String(e)
  }
  return { mensaje: recortar(texto, MAX_MENSAJE) }
}

/** Manda el error a `app.log`. Nunca lanza, ni siquiera sin puente o con el canal roto. */
export function informarError(
  origen: ErrorRendererIpc['origen'],
  error: unknown,
  componentes?: string | null
): void {
  try {
    const { mensaje, pila } = describir(error)
    // El mismo error seguido y los envíos de más: se descartan aquí; main aplica además su propio límite.
    const huella = `${origen}|${mensaje}`
    if (huella === ultimo || enviados >= MAX_ENVIOS) return
    ultimo = huella
    enviados++
    const carga: ErrorRendererIpc = {
      origen,
      mensaje,
      ...(pila ? { pila } : {}),
      ...(componentes ? { componentes: recortar(componentes.trim(), MAX_PILA) } : {}),
      ...(contexto.vista ? { vista: contexto.vista } : {}),
      ...(contexto.cancionId ? { cancionId: contexto.cancionId } : {})
    }
    void window.shinobi?.app?.registrarError(carga)?.catch(() => undefined)
  } catch {
    // informar un error nunca debe provocar otro
  }
}

/** Engancha `onerror` y `unhandledrejection`; devuelve la función que los quita. */
export function instalarCapturaErrores(): () => void {
  const alError = (ev: ErrorEvent): void => informarError('onerror', ev.error ?? ev.message)
  const alRechazo = (ev: PromiseRejectionEvent): void => informarError('promesa', ev.reason)
  window.addEventListener('error', alError)
  window.addEventListener('unhandledrejection', alRechazo)
  return () => {
    window.removeEventListener('error', alError)
    window.removeEventListener('unhandledrejection', alRechazo)
  }
}
