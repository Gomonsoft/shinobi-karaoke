import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  Check,
  CircleHelp,
  Clock,
  MoveHorizontal,
  TriangleAlert,
  X,
  type LucideIcon
} from 'lucide-react'
import { corregirDesfase, evaluarEncajeConPicos } from '@shared/encaje'
import { contarLineas, type ElementoLetra, type Letra } from '@shared/letra'
import type { ResumenCancionIpc } from '@shared/ipc'
import {
  compararDuracion,
  type CandidatoLetra,
  type EncajeCandidato,
  type ResultadoBusquedaLetra
} from '@shared/letrasBusqueda'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { CampoTexto } from '../../componentes/Campos'
import { mostrarToast } from '../../componentes/gestorToasts'
import { formatearDuracion } from '../biblioteca/tarjeta'
import {
  comprobacionDe,
  detalleNoCoincide,
  esConcluyente,
  indiceDelMejor,
  motivosNoCoincide,
  textoComprobacion,
  type Comprobacion
} from './comprobacion'
import { FilaConIcono } from './FilaConIcono'
import { LP, motivoElige, type MotivoElige } from './preparacion'
import { filasDePrevia } from './modelo'
import type { ConfirmarSustituir } from './sustituir'
import { TEXTO } from './textos'
import { CC, segundosDe } from './textosComprobacion'
import { useEstadoPicos, usePicosBase } from './usePicosLetra'
import estilos from './letra.module.css'

type Fase =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; resultado: ResultadoBusquedaLetra }
  | { tipo: 'error'; codigo: string; mensaje: string }

const URL_LRCLIB = 'https://lrclib.net'
const GLIFO: Record<'linea' | 'texto', string> = { linea: '◇', texto: '▭' }

function codigoDe(err: unknown): { codigo: string; mensaje: string } {
  const o = err && typeof err === 'object' ? (err as Record<string, unknown>) : {}
  return {
    codigo: typeof o.codigo === 'string' ? o.codigo : '',
    mensaje: typeof o.mensaje === 'string' ? o.mensaje : ''
  }
}

function Duracion({ diferenciaMs }: { diferenciaMs: number }) {
  const c = compararDuracion(diferenciaMs)
  // Icono a la izquierda del texto, en la misma línea (sistema visual §5; revisión 2026-11-23, C7).
  if (c.tipo === 'igual') {
    return (
      <FilaConIcono icono={Check} className={`${estilos.duracion} ${estilos.durIgual}`}>
        {TEXTO.durIgual}
      </FilaConIcono>
    )
  }
  return (
    <FilaConIcono icono={TriangleAlert} className={`${estilos.duracion} ${estilos.durAviso}`}>
      {c.tipo === 'diferente' ? TEXTO.durDif(c.segundos, c.sentido) : TEXTO.durMuyDif}
    </FilaConIcono>
  )
}

const ICONO_COMPROBACION: Record<Comprobacion['tipo'], LucideIcon | null> = {
  ninguna: null,
  comprobando: Clock,
  pendiente: Clock,
  noDisponible: null,
  coincide: Check,
  desfasada: MoveHorizontal,
  dudosa: CircleHelp,
  noCoincide: TriangleAlert
}
const ESTILO_COMPROBACION: Record<Comprobacion['tipo'], string> = {
  ninguna: '',
  comprobando: 'compTenue',
  pendiente: 'compTenue',
  noDisponible: 'compTenue',
  coincide: 'durIgual',
  desfasada: 'compInfo',
  dudosa: 'compTenue',
  noCoincide: 'durAviso'
}

/** Línea de comprobación con icono y texto (nunca solo color). */
function LineaComprobacion({ comprobacion }: { comprobacion: Comprobacion }) {
  const texto = textoComprobacion(comprobacion, segundosDe)
  if (!texto) return null
  const icono = ICONO_COMPROBACION[comprobacion.tipo]
  return (
    <FilaConIcono
      icono={icono}
      className={`${estilos.duracion} ${estilos[ESTILO_COMPROBACION[comprobacion.tipo]]}`}
    >
      {texto}
    </FilaConIcono>
  )
}

function Opcion({
  id,
  candidato,
  comprobacion,
  seleccionado,
  actual,
  onElegir
}: {
  id: string
  candidato: CandidatoLetra
  comprobacion: Comprobacion
  seleccionado: boolean
  /** Es la letra que ya tiene la canción (`let.prep.actual`). */
  actual?: boolean
  onElegir: () => void
}) {
  const duracion = formatearDuracion(candidato.duracion_ms)
  const detalle = [candidato.album, duracion].filter(Boolean).join(' · ')
  // Los tiempos por palabra ya no se importan: «palabra» solo sirve para ordenar (ADR 0021 §5, 0149).
  const visible = candidato.sincronia === 'texto' ? 'texto' : 'linea'
  return (
    // Patrón listbox con `aria-activedescendant`: el foco real está en la lista.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
    <div
      id={id}
      role="option"
      aria-selected={seleccionado}
      className={`${estilos.opcion} ${seleccionado ? estilos.opcionActiva : ''}`}
      onClick={onElegir}
    >
      <span className={estilos.opcionTitulo}>
        {candidato.titulo} — {candidato.artista}
        {actual && <strong> · {LP.actual}</strong>}
      </span>
      {detalle && <span className={estilos.opcionDetalle}>{detalle}</span>}
      <span className={`${estilos.insignia} ${estilos[`sync_${visible}`]}`}>
        <span aria-hidden="true">{GLIFO[visible]}</span> {TEXTO.sync[visible]}
      </span>
      {!esConcluyente(comprobacion) && <Duracion diferenciaMs={candidato.diferencia_ms} />}
      <LineaComprobacion comprobacion={comprobacion} />
    </div>
  )
}

/** Veredicto del candidato seleccionado, encima de las líneas de la vista previa (spec 05). */
function BloqueComprobacion({
  comprobacion,
  motivos
}: {
  comprobacion: Comprobacion
  motivos: string[]
}) {
  const t = comprobacion.tipo
  if (t !== 'coincide' && t !== 'desfasada' && t !== 'dudosa' && t !== 'noCoincide') return null
  const icono = ICONO_COMPROBACION[t]!
  const d = t === 'desfasada' ? segundosDe(comprobacion.desfaseMs) : ''
  return (
    <section className={estilos.bloqueComp} aria-label={CC.titulo}>
      <p className={estilos.bloqueCompTitulo}>
        <FilaConIcono icono={icono}>{textoComprobacion(comprobacion, segundosDe)}</FilaConIcono>
      </p>
      {t === 'desfasada' && <p>{CC.desfaseAyuda(d, comprobacion.desfaseMs > 0)}</p>}
      {t === 'dudosa' && (
        <p>{comprobacion.limitacion ? CC.limitacion[comprobacion.limitacion] : CC.dudosaAyuda}</p>
      )}
      {t === 'noCoincide' && (
        <>
          {motivos.length > 0 && (
            <ul>
              {motivos.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          <p>{CC.noCoincideAyuda}</p>
        </>
      )}
    </section>
  )
}

interface Props {
  cancionId: string
  tituloInicial: string
  artistaInicial: string
  /** Se llama tras guardar la letra elegida. */
  onUsada: (
    resumen: ResumenCancionIpc,
    lineas: number,
    elementos: ElementoLetra[],
    correccion?: Pick<Letra, 'offset_ms' | 'desfase_corregido_ms'>
  ) => void
  /** Pide confirmar antes de sustituir una letra existente (0085). */
  confirmar?: ConfirmarSustituir
  /** "Buscar otra letra" (C): la búsqueda automática inicial ignora la caché. */
  sinCacheInicial?: boolean
  /** Pasan a la vista B / diálogo de importar (0085). Hasta entonces no hacen nada. */
  onPegar?: () => void
  onImportar?: () => void
  /** La separación de la voz terminó (para distinguir «pendiente» de «no disponible»). */
  separada?: boolean
  /** Duración de la canción, para leer los picos y evaluar el encaje. */
  duracionMs?: number
  /** Lo que la preparación desatendida ya hizo con esta canción (docs/ux/05 · Feature 5). */
  preparacion?: {
    /** La búsqueda ya dio este resultado: se muestra su banner sin repetirla. */
    previo?: 'sin_letra' | 'instrumental'
    /** La preparación está buscando ahora mismo: se espera a esa búsqueda, no se lanza otra. */
    esperando?: boolean
    /** «Elige la letra»: aviso con su motivo. */
    elige?: boolean
    /** Por qué main no eligió (`busqueda.noElige`); sin dato, «no está claro». */
    noElige?: MotivoElige | null
    /** Letra que ya tiene la canción: se marca con `let.prep.actual` y se selecciona. */
    letraActualId?: number | null
  }
}

/** Wireframe A de docs/ux/05: búsqueda en LRCLIB, resultados y vista previa. */
export function BusquedaLetra({
  cancionId,
  tituloInicial,
  artistaInicial,
  onUsada,
  confirmar,
  sinCacheInicial = false,
  onPegar,
  onImportar,
  separada = false,
  duracionMs = 0,
  preparacion
}: Props) {
  const idLista = useId()
  const [titulo, setTitulo] = useState(tituloInicial)
  const [artista, setArtista] = useState(artistaInicial)
  const [fase, setFase] = useState<Fase>({ tipo: 'cargando' })
  const [indice, setIndice] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [encajes, setEncajes] = useState<ReadonlyMap<number, EncajeCandidato | null>>(new Map())
  const [llegadaDescartada, setLlegadaDescartada] = useState(false)
  const secuencia = useRef(0)
  const refTitulo = useRef<HTMLInputElement>(null)
  const refLista = useRef<HTMLDivElement>(null)
  const refEditor = useRef<'auto' | 'manual'>('auto')
  const letraActualId = preparacion?.letraActualId ?? null

  const lanzar = useCallback(
    async (t: string, a: string, usarCache: boolean, origen: 'auto' | 'manual') => {
      const mia = ++secuencia.current
      refEditor.current = origen
      setEncajes(new Map())
      setLlegadaDescartada(false)
      setFase({ tipo: 'cargando' })
      try {
        const resultado = await window.shinobi.letras.buscar({
          cancionId,
          titulo: t.trim(),
          artista: a.trim(),
          usarCache
        })
        if (mia !== secuencia.current) return
        // La letra que ya tiene la canción llega seleccionada (spec 05 · Feature 5).
        const actual = resultado.candidatos.findIndex((c) => c.lrclib_id === letraActualId)
        setIndice(actual >= 0 ? actual : 0)
        setFase({ tipo: 'listo', resultado })
      } catch (err) {
        if (mia !== secuencia.current) return
        const { codigo, mensaje } = codigoDe(err)
        // Una búsqueda cancelada la sustituye otra más reciente: no se toca el estado.
        if (codigo === 'CANCELADO') return
        setFase({ tipo: 'error', codigo, mensaje })
      }
    },
    [cancionId, letraActualId]
  )

  // Al entrar sin letra, la búsqueda se lanza sola (con caché de la sesión), salvo que la preparación
  // ya tenga un resultado sin candidatas (se muestra su banner) o esté buscando (se espera a esa).
  useEffect(() => {
    if (preparacion?.previo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFase({
        tipo: 'error',
        codigo: preparacion.previo === 'instrumental' ? 'INSTRUMENTAL' : 'LETRA_NO_ENCONTRADA',
        mensaje: ''
      })
      return
    }
    if (preparacion?.esperando) return
    void lanzar(tituloInicial, artistaInicial, !sinCacheInicial, 'auto')
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      secuencia.current++
    }
    // Solo al montar: los campos editados se buscan con "Buscar".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancionId])

  // La preparación terminó de buscar mientras mirábamos «Buscando la letra…»: se lee su resultado.
  const esperaba = useRef(preparacion?.esperando === true)
  const esperando = preparacion?.esperando === true
  useEffect(() => {
    if (esperaba.current && !esperando && !preparacion?.previo) {
      void lanzar(tituloInicial, artistaInicial, true, 'auto')
    }
    esperaba.current = esperando
    // Solo reacciona al cambio de `esperando`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esperando])

  // Encajes llegados por `letras:encaje` (los picos terminaron después de buscar): se muestran en vivo
  // sin reordenar la lista ni mover la selección (spec 05, «La comprobación llega después»).
  const picos = useEstadoPicos(cancionId, separada)
  useEffect(
    () =>
      window.shinobi.letras.alEncaje?.((ev) => {
        if (ev.cancionId !== cancionId) return
        setEncajes(new Map(ev.encajes.map((e) => [e.lrclib_id, e.encaje])))
      }),
    [cancionId]
  )
  const base = fase.tipo === 'listo' ? fase.resultado.candidatos : null
  const candidatos = useMemo(
    () =>
      (base ?? []).map((c) =>
        encajes.has(c.lrclib_id) ? { ...c, encaje: encajes.get(c.lrclib_id) } : c
      ),
    [base, encajes]
  )
  const seleccionado: CandidatoLetra | undefined = candidatos[indice]
  const comprobaciones = candidatos.map((c) => comprobacionDe(c, picos, separada))
  const comprobacionSel = comprobaciones[indice] ?? { tipo: 'ninguna' as const }

  // Si llegan encajes y el mejor candidato no es el seleccionado, se avisa (hasta que se elige o se cierra).
  const mejor = encajes.size > 0 ? indiceDelMejor(candidatos) : -1
  const llegada = mejor >= 0 && mejor !== indice && !llegadaDescartada ? mejor : null

  // Motivos de un «no coincide»: se evalúan con los picos solo para el candidato seleccionado.
  const picosBase = usePicosBase(
    cancionId,
    duracionMs,
    comprobacionSel.tipo === 'noCoincide' && seleccionado !== undefined,
    separada
  )
  const motivos = useMemo(() => {
    if (comprobacionSel.tipo !== 'noCoincide' || !seleccionado || picosBase?.estado !== 'lista')
      return []
    const letra = { lineas: seleccionado.lineas, offset_ms: 0 }
    const r = evaluarEncajeConPicos(letra, picosBase, { duracionMs })
    return motivosNoCoincide(detalleNoCoincide(letra, r, duracionMs))
  }, [comprobacionSel.tipo, seleccionado, picosBase, duracionMs])
  const desplazamientoMs =
    comprobacionSel.tipo === 'desfasada'
      ? corregirDesfase({ offset_ms: 0 }, comprobacionSel.desfaseMs).offset_ms
      : 0

  const sinResultados = fase.tipo === 'listo' && candidatos.length === 0
  const codigoBanner =
    fase.tipo === 'error'
      ? fase.codigo
      : sinResultados
        ? fase.resultado.instrumental
          ? 'INSTRUMENTAL'
          : 'LETRA_NO_ENCONTRADA'
        : null

  // Foco: la lista si hay resultados; Título si no hay letra. En la búsqueda automática solo se
  // mueve si el usuario aún no ha puesto el foco en otro sitio.
  useEffect(() => {
    if (fase.tipo === 'cargando') return
    const activo = document.activeElement
    const libre =
      refEditor.current === 'manual' ||
      !activo ||
      activo === document.body ||
      activo.tagName === 'H1'
    if (!libre) return
    if (candidatos.length > 0) refLista.current?.focus()
    else if (codigoBanner === 'LETRA_NO_ENCONTRADA' || codigoBanner === 'INSTRUMENTAL')
      refTitulo.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase])

  const idOpcion = (i: number): string => `${idLista}-op-${i}`
  useEffect(() => {
    document.getElementById(idOpcion(indice))?.scrollIntoView?.({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, fase])

  const buscar = (): void => {
    if (titulo.trim() === '') return
    void lanzar(titulo, artista, false, 'manual')
  }

  const usar = async (): Promise<void> => {
    if (!seleccionado || guardando) return
    if (confirmar && !(await confirmar())) return
    setGuardando(true)
    try {
      const resumen = await window.shinobi.letras.guardar({
        cancionId,
        origen: 'lrclib',
        lrclib_id: seleccionado.lrclib_id,
        lineas: seleccionado.lineas,
        // Un candidato desfasado se guarda ya corregido (spec 05, «Usar esta letra»).
        ...(comprobacionSel.tipo === 'desfasada' ? { desfase_ms: comprobacionSel.desfaseMs } : {})
      })
      onUsada(
        resumen,
        contarLineas(seleccionado),
        seleccionado.lineas,
        comprobacionSel.tipo === 'desfasada'
          ? corregirDesfase({ offset_ms: 0 }, comprobacionSel.desfaseMs)
          : undefined
      )
    } catch {
      setGuardando(false)
      mostrarToast({ tipo: 'error', mensaje: TEXTO.errorGuardar })
    }
  }

  const alTeclearLista = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (candidatos.length === 0) return
    const mover = (n: number): void => {
      e.preventDefault()
      setIndice(Math.max(0, Math.min(candidatos.length - 1, n)))
    }
    if (e.key === 'ArrowDown') mover(indice + 1)
    else if (e.key === 'ArrowUp') mover(indice - 1)
    else if (e.key === 'Home') mover(0)
    else if (e.key === 'End') mover(candidatos.length - 1)
  }

  const alTeclearVista = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void usar()
    }
  }

  const cargando = fase.tipo === 'cargando'
  const textoBanner = (codigo: string): { titulo: string; cuerpo: string } | null =>
    codigo in TEXTO.error ? TEXTO.error[codigo as keyof typeof TEXTO.error] : null
  const banner = codigoBanner ? textoBanner(codigoBanner) : null
  const reintentable = codigoBanner === 'SIN_CONEXION' || codigoBanner === 'SERVICIO_NO_DISPONIBLE'
  const tipoBanner = codigoBanner === 'LETRA_NO_ENCONTRADA' ? 'info' : 'aviso'
  const filas = seleccionado ? filasDePrevia(seleccionado.lineas, desplazamientoMs) : []
  const seleccionarMejor = (): void => {
    if (llegada === null) return
    setIndice(llegada)
    window.setTimeout(() => {
      document.getElementById(idOpcion(llegada))?.scrollIntoView?.({ block: 'nearest' })
      refLista.current?.focus()
    })
  }

  return (
    // Ctrl/Cmd+Intro vale en toda la vista (spec 05, teclado).
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className={estilos.busqueda} onKeyDown={alTeclearVista}>
      <form
        className={estilos.campos}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          buscar()
        }}
      >
        <CampoTexto
          ref={refTitulo}
          type="text"
          etiqueta={TEXTO.campoTitulo}
          value={titulo}
          aria-required="true"
          onChange={(e) => setTitulo(e.target.value)}
        />
        <CampoTexto
          type="text"
          etiqueta={TEXTO.campoArtista}
          value={artista}
          onChange={(e) => setArtista(e.target.value)}
        />
        <Boton
          type="submit"
          variante="secundario"
          disabled={titulo.trim() === ''}
          cargando={cargando}
          textoCargando={TEXTO.buscandoBoton}
        >
          {TEXTO.buscar}
        </Boton>
      </form>

      {banner && (
        <AvisoEnLinea
          tipo={tipoBanner}
          accion={
            reintentable ? (
              <Boton variante="secundario" onClick={buscar}>
                {TEXTO.reintentar}
              </Boton>
            ) : undefined
          }
        >
          <strong>{banner.titulo}</strong>
          {codigoBanner === 'INSTRUMENTAL' ? '' : ' '}
          {banner.cuerpo}
        </AvisoEnLinea>
      )}
      {fase.tipo === 'error' && !banner && (
        <AvisoEnLinea tipo="aviso">
          <strong>{TEXTO.errorGenerico}</strong> {fase.mensaje}
        </AvisoEnLinea>
      )}
      {preparacion?.elige && candidatos.length > 0 && (
        <AvisoEnLinea tipo="info">
          <strong>{LP.elige}</strong>{' '}
          {LP.eligeCuerpo(
            motivoElige(preparacion?.noElige, {
              artistaVacio: artistaInicial.trim() === '',
              algunaEncaja: candidatos.some(
                (c) => c.encaje?.veredicto === 'coincide' || c.encaje?.veredicto === 'desfasada'
              ),
              limitada: candidatos.some(
                (c) => c.encaje?.veredicto === 'dudosa' && Boolean(c.encaje.limitacion)
              )
            })
          )}
        </AvisoEnLinea>
      )}
      {fase.tipo === 'listo' && candidatos.length > 0 && fase.resultado.instrumental && (
        <AvisoEnLinea tipo="aviso">
          <strong>{TEXTO.avisoInstrumentalConCandidatos.titulo}</strong>
          {TEXTO.avisoInstrumentalConCandidatos.cuerpo}
        </AvisoEnLinea>
      )}

      {cargando && (
        <div className={estilos.paneles}>
          <div>
            <p role="status" className={estilos.estadoBusqueda}>
              {TEXTO.buscando}
            </p>
            <div className={estilos.esqueletos} aria-hidden="true">
              <span className={estilos.esqueleto} />
              <span className={estilos.esqueleto} />
              <span className={estilos.esqueleto} />
            </div>
          </div>
        </div>
      )}

      {candidatos.length > 0 && (
        <div className={estilos.paneles}>
          <div>
            {llegada !== null && (
              <AvisoEnLinea
                tipo="info"
                accion={
                  <>
                    <Boton variante="secundario" onClick={seleccionarMejor}>
                      {CC.seleccionarla}
                    </Boton>
                    <BotonIcono
                      icono={X}
                      etiqueta={CC.cerrarAviso}
                      onClick={() => setLlegadaDescartada(true)}
                    />
                  </>
                }
              >
                {CC.llegada(llegada + 1)}
              </AvisoEnLinea>
            )}
            <h2 id={`${idLista}-t`} className={estilos.subtitulo}>
              {TEXTO.resultados(candidatos.length)}
            </h2>
            <div
              ref={refLista}
              role="listbox"
              tabIndex={0}
              aria-labelledby={`${idLista}-t`}
              aria-activedescendant={idOpcion(indice)}
              className={estilos.lista}
              data-foco-inicial
              onKeyDown={alTeclearLista}
            >
              {candidatos.map((c, i) => (
                <Opcion
                  key={c.lrclib_id}
                  id={idOpcion(i)}
                  candidato={c}
                  comprobacion={comprobaciones[i]!}
                  seleccionado={i === indice}
                  actual={letraActualId !== null && c.lrclib_id === letraActualId}
                  onElegir={() => setIndice(i)}
                />
              ))}
            </div>
          </div>
          <div>
            <h2 className={estilos.subtitulo}>{TEXTO.vistaPrevia}</h2>
            {/* Región desplazable: enfocable para poder recorrerla con el teclado. */}
            <div
              className={estilos.previa}
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              role="region"
              aria-label={TEXTO.vistaPrevia}
            >
              <BloqueComprobacion comprobacion={comprobacionSel} motivos={motivos} />
              <ol className={estilos.filasPrevia}>
                {filas.map((f) => (
                  <li key={f.id} className={f.pausa ? estilos.pausaPrevia : estilos.filaPrevia}>
                    {f.marca && <span className={estilos.marca}>{f.marca} </span>}
                    {f.texto}
                  </li>
                ))}
              </ol>
            </div>
            <p className={estilos.total}>
              {seleccionado && TEXTO.lineas(contarLineas(seleccionado))}
            </p>
          </div>
        </div>
      )}

      {(cargando || candidatos.length > 0) && (
        <a
          className={estilos.atribucion}
          href={URL_LRCLIB}
          onClick={(e) => {
            e.preventDefault()
            void window.shinobi.sistema.abrirEnlace(URL_LRCLIB)
          }}
        >
          {TEXTO.atribucion}
        </a>
      )}

      <div className={estilos.alternativa}>
        <span>{TEXTO.alternativa}</span>
        <Boton variante="secundario" onClick={onPegar}>
          {TEXTO.pegar}
        </Boton>
        <Boton variante="secundario" onClick={onImportar}>
          {TEXTO.importar}
        </Boton>
        <span className={estilos.espacio} />
        <Boton
          variante="primario"
          disabled={!seleccionado}
          cargando={guardando}
          textoCargando={TEXTO.usando}
          onClick={() => void usar()}
        >
          {TEXTO.usar}
        </Boton>
      </div>
    </div>
  )
}
