import { Check, RefreshCw } from 'lucide-react'
import { Icono } from '../componentes/Icono'
import { useTrabajosVivos } from '../trabajos/useTrabajos'
import estilos from './marco.module.css'

/** `act.boton`: "{n} en curso · {m} en cola", omitiendo la parte que vale 0. */
export function textoActividad(enCurso: number, enCola: number): string {
  const partes: string[] = []
  if (enCurso > 0) partes.push(`${enCurso} en curso`)
  if (enCola > 0) partes.push(`${enCola} en cola`)
  return partes.join(' · ')
}

/**
 * Indicador de actividad de la barra superior (docs/ux/04 §2): visible solo con trabajos en
 * curso o en cola; al terminar todos, "✓ Terminado" 4 s. Es informativo: el panel desplegable
 * con "Ir"/"Cancelar" llega con la vista de progreso (Fase 3), así que por ahora no es un botón.
 */
export function IndicadorActividad() {
  const { trabajos, terminado } = useTrabajosVivos()
  const enCurso = trabajos.filter((t) => t.estado === 'en_curso').length
  const enCola = trabajos.filter((t) => t.estado === 'en_cola').length
  const hayActivos = enCurso + enCola > 0
  if (!hayActivos && !terminado) return null
  return (
    <div role="status" className={estilos.actividad} data-actividad>
      {hayActivos ? (
        <>
          <Icono icono={RefreshCw} tamano={16} className={estilos.actividadIcono} />
          <span>{textoActividad(enCurso, enCola)}</span>
        </>
      ) : (
        <>
          <Icono icono={Check} tamano={16} />
          <span>Terminado</span>
        </>
      )}
    </div>
  )
}
