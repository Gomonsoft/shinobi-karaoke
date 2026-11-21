import { lineaVersion } from '@shared/compilacion'

/** `sistema.info()` se pide una sola vez; si falla, se vuelve a intentar en la siguiente copia. */
let linea: Promise<string | null> | null = null

function pedirLinea(): Promise<string | null> {
  linea ??= Promise.resolve()
    .then(() => window.shinobi.sistema.info())
    .then((i) => lineaVersion(i.version, i.compilacion))
    .catch(() => {
      linea = null
      return null
    })
  return linea
}

/** Añade `Versión: {identificador}` como última línea (spec 08, AC6). Sin datos, deja el texto. */
export async function conLineaVersion(texto: string): Promise<string> {
  const v = await pedirLinea()
  if (!v) return texto
  const base = texto.replace(/\s+$/, '')
  return base ? `${base}\n${v}` : v
}

/** Todo «Copiar detalles» pasa por aquí. Rechaza si el portapapeles falla. */
export async function copiarDetalles(texto: string): Promise<void> {
  await navigator.clipboard?.writeText(await conLineaVersion(texto))
}

/** Solo para pruebas: olvida la línea guardada. */
export function olvidarLineaVersion(): void {
  linea = null
}
