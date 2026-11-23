import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AUDIO_PREDETERMINADO,
  FORMATO_PREDETERMINADO,
  FPS_PREDETERMINADO,
  RESOLUCION_PREDETERMINADA,
  type FormatoId,
  type Fps,
  type PerfilesIpc,
  type Proporcion,
  type Resolucion
} from '@shared/exportacion'
import type { CarpetaDestinoIpc } from '@shared/ipc'
import { cancionExportable, type CancionExportable } from '../dialogo/cancion'
import {
  cambiarFormato,
  cambiarProporcion,
  cambiarResolucion,
  normalizar,
  type Ajuste,
  type OpcionesExportacion
} from '../dialogo/modelo'
import { EXP, codigoDeError } from '../dialogo/textos'
import type { AnunciosFormulario } from '../dialogo/useFormulario'
import type { LoteVista } from './modelo'

export type SiExiste = 'numerar' | 'sustituir' | 'omitir'

// La respuesta a «si ya existe» se recuerda mientras la app está abierta (main no la persiste, 0319).
let siExisteRecordado: SiExiste = 'numerar'
/** Solo para pruebas. */
export const reiniciarSiExiste = (): void => {
  siExisteRecordado = 'numerar'
}

const OPCIONES_INICIALES: OpcionesExportacion = {
  audio: AUDIO_PREDETERMINADO,
  formato: FORMATO_PREDETERMINADO,
  ancho: RESOLUCION_PREDETERMINADA.ancho,
  alto: RESOLUCION_PREDETERMINADA.alto,
  fps: FPS_PREDETERMINADO
}

export type CargaLote =
  { tipo: 'cargando' } | { tipo: 'listo' } | { tipo: 'error'; codigo: string; mensaje: string }

export interface ErrorLote {
  codigo: string
  mensaje: string
}

const errorDe = (e: unknown): ErrorLote => ({
  codigo: codigoDeError(e),
  mensaje:
    e && typeof e === 'object' && 'mensaje' in e && typeof e.mensaje === 'string' ? e.mensaje : ''
})

/**
 * Estado del formulario de un lote (spec 10 · Feature 8, G): carga las canciones, los perfiles, las opciones
 * recordadas y la carpeta propuesta (`destinoCarpeta()` sin argumento, sin diálogo); suma las estimaciones;
 * cambia de carpeta con el selector del sistema (cancelarlo conserva la anterior) y lanza `iniciarLote`.
 */
export function useFormularioLote(cancionIds: readonly string[]) {
  const [carga, setCarga] = useState<CargaLote>({ tipo: 'cargando' })
  const [canciones, setCanciones] = useState<CancionExportable[]>([])
  const [perfiles, setPerfiles] = useState<PerfilesIpc | null>(null)
  const [opciones, setOpciones] = useState<OpcionesExportacion>(OPCIONES_INICIALES)
  const [carpeta, setCarpeta] = useState<CarpetaDestinoIpc | null>(null)
  const [siExiste, setSiExisteEstado] = useState<SiExiste>(siExisteRecordado)
  const [estimacion, setEstimacion] = useState<{
    bytes: number | null
    segundos: number | null
  } | null>(null)
  const [anuncios, setAnuncios] = useState<AnunciosFormulario>({})
  const [error, setError] = useState<ErrorLote | null>(null)
  const [iniciando, setIniciando] = useState(false)
  const vivo = useRef(true)
  const ids = cancionIds.join('|')

  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
    }
  }, [])

  useEffect(() => {
    let activo = true
    void (async () => {
      try {
        const api = window.shinobi
        const [lista, p, config, c] = await Promise.all([
          Promise.all(ids.split('|').map((id) => api.biblioteca.obtener(id))),
          api.exportacion.perfiles(),
          api.config.obtener().catch(() => null),
          api.exportacion.destinoCarpeta()
        ])
        if (!activo) return
        const r = config?.exportacion
        const base: OpcionesExportacion = {
          audio: r?.audio ?? OPCIONES_INICIALES.audio,
          formato: r?.formato ?? OPCIONES_INICIALES.formato,
          ancho: r?.ancho ?? OPCIONES_INICIALES.ancho,
          alto: r?.alto ?? OPCIONES_INICIALES.alto,
          fps: r?.fps ?? OPCIONES_INICIALES.fps
        }
        setCanciones(lista.flatMap((x) => (x ? [cancionExportable(x)] : [])))
        setPerfiles(p)
        setOpciones(normalizar(p, base).opciones)
        setCarpeta(c)
        setCarga({ tipo: 'listo' })
      } catch (e) {
        if (activo) setCarga({ tipo: 'error', ...errorDe(e) })
      }
    })()
    return () => {
      activo = false
    }
  }, [ids])

  // Estimación: la suma de la de cada canción; una respuesta atrasada no pisa a la nueva.
  const { audio, formato, ancho, alto, fps } = opciones
  const listo = carga.tipo === 'listo'
  useEffect(() => {
    if (!listo) return
    let activo = true
    void Promise.all(
      ids
        .split('|')
        .map((cancionId) =>
          window.shinobi.exportacion
            .estimar({ cancionId, formato, ancho, alto, fps, audio })
            .catch(() => null)
        )
    ).then((lista) => {
      if (!activo) return
      const suma = (campo: 'bytes' | 'segundos'): number | null =>
        lista.some((e) => e === null || e[campo] === null)
          ? null
          : lista.reduce((s, e) => s + (e?.[campo] ?? 0), 0)
      setEstimacion({ bytes: suma('bytes'), segundos: suma('segundos') })
    })
    return () => {
      activo = false
    }
  }, [listo, ids, formato, ancho, alto, fps, audio])

  const anunciar = useCallback((clave: keyof AnunciosFormulario, texto: string) => {
    setAnuncios((a) => ({ ...a, [clave]: texto }))
    setTimeout(() => {
      if (vivo.current)
        setAnuncios((a) => {
          const resto = { ...a }
          delete resto[clave]
          return resto
        })
    }, 4000)
  }, [])

  const aplicar = (a: Ajuste) => {
    setOpciones(a.opciones)
    setError(null)
    if (a.cambio.resolucion)
      anunciar(
        'resolucion',
        EXP.anuncioResolucion(a.cambio.resolucion.ancho, a.cambio.resolucion.alto)
      )
    if (a.cambio.fps) anunciar('fps', EXP.anuncioFps(a.cambio.fps.anterior, a.cambio.fps.nuevo))
  }

  return {
    carga,
    canciones,
    perfiles,
    opciones,
    carpeta,
    siExiste,
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
      if (perfiles && f !== opciones.formato) aplicar(cambiarFormato(perfiles, opciones, f))
    },
    cambiarSiExiste: (v: SiExiste) => {
      siExisteRecordado = v
      setSiExisteEstado(v)
    },
    /** [Cambiar…]: «Elegir carpeta» del sistema; con `null` (cancelado) se conserva la anterior. */
    cambiarCarpeta: async () => {
      if (!carpeta) return
      try {
        const nueva = await window.shinobi.exportacion.destinoCarpeta(carpeta.carpetaId)
        if (!nueva || !vivo.current) return
        setCarpeta(nueva)
        setError(null)
      } catch (e) {
        if (vivo.current) setError(errorDe(e))
      }
    },
    /** «Exportar {n} videos»: devuelve el lote aceptado o `null` si main lo rechazó (el error queda a la vista). */
    iniciar: async (): Promise<Omit<LoteVista, 'iniciadoEn'> | null> => {
      if (!carpeta || iniciando) return null
      setIniciando(true)
      setError(null)
      try {
        const r = await window.shinobi.exportacion.iniciarLote({
          cancionIds: canciones.map((c) => c.id),
          formato,
          ancho,
          alto,
          fps,
          audio,
          carpetaId: carpeta.carpetaId,
          siExiste
        })
        const porId = new Map(canciones.map((c) => [c.id, c]))
        const quien = (id: string) => ({
          id,
          titulo: porId.get(id)?.titulo ?? '',
          artista: porId.get(id)?.artista ?? ''
        })
        return {
          loteId: r.loteId,
          canciones: r.encoladas.map((e) => quien(e.cancionId)),
          trabajos: Object.fromEntries(r.encoladas.map((e) => [e.cancionId, e.trabajoId])),
          ronda: r.encoladas.map((e) => e.cancionId),
          omitidas: r.omitidas.map((o) => ({ ...quien(o.id), motivo: o.motivo })),
          carpeta: carpeta.ruta,
          opciones
        }
      } catch (e) {
        if (vivo.current) setError(errorDe(e))
        return null
      } finally {
        if (vivo.current) setIniciando(false)
      }
    }
  }
}
