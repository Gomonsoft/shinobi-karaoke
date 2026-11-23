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
import { AreaTexto } from '../../componentes/Campos'
import { Icono } from '../../componentes/Icono'
import { useNavegacion, type DatosInicialesAnadir } from '../../navegacion/estado'
import { AVISO_YOUTUBE } from '../acerca/textos'
import { detallesDeError } from '../biblioteca/errores'
import { formatearDuracion } from '../biblioteca/tarjeta'
import { esErrorGenerico, textoDeError } from '../progreso/textos'
import { AvisoBusqueda } from './AvisoBusqueda'
import { guardarBorrador, leerBorrador, olvidarBorrador } from './borrador'
import { CamposDatos, metadatosParaIpc, type ValoresDatos } from './CamposDatos'
import { Miniatura } from './Miniatura'
import { AvisoLarga } from './AvisoLarga'
import { clasificarEnlaces, type Enlace } from './lote/enlaces'
import {
  filaDeEntradaLista,
  filaDeInfo,
  filaNoDisponible,
  fusionarRepetidas,
  marcarIniciales,
  nombreDeLista,
  type FilaTabla,
  type TablaLote
} from './lote/modelo'
import { LOTE } from './lote/textosLote'
import { TEXTO, TEXTO_YT as YT } from './textos'
import estilos from './anadir.module.css'
import { copiarDetalles } from '../../soporte/detalles'

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
  /** Vuelve de Ajustes: se repite la búsqueda del enlace y se recupera lo escrito (F6-N8). */
  restaurar?: boolean
  /** Varios enlaces o una lista: pasa a la tabla de revisión (spec 03 · feature 7). */
  alLote?: (tabla: TablaLote) => void
}

/** Errores de la consulta que paran todo el lote (el resto deja una fila con ✕). */
const PARAN_LOTE = new Set(['YOUTUBE_BLOQUEADO', 'SIN_CONEXION', 'CANCELADO'])

/** Origen "Enlace de YouTube": aviso legal, enlace, vista previa y formulario "Revisar datos". */
export function PanelYoutube({ iniciales, alUsarArchivo, restaurar, alLote }: PanelYoutubeProps) {
  const { ir } = useNavegacion()
  // Lo recuperado de Ajustes (lectura sin consumir: sobrevive a un doble montaje).
  const [restaurado] = useState(() => {
    const b = restaurar ? leerBorrador() : null
    return b?.origen === 'youtube' ? b : null
  })
  const valoresRestaurados = useRef(restaurado?.valores ?? null)
  const [recuperado, setRecuperado] = useState(false)
  // null: leyendo la configuración.
  const [aceptado, setAceptado] = useState<boolean | null>(null)
  const [listasAceptado, setListasAceptado] = useState(false)
  /** Aviso legal con el punto de las listas, pendiente de aceptar antes de consultar una lista. */
  const [avisoListas, setAvisoListas] = useState<{
    texto: string
    conservar?: { id: string; valores: ValoresDatos }
  } | null>(null)
  /** Enlace con lista del video ya consultado: `add.lote.ofertaLista`. */
  const [ofertaLista, setOfertaLista] = useState<string | null>(null)
  const [progresoLote, setProgresoLote] = useState<{ i: number; n: number; lista: boolean } | null>(
    null
  )
  const [url, setUrl] = useState(restaurado?.url ?? '')
  const [buscando, setBuscando] = useState(false)
  const [actualizando, setActualizando] = useState(false)
  const [info, setInfo] = useState<InfoYoutubeIpc | null>(null)
  const [error, setError] = useState<ErrorVista | null>(null)
  const [errorAviso, setErrorAviso] = useState(false)
  const [valores, setValores] = useState<ValoresDatos>({ titulo: '', artista: '', album: '' })
  const [errorTitulo, setErrorTitulo] = useState<string | undefined>()
  const [enviando, setEnviando] = useState(false)

  const ref = useRef({ gen: 0, buscando: false, pendiente: null as string | null })
  const refUrl = useRef<HTMLTextAreaElement>(null)
  const refTitulo = useRef<HTMLInputElement>(null)
  const refError = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let activo = true
    window.shinobi.config.obtener().then(
      (c) => {
        if (!activo) return
        setAceptado(Boolean(c.aviso_youtube_aceptado))
        setListasAceptado(Boolean(c.aviso_youtube_listas_aceptado))
      },
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

  const buscarUno = useCallback(
    async (texto: string, listaId: string | null) => {
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
        const recuperados = valoresRestaurados.current
        valoresRestaurados.current = null
        setRecuperado(recuperados !== null)
        setValores(
          recuperados ??
            (iniciales
              ? {
                  titulo: iniciales.titulo,
                  artista: iniciales.artista,
                  album: iniciales.album ?? ''
                }
              : datos.metadatos)
        )
        setErrorTitulo(undefined)
        setInfo(datos)
        setOfertaLista(listaId && !iniciales ? texto.trim() : null)
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

  /** Consulta los enlaces (listas y videos) y pasa a la tabla de revisión (L1 → L2). */
  const consultarLote = useCallback(
    async (
      enlaces: Enlace[],
      extra: { ignorados: number; repetidos: number },
      conservar?: { id: string; valores: ValoresDatos }
    ) => {
      const gen = ++ref.current.gen
      ref.current.buscando = true
      setBuscando(true)
      setActualizando(false)
      const hayLista = enlaces.some((e) => e.tipo === 'lista')
      setProgresoLote({ i: 1, n: enlaces.length, lista: hayLista && enlaces.length === 1 })
      let filas: FilaTabla[] = []
      let libreBytes: number | null = null
      let factorMinutos: number | null = null
      let recortada = false
      let titulo: string | null = null
      let errorLista: ErrorVista | null = null
      try {
        for (const [i, e] of enlaces.entries()) {
          setProgresoLote((p) => (p ? { ...p, i: i + 1 } : p))
          try {
            if (e.tipo === 'lista') {
              const lista = await window.shinobi.fuente.infoLista(e.url)
              if (gen !== ref.current.gen) return
              libreBytes = lista.libreBytes
              factorMinutos = lista.factorMinutos
              recortada = recortada || lista.recortada
              titulo = nombreDeLista(lista.titulo)
              filas.push(...lista.entradas.map((x) => filaDeEntradaLista(x, lista)))
            } else {
              const datos = await window.shinobi.fuente.infoYoutube(e.url)
              if (gen !== ref.current.gen) return
              filas.push(filaDeInfo(datos))
            }
          } catch (err) {
            if (gen !== ref.current.gen) return
            const ev = comoErrorVista(err)
            if (PARAN_LOTE.has(ev.codigo) || (e.tipo === 'lista' && enlaces.length === 1)) {
              throw err
            }
            if (e.tipo === 'lista') errorLista = ev
            else filas.push(filaNoDisponible(e.id, e.url))
          }
        }
        if (gen !== ref.current.gen) return
        const unidas = fusionarRepetidas(filas)
        filas = unidas.filas
        if (conservar) {
          filas = filas.map((f) =>
            f.clave === `yt:${conservar.id}`
              ? {
                  ...f,
                  ...conservar.valores,
                  tocados: ['titulo', 'artista', 'album'] as FilaTabla['tocados']
                }
              : f
          )
        }
        ref.current.buscando = false
        setBuscando(false)
        setProgresoLote(null)
        if (filas.length === 0) {
          setError(errorLista ?? { codigo: 'LISTA_NO_DISPONIBLE', mensaje: '' })
          return
        }
        if (libreBytes === null && !hayLista) {
          // Enlaces sueltos: una sola lectura da el espacio y el factor para estimar el tiempo.
          const r = await Promise.resolve(window.shinobi.fuente.espacioLibre()).catch(() => null)
          libreBytes = r?.libreBytes ?? null
          factorMinutos = r?.factorMinutos ?? null
        }
        const unaLista = enlaces.length === 1 && enlaces[0]?.tipo === 'lista'
        alLote?.({
          filas: marcarIniciales(filas),
          fuente: unaLista ? 'lista' : 'enlaces',
          nombreOrigen: unaLista ? titulo : null,
          youtube: true,
          repetidas: unidas.repetidas + extra.repetidos,
          ignorados: 0,
          enlacesIgnorados: extra.ignorados,
          paqueteIgnorado: false,
          truncada: false,
          recortada,
          libreBytes,
          factorMinutos
        })
      } catch (err) {
        if (gen !== ref.current.gen) return
        ref.current.buscando = false
        setBuscando(false)
        setActualizando(false)
        setProgresoLote(null)
        setError(comoErrorVista(err))
      }
    },
    [alLote]
  )

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
      setOfertaLista(null)
      const c = clasificarEnlaces(texto)
      const unico = c.enlaces.length === 1 ? c.enlaces[0] : undefined
      if (c.enlaces.length === 0) {
        setError({ codigo: c.noSoportadas > 0 ? 'URL_NO_SOPORTADA' : 'URL_NO_VALIDA', mensaje: '' })
        return
      }
      // Un solo video: el flujo de una canción de siempre.
      if (unico?.tipo === 'video') {
        await buscarUno(unico.url, unico.listaId)
        return
      }
      if (iniciales) {
        setError({ codigo: 'URL_NO_SOPORTADA', mensaje: '' })
        return
      }
      if (!listasAceptado && c.enlaces.some((e) => e.tipo === 'lista')) {
        setAvisoListas({ texto })
        return
      }
      await consultarLote(c.enlaces, { ignorados: c.ignorados, repetidos: c.repetidos })
    },
    [buscarUno, consultarLote, iniciales, listasAceptado]
  )

  /** [Añadir la lista entera] bajo la vista previa de un video que está en una lista. */
  const anadirLista = () => {
    if (!ofertaLista || !info) return
    const v = clasificarEnlaces(ofertaLista).enlaces[0]
    if (v?.tipo !== 'video' || !v.listaId) return
    const lista: Enlace = {
      tipo: 'lista',
      idLista: v.listaId,
      url: `https://www.youtube.com/watch?v=${v.id}&list=${v.listaId}`
    }
    const conservar = { id: v.id, valores }
    if (!listasAceptado) {
      setAvisoListas({ texto: lista.url, conservar })
      return
    }
    void consultarLote([lista], { ignorados: 0, repetidos: 0 }, conservar)
  }

  const cancelarBusqueda = useCallback(() => {
    ref.current.gen++
    ref.current.buscando = false
    void window.shinobi.fuente.cancelarInfo().catch(() => {})
    setBuscando(false)
    setActualizando(false)
    setProgresoLote(null)
    setError(null)
  }, [])

  // Esc cancela la búsqueda en curso o, si no hay, vuelve a la Biblioteca.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if (e.defaultPrevented || hayCapaAbierta()) return
      const campo = e.target instanceof Element ? e.target.closest('input, textarea, select') : null
      if (campo && !campo.closest('[data-panel-anadir]')) return
      // Con la lista de sugerencias abierta, Esc solo la cierra (la cierra el propio campo).
      if (campo?.getAttribute('aria-expanded') === 'true') return
      e.preventDefault()
      if (ref.current.buscando) cancelarBusqueda()
      else ir({ tipo: 'biblioteca' })
    }
    window.addEventListener('keydown', alTeclear, true)
    return () => window.removeEventListener('keydown', alTeclear, true)
  }, [cancelarBusqueda, ir])

  // Vuelta de Ajustes: se repite la búsqueda del enlace guardado.
  const reintentoRestaurado = useRef(restaurado !== null)
  useEffect(() => {
    if (aceptado !== true || !reintentoRestaurado.current || !restaurado) return
    reintentoRestaurado.current = false
    void buscar(restaurado.url)
  }, [aceptado, buscar, restaurado])

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

  /** «Entendido»: un solo diálogo acepta el aviso de YouTube y el de las listas (el que falte). */
  const aceptar = async () => {
    setErrorAviso(false)
    const ahora = new Date().toISOString()
    try {
      await window.shinobi.config.actualizar({
        ...(aceptado ? {} : { aviso_youtube_aceptado: ahora }),
        aviso_youtube_listas_aceptado: ahora
      })
    } catch {
      setErrorAviso(true)
      return
    }
    setAceptado(true)
    setListasAceptado(true)
    const pendiente = avisoListas
    setAvisoListas(null)
    if (!pendiente) return
    const l = clasificarEnlaces(pendiente.texto)
    if (pendiente.conservar) {
      const e = l.enlaces[0]
      const lista: Enlace | null =
        e?.tipo === 'lista'
          ? e
          : e?.tipo === 'video' && e.listaId
            ? { tipo: 'lista', idLista: e.listaId, url: e.url }
            : null
      if (lista) await consultarLote([lista], { ignorados: 0, repetidos: 0 }, pendiente.conservar)
    } else {
      await consultarLote(l.enlaces, { ignorados: l.ignorados, repetidos: l.repetidos })
    }
  }

  const alPegar = (e: ClipboardEvent<HTMLTextAreaElement>) => {
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
      olvidarBorrador()
      ir({ tipo: 'cancion', id: resumen.id, paso: 'progreso' })
    } catch (err) {
      setError(comoErrorVista(err))
      setEnviando(false)
    }
  }

  const copiar = (e: ErrorVista) =>
    void copiarDetalles([detallesDeError(e), e.detalles].filter(Boolean).join('\n'))

  if (aceptado === null) return null

  if (!aceptado || avisoListas) {
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
          <AreaTexto
            ref={refUrl}
            etiqueta={YT.urlEtiqueta}
            value={url}
            rows={Math.min(6, Math.max(1, url.split('\n').length))}
            className={estilos.areaEnlaces}
            readOnly={buscando}
            aria-describedby="anadir-url-ayuda"
            onChange={(e) => setUrl(e.target.value)}
            onPaste={alPegar}
            onKeyDown={(e) => {
              // Intro consulta; Mayús + Intro añade un renglón.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                if (!buscando) void buscar(url)
              }
            }}
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
            {buscando ? (
              <span role="status">
                {progresoLote
                  ? progresoLote.lista
                    ? LOTE.consultandoLista
                    : LOTE.consultandoEnlaces(progresoLote.i, progresoLote.n)
                  : YT.buscando}
              </span>
            ) : (
              YT.urlAyuda
            )}
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
            {error.codigo === 'LISTA_NO_DISPONIBLE' ? (
              <>
                <strong>{LOTE.listaNoDisponibleTitulo}</strong> {LOTE.listaNoDisponibleCuerpo}
              </>
            ) : (
              <>
                <strong>{textoDeError(error.codigo).titulo}</strong>{' '}
                {textoDeError(error.codigo).cuerpo}
              </>
            )}
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
          {ofertaLista && (
            <AvisoEnLinea
              tipo="info"
              accion={
                <Boton onClick={anadirLista} disabled={buscando}>
                  {LOTE.anadirLista}
                </Boton>
              }
            >
              {LOTE.ofertaLista}
            </AvisoEnLinea>
          )}
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
              key={info.consultaId}
              propuesta={iniciales || recuperado ? null : info.datos}
              valores={valores}
              onCambio={(v) => {
                setValores(v)
                if (errorTitulo && v.titulo.trim() !== '') setErrorTitulo(undefined)
              }}
              errorTitulo={errorTitulo}
              refTitulo={refTitulo}
              onIntroUltimo={() => void continuar()}
            />
            {!iniciales && (
              <AvisoBusqueda
                alCambiar={() => {
                  guardarBorrador({ origen: 'youtube', url, valores })
                  ir({ tipo: 'ajustes', origen: { tipo: 'anadir' }, seccion: 'preparacion' })
                }}
              />
            )}
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
