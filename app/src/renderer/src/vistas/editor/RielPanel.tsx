import { useId, useState } from 'react'
import { PanelRightOpen } from 'lucide-react'
import { finEfectivo, type Letra } from '@shared/letra'
import { formatearTiempo, tiempoMostrado } from '@shared/letras/tiempos'
import { Boton } from '../../componentes/Boton'
import { Tooltip } from '../../componentes/Tooltip'
import { BotonLayout } from './BotonLayout'
import { E } from './textos'
import estilos from './editor.module.css'

interface Props {
  letra: Letra
  seleccion: string | null
  duracionMs: number
  /** Modo «Sincronizar al ritmo»: los controles quedan inactivos. */
  sincronizando: boolean
  bucle: boolean
  motivoBucle?: string
  alternarBucle?(): void
  fijarFin(): void
  /** Aviso de límite del último «O». */
  limiteFin?: { mensaje: string; clave: number }
  /** Hay avisos de contraste en Estilo: el botón «Expandir panel» lleva el punto `aviso`. */
  avisos: boolean
  expandir(): void
}

/** Riel de 120 px del panel minimizado (spec 06-editor 2.1, «Panel minimizado»). */
export function RielPanel({
  letra,
  seleccion,
  duracionMs,
  sincronizando,
  bucle,
  motivoBucle,
  alternarBucle,
  fijarFin,
  limiteFin,
  avisos,
  expandir
}: Props) {
  const idMotivo = useId()
  const linea = letra.lineas.find((el) => el.id === seleccion && el.tipo === 'linea')
  const sinInicio = !linea || linea.inicio_ms === null
  const tiempo = (ms: number | null | undefined) =>
    ms == null ? '--:--' : formatearTiempo(tiempoMostrado(ms, letra.offset_ms))
  const fin = linea && !sinInicio ? finEfectivo(letra, linea.id, duracionMs) : null
  const motivoFin = sincronizando ? E.syncTitulo : sinInicio ? E.finSinInicio : undefined
  const motivoCasilla = sincronizando
    ? E.syncTitulo
    : bucle
      ? undefined
      : (motivoBucle ?? undefined)
  const casillaInactiva = !bucle && (sincronizando || !!motivoBucle || !alternarBucle)
  const [claveInicial] = useState(limiteFin?.clave)
  const limite = limiteFin && limiteFin.clave !== claveInicial ? limiteFin : undefined

  return (
    <section
      id="zona-panel"
      className={`${estilos.riel} ${estilos.rielPanelZona}`}
      aria-label={E.layout.region(E.layout.panel.nombre, false)}
    >
      <BotonLayout
        icono={PanelRightOpen}
        etiqueta={avisos ? E.layout.panel.expandirAviso : E.layout.panel.expandir}
        nombre="panel-expandir"
        expandido={false}
        controla="zona-panel"
        aviso={avisos}
        onClick={expandir}
      />
      <div className={estilos.rielDato}>
        <span className={estilos.rielEtiqueta}>{E.inicio}</span>
        <span className={`t-tiempo ${estilos.rielValor}`}>{tiempo(linea?.inicio_ms)}</span>
      </div>
      <div className={estilos.rielDato}>
        <span className={estilos.rielEtiqueta}>{E.fin}</span>
        <span className={`t-tiempo ${estilos.rielValor}`}>{tiempo(fin)}</span>
        {linea && !sinInicio && linea.fin_ms === null && (
          <span className={estilos.rielEtiqueta}>{E.layout.riel.auto}</span>
        )}
      </div>
      <Tooltip
        contenido={limite?.mensaje ?? ''}
        forzar={limite && { clave: limite.clave, ms: 2000 }}
        suprimir={!limite}
      >
        <Boton
          className={estilos.rielBoton}
          aria-label={E.layout.riel.fijarFinNombre}
          aria-keyshortcuts="O"
          noDisponible={motivoFin}
          onClick={fijarFin}
        >
          {E.layout.riel.fijarFin}
        </Boton>
      </Tooltip>
      <Tooltip contenido={motivoCasilla ?? E.timeline.bucle}>
        <label className={estilos.rielCasilla}>
          <input
            type="checkbox"
            checked={bucle}
            disabled={casillaInactiva}
            aria-describedby={motivoCasilla ? idMotivo : undefined}
            onChange={alternarBucle}
          />
          <span>{E.timeline.bucle}</span>
        </label>
      </Tooltip>
      {motivoCasilla && (
        <span id={idMotivo} className={estilos.soloLector}>
          {motivoCasilla}
        </span>
      )}
    </section>
  )
}
