import { finEfectivo, type ElementoLetra, type Letra } from '../letra'

const mismasPalabras = (a: ElementoLetra, b: ElementoLetra): boolean =>
  JSON.stringify(a.palabras) === JSON.stringify(b.palabras)

const mismosTiempos = (a: ElementoLetra, b: ElementoLetra): boolean =>
  a.inicio_ms === b.inicio_ms && a.fin_ms === b.fin_ms && mismasPalabras(a, b)

/**
 * Reglas de escritura de main sobre los campos opcionales de la letra (ADR 0024 §2 y §4,
 * ADR 0028 §3.3). Compara `nueva` con la letra guardada (`previa`, null si no había) y
 * devuelve una copia sin los campos que ya no valen:
 * - `intacta`: se retira si cambia algún inicio, fin o palabras respecto a la previa.
 * - `origen_fin`: se retira sin `fin_ms` (o en una pausa).
 * - `revisada`: se retira si inicio, fin efectivo o texto ya no coinciden con su instantánea.
 * - `alineacion`: se retira si es la misma de la previa y cambian los tiempos o el texto de la línea
 *   (si la escritura la renueva, se respeta).
 * No modifica las entradas.
 */
export function retirarCamposObsoletos(
  previa: Letra | null,
  nueva: Letra,
  duracionMs: number
): Letra {
  const antes = new Map((previa?.lineas ?? []).map((l) => [l.id, l]))
  const resultado: Letra = { ...nueva }

  if (resultado.intacta && previa) {
    const ahora = new Map(nueva.lineas.map((l) => [l.id, l]))
    const cambio =
      nueva.lineas.some((l) => {
        const a = antes.get(l.id)
        return a ? !mismosTiempos(a, l) : l.inicio_ms !== null
      }) ||
      previa.lineas.some((a) => {
        const l = ahora.get(a.id)
        return !l && a.inicio_ms !== null
      })
    if (cambio) delete resultado.intacta
  }

  resultado.lineas = nueva.lineas.map((linea) => {
    const copia: ElementoLetra = { ...linea }
    if (copia.fin_ms === null || copia.tipo === 'pausa') delete copia.origen_fin
    if (copia.tipo === 'pausa') {
      delete copia.revisada
      delete copia.alineacion
      return copia
    }
    if (copia.revisada) {
      const r = copia.revisada
      const fin = finEfectivo(nueva, copia.id, duracionMs)
      if (copia.inicio_ms !== r.inicio_ms || fin !== r.fin_ms || copia.texto !== r.texto) {
        delete copia.revisada
      }
    }
    if (copia.alineacion) {
      const a = antes.get(copia.id)
      const igual = a && JSON.stringify(a.alineacion) === JSON.stringify(copia.alineacion)
      if (a && igual && (!mismosTiempos(a, copia) || a.texto !== copia.texto)) {
        delete copia.alineacion
      }
    }
    return copia
  })
  return resultado
}
