import { R } from '../textos'
import estilos from './sesion.module.css'

/** «A continuación» (S1 y S2 con candidata). Decorativa: el anuncio `aria-live` la describe. */
export function TarjetaSiguiente({ titulo, artista }: { titulo: string; artista: string }) {
  return (
    <div className={estilos.tarjeta} aria-hidden="true" data-testid="tarjeta-siguiente">
      <div className={estilos.tarjetaEtiqueta}>{R.cola.aContinuacion}</div>
      <div className={estilos.tarjetaTitulo}>{titulo}</div>
      <div className={estilos.tarjetaArtista}>{artista}</div>
    </div>
  )
}
