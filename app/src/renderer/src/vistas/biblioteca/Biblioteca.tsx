import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ListMusic, Mic, MonitorUp, Search, SquareCheck } from 'lucide-react'
import { vistaAlContinuar } from '@shared/derivados'
import type { ResumenCancionIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { ControlSegmentado } from '../../componentes/ControlSegmentado'
import { Icono } from '../../componentes/Icono'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useExportaciones } from '../../exportacion/contexto'
import { EXP_ELIMINAR_EXTRA } from '../../exportacion/dialogo/textosProgreso'
import { useReproductor } from '../../navegacion/reproductor'
import { useNavegacion, type Vista } from '../../navegacion/estado'
import { progresoVisto } from '../../navegacion/progresoVisto'
import { useSesion } from '../../sesion/ProveedorSesion'
import { ATRIBUTO_BOTON_COLA } from '../../sesion/foco'
import { BIB_COLA, COLA, SES } from '../../sesion/textos'
import { useTrabajosVivos } from '../../trabajos/useTrabajos'
import { useTandaPreparacion } from '../../trabajos/useTandaPreparacion'
import { useCatalogoTemas } from '../../temas/useCatalogoTemas'
import { datosLrclibDe } from '../anadir/CamposDatos'
import { DialogoConfirmar, DialogoEditarDatos, type InicialEditar } from './DialogosCancion'
import { BandejaPendientes } from './BandejaPendientes'
import { BarraSeleccion } from './BarraSeleccion'
import { VeloArrastre } from './VeloArrastre'
import { DialogoDatos } from './acciones/DialogoDatos'
import { DialogoEliminar } from './acciones/DialogoEliminar'
import { DialogoPreparar, type SalidaAccion } from './acciones/DialogoPreparar'
import {
  contarAplica,
  motivoNoAplica,
  ordenarSeleccion,
  type AccionLote,
  type ContextoAplica
} from './acciones/modelo'
import { ACC, MOTIVO } from './acciones/textos'
import { useAgregarVarias } from './acciones/useAgregarVarias'
import { useAvisoReanudacion } from './avisoReanudacion'
import { DialogoResultadoPreparacion } from './DialogoResultadoPreparacion'
import { CasillaGrupo } from './CasillaGrupo'
import { DialogoAplicarTema, type SalidaLote } from './DialogoAplicarTema'
import { EncabezadoGrupo } from './EncabezadoGrupo'
import { PanelColaHost } from './cola/PanelColaHost'
import { ID_PANEL_COLA } from './cola/PanelCola'
import { DialogoPantallasPedido } from './sesion/DialogoPantallas'
import { TemaGrupo } from './TemaGrupo'
import { TarjetaCancion, type AccionesTarjeta } from './TarjetaCancion'
import { agruparCanciones, idGrupoDe, textoAnuncioResultados } from './agrupacion'
import { detallesDeError } from './errores'
import {
  casillaDe,
  contarBandeja,
  contarPorFiltro,
  filtrarCanciones,
  type FiltroBiblioteca
} from './filtrado'
import { pasoConProblema, tituloDeTarjeta, type TrabajoVivo } from './tarjeta'
import { BIB_PREP, mensajeDeOmitida, type CasillaBandeja } from './textosPreparacion'
import { procedenciaCorta } from '../../temas/textos'
import { lineaDeTema } from './textosTema'
import { tituloDeError } from './textosError'
import { SEL, TEMAS_NO_DISPONIBLES } from './textosSeleccion'
import { useAgregarACola } from './useAgregarACola'
import { useMarcarRevision } from './useMarcarRevision'
import { useAjustarFines } from './useAjustarFines'
import { useProbar } from './useProbar'
import { esSeleccionable, reiniciarSeleccionDeSesion, useSeleccion } from './useSeleccion'
import { DialogoCancelarDescarga, DialogoCancelarSeparacion } from '../progreso/DialogosCancelar'
import {
  reiniciarAgruparDeSesion,
  useAgrupar,
  useBiblioteca,
  useBibliotecaCompartida,
  type BibliotecaDatos
} from './useBiblioteca'
import { abrirExportarPaquete, abrirImportarPaquete } from './paquete/almacen'
import { exportarLetras } from './paquete/letras'
import { PAQ } from './paquete/textos'
import estilos from './biblioteca.module.css'
import { copiarDetalles } from '../../soporte/detalles'

function Esqueletos() {
  return (
    <div className={estilos.rejilla} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={estilos.esqueleto} data-esqueleto>
          <div className={`${estilos.esqueletoPortada} ${estilos.brillo}`} />
          <div className={`${estilos.esqueletoLinea} ${estilos.brillo}`} />
          <div
            className={`${estilos.esqueletoLinea} ${estilos.esqueletoCorta} ${estilos.brillo}`}
          />
        </div>
      ))}
    </div>
  )
}

function EstadoVacio() {
  const { ir } = useNavegacion()
  return (
    <div className={estilos.vacio}>
      <Icono icono={Mic} tamano={64} className={estilos.vacioIcono} />
      <h1 id="titulo-vista" className="t-display" tabIndex={-1} data-foco-inicial>
        Tu biblioteca está vacía
      </h1>
      <p>
        Añade tu primera canción desde un archivo de tu ordenador o un enlace de YouTube, o varias a
        la vez desde una carpeta o una lista. Shinobi Karaoke separará la voz para que puedas cantar
        encima.
      </p>
      <Boton
        variante="primario"
        tamano="grande"
        data-anadir-cancion
        onClick={() => ir({ tipo: 'anadir' })}
      >
        Añadir canción
      </Boton>
      <Boton variante="fantasma" onClick={() => abrirImportarPaquete()}>
        {PAQ.vacioEnlace}
      </Boton>
      <p className={`t-pequeno ${estilos.formatos}`}>
        Formatos: MP3, M4A, FLAC, WAV, OGG, y también vídeos MP4, MKV, MOV o WebM.
      </p>
    </div>
  )
}

// El filtro persiste durante la sesión (aunque se salga de la vista); la búsqueda no.
let filtroDeSesion: FiltroBiblioteca = 'todas'
// La casilla de la bandeja de pendientes también dura la sesión (spec 02 · Feature 5).
let casillaDeSesion: CasillaBandeja | null = null
// Los grupos plegados también viven solo en la sesión (no se guardan; al reiniciar, todo desplegado).
let plegadosDeSesion: ReadonlySet<string> = new Set()
/** Espera tras la última pulsación antes de anunciar el recuento (`bib.anuncio.resultados`). */
export const RETRASO_ANUNCIO_MS = 500
/** Solo para pruebas. */
export function reiniciarFiltroDeSesion(): void {
  filtroDeSesion = 'todas'
  casillaDeSesion = null
  plegadosDeSesion = new Set()
  reiniciarAgruparDeSesion()
  reiniciarSeleccionDeSesion()
}

type DialogoActivo =
  | { tipo: 'datos'; id: string; inicial: InicialEditar }
  | { tipo: 'borrador'; id: string }
  | { tipo: 'eliminar'; id: string }
  | { tipo: 'cancelar'; id: string; paso: 'fuente' | 'separacion'; trabajoId: string }

/** Trabajo activo de cada canción (el que está en curso tiene prioridad sobre el de la cola). */
function trabajoVivoDe(
  id: string,
  { trabajos, progreso }: ReturnType<typeof useTrabajosVivos>
): TrabajoVivo | null {
  const suyos = trabajos.filter((t) => t.cancionId === id && t.estado !== 'terminado')
  const t = suyos.find((x) => x.estado === 'en_curso') ?? suyos[0]
  return t ? { trabajo: t, progreso: progreso[t.id] ?? null } : null
}

/** `bib.sinresultados*` / `bib.sinlistas` / `bib.sinborradores`. */
export function textoSinResultados(filtro: FiltroBiblioteca, texto: string): string {
  if (texto !== '') {
    if (filtro === 'listas') return `No hay canciones listas que coincidan con «${texto}».`
    if (filtro === 'borradores') return `No hay borradores que coincidan con «${texto}».`
    return `No hay canciones que coincidan con «${texto}».`
  }
  return filtro === 'listas'
    ? 'Aún no tienes canciones listas. Termina un borrador y márcalo como lista para poder cantarlo aquí.'
    : 'No tienes borradores. Las canciones que añadas aparecerán aquí hasta que las marques como listas.'
}

/** Vista Biblioteca (docs/ux/02): usa la biblioteca compartida de `App` o, sin ella, la suya. */
export function Biblioteca() {
  const compartida = useBibliotecaCompartida()
  return compartida ? <VistaBiblioteca datos={compartida} /> : <BibliotecaPropia />
}

function BibliotecaPropia() {
  return <VistaBiblioteca datos={useBiblioteca()} />
}

type EnfoqueBiblioteca = NonNullable<Extract<Vista, { tipo: 'biblioteca' }>['enfocar']>
const RESALTE_MS = 2000

function VistaBiblioteca({ datos }: { datos: BibliotecaDatos }) {
  const { ir, vista } = useNavegacion()
  const { abrir } = useReproductor()
  const enfocar = vista.tipo === 'biblioteca' ? vista.enfocar : undefined
  const pedido = vista.tipo === 'biblioteca' ? vista : undefined
  const { estado, lenta, canciones, reintentar } = datos
  const vivos = useTrabajosVivos()
  const exportacion = useExportaciones()
  const sesion = useSesion()
  const { edicionBloqueada, abrirBloqueo } = sesion
  const agregarACola = useAgregarACola()
  const [activa, setActiva] = useState<string | null>(null)
  const [filtro, setFiltroEstado] = useState<FiltroBiblioteca>(filtroDeSesion)
  const [casilla, setCasillaEstado] = useState<CasillaBandeja | null>(casillaDeSesion)
  const [resultadoAbierto, setResultadoAbierto] = useState(false)
  const tanda = useTandaPreparacion()
  // Lote recién añadido (spec 02 · feature 7): `bib.import.anadidas` sale como toast de 10 s, no en línea
  // (revisión de capturas 2026-11-23, L2: al desplazarse a las tarjetas nuevas el aviso quedaba fuera de la vista).
  const lote = vista.tipo === 'biblioteca' ? vista.lote : undefined
  const loteAnunciado = useRef<typeof lote>(undefined)
  useEffect(() => {
    if (!lote || loteAnunciado.current === lote) return
    loteAnunciado.current = lote
    mostrarToast({
      tipo: 'info',
      mensaje: lote.conLetra
        ? `Se añadieron ${lote.n} canciones y se están preparando solas.`
        : `Se añadieron ${lote.n} canciones. Se están separando; la letra tendrás que buscarla tú.`,
      duracionMs: 10_000,
      accion: {
        etiqueta: 'Ver actividad',
        alAccionar: () => window.dispatchEvent(new CustomEvent('shinobi:abrir-actividad'))
      }
    })
  }, [lote])
  const reanudacion = useAvisoReanudacion()
  const [busqueda, setBusqueda] = useState('')
  const [dialogo, setDialogo] = useState<DialogoActivo | null>(null)
  const campoBusqueda = useRef<HTMLInputElement>(null)
  const rejilla = useRef<HTMLDivElement>(null)
  const enfoqueRealizado = useRef<EnfoqueBiblioteca | undefined>(undefined)
  const [resaltada, setResaltada] = useState<EnfoqueBiblioteca | null>(null)
  // Las importadas de un paquete se resaltan juntas 2 s con borde `info` (spec 02 · Feature 9).
  const [resaltadasInfo, setResaltadasInfo] = useState<ReadonlySet<string>>(new Set())
  const [agrupar, cambiarAgrupar] = useAgrupar()
  const [plegados, setPlegados] = useState<ReadonlySet<string>>(plegadosDeSesion)
  // Canción que sigue visible tras «Editar datos» aunque ya no coincida, hasta el siguiente cambio.
  const [anclada, setAnclada] = useState<string | null>(null)
  const [movida, setMovida] = useState<{ id: string; grupoId: string; titulo: string } | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const [cambioDeVista, setCambioDeVista] = useState(0)
  const seccion = useRef<HTMLElement>(null)
  const idBase = useId()
  const sel = useSeleccion()
  const catalogo = useCatalogoTemas()
  const [aplicarTema, setAplicarTema] = useState<{ ids: string[]; desdeTarjeta: boolean } | null>(
    null
  )
  const [accionLote, setAccionLote] = useState<{
    tipo: 'preparar' | 'datos' | 'eliminar'
    ids: string[]
  } | null>(null)
  const agregarVarias = useAgregarVarias()
  const botonSeleccionar = useRef<HTMLButtonElement>(null)
  const botonAplicar = useRef<HTMLButtonElement>(null)
  // Foco que hay que dejar tras el siguiente render (entrar, salir o cerrar el diálogo de lote).
  const focoPendiente = useRef<{
    en: 'seleccionar' | 'aplicar' | 'mas' | 'tarjeta'
    id?: string
  } | null>(null)

  const visibles = useMemo(
    () => filtrarCanciones(canciones, filtro, busqueda, anclada, casilla),
    [canciones, filtro, busqueda, anclada, casilla]
  )
  // Los grupos por fecha se calculan al mostrar la vista (no bajo el cursor ni al pasar la medianoche).
  const [ahora] = useState(() => new Date())
  const grupos = useMemo(
    () => agruparCanciones(visibles, canciones, agrupar, ahora),
    [visibles, canciones, agrupar, ahora]
  )
  // Tarjetas que existen en pantalla en orden visual (las de grupos plegados no participan).
  const ordenVisual = useMemo(
    () =>
      agrupar === 'ninguno'
        ? visibles
        : grupos.filter((g) => !plegados.has(g.id)).flatMap((g) => g.canciones),
    [agrupar, visibles, grupos, plegados]
  )
  const activaValida = ordenVisual.some((c) => c.id === activa) ? activa : null
  const idActiva = activaValida ?? ordenVisual[0]?.id
  const refs = useRef({ total: 0, activaValida: null as string | null, orden: [] as string[] })
  useEffect(() => {
    refs.current = { total: visibles.length, activaValida, orden: ordenVisual.map((c) => c.id) }
  })

  const cancionParaEnfocar = canciones.find((c) => c.id === enfocar?.id)

  // Selección: las eliminadas salen sin aviso; las que pasan a Dañada siguen contadas.
  const seleccionadas = useMemo(
    () => canciones.filter((c) => sel.ids.has(c.id)),
    [canciones, sel.ids]
  )
  const idsVisibles = useMemo(() => new Set(visibles.map((c) => c.id)), [visibles])
  const fuera = seleccionadas.filter((c) => !idsVisibles.has(c.id)).length
  const temasUsables =
    catalogo.catalogo !== null && !catalogo.soloLectura && catalogo.ofrecibles.length > 0
  const motivoTemas = !catalogo.catalogo
    ? undefined
    : catalogo.soloLectura
      ? TEMAS_NO_DISPONIBLES.soloLectura
      : catalogo.ofrecibles.length === 0
        ? TEMAS_NO_DISPONIBLES.vacio
        : undefined
  const motivoAplicar = motivoTemas ?? (seleccionadas.length === 0 ? SEL.ninguna : undefined)

  useEffect(() => {
    if (
      !enfocar ||
      enfoqueRealizado.current === enfocar ||
      estado !== 'listo' ||
      !cancionParaEnfocar
    )
      return
    // El éxito del IPC puede llegar antes de que React aplique el resumen de Lista.
    if (enfocar.resaltar && cancionParaEnfocar.estado !== 'lista') return
    const fotograma = requestAnimationFrame(() => {
      if (filtro === 'borradores' && cancionParaEnfocar.estado === 'lista') {
        filtroDeSesion = 'todas'
        setFiltroEstado('todas')
        return
      }
      // Tras importar un paquete: «Todas» si el filtro actual oculta alguna de las importadas.
      if (enfocar.tambien && (filtro !== 'todas' || casilla)) {
        const vistas = new Set(
          filtrarCanciones(canciones, filtro, '', null, casilla).map((c) => c.id)
        )
        if (enfocar.tambien.some((id) => canciones.some((c) => c.id === id) && !vistas.has(id))) {
          filtroDeSesion = 'todas'
          casillaDeSesion = null
          setFiltroEstado('todas')
          setCasillaEstado(null)
          return
        }
      }
      const tarjetas = rejilla.current?.querySelectorAll<HTMLElement>('[data-tarjeta]')
      const tarjeta = Array.from(tarjetas ?? []).find((nodo) => nodo.dataset.tarjeta === enfocar.id)
      if (!tarjeta) return
      enfoqueRealizado.current = enfocar
      tarjeta.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
      tarjeta.focus({ preventScroll: true })
      setResaltada(enfocar.resaltar ? enfocar : null)
      if (enfocar.tambien) setResaltadasInfo(new Set(enfocar.tambien))
    })
    return () => cancelAnimationFrame(fotograma)
  }, [enfocar, estado, filtro, casilla, canciones, cancionParaEnfocar])

  useEffect(() => {
    if (resaltadasInfo.size === 0) return
    const plazo = setTimeout(() => setResaltadasInfo(new Set()), RESALTE_MS)
    return () => clearTimeout(plazo)
  }, [resaltadasInfo])

  useEffect(() => {
    if (!resaltada) return
    const plazo = setTimeout(() => setResaltada(null), RESALTE_MS)
    return () => clearTimeout(plazo)
  }, [resaltada])

  const volverArriba = () => seccion.current?.closest('main')?.scrollTo?.({ top: 0 })

  const fijarCasilla = useCallback((c: CasillaBandeja | null) => {
    casillaDeSesion = c
    setCasillaEstado(c)
  }, [])

  // Cualquier opción del filtro de estado quita la casilla de la bandeja.
  const setFiltro = (f: FiltroBiblioteca) => {
    filtroDeSesion = f
    setFiltroEstado(f)
    fijarCasilla(null)
    setAnclada(null)
    setCambioDeVista((n) => n + 1)
  }

  /** Pulsar una casilla filtra a «Borradores» con ella; pulsarla de nuevo la quita. */
  const alternarCasilla = (c: CasillaBandeja) => {
    const siguiente = casilla === c ? null : c
    fijarCasilla(siguiente)
    if (siguiente) {
      filtroDeSesion = 'borradores'
      setFiltroEstado('borradores')
    }
    setAnclada(null)
    setCambioDeVista((n) => n + 1)
  }

  // Llegadas pedidas desde fuera: el «Resultado de la preparación» y la casilla de Ajustes.
  const pedidoAtendido = useRef<unknown>(null)
  useEffect(() => {
    if (!pedido || pedidoAtendido.current === pedido) return
    pedidoAtendido.current = pedido
    if (pedido.abrirResultado) setResultadoAbierto(true)
    if (pedido.casilla) {
      casillaDeSesion = pedido.casilla
      setCasillaEstado(pedido.casilla)
      filtroDeSesion = 'borradores'
      setFiltroEstado('borradores')
    }
  }, [pedido])

  // Una casilla que se queda en 0 se desactiva sola y la rejilla vuelve a «Borradores».
  useEffect(() => {
    if (casilla && estado === 'listo' && !canciones.some((c) => casillaDe(c) === casilla)) {
      casillaDeSesion = null
      setCasillaEstado(null)
    }
  }, [casilla, canciones, estado])

  const setAgrupacion = (a: typeof agrupar) => {
    cambiarAgrupar(a)
    setAnclada(null)
    setCambioDeVista((n) => n + 1)
  }

  const cambiarBusqueda = (texto: string) => {
    setBusqueda(texto)
    setAnclada(null)
    volverArriba()
  }

  const alternarPlegado = (id: string) => {
    const siguiente = new Set(plegados)
    if (!siguiente.delete(id)) siguiente.add(id)
    plegadosDeSesion = siguiente
    setPlegados(siguiente)
  }

  // Cambiar filtro o agrupación: la tarjeta activa visible se centra; si no, la vista vuelve arriba.
  useEffect(() => {
    if (cambioDeVista === 0) return
    const id = refs.current.activaValida
    const tarjeta = id
      ? rejilla.current?.querySelector<HTMLElement>(`[data-tarjeta="${CSS.escape(id)}"]`)
      : null
    if (tarjeta) tarjeta.scrollIntoView?.({ block: 'center' })
    else volverArriba()
  }, [cambioDeVista])

  // Anuncio del recuento una vez, 500 ms después del último cambio de búsqueda, filtro o agrupación.
  const primerAnuncio = useRef(true)
  useEffect(() => {
    if (primerAnuncio.current) {
      primerAnuncio.current = false
      return
    }
    const plazo = setTimeout(
      () => setAnuncio(textoAnuncioResultados(refs.current.total)),
      RETRASO_ANUNCIO_MS
    )
    return () => clearTimeout(plazo)
  }, [busqueda, filtro, agrupar])

  // «Editar datos» movió la canción de grupo: se despliega el grupo, se enfoca y se anuncia.
  useEffect(() => {
    if (!movida) return
    const actual = canciones.find((c) => c.id === movida.id)
    // Aún no ha llegado `cancion:cambiada` con los datos nuevos.
    if (!actual || idGrupoDe(actual, agrupar, ahora) !== movida.grupoId) return
    const grupo = grupos.find((g) => g.id === movida.grupoId)
    const tarjeta = rejilla.current?.querySelector<HTMLElement>(
      `[data-tarjeta="${CSS.escape(movida.id)}"]`
    )
    if (!grupo || !tarjeta) return
    tarjeta.scrollIntoView?.({ block: 'nearest' })
    tarjeta.focus({ preventScroll: true })
    setAnuncio(`«${movida.titulo}» está ahora en ${grupo.nombre}.`)
    setMovida(null)
  }, [movida, canciones, grupos, agrupar, ahora])

  // Si desaparece la tarjeta enfocada (eliminada aquí o en otra parte), el foco pasa a la siguiente
  // del orden visual, si no a la anterior, si no al título. Nunca queda en `body`.
  const ordenPrevio = useRef<string[]>([])
  const ordenClave = ordenVisual.map((c) => c.id).join('|')
  useEffect(() => {
    const antes = ordenPrevio.current
    const orden = ordenClave === '' ? [] : ordenClave.split('|')
    ordenPrevio.current = orden
    if (!activa || orden.includes(activa) || !antes.includes(activa)) return
    const i = antes.indexOf(activa)
    const plazo = setTimeout(() => {
      if (document.activeElement && document.activeElement !== document.body) return
      const vecina = orden.find((id) => antes.indexOf(id) > i) ?? orden[orden.length - 1]
      const destino =
        (vecina
          ? rejilla.current?.querySelector<HTMLElement>(`[data-tarjeta="${CSS.escape(vecina)}"]`)
          : null) ?? document.querySelector<HTMLElement>('[data-foco-inicial]')
      destino?.focus()
    }, 0)
    return () => clearTimeout(plazo)
  }, [ordenClave, activa])

  // Foco tras entrar o salir del modo selección o cerrar «Aplicar tema».
  useEffect(() => {
    const f = focoPendiente.current
    if (!f) return
    if (f.en === 'seleccionar') {
      if (sel.activo) return
      // Con la biblioteca vacía (se eliminó todo), al «Añadir canción» del estado vacío.
      ;(
        botonSeleccionar.current ?? document.querySelector<HTMLElement>('[data-anadir-cancion]')
      )?.focus()
    } else if (f.en === 'aplicar' || f.en === 'mas') {
      if (!sel.activo) return
      if (f.en === 'mas') document.querySelector<HTMLElement>('[data-menu-texto]')?.focus()
      else botonAplicar.current?.focus()
    } else {
      const id = f.id ?? refs.current.orden[0]
      const nodo = id
        ? rejilla.current?.querySelector<HTMLElement>(`[data-tarjeta="${CSS.escape(id)}"]`)
        : null
      nodo?.focus()
    }
    focoPendiente.current = null
  })

  const terminarSeleccion = sel.salir
  // Esc termina el modo si no hay diálogo ni menú abierto y la búsqueda no tiene texto.
  useEffect(() => {
    if (!sel.activo) return
    const alTeclear = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return
      const campo = campoBusqueda.current
      if (campo && document.activeElement === campo && campo.value !== '') return
      e.preventDefault()
      focoPendiente.current = { en: 'seleccionar' }
      terminarSeleccion()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [sel.activo, terminarSeleccion])

  // Ctrl/Cmd+F enfoca la búsqueda.
  useEffect(() => {
    const alTeclear = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        campoBusqueda.current?.focus()
        campoBusqueda.current?.select()
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [])

  const resumenDe = (id: string) => canciones.find((c) => c.id === id)

  const abrirEditarDatos = useCallback(async (id: string) => {
    try {
      const cancion = await window.shinobi.biblioteca.obtener(id)
      if (!cancion) throw new Error('sin canción')
      const m = cancion.metadatos
      setDialogo({
        tipo: 'datos',
        id,
        inicial: {
          titulo: m.titulo,
          artista: m.artista,
          album: m.album,
          lrclib: datosLrclibDe(cancion)
        }
      })
    } catch {
      mostrarToast({ tipo: 'error', mensaje: 'No se pudo abrir la canción.' })
    }
  }, [])

  /** Tras eliminar, el foco pasa a la tarjeta siguiente del orden visual, si no a la anterior, si no al título. */
  const recuperarFoco = (eliminada: string) => {
    const orden = refs.current.orden
    const i = orden.indexOf(eliminada)
    const vecina = orden[i + 1] ?? orden[i - 1]
    setTimeout(() => {
      if (document.activeElement && document.activeElement !== document.body) return
      const destino =
        (vecina
          ? rejilla.current?.querySelector<HTMLElement>(`[data-tarjeta="${CSS.escape(vecina)}"]`)
          : null) ?? document.querySelector<HTMLElement>('[data-foco-inicial]')
      destino?.focus()
    }, 0)
  }

  const confirmarEliminar = async (id: string) => {
    const resumen = resumenDe(id)
    const titulo = resumen ? tituloDeTarjeta(resumen) : ''
    try {
      await window.shinobi.biblioteca.eliminar(id)
      setDialogo(null)
      mostrarToast({ tipo: 'exito', mensaje: `«${titulo}» se movió a la papelera.` })
      recuperarFoco(id)
    } catch (err) {
      setDialogo(null)
      mostrarToast({
        tipo: 'error',
        mensaje: `No se pudo mover «${titulo}» a la papelera.`,
        accion: {
          etiqueta: 'Copiar detalles',
          alAccionar: () => void copiarDetalles(detallesDeError(err))
        }
      })
    }
  }

  const confirmarBorrador = async (id: string) => {
    try {
      await window.shinobi.biblioteca.volverABorrador(id)
      setDialogo(null)
    } catch (err) {
      setDialogo(null)
      mostrarToast({
        tipo: 'error',
        mensaje: 'No se pudo volver a borrador.',
        accion: {
          etiqueta: 'Copiar detalles',
          alAccionar: () => void copiarDetalles(detallesDeError(err))
        }
      })
    }
  }

  const vivosRef = useRef(vivos)
  useEffect(() => {
    vivosRef.current = vivos
  })

  /** Toast de error con el texto del código (`bib.toast.errorgenerico`) y "Copiar detalles". */
  const avisarError = useCallback((err: unknown) => {
    const codigo =
      err && typeof err === 'object' && 'codigo' in err && typeof err.codigo === 'string'
        ? err.codigo
        : ''
    mostrarToast({
      tipo: 'error',
      mensaje: tituloDeError(codigo),
      accion: {
        etiqueta: 'Copiar detalles',
        alAccionar: () => void copiarDetalles(detallesDeError(err))
      }
    })
  }, [])

  /** "Reintentar": relanza el paso que falló sin salir de la Biblioteca. */
  const reintentarPaso = useCallback(
    async (id: string) => {
      const resumen = canciones.find((c) => c.id === id)
      const paso = resumen ? pasoConProblema(resumen) : null
      try {
        if (paso === 'fuente') await window.shinobi.fuente.reintentar(id)
        else if (paso === 'separacion') await window.shinobi.separacion.separar(id)
      } catch (err) {
        avisarError(err)
      }
    },
    [avisarError, canciones]
  )

  const resepararPistas = useCallback(
    async (id: string) => {
      try {
        await window.shinobi.separacion.separar(id)
      } catch (err) {
        avisarError(err)
      }
    },
    [avisarError]
  )

  const cancelarEnCurso = async (trabajoId: string) => {
    setDialogo(null)
    try {
      await window.shinobi.trabajos.cancelar(trabajoId)
    } catch (err) {
      avisarError(err)
    }
  }

  /** "Cancelar trabajo": en cola, sin diálogo; en curso, el diálogo del paso (0045/0068). */
  const cancelarTrabajo = useCallback(
    (id: string) => {
      const t = trabajoVivoDe(id, vivosRef.current)?.trabajo
      if (!t) return
      if (t.estado === 'en_cola') {
        window.shinobi.trabajos.cancelar(t.id).catch(avisarError)
      } else {
        setDialogo({ tipo: 'cancelar', id, paso: t.paso, trabajoId: t.id })
      }
    },
    [avisarError]
  )

  const continuar = useCallback(
    async (id: string) => {
      try {
        const cancion = await window.shinobi.biblioteca.obtener(id)
        if (!cancion) throw new Error('sin canción')
        const fuenteEnCola = vivosRef.current.trabajos.some(
          (t) => t.cancionId === id && t.paso === 'fuente' && t.estado !== 'terminado'
        )
        const paso = vistaAlContinuar(cancion, {
          fuenteEnCola,
          progresoVisto: progresoVisto(id)
        })
        // Con sesión abierta, Letra y Editor no se abren: se explica en `edi.bloqueo` (spec 06, E1).
        if (edicionBloqueada && (paso === 'letra' || paso === 'editor')) {
          abrirBloqueo()
          return
        }
        // Fuente sin completar: resumen de la fuente de esa canción (wireframe E), no una vista nueva.
        ir({ tipo: 'cancion', id, paso: paso === 'anadir' ? 'fuente' : paso })
      } catch {
        mostrarToast({ tipo: 'error', mensaje: 'No se pudo abrir la canción.' })
      }
    },
    [ir, edicionBloqueada, abrirBloqueo]
  )

  const { abrirDialogoPantallas } = sesion
  const tituloDe = useCallback(
    (id: string) => {
      const r = canciones.find((c) => c.id === id)
      return r ? tituloDeTarjeta(r) : ''
    },
    [canciones]
  )

  const marcarRevision = useMarcarRevision(
    useCallback((id: string) => canciones.find((c) => c.id === id), [canciones])
  )
  const ajustarFines = useAjustarFines(
    useCallback((id: string) => canciones.find((c) => c.id === id), [canciones])
  )
  const probarCancion = useProbar(marcarRevision.pedir)
  const probar = useCallback(
    (id: string) => probarCancion(id, tituloDe(id)),
    [probarCancion, tituloDe]
  )

  /** «Preparar» / «Reintentar» de una letra pendiente: continúa la cadena sin salir de la Biblioteca. */
  const preparar = useCallback(
    async (id: string, avisar: boolean) => {
      try {
        const r = await window.shinobi.preparacion.preparar([id])
        if (r.aceptadas.length === 0) {
          mostrarToast({
            tipo: 'info',
            mensaje: mensajeDeOmitida(r.omitidas, id, tituloDe(id))
          })
        } else if (avisar) {
          mostrarToast({ tipo: 'info', mensaje: BIB_PREP.toastPreparando(tituloDe(id)) })
        }
      } catch (err) {
        avisarError(err)
      }
    },
    [avisarError, tituloDe]
  )

  const acciones = useMemo<AccionesTarjeta>(
    () => ({
      reproducir: abrir,
      revisar: (id) => ir({ tipo: 'cancion', id, paso: 'editor', revisar: true }),
      probar,
      marcarLista: marcarRevision.pedir,
      preparar: (id) => void preparar(id, true),
      ajustarFines: ajustarFines.pedir,
      abrirLetra: (id) => ir({ tipo: 'cancion', id, paso: 'letra' }),
      reintentarBusqueda: (id) => void preparar(id, false),
      continuar: (id) => void continuar(id),
      editar: (id) => ir({ tipo: 'cancion', id, paso: 'editor' }),
      agregarAlFinal: (id) => void agregarACola(id, tituloDe(id), 'final'),
      agregarSiguiente: (id) => void agregarACola(id, tituloDe(id), 'siguiente'),
      reproducirEnOtraPantalla: (id) => abrirDialogoPantallas({ inicio: { cancionId: id } }),
      editarDatos: (id) => void abrirEditarDatos(id),
      volverABorrador: (id) => setDialogo({ tipo: 'borrador', id }),
      reintentar: (id) => void reintentarPaso(id),
      cancelarTrabajo,
      resepararPistas: (id) => void resepararPistas(id),
      mostrarEnCarpeta: (id) => void window.shinobi.biblioteca.mostrarEnCarpeta(id),
      eliminar: (id) => setDialogo({ tipo: 'eliminar', id }),
      // Con el catálogo vacío o en solo lectura el menú no ofrece la opción (ver notas de 0173).
      ...(temasUsables
        ? { aplicarTema: (id: string) => setAplicarTema({ ids: [id], desdeTarjeta: true }) }
        : null)
    }),
    [
      ir,
      abrir,
      marcarRevision.pedir,
      continuar,
      abrirEditarDatos,
      reintentarPaso,
      cancelarTrabajo,
      resepararPistas,
      agregarACola,
      tituloDe,
      abrirDialogoPantallas,
      temasUsables,
      probar,
      preparar,
      ajustarFines.pedir
    ]
  )

  const seleccionablesVisibles = () => ordenVisual.filter(esSeleccionable).map((c) => c.id)

  const entrarSeleccion = () => {
    sel.entrar()
    focoPendiente.current = { en: 'tarjeta', id: idActiva }
    setAnuncio(SEL.anuncioEntrar)
  }

  const abrirAplicarLote = () => {
    if (!catalogo.catalogo || motivoAplicar) return
    setAplicarTema({ ids: seleccionadas.map((c) => c.id), desdeTarjeta: false })
  }

  const cerrarAplicarTema = (salida: SalidaLote) => {
    const abierto = aplicarTema
    setAplicarTema(null)
    if (!abierto) return
    if (abierto.desdeTarjeta) {
      focoPendiente.current = { en: 'tarjeta', id: abierto.ids[0] }
    } else if (salida.tipo === 'terminado') {
      if (salida.conFallos) {
        sel.fijar(salida.reintentables)
        focoPendiente.current = { en: 'aplicar' }
      } else {
        sel.salir()
        focoPendiente.current = { en: 'seleccionar' }
      }
    }
  }

  // Qué canciones admite cada acción de la barra (docs/ux/02 · Feature 8).
  const ctxAplica: ContextoAplica = {
    conTrabajo: new Set([
      ...vivos.trabajos.filter((t) => t.estado !== 'terminado').map((t) => t.cancionId),
      ...(tanda?.canciones.filter((c) => c.resultado === null).map((c) => c.id) ?? [])
    ]),
    exportando: new Set(
      exportacion.exportaciones.filter((e) => e.estado !== 'terminada').map((e) => e.cancionId)
    ),
    activaId: sesion.haySesion ? (sesion.estado?.activa?.cancionId ?? null) : null
  }
  const ordenadas = ordenarSeleccion(
    seleccionadas,
    ordenVisual.map((c) => c.id)
  )
  const acciones8: AccionLote[] = [
    'preparar',
    'cola',
    'exportar',
    'paquete',
    'letra',
    'datos',
    'eliminar'
  ]
  const cuentasAcciones = Object.fromEntries(
    acciones8.map((a) => {
      const motivo = ordenadas
        .map((r) => motivoNoAplica(a, r, ctxAplica))
        .find((m): m is string => m !== null)
      const texto = {
        preparar: ACC.ninguna.preparar,
        cola: ACC.ninguna.cola,
        exportar: ACC.ninguna.exportar,
        letra: ACC.ninguna.letra
      } as Partial<Record<AccionLote, string>>
      return [
        a,
        {
          aplican: contarAplica(a, ordenadas, ctxAplica),
          motivo: texto[a] ?? (motivo ? MOTIVO[motivo] : undefined)
        }
      ]
    })
  ) as Record<AccionLote, { aplican: number; motivo?: string }>

  const ejecutarAccion = (accion: AccionLote) => {
    if (ordenadas.length === 0) return
    const aplican = ordenadas.filter((r) => motivoNoAplica(accion, r, ctxAplica) === null)
    if (accion === 'preparar' || accion === 'datos' || accion === 'eliminar') {
      setAccionLote({ tipo: accion, ids: ordenadas.map((r) => r.id) })
    } else if (accion === 'cola') {
      void agregarVarias(aplican.map((r) => r.id)).then((ok) => {
        if (!ok) return
        sel.salir()
        focoPendiente.current = { en: 'seleccionar' }
      })
    } else if (accion === 'paquete') {
      abrirExportarPaquete({ tipo: 'canciones', ids: ordenadas.map((r) => r.id) })
    } else if (accion === 'letra') {
      void exportarLetras(aplican.map((r) => ({ id: r.id, titulo: r.titulo, artista: r.artista })))
    } else if (accion === 'exportar') {
      // Con una sola aplicable se abre el diálogo de una canción (A), no el de lote.
      if (aplican.length === 1) exportacion.abrir({ cancionId: aplican[0]!.id })
      else {
        exportacion.abrirLote(
          aplican.map((r) => r.id),
          ordenadas.flatMap((r) => {
            const motivo = motivoNoAplica('exportar', r, ctxAplica)
            return motivo ? [{ id: r.id, titulo: r.titulo, artista: r.artista, motivo }] : []
          })
        )
      }
    }
  }

  const cerrarAccionLote = (salida: SalidaAccion) => {
    setAccionLote(null)
    if (salida.tipo === 'hecho') {
      sel.salir()
      focoPendiente.current = { en: 'seleccionar' }
    } else if (salida.tipo === 'faltan') {
      // Con fallos se sigue en el modo, con las fallidas seleccionadas y el foco en la acción.
      sel.fijar(salida.ids)
      focoPendiente.current = { en: 'mas' }
    } else focoPendiente.current = { en: 'mas' }
  }

  /** Tras «Editar datos»: la tarjeta se mueve de grupo en ese momento y se avisa si cambia su tema. */
  const alEditarDatos = (antes: ResumenCancionIpc, nuevo: ResumenCancionIpc) => {
    setAnclada(nuevo.id)
    const grupoNuevo = idGrupoDe(nuevo, agrupar, ahora)
    if (grupoNuevo !== null && grupoNuevo !== idGrupoDe(antes, agrupar, ahora)) {
      if (plegados.has(grupoNuevo)) {
        const siguiente = new Set(plegados)
        siguiente.delete(grupoNuevo)
        plegadosDeSesion = siguiente
        setPlegados(siguiente)
      }
      setMovida({ id: nuevo.id, grupoId: grupoNuevo, titulo: tituloDeTarjeta(nuevo) })
    }
    const a = antes.apariencia
    const n = nuevo.apariencia
    if (a.temaId !== n.temaId || a.procedencia !== n.procedencia) {
      const tema = n.temaNombre
        ? `el tema «${n.temaNombre}», ${procedenciaCorta(n.procedencia)}`
        : `${lineaDeTema(n).texto.toLowerCase()}`
      mostrarToast({ tipo: 'info', mensaje: `«${tituloDeTarjeta(nuevo)}» usa ahora ${tema}.` })
    }
  }

  const renderTarjeta = (c: ResumenCancionIpc) => (
    <div
      role="listitem"
      key={c.id}
      className={estilos.item}
      data-resaltada={resaltada?.id === c.id || resaltadasInfo.has(c.id) ? true : undefined}
      data-resalte={resaltadasInfo.has(c.id) ? 'info' : undefined}
    >
      <TarjetaCancion
        resumen={c}
        acciones={acciones}
        activa={c.id === idActiva}
        alEnfocar={setActiva}
        vivo={trabajoVivoDe(c.id, vivos)}
        seleccion={
          sel.activo
            ? {
                marcada: sel.ids.has(c.id),
                editable: esSeleccionable(c),
                alAlternar: (rango) => {
                  if (!esSeleccionable(c)) {
                    mostrarToast({ tipo: 'info', mensaje: SEL.noEditable })
                  } else if (rango) {
                    sel.rango(c.id, refs.current.orden, (id) => {
                      const r = resumenDe(id)
                      return r !== undefined && esSeleccionable(r)
                    })
                  } else sel.alternar(c.id)
                }
              }
            : undefined
        }
      />
    </div>
  )

  const teclasRejilla = (e: KeyboardEvent<HTMLDivElement>) => {
    // Ctrl/Cmd + A con el foco en la rejilla: entra en el modo y marca las visibles editables.
    if (
      (e.ctrlKey || e.metaKey) &&
      !e.altKey &&
      !e.shiftKey &&
      e.key.toLowerCase() === 'a' &&
      e.target instanceof HTMLElement &&
      e.target.tagName !== 'INPUT'
    ) {
      e.preventDefault()
      if (!sel.activo) setAnuncio(SEL.anuncioEntrar)
      sel.entrar(seleccionablesVisibles())
      return
    }
    // Supr en el modo selección, con algo seleccionado: «Eliminar…» de la selección (spec 02 · Feature 8).
    if (e.key === 'Delete' && sel.activo) {
      e.preventDefault()
      if (seleccionadas.length > 0) ejecutarAccion('eliminar')
      return
    }
    if (!(e.target instanceof HTMLElement) || e.target.dataset.tarjeta === undefined) return
    const teclas = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!teclas.includes(e.key)) return
    const tarjetas = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-tarjeta]'))
    const i = tarjetas.indexOf(e.target)
    const origen = tarjetas[i]
    if (!origen) return
    e.preventDefault()
    const rect = (n: HTMLElement) => n.getBoundingClientRect()
    let destino = i
    if (e.key === 'ArrowRight') destino = Math.min(i + 1, tarjetas.length - 1)
    else if (e.key === 'ArrowLeft') destino = Math.max(i - 1, 0)
    else if (e.key === 'Home' || e.key === 'End') {
      // Inicio/Fin: primera y última del grupo; con Ctrl/Cmd, de toda la biblioteca.
      const ambito = e.ctrlKey || e.metaKey ? null : origen.closest('[data-grupo-tarjetas]')
      const lista = ambito
        ? Array.from(ambito.querySelectorAll<HTMLElement>('[data-tarjeta]'))
        : tarjetas
      const elegida = e.key === 'Home' ? lista[0] : lista[lista.length - 1]
      destino = elegida ? tarjetas.indexOf(elegida) : i
    } else {
      // Arriba/abajo: la tarjeta de la fila contigua más cercana en horizontal (cruza grupos).
      const sentido = e.key === 'ArrowDown' ? 1 : -1
      const actual = rect(origen)
      let mejor = Infinity
      tarjetas.forEach((t, j) => {
        const r = rect(t)
        if ((r.top - actual.top) * sentido <= 1) return
        const dist = Math.abs(r.top - actual.top) * 1000 + Math.abs(r.left - actual.left)
        if (dist < mejor) {
          mejor = dist
          destino = j
        }
      })
    }
    tarjetas[destino]?.focus()
  }

  if (estado === 'cargando') {
    return (
      <section aria-labelledby="titulo-vista" aria-busy="true">
        <h1 id="titulo-vista" className="t-titulo" tabIndex={-1} data-foco-inicial>
          Biblioteca
        </h1>
        {lenta && (
          <p role="status" className={estilos.cargando}>
            Cargando tu biblioteca…
          </p>
        )}
        <Esqueletos />
      </section>
    )
  }

  if (estado === 'error') {
    return (
      <section aria-labelledby="titulo-vista">
        <h1 id="titulo-vista" className="t-titulo" tabIndex={-1} data-foco-inicial>
          Biblioteca
        </h1>
        <AvisoEnLinea
          tipo="error"
          accion={
            <Boton variante="secundario" onClick={reintentar}>
              Reintentar
            </Boton>
          }
        >
          No se pudo cargar tu biblioteca.
        </AvisoEnLinea>
      </section>
    )
  }

  if (canciones.length === 0) {
    return (
      <section aria-labelledby="titulo-vista">
        <EstadoVacio />
        <VeloArrastre />
      </section>
    )
  }

  const pendientesCola = sesion.estado?.pendientes.length ?? 0
  const cuentas = contarPorFiltro(canciones)
  const filtrando = filtro !== 'todas' || busqueda.trim() !== ''
  const texto = busqueda.trim()

  const dialogoResumen = dialogo ? resumenDe(dialogo.id) : undefined
  const vivoDialogo = dialogo ? trabajoVivoDe(dialogo.id, vivos) : null
  const enCursoPaso = dialogoResumen?.pasos
    ? (['fuente', 'separacion'] as const).find(
        (p) => dialogoResumen.pasos?.[p]?.estado === 'en_curso'
      )
    : undefined
  const pasoActivo = vivoDialogo?.trabajo.paso ?? enCursoPaso
  // Una canción pendiente o con entradas en la cola avisa en sus diálogos (spec 02, S11).
  const estaEnCola =
    dialogo !== null && (sesion.estado?.pendientes.some((e) => e.cancionId === dialogo.id) ?? false)
  const avisoTrabajo =
    pasoActivo === 'separacion'
      ? ' Se cancelará la separación en curso.'
      : pasoActivo === 'fuente'
        ? ' Se cancelará la descarga en curso.'
        : ''
  const avisoExportacion =
    dialogo && exportacion.activaDe(dialogo.id) ? ` ${EXP_ELIMINAR_EXTRA}` : ''

  return (
    <div className={estilos.conPanel}>
      <section ref={seccion} aria-labelledby="titulo-vista" className={estilos.principal}>
        <div className={estilos.cabecera}>
          <h1 id="titulo-vista" className="t-titulo" tabIndex={-1} data-foco-inicial>
            Biblioteca
          </h1>
          <div className={estilos.cabeceraAcciones}>
            {!sesion.haySesion && (
              <Boton
                aria-label={SES.abrirAria}
                onClick={() => sesion.abrirDialogoPantallas({ inicio: 'cola' })}
              >
                <Icono icono={MonitorUp} tamano={16} />
                {SES.abrir}
              </Boton>
            )}
            <Boton
              variante="fantasma"
              {...{ [ATRIBUTO_BOTON_COLA]: '' }}
              aria-expanded={sesion.panelAbierto}
              aria-controls={ID_PANEL_COLA}
              aria-label={COLA.botonAria(pendientesCola, sesion.panelAbierto)}
              onClick={() => (sesion.panelAbierto ? sesion.cerrarPanel() : sesion.abrirPanel())}
            >
              <Icono icono={ListMusic} tamano={16} />
              {COLA.boton(pendientesCola)}
            </Boton>
          </div>
        </div>
        <p role="status" className={estilos.soloLector}>
          {anuncio}
        </p>
        <div className={estilos.barraHerramientas}>
          <ControlSegmentado
            etiqueta="Filtrar canciones"
            valor={filtro}
            onCambio={setFiltro}
            opciones={[
              { valor: 'todas', etiqueta: `Todas ${cuentas.todas}` },
              { valor: 'listas', etiqueta: `Listas ${cuentas.listas}` },
              { valor: 'borradores', etiqueta: `Borradores ${cuentas.borradores}` }
            ]}
          />
          <div className={estilos.controlAgrupar}>
            <span className="t-pequeno" aria-hidden="true">
              Agrupar por
            </span>
            <ControlSegmentado
              etiqueta="Agrupar por"
              valor={agrupar}
              onCambio={setAgrupacion}
              opciones={[
                { valor: 'ninguno', etiqueta: 'Sin agrupar' },
                { valor: 'artista', etiqueta: 'Artista' },
                { valor: 'album', etiqueta: 'Álbum' },
                { valor: 'fecha', etiqueta: 'Fecha de añadido' }
              ]}
            />
          </div>
          {!sel.activo && (
            <Boton ref={botonSeleccionar} onClick={entrarSeleccion}>
              <Icono icono={SquareCheck} tamano={16} />
              {SEL.boton}
            </Boton>
          )}
          <div className={estilos.busqueda}>
            <Icono icono={Search} tamano={16} className={estilos.busquedaIcono} />
            <input
              ref={campoBusqueda}
              type="search"
              className={estilos.campoBusqueda}
              placeholder="Buscar título, artista o álbum"
              aria-label="Buscar título, artista o álbum"
              value={busqueda}
              onChange={(e) => cambiarBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && busqueda !== '') {
                  e.preventDefault()
                  e.stopPropagation()
                  cambiarBusqueda('')
                }
              }}
            />
          </div>
        </div>
        {reanudacion.aviso && (
          <div className={estilos.avisosPrep}>
            <AvisoEnLinea
              tipo="info"
              accion={
                reanudacion.aviso.tipo === 'retomando' ? (
                  <Boton
                    variante="secundario"
                    onClick={() => void reanudacion.detener().catch(avisarError)}
                  >
                    {BIB_PREP.detener}
                  </Boton>
                ) : (
                  <Boton
                    variante="secundario"
                    onClick={() => void reanudacion.reanudar().catch(avisarError)}
                  >
                    {BIB_PREP.reanudar}
                  </Boton>
                )
              }
            >
              {reanudacion.aviso.tipo === 'retomando'
                ? BIB_PREP.retomando(reanudacion.aviso.n)
                : BIB_PREP.enPausa(reanudacion.aviso.n)}
            </AvisoEnLinea>
          </div>
        )}
        <BandejaPendientes
          cuentas={contarBandeja(canciones)}
          activa={casilla}
          alAlternar={alternarCasilla}
        />
        {sel.activo && (
          <BarraSeleccion
            ref={botonAplicar}
            seleccionadas={seleccionadas.length}
            fuera={fuera}
            motivoInactivo={motivoAplicar}
            cuentas={cuentasAcciones}
            alAccion={ejecutarAccion}
            alAplicar={abrirAplicarLote}
            alSeleccionarVisibles={() => sel.anadir(seleccionablesVisibles())}
            alQuitar={sel.vaciar}
            alTerminar={() => {
              focoPendiente.current = { en: 'seleccionar' }
              sel.salir()
            }}
          />
        )}
        {visibles.length === 0 ? (
          <div className={estilos.sinResultados} role="status">
            <p>{textoSinResultados(filtro, texto)}</p>
            {texto !== '' && (
              <div className={estilos.accionesVacio}>
                <Boton
                  variante="fantasma"
                  onClick={() => {
                    cambiarBusqueda('')
                    campoBusqueda.current?.focus()
                  }}
                >
                  Borrar búsqueda
                </Boton>
                {filtro !== 'todas' && (
                  <Boton variante="fantasma" onClick={() => setFiltro('todas')}>
                    Ver todas
                  </Boton>
                )}
              </div>
            )}
          </div>
        ) : (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
          <div ref={rejilla} onKeyDown={teclasRejilla}>
            {agrupar === 'ninguno' ? (
              <div
                role="list"
                aria-label="Canciones"
                className={estilos.rejilla}
                data-grupo-tarjetas
              >
                {visibles.map(renderTarjeta)}
              </div>
            ) : (
              grupos.map((g) => {
                const plegado = plegados.has(g.id)
                const idRegion = `${idBase}-${g.id}`
                return (
                  <div key={g.id} className={estilos.grupo} data-grupo={g.id}>
                    <EncabezadoGrupo
                      grupo={g}
                      plegado={plegado}
                      filtrando={filtrando}
                      idRegion={idRegion}
                      alAlternar={() => alternarPlegado(g.id)}
                      casilla={
                        sel.activo ? (
                          <CasillaGrupo
                            nombreGrupo={g.nombre}
                            ids={g.canciones.filter(esSeleccionable).map((c) => c.id)}
                            seleccion={sel.ids}
                            alAlternar={(ids, marcar) =>
                              marcar ? sel.anadir(ids) : sel.quitar(ids)
                            }
                          />
                        ) : undefined
                      }
                      tema={g.asignable ? <TemaGrupo grupo={g} catalogo={catalogo} /> : undefined}
                    />
                    <div
                      id={idRegion}
                      role="list"
                      aria-label={g.nombre}
                      className={estilos.rejilla}
                      data-grupo-tarjetas
                      hidden={plegado}
                    >
                      {!plegado && g.canciones.map(renderTarjeta)}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
        {marcarRevision.dialogos}
        {ajustarFines.dialogo}
        {dialogo?.tipo === 'datos' && (
          <DialogoEditarDatos
            inicial={dialogo.inicial}
            alCancelar={() => setDialogo(null)}
            alGuardar={async (datos) => {
              const antes = resumenDe(dialogo.id)
              const nuevo = await window.shinobi.biblioteca.actualizarMetadatos(dialogo.id, datos)
              setDialogo(null)
              if (antes && nuevo) alEditarDatos(antes, nuevo)
            }}
          />
        )}
        {dialogo?.tipo === 'borrador' && dialogoResumen && (
          <DialogoConfirmar
            titulo="¿Volver a borrador?"
            cuerpo={`«${tituloDeTarjeta(dialogoResumen)}» dejará de poder reproducirse hasta que la marques como lista otra vez. No se pierde nada.${estaEnCola ? ` ${BIB_COLA.dialogoBorrador}` : ''}`}
            etiquetaConfirmar="Volver a borrador"
            alCancelar={() => setDialogo(null)}
            alConfirmar={() => confirmarBorrador(dialogo.id)}
          />
        )}
        {dialogo?.tipo === 'cancelar' && dialogoResumen && (
          <>
            <DialogoCancelarDescarga
              abierto={dialogo.paso === 'fuente'}
              titulo={tituloDeTarjeta(dialogoResumen)}
              alSeguir={() => setDialogo(null)}
              alConfirmar={() => void cancelarEnCurso(dialogo.trabajoId)}
            />
            <DialogoCancelarSeparacion
              abierto={dialogo.paso === 'separacion'}
              alSeguir={() => setDialogo(null)}
              alConfirmar={() => void cancelarEnCurso(dialogo.trabajoId)}
            />
          </>
        )}
        {dialogo?.tipo === 'eliminar' && dialogoResumen && (
          <DialogoConfirmar
            titulo={`¿Eliminar «${tituloDeTarjeta(dialogoResumen)}»?`}
            cuerpo={`Se moverá a la papelera de tu sistema, con sus pistas y su letra. Podrás recuperarla desde allí.${avisoTrabajo}${avisoExportacion}${estaEnCola ? ` ${BIB_COLA.dialogoEliminar}` : ''}`}
            etiquetaConfirmar="Eliminar"
            destructivo
            alCancelar={() => setDialogo(null)}
            alConfirmar={() => confirmarEliminar(dialogo.id)}
          />
        )}
        <DialogoPantallasPedido
          buscar={(id) => {
            const r = resumenDe(id)
            return r ? { titulo: tituloDeTarjeta(r), artista: r.artista } : undefined
          }}
        />
        {resultadoAbierto && (
          <DialogoResultadoPreparacion
            tanda={tanda}
            canciones={canciones}
            alCerrar={() => setResultadoAbierto(false)}
            alVerEnBiblioteca={(hayListas) => {
              setResultadoAbierto(false)
              if (hayListas) {
                fijarCasilla('revisar')
                filtroDeSesion = 'borradores'
                setFiltroEstado('borradores')
              } else {
                fijarCasilla(null)
                filtroDeSesion = 'todas'
                setFiltroEstado('todas')
              }
            }}
            alRevisar={(id) => {
              setResultadoAbierto(false)
              ir({ tipo: 'cancion', id, paso: 'editor', revisar: true })
            }}
            alAbrirLetra={(id) => {
              setResultadoAbierto(false)
              ir({ tipo: 'cancion', id, paso: 'letra' })
            }}
            alReintentarFallidas={() => {
              setResultadoAbierto(false)
              void window.shinobi.preparacion.reintentarFallidas().catch(avisarError)
            }}
            alCopiarDetalles={(texto) => void copiarDetalles(texto)}
          />
        )}
        {accionLote?.tipo === 'preparar' && (
          <DialogoPreparar
            canciones={accionLote.ids.flatMap((id) => resumenDe(id) ?? [])}
            alCerrar={cerrarAccionLote}
          />
        )}
        {accionLote?.tipo === 'datos' && (
          <DialogoDatos
            canciones={accionLote.ids.flatMap((id) => resumenDe(id) ?? [])}
            alCerrar={cerrarAccionLote}
          />
        )}
        {accionLote?.tipo === 'eliminar' && (
          <DialogoEliminar
            canciones={accionLote.ids.flatMap((id) => resumenDe(id) ?? [])}
            alCerrar={cerrarAccionLote}
          />
        )}
        {aplicarTema && (
          <DialogoAplicarTema
            canciones={aplicarTema.ids.flatMap((id) => resumenDe(id) ?? [])}
            catalogo={catalogo}
            desdeTarjeta={aplicarTema.desdeTarjeta}
            alCerrar={cerrarAplicarTema}
          />
        )}
      </section>
      <PanelColaHost canciones={canciones} />
      <VeloArrastre />
    </div>
  )
}
