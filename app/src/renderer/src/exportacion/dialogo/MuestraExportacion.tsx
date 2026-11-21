import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FORMATOS, type FormatoId } from '@shared/exportacion'
import type { Letra } from '@shared/letra'
import { PantallaLetra } from '../../karaoke/PantallaLetra'
import type { CancionExportable } from './cancion'
import { EXP, medidas } from './textos'
import estilos from './exportacion.module.css'

interface Props {
  cancion: CancionExportable
  ancho: number
  alto: number
  fps: number
  formato: FormatoId
}

/** Marca de agua de la spec 10 con sus valores reales (margen 3 %, cuerpo máx(14 px, 2,2 %)). */
function MarcaDeAgua({ alto }: { alto: number }) {
  const cuerpo = Math.max(14, alto * 0.022)
  const margen = alto * 0.03
  return (
    <span
      data-marca-agua
      className={estilos.marca}
      style={{ right: margen, bottom: margen, fontSize: cuerpo }}
    >
      Shinobi Karaoke
    </span>
  )
}

/**
 * Fotograma fijo con el estilo de la canción (docs/ux/10, «Muestra»): la primera línea con inicio
 * a medio barrer y la siguiente debajo; sin barrido en «Letra lista». Se pinta a la resolución
 * real del video y se reduce a la anchura disponible, para que las proporciones sean las del
 * video. Decorativa: el formato no la cambia.
 */
export function MuestraExportacion({ cancion, ancho, alto, fps, formato }: Props) {
  const caja = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(256 / ancho)
  useLayoutEffect(() => {
    const nodo = caja.current
    if (!nodo) return
    const medir = () => {
      const w = nodo.clientWidth
      if (w > 0) setEscala(w / ancho)
    }
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(medir)
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [ancho])

  const letra = useMemo<Letra | null>(() => {
    if (!cancion.letra) return null
    const lineas = cancion.letra.lineas.filter((l) => l.tipo === 'linea' && l.inicio_ms !== null)
    return { ...cancion.letra, lineas }
  }, [cancion.letra])
  const primera = letra?.lineas[0]?.id ?? null

  return (
    <div className={estilos.muestraEnvoltorio}>
      <h3 className={`t-pequeno ${estilos.etiquetaMuestra}`}>{EXP.muestra}</h3>
      <div
        ref={caja}
        role="img"
        aria-label={EXP.muestraAria}
        data-muestra
        className={estilos.muestra}
        style={{ aspectRatio: `${ancho} / ${alto}` }}
      >
        <div
          className={estilos.muestraInterior}
          style={{ width: ancho, height: alto, transform: `scale(${escala})` }}
        >
          {letra && (
            <PantallaLetra
              letra={letra}
              estilo={cancion.estilo}
              duracionMs={cancion.duracionMs}
              titulo={cancion.titulo}
              artista={cancion.artista}
              reproduciendo={false}
              idEstatico={primera}
              barrido={cancion.modalidad === 'karaoke'}
              fondoEstatico
            />
          )}
          <MarcaDeAgua alto={alto} />
        </div>
      </div>
      <p className="t-pequeno" data-muestra-resumen>
        {medidas(ancho, alto)} · {fps} FPS · {FORMATOS[formato].nombreCorto}
      </p>
      <p className={`t-pequeno ${estilos.texto2}`}>{EXP.muestraMarca}</p>
    </div>
  )
}
