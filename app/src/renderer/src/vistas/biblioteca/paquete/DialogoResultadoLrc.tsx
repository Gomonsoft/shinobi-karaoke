import { CircleX, Minus } from 'lucide-react'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { Icono } from '../../../componentes/Icono'
import { copiarDetalles } from '../../../soporte/detalles'
import { mostrarResultadoLetras, type ResultadoLetras } from './almacen'
import estilos from './paquete.module.css'
import { LRC } from './textos'

/** Resultado por canción de «Exportar la letra (.lrc)…» con varias: solo cuando alguna se omitió o falló. */
export function DialogoResultadoLrc({ resultado }: { resultado: ResultadoLetras }) {
  const cerrar = () => mostrarResultadoLetras(null)
  return (
    <Dialogo
      abierto
      titulo={LRC.resultadoTitulo}
      ancho="32.5rem"
      onCancelar={cerrar}
      enfoqueInicial="[data-mostrar]"
      acciones={
        <>
          <Boton variante="fantasma" onClick={cerrar}>
            {LRC.cerrar}
          </Boton>
          <Boton
            variante="primario"
            data-mostrar
            onClick={() =>
              void window.shinobi.letras
                .mostrarEnCarpeta(resultado.ubicacionId)
                .catch(() => undefined)
            }
          >
            {LRC.mostrarCarpeta}
          </Boton>
        </>
      }
    >
      <div className={estilos.cuerpo}>
        <p role="status">{LRC.variasOmitidas(resultado.escritas, resultado.total)}</p>
        <ul className={estilos.lista}>
          {resultado.omitidas.map((o) => {
            const sinTiempos = o.motivo === 'SIN_TIEMPOS'
            const texto = LRC.motivo[o.motivo] ?? LRC.error
            return (
              <li
                key={o.id}
                className={estilos.filaLista}
                aria-label={`${o.titulo}, ${o.artista}: ${texto}`}
              >
                <Icono
                  icono={sinTiempos ? Minus : CircleX}
                  tamano={16}
                  className={`${estilos.icono} ${sinTiempos ? '' : estilos.iconoError}`}
                />
                <span className={estilos.filaTexto}>
                  <span className={estilos.filaTitulo}>
                    {o.titulo}
                    {o.artista ? ` — ${o.artista}` : ''}
                  </span>
                  <span className={`t-pequeno ${estilos.filaNota}`}>{texto}</span>
                </span>
                {!sinTiempos && (
                  <Boton
                    variante="fantasma"
                    onClick={() => void copiarDetalles(`${o.motivo} (${o.id})`)}
                  >
                    {LRC.copiar}
                  </Boton>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </Dialogo>
  )
}
