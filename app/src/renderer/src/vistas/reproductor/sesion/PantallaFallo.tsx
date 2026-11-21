import { SkipForward, TriangleAlert, X } from 'lucide-react'
import { Icono } from '../../../componentes/Icono'
import { R } from '../textos'
import estilos from '../reproductor.module.css'
import estilosSesion from './sesion.module.css'

/** S4: mensaje breve para el público; la causa técnica está en la principal. */
export function PantallaFallo({
  titulo,
  hayPendientes,
  visible,
  alPasar,
  alCerrar
}: {
  titulo: string | null
  hayPendientes: boolean
  visible: boolean
  alPasar(): void
  alCerrar(): void
}) {
  return (
    <div className={estilosSesion.fallo} role="alert" data-testid="fallo">
      <p className={estilosSesion.falloTexto}>
        <Icono icono={TriangleAlert} className={estilosSesion.falloIcono} /> {R.cola.fallo}
        {!hayPendientes && ` ${R.cola.falloFin}`}
      </p>
      {titulo && <p className={estilosSesion.falloTitulo}>«{titulo}»</p>}
      <div
        className={`${estilos.accionesFinal} ${visible ? '' : estilosSesion.invisible}`}
        inert={!visible}
      >
        {hayPendientes && (
          <button className={`foco-doble ${estilos.botonFinal}`} type="button" onClick={alPasar}>
            <Icono icono={SkipForward} /> {R.cola.pasar}
          </button>
        )}
        <button className={`foco-doble ${estilos.botonFinal}`} type="button" onClick={alCerrar}>
          <Icono icono={X} /> {R.cola.cerrar}
        </button>
      </div>
    </div>
  )
}
