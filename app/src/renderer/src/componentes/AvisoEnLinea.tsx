import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { Icono } from './Icono'
import estilos from './componentes.module.css'

export type TipoAviso = 'info' | 'aviso' | 'error' | 'exito'

const ICONOS = { info: Info, aviso: TriangleAlert, error: CircleAlert, exito: CircleCheck }

interface AvisoEnLineaProps {
  tipo: TipoAviso
  children: ReactNode
  /** Acción opcional (un `Boton` o enlace). */
  accion?: ReactNode
  /** Las acciones van en una fila bajo el texto (listas estrechas: la acción no se corta ni se esconde). */
  accionesAbajo?: boolean
}

/** `role="alert"` solo para errores; el resto es `status` (educado). */
export function AvisoEnLinea({ tipo, children, accion, accionesAbajo }: AvisoEnLineaProps) {
  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`${estilos.banner} ${estilos[tipo]} ${accionesAbajo ? estilos.bannerApilado : ''}`}
    >
      <Icono icono={ICONOS[tipo]} className={estilos.bannerIcono} />
      <div className={estilos.bannerTexto}>{children}</div>
      {accionesAbajo && accion ? <div className={estilos.bannerAcciones}>{accion}</div> : accion}
    </div>
  )
}
