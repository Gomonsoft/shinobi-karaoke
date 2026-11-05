import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Mic, Search } from 'lucide-react'
import { vistaAlContinuar } from '@shared/derivados'
import type { Estilo } from '@shared/estilo'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { ControlSegmentado } from '../../componentes/ControlSegmentado'
import { Icono } from '../../componentes/Icono'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion } from '../../navegacion/estado'
import { progresoVisto } from '../../navegacion/progresoVisto'
import { useTrabajosVivos } from '../../trabajos/useTrabajos'
import { DialogoConfirmar, DialogoEditarDatos, type DatosEditables } from './DialogosCancion'
import { TarjetaCancion, type AccionesTarjeta } from './TarjetaCancion'
import { detallesDeError } from './errores'
import { contarPorFiltro, filtrarCanciones, type FiltroBiblioteca } from './filtrado'
import { pasoConProblema, tituloDeTarjeta, type TrabajoVivo } from './tarjeta'
import { tituloDeError } from './textosError'
import { DialogoCancelarDescarga, DialogoCancelarSeparacion } from '../progreso/DialogosCancelar'
import { useBiblioteca, useBibliotecaCompartida, type BibliotecaDatos } from './useBiblioteca'
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
/** Solo para pruebas. */
export function reiniciarFiltroDeSesion(): void {
  filtroDeSesion = 'todas'
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

/** `config.estilo_predeterminado` vigente: se lee una vez y se actualiza con `alCambiarConfig`. */
function useEstiloPredeterminado(): Estilo | null {
  const [estilo, setEstilo] = useState<Estilo | null>(null)
  useEffect(() => {
    let activo = true
    window.shinobi.config?.obtener().then(
      (c) => activo && setEstilo(c.estilo_predeterminado),
      () => undefined
    )
    const baja = window.shinobi.alCambiarConfig?.((c) => setEstilo(c.estilo_predeterminado))
    return () => {
      activo = false
      baja?.()
    }
  }, [])
  return estilo
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

function VistaBiblioteca({ datos }: { datos: BibliotecaDatos }) {
  const { ir } = useNavegacion()
  const { estado, lenta, canciones, reintentar } = datos
  const vivos = useTrabajosVivos()
  const estiloUsuario = useEstiloPredeterminado()
  const [activa, setActiva] = useState<string | null>(null)
  const [filtro, setFiltroEstado] = useState<FiltroBiblioteca>(filtroDeSesion)
  const [busqueda, setBusqueda] = useState('')
  const [dialogo, setDialogo] = useState<DialogoActivo | null>(null)
  const campoBusqueda = useRef<HTMLInputElement>(null)

  const setFiltro = (f: FiltroBiblioteca) => {
    filtroDeSesion = f
    setFiltroEstado(f)
  }

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

  const cancionesRef = useRef(canciones)
  useEffect(() => {
    cancionesRef.current = canciones
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
      const resumen = cancionesRef.current.find((c) => c.id === id)
      const paso = resumen ? pasoConProblema(resumen) : null
      try {
        if (paso === 'fuente') await window.shinobi.fuente.reintentar(id)
        else if (paso === 'separacion') await window.shinobi.separacion.separar(id)
      } catch (err) {
        avisarError(err)
      }
    },
    [avisarError]
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
      reproducir: (id) => ir({ tipo: 'reproductor', id }),
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
    [ir, continuar, abrirEditarDatos, reintentarPaso, cancelarTrabajo, resepararPistas]
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
          role="list"
          aria-label="Canciones"
          className={estilos.rejilla}
          onKeyDown={teclasRejilla}
        >
          {visibles.map((c) => (
            <div role="listitem" key={c.id} className={estilos.item}>
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
