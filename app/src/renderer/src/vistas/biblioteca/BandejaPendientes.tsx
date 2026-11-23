import { CircleAlert, CircleX, ListChecks, type LucideIcon } from 'lucide-react'
import { Icono } from '../../componentes/Icono'
import { BIB_PREP, type CasillaBandeja } from './textosPreparacion'
import estilos from './biblioteca.module.css'

const CASILLAS: { id: CasillaBandeja; icono: LucideIcon; texto: (n: number) => string }[] = [
  { id: 'revisar', icono: ListChecks, texto: BIB_PREP.bandeja.revisar },
  { id: 'letra', icono: CircleAlert, texto: BIB_PREP.bandeja.letra },
  { id: 'error', icono: CircleX, texto: BIB_PREP.bandeja.error }
]

interface Props {
  cuentas: Record<CasillaBandeja, number>
  activa: CasillaBandeja | null
  alAlternar(casilla: CasillaBandeja): void
}

/**
 * «Pendientes de ti» (docs/ux/02 · Feature 5): botones de alternancia bajo la barra de herramientas.
 * Solo salen las casillas con 1 o más canciones; sin ninguna, la fila no existe.
 */
export function BandejaPendientes({ cuentas, activa, alAlternar }: Props) {
  const visibles = CASILLAS.filter((c) => cuentas[c.id] > 0)
  if (visibles.length === 0) return null
  return (
    <div role="group" aria-label={BIB_PREP.bandeja.titulo} className={estilos.bandeja}>
      <span className={`t-pequeno ${estilos.bandejaTitulo}`} aria-hidden="true">
        {BIB_PREP.bandeja.titulo}
      </span>
      {visibles.map((c) => (
        <button
          key={c.id}
          type="button"
          className={estilos.casillaBandeja}
          aria-pressed={activa === c.id}
          data-casilla={c.id}
          onClick={() => alAlternar(c.id)}
        >
          <Icono icono={c.icono} tamano={16} />
          {c.texto(cuentas[c.id])}
        </button>
      ))}
    </div>
  )
}
