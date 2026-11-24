/**
 * Errores de la interfaz en `app.log` (tarea 0396, incidencia I-1). Antes un error de renderizado dejaba la ventana
 * en negro sin rastro. Aquí llegan, por un canal IPC ya validado, los que atrapa el renderer (`onerror`,
 * promesas rechazadas, límite de errores de React) y, directamente desde el `webContents`, lo que el renderer no
 * puede contar: proceso caído, sin respuesta, error del preload y errores de consola.
 *
 * Un bucle de errores no debe llenar el disco: como máximo `MAX_POR_VENTANA` líneas por ventana de tiempo y
 * `MAX_TOTAL` por sesión; lo que sobra se cuenta y se anota una sola vez al abrirse la siguiente ventana.
 */
import type { ErrorRendererIpc } from '../../shared/ipc'
import type { RegistroApp } from './registroApp'

export const MAX_POR_VENTANA = 10
export const VENTANA_MS = 60_000
export const MAX_TOTAL = 200
const MAX_CONSOLA = 400
const MODULO = 'renderer'

export interface RegistroErroresRenderer {
  registrar(error: ErrorRendererIpc): void
  /** Eventos propios del proceso (caído, sin respuesta…): pasan por el mismo limitador. */
  aviso(nivel: 'aviso' | 'error', texto: string): void
}

export function crearRegistroErroresRenderer(
  registro: RegistroApp,
  ahora: () => number = Date.now
): RegistroErroresRenderer {
  let inicioVentana = -Infinity
  let enVentana = 0
  let omitidos = 0
  let total = 0
  let avisadoTotal = false

  /** `true` si se puede escribir ahora. */
  const permitir = (): boolean => {
    const t = ahora()
    if (t - inicioVentana >= VENTANA_MS) {
      if (omitidos > 0) {
        registro.escribir(
          'aviso',
          MODULO,
          `se omitieron ${omitidos} errores por límite de frecuencia`
        )
        omitidos = 0
      }
      inicioVentana = t
      enVentana = 0
    }
    if (total >= MAX_TOTAL) {
      if (!avisadoTotal) {
        avisadoTotal = true
        registro.escribir(
          'aviso',
          MODULO,
          `límite de ${MAX_TOTAL} errores por sesión: no se registran más`
        )
      }
      return false
    }
    if (enVentana >= MAX_POR_VENTANA) {
      omitidos++
      return false
    }
    enVentana++
    total++
    return true
  }

  return {
    registrar(e) {
      if (!permitir()) return
      const contexto = [
        e.vista ? `vista=${e.vista}` : '',
        e.cancionId ? `cancion=${e.cancionId}` : ''
      ]
        .filter(Boolean)
        .join(' ')
      const partes = [`${e.origen}: ${e.mensaje}`]
      if (contexto) partes.push(contexto)
      if (e.pila) partes.push(`pila: ${e.pila}`)
      if (e.componentes) partes.push(`componentes: ${e.componentes}`)
      registro.escribir('error', MODULO, partes.join(' | '))
    },
    aviso(nivel, texto) {
      if (!permitir()) return
      registro.escribir(nivel, MODULO, texto)
    }
  }
}

/** Lo mínimo del `webContents` que se vigila (sustituible en las pruebas). */
export interface ContenidoRegistrable {
  on(
    evento: 'render-process-gone',
    cb: (e: unknown, d: { reason: string; exitCode: number }) => void
  ): unknown
  on(evento: 'unresponsive' | 'responsive', cb: () => void): unknown
  on(evento: 'preload-error', cb: (e: unknown, ruta: string, error: Error) => void): unknown
  on(
    evento: 'console-message',
    cb: (d: { level: string; message: string; lineNumber: number; sourceId: string }) => void
  ): unknown
}

/** Engancha los eventos del `webContents` que explican una ventana en negro o congelada. */
export function vigilarContenidoParaRegistro(
  contenido: ContenidoRegistrable,
  registro: RegistroErroresRenderer
): void {
  contenido.on('render-process-gone', (_e, d) =>
    registro.aviso(
      'error',
      `el proceso de la interfaz se perdió: motivo=${d.reason} codigo=${d.exitCode}`
    )
  )
  contenido.on('unresponsive', () => registro.aviso('aviso', 'la interfaz no responde'))
  contenido.on('responsive', () => registro.aviso('aviso', 'la interfaz vuelve a responder'))
  contenido.on('preload-error', (_e, ruta, error) =>
    registro.aviso('error', `error del preload (${ruta}): ${error.stack ?? error.message}`)
  )
  contenido.on('console-message', (d) => {
    if (d.level !== 'error') return
    const origen = d.sourceId ? ` (${d.sourceId.split(/[\\/]/).pop()}:${d.lineNumber})` : ''
    registro.aviso('error', `consola: ${d.message.slice(0, MAX_CONSOLA)}${origen}`)
  })
}
