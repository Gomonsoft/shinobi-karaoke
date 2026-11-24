import { useEffect, useState } from 'react'
import temas from '../../../temas/temas.module.css'
import estilos from '../biblioteca.module.css'

export interface FilaCancion {
  id: string
  /** «{título} — {artista}» con lo que añada la acción (estado, etc.). */
  texto: string
  /** Nombre accesible: «{título}, {artista}: {nota}». */
  aria: string
  nota?: string
  /** Aviso con ⚠ en la nota (no solo color). */
  aviso?: boolean
  /** Las que no aplican van al final, en `texto-3`. */
  atenuada?: boolean
  /** Icono de resultado: ✓, ✕ o –. */
  simbolo?: '✓' | '✕' | '–'
  extra?: React.ReactNode
}

/** Pasado este tiempo sin vista previa, la lista se pinta en esqueleto (`bib.acc.calculando`). */
export const RETARDO_ESQUELETO_MS = 300

/** Lista de canciones de un diálogo de lote: scroll propio hasta 280 px, atenuadas al final. */
export function ListaCanciones({
  filas,
  calculando = false,
  etiqueta
}: {
  filas: FilaCancion[]
  calculando?: boolean
  etiqueta: string
}) {
  const [esqueleto, setEsqueleto] = useState(false)
  useEffect(() => {
    if (!calculando) return
    const t = setTimeout(() => setEsqueleto(true), RETARDO_ESQUELETO_MS)
    return () => {
      clearTimeout(t)
      setEsqueleto(false)
    }
  }, [calculando])

  if (calculando && filas.length === 0) {
    return esqueleto ? (
      <div className={temas.cajaLista} aria-hidden="true" data-esqueleto-lote>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${estilos.esqueletoLinea} ${estilos.brillo}`} />
        ))}
      </div>
    ) : null
  }
  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- role explícito: Safari quita la semántica con list-style none
    <ul
      role="list"
      aria-label={etiqueta}
      className={temas.cajaLista}
      style={{ maxHeight: '17.5rem' }}
      tabIndex={filas.length > 4 ? 0 : undefined}
    >
      {filas.map((f) => (
        <li
          key={f.id}
          aria-label={f.aria}
          className={`${temas.filaCancion} ${estilos.filaLote} ${f.atenuada ? temas.filaPendiente : ''}`}
        >
          {f.simbolo && (
            <span
              aria-hidden="true"
              className={`${temas.simbolo} ${f.simbolo === '✕' ? temas.simboloError : f.simbolo === '✓' ? estilos.simboloExito : ''}`}
            >
              {f.simbolo}
            </span>
          )}
          <span className={temas.filaTexto}>
            <span className={estilos.tituloLote}>{f.texto}</span>
            {f.nota && (
              <span className={`${estilos.notaLote} ${f.aviso ? temas.aviso : ''}`} data-nota-lote>
                {f.nota}
              </span>
            )}
          </span>
          {f.extra}
        </li>
      ))}
    </ul>
  )
}
