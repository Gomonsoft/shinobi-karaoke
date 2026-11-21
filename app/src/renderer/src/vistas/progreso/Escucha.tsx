import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { Icono } from '../../componentes/Icono'
import { Tooltip } from '../../componentes/Tooltip'
import { useSesion } from '../../sesion/ProveedorSesion'
import { Candado } from '../../sesion/useAccionBloqueable'
import { EDI_BLOQUEO } from '../../sesion/textos'
import { SEP } from './textos'
import estilos from './progreso.module.css'

type Pista = 'voz' | 'instrumental'
const NOMBRE: Record<Pista, string> = { voz: SEP.pistaVoz, instrumental: SEP.pistaInstrumental }

const reloj = (s: number): string =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function ReproductorPista({
  cancionId,
  pista,
  activa,
  alActivar,
  alDesactivar,
  bloqueada
}: {
  cancionId: string
  pista: Pista
  activa: Pista | null
  alActivar: (p: Pista) => void
  alDesactivar: (p: Pista) => void
  /** Hay sesión: no suena nada en la principal (`edi.bloqueo.escucha`). */
  bloqueada: boolean
}) {
  const audio = useRef<HTMLAudioElement>(null)
  const [sonando, setSonando] = useState(false)
  const [tiempo, setTiempo] = useState(0)
  const [duracion, setDuracion] = useState(0)
  const [fallo, setFallo] = useState(false)
  const [explicar, setExplicar] = useState(false)
  const nombre = NOMBRE[pista]

  // Si la sesión empieza con la pista sonando, se calla.
  useEffect(() => {
    if (bloqueada) audio.current?.pause()
  }, [bloqueada])

  // Solo suena una pista a la vez.
  useEffect(() => {
    if (activa !== pista) audio.current?.pause()
  }, [activa, pista])
  // Al salir de la vista se para.
  useEffect(() => {
    const el = audio.current
    return () => el?.pause()
  }, [])

  const alternar = () => {
    const el = audio.current
    if (!el) return
    if (bloqueada) {
      setExplicar(true)
      return
    }
    if (el.paused) {
      alActivar(pista)
      void Promise.resolve(el.play()).catch(() => setFallo(true))
    } else {
      el.pause()
    }
  }

  const boton = (
    <button
      type="button"
      className={estilos.botonPista}
      aria-label={
        (sonando ? SEP.pausar(nombre) : SEP.reproducir(nombre)) +
        (bloqueada ? EDI_BLOQUEO.aria : '')
      }
      aria-disabled={bloqueada || undefined}
      onClick={alternar}
      onBlur={() => setExplicar(false)}
    >
      {bloqueada ? <Candado /> : <Icono icono={sonando ? Pause : Play} tamano={16} />}
      <span aria-hidden="true">{nombre}</span>
    </button>
  )

  return (
    <div className={estilos.pista}>
      {bloqueada ? (
        <Tooltip contenido={EDI_BLOQUEO.escucha} forzar={explicar}>
          {boton}
        </Tooltip>
      ) : (
        boton
      )}
      <input
        type="range"
        className={estilos.posicion}
        aria-label={SEP.posicion(nombre)}
        aria-valuetext={`${reloj(tiempo)} de ${reloj(duracion)}`}
        min={0}
        max={duracion || 0}
        step={1}
        value={Math.min(tiempo, duracion || 0)}
        disabled={fallo || duracion === 0 || bloqueada}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (audio.current) audio.current.currentTime = v
          setTiempo(v)
        }}
      />
      <span className={estilos.reloj} aria-hidden="true">
        {reloj(tiempo)}
      </span>
      {/* Pista musical: no hay subtítulos que ofrecer. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audio}
        src={`shinobi-media://${cancionId}/pistas/${pista}.flac`}
        preload="metadata"
        onPlay={() => setSonando(true)}
        onPause={() => {
          setSonando(false)
          alDesactivar(pista)
        }}
        onEnded={() => setSonando(false)}
        onTimeUpdate={(e) => setTiempo(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration || 0)}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration
          if (Number.isFinite(d)) setDuracion(d)
        }}
        onError={() => setFallo(true)}
      />
      {fallo && (
        <p role="alert" className={estilos.errorPista}>
          {SEP.errorPista(nombre.toLowerCase())}
        </p>
      )}
    </div>
  )
}

/** `prog.escuchar`: reproductor mínimo en línea de las dos pistas (ux/04 §1). */
export function Escucha({ cancionId }: { cancionId: string }) {
  const [activa, setActiva] = useState<Pista | null>(null)
  const { haySesion } = useSesion()
  return (
    <div className={estilos.escucha} role="group" aria-label={SEP.escuchar}>
      <p className={estilos.escuchaTitulo}>{SEP.escuchar}</p>
      {(['voz', 'instrumental'] as const).map((p) => (
        <ReproductorPista
          key={p}
          cancionId={cancionId}
          pista={p}
          activa={activa}
          alActivar={setActiva}
          alDesactivar={(q) => setActiva((a) => (a === q ? null : a))}
          bloqueada={haySesion}
        />
      ))}
    </div>
  )
}
