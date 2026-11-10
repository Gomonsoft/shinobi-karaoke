import { Boton } from '../componentes/Boton'
import { TEMA, AJ_TEMAS, nombreCancion, tituloYArtista } from './textos'
import type { FalloAMitad } from './useOperacionTema'
import estilos from './temas.module.css'

export type TextoFallo = { clave: 'eliminar' } | { clave: 'ninguno'; anterior: string }

interface Props {
  fallo: FalloAMitad
  /** `tema.eliminar.parcial` o `aj.temas.ninguno.parcial` (con el nombre del predeterminado). */
  texto: TextoFallo
}

/**
 * Lista de canciones tras un fallo a mitad (spec 06, 0056). El foco va a [Reintentar], que aporta el
 * diálogo contenedor. Solo las filas `error` y `pendiente`, en el orden del resultado.
 */
export function ListaFalloAMitad({ fallo, texto }: Props) {
  const principal =
    texto.clave === 'eliminar'
      ? TEMA.eliminar.parcial(nombreCancion(fallo.fallida.titulo), fallo.f)
      : AJ_TEMAS.quitar.parcial(nombreCancion(fallo.fallida.titulo), fallo.f, texto.anterior)
  const hayPendientes = fallo.filas.some((f) => f.estado === 'pendiente')

  return (
    <div className={estilos.ancho}>
      <p role="alert" className={estilos.texto}>
        {principal}
      </p>
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- role explícito: Safari quita la semántica con list-style none */}
      <ul
        role="list"
        className={estilos.cajaLista}
        tabIndex={fallo.filas.length > 8 ? 0 : undefined}
      >
        {fallo.filas.map((fila) =>
          fila.estado === 'error' ? (
            <li
              key={fila.id}
              className={estilos.filaCancion}
              aria-label={TEMA.parcial.nombreError(fila.titulo, fila.artista)}
            >
              <span aria-hidden="true" className={`${estilos.simbolo} ${estilos.simboloError}`}>
                ✕
              </span>
              <span className={estilos.filaTexto}>
                {tituloYArtista(fila.titulo, fila.artista)} · {TEMA.parcial.filaError}
              </span>
              <Boton
                variante="fantasma"
                onClick={() => void navigator.clipboard?.writeText(fila.codigo ?? '')}
              >
                {TEMA.copiarDetalles}
              </Boton>
            </li>
          ) : (
            <li
              key={fila.id}
              className={`${estilos.filaCancion} ${estilos.filaPendiente}`}
              aria-label={TEMA.parcial.nombrePendiente(fila.titulo, fila.artista)}
            >
              <span aria-hidden="true" className={estilos.simbolo}>
                –
              </span>
              <span className={estilos.filaTexto}>
                {tituloYArtista(fila.titulo, fila.artista)} · {TEMA.parcial.filaPendiente}
              </span>
            </li>
          )
        )}
      </ul>
      {hayPendientes && <p className={estilos.nota3}>{TEMA.parcial.notaPendientes}</p>}
    </div>
  )
}
