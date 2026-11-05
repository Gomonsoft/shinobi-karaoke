import { useState } from 'react'
import { Check, ChevronLeft, Circle, CircleX, RefreshCw, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ResumenCancionIpc } from '@shared/ipc'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { InsigniaEstado } from '../../componentes/InsigniaEstado'
import { Tooltip } from '../../componentes/Tooltip'
import { useNavegacion, type PasoCancion } from '../../navegacion/estado'
import { marcarProgresoVisto } from '../../navegacion/progresoVisto'
import { useTrabajosVivos } from '../../trabajos/useTrabajos'
import type { TrabajoVivo } from '../biblioteca/tarjeta'
import { pasosDeCancion, pasosDeNueva, type DatosPaso, type IndicadorPaso } from './pasos'
import estilos from './cabecera.module.css'

const ICONOS: Record<IndicadorPaso, LucideIcon> = {
  completado: Check,
  curso: RefreshCw,
  error: CircleX,
  interrumpido: TriangleAlert,
  actual: Circle,
  pendiente: Circle
}

interface CabeceraCancionProps {
  /** `null` = modo "Nueva canción" (aún no existe la canción). */
  resumen: ResumenCancionIpc | null
  /** Paso de la vista que muestra la cabecera. */
  actual: PasoCancion
}

function Paso({ datos, onIr }: { datos: DatosPaso; onIr: () => void }) {
  const [forzar, setForzar] = useState(false)
  const Ic = ICONOS[datos.indicador]
  const boton = (
    <button
      type="button"
      className={`${estilos.paso} ${estilos[`ind_${datos.indicador}`]}`}
      aria-current={datos.actual ? 'step' : undefined}
      aria-disabled={datos.navegable ? undefined : true}
      aria-label={`Paso ${datos.numero}, ${datos.etiqueta}, ${datos.descripcion}`}
      onBlur={() => setForzar(false)}
      onClick={() => {
        if (datos.navegable) onIr()
        else setForzar(true)
      }}
    >
      <span className={estilos.circulo} aria-hidden="true">
        <Icono icono={Ic} tamano={datos.indicador === 'actual' ? 10 : 14} />
      </span>
      <span className={estilos.etiqueta} aria-hidden="true">
        {datos.etiqueta}
        {datos.detalle && <span className={estilos.detalle}> {datos.detalle}</span>}
      </span>
    </button>
  )
  return (
    <li className={estilos.item}>
      {datos.motivo ? (
        <Tooltip contenido={datos.motivo} forzar={forzar}>
          {boton}
        </Tooltip>
      ) : (
        boton
      )}
    </li>
  )
}

/**
 * Cabecera compartida del espacio de canción (docs/ux/00 §2): "‹ Biblioteca", título · artista,
 * estado de guardado y stepper de 4 pasos.
 */
export function CabeceraCancion({ resumen, actual }: CabeceraCancionProps) {
  const { ir } = useNavegacion()
  const { trabajos, progreso } = useTrabajosVivos()

  let pasos: DatosPaso[]
  if (resumen === null) {
    pasos = pasosDeNueva()
  } else {
    const vivo = (paso: 'fuente' | 'separacion'): TrabajoVivo | null => {
      const t = trabajos.find((x) => x.cancionId === resumen.id && x.paso === paso)
      return t ? { trabajo: t, progreso: progreso[t.id] ?? null } : null
    }
    pasos = pasosDeCancion(resumen, actual, {
      fuente: vivo('fuente'),
      separacion: vivo('separacion')
    })
  }

  return (
    <div className={estilos.cabecera}>
      <div className={estilos.fila}>
        <Boton variante="fantasma" onClick={() => ir({ tipo: 'biblioteca' })}>
          <Icono icono={ChevronLeft} tamano={16} />
          Biblioteca
        </Boton>
        <p className={estilos.titulo}>
          {resumen === null ? (
            'Nueva canción'
          ) : (
            <>
              «{resumen.titulo}»
              {resumen.artista !== '' && (
                <span className={estilos.artista}> · {resumen.artista}</span>
              )}
            </>
          )}
        </p>
        {resumen !== null &&
          (resumen.estado === 'lista' ? (
            <InsigniaEstado estado="lista" />
          ) : (
            <InsigniaEstado estado="borrador" texto="Borrador · guardado ✓" />
          ))}
      </div>
      <nav aria-label="Pasos de la canción">
        <ol className={estilos.pasos}>
          {pasos.map((p) => (
            <Paso
              key={p.paso}
              datos={p}
              onIr={() => {
                if (!resumen) return
                if (actual === 'progreso' && p.paso === 'letra') marcarProgresoVisto(resumen.id)
                ir({ tipo: 'cancion', id: resumen.id, paso: p.paso })
              }}
            />
          ))}
        </ol>
      </nav>
    </div>
  )
}
