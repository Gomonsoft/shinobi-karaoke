import type { CSSProperties } from 'react'
import { Users } from 'lucide-react'
import type { Estilo } from '@shared/estilo'
import type { Letra } from '@shared/letra'
import { colorDeParte, inicial, type Parte } from '@shared/reparto'
import { Icono } from '../../componentes/Icono'
import { etiquetaParte, P } from './partes'
import estilos from './editor.module.css'

interface Props {
  letra: Pick<Letra, 'partes'>
  /** Colores de las partes; no hace falta si se da `color`. */
  estilo?: Pick<Estilo, 'letra'>
  parte: Parte
  /** Color explícito (p. ej. el que se está eligiendo en Estilo): sustituye al del estilo. */
  color?: string
  /** Sin nombre accesible propio (la fila o el botón que lo contiene ya dice «Canta: …»). */
  decorativo?: boolean
  className?: string
}

/**
 * Chip de parte (spec 06 · 0.2.3): la inicial (o «( )», o el icono `users`) en `texto-1` y un borde de
 * 2 px en el color de la parte. El color es solo refuerzo: la inicial es la señal.
 */
export function ChipParte({
  letra,
  estilo,
  parte,
  color,
  decorativo = false,
  className = ''
}: Props) {
  const marca = inicial(letra, parte)
  const nombre = P.chip(etiquetaParte(letra, parte))
  return (
    <span
      className={`${estilos.chipParte} ${className}`}
      style={
        {
          '--color-parte': color ?? (estilo ? colorDeParte(estilo, parte) : undefined)
        } as CSSProperties
      }
      data-parte={parte}
      {...(decorativo ? { 'aria-hidden': true } : { role: 'img', 'aria-label': nombre })}
    >
      {marca.tipo === 'texto' ? marca.texto : <Icono icono={Users} tamano={14} />}
    </span>
  )
}
