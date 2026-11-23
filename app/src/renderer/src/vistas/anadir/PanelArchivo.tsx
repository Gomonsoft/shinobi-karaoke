import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { Check } from 'lucide-react'
import type { ImportacionLeidaIpc, LecturaLoteIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { BarraProgreso } from '../../componentes/BarraProgreso'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { useNavegacion, type DatosInicialesAnadir } from '../../navegacion/estado'
import { detallesDeError } from '../biblioteca/errores'
import { formatearDuracion } from '../biblioteca/tarjeta'
import { esErrorGenerico, textoDeError } from '../progreso/textos'
import { AvisoBusqueda } from './AvisoBusqueda'
import { guardarBorrador, leerBorrador, olvidarBorrador } from './borrador'
import { CamposDatos, metadatosParaIpc, type ValoresDatos } from './CamposDatos'
import { AvisoLarga } from './AvisoLarga'
import { tablaDeArchivos, type TablaLote } from './lote/modelo'
import { LOTE } from './lote/textosLote'
import { TEXTO, textoLeido } from './textos'
import estilos from './anadir.module.css'
import { copiarDetalles } from '../../soporte/detalles'
import { abrirImportarPaquete } from '../biblioteca/paquete/almacen'
import { PAQ } from '../biblioteca/paquete/textos'

interface ErrorVista {
  codigo: string
  mensaje: string
  detalles?: string
}

type Estado =
  | { tipo: 'vacio' }
  | { tipo: 'leyendo'; nombre: string }
  /** L1: lectura de las etiquetas de varios archivos o de una carpeta. */
  | { tipo: 'leyendoLote'; n: number | null }
  | { tipo: 'leido'; datos: ImportacionLeidaIpc }
  | { tipo: 'error'; error: ErrorVista }

function comoErrorVista(err: unknown): ErrorVista {
  const e = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>
  return {
    codigo: typeof e.codigo === 'string' ? e.codigo : 'ERROR_INTERNO',
    mensaje: typeof e.mensaje === 'string' ? e.mensaje : '',
    detalles: typeof e.detalles === 'string' ? e.detalles : undefined
  }
}

const nombreDeRuta = (ruta: string): string => ruta.split(/[\\/]/).pop() ?? ruta

/** Hay un diálogo modal o un menú abierto: ellos gestionan su propio Esc. */
const hayCapaAbierta = (): boolean =>
  document.querySelector('[aria-modal="true"], [role="menu"]') !== null

interface PanelArchivoProps {
  /** Archivo arrastrado sobre la Biblioteca: empieza la lectura sin más pasos. */
  archivoInicial?: string
  /** Canción existente cuya fuente se sustituye ("Usar otro enlace"/"Elegir otro archivo"). */
  iniciales?: DatosInicialesAnadir
  /** Vuelve de Ajustes: se vuelve a leer el archivo y se recupera lo escrito (F6-N8). */
  restaurar?: boolean
  /** Varios archivos o una carpeta arrastrados sobre la Biblioteca: empieza L1 sin más pasos. */
  rutasIniciales?: string[]
  /** La lectura dejó varias filas (o una carpeta): pasa a la tabla de revisión. */
  alLote?: (tabla: TablaLote) => void
}

const EXTENSION_PAQUETE = /\.shinobi$/i
const esDirectorio = (item: DataTransferItem): boolean =>
  item.kind === 'file' && item.webkitGetAsEntry?.()?.isDirectory === true

/** Origen "Archivo de tu equipo": zona de arrastre, lectura y formulario "Revisar datos". */
export function PanelArchivo({
  archivoInicial,
  iniciales,
  restaurar,
  rutasIniciales,
  alLote
}: PanelArchivoProps) {
  const { ir } = useNavegacion()
  // Lo recuperado de Ajustes (lectura sin consumir: sobrevive a un doble montaje).
  const [restaurado] = useState(() => {
    const b = restaurar ? leerBorrador() : null
    return b?.origen === 'archivo' ? b : null
  })
  const rutaInicial = archivoInicial ?? restaurado?.ruta
  const [estado, setEstado] = useState<Estado>(
    rutasIniciales && rutasIniciales.length > 0
      ? { tipo: 'leyendoLote', n: rutasIniciales.length }
      : rutaInicial
        ? { tipo: 'leyendo', nombre: nombreDeRuta(rutaInicial) }
        : { tipo: 'vacio' }
  )
  // Lo recuperado de Ajustes: sustituye a lo propuesto al volver a leer el archivo.
  const valoresRestaurados = useRef(restaurado?.valores ?? null)
  const rutaActual = useRef<string | null>(rutaInicial ?? null)
  const [recuperado, setRecuperado] = useState(false)
  const [sobre, setSobre] = useState<number | false>(false)
  const [valores, setValores] = useState<ValoresDatos>({ titulo: '', artista: '', album: '' })
  const [errorTitulo, setErrorTitulo] = useState<string | undefined>()
  const [enviando, setEnviando] = useState(false)
  const [errorConfirmar, setErrorConfirmar] = useState<ErrorVista | null>(null)

  // Estado mutable de la operación en curso (no pinta nada): generación para ignorar resultados
  // obsoletos, si hay lectura en marcha y la importación pendiente de confirmar.
  const ref = useRef({ gen: 0, leyendo: false, pendiente: null as string | null })
  const refTitulo = useRef<HTMLInputElement>(null)
  const refError = useRef<HTMLDivElement>(null)
  const profundidad = useRef(0)

  const lanzar = useCallback(
    async (ruta: string) => {
      const gen = ++ref.current.gen
      ref.current.leyendo = true
      rutaActual.current = ruta
      try {
        const datos = await window.shinobi.fuente.importarArchivo(ruta)
        if (gen !== ref.current.gen) {
          // Cancelada mientras terminaba: no debe quedar nada preparado.
          void window.shinobi.fuente.descartarImportacion(datos.importacionId).catch(() => {})
          return
        }
        ref.current.leyendo = false
        ref.current.pendiente = datos.importacionId
        // Con `iniciales` (sustituir la fuente de la misma canción) se conservan sus metadatos.
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
              : {
                  titulo: datos.metadatos.titulo,
                  artista: datos.metadatos.artista,
                  album: datos.metadatos.album
                })
        )
        setErrorTitulo(undefined)
        setEstado({ tipo: 'leido', datos })
      } catch (err) {
        if (gen !== ref.current.gen) return
        ref.current.leyendo = false
        setEstado({ tipo: 'error', error: comoErrorVista(err) })
      }
    },
    [iniciales]
  )

  const iniciar = (ruta: string) => {
    setErrorConfirmar(null)
    setEstado({ tipo: 'leyendo', nombre: nombreDeRuta(ruta) })
    void lanzar(ruta)
  }

  const cancelarLectura = useCallback(() => {
    ref.current.gen++
    ref.current.leyendo = false
    void window.shinobi.fuente.cancelarImportacion().catch(() => {})
    setEstado({ tipo: 'vacio' })
  }, [])

  /**
   * Lee las etiquetas de varios archivos o de una carpeta (L1). Con una sola fila añadible sigue el flujo de una
   * canción; si no, pasa a la tabla (L2). Una lectura sin filas o con un solo archivo ilegible es un error.
   */
  const leerLote = useCallback(
    async (
      leer: () => Promise<LecturaLoteIpc | null>,
      opciones: {
        n: number | null
        carpeta: boolean
        nombreCarpeta?: string | null
        paquete?: boolean
      }
    ) => {
      const gen = ++ref.current.gen
      ref.current.leyendo = true
      try {
        const lectura = await leer()
        if (gen !== ref.current.gen) return
        ref.current.leyendo = false
        if (lectura === null) {
          setEstado({ tipo: 'vacio' })
          return
        }
        const validas = lectura.filas.filter((f) => f.problema === null)
        if (lectura.filas.length === 0) {
          setEstado({
            tipo: 'error',
            error: {
              codigo: opciones.carpeta ? 'CARPETA_SIN_AUDIO' : 'FORMATO_NO_SOPORTADO',
              mensaje: ''
            }
          })
          return
        }
        if (lectura.filas.length === 1 && lectura.filas[0]!.problema !== null) {
          const corta = lectura.filas[0]!.problema === 'corta'
          setEstado({
            tipo: 'error',
            error: { codigo: corta ? 'AUDIO_DEMASIADO_CORTO' : 'FORMATO_NO_SOPORTADO', mensaje: '' }
          })
          return
        }
        // Una sola canción añadible: el flujo de siempre (lectura del audio y formulario D).
        const uno = validas.length === 1 ? validas[0] : undefined
        if (uno?.ruta) {
          setEstado({ tipo: 'leyendo', nombre: uno.nombre })
          void lanzar(uno.ruta)
          return
        }
        const tabla = tablaDeArchivos(lectura, {
          carpeta: opciones.carpeta,
          nombreCarpeta: opciones.nombreCarpeta ?? null,
          paqueteIgnorado: opciones.paquete
        })
        if (alLote) alLote(tabla)
      } catch (err) {
        if (gen !== ref.current.gen) return
        ref.current.leyendo = false
        setEstado({ tipo: 'error', error: comoErrorVista(err) })
      }
    },
    [alLote, lanzar]
  )

  /** Muestra L1 al empezar a leer un lote (con `n` si se conoce). */
  const iniciarLote = (n: number | null) => {
    setErrorConfirmar(null)
    setEstado({ tipo: 'leyendoLote', n })
  }

  const elegir = async () => {
    if (iniciales) {
      // Sustituir la fuente de una canción existente: un solo archivo, como siempre.
      try {
        const ruta = await window.shinobi.sistema.elegirArchivoAudio()
        if (ruta) iniciar(ruta)
      } catch (err) {
        setEstado({ tipo: 'error', error: comoErrorVista(err) })
      }
      return
    }
    iniciarLote(null)
    await leerLote(() => window.shinobi.fuente.leerArchivos(), { n: null, carpeta: false })
  }

  const elegirCarpeta = () => {
    iniciarLote(null)
    return leerLote(() => window.shinobi.fuente.leerCarpeta(), { n: null, carpeta: true })
  }

  // Lectura automática del archivo recibido de la Biblioteca y limpieza al salir de la vista
  // (‹ Biblioteca, otra vista, cerrar): nada queda preparado sin confirmar.
  useEffect(() => {
    const op = ref.current
    // `lanzar` solo cambia el estado tras esperar a main (no hay renders en cascada).
    if (rutasIniciales && rutasIniciales.length > 0) {
      // Como `lanzar`, `leerLote` solo cambia el estado tras esperar a main (L1 ya es el estado inicial).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void leerLote(() => window.shinobi.fuente.leerArchivos(rutasIniciales), {
        n: rutasIniciales.length,
        carpeta: false
      })
    } else if (rutaInicial) void lanzar(rutaInicial)
    return () => {
      op.gen++
      if (op.leyendo) {
        op.leyendo = false
        void window.shinobi.fuente.cancelarImportacion().catch(() => {})
      }
      if (op.pendiente) {
        const id = op.pendiente
        op.pendiente = null
        void window.shinobi.fuente.descartarImportacion(id).catch(() => {})
      }
    }
    // Solo al montar con el archivo recibido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Esc cancela la operación en curso o, si no hay, vuelve a la Biblioteca (también desde un campo).
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if (e.defaultPrevented || hayCapaAbierta()) return
      // Un campo de texto ajeno a esta vista conserva su Esc (docs/ux/00 §6).
      const campo = e.target instanceof Element ? e.target.closest('input, textarea, select') : null
      if (campo && !campo.closest('[data-panel-anadir]')) return
      // Con la lista de sugerencias abierta, Esc solo la cierra (la cierra el propio campo).
      if (campo?.getAttribute('aria-expanded') === 'true') return
      e.preventDefault()
      if (ref.current.leyendo) cancelarLectura()
      else ir({ tipo: 'biblioteca' })
    }
    window.addEventListener('keydown', alTeclear, true)
    return () => window.removeEventListener('keydown', alTeclear, true)
  }, [cancelarLectura, ir])

  // Foco: título seleccionado al leer; mensaje al fallar; "Cancelar" al empezar a leer.
  const tipo = estado.tipo
  useEffect(() => {
    if (tipo === 'leido') {
      refTitulo.current?.focus()
      refTitulo.current?.select()
    } else if (tipo === 'error') refError.current?.focus()
    else if (tipo === 'leyendo' || tipo === 'leyendoLote')
      document.getElementById('anadir-cancelar-lectura')?.focus()
  }, [tipo])

  const continuar = async () => {
    if (estado.tipo !== 'leido' || enviando) return
    if (valores.titulo.trim() === '') {
      setErrorTitulo(TEXTO.tituloVacio)
      refTitulo.current?.focus()
      return
    }
    setErrorTitulo(undefined)
    setErrorConfirmar(null)
    setEnviando(true)
    try {
      const resumen = await window.shinobi.fuente.confirmarArchivo(
        estado.datos.importacionId,
        metadatosParaIpc(valores),
        iniciales ? { cancionId: iniciales.cancionId } : undefined
      )
      ref.current.pendiente = null
      olvidarBorrador()
      ir({ tipo: 'cancion', id: resumen.id, paso: 'progreso' })
    } catch (err) {
      setErrorConfirmar(comoErrorVista(err))
      setEnviando(false)
    }
  }

  const cancelar = () => ir({ tipo: 'biblioteca' })

  const copiar = (e: ErrorVista) =>
    void copiarDetalles([detallesDeError(e), e.detalles].filter(Boolean).join('\n'))

  const alSoltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    profundidad.current = 0
    setSobre(false)
    const archivos = Array.from(e.dataTransfer.files)
    const primero = archivos[0]
    if (!primero) return
    if (iniciales) {
      iniciar(window.shinobi.rutaDeArchivo(primero))
      return
    }
    const hayCarpeta = Array.from(e.dataTransfer.items ?? []).some(esDirectorio)
    const todas = archivos.map((f) => window.shinobi.rutaDeArchivo(f))
    const rutas = todas.filter((r) => !EXTENSION_PAQUETE.test(r))
    const paquete = rutas.length < todas.length
    if (rutas.length === 0) return
    if (rutas.length === 1 && !hayCarpeta && !paquete) {
      iniciar(rutas[0]!)
      return
    }
    iniciarLote(rutas.length)
    void leerLote(() => window.shinobi.fuente.leerArchivos(rutas), {
      n: rutas.length,
      carpeta: hayCarpeta,
      nombreCarpeta: hayCarpeta && rutas.length === 1 ? nombreDeRuta(rutas[0]!) : null,
      paquete
    })
  }
  const traeArchivos = (e: DragEvent): boolean =>
    Array.from(e.dataTransfer.types ?? []).includes('Files')

  const zona = (
    <div
      className={`${estilos.zona} ${sobre ? estilos.zonaSobre : ''}`}
      data-testid="zona-arrastre"
      onDragEnter={(e) => {
        if (!traeArchivos(e)) return
        e.preventDefault()
        profundidad.current++
        setSobre(e.dataTransfer.items?.length ?? 1)
      }}
      onDragOver={(e) => {
        if (traeArchivos(e)) e.preventDefault()
      }}
      onDragLeave={() => {
        profundidad.current = Math.max(0, profundidad.current - 1)
        if (profundidad.current === 0) setSobre(false)
      }}
      onDrop={alSoltar}
    >
      <p style={{ margin: 0 }}>
        {sobre === false ? TEXTO.arrastre : sobre > 1 ? LOTE.soltarVarios(sobre) : TEXTO.soltar}
      </p>
      {sobre === false && (
        <>
          <span aria-hidden="true">{TEXTO.o}</span>
          <div className={estilos.acciones}>
            <Boton variante="primario" data-foco-inicial onClick={() => void elegir()}>
              {TEXTO.elegir}
            </Boton>
            {!iniciales && (
              <Boton onClick={() => void elegirCarpeta()}>{TEXTO.elegirCarpeta}</Boton>
            )}
          </div>
          <p className={estilos.formatos}>{TEXTO.formatos}</p>
        </>
      )}
    </div>
  )

  if (estado.tipo === 'leyendo') {
    return (
      <div className={estilos.leyendo}>
        <span className={estilos.nombre}>{estado.nombre}</span>
        <BarraProgreso etiqueta={TEXTO.leyendo} indeterminada />
        <div className={estilos.acciones} style={{ justifyContent: 'space-between' }}>
          <span role="status">{TEXTO.leyendo}</span>
          <Boton id="anadir-cancelar-lectura" onClick={cancelarLectura}>
            {TEXTO.cancelar}
          </Boton>
        </div>
      </div>
    )
  }

  if (estado.tipo === 'leyendoLote') {
    const texto = estado.n === null ? LOTE.leyendo : LOTE.leyendoN(estado.n)
    return (
      <div className={estilos.leyendo}>
        <BarraProgreso etiqueta={texto} indeterminada />
        <div className={estilos.acciones} style={{ justifyContent: 'space-between' }}>
          <span role="status">{texto}</span>
          <Boton id="anadir-cancelar-lectura" onClick={cancelarLectura}>
            {TEXTO.cancelar}
          </Boton>
        </div>
      </div>
    )
  }

  if (estado.tipo === 'leido') {
    const { datos } = estado
    const duracion = formatearDuracion(datos.duracionMs) ?? ''
    const err = errorConfirmar
    return (
      <form
        className={estilos.formulario}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void continuar()
        }}
      >
        <p className={estilos.leido}>
          <Icono icono={Check} tamano={18} />
          <span>{textoLeido(datos.nombre, duracion)}</span>
        </p>
        <div>
          <h2 className="t-subtitulo">{TEXTO.datosTitulo}</h2>
          <p className={estilos.ayuda}>{TEXTO.datosAyuda}</p>
        </div>
        <CamposDatos
          key={datos.importacionId}
          propuesta={iniciales || recuperado ? null : datos.datos}
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
              if (rutaActual.current) {
                guardarBorrador({ origen: 'archivo', ruta: rutaActual.current, valores })
              }
              ir({ tipo: 'ajustes', origen: { tipo: 'anadir' }, seccion: 'preparacion' })
            }}
          />
        )}
        {datos.larga && <AvisoLarga duracion={duracion} duracionMs={datos.duracionMs} />}
        {err && (
          <AvisoEnLinea
            tipo="error"
            accion={
              esErrorGenerico(err.codigo) ? (
                <Boton variante="fantasma" onClick={() => copiar(err)}>
                  {TEXTO.copiarDetalles}
                </Boton>
              ) : undefined
            }
          >
            <strong>{textoDeError(err.codigo).titulo}</strong> {textoDeError(err.codigo).cuerpo}
          </AvisoEnLinea>
        )}
        <div className={estilos.acciones}>
          <Boton variante="fantasma" onClick={cancelar}>
            {TEXTO.cancelar}
          </Boton>
          <Boton variante="primario" type="submit" cargando={enviando}>
            {TEXTO.continuar}
          </Boton>
        </div>
      </form>
    )
  }

  const e = estado.tipo === 'error' ? estado.error : null
  return (
    <div className={estilos.grupoError}>
      {e && (
        <div ref={refError} tabIndex={-1} className={estilos.grupoError}>
          <AvisoEnLinea
            tipo="error"
            accion={
              esErrorGenerico(e.codigo) && e.codigo !== 'CARPETA_SIN_AUDIO' ? (
                <Boton variante="fantasma" onClick={() => copiar(e)}>
                  {TEXTO.copiarDetalles}
                </Boton>
              ) : undefined
            }
          >
            {e.codigo === 'CARPETA_SIN_AUDIO' ? (
              <>
                <strong>{LOTE.carpetaVaciaTitulo}</strong> {LOTE.carpetaVaciaCuerpo}
              </>
            ) : (
              <>
                <strong>{textoDeError(e.codigo).titulo}</strong> {textoDeError(e.codigo).cuerpo}
              </>
            )}
          </AvisoEnLinea>
        </div>
      )}
      {zona}
      {(estado.tipo === 'vacio' || estado.tipo === 'error') && (
        <p className={estilos.formatos} data-enlace-paquete>
          {PAQ.anadir.pregunta}{' '}
          <Boton variante="fantasma" onClick={() => abrirImportarPaquete()}>
            {PAQ.anadir.enlace}
          </Boton>
        </p>
      )}
    </div>
  )
}
