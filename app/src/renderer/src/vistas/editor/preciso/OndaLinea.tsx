import { Boton } from '../../../componentes/Boton'
import { LienzoPicosVoz, usePicosVoz } from '../PistaOndaVoz'
import { T } from './textosPreciso'
import { tiempoAPorcentaje, type VistaPrecisa } from './vistaPrecisa'
import css from './preciso.module.css'

interface Props {
  cancionId: string
  /** Hay voz separada: sin ella no se piden los picos. */
  separada: boolean
  /** Vista en tiempo de letra. */
  vista: VistaPrecisa
  /** Inicio y fin efectivos de la línea (tiempo de letra), para sombrear los márgenes. */
  inicioLineaMs: number
  finLineaMs: number
  /** `offset_ms` de la letra: los picos están en tiempo de audio. */
  offsetMs?: number
}

/**
 * Forma de onda de la voz sobre la vista fija. Lee `picos.leer` con presupuesto = ancho del canvas
 * (≤ 4096 bloques) y descarta las respuestas de otra generación (`LienzoPicosVoz`). Decorativa.
 */
export function OndaLinea({
  cancionId,
  separada,
  vista,
  inicioLineaMs,
  finLineaMs,
  offsetMs = 0
}: Props) {
  const { estado, reintentar } = usePicosVoz(cancionId, separada)
  const izquierda = Math.min(100, Math.max(0, tiempoAPorcentaje(vista, inicioLineaMs)))
  const derecha = Math.min(100, Math.max(0, tiempoAPorcentaje(vista, finLineaMs)))
  return (
    <div className={css.onda}>
      {estado.estado === 'lista' ? (
        <LienzoPicosVoz
          cancionId={cancionId}
          generacion={estado.generacion}
          inicioMs={vista.inicioMs + offsetMs}
          finMs={vista.finMs + offsetMs}
        />
      ) : (
        <div className={css.ondaEstado}>
          <span role="status">
            {!separada
              ? T.voz.pendiente
              : estado.estado === 'generando'
                ? T.voz.generando
                : T.voz.error}
          </span>
          {separada && estado.estado === 'error' && (
            <Boton variante="fantasma" onClick={reintentar}>
              {T.voz.reintentar}
            </Boton>
          )}
        </div>
      )}
      <span aria-hidden="true" className={css.margen} style={{ left: 0, width: `${izquierda}%` }} />
      <span aria-hidden="true" className={css.margen} style={{ left: `${derecha}%`, right: 0 }} />
    </div>
  )
}
