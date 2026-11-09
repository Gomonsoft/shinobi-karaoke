import { useState } from 'react'
import { ArrowDown, ArrowUp, PanelLeftOpen } from 'lucide-react'
import type { Letra } from '@shared/letra'
import { contador, formatearTiempo, numeroDeLinea, tiempoMostrado } from '@shared/letras/tiempos'
import { Icono } from '../../componentes/Icono'
import { Tooltip } from '../../componentes/Tooltip'
import { BotonLayout } from './BotonLayout'
import { E } from './textos'
import estilos from './editor.module.css'

interface Props {
  letra: Letra
  seleccion: string | null
  /** Modo «Sincronizar al ritmo»: ↑, ↓ e I no están disponibles (igual que sus atajos). */
  sincronizando: boolean
  /** Aviso de límite del último «I» (mismo que enseña el campo Inicio del panel). */
  limiteInicio?: { mensaje: string; clave: number }
  anterior(): void
  siguiente(): void
  fijarInicio(): void
  expandir(): void
}

/** Riel de 72 px de la lista de líneas minimizada (spec 06-editor 2.1, «Lista minimizada»). */
export function RielLista({
  letra,
  seleccion,
  sincronizando,
  limiteInicio,
  anterior,
  siguiente,
  fijarInicio,
  expandir
}: Props) {
  const linea = letra.lineas.find((el) => el.id === seleccion && el.tipo === 'linea')
  const { total } = contador(letra)
  const numero = linea ? numeroDeLinea(letra, linea.id) : null
  const tiempo =
    linea && linea.inicio_ms !== null
      ? formatearTiempo(tiempoMostrado(linea.inicio_ms, letra.offset_ms))
      : null
  // Un aviso anterior a montar el riel no se vuelve a enseñar.
  const [claveInicial] = useState(limiteInicio?.clave)
  const limite = limiteInicio && limiteInicio.clave !== claveInicial ? limiteInicio : undefined

  return (
    <section
      id="zona-lista"
      className={`${estilos.riel} ${estilos.rielListaZona}`}
      aria-label={E.layout.region(E.layout.lista.nombre, true)}
    >
      <BotonLayout
        icono={PanelLeftOpen}
        etiqueta={E.layout.lista.expandir}
        nombre="lista-expandir"
        expandido={false}
        controla="zona-lista"
        onClick={expandir}
      />
      {linea && numero !== null ? (
        <Tooltip contenido={linea.texto}>
          <div
            role="group"
            className={estilos.rielLinea}
            aria-label={E.layout.riel.linea(numero, total, tiempo, linea.texto)}
          >
            <span className={estilos.rielNumero} aria-hidden="true">
              {numero}
            </span>
            <span className={estilos.rielEtiqueta} aria-hidden="true">
              de {total}
            </span>
            <span className={`t-tiempo ${estilos.rielValor}`} aria-hidden="true">
              {tiempo ?? '--:--'}
            </span>
          </div>
        </Tooltip>
      ) : (
        <span className={estilos.rielEtiqueta}>{E.sinSeleccion}</span>
      )}
      <Tooltip contenido={E.layout.riel.anterior}>
        <button
          type="button"
          className={estilos.botonLayout}
          aria-label={E.layout.riel.anterior}
          aria-keyshortcuts="ArrowUp"
          disabled={sincronizando}
          onClick={anterior}
        >
          <Icono icono={ArrowUp} />
        </button>
      </Tooltip>
      <Tooltip contenido={E.layout.riel.siguiente}>
        <button
          type="button"
          className={estilos.botonLayout}
          aria-label={E.layout.riel.siguiente}
          aria-keyshortcuts="ArrowDown"
          disabled={sincronizando}
          onClick={siguiente}
        >
          <Icono icono={ArrowDown} />
        </button>
      </Tooltip>
      <Tooltip
        contenido={limite?.mensaje ?? E.layout.riel.fijarInicio}
        forzar={limite && { clave: limite.clave, ms: 2000 }}
      >
        <button
          type="button"
          className={estilos.botonLayout}
          aria-label={E.layout.riel.fijarInicio}
          aria-keyshortcuts="I"
          disabled={!linea || sincronizando}
          onClick={fijarInicio}
        >
          I
        </button>
      </Tooltip>
    </section>
  )
}
