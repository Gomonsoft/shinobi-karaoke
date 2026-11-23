import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react'
import {
  ChevronDown,
  CircleDashed,
  Flag,
  Layers,
  PanelLeftClose,
  Play,
  WholeWord
} from 'lucide-react'
import type { Estilo } from '@shared/estilo'
import { tienePalabrasManuales, type Letra } from '@shared/letra'
import { inicial, parteDe, textoEnPantalla, tieneReparto } from '@shared/reparto'
import { contador, formatearTiempo, primeraSinInicio, tiempoMostrado } from '@shared/letras/tiempos'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { MenuContextual, type ItemMenu } from '../../componentes/MenuContextual'
import { Tooltip } from '../../componentes/Tooltip'
import { BotonLayout } from './BotonLayout'
import { ChipParte } from './ChipParte'
import type { AnclaMenu } from './MenuQuienCanta'
import { etiquetaParte, P } from './partes'
import { E } from './textos'
import { R } from './revision/textos'
import estilos from './editor.module.css'

interface Props {
  letra: Letra
  seleccion: string | null
  actual: number
  foco: number
  revisionSeleccion?: number
  /** Líneas pendientes de revisar (feature 11): id → motivo principal. Llevan ⚑ y su motivo en el tooltip. */
  dudosas?: ReadonlyMap<string, string>
  /** «Línea dudosa siguiente» de la cabecera; sin él (o sin pendientes) no hay botón. */
  siguienteDudosa?(): void
  seleccionar(id: string, enfocar?: boolean): void
  escuchar(id: string): void
  corregir(): void
  banner?: ReactNode
  /** Minimiza la lista; sin él no hay botón (disposición bajo el mínimo de diseño). */
  minimizar?(): void
  /** Abre el editor preciso de la línea seleccionada; `motivoPreciso` = por qué no se puede ahora. */
  abrirPreciso?(): void
  motivoPreciso?: string
  /** Menú contextual de la fila: «Escuchar la línea (Mayús + L)» y «Borrar tiempos de esta línea (Supr)». */
  escucharLinea?(id: string): void
  borrarTiempos?(): void
  /** Líneas seleccionadas (la principal es `seleccion`); sin ellas, solo la principal. */
  seleccionadas?: readonly string[]
  /** Colores de las partes para los chips; solo se usa con reparto. */
  estilo?: Pick<Estilo, 'letra'>
  /**
   * Selección múltiple: Ctrl/Cmd + clic (`alternar`), Mayús + clic (`rango`) y clic secundario sobre otra
   * fila ya seleccionada (`principal`). Sin él (modo al ritmo, sesión bloqueada) la lista es de una en una.
   */
  seleccionarVarias?(id: string, modo: 'alternar' | 'rango' | 'principal'): void
  /** Abre «¿Quién canta?» (chip y menú contextual); sin él no hay chip clicable ni ítem en el menú. */
  abrirQuienCanta?(ancla: AnclaMenu, origen: HTMLElement | null): void
  /** `edi.partes.soloPrincipal`, solo con varias seleccionadas: se añade al tooltip del editor preciso. */
  soloPrincipal?: string
  /** Líneas que empiezan mientras suena otra (voces a la vez): id → número de la que ya sonaba. */
  solapa?: ReadonlyMap<string, number>
}

const FILA_PX = 56
const VENTANA = 36
const MARGEN = 8

export function ListaLineas({
  letra,
  seleccion,
  actual,
  foco,
  revisionSeleccion = 0,
  dudosas,
  siguienteDudosa,
  seleccionar,
  escuchar,
  corregir,
  banner,
  minimizar,
  abrirPreciso,
  motivoPreciso,
  escucharLinea,
  borrarTiempos,
  seleccionadas,
  estilo,
  seleccionarVarias,
  abrirQuienCanta,
  soloPrincipal,
  solapa
}: Props) {
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const lista = useRef<HTMLDivElement>(null)
  const cajaLineas = useRef<HTMLDivElement>(null)
  const botones = useRef(new Map<string, HTMLButtonElement>())
  const manual = useRef(-Infinity)
  const desplazamiento = useRef<number | null>(null)
  const ultimoFoco = useRef(foco)
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
  const elegidas = useMemo(
    () => new Set(seleccionadas ?? (seleccion ? [seleccion] : [])),
    [seleccionadas, seleccion]
  )
  const varias = elegidas.size > 1
  const reparto = useMemo(() => tieneReparto(letra), [letra])
  // Hueco del chip: el chip más ancho de la canción (≈ 7 px por carácter más borde y relleno) + 8 px a cada lado.
  const anchoColChip = useMemo(() => {
    if (!reparto) return 40
    const partes = new Set(letra.lineas.map((l) => parteDe(l, letra)))
    const ancho = Math.max(
      24,
      ...[...partes].map((p) => {
        const marca = inicial(letra, p)
        return marca.tipo === 'texto' ? Array.from(marca.texto).length * 7 + 14 : 30
      })
    )
    return ancho + 16
  }, [letra, reparto])

  /** Alto de lo que hay sobre las filas dentro del scroll (el banner se desplaza con ellas). */
  const base = () => cajaLineas.current?.offsetTop ?? 0
  const primeraVisible = (scrollTop: number) =>
    Math.max(0, Math.floor((scrollTop - base()) / FILA_PX) - MARGEN)

  function mostrar(i: number) {
    const nodo = lista.current
    if (!nodo || i < 0) return
    const top = base() + i * FILA_PX
    const abajo = nodo.scrollTop + nodo.clientHeight
    if (top >= nodo.scrollTop && top + FILA_PX <= abajo) return
    nodo.scrollTop = top < nodo.scrollTop ? top : Math.max(0, top + FILA_PX - nodo.clientHeight)
    desplazamiento.current = nodo.scrollTop
    if (virtual) setInicio(primeraVisible(nodo.scrollTop))
  }

  useLayoutEffect(() => {
    mostrar(indiceSeleccion)
    // Un cambio de selección siempre queda a la vista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indiceSeleccion, virtual, revisionSeleccion])

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

  function itemsMenu(id: string, punto: { x: number; y: number }): ItemMenu[] {
    const items: ItemMenu[] = []
    if (abrirPreciso) {
      items.push({
        id: 'preciso',
        etiqueta: E.preciso.abrirPuntos,
        icono: WholeWord,
        noDisponible: motivoPreciso,
        alSeleccionar: abrirPreciso
      })
    }
    if (abrirQuienCanta) {
      items.push({
        id: 'quien-canta',
        etiqueta: P.menuContextual,
        alSeleccionar: () => abrirQuienCanta(punto, null)
      })
    }
    if (escucharLinea) {
      items.push({
        id: 'escuchar-linea',
        etiqueta: E.preciso.escucharLineaMenu,
        alSeleccionar: () => escucharLinea(id)
      })
    }
    items.push({
      id: 'escuchar-desde',
      etiqueta: E.preciso.escucharDesdeMenu,
      alSeleccionar: () => escuchar(id)
    })
    if (borrarTiempos) {
      items.push({
        id: 'borrar',
        etiqueta: E.preciso.borrarMenu,
        destructivo: true,
        separadorAntes: true,
        alSeleccionar: borrarTiempos
      })
    }
    return items
  }

  return (
    <section id="zona-lista" className={estilos.listaZona} aria-label={E.layout.lista.nombre}>
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
        {siguienteDudosa && dudosas && dudosas.size > 0 && (
          <Tooltip contenido={R.siguienteDudosa}>
            <button
              type="button"
              className={estilos.botonLayout}
              aria-label={R.siguienteDudosa}
              aria-keyshortcuts="Control+ArrowDown Meta+ArrowDown"
              data-siguiente-dudosa
              onClick={siguienteDudosa}
            >
              <Icono icono={Flag} tamano={14} />
              <Icono icono={ChevronDown} tamano={14} />
            </button>
          </Tooltip>
        )}
        {abrirPreciso && (
          <Tooltip
            contenido={
              soloPrincipal
                ? `${motivoPreciso ?? E.preciso.abrir}. ${soloPrincipal}`
                : (motivoPreciso ?? E.preciso.abrir)
            }
          >
            <button
              type="button"
              className={estilos.botonLayout}
              aria-label={E.preciso.abrir}
              aria-keyshortcuts="P"
              aria-disabled={motivoPreciso ? true : undefined}
              data-abrir-preciso
              onClick={() => !motivoPreciso && abrirPreciso()}
            >
              <Icono icono={WholeWord} />
            </button>
          </Tooltip>
        )}
        {minimizar && (
          <BotonLayout
            icono={PanelLeftClose}
            etiqueta={E.layout.lista.minimizar}
            nombre="lista-minimizar"
            expandido
            controla="zona-lista"
            onClick={minimizar}
          />
        )}
      </div>
      <div
        ref={lista}
        className={estilos.lista}
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop
          if (top !== desplazamiento.current) manual.current = performance.now()
          desplazamiento.current = null
          if (virtual) setInicio(primeraVisible(top))
        }}
      >
        {banner && <div className={estilos.bannerLista}>{banner}</div>}
        <div
          id="lineas-editor"
          role="listbox"
          aria-multiselectable="true"
          aria-label={E.lineas}
          data-foco-editor="lista"
          tabIndex={indiceSeleccion < inicio || indiceSeleccion >= fin ? 0 : -1}
          ref={cajaLineas}
          style={
            reparto ? ({ '--ancho-col-chip': `${anchoColChip}px` } as CSSProperties) : undefined
          }
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
            const motivo = dudosas?.get(el.id)
            const parte = parteDe(el, letra)
            const elegida = elegidas.has(el.id)
            const principal = el.id === seleccion
            const suenaCon = solapa?.get(el.id)
            const textoParte = parte === 'coro' ? textoEnPantalla({ ...el, parte }) : null
            return (
              <button
                key={el.id}
                ref={(nodo) => {
                  if (nodo) botones.current.set(el.id, nodo)
                  else botones.current.delete(el.id)
                }}
                type="button"
                role="option"
                aria-label={`${E.ariaLinea(n, tiempo, el.texto)}${tienePalabrasManuales(el) ? E.preciso.indicadorAria : ''}${motivo ? R.ariaLinea(motivo) : ''}${reparto ? `, ${P.chip(etiquetaParte(letra, parte))}` : ''}${varias && principal ? P.principal : ''}${suenaCon ? `, ${P.solapa(suenaCon).toLowerCase()}` : ''}`}
                data-dudosa={motivo ? '' : undefined}
                data-principal={principal ? '' : undefined}
                aria-selected={elegida}
                aria-current={sonando || undefined}
                aria-posinset={n}
                aria-setsize={total}
                tabIndex={principal ? 0 : -1}
                className={[
                  estilos.linea,
                  reparto && estilos.lineaConParte,
                  varias && elegida && !principal && estilos.lineaSecundaria,
                  varias && principal && estilos.lineaPrincipalMulti
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={(e) => {
                  if (seleccionarVarias && (e.ctrlKey || e.metaKey))
                    return seleccionarVarias(el.id, 'alternar')
                  if (seleccionarVarias && e.shiftKey) return seleccionarVarias(el.id, 'rango')
                  seleccionar(el.id)
                }}
                onDoubleClick={() => escuchar(el.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  // Sobre una fila ya seleccionada se conserva la selección múltiple.
                  if (!varias || !elegida) seleccionar(el.id)
                  else if (!principal) seleccionarVarias?.(el.id, 'principal')
                  setMenu({ id: el.id, x: e.clientX, y: e.clientY })
                }}
                onKeyDown={(e) => {
                  // Tecla Menú o Mayús + F10: el menú se abre junto a la fila.
                  if (e.key !== 'ContextMenu' && !(e.key === 'F10' && e.shiftKey)) return
                  e.preventDefault()
                  if (!varias || !elegida) seleccionar(el.id)
                  else if (!principal) seleccionarVarias?.(el.id, 'principal')
                  const r = e.currentTarget.getBoundingClientRect()
                  setMenu({ id: el.id, x: r.left + 32, y: r.bottom })
                }}
              >
                {sonando ? (
                  <Icono icono={Play} tamano={14} />
                ) : motivo ? (
                  <Tooltip contenido={R.tooltip(motivo)}>
                    <span className={estilos.marcaDudosa}>
                      <Icono icono={Flag} tamano={14} />
                    </span>
                  </Tooltip>
                ) : (
                  <span aria-hidden="true" />
                )}
                <span className={`t-tiempo ${!tiempo ? estilos.sinTiempo : ''}`}>
                  {tiempo ?? '--:--.--'}
                </span>
                {reparto && estilo && (
                  <Tooltip contenido={P.chip(etiquetaParte(letra, parte))}>
                    {/* Decorativo para lectores: la fila ya dice «Canta: …». Con teclado, C y el menú contextual. */}
                    {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                    <span
                      className={abrirQuienCanta ? estilos.chipClicable : undefined}
                      data-chip-parte=""
                      onClick={
                        abrirQuienCanta
                          ? (e) => {
                              e.stopPropagation()
                              if (!elegida) seleccionar(el.id)
                              abrirQuienCanta(e.currentTarget, null)
                            }
                          : undefined
                      }
                    >
                      <ChipParte letra={letra} estilo={estilo} parte={parte} decorativo />
                    </span>
                  </Tooltip>
                )}
                <span
                  className={`${estilos.textoLinea} ${parte === 'coro' ? estilos.textoCoro : ''}`}
                  title={el.texto}
                >
                  {textoParte?.parentesis ? `(${el.texto})` : el.texto}
                </span>
                {suenaCon !== undefined && (
                  <Tooltip contenido={P.solapa(suenaCon)}>
                    <Icono icono={Layers} tamano={14} />
                  </Tooltip>
                )}
                {tienePalabrasManuales(el) && (
                  <Tooltip contenido={E.preciso.indicador}>
                    <Icono icono={WholeWord} tamano={14} />
                  </Tooltip>
                )}
                {!tiempo && (
                  <Tooltip contenido={E.faltaTooltip}>
                    <Icono icono={CircleDashed} tamano={16} />
                  </Tooltip>
                )}
              </button>
            )
          })}
          {virtual && (
            <div aria-hidden="true" style={{ height: (letra.lineas.length - fin) * FILA_PX }} />
          )}
        </div>
      </div>
      {menu && (
        <MenuContextual
          etiqueta={E.preciso.menuFila}
          punto={menu}
          alCerrar={() => {
            const id = menu.id
            setMenu(null)
            botones.current.get(id)?.focus({ preventScroll: true })
          }}
          items={itemsMenu(menu.id, { x: menu.x, y: menu.y })}
        />
      )}
      <button className={estilos.enlace} type="button" onClick={corregir}>
        {E.corregir}
      </button>
    </section>
  )
}
