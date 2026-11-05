import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, Clock, RefreshCw, X } from 'lucide-react'
import type { EventoProgresoIpc, TrabajoIpc } from '@shared/ipc'
import { BarraProgreso } from '../componentes/BarraProgreso'
import { Boton } from '../componentes/Boton'
import { BotonIcono } from '../componentes/BotonIcono'
import { Icono } from '../componentes/Icono'
import { mostrarToast } from '../componentes/gestorToasts'
import { useCuentaAtras } from '../trabajos/useCuentaAtras'
import { useTrabajosVivos } from '../trabajos/useTrabajos'
import { detallesDeError } from '../vistas/biblioteca/errores'
import { tituloDeTarjeta } from '../vistas/biblioteca/tarjeta'
import { useBibliotecaCompartida } from '../vistas/biblioteca/useBiblioteca'
import {
  DialogoCancelarDescarga,
  DialogoCancelarSeparacion
} from '../vistas/progreso/DialogosCancelar'
import { faseDeTrabajo } from './actividad'
import { useNavegacion } from './estado'
import estilos from './marco.module.css'

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

/**
 * Indicador de actividad de la barra superior (docs/ux/04 §2): botón visible solo con trabajos
 * en curso o en cola que abre un panel con una fila por trabajo ([Ir] y [✕]); al terminar
 * todos, "✓ Terminado" 4 s. "Volver a Calidad" no aparece: es del runtime, no un trabajo.
 */
export function IndicadorActividad() {
  const { trabajos, progreso, terminado } = useTrabajosVivos()
  const biblioteca = useBibliotecaCompartida()
  const { ir } = useNavegacion()
  const [abierto, setAbierto] = useState(false)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [posicion, setPosicion] = useState<{ top: number; right: number } | null>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const idPanel = useId()

  const enCurso = trabajos.filter((t) => t.estado === 'en_curso').length
  const enCola = trabajos.filter((t) => t.estado === 'en_cola').length
  const hayActivos = enCurso + enCola > 0
  const visible = abierto && hayActivos

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
          alAccionar: () => void navigator.clipboard?.writeText(detallesDeError(err))
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
        <Icono icono={RefreshCw} tamano={16} className={estilos.actividadIcono} />
        <span>{textoActividad(enCurso, enCola)}</span>
      </button>
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
            <ul className={estilos.panelLista}>
              {trabajos.map((t) => (
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
            </ul>
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
