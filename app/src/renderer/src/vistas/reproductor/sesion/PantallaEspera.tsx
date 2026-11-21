import { R } from '../textos'
import { TarjetaSiguiente } from './TarjetaSiguiente'
import estilos from './sesion.module.css'

/** S2. Con candidata solo la tarjeta; sin ella, marca y mensaje sobre `fondo-0`. */
export function PantallaEspera({
  candidata
}: {
  candidata: { titulo: string; artista: string } | null
}) {
  if (candidata) return <TarjetaSiguiente {...candidata} />
  return (
    <div className={estilos.esperaVacia} data-testid="espera-vacia">
      <div className={estilos.marca} aria-hidden="true">
        ◆ Shinobi Karaoke
      </div>
      <div className={estilos.mensajeEspera}>{R.cola.espera}</div>
    </div>
  )
}
