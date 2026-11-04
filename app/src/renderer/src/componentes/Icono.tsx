import type { LucideIcon } from 'lucide-react'

interface IconoProps {
  /** Componente de Lucide, p. ej. `Play`. */
  icono: LucideIcon
  /** 20 px en la interfaz, 28 px en el reproductor (§5). */
  tamano?: number
  /** Si se da, el icono es significativo (role="img"); si no, es decorativo (aria-hidden). */
  etiqueta?: string
  className?: string
}

export function Icono({ icono: Componente, tamano = 20, etiqueta, className }: IconoProps) {
  return (
    <Componente
      size={tamano}
      strokeWidth={1.75}
      color="currentColor"
      className={className}
      {...(etiqueta ? { role: 'img', 'aria-label': etiqueta } : { 'aria-hidden': true })}
    />
  )
}
