import { Users } from 'lucide-react'
import type { Letra } from '@shared/letra'
import { inicial, type Parte } from '@shared/reparto'
import estilos from './coloresPartes.module.css'

/** Píldora con la inicial de la parte y borde en su color (sistema visual · 0.2.3). El color nunca va solo. */
export function ChipParte({
  letra,
  parte,
  color
}: {
  letra: Pick<Letra, 'partes'>
  parte: Parte
  color: string
}) {
  const valor = inicial(letra, parte)
  return (
    <span className={estilos.chip} style={{ borderColor: color }} data-chip-parte={parte}>
      {valor.tipo === 'texto' ? valor.texto : <Users size={14} aria-hidden="true" />}
    </span>
  )
}
