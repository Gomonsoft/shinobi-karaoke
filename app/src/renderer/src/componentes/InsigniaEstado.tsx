import { Check, CircleX, Clock, FileX, Pencil, RefreshCw, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Icono } from './Icono'
import estilos from './componentes.module.css'

export type EstadoInsignia =
  'lista' | 'borrador' | 'en-curso' | 'en-cola' | 'interrumpido' | 'error' | 'danada'

const DEFINICION: Record<
  EstadoInsignia,
  { texto: string; icono: LucideIcon; color: 'exito' | 'aviso' | 'error' | 'info' }
> = {
  lista: { texto: 'Lista', icono: Check, color: 'exito' },
  borrador: { texto: 'Borrador', icono: Pencil, color: 'aviso' },
  'en-curso': { texto: 'En curso', icono: RefreshCw, color: 'info' },
  'en-cola': { texto: 'En cola', icono: Clock, color: 'info' },
  interrumpido: { texto: 'Interrumpido', icono: TriangleAlert, color: 'aviso' },
  error: { texto: 'Error', icono: CircleX, color: 'error' },
  danada: { texto: 'Dañada', icono: FileX, color: 'error' }
}

interface InsigniaEstadoProps {
  estado: EstadoInsignia
  /** Sustituye el texto estándar, p. ej. "Separando 42 %". El icono se mantiene. */
  texto?: string
}

/** Icono + texto siempre: el color nunca es el único portador de significado. */
export function InsigniaEstado({ estado, texto }: InsigniaEstadoProps) {
  const d = DEFINICION[estado]
  return (
    <span className={`${estilos.insignia} ${estilos[d.color]}`}>
      <Icono icono={d.icono} tamano={14} />
      {texto ?? d.texto}
    </span>
  )
}
