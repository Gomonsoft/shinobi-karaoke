import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AUDIO_PREDETERMINADO,
  FORMATO_PREDETERMINADO,
  FPS_PREDETERMINADO,
  RESOLUCION_PREDETERMINADA,
  type DestinoIpc,
  type EstimacionExportacionIpc,
  type Fps,
  type FormatoId,
  type PerfilesIpc,
  type Proporcion,
  type Resolucion
} from '@shared/exportacion'
import type { CodigoError } from '@shared/errores'
import { cancionExportable, type CancionExportable } from './cancion'
import {
  cambiarFormato,
  cambiarProporcion,
  cambiarResolucion,
  normalizar,
  nombreDeRuta,
  sinExtension,
  type Ajuste,
  type CambioAutomatico,
  type OpcionesExportacion
} from './modelo'
import { codigoDeError, EXP } from './textos'

/** Tiempo que se muestran los anuncios junto al control (spec 10). */
export const DURACION_ANUNCIO_MS = 4000

export interface AnunciosFormulario {
  fps?: string
  resolucion?: string
  destino?: string
}

export interface ErrorFormulario {
  codigo: CodigoError
  mensaje: string
}

export type CargaFormulario =
  { tipo: 'cargando' } | { tipo: 'listo' } | { tipo: 'error'; codigo: CodigoError; mensaje: string }

const OPCIONES_INICIALES: OpcionesExportacion = {
  audio: AUDIO_PREDETERMINADO,
  formato: FORMATO_PREDETERMINADO,
  ancho: RESOLUCION_PREDETERMINADA.ancho,
  alto: RESOLUCION_PREDETERMINADA.alto,
  fps: FPS_PREDETERMINADO
}

function mensajeDe(err: unknown): string {
  return err && typeof err === 'object' && 'mensaje' in err && typeof err.mensaje === 'string'
    ? err.mensaje
    : ''
}

/**
 * Estado del formulario de exportación (estados A y E de la spec 10): carga la canción, los
 * perfiles y las opciones recordadas; aplica las reglas de perfil no soportado; mantiene el
 * destino, la estimación y los anuncios; y lanza la exportación.
 */
export function useFormulario(cancionId: string, opcionesIniciales?: OpcionesExportacion) {
  const [carga, setCarga] = useState<CargaFormulario>({ tipo: 'cargando' })
  const [cancion, setCancion] = useState<CancionExportable | null>(null)
  const [perfiles, setPerfiles] = useState<PerfilesIpc | null>(null)
  const [opciones, setOpciones] = useState<OpcionesExportacion>(OPCIONES_INICIALES)
  const [destino, setDestino] = useState<DestinoIpc | null>(null)
  const [estimacion, setEstimacion] = useState<EstimacionExportacionIpc | null>(null)
  const [anuncios, setAnuncios] = useState<AnunciosFormulario>({})
  const [error, setError] = useState<ErrorFormulario | null>(null)
  const [iniciando, setIniciando] = useState(false)
  const elegido = useRef(false)
  const pedidoDestino = useRef(0)
  const temporizadores = useRef<
    Partial<Record<keyof AnunciosFormulario, ReturnType<typeof setTimeout>>>
  >({})
  const vivo = useRef(true)

  useEffect(() => {
    vivo.current = true
    const pendientes = temporizadores.current
    return () => {
      vivo.current = false
      Object.values(pendientes).forEach(clearTimeout)
    }
  }, [])

  const anunciar = useCallback((clave: keyof AnunciosFormulario, texto: string) => {
    clearTimeout(temporizadores.current[clave])
    setAnuncios((a) => ({ ...a, [clave]: texto }))
    temporizadores.current[clave] = setTimeout(() => {
      if (vivo.current)
        setAnuncios((a) => {
          const resto = { ...a }
          delete resto[clave]
          return resto
        })
    }, DURACION_ANUNCIO_MS)
  }, [])

  const anunciarCambio = useCallback(
    (cambio: CambioAutomatico) => {
      if (cambio.resolucion)
        anunciar(
          'resolucion',
          EXP.anuncioResolucion(cambio.resolucion.ancho, cambio.resolucion.alto)
        )
      if (cambio.fps) anunciar('fps', EXP.anuncioFps(cambio.fps.anterior, cambio.fps.nuevo))
    },
    [anunciar]
  )

  // Carga inicial: canción, perfiles, opciones recordadas y destino propuesto.
  useEffect(() => {
    let activo = true
    void (async () => {
      try {
        const api = window.shinobi
        const [c, p, config] = await Promise.all([
          api.biblioteca.obtener(cancionId),
          api.exportacion.perfiles(),
          api.config.obtener().catch(() => null)
        ])
        if (!activo) return
        if (!c) {
          setCarga({ tipo: 'error', codigo: 'CANCION_NO_DISPONIBLE', mensaje: EXP.noCancion })
          return
        }
        const exportable = cancionExportable(c)
        const recordadas = config?.exportacion
        const base: OpcionesExportacion = {
          ...(opcionesIniciales ?? {
            audio: recordadas?.audio ?? OPCIONES_INICIALES.audio,
            formato: recordadas?.formato ?? OPCIONES_INICIALES.formato,
            ancho: recordadas?.ancho ?? OPCIONES_INICIALES.ancho,
            alto: recordadas?.alto ?? OPCIONES_INICIALES.alto,
            fps: recordadas?.fps ?? OPCIONES_INICIALES.fps
          })
        }
        if (!exportable.vozDisponible) base.audio = 'instrumental'
        const { opciones: inicial } = normalizar(p, base)
        const d = await api.exportacion.destinoPropuesto({
          cancionId,
          formato: inicial.formato
        })
        if (!activo) return
        setCancion(exportable)
        setPerfiles(p)
        setOpciones(inicial)
        setDestino(d)
        setCarga({ tipo: 'listo' })
      } catch (err) {
        if (activo) setCarga({ tipo: 'error', codigo: codigoDeError(err), mensaje: mensajeDe(err) })
      }
    })()
    return () => {
      activo = false
    }
    // Las opciones iniciales solo cuentan al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancionId])

  // Estimación: se recalcula con cada opción; una respuesta atrasada no pisa a la nueva.
  const { audio, formato, ancho, alto, fps } = opciones
  const listo = carga.tipo === 'listo'
  useEffect(() => {
    if (!listo) return
    let activo = true
    void window.shinobi.exportacion.estimar({ cancionId, formato, ancho, alto, fps, audio }).then(
      (e) => activo && setEstimacion(e),
      () => activo && setEstimacion(null)
    )
    return () => {
      activo = false
    }
  }, [listo, cancionId, formato, ancho, alto, fps, audio])

  const aplicar = (ajuste: Ajuste) => {
    setOpciones(ajuste.opciones)
    anunciarCambio(ajuste.cambio)
    setError(null)
  }

  /** Pide el destino del formato nuevo conservando carpeta y nombre elegidos (0124). */
  const renovarDestino = (formatoNuevo: FormatoId) => {
    const pedido = ++pedidoDestino.current
    const desde = elegido.current ? destino : null
    void window.shinobi.exportacion
      .destinoPropuesto({
        cancionId,
        formato: formatoNuevo,
        ...(desde ? { desdeDestinoId: desde.destinoId } : null)
      })
      .then((nuevo) => {
        if (!vivo.current || pedido !== pedidoDestino.current) return
        if (desde && sinExtension(nuevo.ruta) !== sinExtension(desde.ruta)) {
          // Main no pudo conservar el destino elegido: vuelve al propuesto y se avisa.
          elegido.current = false
          anunciar('destino', EXP.anuncioDestino(nombreDeRuta(nuevo.ruta)))
        }
        setDestino(nuevo)
      })
      .catch(() => undefined)
  }

  return {
    carga,
    cancion,
    perfiles,
    opciones,
    destino,
    estimacion,
    anuncios,
    error,
    iniciando,
    cambiarAudio: (a: OpcionesExportacion['audio']) => {
      setOpciones((o) => ({ ...o, audio: a }))
      setError(null)
    },
    cambiarProporcion: (p: Proporcion) =>
      perfiles && aplicar(cambiarProporcion(perfiles, opciones, p)),
    cambiarResolucion: (r: Resolucion) =>
      perfiles && aplicar(cambiarResolucion(perfiles, opciones, r)),
    cambiarFps: (f: Fps) => {
      setOpciones((o) => ({ ...o, fps: f }))
      setError(null)
    },
    cambiarFormato: (f: FormatoId) => {
      if (!perfiles || f === opciones.formato) return
      aplicar(cambiarFormato(perfiles, opciones, f))
      renovarDestino(f)
    },
    /** [Cambiar…]: diálogo «Guardar» del sistema; cancelarlo no cambia nada. */
    cambiarDestino: async () => {
      if (!destino) return
      try {
        const nuevo = await window.shinobi.exportacion.elegirDestino(destino.destinoId)
        if (!nuevo || !vivo.current) return
        elegido.current = true
        pedidoDestino.current++
        setDestino(nuevo)
        setError(null)
      } catch (err) {
        if (vivo.current) setError({ codigo: codigoDeError(err), mensaje: mensajeDe(err) })
      }
    },
    /** «Exportar»: devuelve el `trabajoId` o `null` si main rechazó la validación. */
    iniciar: async (): Promise<string | null> => {
      if (!destino || iniciando) return null
      setIniciando(true)
      setError(null)
      try {
        const { trabajoId } = await window.shinobi.exportacion.iniciar({
          cancionId,
          formato,
          ancho,
          alto,
          fps,
          audio,
          destinoId: destino.destinoId
        })
        return trabajoId
      } catch (err) {
        if (vivo.current) setError({ codigo: codigoDeError(err), mensaje: mensajeDe(err) })
        return null
      } finally {
        if (vivo.current) setIniciando(false)
      }
    }
  }
}
