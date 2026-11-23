import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Icono } from '../../componentes/Icono'
import { Tooltip } from '../../componentes/Tooltip'
import { P } from './partes'
import estilos from './editor.module.css'

interface Props {
  /** Chip de la parte común de la selección; `null` con partes distintas («Varias»). */
  chip: ReactNode | null
  /** Nombre de la parte («Luis», «Coro») o «Varias». */
  etiqueta: string
  /** Menú «¿Quién canta?» abierto desde este botón. */
  abierto: boolean
  /** Sin él (modo al ritmo, sesión bloqueada) el botón queda `aria-disabled`. */
  abrir?(origen: HTMLElement): void
  /** Riel del panel minimizado: solo el chip. */
  compacto?: boolean
}

/**
 * Fila «Canta» del panel Sincronía y chip del riel (spec 06 · 0.2.3): botón de menú que abre
 * «¿Quién canta?». Su nombre accesible dice la parte completa («Canta: Luis»).
 */
export function BotonCanta({ chip, etiqueta, abierto, abrir, compacto = false }: Props) {
  const nombre = P.chip(etiqueta)
  const boton = (
    <button
      type="button"
      className={compacto ? estilos.botonCantaRiel : estilos.botonCanta}
      aria-haspopup="menu"
      aria-expanded={abierto}
      aria-label={nombre}
      aria-keyshortcuts="C"
      aria-disabled={abrir ? undefined : true}
      data-boton-canta=""
      onClick={(e) => abrir?.(e.currentTarget)}
    >
      {chip}
      {!compacto && <span className={estilos.botonCantaTexto}>{etiqueta}</span>}
      {!compacto && <Icono icono={ChevronDown} tamano={16} />}
    </button>
  )
  return compacto ? <Tooltip contenido={nombre}>{boton}</Tooltip> : boton
}
