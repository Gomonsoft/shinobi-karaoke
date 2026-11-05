import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent
} from 'react'
import { RefreshCw } from 'lucide-react'
import { analizarUrlYoutube } from '@shared/youtube'
import type { ApiShinobi, InfoYoutubeIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { CampoTexto } from '../../componentes/Campos'
import { Icono } from '../../componentes/Icono'
import { useNavegacion, type DatosInicialesAnadir } from '../../navegacion/estado'
import { AVISO_YOUTUBE } from '../acerca/textos'
import { detallesDeError } from '../biblioteca/errores'
import { formatearDuracion } from '../biblioteca/tarjeta'
import { esErrorGenerico, textoDeError } from '../progreso/textos'
import { CamposDatos, metadatosParaIpc, type ValoresDatos } from './CamposDatos'
import { Miniatura } from './Miniatura'
import { AvisoLarga } from './AvisoLarga'
import { TEXTO, TEXTO_YT as YT } from './textos'
import estilos from './anadir.module.css'

interface ErrorVista {
  codigo: string
  mensaje: string
  detalles?: string
}

function comoErrorVista(err: unknown): ErrorVista {
  const e = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>
  return {
    codigo: typeof e.codigo === 'string' ? e.codigo : 'ERROR_INTERNO',
    mensaje: typeof e.mensaje === 'string' ? e.mensaje : '',
    detalles: typeof e.detalles === 'string' ? e.detalles : undefined
  }
}

const hayCapaAbierta = (): boolean =>
  document.querySelector('[aria-modal="true"], [role="menu"]') !== null

/** Errores tras los que tiene sentido ofrecer el archivo local (criterio 8). */
const OFRECEN_ARCHIVO = new Set(['SIN_CONEXION', 'YOUTUBE_BLOQUEADO', 'VIDEO_NO_DISPONIBLE'])

/** Canción larga: más de 10 min (docs/ux/03). */
const UMBRAL_LARGA_S = 600

/**
 * Evento de main durante una consulta (0050): `fuente.estadoInfo { consultaId, fase }`.
 * Mientras el renderer espera no conoce aún el `consultaId`, así que vale el de cualquier consulta.
 * Acceso tolerante: las APIs falsas de algunas pruebas no lo definen.
 */
type SuscribirEstadoInfo = ApiShinobi['alCambiarEstadoInfo']
const suscribirEstadoInfo = (): SuscribirEstadoInfo | undefined =>
  (window.shinobi as Partial<ApiShinobi>).alCambiarEstadoInfo

interface PanelYoutubeProps {
  /** Canción existente cuya fuente se sustituye ("Usar otro enlace"). */
  iniciales?: DatosInicialesAnadir
  /** Vuelve a la pestaña Archivo. */
  alUsarArchivo: () => void
}

/** Origen "Enlace de YouTube": aviso legal, enlace, vista previa y formulario "Revisar datos". */
export function PanelYoutube({ iniciales, alUsarArchivo }: PanelYoutubeProps) {
  const { ir } = useNavegacion()
  // null: leyendo la configuración.
  const [aceptado, setAceptado] = useState<boolean | null>(null)
  const [url, setUrl] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [actualizando, setActualizando] = useState(false)
  const [info, setInfo] = useState<InfoYoutubeIpc | null>(null)
  const [error, setError] = useState<ErrorVista | null>(null)
  const [errorAviso, setErrorAviso] = useState(false)
  const [valores, setValores] = useState<ValoresDatos>({ titulo: '', artista: '', album: '' })
  const [errorTitulo, setErrorTitulo] = useState<string | undefined>()
  const [enviando, setEnviando] = useState(false)

  const ref = useRef({ gen: 0, buscando: false, pendiente: null as string | null })
  const refUrl = useRef<HTMLInputElement>(null)
  const refTitulo = useRef<HTMLInputElement>(null)
  const refError = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let activo = true
    window.shinobi.config.obtener().then(
      (c) => activo && setAceptado(Boolean(c.aviso_youtube_aceptado)),
      () => activo && setAceptado(false)
    )
    return () => {
      activo = false
    }
  }, [])

  // Al salir de la vista no queda nada pendiente: se cancela la consulta y se descarta la guardada.
  useEffect(() => {
    const op = ref.current
    return () => {
      op.gen++
      if (op.buscando) {
        op.buscando = false
        void window.shinobi.fuente.cancelarInfo().catch(() => {})
      }
      if (op.pendiente) {
        const id = op.pendiente
        op.pendiente = null
        void window.shinobi.fuente.cancelarInfo(id).catch(() => {})
      }
    }
  }, [])

  // C1: main avisa de que actualiza yt-dlp mientras la consulta espera.
  useEffect(() => {
    const baja = suscribirEstadoInfo()?.((ev) => {
      if (ev.fase === 'actualizando' && ref.current.buscando) setActualizando(true)
    })
    return () => baja?.()
  }, [])

  const buscar = useCallback(
    async (texto: string) => {
      if (ref.current.buscando) return
      // Una vista previa anterior se descarta al buscar otra.
      if (ref.current.pendiente) {
        void window.shinobi.fuente.cancelarInfo(ref.current.pendiente).catch(() => {})
        ref.current.pendiente = null
      }
      setInfo(null)
      setError(null)
      const local = analizarUrlYoutube(texto)
      if (!local.ok) {
        setError({ codigo: local.codigo, mensaje: '' })
        return
      }
      const gen = ++ref.current.gen
      ref.current.buscando = true
      setBuscando(true)
      setActualizando(false)
      try {
        const datos = await window.shinobi.fuente.infoYoutube(texto.trim())
        if (gen !== ref.current.gen) {
          void window.shinobi.fuente.cancelarInfo(datos.consultaId).catch(() => {})
          return
        }
        ref.current.buscando = false
        ref.current.pendiente = datos.consultaId
        setBuscando(false)
        setActualizando(false)
        setValores(
          iniciales
            ? {
                titulo: iniciales.titulo,
                artista: iniciales.artista,
                album: iniciales.album ?? ''
              }
            : datos.metadatos
        )
        setErrorTitulo(undefined)
        setInfo(datos)
      } catch (err) {
        if (gen !== ref.current.gen) return
        ref.current.buscando = false
        setBuscando(false)
        setActualizando(false)
        setError(comoErrorVista(err))
      }
    },
    [iniciales]
  )

  const cancelarBusqueda = useCallback(() => {
    ref.current.gen++
    ref.current.buscando = false
    void window.shinobi.fuente.cancelarInfo().catch(() => {})
    setBuscando(false)
    setActualizando(false)
    setError(null)
  }, [])

  // Esc cancela la búsqueda en curso o, si no hay, vuelve a la Biblioteca.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if (e.defaultPrevented || hayCapaAbierta()) return
      const campo = e.target instanceof Element ? e.target.closest('input, textarea, select') : null
      if (campo && !campo.closest('[data-panel-anadir]')) return
      e.preventDefault()
      if (ref.current.buscando) cancelarBusqueda()
      else ir({ tipo: 'biblioteca' })
    }
    window.addEventListener('keydown', alTeclear, true)
    return () => window.removeEventListener('keydown', alTeclear, true)
  }, [cancelarBusqueda, ir])

  // Foco: campo de enlace al mostrarse; mensaje al fallar; título seleccionado con la vista previa.
  const campoVisible = aceptado === true
  const hayInfo = info !== null
  const hayError = error !== null
  useEffect(() => {
    if (campoVisible) refUrl.current?.focus()
  }, [campoVisible])
  useEffect(() => {
    if (hayInfo) {
      refTitulo.current?.focus()
      refTitulo.current?.select()
    }
  }, [hayInfo])
  useEffect(() => {
    if (hayError) refError.current?.focus()
  }, [hayError, error])

  const aceptar = async () => {
    setErrorAviso(false)
    try {
      await window.shinobi.config.actualizar({ aviso_youtube_aceptado: new Date().toISOString() })
      setAceptado(true)
    } catch {
      setErrorAviso(true)
    }
  }

  const alPegar = (e: ClipboardEvent<HTMLInputElement>) => {
    const texto = e.clipboardData.getData('text').trim()
    if (texto === '') return
    e.preventDefault()
    setUrl(texto)
    void buscar(texto)
  }

  const continuar = async () => {
    if (!info || enviando) return
    if (valores.titulo.trim() === '') {
      setErrorTitulo(TEXTO.tituloVacio)
      refTitulo.current?.focus()
      return
    }
    setErrorTitulo(undefined)
    setError(null)
    setEnviando(true)
    try {
      const resumen = await window.shinobi.fuente.confirmarYoutube(
        info.consultaId,
        metadatosParaIpc(valores),
        iniciales ? { cancionId: iniciales.cancionId } : undefined
      )
      ref.current.pendiente = null
      ir({ tipo: 'cancion', id: resumen.id, paso: 'progreso' })
    } catch (err) {
      setError(comoErrorVista(err))
      setEnviando(false)
    }
  }

  const copiar = (e: ErrorVista) =>
    void navigator.clipboard?.writeText([detallesDeError(e), e.detalles].filter(Boolean).join('\n'))

  if (aceptado === null) return null

  if (!aceptado) {
    return (
      <div className={estilos.legal} data-testid="aviso-legal">
        <h2 className="t-subtitulo">{AVISO_YOUTUBE.titulo}</h2>
        <p>{AVISO_YOUTUBE.intro}</p>
        <ul>
          {AVISO_YOUTUBE.puntos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className={estilos.ayuda}>{YT.legalSoloUnaVez}</p>
        {errorAviso && <AvisoEnLinea tipo="error">{YT.errorAceptar}</AvisoEnLinea>}
        <div className={estilos.acciones}>
          <Boton variante="fantasma" onClick={alUsarArchivo}>
            {YT.legalRechazar}
          </Boton>
          <Boton variante="primario" data-foco-inicial onClick={() => void aceptar()}>
            {YT.legalAceptar}
          </Boton>
        </div>
      </div>
    )
  }

  const duracion = info ? (formatearDuracion(Math.round(info.duracionS * 1000)) ?? '') : ''
  const sinFormulario = (e: FormEvent) => e.preventDefault()

  return (
    <div className={estilos.formulario}>
      <form
        className={estilos.formulario}
        noValidate
        onSubmit={(e) => {
          sinFormulario(e)
          if (!buscando) void buscar(url)
        }}
      >
        <div className={estilos.campoEnlace}>
          <CampoTexto
            ref={refUrl}
            type="text"
            etiqueta={YT.urlEtiqueta}
            value={url}
            readOnly={buscando}
            aria-describedby="anadir-url-ayuda"
            onChange={(e) => setUrl(e.target.value)}
            onPaste={alPegar}
          />
          {buscando ? (
            <Boton onClick={cancelarBusqueda}>{TEXTO.cancelar}</Boton>
          ) : (
            <Boton variante="primario" type="submit">
              {YT.buscar}
            </Boton>
          )}
        </div>
        {actualizando ? (
          <p id="anadir-url-ayuda" className={estilos.reintento} role="status">
            <Icono icono={RefreshCw} tamano={16} />
            <span>{YT.reintentoYtdlp}</span>
          </p>
        ) : (
          <p id="anadir-url-ayuda" className={estilos.ayuda}>
            {buscando ? <span role="status">{YT.buscando}</span> : YT.urlAyuda}
          </p>
        )}
      </form>

      {error && (
        <div ref={refError} tabIndex={-1} className={estilos.grupoError}>
          <AvisoEnLinea
            tipo="error"
            accion={
              esErrorGenerico(error.codigo) ? (
                <Boton variante="fantasma" onClick={() => copiar(error)}>
                  {TEXTO.copiarDetalles}
                </Boton>
              ) : OFRECEN_ARCHIVO.has(error.codigo) ? (
                <Boton variante="fantasma" onClick={alUsarArchivo}>
                  {YT.usarArchivo}
                </Boton>
              ) : undefined
            }
          >
            <strong>{textoDeError(error.codigo).titulo}</strong> {textoDeError(error.codigo).cuerpo}
          </AvisoEnLinea>
        </div>
      )}

      {info && (
        <>
          <div className={estilos.resumen}>
            <Miniatura url={info.miniaturaDataUrl} />
            <div className={estilos.datosResumen}>
              <span className={estilos.nombre}>{info.tituloOriginal}</span>
              <span>
                {info.canal}
                {duracion && ` · ${duracion}`}
              </span>
            </div>
          </div>
          <form
            className={estilos.formulario}
            noValidate
            onSubmit={(e) => {
              sinFormulario(e)
              void continuar()
            }}
          >
            <div>
              <h2 className="t-subtitulo">{TEXTO.datosTitulo}</h2>
              <p className={estilos.ayuda}>{TEXTO.datosAyuda}</p>
            </div>
            <CamposDatos
              valores={valores}
              onCambio={(v) => {
                setValores(v)
                if (errorTitulo && v.titulo.trim() !== '') setErrorTitulo(undefined)
              }}
              errorTitulo={errorTitulo}
              refTitulo={refTitulo}
              onIntroUltimo={() => void continuar()}
            />
            {info.duracionS > UMBRAL_LARGA_S && (
              <AvisoLarga duracion={duracion} duracionMs={Math.round(info.duracionS * 1000)} />
            )}
            <div className={estilos.acciones}>
              <Boton variante="fantasma" onClick={() => ir({ tipo: 'biblioteca' })}>
                {TEXTO.cancelar}
              </Boton>
              <Boton variante="primario" type="submit" cargando={enviando}>
                {YT.descargar}
              </Boton>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
