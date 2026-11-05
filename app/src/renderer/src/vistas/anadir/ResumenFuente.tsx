import { useCallback, useEffect, useRef, useState } from 'react'
import type { Cancion } from '@shared/cancion'
import type { ResumenCancionIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion } from '../../navegacion/estado'
import { useTrabajosVivos } from '../../trabajos/useTrabajos'
import { detallesDeError, mensajeDeError } from '../biblioteca/errores'
import { formatearDuracion } from '../biblioteca/tarjeta'
import { CabeceraCancion } from '../cancion/CabeceraCancion'
import { esErrorGenerico, textoDeError } from '../progreso/textos'
import { Miniatura } from './Miniatura'
import { CamposDatos, metadatosParaIpc, type ValoresDatos } from './CamposDatos'
import { TEXTO, TEXTO_YT as YT } from './textos'
import estilos from './anadir.module.css'

interface Carga {
  estado: 'cargando' | 'listo' | 'error'
  resumen: ResumenCancionIpc | null
  cancion: Cancion | null
}

/** Paso 1 de una canción que ya existe: resumen de la fuente y datos editables con autoguardado. */
export function ResumenFuente({ id }: { id: string }) {
  const { ir } = useNavegacion()
  const vivos = useTrabajosVivos()
  const raiz = useRef<HTMLElement>(null)
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando', resumen: null, cancion: null })
  const [valores, setValores] = useState<ValoresDatos>({ titulo: '', artista: '', album: '' })
  const [errorTitulo, setErrorTitulo] = useState<string | undefined>()
  const [mensaje, setMensaje] = useState('')
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)
  const guardado = useRef<string>('')
  const enfocado = useRef(false)
  const refTitulo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let activo = true
    const baja = window.shinobi.alCambiarCancion((ev) => {
      if (!activo || ev.id !== id || ev.eliminada) return
      setCarga((c) => (c.estado === 'listo' ? { ...c, resumen: ev.resumen } : c))
    })
    Promise.all([window.shinobi.biblioteca.listar(), window.shinobi.biblioteca.obtener(id)]).then(
      ([lista, cancion]) => {
        if (!activo) return
        const resumen = lista.find((c) => c.id === id) ?? null
        if (!resumen || !cancion) {
          setCarga({ estado: 'error', resumen: null, cancion: null })
          return
        }
        const v = {
          titulo: cancion.metadatos.titulo,
          artista: cancion.metadatos.artista,
          album: cancion.metadatos.album ?? ''
        }
        guardado.current = JSON.stringify(metadatosParaIpc(v))
        setValores(v)
        setCarga({ estado: 'listo', resumen, cancion })
      },
      () => activo && setCarga({ estado: 'error', resumen: null, cancion: null })
    )
    return () => {
      activo = false
      baja()
    }
  }, [id])

  const listo = carga.estado === 'listo'
  useEffect(() => {
    if (!listo || enfocado.current) return
    enfocado.current = true
    // Wireframe E: el foco inicial es "Descargar ahora".
    const inicial = raiz.current?.querySelector<HTMLElement>('[data-foco-inicial]')
    ;(inicial ?? refTitulo.current)?.focus()
  }, [listo])

  const autoguardar = useCallback(async () => {
    if (valores.titulo.trim() === '') {
      setErrorTitulo(TEXTO.tituloVacio)
      setMensaje('')
      return
    }
    setErrorTitulo(undefined)
    const meta = metadatosParaIpc(valores)
    if (JSON.stringify(meta) === guardado.current) return
    try {
      await window.shinobi.biblioteca.actualizarMetadatos(id, meta)
      guardado.current = JSON.stringify(meta)
      setErrorGuardar(null)
      setMensaje(TEXTO.guardado)
    } catch (err) {
      setMensaje('')
      setErrorGuardar(`No se pudieron guardar los datos. ${mensajeDeError(err)}`.trim())
    }
  }, [valores, id])

  const { resumen, cancion } = carga
  const fuente = cancion?.fuente
  const estadoFuente = resumen?.pasos?.fuente
  const completada = estadoFuente?.estado === 'completado'
  const esYoutube = fuente?.tipo === 'youtube'
  const nombre = esYoutube
    ? (fuente?.url ?? '').replace(/^https?:\/\/(www\.)?/, '')
    : (fuente?.nombre_original ?? fuente?.url ?? '')
  const duracion = formatearDuracion(cancion?.metadatos.duracion_ms ?? resumen?.duracionMs ?? null)
  const iniciales = {
    cancionId: id,
    titulo: valores.titulo,
    artista: valores.artista,
    album: valores.album.trim() === '' ? null : valores.album.trim()
  }
  const errorFuente = estadoFuente?.error
  const hayTrabajo = vivos.trabajos.some((t) => t.cancionId === id && t.paso === 'fuente')
  const pendiente = esYoutube && estadoFuente?.estado === 'pendiente' && !hayTrabajo
  const interrumpido = esYoutube && estadoFuente?.estado === 'interrumpido'
  const reintentable = errorFuente ? textoDeError(errorFuente.codigo).reintentable : false

  const otroEnlace = () => ir({ tipo: 'anadir', iniciales: { ...iniciales, origen: 'youtube' } })
  const otroArchivo = () => ir({ tipo: 'anadir', iniciales: { ...iniciales, origen: 'archivo' } })
  const reintentar = async () => {
    try {
      await window.shinobi.fuente.reintentar(id)
      ir({ tipo: 'cancion', id, paso: 'progreso' })
    } catch (err) {
      mostrarToast({
        tipo: 'error',
        mensaje: 'No se pudo volver a intentar la descarga.',
        accion: {
          etiqueta: TEXTO.copiarDetalles,
          alAccionar: () => void navigator.clipboard?.writeText(detallesDeError(err))
        }
      })
    }
  }

  return (
    <section ref={raiz} className={estilos.vista} aria-labelledby="titulo-vista">
      <CabeceraCancion resumen={resumen} actual="fuente" />
      <h1 id="titulo-vista" className="t-titulo" tabIndex={-1}>
        {TEXTO.datosTitulo}
      </h1>

      {carga.estado === 'error' && (
        <>
          <AvisoEnLinea tipo="error">No se pudo abrir la canción.</AvisoEnLinea>
          <Boton data-foco-inicial onClick={() => ir({ tipo: 'biblioteca' })}>
            ‹ Biblioteca
          </Boton>
        </>
      )}

      {listo && (
        <>
          <div className={estilos.resumen}>
            <Miniatura url={resumen?.miniatura ?? null} />
            <div className={estilos.datosResumen}>
              <span className={estilos.nombre}>{nombre}</span>
              {duracion && <span>{duracion}</span>}
            </div>
          </div>

          {pendiente && (
            <AvisoEnLinea
              tipo="info"
              accion={
                <div className={estilos.acciones}>
                  <Boton variante="primario" data-foco-inicial onClick={() => void reintentar()}>
                    {YT.descargarAhora}
                  </Boton>
                  <Boton variante="fantasma" onClick={otroEnlace}>
                    {YT.otroEnlace}
                  </Boton>
                </div>
              }
            >
              <strong>{YT.pendienteTitulo}</strong> {YT.pendienteCuerpo}
            </AvisoEnLinea>
          )}

          {interrumpido && (
            <AvisoEnLinea
              tipo="aviso"
              accion={
                <Boton variante="primario" data-foco-inicial onClick={() => void reintentar()}>
                  {YT.reintentar}
                </Boton>
              }
            >
              <strong>{YT.interrumpidoTitulo}</strong> {YT.interrumpidoCuerpo}
            </AvisoEnLinea>
          )}

          {!completada && errorFuente && (
            <AvisoEnLinea
              tipo="error"
              accion={
                !esYoutube ? (
                  <Boton variante="primario" onClick={otroArchivo}>
                    {TEXTO.otroArchivo}
                  </Boton>
                ) : reintentable ? (
                  <Boton variante="primario" data-foco-inicial onClick={() => void reintentar()}>
                    {YT.reintentar}
                  </Boton>
                ) : (
                  <div className={estilos.acciones}>
                    <Boton variante="primario" data-foco-inicial onClick={otroEnlace}>
                      {YT.otroEnlace}
                    </Boton>
                    <Boton variante="fantasma" onClick={otroArchivo}>
                      {TEXTO.otroArchivo}
                    </Boton>
                  </div>
                )
              }
            >
              <strong>{textoDeError(errorFuente.codigo).titulo}</strong>{' '}
              {esErrorGenerico(errorFuente.codigo)
                ? errorFuente.mensaje
                : textoDeError(errorFuente.codigo).cuerpo}
            </AvisoEnLinea>
          )}

          <form className={estilos.formulario} noValidate onSubmit={(e) => e.preventDefault()}>
            <CamposDatos
              valores={valores}
              onCambio={(v) => {
                setValores(v)
                if (errorTitulo && v.titulo.trim() !== '') setErrorTitulo(undefined)
              }}
              errorTitulo={errorTitulo}
              refTitulo={refTitulo}
              onSalir={() => void autoguardar()}
              onIntroUltimo={() => void autoguardar()}
            />
            <p role="status" className={estilos.estadoGuardado}>
              {mensaje}
            </p>
            {errorGuardar && <AvisoEnLinea tipo="error">{errorGuardar}</AvisoEnLinea>}
          </form>

          {completada && <p className={estilos.nota}>{TEXTO.notaResumen}</p>}
        </>
      )}
    </section>
  )
}
