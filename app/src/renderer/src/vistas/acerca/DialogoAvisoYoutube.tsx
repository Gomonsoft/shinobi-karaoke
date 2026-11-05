import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import estilos from './acerca.module.css'
import { AVISO_YOUTUBE, TEXTOS_ACERCA as T } from './textos'

/** Aviso legal de YouTube de solo lectura, con la fecha de aceptación (`ux/08`). */
export function DialogoAvisoYoutube({
  aceptadoEn,
  alCerrar
}: {
  /** ISO 8601 o `null` si no se ha aceptado. */
  aceptadoEn: string | null
  alCerrar: () => void
}) {
  return (
    <Dialogo
      abierto
      titulo={AVISO_YOUTUBE.titulo}
      onCancelar={alCerrar}
      enfoqueInicial="[data-cerrar]"
      acciones={
        <Boton data-cerrar variante="primario" onClick={alCerrar}>
          {T.cerrar}
        </Boton>
      }
    >
      <div className={estilos.bloque}>
        <p>{AVISO_YOUTUBE.intro}</p>
        <ul className={estilos.aviso}>
          {AVISO_YOUTUBE.puntos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p>
          <strong>{fraseAceptacion(aceptadoEn)}</strong>
        </p>
      </div>
    </Dialogo>
  )
}

export function fraseAceptacion(iso: string | null): string {
  if (!iso) return T.noAceptado
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return T.noAceptado
  return T.aceptadoEl(
    fecha.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
  )
}
