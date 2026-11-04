/** Mensaje legible de un error de la IPC (`{codigo, mensaje}`) o de cualquier otro valor lanzado. */
export function mensajeDeError(err: unknown): string {
  if (err && typeof err === 'object' && 'mensaje' in err && typeof err.mensaje === 'string') {
    return err.mensaje
  }
  return err instanceof Error ? err.message : ''
}

/** Texto para "Copiar detalles". */
export function detallesDeError(err: unknown): string {
  const codigo =
    err && typeof err === 'object' && 'codigo' in err && typeof err.codigo === 'string'
      ? `${err.codigo}: `
      : ''
  return `${codigo}${mensajeDeError(err)}`.trim() || 'Error desconocido'
}
