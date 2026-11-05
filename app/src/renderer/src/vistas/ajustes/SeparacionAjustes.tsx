import { useCallback, useEffect, useRef, useState } from 'react'
import type { Config } from '@shared/config'
import type { EstadoRuntimeIpc, RequisitosRuntimeIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { BarraProgreso } from '../../componentes/BarraProgreso'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { mostrarToast } from '../../componentes/gestorToasts'
import { DialogoTextoLegal } from '../acerca/DialogoTextoLegal'
import { textoDeError } from '../primer-arranque/modelo'
import estilos from './ajustes.module.css'
import {
  descripcionEquipo,
  fechaLarga,
  modeloEfectivo,
  rangoMinutos,
  textoMb,
  textoTiempo,
  type EstimacionAj
} from './modelo'
import { AJ } from './textos'

const CUATRO_MINUTOS_MS = 240_000

type Volver = EstadoRuntimeIpc['volverACalidad']
interface Avance {
  bytes: number
  total: number
}

/** Sección "Separación de voz" (`ux/08`): informativa, sin forma de elegir modelo (0019). */
export function SeparacionAjustes() {
  const [config, setConfig] = useState<Config | null>(null)
  const [estado, setEstado] = useState<EstadoRuntimeIpc | null>(null)
  const [requisitos, setRequisitos] = useState<RequisitosRuntimeIpc | null>(null)
  const [tiempo, setTiempo] = useState<EstimacionAj | null>(null)
  const [tiempoCalidad, setTiempoCalidad] = useState<EstimacionAj | null>(null)
  const [avance, setAvance] = useState<Avance | null>(null)
  const [dialogo, setDialogo] = useState(false)
  const [creditos, setCreditos] = useState(false)
  /** Entre pulsar "Volver a Calidad" y la respuesta de main (la promesa sigue viva). */
  const [lanzando, setLanzando] = useState(false)
  const [falloLocal, setFalloLocal] = useState<string | null>(null)
  const sigueDescarga = useRef(false)

  const modelo = config ? modeloEfectivo(config) : null
  const claveModelos = config
    ? `${config.separacion.modo}|${config.separacion.modelos_descargados.join()}|${String(config.separacion.rapido_aceptado)}`
    : ''

  // Carga y suscripciones (reenganche: `estado().volverACalidad` se lee al montar).
  useEffect(() => {
    let activo = true
    const rt = window.shinobi.runtime
    window.shinobi.config.obtener().then(
      (c) => activo && setConfig(c),
      () => undefined
    )
    rt.estado().then(
      (e) => activo && setEstado(e),
      () => undefined
    )
    const bajas = [
      window.shinobi.alCambiarConfig((c) => activo && setConfig(c)),
      rt.alCambiar((e) => activo && setEstado(e)),
      rt.alProgreso((p) => {
        if (activo && p.modo === 'calidad') setAvance({ bytes: p.bytes, total: p.total })
      })
    ]
    return () => {
      activo = false
      bajas.forEach((b) => b())
    }
  }, [])

  // Estimaciones y tamaños según el modelo y los modelos descargados.
  useEffect(() => {
    if (modelo === null) return
    let activo = true
    const rt = window.shinobi.runtime
    const leer = (m?: 'calidad') =>
      rt.estimarSeparacion(CUATRO_MINUTOS_MS, m).then(
        (e) => e,
        () => null
      )
    void leer().then((e) => activo && setTiempo(e))
    if (modelo === 'rapido') {
      void leer('calidad').then((e) => activo && setTiempoCalidad(e))
      rt.requisitos({ recalcularEspacio: false }).then(
        (r) => activo && setRequisitos(r),
        () => undefined
      )
    }
    return () => {
      activo = false
    }
  }, [modelo, claveModelos])

  // Éxito (también tras un reenganche): variante Calidad, toast y anuncio (la región del toast).
  const descargando = lanzando || estado?.volverACalidad?.estado === 'descargando'
  useEffect(() => {
    if (descargando) sigueDescarga.current = true
  }, [descargando])
  useEffect(() => {
    if (modelo === 'calidad' && sigueDescarga.current) {
      sigueDescarga.current = false
      setLanzando(false)
      mostrarToast({ tipo: 'exito', mensaje: AJ.toastCalidad })
    }
  }, [modelo])

  const iniciar = useCallback(() => {
    setDialogo(false)
    setFalloLocal(null)
    setLanzando(true)
    sigueDescarga.current = true
    window.shinobi.runtime
      .volverACalidad()
      .catch((e: unknown) => {
        const codigo = (e as { codigo?: string } | null)?.codigo
        if (codigo === 'CANCELADO') {
          sigueDescarga.current = false
          return
        }
        setFalloLocal(codigo ?? 'ERROR_INTERNO')
        sigueDescarga.current = false
      })
      .finally(() => {
        setLanzando(false)
        void window.shinobi.runtime.estado().then(setEstado, () => undefined)
      })
  }, [])

  const cancelar = () => void window.shinobi.runtime.cancelarVolverACalidad().catch(() => undefined)

  if (config === null || estado === null || modelo === null) return null

  const equipo = descripcionEquipo(estado, config.instalacion.hardware.vram_mb)
  const frase = textoTiempo(tiempo)
  const volver: Volver = estado.volverACalidad
  const progreso = volver?.estado === 'descargando' ? volver : null
  const total = avance?.total || progreso?.total || requisitos?.bytesCalidad || 0
  const bytes = avance?.bytes ?? progreso?.bytes ?? 0
  const pct = total > 0 ? Math.min(100, Math.floor((100 * bytes) / total)) : 0
  const codigoError = !descargando
    ? ((volver?.estado === 'error' ? volver.error?.codigo : null) ?? falloLocal)
    : null
  const textoError = codigoError ? textoDeError(codigoError, null, 'modelo') : null

  const rango = rangoMinutos(tiempoCalidad)
  const falta = requisitos?.calidadDescargado === false && requisitos.bytesCalidad != null
  const descarga =
    falta && requisitos?.bytesCalidad ? AJ.descarga(textoMb(requisitos.bytesCalidad)) : null
  const fechaRapido = config.separacion.rapido_aceptado

  return (
    <div className={estilos.seccion} aria-labelledby="aj-sep-titulo" role="group">
      <h2 id="aj-sep-titulo" className={estilos.subtitulo}>
        {AJ.sepTitulo}
      </h2>
      <p>{AJ.equipo(equipo)}</p>
      <p>{AJ.modelo[modelo]}</p>
      <p className={estilos.suave}>
        {modelo === 'calidad' ? AJ.descCalidad : AJ.descRapido}
        {frase ? ` ${frase}` : ''}
      </p>

      {modelo === 'rapido' && (
        <>
          <AvisoEnLinea tipo="aviso">
            {AJ.rapidoAviso(fechaRapido ? fechaLarga(fechaRapido) : '')}{' '}
            <button type="button" className={estilos.enlace} onClick={() => setCreditos(true)}>
              {AJ.creditos}
            </button>
          </AvisoEnLinea>

          <p>
            {rango ? AJ.calidadInfo(rango[0], rango[1]) : AJ.calidadInfoSinTiempo}
            {descarga ? ` ${descarga}` : ''}
          </p>

          {descargando ? (
            <div className={estilos.descarga}>
              <div className={estilos.descargaFila}>
                <span aria-live="off">
                  {AJ.descargando(pct, Math.round(bytes / 1e6), Math.round(total / 1e6))}
                </span>
                <Boton onClick={cancelar}>{AJ.cancelar}</Boton>
              </div>
              <BarraProgreso etiqueta="Descarga del modelo Calidad" valor={pct} />
              <p className={estilos.suave}>{AJ.mientras}</p>
            </div>
          ) : textoError ? (
            <AvisoEnLinea tipo="error" accion={<Boton onClick={iniciar}>{AJ.reintentar}</Boton>}>
              <strong>{textoError.titulo}</strong> {textoError.cuerpo} {AJ.errorSigue}
            </AvisoEnLinea>
          ) : (
            <Boton className={estilos.accion} onClick={() => setDialogo(true)}>
              {AJ.botonCalidad}
            </Boton>
          )}
          <p className={estilos.suave}>{AJ.nota}</p>
        </>
      )}

      <Dialogo
        abierto={dialogo}
        titulo={AJ.dialogoTitulo}
        onCancelar={() => setDialogo(false)}
        enfoqueInicial="[data-confirmar]"
        acciones={
          <>
            <Boton onClick={() => setDialogo(false)}>{AJ.cancelar}</Boton>
            <Boton variante="primario" data-confirmar onClick={iniciar}>
              {AJ.confirmar}
            </Boton>
          </>
        }
      >
        <p>
          {rango ? AJ.dialogoTiempo(rango[0], rango[1]) : AJ.dialogoSinTiempo}
          {descarga ? ` ${descarga}` : ''}
        </p>
        <p>{AJ.dialogoSinRapido}</p>
      </Dialogo>
      {creditos && <DialogoTextoLegal tipo="terceros" alCerrar={() => setCreditos(false)} />}
    </div>
  )
}
