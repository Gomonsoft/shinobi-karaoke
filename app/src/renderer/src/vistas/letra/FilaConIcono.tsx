import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icono } from '../../componentes/Icono'
import estilos from './letra.module.css'

/** Icono de 16 px a la izquierda del texto, en la misma línea (sistema visual §5); nunca solo color. */
export function FilaConIcono({
  icono,
  className = '',
  children
}: {
  icono: LucideIcon | null
  className?: string
  children: ReactNode
}) {
  return (
    <span className={`${estilos.conIcono} ${className}`}>
      {icono && <Icono icono={icono} tamano={16} className={estilos.iconoFila} />}
      <span>{children}</span>
    </span>
  )
}
