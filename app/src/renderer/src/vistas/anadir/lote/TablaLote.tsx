import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as TeclaReact
} from 'react'
import { ChevronLeft, CircleAlert, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ValoresDatosIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../../componentes/AvisoEnLinea'
import { Boton } from '../../../componentes/Boton'
import { CampoTexto } from '../../../componentes/Campos'
import { Dialogo } from '../../../componentes/Dialogo'
import { Icono } from '../../../componentes/Icono'
import { Popover } from '../../../componentes/Popover'
import { useNavegacion, type Vista } from '../../../navegacion/estado'
import { copiarDetalles } from '../../../soporte/detalles'
import { DialogoAvisoYoutube } from '../../acerca/DialogoAvisoYoutube'
import { detallesDeError } from '../../biblioteca/errores'
import { formatearDuracion } from '../../biblioteca/tarjeta'
import { FilaConIcono } from '../../letra/FilaConIcono'
import { useBusquedaAutomatica } from '../AvisoBusqueda'
import { CampoCombo, type OpcionCombo } from '../CampoCombo'
import { MAX_METADATO } from '../CamposDatos'
import { TEXTO } from '../textos'
import estilos from '../anadir.module.css'
import {
  armarLote,
  comunesDe,
  esDudosa,
  lineasDeFila,
  minutosMostrados,
  resumirTabla,
  sePuedeMarcar,
  type CampoFila,
  type FilaTabla,
  type TablaLote as DatosTabla
} from './modelo'
import { formatearTamanoLote, LOTE } from './textosLote'
import { useTablaLote } from './useTablaLote'

/** Pausa mínima entre dos consultas a YouTube (ADR 0025 §5: ≥ 1,5 s entre peticiones). */
export const PAUSA_ENTRE_PETICIONES_MS = 1500

const ICONO_LINEA: Record<'aviso' | 'info' | 'error', LucideIcon> = {
  aviso: TriangleAlert,
  info: Info,
  error: CircleAlert
}

const SIN_VALORES: ValoresDatosIpc = { artistas: [], albumes: [] }

/** Artistas y álbumes de la biblioteca para el autocompletado de las celdas. */
function useOpciones(): { artistas: OpcionCombo[]; albumes: OpcionCombo[] } {
  const [v, setV] = useState<ValoresDatosIpc>(SIN_VALORES)
  useEffect(() => {
    let activo = true
    void Promise.resolve()
      .then(() => window.shinobi.biblioteca.valoresDatos())
      .then((r) => activo && setV(r))
      .catch(() => undefined)
    return () => {
      activo = false
    }
  }, [])
  return { artistas: v.artistas, albumes: v.albumes }
}

/** El valor con 500 ms de espera: los cambios del resumen se anuncian sin atropellar al lector de pantalla. */
function useRetrasado(valor: string, ms: number): string {
  const [v, setV] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return v
}

const hayCapaAbierta = (): boolean =>
  document.querySelector('[aria-modal="true"], [role="menu"], [role="dialog"]') !== null

/** Pasa el foco al mismo campo de la fila anterior o siguiente (↑ / ↓ dentro de la tabla). */
function moverEntreFilas(e: TeclaReact<HTMLInputElement>): void {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
  const celda = e.currentTarget.closest('td')
  const fila = celda?.closest('tr')
  if (!celda || !fila) return
  let vecina = (
    e.key === 'ArrowDown' ? fila.nextElementSibling : fila.previousElementSibling
  ) as HTMLTableRowElement | null
  while (vecina && !vecina.hasAttribute('data-fila')) {
    vecina = (
      e.key === 'ArrowDown' ? vecina.nextElementSibling : vecina.previousElementSibling
    ) as HTMLTableRowElement | null
  }
  const destino = vecina?.cells[celda.cellIndex]?.querySelector<HTMLInputElement>('input')
  if (!destino) return
  e.preventDefault()
  destino.focus()
  destino.select()
}

interface FilaProps {
  fila: FilaTabla
  indice: number
  comunes: { artista: string | null }
  opciones: { artistas: OpcionCombo[]; albumes: OpcionCombo[] }
  tope: boolean
  alMarcar(clave: string, marcada: boolean): void
  alEditar(clave: string, campo: CampoFila, valor: string, sesionNueva: boolean): void
}

const FilaLote = memo(function FilaLote({
  fila,
  indice,
  comunes,
  opciones,
  tope,
  alMarcar,
  alEditar
}: FilaProps) {
  const id = useId()
  const lineas = lineasDeFila(fila, comunes)
  const tituloVacio = fila.marcada && fila.titulo.trim() === ''
  const bloqueada = fila.problema !== null
  const nombre = fila.titulo.trim() || fila.nombre
  const idLinea = `${id}-linea`
  const idTope = `${id}-tope`
  const sesion = useRef<CampoFila | null>(null)
  const cambiar = (campo: CampoFila, valor: string) => {
    alEditar(fila.clave, campo, valor, sesion.current !== campo)
    sesion.current = campo
  }
  const alSalir = () => {
    sesion.current = null
  }
  const dura = formatearDuracion(fila.duracionMs) ?? '—'
  const describedby = [lineas.length > 0 || tituloVacio ? idLinea : null, tope ? idTope : null]
    .filter(Boolean)
    .join(' ')
  return (
    <>
      <tr className={estilos.filaLote} data-fila={indice} data-clave={fila.clave}>
        <td className={estilos.celdaCasilla}>
          <input
            type="checkbox"
            checked={fila.marcada}
            aria-label={LOTE.marcar(nombre)}
            aria-disabled={bloqueada || undefined}
            aria-describedby={describedby || undefined}
            onChange={(e) => {
              if (!bloqueada) alMarcar(fila.clave, e.target.checked)
            }}
          />
          {tope && (
            <span id={idTope} className={estilos.topeLote} role="status">
              {LOTE.limiteTope}
            </span>
          )}
        </td>
        <td>
          {bloqueada ? (
            <span className={estilos.soloLectura}>{fila.titulo}</span>
          ) : (
            <CampoTexto
              etiqueta={LOTE.campo(LOTE.columnas.titulo, nombre)}
              etiquetaOculta
              value={fila.titulo}
              maxLength={MAX_METADATO}
              error={tituloVacio ? TEXTO.tituloVacio : undefined}
              onChange={(e) => cambiar('titulo', e.target.value)}
              onBlur={alSalir}
              onKeyDown={moverEntreFilas}
            />
          )}
        </td>
        <td>
          {bloqueada ? (
            <span className={estilos.soloLectura}>{fila.artista || '—'}</span>
          ) : (
            <CampoCombo
              etiqueta={LOTE.campo(LOTE.columnas.artista, nombre)}
              etiquetaOculta
              abrirConFlechas={false}
              value={fila.artista}
              onChange={(v) => cambiar('artista', v)}
              opciones={opciones.artistas}
              maxLength={MAX_METADATO}
              onBlur={alSalir}
              onKeyDown={moverEntreFilas}
            />
          )}
        </td>
        <td>
          {bloqueada ? (
            <span className={estilos.soloLectura}>{fila.album || '—'}</span>
          ) : (
            <CampoCombo
              etiqueta={LOTE.campo(LOTE.columnas.album, nombre)}
              etiquetaOculta
              abrirConFlechas={false}
              value={fila.album}
              onChange={(v) => cambiar('album', v)}
              opciones={opciones.albumes}
              maxLength={MAX_METADATO}
              onBlur={alSalir}
              onKeyDown={moverEntreFilas}
            />
          )}
        </td>
        <td className={estilos.celdaDura}>{dura}</td>
      </tr>
      {(lineas.length > 0 || tituloVacio) && (
        <tr className={estilos.lineaLote}>
          <td />
          <td colSpan={4} id={idLinea}>
            {lineas.map((l) => {
              const Ic = ICONO_LINEA[l.tipo]
              return (
                <span
                  key={l.texto}
                  className={`${estilos.lineaTexto} ${estilos[`linea_${l.tipo}`]}`}
                >
                  <Icono icono={Ic} tamano={16} />
                  {l.texto}
                </span>
              )
            })}
          </td>
        </tr>
      )}
    </>
  )
})

interface ParaTodasProps {
  campo: 'artista' | 'album'
  marcadas: number
  opciones: OpcionCombo[]
  alAplicar(valor: string): void
}

/** «Artista para todas…» / «Álbum para todas…»: un campo con autocompletado y [Aplicar a las {n} marcadas]. */
function ParaTodas({ campo, marcadas, opciones, alAplicar }: ParaTodasProps) {
  const [abierto, setAbierto] = useState(false)
  const [valor, setValor] = useState('')
  const ancla = useRef<HTMLButtonElement>(null)
  const etiqueta = campo === 'artista' ? LOTE.todasArtista : LOTE.todasAlbum
  const aplicar = () => {
    alAplicar(valor.trim())
    setAbierto(false)
    ancla.current?.focus()
  }
  return (
    <>
      <Boton
        ref={ancla}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        {etiqueta}
      </Boton>
      <Popover
        abierto={abierto}
        ancla={ancla}
        alCerrar={() => setAbierto(false)}
        etiqueta={etiqueta}
      >
        <div className={estilos.popoverTodas}>
          <CampoCombo
            etiqueta={campo === 'artista' ? TEXTO.campoArtista : TEXTO.campoAlbum}
            value={valor}
            onChange={setValor}
            opciones={opciones}
            maxLength={MAX_METADATO}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                aplicar()
              }
            }}
          />
          <Boton variante="primario" disabled={marcadas === 0} onClick={aplicar}>
            {LOTE.aplicar(marcadas)}
          </Boton>
        </div>
      </Popover>
    </>
  )
}

/** Qué variante de `add.lote.demasiadas` toca (lista, archivos de una selección o carpeta enorme). */
function textoDemasiadas(t: DatosTabla): string | null {
  if (t.recortada) return LOTE.demasiadasLista
  if (!t.truncada) return null
  return t.fuente === 'carpeta' && t.filas.length < 500
    ? LOTE.demasiadasCarpeta
    : LOTE.demasiadasArchivos
}

function textoOrigen(t: DatosTabla): string {
  const n = t.filas.length
  if (t.fuente === 'lista' && t.nombreOrigen) return LOTE.origenLista(t.nombreOrigen, n)
  if (t.fuente === 'carpeta' && t.nombreOrigen) return LOTE.origenCarpeta(t.nombreOrigen, n)
  if (t.fuente === 'enlaces') return LOTE.origenEnlaces(n)
  return LOTE.origenArchivos(n)
}

interface TablaLoteProps {
  inicial: DatosTabla
  /** «Cancelar» sin cambios o «Descartar»: vuelve a la Biblioteca. */
  aceptadoYoutube: string | null
}

/** L2 · Tabla de revisión del lote (docs/ux/03 · 0.2.2 · Feature 7). */
export function TablaLote({ inicial, aceptadoYoutube }: TablaLoteProps) {
  const { ir, registrarGuardaSalida } = useNavegacion()
  const t = useTablaLote(inicial.filas)
  const opciones = useOpciones()
  const busquedaAutomatica = useBusquedaAutomatica()
  const [libreBytes, setLibreBytes] = useState(inicial.libreBytes)
  const [soloDudosas, setSoloDudosas] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<{ titulo: string; cuerpo: string; detalles?: string } | null>(
    null
  )
  const [sinEspacioMain, setSinEspacioMain] = useState<number | null>(null)
  const [descartando, setDescartando] = useState(false)
  const [leyendoAviso, setLeyendoAviso] = useState(false)
  const refTitulo = useRef<HTMLHeadingElement>(null)
  const salir = useRef<{ decidir: (v: boolean) => void } | null>(null)
  const libre = useRef(false)

  const comunes = useMemo(() => comunesDe(t.filas), [t.filas])
  const resumen = useMemo(
    () => resumirTabla(t.filas, libreBytes, inicial.factorMinutos),
    [t.filas, libreBytes, inicial.factorMinutos]
  )
  const dudosas = useMemo(
    () => t.filas.filter((f) => esDudosa(f, comunes)).length,
    [t.filas, comunes]
  )
  const visibles = useMemo(
    () => (soloDudosas ? t.filas.filter((f) => esDudosa(f, comunes)) : t.filas),
    [soloDudosas, t.filas, comunes]
  )
  const sinEspacio = resumen.sinEspacio || sinEspacioMain !== null
  const caben = resumen.sinEspacio ? resumen.caben : sinEspacioMain
  const bloqueado = resumen.marcadas === 0 || resumen.tituloVacio || sinEspacio || enviando
  const marcables = t.filas.filter(sePuedeMarcar)
  const marcadasN = marcables.filter((f) => f.marcada).length

  // Foco inicial: el título de la tabla (se lee con el recuento).
  useEffect(() => {
    refTitulo.current?.focus()
  }, [])

  // Espacio libre: al marcar, al desmarcar y al volver a la ventana.
  const refrescarEspacio = useCallback(() => {
    void Promise.resolve()
      .then(() => window.shinobi.fuente.espacioLibre())
      .then((r) => {
        setLibreBytes(r.libreBytes)
        setSinEspacioMain(null)
      })
      .catch(() => undefined)
  }, [])
  const huella = t.filas.reduce((s, f) => s + (f.marcada ? 1 : 0), 0)
  useEffect(() => {
    refrescarEspacio()
  }, [huella, refrescarEspacio])
  useEffect(() => {
    window.addEventListener('focus', refrescarEspacio)
    return () => window.removeEventListener('focus', refrescarEspacio)
  }, [refrescarEspacio])

  // Salir de la tabla cancela una consulta de YouTube que siguiera en curso.
  useEffect(
    () => () => {
      void Promise.resolve(window.shinobi.fuente.cancelarInfo()).catch(() => undefined)
    },
    []
  )

  // Salir (‹ Biblioteca, otra vista): con cambios pide confirmación.
  useEffect(() => {
    if (!registrarGuardaSalida) return
    return registrarGuardaSalida(
      (destino: Vista) =>
        new Promise<boolean>((resolver) => {
          void destino
          if (libre.current || !t.editado) {
            resolver(true)
            return
          }
          salir.current = { decidir: resolver }
          setDescartando(true)
        })
    )
  }, [registrarGuardaSalida, t.editado])

  const cancelar = () => ir({ tipo: 'biblioteca' })

  const anadir = async () => {
    if (bloqueado) return
    setError(null)
    setEnviando(true)
    void Promise.resolve(window.shinobi.fuente.cancelarInfo()).catch(() => undefined)
    try {
      const r = await window.shinobi.fuente.lote(armarLote(t.filas))
      const primera = r.creadas[0]?.id
      if (r.omitidas.length > 0) {
        setError({
          titulo: LOTE.errorGenericoTitulo(r.omitidas.length),
          cuerpo: LOTE.errorGenericoCuerpo,
          detalles: r.omitidas.map((o) => `fila ${o.fila}: ${o.motivo}`).join('\n')
        })
        if (r.creadas.length === 0) {
          setEnviando(false)
          return
        }
      }
      libre.current = true
      ir({
        tipo: 'biblioteca',
        ...(primera ? { enfocar: { id: primera, resaltar: false } } : {}),
        lote: { n: r.creadas.length, conLetra: busquedaAutomatica }
      })
    } catch (e) {
      const err = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>
      if (err.codigo === 'SIN_ESPACIO') {
        let k = 0
        try {
          const d = JSON.parse(typeof err.detalles === 'string' ? err.detalles : '{}') as {
            caben?: number
          }
          k = typeof d.caben === 'number' ? d.caben : 0
        } catch {
          k = 0
        }
        setSinEspacioMain(k)
      } else {
        setError({
          titulo: 'Algo salió mal.',
          cuerpo: 'Vuelve a intentarlo.',
          detalles: detallesDeError(e)
        })
      }
      setEnviando(false)
    }
  }

  // Esc cierra lo abierto y, si no hay, cancela; Ctrl/Cmd + Intro = primario; Ctrl/Cmd + Z deshace.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const cmd = e.ctrlKey || e.metaKey
      if (cmd && e.key === 'Enter') {
        e.preventDefault()
        void anadir()
        return
      }
      if (cmd && !e.shiftKey && e.key.toLowerCase() === 'z' && t.puedeDeshacer) {
        const enTabla = e.target instanceof Element && e.target.closest('[data-tabla-lote]')
        if (enTabla) {
          e.preventDefault()
          t.deshacer()
        }
        return
      }
      if (e.key !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if (hayCapaAbierta()) return
      const campo = e.target instanceof Element ? e.target.closest('input') : null
      if (campo?.getAttribute('aria-expanded') === 'true') return
      e.preventDefault()
      cancelar()
    }
    window.addEventListener('keydown', alTeclear, true)
    return () => window.removeEventListener('keydown', alTeclear, true)
  })

  const cabecera = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (cabecera.current) {
      cabecera.current.indeterminate = marcadasN > 0 && marcadasN < marcables.length
    }
  }, [marcadasN, marcables.length])

  const textoResumen =
    resumen.marcadas === 0
      ? LOTE.nada
      : LOTE.resumen(
          resumen.marcadas,
          formatearTamanoLote(resumen.bytes),
          resumen.tiempo ? minutosMostrados(resumen.tiempo.minutos) : null,
          resumen.tiempo
            ? !resumen.tiempo.conocida
            : resumen.tiempo === null && t.filas.some((f) => f.marcada && f.duracionMs === null)
        )
  const anunciado = useRetrasado(
    sinEspacio ? `${LOTE.sinEspacioTitulo} ${LOTE.sinEspacioCuerpo(caben ?? 0)}` : textoResumen,
    500
  )
  const demasiadas = textoDemasiadas(inicial)
  const hayLimite = t.filas.some((f) => f.fueraLimite)

  return (
    <section className={estilos.vistaLote} aria-labelledby="titulo-lote" data-panel-anadir>
      <div className={estilos.cabeceraLote}>
        <Boton variante="fantasma" onClick={cancelar}>
          <Icono icono={ChevronLeft} tamano={16} />
          Biblioteca
        </Boton>
        <span className={estilos.ayuda}>{LOTE.cabecera}</span>
      </div>
      <div className={estilos.encabezadoLote}>
        <h1 id="titulo-lote" ref={refTitulo} className="t-titulo" tabIndex={-1}>
          {LOTE.titulo(resumen.marcadas)}
        </h1>
        <p className={estilos.ayuda}>{textoOrigen(inicial)}</p>
      </div>

      <div className={estilos.avisosLote}>
        {comunes.album || comunes.artista ? (
          <AvisoEnLinea tipo="info">{LOTE.comunes(comunes.album, comunes.artista)}</AvisoEnLinea>
        ) : null}
        {demasiadas && <AvisoEnLinea tipo="info">{demasiadas}</AvisoEnLinea>}
        {hayLimite && <AvisoEnLinea tipo="info">{LOTE.limite}</AvisoEnLinea>}
        {inicial.ignorados > 0 && (
          <AvisoEnLinea tipo="info">{LOTE.ignorados(inicial.ignorados)}</AvisoEnLinea>
        )}
        {inicial.repetidas > 0 && (
          <AvisoEnLinea tipo="info">{LOTE.repetidas(inicial.repetidas)}</AvisoEnLinea>
        )}
        {inicial.enlacesIgnorados > 0 && (
          <AvisoEnLinea tipo="info">{LOTE.enlacesIgnorados(inicial.enlacesIgnorados)}</AvisoEnLinea>
        )}
        {inicial.paqueteIgnorado && <AvisoEnLinea tipo="info">{LOTE.paqueteIgnorado}</AvisoEnLinea>}
      </div>

      <div className={estilos.barraLote}>
        <ParaTodas
          campo="artista"
          marcadas={resumen.marcadas}
          opciones={opciones.artistas}
          alAplicar={(v) => t.aplicarATodas('artista', v)}
        />
        <ParaTodas
          campo="album"
          marcadas={resumen.marcadas}
          opciones={opciones.albumes}
          alAplicar={(v) => t.aplicarATodas('album', v)}
        />
        {dudosas > 0 && (
          <label className={estilos.soloDudosas}>
            <input
              type="checkbox"
              checked={soloDudosas}
              onChange={(e) => setSoloDudosas(e.target.checked)}
            />
            {LOTE.soloDudosas(dudosas)}
          </label>
        )}
      </div>

      <div className={estilos.envolturaTabla} data-tabla-lote>
        <table className={estilos.tablaLote}>
          <caption className={estilos.soloLector}>{LOTE.titulo(resumen.marcadas)}</caption>
          <thead>
            <tr>
              <th scope="col" className={estilos.celdaCasilla}>
                <input
                  ref={cabecera}
                  type="checkbox"
                  checked={marcables.length > 0 && marcadasN === marcables.length}
                  aria-label={LOTE.marcarTodas}
                  onChange={(e) => t.marcarTodas(e.target.checked)}
                />
              </th>
              <th scope="col">{LOTE.columnas.titulo}</th>
              <th scope="col">{LOTE.columnas.artista}</th>
              <th scope="col">{LOTE.columnas.album}</th>
              <th scope="col" className={estilos.celdaDura}>
                {LOTE.columnas.duracion}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <FilaLote
                key={f.clave}
                fila={f}
                indice={t.filas.indexOf(f)}
                comunes={comunes}
                opciones={opciones}
                tope={t.tope === f.clave}
                alMarcar={t.marcar}
                alEditar={t.editar}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className={estilos.pieLote}>
        {sinEspacio ? (
          <AvisoEnLinea tipo="error">
            <strong>{LOTE.sinEspacioTitulo}</strong> {LOTE.sinEspacioCuerpo(caben ?? 0)}
          </AvisoEnLinea>
        ) : (
          <p className={estilos.resumenLote} data-resumen-lote>
            {textoResumen}
          </p>
        )}
        <span className={estilos.soloLector} role="status">
          {anunciado}
        </span>
        {resumen.marcadas > 0 && (
          <p className={estilos.ayuda}>
            {busquedaAutomatica ? (
              LOTE.despues
            ) : (
              <>
                {LOTE.despuesSinLetra}{' '}
                <button
                  type="button"
                  className={estilos.enlace}
                  onClick={() =>
                    ir({ tipo: 'ajustes', origen: { tipo: 'biblioteca' }, seccion: 'preparacion' })
                  }
                >
                  {LOTE.activarEnAjustes}
                </button>
              </>
            )}
          </p>
        )}
        {inicial.youtube && (
          <p className={estilos.ayuda}>
            <FilaConIcono icono={Info}>
              {LOTE.legal}{' '}
              <button
                type="button"
                className={estilos.enlace}
                onClick={() => setLeyendoAviso(true)}
              >
                {LOTE.leerAviso}
              </button>
            </FilaConIcono>
          </p>
        )}
        {error && (
          <AvisoEnLinea
            tipo="error"
            accion={
              error.detalles ? (
                <Boton
                  variante="fantasma"
                  onClick={() => void copiarDetalles(error.detalles ?? '')}
                >
                  {TEXTO.copiarDetalles}
                </Boton>
              ) : undefined
            }
          >
            <strong>{error.titulo}</strong> {error.cuerpo}
          </AvisoEnLinea>
        )}
        <div className={estilos.acciones}>
          <Boton variante="fantasma" onClick={cancelar}>
            {LOTE.cancelar}
          </Boton>
          <Boton
            variante="primario"
            disabled={bloqueado}
            cargando={enviando}
            onClick={() => void anadir()}
          >
            {enviando ? LOTE.anadiendo : LOTE.boton(resumen.marcadas, inicial.youtube)}
          </Boton>
        </div>
      </div>

      {descartando && (
        <Dialogo
          abierto
          titulo={LOTE.descartarTitulo}
          enfoqueInicial="[data-seguir]"
          onCancelar={() => {
            setDescartando(false)
            salir.current?.decidir(false)
            salir.current = null
          }}
          acciones={
            <>
              <Boton
                data-seguir
                variante="primario"
                onClick={() => {
                  setDescartando(false)
                  salir.current?.decidir(false)
                  salir.current = null
                }}
              >
                {LOTE.seguir}
              </Boton>
              <Boton
                variante="destructivo"
                onClick={() => {
                  libre.current = true
                  setDescartando(false)
                  salir.current?.decidir(true)
                  salir.current = null
                }}
              >
                {LOTE.descartar}
              </Boton>
            </>
          }
        >
          <p>{LOTE.descartarCuerpo}</p>
        </Dialogo>
      )}
      {leyendoAviso && (
        <DialogoAvisoYoutube aceptadoEn={aceptadoYoutube} alCerrar={() => setLeyendoAviso(false)} />
      )}
    </section>
  )
}
