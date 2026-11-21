import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Info } from 'lucide-react'
import {
  FORMATOS,
  FORMATOS_ID,
  FPS,
  PROPORCIONES,
  type DestinoIpc,
  type EstimacionExportacionIpc,
  type Fps,
  type FormatoId,
  type PerfilesIpc,
  type Proporcion,
  type Resolucion
} from '@shared/exportacion'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { ControlSegmentado, type OpcionSegmentada } from '../../componentes/ControlSegmentado'
import { BotonIcono } from '../../componentes/BotonIcono'
import {
  buscarPerfil,
  carpetaDeRuta,
  esCostoso,
  faltaEspacio,
  formatoSoportado,
  perfilSoportado,
  proporcionDeOpciones,
  proporcionSoportada,
  resolucionesDe,
  resolucionSoportada,
  type OpcionesExportacion
} from './modelo'
import type { CancionExportable } from './cancion'
import type { AnunciosFormulario, ErrorFormulario } from './useFormulario'
import { MuestraExportacion } from './MuestraExportacion'
import { SelectorResolucion, type OpcionResolucion } from './SelectorResolucion'
import {
  AYUDA_FORMATO,
  EXP,
  formatearTamano,
  formatearTiempoEstimado,
  NOMBRES_AUDIO,
  NOMBRES_PROPORCION,
  PISTA_FORMATO,
  textoErrorExp
} from './textos'
import estilos from './exportacion.module.css'
import estilosComponentes from '../../componentes/componentes.module.css'

export interface PropsFormulario {
  cancion: CancionExportable | null
  perfiles: PerfilesIpc | null
  opciones: OpcionesExportacion
  destino: DestinoIpc | null
  estimacion: EstimacionExportacionIpc | null
  anuncios: AnunciosFormulario
  error: ErrorFormulario | null
  /** Hay una sesión del reproductor en otra pantalla (`exp.nota.sesion`). */
  haySesion: boolean
  /** Hay un borrador de tema sin guardar en el editor (`edi.exp.temaBorrador`). */
  temaBorrador: boolean
  /** Pasados 300 ms sin perfiles se explica la espera (`exp.cargando`). */
  mostrarCargando: boolean
  alCambiarAudio(a: OpcionesExportacion['audio']): void
  alCambiarProporcion(p: Proporcion): void
  alCambiarResolucion(r: Resolucion): void
  alCambiarFps(f: Fps): void
  alCambiarFormato(f: FormatoId): void
  alCambiarDestino(): void
}

interface Nota {
  id: string
  tipo: 'info' | 'aviso'
  texto: string
}

/** Notas del formulario en el orden de la tabla de la spec 10 (la 1, «ya existe», va bajo el destino). */
export function notasDelFormulario(p: {
  cancion: CancionExportable
  destino: DestinoIpc | null
  estimacion: EstimacionExportacionIpc | null
  opciones: Pick<OpcionesExportacion, 'alto' | 'fps'>
  haySesion: boolean
  temaBorrador: boolean
}): Nota[] {
  const { cancion, destino, estimacion, opciones } = p
  const notas: Nota[] = []
  if (faltaEspacio(estimacion?.bytes ?? null, destino?.libreBytes ?? null)) {
    notas.push({
      id: 'espacio',
      tipo: 'aviso',
      texto: EXP.avisoEspacio(
        formatearTamano(estimacion!.bytes!),
        formatearTamano(destino!.libreBytes!)
      )
    })
  }
  if (p.haySesion) notas.push({ id: 'sesion', tipo: 'info', texto: EXP.notaSesion })
  if (esCostoso(opciones, estimacion))
    notas.push({ id: 'costoso', tipo: 'info', texto: EXP.notaCostoso })
  if (cancion.estado === 'lista' && cancion.modalidad === 'letra_lista')
    notas.push({ id: 'letraLista', tipo: 'info', texto: EXP.notaLetraLista })
  if (cancion.estado === 'lista' && cancion.sinInicio > 0)
    notas.push({ id: 'incompleta', tipo: 'aviso', texto: EXP.notaIncompleta(cancion.sinInicio) })
  if (cancion.estado === 'borrador')
    notas.push({ id: 'borrador', tipo: 'info', texto: EXP.notaBorrador })
  if (destino?.carpetaRecordadaNoDisponible)
    notas.push({
      id: 'carpeta',
      tipo: 'info',
      texto: EXP.notaCarpetaNoDisponible(carpetaDeRuta(destino.ruta))
    })
  if (p.temaBorrador) notas.push({ id: 'temaBorrador', tipo: 'info', texto: EXP.notaTemaBorrador })
  return notas
}

function Anuncio({ texto }: { texto?: string }) {
  return (
    <p role="status" className={`t-pequeno ${estilos.anuncio}`}>
      {texto}
    </p>
  )
}

/** Formulario de la spec 10 (wireframes A y E): opciones, destino, estimación, notas y muestra. */
export function Formulario(p: PropsFormulario) {
  const { cancion, perfiles, opciones, destino, estimacion, anuncios, error } = p
  const idPista = useId()
  const idAyuda = useId()
  const idDestino = useId()
  const botonAyuda = useRef<HTMLButtonElement>(null)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)
  const proporcion = proporcionDeOpciones(opciones)

  if (!cancion || !perfiles) {
    return (
      <div className={estilos.formulario} aria-busy="true" data-cargando>
        {p.mostrarCargando && <p role="status">{EXP.cargando}</p>}
        <div className={estilos.esqueleto} />
        <div className={estilos.esqueleto} />
        <div className={estilos.esqueleto} />
      </div>
    )
  }

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
      noDisponible: cancion.vozDisponible ? undefined : EXP.audioSinVoz
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

  const notas = notasDelFormulario({
    cancion,
    destino,
    estimacion,
    opciones,
    haySesion: p.haySesion,
    temaBorrador: p.temaBorrador
  })
  const tamano = estimacion?.bytes != null ? formatearTamano(estimacion.bytes) : null
  const tiempo = estimacion?.segundos != null ? formatearTiempoEstimado(estimacion.segundos) : null
  const textoEstimacion = EXP.estimacion(tamano, tiempo)
  const errorCampo = error ? textoErrorExp(error.codigo) : null
  // Los errores del destino van junto a «Guardar como»; el resto, antes de las notas.
  const errorEnDestino =
    error !== null &&
    ['DESTINO_NO_DISPONIBLE', 'DESTINO_OCUPADO', 'SIN_ESPACIO'].includes(error.codigo)

  const cerrarAyuda = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    // Esc cierra primero el popover y devuelve el foco; no llega al diálogo.
    e.preventDefault()
    e.stopPropagation()
    setAyudaAbierta(false)
    botonAyuda.current?.focus()
  }

  return (
    <div className={estilos.columnas}>
      <div className={estilos.formulario}>
        <div className={estilos.fila}>
          <span className={estilos.etiquetaFila}>{EXP.audio}</span>
          <ControlSegmentado
            etiqueta={EXP.audio}
            opciones={opcionesAudio}
            valor={audio}
            onCambio={p.alCambiarAudio}
          />
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
              {ayudaAbierta && (
                // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                <div
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
            </span>
          </span>
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
        <div className={estilos.fila}>
          <label htmlFor={idDestino} className={estilos.etiquetaFila}>
            {EXP.destino}
          </label>
          <div className={estilos.filaDestino}>
            <input
              id={idDestino}
              readOnly
              value={destino?.ruta ?? ''}
              aria-label={EXP.destinoAria(destino?.ruta ?? '')}
              title={destino?.ruta}
              className={`${estilosComponentes.entrada} ${estilos.rutaDestino}`}
            />
            <Boton onClick={p.alCambiarDestino}>{EXP.cambiar}</Boton>
          </div>
          <Anuncio texto={anuncios.destino} />
          {destino?.existe && <AvisoEnLinea tipo="aviso">{EXP.avisoExiste}</AvisoEnLinea>}
          {errorCampo && errorEnDestino && (
            <AvisoEnLinea tipo="error">
              <strong>{errorCampo.titulo}</strong> {errorCampo.explicacion}
            </AvisoEnLinea>
          )}
        </div>
        {textoEstimacion && (
          <p className={estilos.estimacion} data-estimacion>
            {textoEstimacion}
          </p>
        )}
        {errorCampo && !errorEnDestino && (
          <AvisoEnLinea tipo="error">
            <strong>{errorCampo.titulo}</strong> {errorCampo.explicacion}
          </AvisoEnLinea>
        )}
        {notas.length > 0 && (
          <div className={estilos.notas} data-notas>
            {notas.map((n) => (
              <AvisoEnLinea key={n.id} tipo={n.tipo}>
                {n.texto}
              </AvisoEnLinea>
            ))}
          </div>
        )}
      </div>
      <div className={estilos.lateral}>
        <MuestraExportacion
          cancion={cancion}
          ancho={ancho}
          alto={alto}
          fps={fps}
          formato={formato}
        />
      </div>
    </div>
  )
}
