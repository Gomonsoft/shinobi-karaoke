import type { DialogoArchivos } from './archivo'

/** Variable de entorno que sustituye el selector nativo de archivos en las pruebas E2E (0046). */
export const VARIABLE_DIALOGO_PRUEBAS = 'SHINOBI_DIALOGO_PRUEBAS'

/**
 * Devuelve un diálogo que no abre ninguna ventana nativa si `SHINOBI_DIALOGO_PRUEBAS` está
 * definida: su valor es la ruta que "elige" el usuario, o `cancelar` para simular que cancela.
 * Se ignora siempre en la app empaquetada (ADR 0009 §8).
 */
export function dialogoConDoblePruebas(
  real: DialogoArchivos,
  opciones: { env: NodeJS.ProcessEnv; empaquetada: boolean }
): DialogoArchivos {
  const valor = opciones.env[VARIABLE_DIALOGO_PRUEBAS]
  if (opciones.empaquetada || !valor) return real
  return {
    showOpenDialog: () =>
      Promise.resolve(
        valor === 'cancelar'
          ? { canceled: true, filePaths: [] }
          : { canceled: false, filePaths: [valor] }
      )
  }
}
