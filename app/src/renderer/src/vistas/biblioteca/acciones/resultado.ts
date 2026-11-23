import type { ResultadoVariasIpc } from '@shared/ipc'
import type { FilaCancion } from './ListaCanciones'
import { ACC, motivoDe } from './textos'

type Resultado = ResultadoVariasIpc['resultados'][number]

/**
 * ¿Algo fue mal o quedó sin hacer? Una omitida por `NADA_QUE_HACER` (ya tenía el dato) se vio en la
 * confirmación y no cuenta; cualquier otra omisión o error sí (se muestra el resultado por canción).
 */
export const esProblema = (r: Resultado): boolean =>
  r.resultado === 'error' || (r.resultado === 'omitida' && r.motivo !== 'NADA_QUE_HACER')

export const hechas = (r: ResultadoVariasIpc): number =>
  r.resultados.filter((x) => x.resultado === 'hecho').length

/** Ids de las `error`: lo que «Reintentar las que faltan» vuelve a previsualizar. */
export const falladas = (r: ResultadoVariasIpc): string[] =>
  r.resultados.filter((x) => x.resultado === 'error').map((x) => x.id)

/** Fila de resultado con icono y texto (✓ hecho, – omitida, ✕ error); `fallo` es el texto del ✕. */
export function filaDeResultado(
  r: Resultado,
  nombre: { texto: string; aria: string },
  fallo: string
): FilaCancion {
  const nota =
    r.resultado === 'hecho'
      ? ACC.resultado.hecho
      : r.resultado === 'omitida'
        ? // El texto de `EDICION_BLOQUEADA` ya dice «No se ha cambiado»: va sin el prefijo «Omitida:».
          r.motivo === 'EDICION_BLOQUEADA'
          ? motivoDe(r.motivo)
          : ACC.resultado.omitida(motivoDe(r.motivo))
        : fallo
  return {
    id: r.id,
    texto: nombre.texto,
    nota,
    simbolo: r.resultado === 'hecho' ? '✓' : r.resultado === 'error' ? '✕' : '–',
    aria: `${nombre.aria}: ${nota}`
  }
}
