import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, Clock, Pause, RefreshCw, TriangleAlert, X } from 'lucide-react'
import type { EventoProgresoIpc, TrabajoIpc } from '@shared/ipc'
import { BarraProgreso } from '../componentes/BarraProgreso'
import { Boton } from '../componentes/Boton'
import { BotonIcono } from '../componentes/BotonIcono'
import { Icono } from '../componentes/Icono'
import { mostrarToast } from '../componentes/gestorToasts'
import { useExportaciones } from '../exportacion/contexto'
import type { ExportacionVista } from '../exportacion/estado'
import { faseDeExportacion } from '../exportacion/lineas'
import { filasDelLote, resumirLote, type LoteVista } from '../exportacion/lote/modelo'
import { EXP_LOTE } from '../exportacion/lote/textos'
import { useCuentaAtras } from '../trabajos/useCuentaAtras'
import { useTandaPreparacion } from '../trabajos/useTandaPreparacion'
import { useTrabajosVivos } from '../trabajos/useTrabajos'
import { useSesion } from '../sesion/ProveedorSesion'
import { useBusquedaAutomatica } from '../vistas/anadir/AvisoBusqueda'
import { detallesDeError } from '../vistas/biblioteca/errores'
import { tituloDeTarjeta } from '../vistas/biblioteca/tarjeta'
import { useBibliotecaCompartida } from '../vistas/biblioteca/useBiblioteca'
import {
  abrirExportarPaquete,
  abrirImportarPaquete,
  marcarCancelando,
  usePaquetes,
  type SeguimientoCopia
} from '../vistas/biblioteca/paquete/almacen'
import { PAQ } from '../vistas/biblioteca/paquete/textos'
import {
  DialogoCancelarDescarga,
  DialogoCancelarSeparacion
} from '../vistas/progreso/DialogosCancelar'
import { faseDeTrabajo } from './actividad'
import { botonDeCola, esTandaDeVarias, tandaViva } from './cola'
import { useAnuncioCola } from './useAnuncioCola'
import { CabeceraCola, GruposCola } from './PanelCola'
import { useNavegacion } from './estado'
import estilos from './marco.module.css'
import { copiarDetalles } from '../soporte/detalles'

/** `act.boton`: "{n} en curso · {m} en cola", omitiendo la parte que vale 0. */
export function textoActividad(enCurso: number, enCola: number): string {
  const partes: string[] = []
  if (enCurso > 0) partes.push(`${enCurso} en curso`)
  if (enCola > 0) partes.push(`${enCola} en cola`)
  return partes.join(' · ')
}

interface FilaProps {
  trabajo: TrabajoIpc
  progreso: EventoProgresoIpc | undefined
  titulo: string
  alIr: () => void
  alCancelar: () => void
}

function FilaActividad({ trabajo, progreso, titulo, alIr, alCancelar }: FilaProps) {
  const esperaS = useCuentaAtras(progreso ?? trabajo.progreso, trabajo.id)
  const fase = faseDeTrabajo(trabajo, progreso, esperaS)
  const texto = `${titulo} — ${fase.texto}`
  return (
    <li className={estilos.fila} data-trabajo={trabajo.id}>
      <p className={estilos.filaTexto}>
        <Icono
          icono={fase.tipo === 'cola' ? Clock : RefreshCw}
          tamano={16}
          className={`${estilos.filaIcono} ${fase.tipo === 'curso' ? estilos.actividadIcono : ''}`}
        />
        <span>{texto}</span>
      </p>
      {fase.barra !== undefined ? (
        <BarraProgreso
          etiqueta={texto}
          valor={fase.barra ?? 0}
          indeterminada={fase.barra === null}
        />
      ) : (
        <span />
      )}
      <div className={estilos.filaAcciones}>
        <Boton variante="secundario" onClick={alIr}>
          Ir
        </Boton>
        <BotonIcono icono={X} etiqueta={`Cancelar «${titulo}»`} onClick={alCancelar} />
      </div>
      {fase.eta && <span className={estilos.filaEta}>{fase.eta}</span>}
    </li>
  )
}

interface FilaExportacionProps {
  exportacion: ExportacionVista
  alIr: () => void
  alCancelar: () => void
}

/** Fila de una exportación (`act.exp`): [Ir] abre el diálogo en su estado y [✕] cancela. */
function FilaExportacion({ exportacion, alIr, alCancelar }: FilaExportacionProps) {
  const fase = faseDeExportacion(exportacion)
  const titulo = exportacion.titulo
  const texto = `${titulo} — ${fase.texto}`
  return (
    <li className={estilos.fila} data-exportacion={exportacion.trabajoId}>
      <p className={estilos.filaTexto}>
        <Icono
          icono={fase.tipo === 'cola' ? Clock : RefreshCw}
          tamano={16}
          className={`${estilos.filaIcono} ${fase.tipo === 'curso' ? estilos.actividadIcono : ''}`}
        />
        <span>{texto}</span>
      </p>
      {fase.barra !== undefined ? (
        <BarraProgreso
          etiqueta={texto}
          valor={fase.barra ?? 0}
          indeterminada={fase.barra === null}
        />
      ) : (
        <span />
      )}
      <div className={estilos.filaAcciones}>
        <Boton variante="secundario" onClick={alIr}>
          Ir
        </Boton>
        <BotonIcono icono={X} etiqueta={`Cancelar «${titulo}»`} onClick={alCancelar} />
      </div>
      {fase.eta && <span className={estilos.filaEta}>{fase.eta}</span>}
    </li>
  )
}

interface FilaLoteProps {
  lote: LoteVista
  exportaciones: readonly ExportacionVista[]
  alIr: () => void
  alCancelar: () => void
}

/** Fila única de un lote de exportación (`act.exp.lote`): la barra es la del video en curso. */
function FilaLoteExportacion({ lote, exportaciones, alIr, alCancelar }: FilaLoteProps) {
  const filas = filasDelLote(lote, exportaciones)
  const r = resumirLote(filas)
  const actual = filas.find((f) => f.estado === 'enCurso')?.exportacion
  const fase = actual ? faseDeExportacion(actual) : undefined
  const texto = EXP_LOTE.actividad(r.total, r.terminadas)
  return (
    <li className={estilos.fila} data-lote={lote.loteId}>
      <p className={estilos.filaTexto}>
        <Icono
          icono={RefreshCw}
          tamano={16}
          className={`${estilos.filaIcono} ${estilos.actividadIcono}`}
        />
        <span>{texto}</span>
      </p>
      {fase?.barra !== undefined ? (
        <BarraProgreso
          etiqueta={texto}
          valor={fase.barra ?? 0}
          indeterminada={fase.barra === null}
        />
      ) : (
        <span />
      )}
      <div className={estilos.filaAcciones}>
        <Boton variante="secundario" onClick={alIr}>
          Ir
        </Boton>
        <BotonIcono icono={X} etiqueta={`Cancelar «${texto}»`} onClick={alCancelar} />
      </div>
    </li>
  )
}

interface FilaPaqueteProps {
  seguimiento: SeguimientoCopia
  alIr: () => void
}

/** Fila de un paquete o una copia en curso (`act.paq`): [Ir] reabre su diálogo y [✕] lo cancela. */
function FilaPaquete({ seguimiento: s, alIr }: FilaPaqueteProps) {
  const total = s.cancion?.total ?? s.n
  const hechas = s.cancion?.hechas ?? 0
  const texto =
    s.tipo === 'exportar'
      ? PAQ.actividad.crear(hechas, total)
      : PAQ.actividad.importar(hechas, total)
  return (
    <li className={estilos.fila} data-paquete={s.trabajoId}>
      <p className={estilos.filaTexto}>
        <Icono
          icono={RefreshCw}
          tamano={16}
          className={`${estilos.filaIcono} ${estilos.actividadIcono}`}
        />
        <span>{texto}</span>
      </p>
      <BarraProgreso etiqueta={texto} valor={Math.round(s.fraccion * 100)} />
      <div className={estilos.filaAcciones}>
        <Boton variante="secundario" onClick={alIr}>
          Ir
        </Boton>
        <BotonIcono
          icono={X}
          etiqueta={`Cancelar «${texto}»`}
          onClick={() => {
            marcarCancelando()
            void window.shinobi.copias.cancelar(s.trabajoId).catch(() => undefined)
          }}
        />
      </div>
    </li>
  )
}

/**
 * Indicador de actividad de la barra superior (docs/ux/04 §2): botón visible solo con trabajos
 * en curso o en cola que abre un panel con una fila por trabajo ([Ir] y [✕]); al terminar
 * todos, "✓ Terminado" 4 s. "Volver a Calidad" no aparece: es del runtime, no un trabajo.
 */
export function IndicadorActividad() {
  const { trabajos, progreso, terminado } = useTrabajosVivos()
  const biblioteca = useBibliotecaCompartida()
  const { ir } = useNavegacion()
  const exp = useExportaciones()
  const tanda = useTandaPreparacion()
  const { haySesion } = useSesion()
  const busquedaAutomatica = useBusquedaAutomatica()
  const cola = esTandaDeVarias(tanda) ? tanda : null
  const colaViva = tandaViva(tanda)
  const exportando = exp.exportaciones.filter((e) => e.estado !== 'terminada')
  // Las exportaciones de un lote se agrupan en una sola fila (`act.exp.lote`).
  const lotesVivos = exp.lotes.filter((l) => {
    const f = filasDelLote(l, exp.exportaciones)
    return f.length > 0 && !resumirLote(f).acabado
  })
  const enLote = (e: ExportacionVista): boolean =>
    e.loteId !== undefined && lotesVivos.some((l) => l.loteId === e.loteId)
  const { seguimiento } = usePaquetes()
  const paquete = seguimiento?.estado === 'en_curso' ? seguimiento : null
  const [abierto, setAbierto] = useState(false)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [posicion, setPosicion] = useState<{ top: number; right: number } | null>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const idPanel = useId()

  const enCurso =
    trabajos.filter((t) => t.estado === 'en_curso').length +
    exportando.filter((e) => e.estado === 'en_curso').length +
    (paquete ? 1 : 0)
  const enCola =
    trabajos.filter((t) => t.estado === 'en_cola').length +
    exportando.filter((e) => e.estado === 'en_cola').length
  const hayActivos = enCurso + enCola > 0 || colaViva
  const visible = abierto && hayActivos

  // «Ver actividad» del aviso de la Biblioteca (spec 02 · feature 7) abre el panel.
  useEffect(() => {
    const abrir = () => setAbierto(true)
    window.addEventListener('shinobi:abrir-actividad', abrir)
    return () => window.removeEventListener('shinobi:abrir-actividad', abrir)
  }, [])

  // Con todos los trabajos terminados el panel se cierra (el botón desaparece).
  useEffect(() => {
    if (!hayActivos) {
      setAbierto(false)
      setPosicion(null)
    }
  }, [hayActivos])

  useLayoutEffect(() => {
    if (!visible || !boton.current) return
    const r = boton.current.getBoundingClientRect()
    setPosicion({ top: r.bottom + 4, right: Math.max(window.innerWidth - r.right, 8) })
  }, [visible])

  const botones = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('button') ?? [])

  // Foco en el primer control cuando el panel ya está colocado.
  const colocado = posicion !== null
  useEffect(() => {
    if (visible && colocado) botones()[0]?.focus()
  }, [visible, colocado])

  // Clic fuera (salvo con un diálogo abierto): cierra sin robar el foco al elemento pulsado.
  useEffect(() => {
    if (!visible) return
    const cerrarSiFuera = (e: Event) => {
      if (document.querySelector('[aria-modal="true"]')) return
      const n = e.target
      if (n instanceof Node && (panel.current?.contains(n) || boton.current?.contains(n))) return
      setAbierto(false)
      setPosicion(null)
    }
    document.addEventListener('mousedown', cerrarSiFuera)
    return () => document.removeEventListener('mousedown', cerrarSiFuera)
  }, [visible])

  const cerrar = () => {
    setAbierto(false)
    setPosicion(null)
    boton.current?.focus()
  }

  const teclaPanel = (e: KeyboardEvent) => {
    const items = botones()
    const i = items.indexOf(document.activeElement as HTMLElement)
    let destino: number
    if (e.key === 'ArrowDown') destino = (i + 1) % items.length
    else if (e.key === 'ArrowUp') destino = (i - 1 + items.length) % items.length
    else if (e.key === 'Home') destino = 0
    else if (e.key === 'End') destino = items.length - 1
    else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cerrar()
      return
    } else return
    e.preventDefault()
    items[destino]?.focus()
  }

  const titulos = new Map(biblioteca?.canciones.map((c) => [c.id, tituloDeTarjeta(c)]))
  const anuncio = useAnuncioCola(cola, (id) => titulos.get(id) ?? 'Canción', busquedaAutomatica)
  const enCursoIds = new Set(
    trabajos.filter((t) => t.estado === 'en_curso').map((t) => t.cancionId)
  )
  const avanceEnCurso = trabajos
    .filter((t) => t.estado === 'en_curso')
    .reduce((s, t) => s + Math.min(1, Math.max(0, (progreso[t.id] ?? t.progreso)?.valor ?? 0)), 0)
  const cancelarTodo = () => {
    if (!cola) return
    for (const c of cola.canciones) {
      if (c.resultado !== null) continue
      for (const t of trabajos.filter((x) => x.cancionId === c.id)) {
        void window.shinobi.trabajos.cancelar(t.id).catch(() => undefined)
      }
      void window.shinobi.preparacion.cancelar(c.id).catch(() => undefined)
    }
  }
  const botonCola = cola && colaViva ? botonDeCola(cola) : null
  const resto = exportando.length + (paquete ? 1 : 0)
  const textoBoton = botonCola
    ? resto > 0
      ? `${botonCola.texto} · ${textoActividad(
          exportando.filter((e) => e.estado === 'en_curso').length + (paquete ? 1 : 0),
          exportando.filter((e) => e.estado === 'en_cola').length
        )}`
      : botonCola.texto
    : textoActividad(enCurso, enCola)
  const tituloDe = (t: TrabajoIpc) => titulos.get(t.cancionId) ?? 'Canción'

  const cancelar = async (t: TrabajoIpc) => {
    try {
      await window.shinobi.trabajos.cancelar(t.id)
    } catch (err) {
      mostrarToast({
        tipo: 'error',
        mensaje:
          t.paso === 'separacion'
            ? 'No se pudo cancelar la separación.'
            : 'No se pudo cancelar la descarga.',
        accion: {
          etiqueta: 'Copiar detalles',
          alAccionar: () => void copiarDetalles(detallesDeError(err))
        }
      })
    }
  }
  // En cola se retira sin diálogo; en curso (también durante la descarga del modelo o la espera
  // de un reintento) se pide confirmación con el diálogo de su paso (0045/0068).
  const pedirCancelar = (t: TrabajoIpc) => {
    if (t.estado === 'en_cola') void cancelar(t)
    else setConfirmando(t.id)
  }
  const trabajoConfirmando = trabajos.find((t) => t.id === confirmando) ?? null

  if (!hayActivos && !terminado) return null
  if (!hayActivos) {
    return (
      <div role="status" className={estilos.actividad} data-actividad>
        <Icono icono={Check} tamano={16} />
        <span>Terminado</span>
      </div>
    )
  }
  return (
    <>
      <button
        ref={boton}
        type="button"
        className={`${estilos.actividad} ${estilos.actividadBoton}`}
        data-actividad
        aria-expanded={visible}
        aria-controls={idPanel}
        onClick={() => (visible ? cerrar() : setAbierto(true))}
      >
        <Icono
          icono={
            botonCola?.estado === 'pausa'
              ? Pause
              : botonCola?.estado === 'parada'
                ? TriangleAlert
                : RefreshCw
          }
          tamano={16}
          className={botonCola && botonCola.estado !== 'curso' ? undefined : estilos.actividadIcono}
        />
        <span>{textoBoton}</span>
      </button>
      <span className={estilos.soloLector} role="status" data-anuncio-cola>
        {anuncio}
      </span>
      {visible &&
        createPortal(
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <div
            ref={panel}
            id={idPanel}
            role="region"
            aria-labelledby={`${idPanel}-t`}
            className={estilos.panel}
            style={posicion ?? { visibility: 'hidden' }}
            onKeyDown={teclaPanel}
          >
            <h2 id={`${idPanel}-t`} className={estilos.panelTitulo}>
              Actividad
            </h2>
            {cola && (
              <CabeceraCola
                tanda={cola}
                avanceEnCurso={avanceEnCurso}
                haySesion={haySesion}
                alAbrirResultado={() => {
                  cerrar()
                  ir({ tipo: 'biblioteca', abrirResultado: true })
                }}
                alReparar={() => {
                  cerrar()
                  ir({ tipo: 'primer-arranque' })
                }}
                alVerCancion={(id) => {
                  cerrar()
                  ir({ tipo: 'cancion', id, paso: 'progreso' })
                }}
                alCancelarTodo={cancelarTodo}
              />
            )}
            <ul className={estilos.panelLista}>
              {trabajos
                .filter((t) => !cola || t.estado === 'en_curso')
                .map((t) => (
                  <FilaActividad
                    key={t.id}
                    trabajo={t}
                    progreso={progreso[t.id]}
                    titulo={tituloDe(t)}
                    alIr={() => {
                      cerrar()
                      ir({ tipo: 'cancion', id: t.cancionId, paso: 'progreso' })
                    }}
                    alCancelar={() => pedirCancelar(t)}
                  />
                ))}
              {paquete && (
                <FilaPaquete
                  seguimiento={paquete}
                  alIr={() => {
                    cerrar()
                    if (paquete.tipo === 'exportar') {
                      abrirExportarPaquete(paquete.peticion ?? { tipo: 'biblioteca' })
                    } else abrirImportarPaquete()
                  }}
                />
              )}
              {lotesVivos.map((l) => (
                <FilaLoteExportacion
                  key={l.loteId}
                  lote={l}
                  exportaciones={exp.exportaciones}
                  alIr={() => {
                    cerrar()
                    exp.verLote(l.loteId)
                  }}
                  alCancelar={() => {
                    cerrar()
                    exp.verLote(l.loteId, { confirmarCancelar: true })
                  }}
                />
              ))}
              {exportando
                .filter((e) => !enLote(e))
                .map((e) => (
                  <FilaExportacion
                    key={e.trabajoId}
                    exportacion={e}
                    alIr={() => {
                      cerrar()
                      exp.abrir({ cancionId: e.cancionId, trabajoId: e.trabajoId })
                    }}
                    alCancelar={() => exp.pedirCancelar(e.trabajoId)}
                  />
                ))}
            </ul>
            {cola && (
              <GruposCola
                tanda={cola}
                enCurso={enCursoIds}
                titulos={titulos}
                trabajos={trabajos}
                busquedaAutomatica={busquedaAutomatica}
                alIr={(id) => {
                  cerrar()
                  ir({ tipo: 'cancion', id, paso: 'progreso' })
                }}
                alCancelarTrabajo={pedirCancelar}
              />
            )}
          </div>,
          document.body
        )}
      {trabajoConfirmando?.paso === 'fuente' && (
        <DialogoCancelarDescarga
          abierto
          titulo={tituloDe(trabajoConfirmando)}
          alSeguir={() => setConfirmando(null)}
          alConfirmar={() => {
            setConfirmando(null)
            void cancelar(trabajoConfirmando)
          }}
        />
      )}
      {trabajoConfirmando?.paso === 'separacion' && (
        <DialogoCancelarSeparacion
          abierto
          alSeguir={() => setConfirmando(null)}
          alConfirmar={() => {
            setConfirmando(null)
            void cancelar(trabajoConfirmando)
          }}
        />
      )}
    </>
  )
}
