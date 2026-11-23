import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Info } from 'lucide-react'
import {
  FORMATOS,
  FORMATOS_ID,
  FPS,
  PROPORCIONES,
  type Fps,
  type FormatoId,
  type PerfilesIpc,
  type Proporcion,
  type Resolucion
} from '@shared/exportacion'
import { BotonIcono } from '../../componentes/BotonIcono'
import { ControlSegmentado, type OpcionSegmentada } from '../../componentes/ControlSegmentado'
import {
  buscarPerfil,
  formatoSoportado,
  perfilSoportado,
  proporcionDeOpciones,
  proporcionSoportada,
  resolucionesDe,
  resolucionSoportada,
  type OpcionesExportacion
} from './modelo'
import { SelectorResolucion, type OpcionResolucion } from './SelectorResolucion'
import { AYUDA_FORMATO, EXP, NOMBRES_AUDIO, NOMBRES_PROPORCION, PISTA_FORMATO } from './textos'
import type { AnunciosFormulario } from './useFormulario'
import estilos from './exportacion.module.css'

function Anuncio({ texto }: { texto?: string }) {
  return (
    <p role="status" className={`t-pequeno ${estilos.anuncio}`}>
      {texto}
    </p>
  )
}

/** Voz de los coros bajo el control de audio (spec 10 · 0.2.3): la casilla o la nota de nivel 0 %. */
export type VistaCoros =
  | { tipo: 'casilla'; etiqueta: string; marcada: boolean; alCambiar(marcada: boolean): void }
  | { tipo: 'cero' }

export interface PropsOpcionesVideo {
  perfiles: PerfilesIpc
  opciones: OpcionesExportacion
  /** Hay pista de voz utilizable; en un lote la opción nunca se desactiva por ello. */
  vozDisponible: boolean
  anuncios: AnunciosFormulario
  /** Casilla de los coros (`null` o ausente: no se ofrece). */
  coros?: VistaCoros | null
  alCambiarAudio(a: OpcionesExportacion['audio']): void
  alCambiarProporcion(p: Proporcion): void
  alCambiarResolucion(r: Resolucion): void
  alCambiarFps(f: Fps): void
  alCambiarFormato(f: FormatoId): void
}

/**
 * Audio, proporción, resolución, FPS y formato del diálogo «Exportar video» (docs/ux/10): lo comparten el
 * formulario de una canción (A) y el de un lote (G).
 */
export function OpcionesVideo(p: PropsOpcionesVideo) {
  const { perfiles, opciones, anuncios } = p
  const idPista = useId()
  const idCoros = useId()
  const idAyuda = useId()
  const botonAyuda = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLDivElement>(null)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)
  const proporcion = proporcionDeOpciones(opciones)
  // Al abrirse en línea puede quedar bajo el pliegue de la zona con scroll: se trae a la vista.
  useEffect(() => {
    if (ayudaAbierta) popover.current?.scrollIntoView?.({ block: 'nearest' })
  }, [ayudaAbierta])

  const { formato, ancho, alto, fps, audio } = opciones
  const motivoPerfil = (a: number, h: number, f: number) => {
    const perfil = buscarPerfil(perfiles, formato, a, h, f)
    return EXP.perfilNoSoportado(a, h, f, formato, perfil?.motivo ?? 'no_comprobado')
  }

  const opcionesAudio: OpcionSegmentada<OpcionesExportacion['audio']>[] = [
    { valor: 'instrumental', etiqueta: NOMBRES_AUDIO.instrumental },
    {
      valor: 'instrumental_voz',
      etiqueta: NOMBRES_AUDIO.instrumental_voz,
      noDisponible: p.vozDisponible ? undefined : EXP.audioSinVoz
    }
  ]
  const opcionesProporcion: OpcionSegmentada<Proporcion>[] = PROPORCIONES.map((valor) => ({
    valor,
    etiqueta: NOMBRES_PROPORCION[valor],
    noDisponible: proporcionSoportada(perfiles, formato, valor)
      ? undefined
      : EXP.proporcionNoDisponible
  }))
  const resoluciones: OpcionResolucion[] = resolucionesDe(proporcion).map((r) => ({
    ...r,
    noSoportada: resolucionSoportada(perfiles, formato, r)
      ? undefined
      : motivoPerfil(r.ancho, r.alto, fps)
  }))
  const opcionesFps: OpcionSegmentada<`${Fps}`>[] = FPS.map((valor) => {
    const soportado = perfilSoportado(perfiles, formato, ancho, alto, valor)
    return {
      valor: `${valor}`,
      etiqueta: `${valor}`,
      nombre: `${EXP.fpsAria(valor)}${soportado ? '' : EXP.perfilNoDisponible}`,
      noDisponible: soportado ? undefined : motivoPerfil(ancho, alto, valor)
    }
  })
  const opcionesFormato: OpcionSegmentada<FormatoId>[] = FORMATOS_ID.map((valor) => ({
    valor,
    etiqueta: FORMATOS[valor].nombre,
    noDisponible: formatoSoportado(perfiles, valor) ? undefined : EXP.formatoNoDisponible
  }))

  const cerrarAyuda = (e: KeyboardEvent) => {
    // Con la ayuda cerrada, Esc llega al diálogo y lo cierra.
    if (e.key !== 'Escape' || !ayudaAbierta) return
    // Esc cierra primero el popover y devuelve el foco; no llega al diálogo.
    e.preventDefault()
    e.stopPropagation()
    setAyudaAbierta(false)
    botonAyuda.current?.focus()
  }

  return (
    <>
      <div className={estilos.fila}>
        <span className={estilos.etiquetaFila}>{EXP.audio}</span>
        <ControlSegmentado
          etiqueta={EXP.audio}
          opciones={opcionesAudio}
          valor={audio}
          onCambio={p.alCambiarAudio}
        />
        {p.coros?.tipo === 'casilla' && (
          <>
            <label className={estilos.casilla}>
              <input
                type="checkbox"
                checked={p.coros.marcada}
                aria-describedby={idCoros}
                onChange={(e) =>
                  (p.coros as { alCambiar(v: boolean): void }).alCambiar(e.target.checked)
                }
              />
              {p.coros.etiqueta}
            </label>
            <p id={idCoros} className={`t-pequeno ${estilos.pista}`}>
              {EXP.corosAyuda}
            </p>
          </>
        )}
        {p.coros?.tipo === 'cero' && (
          <p className={`t-pequeno ${estilos.pista}`}>{EXP.corosCero}</p>
        )}
      </div>
      <div className={estilos.fila}>
        <span className={estilos.etiquetaFila}>{EXP.proporcion}</span>
        <ControlSegmentado
          etiqueta={EXP.proporcion}
          opciones={opcionesProporcion}
          valor={proporcion}
          onCambio={p.alCambiarProporcion}
        />
        <Anuncio texto={anuncios.resolucion} />
      </div>
      <SelectorResolucion
        opciones={resoluciones}
        valor={{ ancho, alto }}
        alElegir={p.alCambiarResolucion}
      />
      <div className={estilos.fila}>
        <span className={estilos.etiquetaFila}>{EXP.fps}</span>
        <ControlSegmentado
          etiqueta={EXP.fps}
          opciones={opcionesFps}
          valor={`${fps}`}
          onCambio={(v) => p.alCambiarFps(Number(v) as Fps)}
        />
        <Anuncio texto={anuncios.fps} />
      </div>
      <div className={estilos.fila}>
        <span className={estilos.etiquetaFila}>
          {EXP.formato}
          <span className={estilos.ayudaFormato}>
            <BotonIcono
              ref={botonAyuda}
              icono={Info}
              etiqueta={EXP.formatoAyudaBoton}
              aria-expanded={ayudaAbierta}
              aria-controls={ayudaAbierta ? idAyuda : undefined}
              onClick={() => setAyudaAbierta((v) => !v)}
              onKeyDown={cerrarAyuda}
            />
          </span>
        </span>
        {ayudaAbierta && (
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <div
            ref={popover}
            id={idAyuda}
            role="region"
            aria-label={AYUDA_FORMATO.titulo}
            className={estilos.popover}
            onKeyDown={cerrarAyuda}
          >
            <h3>{AYUDA_FORMATO.titulo}</h3>
            <p>{AYUDA_FORMATO.intro}</p>
            <p>
              <strong>MKV (AV1 + Opus)</strong>: {AYUDA_FORMATO.mkv}
            </p>
            <p>
              <strong>WebM (VP9 + Opus)</strong>: {AYUDA_FORMATO.webm}
            </p>
            <p>{AYUDA_FORMATO.cierre}</p>
          </div>
        )}
        <ControlSegmentado
          etiqueta={EXP.formato}
          opciones={opcionesFormato}
          valor={formato}
          onCambio={p.alCambiarFormato}
          describedBy={idPista}
        />
        <p id={idPista} className={`t-pequeno ${estilos.pista}`}>
          {PISTA_FORMATO[formato]}
        </p>
      </div>
    </>
  )
}
