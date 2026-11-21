import { useId, useRef, type KeyboardEvent } from 'react'
import { Info } from 'lucide-react'
import type { Fondo } from '@shared/estilo'
import { ControlSegmentado } from '../../../componentes/ControlSegmentado'
import { DialAngulo } from '../../../componentes/DialAngulo'
import { Icono } from '../../../componentes/Icono'
import base from '../../../componentes/componentes.module.css'
import { useMovimientoReducido } from '../../../karaoke/useMovimientoReducido'
import { E } from '../textos'
import estilos from '../panelEstilo.module.css'
import { paradasRepartidas, type FormaFondo } from './paradas'

export type FondoDegradado = Extract<Fondo, { tipo: 'degradado' }>

const T = E.fondoG
const FORMAS: FormaFondo[] = ['lineal', 'radial', 'conico']
const VALORES = [0, 0.5, 1]
const VELOCIDADES = [
  { periodo: 60, etiqueta: T.velocidades.lenta },
  { periodo: 30, etiqueta: T.velocidades.media },
  { periodo: 15, etiqueta: T.velocidades.rapida }
]

/** Celda de la cuadrícula (0 a 8, por filas) que coincide con el centro, o -1. */
export function celdaDeCentro(centro: { x: number; y: number }): number {
  const col = VALORES.indexOf(centro.x)
  const fila = VALORES.indexOf(centro.y)
  return col < 0 || fila < 0 ? -1 : fila * 3 + col
}

/** Texto de velocidad para el resumen: lenta/media/rápida o «{n} s». */
export function textoVelocidad(periodo: number): string {
  const conocida = VELOCIDADES.find((v) => v.periodo === periodo)
  return conocida ? conocida.etiqueta.toLowerCase() : T.periodo(periodo)
}

/** Texto del resumen de solo lectura (D1 y D4). */
export function resumenFondo(fondo: Fondo): string {
  if (fondo.tipo === 'solido') return E.tema.resumen.solido
  const forma = fondo.forma ?? 'lineal'
  const celda = celdaDeCentro(fondo.centro ?? { x: 0.5, y: 0.5 })
  const centro = celda < 0 ? 'centro en otra posición' : T.posiciones[celda]!.toLowerCase()
  const detalle =
    forma === 'lineal'
      ? `${fondo.angulo_grados}°`
      : forma === 'radial'
        ? centro
        : `${fondo.angulo_grados}° · ${centro}`
  const velocidad = fondo.movimiento ? textoVelocidad(fondo.movimiento.periodo_s) : null
  return T.resumen(forma, detalle, velocidad)
}

function CuadriculaCentro({
  centro,
  alElegir
}: {
  centro: { x: number; y: number }
  alElegir(centro: { x: number; y: number }): void
}) {
  const grupo = useRef<HTMLDivElement>(null)
  const idOtro = useId()
  const elegida = celdaDeCentro(centro)

  function alTeclear(e: KeyboardEvent<HTMLDivElement>): void {
    const botones = Array.from(grupo.current!.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
    const actual = botones.indexOf(document.activeElement as HTMLButtonElement)
    if (actual < 0) return
    let col = actual % 3
    let fila = Math.floor(actual / 3)
    if (e.key === 'ArrowLeft') col = Math.max(0, col - 1)
    else if (e.key === 'ArrowRight') col = Math.min(2, col + 1)
    else if (e.key === 'ArrowUp') fila = Math.max(0, fila - 1)
    else if (e.key === 'ArrowDown') fila = Math.min(2, fila + 1)
    else if (e.key === 'Home') [col, fila] = [0, 0]
    else if (e.key === 'End') [col, fila] = [2, 2]
    else return
    e.preventDefault()
    botones[fila * 3 + col]?.focus()
    alElegir({ x: VALORES[col]!, y: VALORES[fila]! })
  }

  return (
    <div className={estilos.centro}>
      <span className={base.etiqueta}>{T.centroVisible}</span>
      {/* El teclado se gestiona aquí por delegación; las celdas son botones enfocables. */}
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
      <div
        ref={grupo}
        role="radiogroup"
        aria-label={T.centro}
        aria-describedby={elegida < 0 ? idOtro : undefined}
        className={estilos.cuadricula}
        onKeyDown={alTeclear}
      >
        {T.posiciones.map((nombre, i) => (
          <button
            key={nombre}
            type="button"
            role="radio"
            aria-label={nombre}
            aria-checked={i === elegida}
            tabIndex={i === (elegida < 0 ? 0 : elegida) ? 0 : -1}
            className={estilos.celda}
            onClick={() => alElegir({ x: VALORES[i % 3]!, y: VALORES[Math.floor(i / 3)]! })}
          >
            <span className={estilos.punto} aria-hidden="true" />
          </button>
        ))}
      </div>
      {elegida < 0 && (
        <span id={idOtro} className={base.soloLector}>
          {T.centroOtro}
        </span>
      )}
    </div>
  )
}

interface ControlesFondoProps {
  fondo: FondoDegradado
  /** Aplica el cambio de fondo con su clave de historial (`agruparGesto` para ráfagas). */
  alCambiar(fondo: FondoDegradado, clave: string, agruparGesto?: boolean): void
  claveNueva(campo: string): string
}

/** Forma, centro, ángulo y movimiento del fondo degradado (spec 06 · G). */
export function ControlesFondo({ fondo, alCambiar, claveNueva }: ControlesFondoProps) {
  const gestoAngulo = useRef<string | null>(null)
  const forma: FormaFondo = fondo.forma ?? 'lineal'
  const centro = fondo.centro ?? { x: 0.5, y: 0.5 }

  function cambiarForma(nueva: FormaFondo): void {
    alCambiar(
      {
        ...fondo,
        forma: nueva,
        paradas: paradasRepartidas(
          fondo.paradas.map((p) => p.color),
          nueva
        )
      },
      claveNueva('fondo.forma')
    )
  }

  return (
    <>
      <div data-foco-editor="segmentado">
        <ControlSegmentado
          etiqueta={T.forma}
          valor={forma}
          opciones={FORMAS.map((f) => ({ valor: f, etiqueta: T.formas[f] }))}
          onCambio={cambiarForma}
        />
      </div>
      {forma !== 'lineal' && (
        <div data-foco-editor="segmentado">
          <CuadriculaCentro
            centro={centro}
            alElegir={(c) => alCambiar({ ...fondo, centro: c }, claveNueva('fondo.centro'))}
          />
        </div>
      )}
      {forma !== 'radial' && (
        <div data-foco-editor="dial">
          <DialAngulo
            etiqueta={forma === 'conico' ? T.anguloInicio : E.angulo}
            valor={fondo.angulo_grados}
            alCambiar={(angulo_grados, { arrastrando }) => {
              if (arrastrando) gestoAngulo.current ??= claveNueva('fondo.angulo')
              const clave = gestoAngulo.current
              if (!arrastrando) gestoAngulo.current = null
              alCambiar({ ...fondo, angulo_grados }, clave ?? 'fondo.angulo', clave !== null)
            }}
          />
        </div>
      )}
    </>
  )
}

/** Casilla de movimiento, velocidad y ayudas. Va después de la lista de colores. */
export function ControlesMovimiento({ fondo, alCambiar, claveNueva }: ControlesFondoProps) {
  const reducido = useMovimientoReducido()
  const idCasilla = useId()
  const forma: FormaFondo = fondo.forma ?? 'lineal'
  const movimiento = fondo.movimiento ?? null
  const periodoPropio =
    movimiento && !VELOCIDADES.some((v) => v.periodo === movimiento.periodo_s)
      ? movimiento.periodo_s
      : null
  const opciones = [
    ...VELOCIDADES.map((v) => ({ valor: String(v.periodo), etiqueta: v.etiqueta })),
    ...(periodoPropio ? [{ valor: String(periodoPropio), etiqueta: T.periodo(periodoPropio) }] : [])
  ]

  return (
    <div className={estilos.movimiento}>
      <label htmlFor={idCasilla} className={estilos.casilla}>
        <input
          id={idCasilla}
          type="checkbox"
          checked={movimiento !== null}
          onChange={(e) =>
            alCambiar(
              {
                ...fondo,
                movimiento: e.currentTarget.checked ? { periodo_s: 30, sentido: 'horario' } : null
              },
              claveNueva('fondo.movimiento')
            )
          }
        />
        {T.movimiento}
      </label>
      {movimiento && (
        <>
          <div data-foco-editor="segmentado">
            <ControlSegmentado
              etiqueta={T.velocidad}
              valor={String(movimiento.periodo_s)}
              opciones={opciones}
              onCambio={(v) =>
                alCambiar(
                  { ...fondo, movimiento: { ...movimiento, periodo_s: Number(v) } },
                  claveNueva('fondo.velocidad')
                )
              }
            />
          </div>
        </>
      )}
      <p className={base.ayuda}>{T.ayuda[forma]}</p>
      {reducido && (
        <p className={[base.ayuda, estilos.notaReducido].join(' ')}>
          <Icono icono={Info} tamano={16} />
          {T.reducido}
        </p>
      )}
    </div>
  )
}
