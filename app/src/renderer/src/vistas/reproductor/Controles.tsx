import { useEffect, useRef, useState, type ComponentProps } from 'react'
import {
  Keyboard,
  Maximize,
  Minimize,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  Volume2,
  VolumeX,
  X
} from 'lucide-react'
import { BotonIcono } from '../../componentes/BotonIcono'
import { Deslizador } from '../../componentes/Deslizador'
import { Icono } from '../../componentes/Icono'
import { Tooltip } from '../../componentes/Tooltip'
import type { ModoAudio } from '../../karaoke/motorReproductor'
import type { useVolumenCompartido } from '../../karaoke/useVolumenCompartido'
import type { AccionReproductor } from './atajos'
import { formatearReloj, tiempoEnPalabras } from './modelo'
import { R } from './textos'
import estilos from './reproductor.module.css'

type Volumen = ReturnType<typeof useVolumenCompartido>

interface Props {
  titulo: string
  artista: string
  aviso: string | null
  listo: boolean
  sonando: boolean
  pantallaCompleta: boolean
  visible: boolean
  posicionMs: number
  duracionMs: number
  vozDisponible: boolean
  modo: ModoAudio
  volumen: Volumen
  actuar(accion: AccionReproductor): void
  buscar(ms: number): void
  cambiarNivel(cambio: Parameters<Volumen['cambiar']>[0]): void
  retener(motivo: string, activa: boolean): void
}

function BotonControl({ etiqueta, ...props }: ComponentProps<typeof BotonIcono>) {
  return (
    <BotonIcono
      {...props}
      etiqueta={etiqueta}
      className={`${estilos.control} ${props.className ?? ''}`}
      tamano="grande"
    />
  )
}

function porcentaje(valor: number, silenciado = false): string {
  return `${Math.round(valor * 100)} %${silenciado ? ', silenciada' : ''}`
}

export function Controles({
  titulo,
  artista,
  aviso,
  listo,
  sonando,
  pantallaCompleta,
  visible,
  posicionMs,
  duracionMs,
  vozDisponible,
  modo,
  volumen,
  actuar,
  buscar,
  cambiarNivel,
  retener
}: Props) {
  const [arrastre, setArrastre] = useState<number | null>(null)
  const arrastrando = useRef(false)
  const destino = useRef(posicionMs)
  const callbacks = useRef({ buscar, retener })
  useEffect(() => {
    callbacks.current = { buscar, retener }
  }, [buscar, retener])

  useEffect(() => {
    const acabar = (e: PointerEvent) => {
      const estabaArrastrando = arrastrando.current
      arrastrando.current = false
      if (estabaArrastrando) {
        setArrastre(null)
        if (e.type === 'pointerup') callbacks.current.buscar(destino.current)
      }
      callbacks.current.retener('arrastre', false)
    }
    window.addEventListener('pointerup', acabar)
    window.addEventListener('pointercancel', acabar)
    return () => {
      window.removeEventListener('pointerup', acabar)
      window.removeEventListener('pointercancel', acabar)
    }
  }, [])

  const posicion = Math.min(duracionMs, arrastre ?? posicionMs)
  const oculto = visible ? '' : estilos.oculta
  const vozSilenciada = volumen.vozSilenciada
  const vozTooltip = vozSilenciada ? R.tooltip.activarVoz : R.tooltip.silenciarVoz
  return (
    <>
      <div
        className={`${estilos.franja} ${estilos.superior} ${oculto}`}
        data-franja="superior"
        aria-hidden={!visible || undefined}
        inert={!visible}
        onPointerEnter={() => retener('superior', true)}
        onPointerLeave={() => retener('superior', false)}
      >
        <Tooltip contenido={R.tooltip.salir}>
          <button
            className={`${estilos.control} ${estilos.salir}`}
            type="button"
            aria-keyshortcuts="Escape"
            onClick={() => actuar({ tipo: 'salir' })}
          >
            <Icono icono={X} /> {R.salir}
          </button>
        </Tooltip>
        <div className={estilos.identidad}>
          <div className={`t-cuerpo-fuerte ${estilos.nombre}`}>
            {titulo} · {artista}
          </div>
          {aviso && (
            <div className="t-pequeno" aria-hidden="true">
              <span className={estilos.aviso}>⚠</span> {aviso}
            </div>
          )}
        </div>
      </div>
      <div
        className={`${estilos.franja} ${estilos.inferior} ${oculto}`}
        data-franja="inferior"
        aria-hidden={!visible || undefined}
        inert={!visible}
        onPointerEnter={() => retener('inferior', true)}
        onPointerLeave={() => retener('inferior', false)}
      >
        <div className={`t-tiempo ${estilos.barra}`}>
          <span aria-hidden="true">{formatearReloj(posicion)}</span>
          <Deslizador
            etiqueta="Barra de tiempo"
            valor={posicion}
            max={duracionMs || 1}
            step={1}
            disabled={!listo}
            textoValor={tiempoEnPalabras(posicion, duracionMs)}
            onPointerDown={() => {
              destino.current = posicion
              arrastrando.current = true
              retener('arrastre', true)
            }}
            alCambiar={(ms) => {
              destino.current = ms
              if (arrastrando.current) setArrastre(ms)
              else buscar(ms)
            }}
          />
          <span aria-hidden="true">{formatearReloj(duracionMs)}</span>
        </div>
        <div className={estilos.fila}>
          <div className={estilos.grupo}>
            <BotonControl
              icono={SkipBack}
              etiqueta={R.tooltip.principio}
              aria-keyshortcuts="Home 0"
              disabled={!listo}
              onClick={() => actuar({ tipo: 'principio' })}
            />
            <BotonControl
              icono={sonando ? Pause : Play}
              etiqueta={sonando ? R.tooltip.pausa : R.tooltip.reproducir}
              aria-keyshortcuts="Space K"
              disabled={!listo}
              onClick={() => actuar({ tipo: 'alternar' })}
            />
            <BotonControl
              icono={RotateCcw}
              etiqueta={R.tooltip.retroceder}
              aria-keyshortcuts="ArrowLeft"
              disabled={!listo}
              onClick={() => actuar({ tipo: 'saltar', deltaMs: -5000 })}
            />
            <BotonControl
              icono={RotateCw}
              etiqueta={R.tooltip.avanzar}
              aria-keyshortcuts="ArrowRight"
              disabled={!listo}
              onClick={() => actuar({ tipo: 'saltar', deltaMs: 5000 })}
            />
            {listo && !sonando && <span className="t-pequeno">{R.pausa}</span>}
          </div>
          <div className={estilos.grupo}>
            {modo === 'karaoke' && (
              <div
                className={`${estilos.grupo} ${estilos.voz} ${vozSilenciada ? estilos.atenuado : ''}`}
              >
                <BotonControl
                  icono={vozSilenciada ? MicOff : Mic}
                  etiqueta={vozTooltip}
                  aria-keyshortcuts="V"
                  activo={!vozSilenciada && vozDisponible}
                  noDisponible={vozDisponible ? undefined : R.vozNoDisponible}
                  onClick={() => actuar({ tipo: 'voz' })}
                />
                <span className="t-pequeno">{R.voz}</span>
                <Tooltip contenido={R.tooltip.nivelVoz}>
                  <Deslizador
                    className={estilos.nivelVoz}
                    etiqueta={R.aria.vozguia}
                    valor={volumen.volumenVoz}
                    textoValor={porcentaje(volumen.volumenVoz, vozSilenciada)}
                    step={0.01}
                    aria-keyshortcuts="Shift+ArrowUp Shift+ArrowDown"
                    aria-disabled={!vozDisponible || undefined}
                    onPointerDown={() => retener('arrastre', vozDisponible)}
                    alCambiar={(voz_guia) => {
                      if (vozDisponible) cambiarNivel({ voz_guia, voz_guia_silenciada: false })
                    }}
                  />
                </Tooltip>
                <span className={`t-tiempo ${estilos.porcentaje}`} aria-hidden="true">
                  {porcentaje(volumen.volumenVoz)}
                </span>
              </div>
            )}
            <BotonControl
              icono={volumen.silenciado ? VolumeX : Volume2}
              etiqueta={volumen.silenciado ? R.tooltip.activarSonido : R.tooltip.silenciar}
              aria-keyshortcuts="M"
              onClick={() => actuar({ tipo: 'silenciar' })}
            />
            <Tooltip contenido={R.tooltip.volumen}>
              <Deslizador
                className={estilos.volumen}
                etiqueta={R.aria.volumen}
                valor={volumen.volumen}
                textoValor={porcentaje(volumen.volumen, volumen.silenciado)}
                step={0.01}
                aria-keyshortcuts="ArrowUp ArrowDown"
                onPointerDown={() => retener('arrastre', true)}
                alCambiar={(v) => cambiarNivel({ volumen: v, silenciado: false })}
              />
            </Tooltip>
            <BotonControl
              icono={Keyboard}
              etiqueta={R.tooltip.atajos}
              aria-keyshortcuts="F1 ?"
              onClick={() => actuar({ tipo: 'atajos' })}
            />
            <BotonControl
              icono={pantallaCompleta ? Minimize : Maximize}
              etiqueta={pantallaCompleta ? R.tooltip.ventana : R.tooltip.completa}
              aria-keyshortcuts="F"
              onClick={() => actuar({ tipo: 'pantalla_completa' })}
            />
          </div>
        </div>
      </div>
    </>
  )
}
