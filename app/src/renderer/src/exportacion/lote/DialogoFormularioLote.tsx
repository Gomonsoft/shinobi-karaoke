import { useEffect, useId, useRef, useState } from 'react'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { ControlSegmentado } from '../../componentes/ControlSegmentado'
import { Dialogo } from '../../componentes/Dialogo'
import estilosComponentes from '../../componentes/componentes.module.css'
import { useSesion } from '../../sesion/ProveedorSesion'
import { motivoDe } from '../../vistas/biblioteca/acciones/textos'
import { esCostoso, faltaEspacio, sinPerfiles } from '../dialogo/modelo'
import { MuestraExportacion } from '../dialogo/MuestraExportacion'
import { OpcionesVideo } from '../dialogo/OpcionesVideo'
import {
  EXP,
  formatearPosicion,
  formatearTamano,
  formatearTiempoEstimado,
  textoErrorExp
} from '../dialogo/textos'
import estilos from '../dialogo/exportacion.module.css'
import { duracionTotal, type LoteVista } from './modelo'
import { EXP_LOTE } from './textos'
import { useFormularioLote, type SiExiste } from './useFormularioLote'

/** Tiempo sin perfiles a partir del cual se explica la espera (`exp.cargando`). */
export const RETARDO_CARGANDO_LOTE_MS = 300

interface Props {
  /** Las que se exportarán, en el orden de la Biblioteca. */
  cancionIds: string[]
  /** Seleccionadas que no se pueden exportar: van al final, atenuadas, con su motivo. */
  noAplican: { id: string; titulo: string; artista: string; motivo: string }[]
  alIniciado(lote: Omit<LoteVista, 'iniciadoEn'>): void
  alCerrar(): void
}

const ORDEN_SI_EXISTE: SiExiste[] = ['numerar', 'sustituir', 'omitir']

/** Diálogo G «Exportar videos» (docs/ux/10 · 0.2.2 · Feature 8): mismas opciones para todo el lote y una carpeta. */
export function DialogoFormularioLote({ cancionIds, noAplican, alIniciado, alCerrar }: Props) {
  const f = useFormularioLote(cancionIds)
  const { haySesion } = useSesion()
  const idCabecera = useId()
  const [verCuales, setVerCuales] = useState(false)
  const [lento, setLento] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const cargando = f.carga.tipo === 'cargando'
  useEffect(() => {
    if (!cargando) return
    const t = setTimeout(() => setLento(true), RETARDO_CARGANDO_LOTE_MS)
    return () => clearTimeout(t)
  }, [cargando])

  // Foco inicial: «Audio» (la opción elegida) en cuanto el formulario está listo.
  const listo = f.carga.tipo === 'listo' && f.perfiles !== null && !sinPerfiles(f.perfiles)
  useEffect(() => {
    if (listo)
      raiz.current?.querySelector<HTMLElement>('[data-foco-audio] [aria-checked="true"]')?.focus()
  }, [listo])

  const n = f.canciones.length
  const primera = f.canciones[0]
  const duracion = f.canciones.reduce((s, c) => s + c.duracionMs, 0)
  const bytes = f.estimacion?.bytes ?? null
  const textoEstimacion = EXP_LOTE.estimacion(
    bytes !== null ? formatearTamano(bytes) : null,
    f.estimacion?.segundos != null ? formatearTiempoEstimado(f.estimacion.segundos) : null
  )
  const errorCarpeta =
    f.error && ['DESTINO_NO_DISPONIBLE', 'DESTINO_OCUPADO', 'SIN_ESPACIO'].includes(f.error.codigo)
  const textoError = f.error ? textoErrorExp(f.error.codigo as never) : null

  const exportar = async () => {
    const lote = await f.iniciar()
    if (lote) alIniciado(lote)
  }

  // Ver cuáles: título, artista, duración y nombre; la nota de cada una.
  const notaDe = (c: (typeof f.canciones)[number]): string | null => {
    if (f.opciones.audio === 'instrumental_voz' && !c.vozDisponible) return EXP_LOTE.nota.sinVoz
    if (c.estado === 'lista' && c.modalidad === 'letra_lista') return EXP_LOTE.nota.letraLista
    if (c.estado === 'lista' && c.sinInicio > 0) return EXP_LOTE.nota.incompleta
    return null
  }

  if (f.carga.tipo === 'error') {
    const t = textoErrorExp(f.carga.codigo as never)
    return (
      <Dialogo
        abierto
        titulo={EXP.titulo}
        onCancelar={alCerrar}
        ancho="36rem"
        acciones={
          <Boton variante="primario" onClick={alCerrar}>
            {EXP.botonCerrar}
          </Boton>
        }
      >
        <AvisoEnLinea tipo="error">
          <strong>{t.titulo}</strong> {t.explicacion}
        </AvisoEnLinea>
      </Dialogo>
    )
  }

  const notas: { id: string; tipo: 'info' | 'aviso'; texto: string }[] = []
  if (faltaEspacio(bytes, f.carpeta?.libreBytes ?? null)) {
    notas.push({
      id: 'espacio',
      tipo: 'aviso',
      texto: EXP_LOTE.avisoEspacio(formatearTamano(bytes!), formatearTamano(f.carpeta!.libreBytes!))
    })
  }
  if (haySesion) notas.push({ id: 'sesion', tipo: 'info', texto: EXP.notaSesion })
  if (esCostoso(f.opciones, f.estimacion))
    notas.push({ id: 'costoso', tipo: 'info', texto: EXP.notaCostoso })

  return (
    <Dialogo
      abierto
      titulo={EXP_LOTE.titulo(n || cancionIds.length)}
      onCancelar={alCerrar}
      ancho="45rem"
      descripcionId={idCabecera}
      acciones={
        <>
          <Boton onClick={alCerrar}>{EXP.botonCancelar}</Boton>
          <Boton
            variante="primario"
            disabled={!listo || f.carpeta === null}
            cargando={f.iniciando}
            textoCargando={EXP.botonValidando}
            onClick={() => void exportar()}
          >
            {EXP_LOTE.boton(n)}
          </Boton>
        </>
      }
    >
      <div
        ref={raiz}
        className={estilos.contenedor}
        data-estado={listo ? 'formulario-lote' : 'cargando'}
      >
        <div className={estilos.cuerpo}>
          <div className={estilos.cabecera} id={idCabecera}>
            {n > 0 ? EXP_LOTE.cabecera(n, duracionTotal(duracion)) : lento ? EXP.cargando : ' '}
            {n > 0 && (
              <Boton
                variante="fantasma"
                aria-expanded={verCuales}
                onClick={() => setVerCuales((v) => !v)}
              >
                {verCuales ? EXP_LOTE.ocultarCuales : EXP_LOTE.verCuales}
              </Boton>
            )}
          </div>
          {verCuales && (
            // eslint-disable-next-line jsx-a11y/no-redundant-roles -- role explícito: Safari quita la semántica con list-style none
            <ul
              role="list"
              aria-label={EXP_LOTE.listaAria}
              className={estilos.listaLote}
              tabIndex={n + noAplican.length > 4 ? 0 : undefined}
            >
              {f.canciones.map((c) => {
                const nota = notaDe(c)
                return (
                  <li key={c.id} aria-label={`${c.titulo}, ${c.artista}${nota ? `: ${nota}` : ''}`}>
                    {c.titulo} — {c.artista} · {formatearPosicion(c.duracionMs)}
                    {nota && <span className={`t-pequeno ${estilos.texto2}`}> · {nota}</span>}
                  </li>
                )
              })}
              {noAplican.map((c) => (
                <li key={c.id} className={estilos.texto2}>
                  {c.titulo} — {c.artista} · {motivoDe(c.motivo)}
                </li>
              ))}
            </ul>
          )}
          <div data-foco-audio>
            {f.perfiles && primera ? (
              <div className={estilos.columnas}>
                <div className={estilos.formulario}>
                  <OpcionesVideo
                    perfiles={f.perfiles}
                    opciones={f.opciones}
                    vozDisponible
                    anuncios={f.anuncios}
                    alCambiarAudio={f.cambiarAudio}
                    alCambiarProporcion={f.cambiarProporcion}
                    alCambiarResolucion={f.cambiarResolucion}
                    alCambiarFps={f.cambiarFps}
                    alCambiarFormato={f.cambiarFormato}
                  />
                  <div className={estilos.fila}>
                    <label htmlFor={`${idCabecera}-carpeta`} className={estilos.etiquetaFila}>
                      {EXP_LOTE.carpeta}
                    </label>
                    <div className={estilos.filaDestino}>
                      <input
                        id={`${idCabecera}-carpeta`}
                        readOnly
                        value={f.carpeta?.ruta ?? ''}
                        aria-label={EXP_LOTE.carpetaAria(f.carpeta?.ruta ?? '')}
                        title={f.carpeta?.ruta}
                        aria-invalid={errorCarpeta ? true : undefined}
                        className={`${estilosComponentes.entrada} ${estilos.rutaDestino} ${errorCarpeta ? estilos.rutaDestinoError : ''}`}
                      />
                      <Boton onClick={() => void f.cambiarCarpeta()}>{EXP_LOTE.cambiar}</Boton>
                    </div>
                    {errorCarpeta && textoError && (
                      <AvisoEnLinea tipo="error">
                        <strong>{textoError.titulo}</strong> {textoError.explicacion}
                      </AvisoEnLinea>
                    )}
                  </div>
                  <div className={estilos.fila}>
                    <span className={estilos.etiquetaFila}>{EXP_LOTE.existe}</span>
                    <ControlSegmentado
                      etiqueta={EXP_LOTE.existe}
                      valor={f.siExiste}
                      onCambio={f.cambiarSiExiste}
                      opciones={ORDEN_SI_EXISTE.map((v) => ({
                        valor: v,
                        etiqueta: EXP_LOTE.existeOpciones[v]
                      }))}
                    />
                  </div>
                  {textoEstimacion && (
                    <p className={estilos.estimacion} data-estimacion>
                      {textoEstimacion}
                    </p>
                  )}
                  {((f.error && !errorCarpeta && textoError) || notas.length > 0) && (
                    <div className={estilos.notas} data-notas>
                      {f.error && !errorCarpeta && textoError && (
                        <AvisoEnLinea tipo="error">
                          <strong>{textoError.titulo}</strong> {textoError.explicacion}
                        </AvisoEnLinea>
                      )}
                      {notas.map((x) => (
                        <AvisoEnLinea key={x.id} tipo={x.tipo}>
                          {x.texto}
                        </AvisoEnLinea>
                      ))}
                    </div>
                  )}
                </div>
                <div className={estilos.lateral}>
                  <MuestraExportacion
                    cancion={primera}
                    ancho={f.opciones.ancho}
                    alto={f.opciones.alto}
                    fps={f.opciones.fps}
                    formato={f.opciones.formato}
                    nota={EXP_LOTE.muestra}
                  />
                </div>
              </div>
            ) : (
              <div className={estilos.formulario} aria-busy="true" data-cargando>
                {lento && <p role="status">{EXP.cargando}</p>}
                <div className={estilos.esqueleto} />
                <div className={estilos.esqueleto} />
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialogo>
  )
}
