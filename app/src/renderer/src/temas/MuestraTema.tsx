import type { CSSProperties } from 'react'
import type { Estilo } from '@shared/estilo'
import { variablesEstilo } from '../karaoke/estiloCss'
import estilos from './temas.module.css'

interface Props {
  estilo: Estilo
  /** 48 × 27 (selectores, resumen) o 64 × 36 (lista de Ajustes). */
  tamano?: 48 | 64
}

/** Muestra 16:9 de un tema: fondo, «Aa» en su fuente y color de letra. Decorativa. */
export function MuestraTema({ estilo, tamano = 48 }: Props) {
  return (
    <span
      aria-hidden="true"
      data-muestra-tema=""
      className={`${estilos.muestra} ${tamano === 64 ? estilos.m64 : estilos.m48}`}
      style={variablesEstilo(estilo) as CSSProperties}
    >
      Aa
    </span>
  )
}
