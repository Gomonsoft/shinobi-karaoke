import { CircleX, Clock, RefreshCw, TriangleAlert, type LucideIcon } from 'lucide-react'
import { BarraProgreso } from '../../componentes/BarraProgreso'
import { Icono } from '../../componentes/Icono'
import type { LineaPasoDatos, TipoLinea } from './tarjeta'
import estilos from './biblioteca.module.css'

const ICONOS: Partial<Record<TipoLinea, LucideIcon>> = {
  curso: RefreshCw,
  cola: Clock,
  error: CircleX,
  aviso: TriangleAlert
}

/** Línea informativa bajo la insignia: icono + texto (el color nunca es el único portador). */
export function LineaPaso({ linea }: { linea: LineaPasoDatos }) {
  const icono = ICONOS[linea.tipo]
  return (
    <div className={estilos.paso}>
      <p className={`${estilos.linea} ${estilos[`linea_${linea.tipo}`]}`}>
        {icono && <Icono icono={icono} tamano={16} />}
        <span>{linea.texto}</span>
      </p>
      {linea.barra !== undefined && (
        <BarraProgreso
          etiqueta={linea.texto}
          valor={linea.barra ?? 0}
          indeterminada={linea.barra === null}
        />
      )}
    </div>
  )
}
