import { useEffect, useState, type ReactNode, type Ref } from 'react'
import { CircleDot, Pause, Play, SkipBack, Volume2, VolumeX } from 'lucide-react'
import type { Letra } from '@shared/letra'
import { formatearTiempo, tiempoMostrado } from '@shared/letras/tiempos'
import { BarraProgreso } from '../../componentes/BarraProgreso'
import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { ControlSegmentado } from '../../componentes/ControlSegmentado'
import { Deslizador } from '../../componentes/Deslizador'
import { Icono } from '../../componentes/Icono'
import { Tooltip } from '../../componentes/Tooltip'
import type { EstadoMotor, Velocidad } from '../../karaoke/motorAudio'
import type { Pista } from '../../karaoke/pistas'
import { tiempoHablado } from '../../karaoke/tiempoHablado'
import { E } from './textos'
import estilos from './transporte.module.css'

export interface SeparacionEditor {
  disponible: boolean
  enCola: boolean
  porcentaje: number | null
  minutos?: number
}

interface Props {
  estado: EstadoMotor | null
  posicionMs: number
  duracionMs: number
  letra: Letra
  separacion: SeparacionEditor
  volumen: number
  silenciado: boolean
  usarPista(pista: Pista): void
  reproducir(): void
  buscar(ms: number): void
  fijarVelocidad(velocidad: Velocidad): void
  fijarVolumen(volumen: number): void
  alternarSilencio(): void
  entrarSync(): void
  refSync?: Ref<HTMLButtonElement>
  acciones?: ReactNode
  /** Modo «Sincronizar al ritmo»: la segunda fila conserva solo «Escuchar» (el banner va en el dock). */
  sincronizando?: boolean
}

const VELOCIDADES = [
  { valor: '0.5', etiqueta: '0,5×' },
  { valor: '0.75', etiqueta: '0,75×' },
  { valor: '1', etiqueta: '1×' }
] as const

export function Transporte({
  estado,
  posicionMs,
  duracionMs,
  letra,
  separacion,
  volumen,
  silenciado,
  usarPista,
  reproducir,
  buscar,
  fijarVelocidad,
  fijarVolumen,
  alternarSilencio,
  entrarSync,
  refSync,
  acciones,
  sincronizando = false
}: Props) {
  const cargando = !estado || estado.cargando
  const listo = estado?.duracionMs != null
  const [lento, setLento] = useState(false)
  useEffect(() => {
    if (!cargando) return
    const t = setTimeout(() => setLento(true), 3000)
    return () => clearTimeout(t)
  }, [cargando])

  const motivo = separacion.disponible
    ? undefined
    : separacion.enCola
      ? E.noDisponibleCola
      : separacion.porcentaje !== null
        ? E.noDisponiblePista(separacion.porcentaje)
        : E.noDisponibleSeparar
  const pistas = (['original', 'voz', 'instrumental'] as const).map((pista) => ({
    valor: pista,
    etiqueta: E[pista],
    cargando: estado?.cargandoPista === pista,
    noDisponible: pista === 'original' ? undefined : motivo
  }))
  const duracion = estado?.duracionMs ?? duracionMs

  return (
    <section className={estilos.transporte} aria-label="Reproducción">
      <div className={estilos.fila}>
        <BotonIcono
          icono={SkipBack}
          etiqueta="Ir al principio"
          onClick={() => buscar(0)}
          disabled={!listo}
        />
        <BotonIcono
          icono={estado?.sonando ? Pause : Play}
          etiqueta={estado?.sonando ? 'Pausar' : 'Reproducir'}
          onClick={reproducir}
          disabled={!listo}
        />
        {cargando ? (
          <div className={estilos.tiempo}>
            {lento ? (
              <BarraProgreso etiqueta={E.cargando} indeterminada />
            ) : (
              <span>{E.cargando}</span>
            )}
          </div>
        ) : (
          <span className={`t-tiempo ${estilos.tiempo}`}>
            {formatearTiempo(posicionMs).slice(0, -1)} / {formatearTiempo(duracion).slice(0, 5)}
          </span>
        )}
        <div className={estilos.barraTiempo} data-foco-editor="barra">
          <div className={estilos.ticks} aria-hidden="true">
            {duracion > 0 &&
              letra.lineas.flatMap((el) =>
                el.tipo === 'linea' && el.inicio_ms !== null
                  ? [
                      <span
                        key={el.id}
                        style={{
                          left: `${Math.min(100, (100 * tiempoMostrado(el.inicio_ms, letra.offset_ms)) / duracion)}%`
                        }}
                      />
                    ]
                  : []
              )}
          </div>
          <Deslizador
            etiqueta="Tiempo de reproducción"
            valor={posicionMs}
            max={Math.max(1, duracion)}
            textoValor={`${tiempoHablado(posicionMs)} de ${tiempoHablado(duracion)}`}
            disabled={!listo}
            alCambiar={buscar}
            onKeyDown={(e) => {
              const sentido = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
              if (!sentido) return
              e.preventDefault()
              buscar(posicionMs + sentido * 5000)
            }}
          />
        </div>
        <div className={estilos.grupo} data-foco-editor="segmentado">
          <Tooltip contenido={E.velocidadTooltip}>
            <span>{E.velocidad}</span>
          </Tooltip>
          <ControlSegmentado
            etiqueta={E.velocidad}
            valor={String(estado?.velocidad ?? 1)}
            opciones={[...VELOCIDADES]}
            onCambio={(v) => fijarVelocidad(Number(v) as Velocidad)}
          />
        </div>
        <div className={estilos.volumen} data-foco-editor="volumen">
          <BotonIcono
            icono={silenciado ? VolumeX : Volume2}
            etiqueta={silenciado ? E.activarSonido : E.silenciar}
            onClick={alternarSilencio}
          />
          <Deslizador
            etiqueta={E.volumen}
            valor={volumen}
            textoValor={`${Math.round(volumen * 100)} %`}
            alCambiar={fijarVolumen}
          />
        </div>
      </div>
      <div className={estilos.fila}>
        <div className={estilos.grupo} data-foco-editor="segmentado">
          <span>{E.escuchar}</span>
          <ControlSegmentado
            etiqueta={E.escuchar}
            valor={estado?.pista ?? 'original'}
            opciones={pistas}
            onCambio={usarPista}
          />
        </div>
        {!sincronizando && (
          <div className={estilos.acciones}>
            <Boton ref={refSync} onClick={entrarSync} disabled={!listo}>
              <Icono icono={CircleDot} tamano={16} /> {E.botonSync} (S)
            </Boton>
            {acciones}
          </div>
        )}
      </div>
    </section>
  )
}
