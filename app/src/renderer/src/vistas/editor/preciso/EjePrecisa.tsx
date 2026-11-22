import type { ReactNode } from 'react'
import css from './preciso.module.css'

/** Contenedor posicionado: regla, onda, tira y tiradores comparten su ancho (el eje de tiempo de la vista). */
export function EjePrecisa({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={[css.eje, className].filter(Boolean).join(' ')}>{children}</div>
}
