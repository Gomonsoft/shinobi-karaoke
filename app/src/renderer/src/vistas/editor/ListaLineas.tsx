import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CircleDashed, Diamond, Play } from 'lucide-react'
import type { Letra } from '@shared/letra'
import { contador, formatearTiempo, primeraSinInicio, tiempoMostrado } from '@shared/letras/tiempos'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { Tooltip } from '../../componentes/Tooltip'
import { E } from './textos'
import estilos from './editor.module.css'

interface Props {
  letra: Letra
  seleccion: string | null
  actual: number
  foco: number
  seleccionar(id: string, enfocar?: boolean): void
  escuchar(id: string): void
  corregir(): void
  banner?: ReactNode
}

const FILA_PX = 56
const VENTANA = 36
const MARGEN = 8

export function ListaLineas({
  letra,
  seleccion,
  actual,
  foco,
  seleccionar,
  escuchar,
  corregir,
  banner
}: Props) {
  const lista = useRef<HTMLDivElement>(null)
  const botones = useRef(new Map<string, HTMLButtonElement>())
  const manual = useRef(-Infinity)
  const desplazamiento = useRef<number | null>(null)
  const ultimoFoco = useRef(0)
  const [inicio, setInicio] = useState(0)
  const virtual = letra.lineas.length >= 200
  const fin = virtual ? Math.min(inicio + VENTANA, letra.lineas.length) : letra.lineas.length
  const numeradas = useMemo(() => {
    let n = 0
    return letra.lineas.map((elemento) => ({ elemento, n: elemento.tipo === 'linea' ? ++n : 0 }))
  }, [letra.lineas])
  const indice = useMemo(() => new Map(letra.lineas.map((el, i) => [el.id, i])), [letra.lineas])
  const indiceSeleccion = seleccion === null ? -1 : (indice.get(seleccion) ?? -1)
  const { sincronizadas, total } = contador(letra)

  function mostrar(i: number) {
    const nodo = lista.current
    if (!nodo || i < 0) return
    const top = i * FILA_PX
    const abajo = nodo.scrollTop + nodo.clientHeight
    if (top >= nodo.scrollTop && top + FILA_PX <= abajo) return
    nodo.scrollTop = top < nodo.scrollTop ? top : Math.max(0, top + FILA_PX - nodo.clientHeight)
    desplazamiento.current = nodo.scrollTop
    if (virtual) setInicio(Math.max(0, Math.floor(nodo.scrollTop / FILA_PX) - MARGEN))
  }

  useLayoutEffect(() => {
    mostrar(indiceSeleccion)
    // Un cambio de selección siempre queda a la vista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indiceSeleccion, virtual])

  useLayoutEffect(() => {
    if (foco === ultimoFoco.current || !seleccion) return
    const boton = botones.current.get(seleccion)
    if (!boton) return
    ultimoFoco.current = foco
    boton.focus({ preventScroll: true })
  }, [foco, seleccion, inicio])

  useEffect(() => {
    if (actual >= 0 && performance.now() - manual.current >= 5000) mostrar(actual)
    // El reloj no cambia la selección, solo desplaza la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual, virtual])

  return (
    <section className={estilos.listaZona} aria-label="Sincronía">
      {banner}
      <div className={estilos.listaTitulo}>
        <h2>{E.lineas}</h2>
        {sincronizadas < total ? (
          <Boton
            variante="fantasma"
            onClick={() => {
              const primera = primeraSinInicio(letra)
              if (primera) seleccionar(primera, true)
            }}
          >
            {E.contador(sincronizadas, total)}
          </Boton>
        ) : (
          <span className={estilos.completa}>{E.contador(sincronizadas, total)} ✓</span>
        )}
      </div>
      <div
        id="lineas-editor"
        role="listbox"
        aria-label={E.lineas}
        data-foco-editor="lista"
        tabIndex={indiceSeleccion < inicio || indiceSeleccion >= fin ? 0 : -1}
        ref={lista}
        className={estilos.lista}
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop
          if (top !== desplazamiento.current) manual.current = performance.now()
          desplazamiento.current = null
          if (virtual) setInicio(Math.max(0, Math.floor(top / FILA_PX) - MARGEN))
        }}
      >
        {virtual && <div aria-hidden="true" style={{ height: inicio * FILA_PX }} />}
        {numeradas.slice(inicio, fin).map(({ elemento: el, n }, i) => {
          const tiempo =
            el.inicio_ms === null
              ? null
              : formatearTiempo(tiempoMostrado(el.inicio_ms, letra.offset_ms))
          if (el.tipo === 'pausa') {
            return (
              <div key={el.id} role="separator" aria-label="pausa" className={estilos.pausa}>
                <span>{E.pausa}</span>
                {tiempo && (
                  <Tooltip contenido={E.pausaTiempo}>
                    <span className="t-tiempo">{tiempo}</span>
                  </Tooltip>
                )}
              </div>
            )
          }
          const sonando = inicio + i === actual
          return (
            <button
              key={el.id}
              ref={(nodo) => {
                if (nodo) botones.current.set(el.id, nodo)
                else botones.current.delete(el.id)
              }}
              type="button"
              role="option"
              aria-label={E.ariaLinea(n, tiempo, el.texto)}
              aria-selected={el.id === seleccion}
              aria-current={sonando || undefined}
              aria-posinset={n}
              aria-setsize={total}
              tabIndex={el.id === seleccion ? 0 : -1}
              className={estilos.linea}
              onClick={() => seleccionar(el.id)}
              onDoubleClick={() => escuchar(el.id)}
            >
              {sonando ? <Icono icono={Play} tamano={14} /> : <span aria-hidden="true" />}
              <span className={`t-tiempo ${!tiempo ? estilos.sinTiempo : ''}`}>
                {tiempo ?? '--:--.--'}
              </span>
              <span className={estilos.textoLinea} title={el.texto}>
                {el.texto}
              </span>
              {!tiempo && (
                <Tooltip contenido={E.faltaTooltip}>
                  <Icono icono={CircleDashed} tamano={16} />
                </Tooltip>
              )}
              {el.palabras && (
                <Tooltip contenido={E.palabrasTooltip}>
                  <Icono icono={Diamond} tamano={14} />
                </Tooltip>
              )}
            </button>
          )
        })}
        {virtual && (
          <div aria-hidden="true" style={{ height: (letra.lineas.length - fin) * FILA_PX }} />
        )}
      </div>
      <button className={estilos.enlace} type="button" onClick={corregir}>
        {E.corregir}
      </button>
    </section>
  )
}
