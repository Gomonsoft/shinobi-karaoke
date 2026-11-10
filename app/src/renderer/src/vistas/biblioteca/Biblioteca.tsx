import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Mic, Search, SquareCheck } from 'lucide-react'
import { vistaAlContinuar } from '@shared/derivados'
import type { ResumenCancionIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { ControlSegmentado } from '../../componentes/ControlSegmentado'
import { Icono } from '../../componentes/Icono'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useReproductor } from '../../navegacion/reproductor'
import { useNavegacion, type Vista } from '../../navegacion/estado'
import { progresoVisto } from '../../navegacion/progresoVisto'
import { useTrabajosVivos } from '../../trabajos/useTrabajos'
import { useCatalogoTemas } from '../../temas/useCatalogoTemas'
import { DialogoConfirmar, DialogoEditarDatos, type DatosEditables } from './DialogosCancion'
import { BarraSeleccion } from './BarraSeleccion'
import { CasillaGrupo } from './CasillaGrupo'
import { DialogoAplicarTema, type SalidaLote } from './DialogoAplicarTema'
import { EncabezadoGrupo } from './EncabezadoGrupo'
import { TemaGrupo } from './TemaGrupo'
import { TarjetaCancion, type AccionesTarjeta } from './TarjetaCancion'
import { agruparCanciones, idGrupoDe, textoAnuncioResultados } from './agrupacion'
import { detallesDeError } from './errores'
import { contarPorFiltro, filtrarCanciones, type FiltroBiblioteca } from './filtrado'
import { pasoConProblema, tituloDeTarjeta, type TrabajoVivo } from './tarjeta'
import { procedenciaCorta } from '../../temas/textos'
import { lineaDeTema } from './textosTema'
import { tituloDeError } from './textosError'
import { SEL, TEMAS_NO_DISPONIBLES } from './textosSeleccion'
import { esSeleccionable, reiniciarSeleccionDeSesion, useSeleccion } from './useSeleccion'
import { DialogoCancelarDescarga, DialogoCancelarSeparacion } from '../progreso/DialogosCancelar'
import {
  reiniciarAgruparDeSesion,
  useAgrupar,
  useBiblioteca,
  useBibliotecaCompartida,
  type BibliotecaDatos
} from './useBiblioteca'
import estilos from './biblioteca.module.css'

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
        Añade tu primera canción desde un archivo de tu ordenador o un enlace de YouTube. Shinobi
        Karaoke separará la voz para que puedas cantar encima.
      </p>
      <Boton variante="primario" tamano="grande" onClick={() => ir({ tipo: 'anadir' })}>
        Añadir canción
      </Boton>
      <p className={`t-pequeno ${estilos.formatos}`}>
        Formatos: MP3, M4A, FLAC, WAV, OGG, y también vídeos MP4, MKV, MOV o WebM.
      </p>
    </div>
  )
}

// El filtro persiste durante la sesión (aunque se salga de la vista); la búsqueda no.
let filtroDeSesion: FiltroBiblioteca = 'todas'
// Los grupos plegados también viven solo en la sesión (no se guardan; al reiniciar, todo desplegado).
let plegadosDeSesion: ReadonlySet<string> = new Set()
/** Espera tras la última pulsación antes de anunciar el recuento (`bib.anuncio.resultados`). */
export const RETRASO_ANUNCIO_MS = 500
/** Solo para pruebas. */
export function reiniciarFiltroDeSesion(): void {
  filtroDeSesion = 'todas'
  plegadosDeSesion = new Set()
  reiniciarAgruparDeSesion()
  reiniciarSeleccionDeSesion()
}

type DialogoActivo =
  | { tipo: 'datos'; id: string; inicial: DatosEditables }
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
  const { estado, lenta, canciones, reintentar } = datos
  const vivos = useTrabajosVivos()
  const [activa, setActiva] = useState<string | null>(null)
  const [filtro, setFiltroEstado] = useState<FiltroBiblioteca>(filtroDeSesion)
  const [busqueda, setBusqueda] = useState('')
  const [dialogo, setDialogo] = useState<DialogoActivo | null>(null)
  const campoBusqueda = useRef<HTMLInputElement>(null)
  const rejilla = useRef<HTMLDivElement>(null)
  const enfoqueRealizado = useRef<EnfoqueBiblioteca | undefined>(undefined)
  const [resaltada, setResaltada] = useState<EnfoqueBiblioteca | null>(null)
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
  const botonSeleccionar = useRef<HTMLButtonElement>(null)
  const botonAplicar = useRef<HTMLButtonElement>(null)
  // Foco que hay que dejar tras el siguiente render (entrar, salir o cerrar el diálogo de lote).
  const focoPendiente = useRef<{ en: 'seleccionar' | 'aplicar' | 'tarjeta'; id?: string } | null>(
    null
  )

  const visibles = useMemo(
    () => filtrarCanciones(canciones, filtro, busqueda, anclada),
    [canciones, filtro, busqueda, anclada]
  )
  const grupos = useMemo(
    () => agruparCanciones(visibles, canciones, agrupar),
    [visibles, canciones, agrupar]
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
      const tarjetas = rejilla.current?.querySelectorAll<HTMLElement>('[data-tarjeta]')
      const tarjeta = Array.from(tarjetas ?? []).find((nodo) => nodo.dataset.tarjeta === enfocar.id)
      if (!tarjeta) return
      enfoqueRealizado.current = enfocar
      tarjeta.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
      tarjeta.focus({ preventScroll: true })
      setResaltada(enfocar.resaltar ? enfocar : null)
    })
    return () => cancelAnimationFrame(fotograma)
  }, [enfocar, estado, filtro, cancionParaEnfocar])

  useEffect(() => {
    if (!resaltada) return
    const plazo = setTimeout(() => setResaltada(null), RESALTE_MS)
    return () => clearTimeout(plazo)
  }, [resaltada])

  const volverArriba = () => seccion.current?.closest('main')?.scrollTo?.({ top: 0 })

  const setFiltro = (f: FiltroBiblioteca) => {
    filtroDeSesion = f
    setFiltroEstado(f)
    setAnclada(null)
    setCambioDeVista((n) => n + 1)
  }

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
    if (!actual || idGrupoDe(actual, agrupar) !== movida.grupoId) return
    const grupo = grupos.find((g) => g.id === movida.grupoId)
    const tarjeta = rejilla.current?.querySelector<HTMLElement>(
      `[data-tarjeta="${CSS.escape(movida.id)}"]`
    )
    if (!grupo || !tarjeta) return
    tarjeta.scrollIntoView?.({ block: 'nearest' })
    tarjeta.focus({ preventScroll: true })
    setAnuncio(`«${movida.titulo}» está ahora en ${grupo.nombre}.`)
    setMovida(null)
  }, [movida, canciones, grupos, agrupar])

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
      botonSeleccionar.current?.focus()
    } else if (f.en === 'aplicar') {
      if (!sel.activo) return
      botonAplicar.current?.focus()
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
        inicial: { titulo: m.titulo, artista: m.artista, album: m.album }
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
          alAccionar: () => void navigator.clipboard?.writeText(detallesDeError(err))
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
          alAccionar: () => void navigator.clipboard?.writeText(detallesDeError(err))
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
        alAccionar: () => void navigator.clipboard?.writeText(detallesDeError(err))
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
        // Fuente sin completar: resumen de la fuente de esa canción (wireframe E), no una vista nueva.
        ir({ tipo: 'cancion', id, paso: paso === 'anadir' ? 'fuente' : paso })
      } catch {
        mostrarToast({ tipo: 'error', mensaje: 'No se pudo abrir la canción.' })
      }
    },
    [ir]
  )

  const acciones = useMemo<AccionesTarjeta>(
    () => ({
      reproducir: abrir,
      continuar: (id) => void continuar(id),
      editar: (id) => ir({ tipo: 'cancion', id, paso: 'editor' }),
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
      continuar,
      abrirEditarDatos,
      reintentarPaso,
      cancelarTrabajo,
      resepararPistas,
      temasUsables
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

  /** Tras «Editar datos»: la tarjeta se mueve de grupo en ese momento y se avisa si cambia su tema. */
  const alEditarDatos = (antes: ResumenCancionIpc, nuevo: ResumenCancionIpc) => {
    setAnclada(nuevo.id)
    const grupoNuevo = idGrupoDe(nuevo, agrupar)
    if (grupoNuevo !== null && grupoNuevo !== idGrupoDe(antes, agrupar)) {
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
      data-resaltada={resaltada?.id === c.id ? true : undefined}
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
      </section>
    )
  }

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
  const avisoTrabajo =
    pasoActivo === 'separacion'
      ? ' Se cancelará la separación en curso.'
      : pasoActivo === 'fuente'
        ? ' Se cancelará la descarga en curso.'
        : ''

  return (
    <section ref={seccion} aria-labelledby="titulo-vista">
      <h1 id="titulo-vista" className="t-titulo" tabIndex={-1} data-foco-inicial>
        Biblioteca
      </h1>
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
              { valor: 'album', etiqueta: 'Álbum' }
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
      {sel.activo && (
        <BarraSeleccion
          ref={botonAplicar}
          seleccionadas={seleccionadas.length}
          fuera={fuera}
          motivoInactivo={motivoAplicar}
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
            <div role="list" aria-label="Canciones" className={estilos.rejilla} data-grupo-tarjetas>
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
                          alAlternar={(ids, marcar) => (marcar ? sel.anadir(ids) : sel.quitar(ids))}
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
          cuerpo={`«${tituloDeTarjeta(dialogoResumen)}» dejará de poder reproducirse hasta que la marques como lista otra vez. No se pierde nada.`}
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
          cuerpo={`Se moverá a la papelera de tu sistema, con sus pistas y su letra. Podrás recuperarla desde allí.${avisoTrabajo}`}
          etiquetaConfirmar="Eliminar"
          destructivo
          alCancelar={() => setDialogo(null)}
          alConfirmar={() => confirmarEliminar(dialogo.id)}
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
  )
}
