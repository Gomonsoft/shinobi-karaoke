import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowDown, ArrowUp, ChevronsDown, ListEnd, ListPlus, Trash2 } from 'lucide-react'
import type { EntradaIpc } from '@shared/sesion'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { mostrarToast } from '../../../componentes/gestorToasts'
import type { ItemMenu } from '../../../componentes/MenuContextual'
import { useSesion } from '../../../sesion/ProveedorSesion'
import { COLA } from '../../../sesion/textos'
import { formatearDuracion } from '../tarjeta'
import { FilaPendiente } from './FilaPendiente'
import estilos from './listaPendientes.module.css'
import {
  antesDeParaIndice,
  filaTrasQuitar,
  indiceTras,
  indiceTrasSoltar,
  type MovimientoTeclado
} from './ordenCola'
import { useArrastreCola } from './useArrastreCola'

export interface ListaPendientesProps {
  /** La candidata lleva «Siguiente» durante la cuenta y en la espera (P2 y P4), no en P1/P5/P6. */
  etiquetarSiguiente?: boolean
  /** Duración (ms) de una canción de la biblioteca; sin ella, la fila no muestra duración. */
  duracionDe?: (cancionId: string) => number | null
  /** Líneas sin sincronizar de una canción Lista incompleta (`bib.lista.incompleta`). */
  lineasSinSincronizarDe?: (cancionId: string) => number | null
}

/** Foco pendiente de resolver cuando llegue el estado nuevo, y si el foco está dentro de la lista. */
class SeguimientoFoco {
  private _pedido: string | null = null
  private _dentro = false
  /** Fila (o `'encabezado'`) que debe recibir el foco cuando llegue el estado nuevo. */
  pedido(): string | null {
    return this._pedido
  }
  pedir(id: string | null): void {
    this._pedido = id
  }
  estaDentro(): boolean {
    return this._dentro
  }
  marcarDentro(valor: boolean): void {
    this._dentro = valor
  }
}

const POR_DEFECTO: EntradaIpc[] = []
const SIN_DATOS = () => null

/**
 * Lista «A continuación ({n})» del panel de la cola (spec 02, fase 4): reordenar con ratón,
 * teclado y menú, quitar con deshacer y vaciar. Todo va por id de entrada y nunca toca la activa
 * (que no forma parte de las pendientes). El estado llega de `useSesion()`.
 */
export function ListaPendientes({
  etiquetarSiguiente = false,
  duracionDe = SIN_DATOS,
  lineasSinSincronizarDe = SIN_DATOS
}: ListaPendientesProps) {
  const { estado, haySesion, acciones } = useSesion()
  const pendientes = estado?.pendientes ?? POR_DEFECTO
  const total = pendientes.length

  const listaRef = useRef<HTMLUListElement>(null)
  const encabezadoRef = useRef<HTMLHeadingElement>(null)
  const [activaId, setActivaId] = useState<string | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const [vaciando, setVaciando] = useState(false)
  const [foco] = useState(() => new SeguimientoFoco())
  const idsPrevios = useRef<string[]>([])
  const pendientesRef = useRef(pendientes)
  useEffect(() => {
    pendientesRef.current = pendientes
  })

  const tabulableId = pendientes.some((e) => e.entradaId === activaId)
    ? activaId
    : (pendientes[0]?.entradaId ?? null)

  const enfocarFila = useCallback((id: string): boolean => {
    const fila = listaRef.current?.querySelector<HTMLElement>(`[data-entrada-id="${id}"]`)
    fila?.focus()
    return Boolean(fila)
  }, [])

  // --- Foco tras cambios (propios o de otros) -----------------------------------------------
  useEffect(() => {
    const ids = pendientes.map((e) => e.entradaId)
    const previos = idsPrevios.current
    idsPrevios.current = ids
    const pedido = foco.pedido()
    if (pedido === 'encabezado') {
      foco.pedir(null)
      encabezadoRef.current?.focus()
      return
    }
    if (pedido && ids.includes(pedido)) {
      foco.pedir(null)
      enfocarFila(pedido)
      const e = pendientes[ids.indexOf(pedido)]!
      // El anuncio depende del estado recién llegado: se emite en el mismo efecto que mueve el foco.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnuncio(COLA.anuncio.movida(e.titulo, ids.indexOf(pedido) + 1, ids.length))
      return
    }
    // La fila enfocada desapareció (la quitó esta ventana u otra): regla de «Quitar».
    const perdida = activaId && !ids.includes(activaId) && previos.includes(activaId)
    const sinFoco = !document.activeElement || document.activeElement === document.body
    if (perdida && foco.estaDentro() && sinFoco) {
      const destino = filaTrasQuitar(previos, ids, activaId)
      if (destino) enfocarFila(destino)
      else encabezadoRef.current?.focus()
    }
  }, [pendientes, activaId, enfocarFila, foco])

  // --- Operaciones ----------------------------------------------------------------------------
  const intentar = useCallback(
    (promesa: Promise<unknown>) => {
      promesa.catch(() => {
        // El estado que llega por eventos es la fuente de verdad; no hay nada que revertir.
        foco.pedir(null)
      })
    },
    [foco]
  )

  const moverAIndice = useCallback(
    (entradaId: string, indiceFinal: number) => {
      const antesDe = antesDeParaIndice(pendientes, entradaId, indiceFinal)
      foco.pedir(entradaId)
      intentar(acciones.cola.mover(entradaId, antesDe))
    },
    [acciones, intentar, pendientes, foco]
  )

  const mover = useCallback(
    (entradaId: string, movimiento: MovimientoTeclado) => {
      const lista = pendientes
      const destino = indiceTras(
        movimiento,
        lista.findIndex((e) => e.entradaId === entradaId),
        lista.length
      )
      if (destino !== null) moverAIndice(entradaId, destino)
    },
    [moverAIndice, pendientes]
  )

  const quitar = useCallback(
    (entrada: EntradaIpc) => {
      intentar(
        acciones.cola.quitar(entrada.entradaId).then((r) => {
          mostrarToast({
            tipo: 'info',
            mensaje: COLA.toast.quitada(entrada.titulo),
            accion: {
              etiqueta: COLA.toast.deshacer,
              // Con lo que devolvió `quitar`: si la cola cambió entretanto, main la pone al final.
              alAccionar: () =>
                intentar(
                  acciones.cola.agregar(entrada.cancionId, {
                    antesDe: r.antesDe,
                    siRevision: r.estado.revision
                  })
                )
            }
          })
        })
      )
    },
    [acciones, intentar]
  )

  const repetir = useCallback(
    (entrada: EntradaIpc) => {
      intentar(
        acciones.cola.agregar(entrada.cancionId, 'final').then((r) => {
          mostrarToast({
            tipo: 'info',
            mensaje: COLA.toast.final(entrada.titulo, r.estado.pendientes.length),
            accion: {
              etiqueta: COLA.toast.deshacer,
              alAccionar: () => intentar(acciones.cola.quitar(r.entradaId))
            }
          })
        })
      )
    },
    [acciones, intentar]
  )

  const arrastre = useArrastreCola({
    contenedor: listaRef,
    alSoltar: (entradaId, _indice, hueco) => {
      const indice = pendientesRef.current.findIndex((e) => e.entradaId === entradaId)
      const destino = indice === -1 ? null : indiceTrasSoltar(indice, hueco)
      if (destino !== null) moverAIndice(entradaId, destino)
    }
  })
  const arr = arrastre.arrastre

  const itemsDe = useCallback(
    (e: EntradaIpc, i: number): ItemMenu[] => {
      const primera = i === 0
      const ultima = i === total - 1
      const items: (ItemMenu | null)[] = [
        primera
          ? null
          : {
              id: 'siguiente',
              etiqueta: COLA.menu.siguiente,
              icono: ListEnd,
              alSeleccionar: () => mover(e.entradaId, 'inicio')
            },
        primera
          ? null
          : {
              id: 'subir',
              etiqueta: COLA.menu.subir,
              icono: ArrowUp,
              alSeleccionar: () => mover(e.entradaId, 'subir')
            },
        ultima
          ? null
          : {
              id: 'bajar',
              etiqueta: COLA.menu.bajar,
              icono: ArrowDown,
              alSeleccionar: () => mover(e.entradaId, 'bajar')
            },
        ultima
          ? null
          : {
              id: 'final',
              etiqueta: COLA.menu.alFinal,
              icono: ChevronsDown,
              alSeleccionar: () => mover(e.entradaId, 'fin')
            },
        {
          id: 'otra-vez',
          etiqueta: COLA.menu.otraVez,
          icono: ListPlus,
          alSeleccionar: () => repetir(e)
        },
        {
          id: 'quitar',
          etiqueta: COLA.menu.quitar,
          icono: Trash2,
          destructivo: true,
          separadorAntes: true,
          alSeleccionar: () => quitar(e)
        }
      ]
      return items.filter((x): x is ItemMenu => x !== null)
    },
    [total, mover, repetir, quitar]
  )

  const teclaFila = (e: KeyboardEvent<HTMLLIElement>, entrada: EntradaIpc, i: number) => {
    if (e.target !== e.currentTarget) return
    const nav = (destino: number) => {
      e.preventDefault()
      const d = pendientes[Math.min(Math.max(destino, 0), total - 1)]
      if (d) enfocarFila(d.entradaId)
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const mapa: Record<string, MovimientoTeclado> = {
        ArrowUp: 'subir',
        ArrowDown: 'bajar',
        Home: 'inicio',
        End: 'fin'
      }
      const movimiento = mapa[e.key]
      if (movimiento) {
        e.preventDefault()
        mover(entrada.entradaId, movimiento)
      }
      return
    }
    if (e.ctrlKey || e.metaKey) return
    if (e.key === 'ArrowUp') nav(i - 1)
    else if (e.key === 'ArrowDown') nav(i + 1)
    else if (e.key === 'Home') nav(0)
    else if (e.key === 'End') nav(total - 1)
    else if (e.key === 'Delete') {
      e.preventDefault()
      quitar(entrada)
    } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault()
      e.currentTarget.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.click()
    }
  }

  // Línea de destino del arrastre (solo si soltar ahí mueve algo).
  const destino = useMemo(() => {
    if (!arr) return null
    const i = pendientes.findIndex((e) => e.entradaId === arr.entradaId)
    return i !== -1 && indiceTrasSoltar(i, arr.hueco) !== null ? arr.hueco : null
  }, [arr, pendientes])
  const arrastrada = arr ? pendientes.find((e) => e.entradaId === arr.entradaId) : undefined

  const confirmarVaciar = () => {
    setVaciando(false)
    foco.pedir('encabezado')
    intentar(acciones.cola.vaciar(false))
  }

  return (
    <section className={estilos.bloque} aria-labelledby="cola-pendientes-titulo">
      <div className={estilos.cabecera}>
        <h3
          id="cola-pendientes-titulo"
          ref={encabezadoRef}
          tabIndex={-1}
          className={estilos.encabezado}
        >
          {COLA.pendientes(total)}
        </h3>
        {total >= 2 && (
          <Boton variante="fantasma" aria-label={COLA.vaciarAria} onClick={() => setVaciando(true)}>
            {COLA.vaciar}
          </Boton>
        )}
      </div>

      {total === 0 ? (
        <p className={estilos.vacia}>{haySesion ? COLA.vacia : COLA.vaciaSinSesion}</p>
      ) : (
        <ul
          ref={listaRef}
          className={estilos.lista}
          aria-labelledby="cola-pendientes-titulo"
          onFocus={() => {
            foco.marcarDentro(true)
          }}
          onBlur={(e) => {
            const siguiente = e.relatedTarget
            if (siguiente instanceof Node && !e.currentTarget.contains(siguiente)) {
              foco.marcarDentro(false)
            }
          }}
        >
          {pendientes.map((entrada, i) => (
            <FilaPendiente
              key={entrada.entradaId}
              entrada={entrada}
              posicion={i + 1}
              total={total}
              etiquetaSiguiente={etiquetarSiguiente && i === 0}
              duracion={formatearDuracion(duracionDe(entrada.cancionId))}
              lineasSinSincronizar={lineasSinSincronizarDe(entrada.cancionId)}
              tabulable={entrada.entradaId === tabulableId}
              arrastrando={arr?.entradaId === entrada.entradaId}
              destino={
                destino === null
                  ? null
                  : destino === i
                    ? 'antes'
                    : destino === total && i === total - 1
                      ? 'despues'
                      : null
              }
              items={itemsDe(entrada, i)}
              alPuntero={(e) => arrastre.iniciar(e, entrada.entradaId, i)}
              alTecla={(e) => teclaFila(e, entrada, i)}
              alEnfocar={() => setActivaId(entrada.entradaId)}
            />
          ))}
        </ul>
      )}

      {arr && arrastrada && (
        <div className={estilos.fantasma} style={{ left: arr.x + 12, top: arr.y - 20 }} aria-hidden>
          {arrastrada.titulo} — {arrastrada.artista}
        </div>
      )}

      <div className={estilos.soloLectores} role="status" aria-live="polite">
        {anuncio}
      </div>

      <Dialogo
        abierto={vaciando}
        titulo={COLA.dialogoVaciar.titulo(total)}
        onCancelar={() => setVaciando(false)}
        enfoqueInicial="button[data-cancelar]"
        acciones={
          <>
            <Boton variante="secundario" data-cancelar="" onClick={() => setVaciando(false)}>
              {COLA.dialogoVaciar.cancelar}
            </Boton>
            <Boton variante="destructivo" onClick={confirmarVaciar}>
              {COLA.dialogoVaciar.quitar}
            </Boton>
          </>
        }
      >
        <p>{COLA.dialogoVaciar.cuerpo}</p>
      </Dialogo>
    </section>
  )
}
