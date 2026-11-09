import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'
import { Mic, Search } from 'lucide-react'
import { vistaAlContinuar } from '@shared/derivados'
import { claveTexto } from '@shared/identidad'
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
import { DialogoConfirmar, DialogoEditarDatos, type DatosEditables } from './DialogosCancion'
import { EncabezadoGrupo } from './EncabezadoGrupo'
import { TarjetaCancion, type AccionesTarjeta } from './TarjetaCancion'
import { agruparCanciones, idGrupoDe, textoAnuncioResultados } from './agrupacion'
import { detallesDeError } from './errores'
import { contarPorFiltro, filtrarCanciones, type FiltroBiblioteca } from './filtrado'
import { pasoConProblema, tituloDeTarjeta, type TrabajoVivo } from './tarjeta'
import { PROCEDENCIA_CORTA } from './textosTema'
import { tituloDeError } from './textosError'
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
  const [movida, setMovida] = useState<{ id: string; grupoId: string; titulo: string } | null>(
    null
  )
  const [anuncio, setAnuncio] = useState('')
  const [cambioDeVista, setCambioDeVista] = useState(0)
  const seccion = useRef<HTMLElement>(null)
  const idBase = useId()

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
  const ordenClave = ordenVisual.map((c) => c.id).join(' ')
  useEffect(() => {
    const antes = ordenPrevio.current
    const orden = ordenClave === '' ? [] : ordenClave.split(' ')
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

  /** Tras eliminar, la tarjeta enfocada desaparece: el foco pasa a la tarjeta activa o al título. */
  const recuperarFoco = () => {
    setTimeout(() => {
      if (document.activeElement && document.activeElement !== document.body) return
      const destino =
        document.querySelector<HTMLElement>('[data-tarjeta][tabindex="0"]') ??
        document.querySelector<HTMLElement>('[data-foco-inicial]')
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
      recuperarFoco()
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
      eliminar: (id) => setDialogo({ tipo: 'eliminar', id })
    }),
    [ir, abrir, continuar, abrirEditarDatos, reintentarPaso, cancelarTrabajo, resepararPistas]
  )

  const teclasRejilla = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && e.target.dataset.tarjeta === undefined) return
    const teclas = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!teclas.includes(e.key)) return
    const tarjetas = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-tarjeta]'))
    const i = tarjetas.indexOf(e.target as HTMLElement)
    const origen = tarjetas[i]
    if (!origen) return
    e.preventDefault()
    const rect = (n: HTMLElement) => n.getBoundingClientRect()
    let destino = i
    if (e.key === 'ArrowRight') destino = Math.min(i + 1, tarjetas.length - 1)
    else if (e.key === 'ArrowLeft') destino = Math.max(i - 1, 0)
    else if (e.key === 'Home') destino = 0
    else if (e.key === 'End') destino = tarjetas.length - 1
    else {
      // Arriba/abajo: la tarjeta de la fila contigua más cercana en horizontal.
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

  const visibles = filtrarCanciones(canciones, filtro, busqueda)
  const cuentas = contarPorFiltro(canciones)
  const idActiva = visibles.some((c) => c.id === activa) ? activa : visibles[0]?.id
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
    <section aria-labelledby="titulo-vista">
      <h1 id="titulo-vista" className="t-titulo" tabIndex={-1} data-foco-inicial>
        Biblioteca
      </h1>
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
        <div className={estilos.busqueda}>
          <Icono icono={Search} tamano={16} className={estilos.busquedaIcono} />
          <input
            ref={campoBusqueda}
            type="search"
            className={estilos.campoBusqueda}
            placeholder="Buscar título o artista"
            aria-label="Buscar título o artista"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && busqueda !== '') {
                e.preventDefault()
                e.stopPropagation()
                setBusqueda('')
              }
            }}
          />
        </div>
      </div>
      {visibles.length === 0 ? (
        <div className={estilos.sinResultados} role="status">
          <p>{textoSinResultados(filtro, texto)}</p>
          {texto !== '' && (
            <div className={estilos.accionesVacio}>
              <Boton
                variante="fantasma"
                onClick={() => {
                  setBusqueda('')
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
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          ref={rejilla}
          role="list"
          aria-label="Canciones"
          className={estilos.rejilla}
          onKeyDown={teclasRejilla}
        >
          {visibles.map((c) => (
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
                estiloUsuario={estiloUsuario}
              />
            </div>
          ))}
        </div>
      )}
      {dialogo?.tipo === 'datos' && (
        <DialogoEditarDatos
          inicial={dialogo.inicial}
          alCancelar={() => setDialogo(null)}
          alGuardar={async (datos) => {
            await window.shinobi.biblioteca.actualizarMetadatos(dialogo.id, datos)
            setDialogo(null)
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
    </section>
  )
}
