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
}

/** `role="alert"` solo para errores; el resto es `status` (educado). */
export function AvisoEnLinea({ tipo, children, accion }: AvisoEnLineaProps) {
  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`${estilos.banner} ${estilos[tipo]}`}
    >
      <Icono icono={ICONOS[tipo]} className={estilos.bannerIcono} />
      <div className={estilos.bannerTexto}>{children}</div>
      {accion}
    </div>
  )
}
