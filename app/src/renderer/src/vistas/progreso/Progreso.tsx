import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Check,
  CircleX,
  Circle,
  Pause,
  RefreshCw,
  TriangleAlert,
  type LucideIcon
} from 'lucide-react'
import type { Cancion } from '@shared/cancion'
import { contarLineas } from '@shared/letra'
import type {
  EstadoRuntimeIpc,
  EstimacionCancion,
  RequisitosRuntimeIpc,
  ResumenCancionIpc,
  TrabajoIpc
} from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { BarraProgreso } from '../../componentes/BarraProgreso'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion } from '../../navegacion/estado'
import { marcarProgresoVisto } from '../../navegacion/progresoVisto'
import { useTrabajosVivos } from '../../trabajos/useTrabajos'
import { useCuentaAtras } from '../../trabajos/useCuentaAtras'
import { detallesDeError } from '../biblioteca/errores'
import { DialogoAvisoRapido } from '../aviso-rapido/DialogoAvisoRapido'
import { CabeceraCancion } from '../cancion/CabeceraCancion'
import { Escucha } from './Escucha'
import { DialogoCancelarDescarga, DialogoCancelarSeparacion } from './DialogosCancelar'
import { DialogoReparar } from './DialogoReparar'
import { IndicadorModelo } from './IndicadorModelo'
import {
  anuncio,
  instantanea,
  modeloDeProgreso,
  type IconoFila,
  type Instantanea,
  type ModeloProgreso,
  type ModoSeparacion
} from './modelo'
import {
  esErrorGenerico,
  esErrorGenericoSeparacion,
  REPARACION_MOTOR,
  SEP,
  TEXTO,
  textoDeError,
  textoDeErrorSeparacion
} from './textos'
import estilos from './progreso.module.css'

const ICONOS: Record<IconoFila, LucideIcon> = {
  pendiente: Circle,
  curso: RefreshCw,
  completado: Check,
  error: CircleX,
  interrumpido: TriangleAlert,
  cola: Pause
}
const NOMBRE_ICONO: Record<IconoFila, string> = {
  pendiente: 'pendiente',
  curso: 'en curso',
  completado: 'completado',
  error: 'con error',
  interrumpido: 'interrumpido',
  cola: 'en cola'
}

/** `fuente.reintentar(id)` (0049); acceso opcional por si la API falsa de un test no lo trae. */
const apiFuente = () =>
  window.shinobi.fuente as { reintentar(cancionId: string): Promise<void> } | undefined

const MAX_ESPERA_CANCELACION_MS = 5000

function nombreDeTrabajo(t: TrabajoIpc, titulos: ReadonlyMap<string, string>): string {
  const paso =
    t.paso === 'separacion'
      ? TEXTO.separar
      : t.comando === 'descargar-youtube'
        ? TEXTO.descargar
        : TEXTO.preparar
  const titulo = titulos.get(t.cancionId)
  return titulo ? `«${titulo}» — ${paso}` : paso
}

interface Datos {
  estado: 'cargando' | 'listo' | 'error'
  resumen: ResumenCancionIpc | null
  cancion: Cancion | null
  titulos: Map<string, string>
}

/** Resumen vivo de la canción (con `alCambiarCancion`), su `cancion.json` y los títulos de las demás. */
function useDatos(id: string): Datos {
  const [datos, setDatos] = useState<Datos>({
    estado: 'cargando',
    resumen: null,
    cancion: null,
    titulos: new Map()
  })
  useEffect(() => {
    let activo = true
    let cargada = false
    const baja = window.shinobi.alCambiarCancion((ev) => {
      if (!activo || !cargada) return
      setDatos((d) => {
        const titulos = new Map(d.titulos)
        if (ev.eliminada) {
          titulos.delete(ev.id)
          return {
            ...d,
            titulos,
            resumen: ev.id === id ? null : d.resumen,
            estado: ev.id === id ? 'error' : d.estado
          }
        }
        titulos.set(ev.id, ev.resumen.titulo)
        return { ...d, titulos, resumen: ev.id === id ? ev.resumen : d.resumen }
      })
    })
    Promise.all([window.shinobi.biblioteca.listar(), window.shinobi.biblioteca.obtener(id)]).then(
      ([lista, cancion]) => {
        if (!activo) return
        const resumen = lista.find((c) => c.id === id) ?? null
        cargada = true
        setDatos({
          estado: resumen && cancion ? 'listo' : 'error',
          resumen,
          cancion,
          titulos: new Map(lista.map((c) => [c.id, c.titulo]))
        })
      },
      () => activo && setDatos((d) => ({ ...d, estado: 'error' }))
    )
    return () => {
      activo = false
      baja()
    }
  }, [id])
  return datos
}

/** Estado vivo del runtime (modo vigente, oferta de Rápido); tolera una API sin `runtime`. */
function useEstadoRuntime(): EstadoRuntimeIpc | null {
  const [estado, setEstado] = useState<EstadoRuntimeIpc | null>(null)
  useEffect(() => {
    const api = window.shinobi.runtime
    if (!api) return
    let activo = true
    const baja = api.alCambiar((e) => activo && setEstado(e))
    api.estado().then(
      (e) => activo && setEstado((actual) => actual ?? e),
      () => undefined
    )
    return () => {
      activo = false
      baja()
    }
  }, [])
  return estado
}

function FilaSubpaso({
  fila,
  extra
}: {
  fila: ModeloProgreso['filas'][number]
  extra?: ReactNode
}) {
  return (
    <li className={`${estilos.fila} ${estilos[`fila_${fila.icono}`]}`}>
      <span className={estilos.icono}>
        <Icono icono={ICONOS[fila.icono]} tamano={18} />
        <span className={estilos.oculto}>{NOMBRE_ICONO[fila.icono]}</span>
      </span>
      <div className={estilos.cuerpo}>
        <div className={estilos.cabeza}>
          <span className={estilos.nombre}>{fila.etiqueta}</span>
          {fila.dato && <span className={estilos.dato}>{fila.dato}</span>}
        </div>
        {fila.texto && (
          <div className={estilos.detalle}>
            <span>{fila.texto}</span>
            {fila.eta && <span className={estilos.eta}>{fila.eta}</span>}
          </div>
        )}
        {fila.barra !== null && (
          <BarraProgreso
            etiqueta={fila.etiqueta}
            grande
            indeterminada={fila.barra === 'indeterminada'}
            valor={typeof fila.barra === 'number' ? fila.barra : 0}
            textoValor={
              typeof fila.barra === 'number' && fila.eta
                ? `${fila.barra} %, ${fila.eta}`
                : undefined
            }
          />
        )}
        {extra}
      </div>
    </li>
  )
}

const mensajeToast = (err: unknown): { codigo: string; mensaje: string } => {
  const e = err as { codigo?: unknown; mensaje?: unknown; message?: unknown }
  return {
    codigo: typeof e?.codigo === 'string' ? e.codigo : 'ERROR_INTERNO',
    mensaje: typeof e?.mensaje === 'string' ? e.mensaje : String(e?.message ?? err)
  }
}

/** Vista 04: subpasos de la fuente (descarga y preparación) y de la separación (Fase 3). */
export function Progreso({ id }: { id: string }) {
  const { ir } = useNavegacion()
  const vivos = useTrabajosVivos()
  const datos = useDatos(id)
  const raiz = useRef<HTMLElement>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [confirmandoSep, setConfirmandoSep] = useState(false)
  const [trabajosAlReparar, setTrabajosAlReparar] = useState<TrabajoIpc[]>([])
  const [cancelandoParaReparar, setCancelandoParaReparar] = useState(false)
  const consultandoTrabajos = useRef(false)
  const [dialogoRapido, setDialogoRapido] = useState(false)
  const [aceptando, setAceptando] = useState<{ bytes: number; total: number | null } | null>(null)
  const [errorRapido, setErrorRapido] = useState<{ codigo: string; mensaje: string } | null>(null)
  const [requisitos, setRequisitos] = useState<RequisitosRuntimeIpc | null>(null)
  const [estimacion, setEstimacion] = useState<EstimacionCancion>(null)
  const runtime = useEstadoRuntime()
  const vistoSep = useRef<{ modo: ModoSeparacion | null; dispositivo: 'cpu' | 'cuda' | null }>({
    modo: null,
    dispositivo: null
  })
  const pisoSep = useRef<{ clave: string; valor: number } | null>(null)
  const [anunciado, setAnunciado] = useState('')
  const previa = useRef<Instantanea | null>(null)
  const piso = useRef<{ trabajo: string; valor: number } | null>(null)
  const bytes = useRef<number | null>(null)
  const enfocada = useRef(false)

  const trabajo: TrabajoIpc | undefined = useMemo(() => {
    const suyos = vivos.trabajos.filter((t) => t.cancionId === id && t.paso === 'fuente')
    return suyos.find((t) => t.estado === 'en_curso') ?? suyos[0]
  }, [vivos.trabajos, id])
  const progreso = trabajo ? (vivos.progreso[trabajo.id] ?? null) : null

  const trabajoSep: TrabajoIpc | undefined = useMemo(() => {
    const suyos = vivos.trabajos.filter((t) => t.cancionId === id && t.paso === 'separacion')
    return suyos.find((t) => t.estado === 'en_curso') ?? suyos[0]
  }, [vivos.trabajos, id])
  const progresoSep = trabajoSep ? (vivos.progreso[trabajoSep.id] ?? null) : null
  const pSep = progresoSep ?? trabajoSep?.progreso ?? null
  // La barra de la fase determinada de la separación (modelo o separando) no retrocede.
  if (trabajoSep && pSep && (pSep.fase === 'separando' || pSep.fase === 'descargando_modelo')) {
    const clave = `${trabajoSep.id}|${pSep.fase}`
    if (
      pSep.valor !== null &&
      (pisoSep.current?.clave !== clave || pSep.valor > pisoSep.current.valor)
    )
      pisoSep.current = { clave, valor: pSep.valor }
  }
  if (trabajoSep?.modo) vistoSep.current.modo = trabajoSep.modo
  if (trabajoSep?.dispositivo) vistoSep.current.dispositivo = trabajoSep.dispositivo

  // La barra no retrocede y los MB descargados se recuerdan para mostrarlos al completar.
  if (trabajo && progreso?.fase === 'descargando' && progreso.valor !== null) {
    if (piso.current?.trabajo !== trabajo.id || progreso.valor > piso.current.valor) {
      piso.current = { trabajo: trabajo.id, valor: progreso.valor }
    }
  }
  const detalle = (progreso ?? trabajo?.progreso)?.detalle
  if (detalle && 'bytes' in detalle) bytes.current = detalle.total ?? detalle.bytes
  const esperaS = useCuentaAtras(progreso ?? trabajo?.progreso, trabajo?.id)

  const otra = vivos.trabajos.find(
    (t) => t.cola === 'ligera' && t.estado === 'en_curso' && t.id !== trabajo?.id
  )
  const otraSep = vivos.trabajos.find(
    (t) => t.paso === 'separacion' && t.estado === 'en_curso' && t.id !== trabajoSep?.id
  )
  const resumen = datos.resumen
  const fuentePaso = resumen?.pasos?.fuente
  const sepPaso = resumen?.pasos?.separacion
  const modeloPistas = datos.cancion?.pistas?.modelo.perfil
  const modo: ModoSeparacion =
    aceptando !== null
      ? 'rapido'
      : (trabajoSep?.modo ??
        vistoSep.current.modo ??
        (modeloPistas === 'rapido' || modeloPistas === 'calidad' ? modeloPistas : null) ??
        runtime?.modo ??
        'calidad')
  const dispositivo: 'cpu' | 'cuda' =
    trabajoSep?.dispositivo ??
    vistoSep.current.dispositivo ??
    (runtime?.perfil === 'cuda' ? 'cuda' : 'cpu')

  // Estimación previa (0067): al abrir y cuando cambia el modelo vigente.
  const modoVigente = runtime?.modo ?? null
  useEffect(() => {
    const api = window.shinobi.separacion
    if (!api) return
    let activo = true
    api.estimar(id).then(
      (e) => activo && setEstimacion(e),
      () => undefined
    )
    return () => {
      activo = false
    }
  }, [id, modoVigente])
  const modelo = useMemo(
    () =>
      datos.estado === 'listo' && datos.cancion && fuentePaso
        ? modeloDeProgreso({
            tipoFuente: datos.cancion.fuente.tipo,
            fuente: fuentePaso,
            vivo: trabajo ? { trabajo, progreso } : null,
            tituloOtra: otra && otra.cancionId ? (datos.titulos.get(otra.cancionId) ?? null) : null,
            colaOcupada: !!otra,
            bytesFinales: bytes.current,
            piso: piso.current?.trabajo === trabajo?.id ? piso.current?.valor : undefined,
            esperaS,
            separacion: sepPaso,
            vivoSep: trabajoSep ? { trabajo: trabajoSep, progreso: progresoSep } : null,
            tituloOtraSep:
              otraSep && otraSep.cancionId ? (datos.titulos.get(otraSep.cancionId) ?? null) : null,
            estimacion: estimacion ? { min: estimacion.min, max: estimacion.max } : null,
            modo,
            ofrecerRapido: runtime?.ofrecerRapido === true,
            rapidoPendiente: runtime?.rapidoPendiente === true,
            aceptandoRapido: aceptando,
            errorRapido,
            hayLetra: contarLineas(datos.cancion.letra) > 0,
            pisoSep:
              pisoSep.current?.clave === `${trabajoSep?.id}|${pSep?.fase}`
                ? pisoSep.current.valor
                : undefined
          })
        : null,
    [
      datos,
      fuentePaso,
      sepPaso,
      trabajo,
      progreso,
      otra,
      esperaS,
      trabajoSep,
      progresoSep,
      pSep,
      otraSep,
      estimacion,
      modo,
      runtime,
      aceptando,
      errorRapido
    ]
  )

  useEffect(() => {
    if (!modelo) return
    const ahora = instantanea(modelo)
    const msg = anuncio(previa.current, ahora, modelo)
    previa.current = ahora
    if (msg) setAnunciado(msg)
  }, [modelo])

  // Foco inicial al terminar de cargar (el marco ya dejó el foco en el título).
  const bloque = modelo?.bloque
  const bloqueTipo = bloque?.tipo
  const errorMotor = bloque?.tipo === 'errorSeparacion' && bloque.codigo === 'RUNTIME_NO_DISPONIBLE'
  const motorReparado = errorMotor && runtime?.estado === 'completa'
  useEffect(() => {
    if (!bloqueTipo) return
    const activo = document.activeElement
    if (!enfocada.current) {
      enfocada.current = true
      if (activo && !(activo instanceof HTMLHeadingElement) && raiz.current?.contains(activo))
        return
    } else if (activo && activo !== document.body && raiz.current?.contains(activo)) {
      // Cambio de bloque (p. ej. tras cancelar la separación): solo se mueve el foco si se perdió.
      return
    }
    raiz.current?.querySelector<HTMLElement>('[data-foco-inicial]')?.focus()
  }, [bloqueTipo, motorReparado])

  // Tamaño de Rápido para el aviso de consentimiento: se pide cuando puede ofrecerse.
  const hayOferta = modelo?.bloque.tipo === 'errorSeparacion' && modelo.bloque.oferta === 'dialogo'
  useEffect(() => {
    if (!hayOferta) return
    let activo = true
    window.shinobi.runtime?.requisitos({ recalcularEspacio: false }).then(
      (r) => activo && setRequisitos(r),
      () => undefined
    )
    return () => {
      activo = false
    }
  }, [hayOferta])

  const titulo = resumen?.titulo ?? ''
  const cancelarDescarga = async () => {
    if (!trabajo) return
    try {
      await window.shinobi.trabajos.cancelar(trabajo.id)
    } catch (err) {
      mostrarToast({
        tipo: 'error',
        mensaje: 'No se pudo cancelar la descarga.',
        accion: {
          etiqueta: 'Copiar detalles',
          alAccionar: () => void navigator.clipboard?.writeText(detallesDeError(err))
        }
      })
    }
  }
  const avisarFallo = (mensaje: string, err: unknown) =>
    mostrarToast({
      tipo: 'error',
      mensaje,
      accion: {
        etiqueta: 'Copiar detalles',
        alAccionar: () => void navigator.clipboard?.writeText(detallesDeError(err))
      }
    })
  const abrirReparacion = async () => {
    if (consultandoTrabajos.current) return
    consultandoTrabajos.current = true
    try {
      const trabajos = (await window.shinobi.trabajos.listar()).filter(
        (t) => t.estado === 'en_curso' || t.estado === 'en_cola'
      )
      if (!raiz.current) return
      if (trabajos.length === 0) ir({ tipo: 'primer-arranque' })
      else setTrabajosAlReparar(trabajos)
    } catch (err) {
      avisarFallo('No se pudieron comprobar los trabajos pendientes.', err)
    } finally {
      consultandoTrabajos.current = false
    }
  }
  const confirmarReparacion = async () => {
    if (cancelandoParaReparar) return
    setCancelandoParaReparar(true)
    let temporizador: ReturnType<typeof setTimeout> | undefined
    try {
      const limite = new Promise<void>((resolver) => {
        temporizador = setTimeout(resolver, MAX_ESPERA_CANCELACION_MS)
      })
      await Promise.race([
        Promise.allSettled(trabajosAlReparar.map((t) => window.shinobi.trabajos.cancelar(t.id))),
        limite
      ])
    } finally {
      clearTimeout(temporizador)
    }
    if (raiz.current) ir({ tipo: 'primer-arranque' })
  }
  const cancelarSeparacion = async () => {
    if (!trabajoSep) return
    try {
      await window.shinobi.trabajos.cancelar(trabajoSep.id)
    } catch (err) {
      avisarFallo('No se pudo cancelar la separación.', err)
    }
  }
  const separar = async () => {
    try {
      setErrorRapido(null)
      await window.shinobi.separacion.separar(id)
    } catch (err) {
      avisarFallo('No se pudo volver a intentar la separación.', err)
    }
  }
  /** Consentimiento ya dado (o aceptado ahora): descarga Rápido si falta y relanza la separación. */
  const usarRapidoYSeparar = async () => {
    setDialogoRapido(false)
    setErrorRapido(null)
    setAceptando({ bytes: 0, total: null })
    const baja = window.shinobi.runtime.alProgreso((p) => {
      if (p.faseVisible === 'modelo')
        setAceptando({ bytes: p.bytes, total: p.total > 0 ? p.total : null })
    })
    try {
      await window.shinobi.runtime.aceptarYUsarRapido('separacion')
    } catch (err) {
      baja()
      setAceptando(null)
      setErrorRapido(mensajeToast(err))
      return
    }
    baja()
    setAceptando(null)
    await separar()
  }
  const reintentar = async () => {
    try {
      const api = apiFuente()
      if (!api) throw new Error('fuente.reintentar no disponible')
      await api.reintentar(id)
    } catch (err) {
      mostrarToast({
        tipo: 'error',
        mensaje: 'No se pudo volver a intentar la descarga.',
        accion: {
          etiqueta: 'Copiar detalles',
          alAccionar: () => void navigator.clipboard?.writeText(detallesDeError(err))
        }
      })
    }
  }
  const otroEnlace = () =>
    ir({
      tipo: 'anadir',
      iniciales: {
        cancionId: id,
        titulo: resumen?.titulo ?? '',
        artista: resumen?.artista ?? '',
        album: datos.cancion?.metadatos.album ?? null,
        origen: 'youtube'
      }
    })
  // Al salir hacia Letra se marca el progreso como visto: "Continuar" ya no vuelve a esta vista.
  const irAPasoLetra = (editor: boolean | undefined) => {
    if (!editor) marcarProgresoVisto(id)
    ir({ tipo: 'cancion', id, paso: editor ? 'editor' : 'letra' })
  }

  const motorPorReparar = errorMotor && !motorReparado
  const textoErrorSep =
    bloque?.tipo === 'errorSeparacion'
      ? textoDeErrorSeparacion(bloque.codigo, bloque.modo, motorReparado)
      : null
  const accionErrorSep = () => {
    if (motorPorReparar) return abrirReparacion()
    if (!errorMotor && bloque?.tipo === 'errorSeparacion' && bloque.reintentaRapido) {
      return usarRapidoYSeparar()
    }
    return separar()
  }
  const volver = (
    <Boton variante="secundario" onClick={() => ir({ tipo: 'biblioteca' })}>
      {TEXTO.botonBiblioteca}
    </Boton>
  )

  const mostrarModelo = !!trabajoSep || aceptando !== null || fuentePaso?.estado === 'completado'
  return (
    <section ref={raiz} className={estilos.vista} aria-labelledby="titulo-vista">
      <CabeceraCancion resumen={resumen} actual="progreso" />
      <h1 id="titulo-vista" className="t-titulo" tabIndex={-1}>
        {TEXTO.titulo}
      </h1>
      <p className={estilos.subtitulo}>{TEXTO.subtitulo}</p>

      {datos.estado === 'error' && (
        <>
          <AvisoEnLinea tipo="error">No se pudo abrir la canción.</AvisoEnLinea>
          <Boton data-foco-inicial onClick={() => ir({ tipo: 'biblioteca' })}>
            {TEXTO.botonBiblioteca}
          </Boton>
        </>
      )}

      {modelo && (
        <>
          <ul className={estilos.filas} aria-label="Subpasos">
            {modelo.filas.map((f) => (
              <FilaSubpaso
                key={f.id}
                fila={f}
                extra={
                  f.id === 'separar' && mostrarModelo ? (
                    <IndicadorModelo
                      modo={modo}
                      dispositivo={dispositivo}
                      alIrAjustes={() => ir({ tipo: 'ajustes' })}
                    />
                  ) : undefined
                }
              />
            ))}
          </ul>

          {bloque?.tipo === 'mientras' && (
            <div className={estilos.mientras}>
              <h2 className="t-subtitulo">{TEXTO.mientrasTitulo}</h2>
              <p>{TEXTO.mientrasCuerpo}</p>
              <div className={estilos.acciones}>
                <Boton
                  variante="primario"
                  data-foco-inicial
                  onClick={() => irAPasoLetra(bloque.editor)}
                >
                  {bloque.editor ? SEP.botonEditor : TEXTO.botonLetra}
                </Boton>
                {volver}
              </div>
            </div>
          )}

          {bloque?.tipo === 'terminado' && (
            <>
              <Escucha cancionId={id} />
              <div className={estilos.acciones}>
                <Boton
                  variante="primario"
                  data-foco-inicial
                  onClick={() => irAPasoLetra(bloque.editor)}
                >
                  {bloque.editor ? SEP.botonEditor : SEP.botonLetraFin}
                </Boton>
                {volver}
              </div>
            </>
          )}

          {bloque?.tipo === 'pendiente' && (
            <>
              <AvisoEnLinea
                tipo="info"
                accion={
                  <Boton variante="primario" data-foco-inicial onClick={() => void reintentar()}>
                    {TEXTO.descargarAhora}
                  </Boton>
                }
              >
                <strong>{TEXTO.pendienteTitulo}</strong> {TEXTO.pendienteCuerpo}
              </AvisoEnLinea>
              <div className={estilos.acciones}>{volver}</div>
            </>
          )}

          {bloque?.tipo === 'interrumpido' && (
            <>
              <AvisoEnLinea
                tipo="aviso"
                accion={
                  datos.cancion?.fuente.tipo === 'youtube' ? (
                    <Boton variante="primario" data-foco-inicial onClick={() => void reintentar()}>
                      {TEXTO.reintentar}
                    </Boton>
                  ) : undefined
                }
              >
                <strong>{TEXTO.interrumpidoTitulo}</strong> {TEXTO.interrumpidoCuerpo}
              </AvisoEnLinea>
              <div className={estilos.acciones}>{volver}</div>
            </>
          )}

          {bloque?.tipo === 'error' && (
            <>
              <AvisoEnLinea
                tipo="error"
                accion={
                  <div className={estilos.acciones}>
                    {bloque.reintentable ? (
                      <Boton
                        variante="primario"
                        data-foco-inicial
                        onClick={() => void reintentar()}
                      >
                        {TEXTO.reintentar}
                      </Boton>
                    ) : datos.cancion?.fuente.tipo === 'youtube' ? (
                      <Boton variante="primario" data-foco-inicial onClick={otroEnlace}>
                        {TEXTO.otroEnlace}
                      </Boton>
                    ) : null}
                    {esErrorGenerico(bloque.codigo) && (
                      <Boton
                        variante="fantasma"
                        onClick={() =>
                          void navigator.clipboard?.writeText(
                            detallesDeError({ codigo: bloque.codigo, mensaje: bloque.mensaje })
                          )
                        }
                      >
                        {TEXTO.copiarDetalles}
                      </Boton>
                    )}
                  </div>
                }
              >
                <strong>{textoDeError(bloque.codigo).titulo}</strong>{' '}
                {textoDeError(bloque.codigo).cuerpo}
              </AvisoEnLinea>
              <div className={estilos.acciones}>{volver}</div>
            </>
          )}

          {bloque?.tipo === 'pendienteSeparacion' && (
            <>
              <AvisoEnLinea
                tipo="info"
                accion={
                  <Boton variante="primario" data-foco-inicial onClick={() => void separar()}>
                    {SEP.separarAhora}
                  </Boton>
                }
              >
                <strong>{SEP.pendiente}</strong>
                {bloque.estimacion && ` ${bloque.estimacion}.`}
              </AvisoEnLinea>
              <div className={estilos.acciones}>{volver}</div>
            </>
          )}

          {bloque?.tipo === 'interrumpidoSeparacion' && (
            <>
              <AvisoEnLinea
                tipo="aviso"
                accion={
                  <Boton variante="primario" data-foco-inicial onClick={() => void separar()}>
                    {TEXTO.reintentar}
                  </Boton>
                }
              >
                <strong>{SEP.interrumpido}</strong> {SEP.interrumpidoCuerpo}
              </AvisoEnLinea>
              <div className={estilos.acciones}>{volver}</div>
            </>
          )}

          {bloque?.tipo === 'errorSeparacion' && textoErrorSep && (
            <>
              <AvisoEnLinea
                tipo="error"
                accion={
                  <div className={estilos.acciones}>
                    <Boton
                      variante="primario"
                      data-foco-inicial
                      onClick={() => void accionErrorSep()}
                    >
                      {motorPorReparar ? REPARACION_MOTOR.reparar : TEXTO.reintentar}
                    </Boton>
                    {bloque.oferta === 'dialogo' && (
                      <Boton variante="secundario" onClick={() => setDialogoRapido(true)}>
                        {SEP.usarRapido}
                      </Boton>
                    )}
                    {bloque.oferta === 'directa' && (
                      <Boton variante="secundario" onClick={() => void usarRapidoYSeparar()}>
                        {SEP.usarRapidoDirecto}
                      </Boton>
                    )}
                    {(motorPorReparar || esErrorGenericoSeparacion(bloque.codigo)) && (
                      <Boton
                        variante={motorPorReparar ? 'secundario' : 'fantasma'}
                        onClick={() =>
                          void navigator.clipboard?.writeText(
                            detallesDeError({ codigo: bloque.codigo, mensaje: bloque.mensaje })
                          )
                        }
                      >
                        {TEXTO.copiarDetalles}
                      </Boton>
                    )}
                  </div>
                }
              >
                <strong>{textoErrorSep.titulo}</strong> {textoErrorSep.cuerpo}
                {bloque.textoOferta && <> {SEP.ofertaRapido}</>}
              </AvisoEnLinea>
              <div className={estilos.acciones}>{volver}</div>
            </>
          )}

          {modelo.cancelar && (
            <div>
              <Boton
                variante="fantasma"
                onClick={() => {
                  if (modelo.cancelar === 'cola')
                    void (modelo.cancelarPaso === 'separacion'
                      ? cancelarSeparacion()
                      : cancelarDescarga())
                  else if (modelo.cancelarPaso === 'separacion') setConfirmandoSep(true)
                  else setConfirmando(true)
                }}
              >
                {modelo.cancelarPaso === 'separacion' ? SEP.cancelar : TEXTO.cancelarDescarga}
              </Boton>
            </div>
          )}
        </>
      )}

      <div role="status" aria-live="polite" className={estilos.oculto}>
        {anunciado}
      </div>

      <DialogoCancelarDescarga
        abierto={confirmando}
        titulo={titulo}
        alSeguir={() => setConfirmando(false)}
        alConfirmar={() => {
          setConfirmando(false)
          void cancelarDescarga()
        }}
      />
      <DialogoCancelarSeparacion
        abierto={confirmandoSep}
        alSeguir={() => setConfirmandoSep(false)}
        alConfirmar={() => {
          setConfirmandoSep(false)
          void cancelarSeparacion()
        }}
      />
      <DialogoReparar
        trabajos={trabajosAlReparar.map((t) => nombreDeTrabajo(t, datos.titulos))}
        cancelando={cancelandoParaReparar}
        alSeguir={() => {
          if (!cancelandoParaReparar) setTrabajosAlReparar([])
        }}
        alConfirmar={() => void confirmarReparacion()}
      />
      <DialogoAvisoRapido
        abierto={dialogoRapido}
        motivo={
          modelo?.bloque.tipo === 'errorSeparacion' &&
          modelo.bloque.codigo === 'MODELO_NO_DISPONIBLE'
            ? 'descarga'
            : 'memoria'
        }
        bytes={requisitos?.rapidoDescargado ? null : (requisitos?.bytesRapido ?? 0)}
        alCancelar={() => setDialogoRapido(false)}
        alAceptar={() => void usarRapidoYSeparar()}
      />
    </section>
  )
}
