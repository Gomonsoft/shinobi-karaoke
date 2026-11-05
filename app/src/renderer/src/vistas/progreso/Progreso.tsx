import { useEffect, useMemo, useRef, useState } from 'react'
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
import type { ResumenCancionIpc, TrabajoIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { BarraProgreso } from '../../componentes/BarraProgreso'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { Icono } from '../../componentes/Icono'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion } from '../../navegacion/estado'
import { useTrabajosVivos } from '../../trabajos/useTrabajos'
import { detallesDeError } from '../biblioteca/errores'
import { CabeceraCancion } from '../cancion/CabeceraCancion'
import {
  anuncio,
  instantanea,
  modeloDeProgreso,
  type IconoFila,
  type Instantanea,
  type ModeloProgreso
} from './modelo'
import { dialogoCancelarCuerpo, esErrorGenerico, TEXTO, textoDeError } from './textos'
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

function FilaSubpaso({ fila }: { fila: ModeloProgreso['filas'][number] }) {
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
      </div>
    </li>
  )
}

/** Vista 04 en la Fase 2: subpasos de la fuente (descarga y preparación). La separación es de la Fase 3. */
export function Progreso({ id }: { id: string }) {
  const { ir } = useNavegacion()
  const vivos = useTrabajosVivos()
  const datos = useDatos(id)
  const raiz = useRef<HTMLElement>(null)
  const [confirmando, setConfirmando] = useState(false)
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

  // La barra no retrocede y los MB descargados se recuerdan para mostrarlos al completar.
  if (trabajo && progreso?.fase === 'descargando' && progreso.valor !== null) {
    if (piso.current?.trabajo !== trabajo.id || progreso.valor > piso.current.valor) {
      piso.current = { trabajo: trabajo.id, valor: progreso.valor }
    }
  }
  const detalle = (progreso ?? trabajo?.progreso)?.detalle
  if (detalle) bytes.current = detalle.total ?? detalle.bytes

  const otra = vivos.trabajos.find(
    (t) => t.cola === 'ligera' && t.estado === 'en_curso' && t.id !== trabajo?.id
  )
  const resumen = datos.resumen
  const fuentePaso = resumen?.pasos?.fuente
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
            piso: piso.current?.trabajo === trabajo?.id ? piso.current?.valor : undefined
          })
        : null,
    [datos, fuentePaso, trabajo, progreso, otra]
  )

  useEffect(() => {
    if (!modelo) return
    const ahora = instantanea(modelo)
    const msg = anuncio(previa.current, ahora, modelo)
    previa.current = ahora
    if (msg) setAnunciado(msg)
  }, [modelo])

  // Foco inicial al terminar de cargar (el marco ya dejó el foco en el título).
  const bloqueTipo = modelo?.bloque.tipo
  useEffect(() => {
    if (!bloqueTipo || enfocada.current) return
    enfocada.current = true
    const activo = document.activeElement
    if (activo && !(activo instanceof HTMLHeadingElement) && raiz.current?.contains(activo)) return
    raiz.current?.querySelector<HTMLElement>('[data-foco-inicial]')?.focus()
  }, [bloqueTipo])

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
  const volver = (
    <Boton variante="secundario" onClick={() => ir({ tipo: 'biblioteca' })}>
      {TEXTO.botonBiblioteca}
    </Boton>
  )

  const bloque = modelo?.bloque
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
              <FilaSubpaso key={f.id} fila={f} />
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
                  onClick={() => ir({ tipo: 'cancion', id, paso: 'letra' })}
                >
                  {TEXTO.botonLetra}
                </Boton>
                {volver}
              </div>
            </div>
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

          {modelo.cancelar && (
            <div>
              <Boton
                variante="fantasma"
                onClick={() => {
                  if (modelo.cancelar === 'cola') void cancelarDescarga()
                  else setConfirmando(true)
                }}
              >
                {TEXTO.cancelarDescarga}
              </Boton>
            </div>
          )}
        </>
      )}

      <div role="status" aria-live="polite" className={estilos.oculto}>
        {anunciado}
      </div>

      <Dialogo
        abierto={confirmando}
        titulo="¿Cancelar la descarga?"
        onCancelar={() => setConfirmando(false)}
        enfoqueInicial="[data-seguir]"
        acciones={
          <>
            <Boton data-seguir onClick={() => setConfirmando(false)}>
              {TEXTO.seguirDescargando}
            </Boton>
            <Boton
              variante="destructivo"
              onClick={() => {
                setConfirmando(false)
                void cancelarDescarga()
              }}
            >
              {TEXTO.cancelarDescarga}
            </Boton>
          </>
        }
      >
        <p>{dialogoCancelarCuerpo(titulo)}</p>
      </Dialogo>
    </section>
  )
}
