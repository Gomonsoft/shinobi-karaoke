import { useState, type ReactNode } from 'react'
import { Plus, Users, X } from 'lucide-react'
import type { Estilo } from '@shared/estilo'
import type { Letra } from '@shared/letra'
import {
  cantantesDe,
  lineasEntreParentesis,
  MAX_CANTANTES,
  NOMBRE_MAX,
  recuentoPorParte,
  type Parte
} from '@shared/reparto'
import { Boton } from '../../componentes/Boton'
import { ChipParte } from './ChipParte'
import { etiquetaParte, P, ranuraDe } from './partes'
import estilos from './editor.module.css'

interface Props {
  letra: Letra
  estilo: Pick<Estilo, 'letra'>
  /** Sin él (sesión en otra pantalla) los botones quedan `aria-disabled`. */
  editable: boolean
  repartir(): void
  anadir(): void
  quitar(id: Parte): void
  renombrar(id: Parte, nombre: string): void
  /** El recuento selecciona esas líneas en la lista, lleva la primera a la vista y enfoca la lista. */
  verLineas(parte: Parte): void
  marcarCoro(): void
  /**
   * Sitio de «Voz en los coros» (0365, feature 2): el deslizador y «Escuchar», solo si hay coros. Queda
   * vacío hasta esa tarea.
   */
  vozEnCoros?: ReactNode
}

/** Campo del nombre: se guarda al salir o con Intro; Esc devuelve el anterior. Un paso por edición. */
function CampoNombre({
  id,
  valor,
  marcador,
  etiqueta,
  editable,
  guardar
}: {
  id: Parte
  valor: string
  marcador: string
  etiqueta: string
  editable: boolean
  guardar(nombre: string): void
}) {
  const [borrador, setBorrador] = useState<string | null>(null)
  const texto = borrador ?? valor
  const largo = Array.from(texto).length
  const cerrar = () => {
    if (borrador !== null && borrador.trim() !== valor) guardar(borrador)
    setBorrador(null)
  }
  return (
    <span className={estilos.campoNombre}>
      <input
        type="text"
        value={texto}
        placeholder={marcador}
        aria-label={etiqueta}
        maxLength={NOMBRE_MAX}
        readOnly={!editable}
        data-nombre-cantante={id}
        onChange={(e) => setBorrador(e.currentTarget.value)}
        onBlur={cerrar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            cerrar()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            setBorrador(null)
          }
        }}
      />
      {largo >= 30 && (
        <span className={estilos.contadorNombre} aria-hidden="true">
          {largo}/{NOMBRE_MAX}
        </span>
      )}
    </span>
  )
}

/**
 * Funciones › «Cantantes y coros» (spec 06 · 0.2.3): crear, nombrar y quitar cantantes y sugerir los
 * coros. Con un solo cantante es un botón; con varios, una fila por parte.
 */
export function SeccionCantantes({
  letra,
  estilo,
  editable,
  repartir,
  anadir,
  quitar,
  renombrar,
  verLineas,
  marcarCoro,
  vozEnCoros
}: Props) {
  const cantantes = cantantesDe(letra)
  const varios = cantantes.length >= 2
  const cuenta = recuentoPorParte(letra)
  const entreParentesis = lineasEntreParentesis(letra).length
  const nombreUno = etiquetaParte(letra, 'c1')
  const inactivo = editable ? undefined : true

  const recuento = (parte: Parte) => (
    <button
      type="button"
      className={estilos.recuentoParte}
      aria-disabled={cuenta[parte] === 0 || undefined}
      onClick={() => cuenta[parte] > 0 && verLineas(parte)}
    >
      {P.recuento(cuenta[parte])}
    </button>
  )
  const fila = (parte: Parte, contenido: ReactNode, extra?: ReactNode) => (
    <div className={estilos.filaCantante} key={parte} data-parte-fila={parte}>
      <ChipParte letra={letra} estilo={estilo} parte={parte} decorativo />
      {contenido}
      {recuento(parte)}
      {extra ?? <span aria-hidden="true" />}
    </div>
  )

  return (
    <>
      <p>{P.ayuda}</p>
      {!varios ? (
        <div className={estilos.funcionFila}>
          <Boton data-funcion="repartir" aria-disabled={inactivo} onClick={repartir}>
            <Users size={16} aria-hidden="true" />
            {P.repartir}
          </Boton>
        </div>
      ) : (
        <div className={estilos.filasCantantes}>
          {cantantes.map((c) => {
            const n = ranuraDe(c.id)!
            return fila(
              c.id,
              <CampoNombre
                id={c.id}
                valor={c.nombre ?? ''}
                marcador={P.predeterminado(n)}
                etiqueta={P.nombreAria(n)}
                editable={editable}
                guardar={(nombre) => renombrar(c.id, nombre)}
              />,
              c.id === 'c1' ? undefined : (
                <button
                  type="button"
                  className={estilos.quitarCantante}
                  aria-label={P.quitarAria(etiquetaParte(letra, c.id), nombreUno)}
                  aria-disabled={inactivo}
                  onClick={() => editable && quitar(c.id)}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )
            )
          })}
          {(cantantes.length >= 3 || cuenta.todos > 0) &&
            fila('todos', <span className={estilos.nombreFijo}>{P.todos}</span>)}
          {fila('coro', <span className={estilos.nombreFijo}>{P.coro}</span>)}
        </div>
      )}
      {varios &&
        (cantantes.length < MAX_CANTANTES ? (
          <div className={estilos.funcionFila}>
            <Boton data-funcion="anadir-cantante" aria-disabled={inactivo} onClick={anadir}>
              <Plus size={16} aria-hidden="true" />
              {P.anadir}
            </Boton>
          </div>
        ) : (
          <p className={estilos.textoMaximo}>{P.maximo}</p>
        ))}
      {entreParentesis > 0 && (
        <>
          <p className={estilos.funcionMotivo}>ⓘ {P.sugerenciaCoro(entreParentesis)}</p>
          <div className={estilos.funcionFila}>
            <Boton
              data-funcion="marcar-coro"
              variante="fantasma"
              aria-disabled={inactivo}
              onClick={marcarCoro}
            >
              {P.marcarCoro(entreParentesis)}
            </Boton>
          </div>
        </>
      )}
      {vozEnCoros}
    </>
  )
}
