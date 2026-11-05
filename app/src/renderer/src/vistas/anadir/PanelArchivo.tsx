import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { Check } from 'lucide-react'
import type { ImportacionLeidaIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { BarraProgreso } from '../../componentes/BarraProgreso'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion, type DatosInicialesAnadir } from '../../navegacion/estado'
import { detallesDeError } from '../biblioteca/errores'
import { formatearDuracion } from '../biblioteca/tarjeta'
import { esErrorGenerico, textoDeError } from '../progreso/textos'
import { CamposDatos, metadatosParaIpc, type ValoresDatos } from './CamposDatos'
import { TEXTO, textoLarga, textoLeido } from './textos'
import estilos from './anadir.module.css'

interface ErrorVista {
  codigo: string
  mensaje: string
  detalles?: string
}

type Estado =
  | { tipo: 'vacio' }
  | { tipo: 'leyendo'; nombre: string }
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
}

/** Origen "Archivo de tu equipo": zona de arrastre, lectura y formulario "Revisar datos". */
export function PanelArchivo({ archivoInicial, iniciales }: PanelArchivoProps) {
  const { ir } = useNavegacion()
  const [estado, setEstado] = useState<Estado>(
    archivoInicial ? { tipo: 'leyendo', nombre: nombreDeRuta(archivoInicial) } : { tipo: 'vacio' }
  )
  const [sobre, setSobre] = useState(false)
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
        setValores(
          iniciales
            ? {
                titulo: iniciales.titulo,
                artista: iniciales.artista,
                album: iniciales.album ?? ''
              }
            : {
                titulo: datos.metadatos.titulo,
                artista: datos.metadatos.artista,
                album: datos.metadatos.album
              }
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

  const elegir = async () => {
    try {
      const ruta = await window.shinobi.sistema.elegirArchivoAudio()
      if (ruta) iniciar(ruta)
    } catch (err) {
      setEstado({ tipo: 'error', error: comoErrorVista(err) })
    }
  }

  // Lectura automática del archivo recibido de la Biblioteca y limpieza al salir de la vista
  // (‹ Biblioteca, otra vista, cerrar): nada queda preparado sin confirmar.
  useEffect(() => {
    const op = ref.current
    // `lanzar` solo cambia el estado tras esperar a main (no hay renders en cascada).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (archivoInicial) void lanzar(archivoInicial)
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
    else if (tipo === 'leyendo') document.getElementById('anadir-cancelar-lectura')?.focus()
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
      ir({ tipo: 'cancion', id: resumen.id, paso: 'progreso' })
    } catch (err) {
      setErrorConfirmar(comoErrorVista(err))
      setEnviando(false)
    }
  }

  const cancelar = () => ir({ tipo: 'biblioteca' })

  const copiar = (e: ErrorVista) =>
    void navigator.clipboard?.writeText([detallesDeError(e), e.detalles].filter(Boolean).join('\n'))

  const alSoltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    profundidad.current = 0
    setSobre(false)
    const archivos = Array.from(e.dataTransfer.files)
    const primero = archivos[0]
    if (!primero) return
    if (archivos.length > 1) mostrarToast({ tipo: 'aviso', mensaje: TEXTO.varios })
    iniciar(window.shinobi.rutaDeArchivo(primero))
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
        setSobre(true)
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
      <p style={{ margin: 0 }}>{sobre ? TEXTO.soltar : TEXTO.arrastre}</p>
      {!sobre && (
        <>
          <span aria-hidden="true">{TEXTO.o}</span>
          <Boton variante="primario" data-foco-inicial onClick={() => void elegir()}>
            {TEXTO.elegir}
          </Boton>
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
          valores={valores}
          onCambio={(v) => {
            setValores(v)
            if (errorTitulo && v.titulo.trim() !== '') setErrorTitulo(undefined)
          }}
          errorTitulo={errorTitulo}
          refTitulo={refTitulo}
          onIntroUltimo={() => void continuar()}
        />
        {datos.larga && <AvisoEnLinea tipo="aviso">{textoLarga(duracion)}</AvisoEnLinea>}
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
              esErrorGenerico(e.codigo) ? (
                <Boton variante="fantasma" onClick={() => copiar(e)}>
                  {TEXTO.copiarDetalles}
                </Boton>
              ) : undefined
            }
          >
            <strong>{textoDeError(e.codigo).titulo}</strong> {textoDeError(e.codigo).cuerpo}
          </AvisoEnLinea>
        </div>
      )}
      {zona}
    </div>
  )
}
