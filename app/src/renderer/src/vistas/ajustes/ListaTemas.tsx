import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { MenuContextual, type ItemMenu } from '../../componentes/MenuContextual'
import { MuestraTema } from '../../temas/MuestraTema'
import { TEMA } from '../../temas/textos'
import type { TemaCatalogo } from '../../temas/useCatalogoTemas'
import estilos from './ajustes.module.css'
import { AJT } from './textos'

export interface BorradoPendienteTema {
  temaId: string
  total: number
  restantes: number
}

interface Props {
  /** Todos los temas del catálogo (también el que tiene un borrado pendiente), ya ordenados. */
  temas: TemaCatalogo[]
  predeterminadoId: string | null
  /** Sin ⋯ (catálogo de un esquema más nuevo). */
  soloLectura: boolean
  borradoPendiente: BorradoPendienteTema | null
  /** Petición de foco: cada `n` nuevo lleva el foco a la fila `id` en cuanto exista. */
  foco: { id: string; n: number } | null
  alUsarPredeterminado(t: TemaCatalogo): void
  alRenombrar(t: TemaCatalogo): void
  alDuplicar(t: TemaCatalogo): void
  alEliminar(t: TemaCatalogo): void
  alTerminarBorrado(t: TemaCatalogo): void
  alCancelarBorrado(t: TemaCatalogo): void
}

/** Lista «Tus temas» (`ux/08`): *roving tabindex* entre filas y ⋯ por fila. */
export function ListaTemas({
  temas,
  predeterminadoId,
  soloLectura,
  borradoPendiente,
  foco,
  alUsarPredeterminado,
  alRenombrar,
  alDuplicar,
  alEliminar,
  alTerminarBorrado,
  alCancelarBorrado
}: Props) {
  const filas = useRef(new Map<string, HTMLLIElement>())
  const atendido = useRef(0)
  const [activoElegido, setActivo] = useState<string | null>(null)
  const activo = temas.some((t) => t.id === activoElegido) ? activoElegido : (temas[0]?.id ?? null)

  const clave = temas.map((t) => t.id).join('|')
  useEffect(() => {
    if (!foco || foco.n === atendido.current) return
    const fila = filas.current.get(foco.id)
    if (!fila) return
    atendido.current = foco.n
    setActivo(foco.id)
    fila.focus()
  }, [foco, clave])

  function alTeclear(e: KeyboardEvent<HTMLLIElement>, i: number): void {
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      const menu = e.currentTarget.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')
      if (!menu) return
      e.preventDefault()
      menu.focus()
      menu.click()
      return
    }
    // Las flechas solo mueven entre filas cuando el foco está en la propia fila.
    if (e.target !== e.currentTarget) return
    let destino: number | null = null
    if (e.key === 'ArrowDown') destino = Math.min(i + 1, temas.length - 1)
    else if (e.key === 'ArrowUp') destino = Math.max(i - 1, 0)
    else if (e.key === 'Home') destino = 0
    else if (e.key === 'End') destino = temas.length - 1
    if (destino === null) return
    e.preventDefault()
    const siguiente = temas[destino]
    if (!siguiente) return
    setActivo(siguiente.id)
    filas.current.get(siguiente.id)?.focus()
  }

  function items(t: TemaCatalogo, pendiente: boolean): ItemMenu[] {
    if (pendiente) {
      return [
        {
          id: 'terminar',
          etiqueta: AJT.terminar,
          alSeleccionar: () => alTerminarBorrado(t)
        },
        {
          id: 'cancelar-borrado',
          etiqueta: TEMA.eliminar.cancelarBorrado,
          alSeleccionar: () => alCancelarBorrado(t)
        }
      ]
    }
    return [
      ...(t.id === predeterminadoId
        ? []
        : [
            {
              id: 'usar',
              etiqueta: AJT.menu.usar,
              alSeleccionar: () => alUsarPredeterminado(t)
            }
          ]),
      { id: 'renombrar', etiqueta: AJT.menu.renombrar, alSeleccionar: () => alRenombrar(t) },
      { id: 'duplicar', etiqueta: AJT.menu.duplicar, alSeleccionar: () => alDuplicar(t) },
      {
        id: 'eliminar',
        etiqueta: AJT.menu.eliminar,
        destructivo: true,
        separadorAntes: true,
        alSeleccionar: () => alEliminar(t)
      }
    ]
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- role explícito: Safari quita la semántica con list-style none
    <ul role="list" className={estilos.listaTemas}>
      {temas.map((t, i) => {
        const esPredet = t.id === predeterminadoId
        const pendiente = borradoPendiente?.temaId === t.id ? borradoPendiente : null
        const usos = AJT.usos(t.usos.total)
        const grupos = AJT.grupos(t.grupos.artistas, t.grupos.albumes.length)
        return (
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <li
            key={t.id}
            ref={(nodo) => {
              if (nodo) filas.current.set(t.id, nodo)
              else filas.current.delete(t.id)
            }}
            className={estilos.filaTema}
            tabIndex={activo === t.id ? 0 : -1}
            aria-label={AJT.ariaFila(t.nombre, esPredet, usos, grupos)}
            onFocus={(e) => {
              if (e.target === e.currentTarget) setActivo(t.id)
            }}
            onKeyDown={(e) => alTeclear(e, i)}
          >
            <div className={estilos.filaTemaCabecera}>
              <MuestraTema estilo={t.estilo} tamano={64} />
              <div className={estilos.filaTemaTextos}>
                <span className={`t-cuerpo-fuerte ${estilos.nombreTema}`}>{t.nombre}</span>
                <span className={estilos.filaTemaDetalle}>
                  {esPredet && <span className={estilos.etiquetaPredet}>{AJT.etiquetaPredet}</span>}
                  <span>{[usos, grupos].filter(Boolean).join(' · ')}</span>
                </span>
              </div>
              {!soloLectura && (
                <MenuContextual
                  etiqueta={AJT.menu.etiqueta(t.nombre)}
                  items={items(t, pendiente !== null)}
                  tabIndexDisparador={activo === t.id ? 0 : -1}
                />
              )}
            </div>
            {pendiente && (
              <AvisoEnLinea
                tipo="aviso"
                accion={
                  !soloLectura && (
                    <span className={estilos.accionesAviso}>
                      <Boton onClick={() => alTerminarBorrado(t)}>{AJT.terminar}</Boton>
                      <Boton onClick={() => alCancelarBorrado(t)}>
                        {TEMA.eliminar.cancelarBorrado}
                      </Boton>
                    </span>
                  )
                }
              >
                {AJT.pendiente(pendiente.restantes, pendiente.total)}
              </AvisoEnLinea>
            )}
          </li>
        )
      })}
    </ul>
  )
}
