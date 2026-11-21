import { useEffect, useRef } from 'react'
import { estadoCasilla } from './useSeleccion'
import { SEL } from './textosSeleccion'
import estilos from './biblioteca.module.css'

interface Props {
  nombreGrupo: string
  /** Canciones visibles y editables del grupo. */
  ids: readonly string[]
  seleccion: ReadonlySet<string>
  /** Marca todas si no lo estaban; si lo estaban, las desmarca. */
  alAlternar(ids: readonly string[], marcar: boolean): void
}

/** Casilla tri-estado del encabezado de grupo (`bib.sel.grupo`). */
export function CasillaGrupo({ nombreGrupo, ids, seleccion, alAlternar }: Props) {
  const entrada = useRef<HTMLInputElement>(null)
  const estado = estadoCasilla(ids, seleccion)
  const vacia = ids.length === 0
  useEffect(() => {
    if (entrada.current) entrada.current.indeterminate = estado === 'algunas'
  }, [estado])
  return (
    <input
      ref={entrada}
      type="checkbox"
      className={estilos.casillaGrupo}
      aria-label={SEL.grupo(nombreGrupo)}
      aria-disabled={vacia || undefined}
      title={vacia ? SEL.noEditable : undefined}
      checked={estado === 'todas'}
      onChange={() => {
        if (!vacia) alAlternar(ids, estado !== 'todas')
      }}
    />
  )
}
