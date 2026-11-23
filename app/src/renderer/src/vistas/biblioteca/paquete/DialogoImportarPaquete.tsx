import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { CircleCheck, CircleX, Equal, Minus, Plus, RotateCcw } from 'lucide-react'
import type { ResumenPaqueteIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../../componentes/AvisoEnLinea'
import { BarraProgreso } from '../../../componentes/BarraProgreso'
import { Boton } from '../../../componentes/Boton'
import { ControlSegmentado } from '../../../componentes/ControlSegmentado'
import { Dialogo } from '../../../componentes/Dialogo'
import { Icono } from '../../../componentes/Icono'
import { codigoDeError, formatearTamano } from '../../../exportacion/dialogo/textos'
import { useSesion } from '../../../sesion/ProveedorSesion'
import { BIB_COLA } from '../../../sesion/textos'
import { copiarDetalles } from '../../../soporte/detalles'
import { detallesDeError } from '../errores'
import {
  cerrarImportarPaquete,
  iniciarSeguimiento,
  marcarCancelando,
  usePaquetes,
  type PeticionImportar,
  type SeguimientoCopia
} from './almacen'
import {
  bytesAImportar,
  contarAImportar,
  contarImportadas,
  DECISIONES_INICIALES,
  decisionEfectiva,
  decisionGeneral,
  esLigero,
  estadoDe,
  fechaCorta,
  filaDeResultado,
  idsImportadas,
  paqueteMasReciente,
  porCancionParaEnviar,
  type CancionPaquete,
  type Decision,
  type Decisiones
} from './modelo'
import estilos from './paquete.module.css'
import { PAQ, AJCOPIA } from './textos'
import { useResumenes } from './useResumenes'

type Fase =
  | { tipo: 'eligiendo' }
  | { tipo: 'leyendo' }
  | { tipo: 'error'; codigo: string; detalles: string }
  | { tipo: 'revisar'; origenId: string; resumen: ResumenPaqueteIpc }

interface Props {
  peticion: PeticionImportar
  /** Se llama al cerrar el resultado con las que entraron (la Biblioteca las enfoca y las resalta). */
  alTerminar?: (importadas: string[]) => void
}

const textoLectura = (codigo: string): { titulo: string; explicacion: string } =>
  PAQ.lectura[codigo] ?? PAQ.lectura.generico!

/**
 * «Importar un paquete» y «Restaurar copia de seguridad» (docs/ux/02 y 08 · Feature 9): elegir y leer,
 * revisar, importando y resultado. Con un trabajo de importación ya en marcha (`[Ir]`, `[Ver resultado]`)
 * abre directamente en su estado.
 */
export function DialogoImportarPaquete({ peticion, alTerminar }: Props) {
  const { seguimiento } = usePaquetes()
  const s = seguimiento?.tipo === 'importar' ? seguimiento : null
  if (s) return <Seguimiento s={s} alTerminar={alTerminar} />
  return <Lectura peticion={peticion} />
}

// --- Elegir, leer y revisar -----------------------------------------------------------------------------

function Lectura({ peticion }: { peticion: PeticionImportar }) {
  const [fase, setFase] = useState<Fase>({ tipo: 'eligiendo' })
  const vivo = useRef(true)
  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
    }
  }, [])

  const leer = useCallback(async (origenId: string) => {
    setFase({ tipo: 'leyendo' })
    try {
      const resumen = await window.shinobi.copias.leer(origenId)
      if (vivo.current) setFase({ tipo: 'revisar', origenId, resumen })
    } catch (e) {
      if (vivo.current) {
        setFase({ tipo: 'error', codigo: codigoDeError(e), detalles: detallesDeError(e) })
      }
    }
  }, [])

  const elegir = useCallback(
    async (archivo?: File) => {
      try {
        const origen = archivo
          ? await window.shinobi.copias.origenDeArchivo(archivo)
          : await window.shinobi.copias.elegirOrigen()
        if (!vivo.current) return
        if (origen === null) {
          // Cancelaron el selector del sistema: no hay nada que mostrar. Un arrastre no válido sí avisa.
          if (archivo) {
            setFase({ tipo: 'error', codigo: 'PAQUETE_NO_VALIDO', detalles: 'PAQUETE_NO_VALIDO' })
          } else {
            cerrarImportarPaquete()
          }
          return
        }
        await leer(origen.origenId)
      } catch (e) {
        if (vivo.current) {
          setFase({ tipo: 'error', codigo: codigoDeError(e), detalles: detallesDeError(e) })
        }
      }
    },
    [leer]
  )

  // Se elige una sola vez al abrir (el archivo soltado o el selector del sistema).
  const iniciado = useRef(false)
  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    void elegir(peticion.archivo)
  }, [elegir, peticion.archivo])

  if (fase.tipo === 'eligiendo') return null
  if (fase.tipo === 'leyendo') {
    return (
      <Dialogo
        abierto
        titulo={PAQ.imp.titulo}
        ancho="32.5rem"
        onCancelar={cerrarImportarPaquete}
        acciones={
          <Boton variante="fantasma" onClick={cerrarImportarPaquete}>
            {PAQ.imp.cancelar}
          </Boton>
        }
      >
        <div className={estilos.cuerpo}>
          <p role="status">{PAQ.imp.leyendo}</p>
          <BarraProgreso etiqueta={PAQ.imp.leyendo} indeterminada />
        </div>
      </Dialogo>
    )
  }
  if (fase.tipo === 'error') {
    const t = textoLectura(fase.codigo)
    return (
      <Dialogo
        abierto
        titulo={PAQ.imp.titulo}
        ancho="32.5rem"
        onCancelar={cerrarImportarPaquete}
        acciones={
          <>
            <Boton variante="fantasma" onClick={cerrarImportarPaquete}>
              {PAQ.imp.cerrar}
            </Boton>
            <Boton
              variante="primario"
              onClick={() => {
                setFase({ tipo: 'eligiendo' })
                void elegir()
              }}
            >
              {PAQ.imp.otroArchivo}
            </Boton>
          </>
        }
      >
        <div className={estilos.cuerpo}>
          <AvisoEnLinea
            tipo="error"
            accion={
              <Boton variante="fantasma" onClick={() => void copiarDetalles(fase.detalles)}>
                {PAQ.imp.copiar}
              </Boton>
            }
          >
            <strong>{t.titulo}</strong> {t.explicacion}
          </AvisoEnLinea>
        </div>
      </Dialogo>
    )
  }
  return <Revisar origenId={fase.origenId} resumen={fase.resumen} />
}

const ICONO_ESTADO = { nueva: Plus, existe: RotateCcw, igual: Equal } as const
const OPCIONES: { valor: Decision; etiqueta: string }[] = [
  { valor: 'omitir', etiqueta: PAQ.imp.omitir },
  { valor: 'sustituir', etiqueta: PAQ.imp.sustituir },
  { valor: 'conservar_ambas', etiqueta: PAQ.imp.conservar }
]

function Revisar({ origenId, resumen }: { origenId: string; resumen: ResumenPaqueteIpc }) {
  const esCopia = resumen.tipo === 'copia'
  const ligero = esLigero(resumen)
  const sesion = useSesion()
  const resumenes = useResumenes()
  const [decisiones, setDecisiones] = useState<Decisiones>(DECISIONES_INICIALES)
  // «Restaurar también mis ajustes»: marcada en un equipo nuevo (biblioteca vacía), desmarcada si ya hay canciones.
  const [ajustes, setAjustes] = useState<boolean | null>(null)
  const restaurarAjustes = ajustes ?? (resumenes !== null && resumenes.length === 0)
  const [verTemas, setVerTemas] = useState(false)
  const [verAsignaciones, setVerAsignaciones] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorImportar, setErrorImportar] = useState<unknown>(null)
  const idTemas = useId()
  const idAsignaciones = useId()
  const idAjustes = useId()

  const activa = sesion.haySesion ? sesion.estado?.activa?.cancionId : undefined
  const bloqueadas = useMemo<ReadonlySet<string>>(() => new Set(activa ? [activa] : []), [activa])
  const canciones = resumen.canciones
  const hayExistentes = canciones.some((c) => estadoDe(c) === 'existe')
  const general = decisionGeneral(canciones, decisiones, bloqueadas)
  const n = contarAImportar(canciones, decisiones, bloqueadas)
  const bytes = bytesAImportar(canciones, decisiones, bloqueadas)
  const libre = resumen.libreBytes ?? null
  const noCabe = libre !== null && bytes > libre

  const temasNuevos = resumen.temas.filter((t) => t.existe === 'no').length
  const temasIguales = resumen.temas.filter((t) => t.existe === 'igual').length
  const temasCopia = resumen.temas.filter((t) => t.existe === 'distinto').length

  const importar = async () => {
    if (enviando || n === 0) return
    setEnviando(true)
    setErrorImportar(null)
    try {
      const porCancion = porCancionParaEnviar(canciones, decisiones)
      const { trabajoId } = await window.shinobi.copias.importar({
        origenId,
        conflictos: decisiones.general,
        ...(Object.keys(porCancion).length > 0 ? { porCancion } : {}),
        ajustes: esCopia && Boolean(resumen.ajustes) && restaurarAjustes
      })
      iniciarSeguimiento({
        tipo: 'importar',
        trabajoId,
        completo: resumen.conAudio,
        esCopia,
        n,
        peticion: null,
        titulos: Object.fromEntries(
          canciones.map((c) => [c.id, { titulo: c.titulo, artista: c.artista }])
        )
      })
    } catch (e) {
      setEnviando(false)
      setErrorImportar(e)
    }
  }

  const titulo = esCopia ? PAQ.imp.tituloCopia : PAQ.imp.titulo
  const fecha = fechaCorta(resumen.creado)
  return (
    <Dialogo
      abierto
      titulo={titulo}
      ancho="36rem"
      onCancelar={cerrarImportarPaquete}
      enfoqueInicial="[data-decision], [data-importar]"
      acciones={
        <>
          <Boton variante="fantasma" onClick={cerrarImportarPaquete}>
            {PAQ.imp.cancelar}
          </Boton>
          <Boton
            variante="primario"
            onClick={() => void importar()}
            data-importar
            cargando={enviando}
            textoCargando="Importando…"
            noDisponible={
              n === 0
                ? PAQ.imp.nada
                : noCabe
                  ? PAQ.imp.espacioNoCabe(formatearTamano(bytes), formatearTamano(libre ?? 0))
                  : undefined
            }
          >
            {PAQ.imp.boton(n, esCopia)}
          </Boton>
        </>
      }
    >
      <div className={estilos.cuerpo}>
        <div className={estilos.fila}>
          {resumen.nombre && <strong>{resumen.nombre}</strong>}
          <p className={estilos.suave} role="status">
            {PAQ.imp.resumen(
              fecha,
              resumen.app ?? null,
              resumen.conAudio,
              canciones.length,
              resumen.temas.length,
              resumen.bytes !== undefined ? formatearTamano(resumen.bytes) : null
            )}
          </p>
        </div>

        <ul className={estilos.lista} aria-label={PAQ.imp.titulo}>
          {canciones.map((c) => (
            <FilaRevision
              key={c.id}
              c={c}
              ligero={ligero}
              decision={decisionEfectiva(c, decisiones, bloqueadas)}
              bloqueada={bloqueadas.has(c.id)}
              alCambiar={(d) =>
                setDecisiones((x) => ({ ...x, porCancion: { ...x.porCancion, [c.id]: d } }))
              }
            />
          ))}
        </ul>

        {hayExistentes && (
          <div className={estilos.dispersa}>
            {/* Etiqueta visible a la izquierda; el grupo ya lleva el mismo nombre accesible. */}
            <span className={estilos.suave} aria-hidden="true">
              {PAQ.imp.paraExistentes}
            </span>
            <ControlSegmentado
              etiqueta={PAQ.imp.paraExistentes}
              opciones={[
                ...OPCIONES,
                ...(general === 'mixto'
                  ? [
                      {
                        valor: 'mixto' as const,
                        etiqueta: PAQ.imp.mixto,
                        noDisponible: PAQ.imp.mixto
                      }
                    ]
                  : [])
              ]}
              valor={general}
              onCambio={(v) => {
                if (v === 'mixto') return
                // Fija la respuesta de todas las «Ya la tienes» y borra las de cada fila.
                setDecisiones({ general: v, porCancion: {} })
              }}
            />
          </div>
        )}

        {resumen.temasSoloLectura ? (
          <AvisoEnLinea tipo="info">{PAQ.imp.temasSoloLectura}</AvisoEnLinea>
        ) : (
          resumen.temas.length > 0 && (
            <div className={estilos.fila}>
              <p>
                {PAQ.imp.temas(temasNuevos, temasIguales, temasCopia)}{' '}
                <Boton
                  variante="fantasma"
                  aria-expanded={verTemas}
                  aria-controls={idTemas}
                  onClick={() => setVerTemas((v) => !v)}
                >
                  {PAQ.imp.verTemas}
                </Boton>
              </p>
              {verTemas && (
                <ul id={idTemas} className={estilos.titulosTemas}>
                  {resumen.temas.map((t) => (
                    <li key={t.id}>
                      {t.existe === 'distinto' ? `${t.nombre} (importado)` : t.nombre}
                      {t.existe === 'igual' ? ' · ya lo tienes' : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        )}

        {esCopia && (
          <>
            <p className={estilos.nota}>{AJCOPIA.restNoBorra}</p>
            {resumen.asignaciones && (
              <div className={estilos.fila}>
                {resumen.asignaciones.predeterminado === 'no_aplica' && (
                  <p className={estilos.nota}>{AJCOPIA.restAsignacionesPredeterminado}</p>
                )}
                {(resumen.asignaciones.aplicables > 0 ||
                  resumen.asignaciones.noAplicables.length > 0) && (
                  <p>
                    {AJCOPIA.restAsignaciones(
                      resumen.asignaciones.aplicables,
                      resumen.asignaciones.noAplicables.length
                    )}{' '}
                    {resumen.asignaciones.noAplicables.length > 0 && (
                      <Boton
                        variante="fantasma"
                        aria-expanded={verAsignaciones}
                        aria-controls={idAsignaciones}
                        onClick={() => setVerAsignaciones((v) => !v)}
                      >
                        {AJCOPIA.verCuales}
                      </Boton>
                    )}
                  </p>
                )}
                {verAsignaciones && (
                  <ul id={idAsignaciones} className={estilos.titulosTemas}>
                    {resumen.asignaciones.noAplicables.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {resumen.ajustes && (
              <div className={estilos.fila}>
                <label className={estilos.casilla}>
                  <input
                    type="checkbox"
                    checked={restaurarAjustes}
                    aria-describedby={idAjustes}
                    onChange={(e) => setAjustes(e.target.checked)}
                  />
                  {AJCOPIA.restAjustes}
                </label>
                <p id={idAjustes} className={`t-pequeno ${estilos.nota}`}>
                  {AJCOPIA.restAjustesAyuda}
                </p>
              </div>
            )}
          </>
        )}

        {libre !== null && (
          <p className={noCabe ? undefined : estilos.suave} role={noCabe ? 'alert' : undefined}>
            {noCabe
              ? PAQ.imp.espacioNoCabe(formatearTamano(bytes), formatearTamano(libre))
              : PAQ.imp.espacio(formatearTamano(bytes), formatearTamano(libre))}
          </p>
        )}
        {n === 0 && <p className={estilos.suave}>{PAQ.imp.nada}</p>}
        {errorImportar !== null && (
          <AvisoEnLinea
            tipo="error"
            accion={
              <Boton
                variante="fantasma"
                onClick={() => void copiarDetalles(detallesDeError(errorImportar))}
              >
                {PAQ.imp.copiar}
              </Boton>
            }
          >
            {textoLectura(codigoDeError(errorImportar)).titulo}
          </AvisoEnLinea>
        )}
      </div>
    </Dialogo>
  )
}

function FilaRevision(p: {
  c: CancionPaquete
  ligero: boolean
  decision: Decision | null
  bloqueada: boolean
  alCambiar: (d: Decision) => void
}) {
  const { c } = p
  const estado = estadoDe(c)
  const texto =
    estado === 'nueva'
      ? PAQ.imp.estadoNueva
      : estado === 'igual'
        ? PAQ.imp.estadoIgual
        : PAQ.imp.estadoExiste(
            paqueteMasReciente(c),
            fechaCorta(c.modificada) ?? '',
            fechaCorta(c.modificadaLocal) ?? ''
          )
  const notas: string[] = []
  if (estado === 'nueva' && p.ligero) notas.push(PAQ.imp.notaLigeroNueva)
  if (estado === 'nueva' && c.parecida) notas.push(PAQ.imp.notaParecida)
  if (estado === 'existe' && p.decision === 'sustituir') {
    notas.push(p.ligero ? PAQ.imp.notaLigeroSustituir : PAQ.imp.notaSustituir)
  }
  if (estado === 'existe' && p.bloqueada) notas.push(BIB_COLA.activaBloqueada)
  const idSelector = useId()
  return (
    <li
      className={estilos.filaLista}
      aria-label={PAQ.imp.ariaFila(
        c.titulo,
        c.artista,
        texto,
        p.decision ? OPCIONES.find((o) => o.valor === p.decision)?.etiqueta : undefined
      )}
    >
      <Icono icono={ICONO_ESTADO[estado]} tamano={16} className={estilos.icono} />
      <span className={estilos.filaTexto}>
        <span className={estilos.filaTitulo}>
          {c.titulo} — {c.artista || 'Sin artista'}
        </span>
        <span className={`t-pequeno ${estilos.filaNota}`}>{texto}</span>
        {notas.map((nota) => (
          <span key={nota} className={`t-pequeno ${estilos.filaNota}`}>
            {nota}
          </span>
        ))}
      </span>
      {estado === 'existe' && (
        <select
          id={idSelector}
          data-decision
          className={estilos.selectorFila}
          aria-label={PAQ.imp.ariaDecision(c.titulo)}
          value={p.decision ?? 'omitir'}
          onChange={(e) => p.alCambiar(e.target.value as Decision)}
        >
          {OPCIONES.map((o) => (
            <option key={o.valor} value={o.valor} disabled={o.valor === 'sustituir' && p.bloqueada}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      )}
    </li>
  )
}

// --- Importando y resultado ------------------------------------------------------------------------------

function Seguimiento({
  s,
  alTerminar
}: {
  s: SeguimientoCopia
  alTerminar: Props['alTerminar'] | undefined
}) {
  const pct = Math.round(s.fraccion * 100)
  const r = s.resultadoImp
  const cerrar = () => {
    const ids = r ? idsImportadas(r) : []
    cerrarImportarPaquete()
    if (ids.length > 0) alTerminar?.(ids)
  }
  const cancelar = async () => {
    marcarCancelando()
    try {
      await window.shinobi.copias.cancelar(s.trabajoId)
    } catch {
      /* el estado final llega por `copias:cambio` */
    }
  }

  if (s.estado === 'en_curso') {
    const c = s.cancion
    return (
      <Dialogo
        abierto
        titulo={s.esCopia ? PAQ.imp.tituloCopia : PAQ.imp.titulo}
        ancho="32.5rem"
        onCancelar={cerrarImportarPaquete}
        enfoqueInicial="[data-seguir]"
        acciones={
          <>
            <Boton
              variante="fantasma"
              onClick={() => void cancelar()}
              noDisponible={s.cancelando ? 'Cancelando…' : undefined}
            >
              {PAQ.imp.cancelar}
            </Boton>
            <Boton variante="primario" data-seguir onClick={cerrarImportarPaquete}>
              {PAQ.imp.seguir}
            </Boton>
          </>
        }
      >
        <div className={estilos.cuerpo}>
          <p>{c ? PAQ.imp.progreso(c.titulo, c.hechas, c.total) : PAQ.imp.preparando}</p>
          <BarraProgreso
            etiqueta={PAQ.imp.titulo}
            valor={pct}
            indeterminada={s.fraccion === 0 && !c}
          />
          <p className={`t-pequeno ${estilos.segundoPlano}`}>{PAQ.imp.segundoPlano}</p>
        </div>
      </Dialogo>
    )
  }

  if (!r) {
    // Error o cancelada sin resultado: no hay nada que listar.
    return (
      <Dialogo
        abierto
        titulo={s.esCopia ? PAQ.imp.tituloCopia : PAQ.imp.titulo}
        ancho="32.5rem"
        onCancelar={cerrar}
        acciones={
          <Boton variante="primario" onClick={cerrar}>
            {PAQ.imp.cerrar}
          </Boton>
        }
      >
        <div className={estilos.cuerpo}>
          <AvisoEnLinea tipo={s.estado === 'cancelada' ? 'info' : 'error'}>
            {s.estado === 'cancelada' ? PAQ.imp.toastCancelada : PAQ.imp.errorGenerico}
          </AvisoEnLinea>
        </div>
      </Dialogo>
    )
  }

  const a = contarImportadas(r)
  const total = r.resultados.length
  const filas = r.resultados.map((x) => ({
    fila: filaDeResultado(x, s.titulos[x.id]?.titulo ?? x.id),
    artista: s.titulos[x.id]?.artista ?? '',
    titulo: s.titulos[x.id]?.titulo ?? x.id
  }))
  const temas = PAQ.imp.temasResultado(r.temas?.importados ?? [])
  return (
    <Dialogo
      abierto
      titulo={s.esCopia ? PAQ.imp.tituloCopia : PAQ.imp.titulo}
      ancho="36rem"
      onCancelar={cerrar}
      enfoqueInicial="[data-cerrar]"
      acciones={
        <Boton variante="primario" data-cerrar onClick={cerrar}>
          {PAQ.imp.cerrar}
        </Boton>
      }
    >
      <div className={estilos.cuerpo}>
        <p role="status">
          {total === 1 && a === 1 ? PAQ.imp.resultadoUna : PAQ.imp.resultado(a, total)}
        </p>
        <ul className={estilos.lista}>
          {filas.map(({ fila, titulo, artista }) => (
            <li
              key={fila.id}
              className={estilos.filaLista}
              aria-label={`${titulo}, ${artista}: ${fila.texto}`}
            >
              <Icono
                icono={fila.tipo === 'ok' ? CircleCheck : fila.tipo === 'omitida' ? Minus : CircleX}
                tamano={16}
                className={`${estilos.icono} ${
                  fila.tipo === 'ok'
                    ? estilos.iconoOk
                    : fila.tipo === 'error'
                      ? estilos.iconoError
                      : ''
                }`}
              />
              <span className={estilos.filaTexto}>
                <span className={estilos.filaTitulo}>
                  {titulo}
                  {artista ? ` — ${artista}` : ''}
                </span>
                <span
                  className={`t-pequeno ${estilos.filaNota}`}
                  role={fila.tipo === 'error' ? 'alert' : undefined}
                >
                  {fila.texto}
                </span>
              </span>
              {fila.tipo === 'error' && (
                <Boton
                  variante="fantasma"
                  onClick={() => void copiarDetalles(fila.detalles ?? fila.texto)}
                >
                  {PAQ.imp.copiar}
                </Boton>
              )}
            </li>
          ))}
        </ul>
        {temas && <p>{temas}</p>}
        {r.ajustes === true && <p role="status">{AJCOPIA.restAjustesAplicados}</p>}
      </div>
    </Dialogo>
  )
}
