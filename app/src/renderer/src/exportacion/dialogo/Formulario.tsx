import { useEffect, useId, useRef } from 'react'
import {
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
import { carpetaDeRuta, esCostoso, faltaEspacio, type OpcionesExportacion } from './modelo'
import type { CancionExportable } from './cancion'
import type { AnunciosFormulario, ErrorFormulario } from './useFormulario'
import { MuestraExportacion } from './MuestraExportacion'
import { OpcionesVideo } from './OpcionesVideo'
import { EXP, formatearTamano, formatearTiempoEstimado, textoErrorExp } from './textos'
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
  /** `CANCION_EXPORTANDOSE` y esa exportación sigue: su `trabajoId` (V36). */
  exportacionExistente?: string | null
  /** [Ver exportación]: cambia el diálogo al estado de ese trabajo. */
  alVerExportacion?(trabajoId: string): void
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
  const idDestino = useId()
  const idErrorDestino = useId()
  const filaDestino = useRef<HTMLDivElement>(null)
  // Carpeta sin permiso (V35): el foco va a [Cambiar…] cuando aparece el error.
  const errorCarpeta = error?.codigo === 'DESTINO_NO_DISPONIBLE' ? error : null
  useEffect(() => {
    if (errorCarpeta) filaDestino.current?.querySelector('button')?.focus()
  }, [errorCarpeta])
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

  const { ancho, alto, fps, formato } = opciones
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
  const yaExportandose = error?.codigo === 'CANCION_EXPORTANDOSE'
  const errorCampo = error && !yaExportandose ? textoErrorExp(error.codigo) : null
  // Los errores del destino van junto a «Guardar como»; el resto, antes de las notas.
  const errorEnDestino =
    error !== null &&
    ['DESTINO_NO_DISPONIBLE', 'DESTINO_OCUPADO', 'SIN_ESPACIO'].includes(error.codigo)
  const textoErrorDestino = errorCarpeta
    ? { titulo: EXP.errorDestinoTitulo, explicacion: EXP.errorDestinoPermiso }
    : errorCampo

  return (
    <div className={estilos.columnas}>
      <div className={estilos.formulario}>
        <OpcionesVideo
          perfiles={perfiles}
          opciones={opciones}
          vozDisponible={cancion.vozDisponible}
          anuncios={anuncios}
          alCambiarAudio={p.alCambiarAudio}
          alCambiarProporcion={p.alCambiarProporcion}
          alCambiarResolucion={p.alCambiarResolucion}
          alCambiarFps={p.alCambiarFps}
          alCambiarFormato={p.alCambiarFormato}
        />
        <div className={estilos.fila}>
          <label htmlFor={idDestino} className={estilos.etiquetaFila}>
            {EXP.destino}
          </label>
          <div ref={filaDestino} className={estilos.filaDestino}>
            <input
              id={idDestino}
              readOnly
              value={destino?.ruta ?? ''}
              aria-label={EXP.destinoAria(destino?.ruta ?? '')}
              title={destino?.ruta}
              aria-invalid={errorCarpeta ? true : undefined}
              aria-describedby={errorCarpeta ? idErrorDestino : undefined}
              className={`${estilosComponentes.entrada} ${estilos.rutaDestino} ${errorCarpeta ? estilos.rutaDestinoError : ''}`}
            />
            <Boton onClick={p.alCambiarDestino}>{EXP.cambiar}</Boton>
          </div>
          <Anuncio texto={anuncios.destino} />
          {textoErrorDestino && errorEnDestino && (
            <div id={idErrorDestino}>
              <AvisoEnLinea tipo="error">
                <strong>{textoErrorDestino.titulo}</strong> {textoErrorDestino.explicacion}
              </AvisoEnLinea>
            </div>
          )}
        </div>
        {textoEstimacion && (
          <p className={estilos.estimacion} data-estimacion>
            {textoEstimacion}
          </p>
        )}
        {(destino?.existe ||
          (errorCampo && !errorEnDestino) ||
          (yaExportandose && p.exportacionExistente) ||
          notas.length > 0) && (
          // Pegada al borde inferior de la zona con scroll: los avisos que condicionan la
          // decisión se ven siempre, encima de los botones del pie.
          <div className={estilos.notas} data-notas>
            {destino?.existe && <AvisoEnLinea tipo="aviso">{EXP.avisoExiste}</AvisoEnLinea>}
            {errorCampo && !errorEnDestino && (
              <AvisoEnLinea tipo="error">
                <strong>{errorCampo.titulo}</strong> {errorCampo.explicacion}
              </AvisoEnLinea>
            )}
            {yaExportandose && p.exportacionExistente && (
              <AvisoEnLinea
                tipo="error"
                accion={
                  <Boton onClick={() => p.alVerExportacion?.(p.exportacionExistente!)}>
                    {EXP.verExportacion}
                  </Boton>
                }
              >
                <strong>{EXP.errorCancionExportandoseTitulo}</strong>{' '}
                {EXP.errorCancionExportandoseTexto}
              </AvisoEnLinea>
            )}
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
