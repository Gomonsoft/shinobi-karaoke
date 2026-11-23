import type { IniciarLoteExportacion } from '../../shared/ipc'

export type SiExiste = IniciarLoteExportacion['siExiste']
export type AccionNombre = 'nuevo' | 'numerar' | 'sustituir' | 'omitir'

/** Lo que se sabe de un nombre candidato: otra exportación (o del lote) lo usa; ya hay un archivo así. */
export interface SondeoNombre {
  ocupado: boolean
  existe: boolean
}

export interface NombreElegido {
  /** `null` si se omite la canción (`siExiste: "omitir"`). */
  nombre: string | null
  accion: AccionNombre
  /** Ya había un archivo con el nombre propuesto en la carpeta. */
  existe: boolean
}

/** `Nombre.mkv` → `Nombre (2).mkv`; `n === 1` es el nombre tal cual. */
export function nombreNumerado(base: string, n: number): string {
  if (n === 1) return base
  const punto = base.lastIndexOf('.')
  const raiz = punto < 0 ? base : base.slice(0, punto)
  const ext = punto < 0 ? '' : base.slice(punto)
  return `${raiz} (${n})${ext}`
}

/**
 * Regla de nombres del lote de exportación (ADR 0026 §5), la misma para `iniciarLote` y para la
 * previsualización: un nombre usado por otra exportación o por otra canción del lote se numera siempre;
 * uno que ya existe en la carpeta se numera, se sustituye o se omite según `siExiste`. «Sustituir» solo
 * pisa el nombre exacto, nunca un « (2)» que no es suyo. La función no toca el disco: el sondeo se lo da.
 */
export async function elegirNombre(
  base: string,
  siExiste: SiExiste,
  sondear: (nombre: string) => Promise<SondeoNombre>
): Promise<NombreElegido> {
  let existeBase = false
  for (let n = 1; n < 10_000; n++) {
    const nombre = nombreNumerado(base, n)
    const s = await sondear(nombre)
    if (n === 1) existeBase = s.existe
    if (s.ocupado) continue
    if (s.existe && n === 1 && siExiste === 'omitir') {
      return { nombre: null, accion: 'omitir', existe: true }
    }
    if (s.existe && !(n === 1 && siExiste === 'sustituir')) continue
    const accion: AccionNombre = n > 1 ? 'numerar' : s.existe ? 'sustituir' : 'nuevo'
    return { nombre, accion, existe: existeBase }
  }
  throw new Error('No se encontró un nombre libre.')
}
