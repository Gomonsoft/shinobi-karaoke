import type { KeyboardEvent, PointerEvent } from 'react'
import { GripVertical } from 'lucide-react'
import type { EntradaIpc } from '@shared/sesion'
import { Icono } from '../../../componentes/Icono'
import { MenuContextual, type ItemMenu } from '../../../componentes/MenuContextual'
import { COLA } from '../../../sesion/textos'
import { textoSincronia } from '../tarjeta'
import estilos from './listaPendientes.module.css'

export interface FilaPendienteProps {
  entrada: EntradaIpc
  /** Posición (1-based) y total, para el nombre accesible. */
  posicion: number
  total: number
  /** Es la candidata y va marcada «Siguiente» (cuenta o espera). */
  etiquetaSiguiente: boolean
  /** `m:ss` o `null` si no se conoce. */
  duracion: string | null
  /** Líneas sin sincronizar de una Lista incompleta; `0` o `null`: nada. */
  lineasSinSincronizar: number | null
  /** Parada de tabulación de la lista (roving tabindex). */
  tabulable: boolean
  arrastrando: boolean
  /** Línea de destino del arrastre sobre esta fila. */
  destino: 'antes' | 'despues' | null
  items: ItemMenu[]
  alPuntero(e: PointerEvent): void
  alTecla(e: KeyboardEvent<HTMLLIElement>): void
  alEnfocar(): void
}

export function FilaPendiente({
  entrada,
  posicion,
  total,
  etiquetaSiguiente,
  duracion,
  lineasSinSincronizar,
  tabulable,
  arrastrando,
  destino,
  items,
  alPuntero,
  alTecla,
  alEnfocar
}: FilaPendienteProps) {
  const causa = entrada.disponibilidad === 'ok' ? null : COLA.causa(entrada.disponibilidad)
  const nombre = COLA.ariaFila(
    posicion,
    total,
    entrada.titulo,
    entrada.artista,
    duracion ?? 'duración desconocida',
    { siguiente: etiquetaSiguiente, causa: causa ?? undefined }
  )
  const clases = [
    estilos.fila,
    arrastrando && estilos.arrastrando,
    destino === 'antes' && estilos.destinoAntes,
    destino === 'despues' && estilos.destinoDespues
  ]
    .filter(Boolean)
    .join(' ')
  return (
    // La fila es un elemento de lista enfocable (roving tabindex): su teclado es parte del patrón.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <li
      className={clases}
      data-entrada-id={entrada.entradaId}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={tabulable ? 0 : -1}
      aria-label={nombre}
      onKeyDown={alTecla}
      onFocus={alEnfocar}
    >
      <div className={estilos.linea}>
        <span className={estilos.posicion} aria-hidden="true">
          {posicion}
        </span>
        {/* El asa es decorativa: el arrastre siempre tiene equivalente de teclado y de menú. */}
        <span className={estilos.asa} aria-hidden="true" onPointerDown={alPuntero}>
          <Icono icono={GripVertical} tamano={16} />
        </span>
        <span className={estilos.texto}>
          <span className={estilos.titulo}>
            {entrada.titulo} — {entrada.artista}
          </span>
          {etiquetaSiguiente && (
            <span className={estilos.etiquetaSiguiente}>{COLA.etiquetaSiguiente}</span>
          )}
        </span>
        {duracion && <span className={estilos.duracion}>{duracion}</span>}
        <MenuContextual
          etiqueta={`Más acciones de «${entrada.titulo}»`}
          items={items}
          tabIndexDisparador={tabulable ? 0 : -1}
        />
      </div>
      {causa && (
        <p className={`${estilos.aviso} ${estilos.avisoNoDisponible}`}>
          {COLA.noDisponible(causa)}
        </p>
      )}
      {!causa && lineasSinSincronizar !== null && lineasSinSincronizar > 0 && (
        <p className={estilos.aviso}>⚠ {textoSincronia(lineasSinSincronizar)}</p>
      )}
    </li>
  )
}
