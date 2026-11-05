import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, TriangleAlert } from 'lucide-react'
import { contarLineas, type ElementoLetra } from '@shared/letra'
import type { ResumenCancionIpc } from '@shared/ipc'
import {
  compararDuracion,
  type CandidatoLetra,
  type ResultadoBusquedaLetra,
  type Sincronia
} from '@shared/letrasBusqueda'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { CampoTexto } from '../../componentes/Campos'
import { Icono } from '../../componentes/Icono'
import { mostrarToast } from '../../componentes/gestorToasts'
import { formatearDuracion } from '../biblioteca/tarjeta'
import { filasDePrevia } from './modelo'
import type { ConfirmarSustituir } from './sustituir'
import { TEXTO } from './textos'
import estilos from './letra.module.css'

type Fase =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; resultado: ResultadoBusquedaLetra }
  | { tipo: 'error'; codigo: string; mensaje: string }

const URL_LRCLIB = 'https://lrclib.net'
const GLIFO: Record<Sincronia, string> = { palabra: '◆', linea: '◇', texto: '▭' }

function codigoDe(err: unknown): { codigo: string; mensaje: string } {
  const o = err && typeof err === 'object' ? (err as Record<string, unknown>) : {}
  return {
    codigo: typeof o.codigo === 'string' ? o.codigo : '',
    mensaje: typeof o.mensaje === 'string' ? o.mensaje : ''
  }
}

function Duracion({ diferenciaMs }: { diferenciaMs: number }) {
  const c = compararDuracion(diferenciaMs)
  if (c.tipo === 'igual') {
    return (
      <span className={`${estilos.duracion} ${estilos.durIgual}`}>
        <Icono icono={Check} tamano={14} /> {TEXTO.durIgual}
      </span>
    )
  }
  return (
    <span className={`${estilos.duracion} ${estilos.durAviso}`}>
      <Icono icono={TriangleAlert} tamano={14} />{' '}
      {c.tipo === 'diferente' ? TEXTO.durDif(c.segundos, c.sentido) : TEXTO.durMuyDif}
    </span>
  )
}

function Opcion({
  id,
  candidato,
  seleccionado,
  onElegir
}: {
  id: string
  candidato: CandidatoLetra
  seleccionado: boolean
  onElegir: () => void
}) {
  const duracion = formatearDuracion(candidato.duracion_ms)
  const detalle = [candidato.album, duracion].filter(Boolean).join(' · ')
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
      </span>
      {detalle && <span className={estilos.opcionDetalle}>{detalle}</span>}
      <span className={`${estilos.insignia} ${estilos[`sync_${candidato.sincronia}`]}`}>
        <span aria-hidden="true">{GLIFO[candidato.sincronia]}</span>{' '}
        {TEXTO.sync[candidato.sincronia]}
      </span>
      <Duracion diferenciaMs={candidato.diferencia_ms} />
    </div>
  )
}

interface Props {
  cancionId: string
  tituloInicial: string
  artistaInicial: string
  /** Se llama tras guardar la letra elegida. */
  onUsada: (resumen: ResumenCancionIpc, lineas: number, elementos: ElementoLetra[]) => void
  /** Pide confirmar antes de sustituir una letra existente (0085). */
  confirmar?: ConfirmarSustituir
  /** "Buscar otra letra" (C): la búsqueda automática inicial ignora la caché. */
  sinCacheInicial?: boolean
  /** Pasan a la vista B / diálogo de importar (0085). Hasta entonces no hacen nada. */
  onPegar?: () => void
  onImportar?: () => void
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
  onImportar
}: Props) {
  const idLista = useId()
  const [titulo, setTitulo] = useState(tituloInicial)
  const [artista, setArtista] = useState(artistaInicial)
  const [fase, setFase] = useState<Fase>({ tipo: 'cargando' })
  const [indice, setIndice] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const secuencia = useRef(0)
  const refTitulo = useRef<HTMLInputElement>(null)
  const refLista = useRef<HTMLDivElement>(null)
  const refEditor = useRef<'auto' | 'manual'>('auto')

  const lanzar = useCallback(
    async (t: string, a: string, usarCache: boolean, origen: 'auto' | 'manual') => {
      const mia = ++secuencia.current
      refEditor.current = origen
      setFase({ tipo: 'cargando' })
      try {
        const resultado = await window.shinobi.letras.buscar({
          cancionId,
          titulo: t.trim(),
          artista: a.trim(),
          usarCache
        })
        if (mia !== secuencia.current) return
        setIndice(0)
        setFase({ tipo: 'listo', resultado })
      } catch (err) {
        if (mia !== secuencia.current) return
        const { codigo, mensaje } = codigoDe(err)
        // Una búsqueda cancelada la sustituye otra más reciente: no se toca el estado.
        if (codigo === 'CANCELADO') return
        setFase({ tipo: 'error', codigo, mensaje })
      }
    },
    [cancionId]
  )

  // Al entrar sin letra, la búsqueda se lanza sola (con caché de la sesión).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void lanzar(tituloInicial, artistaInicial, !sinCacheInicial, 'auto')
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      secuencia.current++
    }
    // Solo al montar: los campos editados se buscan con "Buscar".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancionId])

  const candidatos = fase.tipo === 'listo' ? fase.resultado.candidatos : []
  const seleccionado: CandidatoLetra | undefined = candidatos[indice]
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
        lineas: seleccionado.lineas
      })
      onUsada(resumen, contarLineas(seleccionado), seleccionado.lineas)
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
  const filas = seleccionado ? filasDePrevia(seleccionado.lineas) : []

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
                  seleccionado={i === indice}
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
