/**
 * Errores no capturados del proceso principal (tarea 0391, ADR 0027 revisión «Seguridad de los paquetes»).
 * Se registran y la app sigue (sin el diálogo de error de Electron): los trabajos largos viven en el worker o tienen su
 * propio manejo, y tumbar main perdería el diario y las escrituras en curso. En modo estricto (E2E y Vitest) se
 * vuelve a lanzar para que la prueba falle en vez de esconder el error.
 */
export interface OpcionesErroresGlobales {
  registrar(nivel: 'error', modulo: string, mensaje: string): void
  estricto: boolean
  /** Sustituibles en las pruebas. */
  proceso?: Pick<NodeJS.Process, 'on'>
  relanzar?(e: unknown): void
}

let instalado = false

const texto = (e: unknown): string =>
  e instanceof Error ? (e.stack ?? `${e.name}: ${e.message}`) : String(e)

/** Instala los dos oyentes; devuelve `false` si ya estaban instalados (una sola vez por proceso). */
export function instalarErroresGlobales(o: OpcionesErroresGlobales): boolean {
  if (instalado) return false
  instalado = true
  const proceso = o.proceso ?? process
  const relanzar =
    o.relanzar ??
    ((e: unknown): void => {
      throw e
    })
  const alError = (tipo: string) => (e: unknown) => {
    o.registrar('error', 'proceso', `${tipo}: ${texto(e)}`)
    if (o.estricto) relanzar(e)
  }
  proceso.on('uncaughtException', alError('error no capturado'))
  proceso.on('unhandledRejection', alError('promesa rechazada sin manejar'))
  return true
}

/** Solo para las pruebas. */
export function reiniciarErroresGlobales(): void {
  instalado = false
}
