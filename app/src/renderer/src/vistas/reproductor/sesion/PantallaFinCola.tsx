import { RotateCcw, X } from 'lucide-react'
import { Icono } from '../../../componentes/Icono'
import { R } from '../textos'
import estilos from '../reproductor.module.css'
import estilosSesion from './sesion.module.css'

/** S3. Como la pantalla final: título, artista y píldora; sin cuenta de cierre. */
export function PantallaFinCola({
  titulo,
  artista,
  visible,
  alOtraVez,
  alCerrar
}: {
  titulo: string
  artista: string
  visible: boolean
  alOtraVez(): void
  alCerrar(): void
}) {
  return (
    <div className={estilos.pantallaFinal} data-testid="fin-de-cola">
      <div className={estilos.tituloFinal}>{titulo}</div>
      <div className={estilos.artistaFinal}>{artista}</div>
      <span className={`${estilos.pildora} ${estilosSesion.pildoraFin}`}>{R.cola.fin}</span>
      <div
        className={`${estilos.accionesFinal} ${visible ? '' : estilosSesion.invisible}`}
        inert={!visible}
      >
        <button className={`foco-doble ${estilos.botonFinal}`} type="button" onClick={alOtraVez}>
          <Icono icono={RotateCcw} /> {R.cola.otraVez}
        </button>
        <button className={`foco-doble ${estilos.botonFinal}`} type="button" onClick={alCerrar}>
          <Icono icono={X} /> {R.cola.cerrar}
        </button>
      </div>
    </div>
  )
}
