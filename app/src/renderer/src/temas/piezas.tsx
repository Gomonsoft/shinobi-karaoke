import { useId, useState, type ReactNode } from 'react'
import { Boton } from '../componentes/Boton'
import comunes from '../componentes/componentes.module.css'
import { TEMA, tituloYArtista } from './textos'
import estilos from './temas.module.css'

interface FilaImpacto {
  id: string
  titulo: string
  artista: string
}

interface ListaProps<T extends FilaImpacto> {
  canciones: readonly T[]
  /** Contenido propio de cada fila (por defecto, «título — artista»). */
  fila?(c: T): ReactNode
}

/** «Ver las canciones»: revelador (`aria-expanded`) con lista de hasta 8 filas visibles y scroll. */
export function ListaCancionesImpacto<T extends FilaImpacto>({ canciones, fila }: ListaProps<T>) {
  const [visible, setVisible] = useState(false)
  const id = useId()
  if (canciones.length === 0) return null
  return (
    <div className={estilos.ancho}>
      <Boton
        variante="fantasma"
        className={estilos.revelador}
        aria-expanded={visible}
        aria-controls={id}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? `▾ ${TEMA.ocultarCanciones}` : `▸ ${TEMA.verCanciones}`}
      </Boton>
      {visible && (
        // eslint-disable-next-line jsx-a11y/no-redundant-roles -- role explícito: Safari quita la semántica con list-style none
        <ul
          id={id}
          role="list"
          className={estilos.cajaLista}
          tabIndex={canciones.length > 8 ? 0 : undefined}
        >
          {canciones.map((c) => (
            <li key={c.id} className={estilos.filaCancion}>
              <span className={estilos.filaTexto}>
                {fila ? fila(c) : tituloYArtista(c.titulo, c.artista)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface ProgresoProps {
  progreso: { hechas: number; total: number } | null
  texto(i: number, n: number): string
}

/**
 * Progreso con más de 5 canciones. El texto visible avanza en cada paso (`aria-hidden`); la región
 * `role="status"` solo cambia al empezar y al terminar, para no anunciar cada paso.
 */
export function ProgresoOperacion({ progreso, texto }: ProgresoProps) {
  const [anunciado, setAnunciado] = useState<string | null>(null)
  if (!progreso || progreso.total <= 5) return null
  const actual = texto(progreso.hechas, progreso.total)
  const fin = progreso.hechas >= progreso.total
  if (anunciado === null || (fin && anunciado !== actual)) setAnunciado(actual)
  return (
    <>
      <p aria-hidden="true" className={estilos.progreso}>
        {actual}
      </p>
      <p role="status" className={comunes.soloLector}>
        {anunciado ?? actual}
      </p>
    </>
  )
}
