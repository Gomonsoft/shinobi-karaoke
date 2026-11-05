/**
 * Espera `promesa`, pero se rinde en cuanto `señal` se aborta (rechaza con `CANCELADO`) sin
 * cancelar la promesa: la actualización de yt-dlp sigue en silencio (preguntas/0014 §1a).
 * Si `promesa` falla, rechaza con `errorSiFalla` (el error original que motivó la espera).
 */
export function esperarCancelable<T>(
  promesa: Promise<T>,
  señal: AbortSignal,
  errorSiFalla: unknown
): Promise<T> {
  return new Promise<T>((ok, fallo) => {
    const alAbortar = (): void =>
      fallo({ codigo: 'CANCELADO', mensaje: 'Cancelado', reintentable: false })
    if (señal.aborted) {
      promesa.catch(() => undefined)
      alAbortar()
      return
    }
    señal.addEventListener('abort', alAbortar, { once: true })
    void promesa
      .then(ok, () => fallo(errorSiFalla))
      .finally(() => señal.removeEventListener('abort', alAbortar))
  })
}
