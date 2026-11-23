import { ArrowUp, ChevronDown, ChevronRight } from 'lucide-react'
import type { Estilo } from '@shared/estilo'
import type { Letra } from '@shared/letra'
import { colorDeParte, PARTES, type Parte } from '@shared/reparto'
import { Icono } from '../../../componentes/Icono'
import { SelectorColor } from '../../../componentes/SelectorColor'
import { SUGERIDOS_LETRA } from '../../../karaoke/colores'
import estilosPanel from '../panelEstilo.module.css'
import { ChipParte } from '../ChipParte'
import estilos from './coloresPartes.module.css'
import { partesEnUso } from './partesEnUso'
import { nombreDeParte, T_PARTES as T } from './textosPartes'

type Origen = 'hex' | 'nativo' | 'sugerido'

export interface SeccionColoresPartesProps {
  estilo: Estilo
  letra: Pick<Letra, 'partes' | 'lineas'>
  /** D3: tema que otras canciones pueden usar; sin reparto, la sección va plegada. */
  d3: boolean
  /** «Más colores» (o, en D3 sin reparto, la sección entera) desplegado. */
  desplegado: boolean
  alDesplegar(desplegado: boolean): void
  alCambiar(parte: Parte, color: string, origen: Origen): void
  alAbrirNativo(parte: Parte): void
  /** Lleva el foco al selector de «Color de lo ya cantado». */
  alIrAlResaltado(): void
}

/** Partes cuyo selector se muestra: las que están en uso y, desplegado, todas las demás. */
export function partesVisibles(
  letra: Pick<Letra, 'partes' | 'lineas'>,
  desplegado: boolean
): { enUso: Parte[]; resto: Parte[]; visibles: Parte[] } {
  const enUso = partesEnUso(letra)
  const resto = PARTES.filter((p) => !enUso.includes(p))
  return { enUso, resto, visibles: desplegado ? [...PARTES] : enUso }
}

/** Subsección «Colores de los cantantes» de «Letra» (D2 y D3; spec 06 · 0.2.3). */
export function SeccionColoresPartes({
  estilo,
  letra,
  d3,
  desplegado,
  alDesplegar,
  alCambiar,
  alAbrirNativo,
  alIrAlResaltado
}: SeccionColoresPartesProps) {
  const { enUso, resto } = partesVisibles(letra, desplegado)
  const conReparto = enUso.length > 0
  // Sin reparto la sección no existe, salvo plegada en D3 (el tema lo pueden usar otras canciones).
  if (!conReparto && !d3) return null

  if (!conReparto && !desplegado) {
    return (
      <div className={estilos.seccion}>
        <h4>{T.titulo}</h4>
        <p className={estilosPanel.nota}>{T.plegado}</p>
        <button type="button" className={estilos.mas} onClick={() => alDesplegar(true)}>
          {T.mostrar}
        </button>
      </div>
    )
  }

  // Con coros y un solo cantante, el Cantante 1 no tiene fila (solo la del Coro).
  const variosCantantes = enUso.filter((p) => /^c\d$/.test(p)).length >= 2
  const filas = (desplegado ? [...PARTES] : enUso).filter(
    (p) => p !== 'c1' || variosCantantes || desplegado
  )
  const fila = (parte: Parte) => {
    const nombre = nombreDeParte(letra, parte)
    const color = colorDeParte(estilo, parte)
    if (parte === 'c1') {
      return (
        <div key={parte} className={`${estilos.fila} ${estilos.filaEnlace}`}>
          <ChipParte letra={letra} parte={parte} color={color} decorativo />
          <button
            type="button"
            className={estilos.enlace}
            aria-label={`${nombre}: ${T.c1Aria}`}
            onClick={alIrAlResaltado}
          >
            {nombre} {T.c1}
            <Icono icono={ArrowUp} tamano={16} />
          </button>
        </div>
      )
    }
    return (
      <div key={parte} className={estilos.fila} data-parte-color={parte}>
        <ChipParte letra={letra} parte={parte} color={color} decorativo />
        <SelectorColor
          etiqueta={nombre}
          valor={color}
          sugeridos={SUGERIDOS_LETRA}
          alAbrirNativo={() => alAbrirNativo(parte)}
          alCambiar={(nuevo, origen) => alCambiar(parte, nuevo, origen)}
        />
      </div>
    )
  }

  const nombresResto = resto.filter((p) => p !== 'c1').map((p) => nombreDeParte(letra, p))
  return (
    <div className={estilos.seccion}>
      <h4>{T.titulo}</h4>
      {filas.map(fila)}
      {conReparto && nombresResto.length > 0 && (
        <button
          type="button"
          className={estilos.mas}
          aria-expanded={desplegado}
          onClick={() => alDesplegar(!desplegado)}
        >
          <Icono icono={desplegado ? ChevronDown : ChevronRight} tamano={16} />{' '}
          {T.mas(nombresResto.join(', '))}
        </button>
      )}
    </div>
  )
}
