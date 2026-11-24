import { useMemo } from 'react'
import { Check, CircleDot, CircleX, Clock, Minus, WifiOff, type LucideIcon } from 'lucide-react'
import type { ResumenCancionIpc, TandaPreparacionIpc } from '@shared/ipc'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { Icono } from '../../componentes/Icono'
import { textoDeError } from '../progreso/textos'
import { tituloDeError } from './textosError'
import { BIB_PREP, BIB_RESULTADO } from './textosPreparacion'
import estilos from './biblioteca.module.css'

type Resultado = NonNullable<TandaPreparacionIpc['canciones'][number]['resultado']>
type Color = 'exito' | 'info' | 'neutro' | 'error'

const FILAS: Record<Resultado | 'ninguno', { icono: LucideIcon; color: Color }> = {
  lista_para_revisar: { icono: Check, color: 'exito' },
  elige_letra: { icono: CircleDot, color: 'info' },
  sin_letra: { icono: Minus, color: 'neutro' },
  letra_pendiente: { icono: WifiOff, color: 'neutro' },
  error: { icono: CircleX, color: 'error' },
  cancelada: { icono: Minus, color: 'neutro' },
  ninguno: { icono: Clock, color: 'neutro' }
}

/** Resumen de una frase: «12 canciones: 9 listas para revisar · 2 esperan letra · 1 con error.» */
export function textoResumenTanda(tanda: TandaPreparacionIpc): string {
  const cuenta = (...r: Resultado[]) =>
    tanda.canciones.filter((c) => c.resultado !== null && r.includes(c.resultado)).length
  const partes: string[] = []
  const revisar = cuenta('lista_para_revisar')
  const letra = cuenta('elige_letra', 'sin_letra', 'letra_pendiente')
  const error = cuenta('error')
  const canceladas = cuenta('cancelada')
  if (revisar) partes.push(BIB_PREP.bandeja.revisar(revisar))
  if (letra) partes.push(BIB_PREP.bandeja.letra(letra))
  if (error) partes.push(BIB_PREP.bandeja.error(error))
  if (canceladas) partes.push(canceladas === 1 ? '1 cancelada' : `${canceladas} canceladas`)
  const total = BIB_RESULTADO.total(tanda.canciones.length)
  return partes.length ? `${total}: ${BIB_RESULTADO.resumen(partes)}` : `${total}.`
}

/** ¿Hay errores que repetir lo puede arreglar? (los demás se quedan con [Copiar detalles]). */
export function hayFallidasReintentables(tanda: TandaPreparacionIpc): boolean {
  return tanda.canciones.some(
    (c) => c.resultado === 'error' && textoDeError(c.motivo ?? '').reintentable
  )
}

interface Props {
  tanda: TandaPreparacionIpc | null
  canciones: ResumenCancionIpc[]
  alCerrar(): void
  /** [Ver en la biblioteca]: la Biblioteca aplica la casilla «Listas para revisar» o «Todas». */
  alVerEnBiblioteca(hayListas: boolean): void
  alRevisar(id: string): void
  alAbrirLetra(id: string): void
  alReintentarFallidas(): void
  alCopiarDetalles(texto: string): void
}

/**
 * Diálogo «Resultado de la preparación» (docs/ux/04 · Feature 7): lo que pasó con cada canción de la
 * última tanda, en el orden de la cola. Se conserva mientras la app siga abierta.
 */
export function DialogoResultadoPreparacion({
  tanda,
  canciones,
  alCerrar,
  alVerEnBiblioteca,
  alRevisar,
  alAbrirLetra,
  alReintentarFallidas,
  alCopiarDetalles
}: Props) {
  const titulos = useMemo(() => new Map(canciones.map((c) => [c.id, c.titulo])), [canciones])
  const hayListas = tanda?.canciones.some((c) => c.resultado === 'lista_para_revisar') ?? false
  const reintentables = tanda ? hayFallidasReintentables(tanda) : false
  const todoFallo =
    tanda !== null &&
    tanda.canciones.length > 0 &&
    tanda.canciones.every((c) => c.resultado === 'error')
  const enfoque = reintentables && todoFallo ? '[data-reintentar]' : '[data-ver]'

  return (
    <Dialogo
      abierto
      titulo={BIB_RESULTADO.titulo}
      ancho="35rem"
      onCancelar={alCerrar}
      enfoqueInicial={enfoque}
      acciones={
        <>
          {reintentables && (
            <Boton data-reintentar onClick={alReintentarFallidas}>
              {BIB_RESULTADO.reintentarFallidas}
            </Boton>
          )}
          <Boton data-ver variante="primario" onClick={() => alVerEnBiblioteca(hayListas)}>
            {BIB_RESULTADO.verEnBiblioteca}
          </Boton>
          <Boton onClick={alCerrar}>{BIB_RESULTADO.cerrar}</Boton>
        </>
      }
    >
      {!tanda || tanda.canciones.length === 0 ? (
        <p>{BIB_RESULTADO.vacio}</p>
      ) : (
        <>
          <p>{textoResumenTanda(tanda)}</p>
          <ul className={estilos.listaResultado} aria-label={BIB_RESULTADO.titulo}>
            {tanda.canciones.map((c) => {
              const f = FILAS[c.resultado ?? 'ninguno']
              const titulo = titulos.get(c.id) ?? 'Canción eliminada'
              const texto =
                c.resultado === 'error'
                  ? tituloDeError(c.motivo ?? '')
                  : c.resultado
                    ? BIB_RESULTADO.fila[c.resultado]
                    : BIB_RESULTADO.sinResultado
              return (
                <li key={c.id} className={estilos.filaResultado} data-resultado={c.resultado}>
                  <span className={estilos[`resultado_${f.color}`]}>
                    <Icono icono={f.icono} tamano={16} />
                  </span>
                  <span className={estilos.filaResultadoTexto} title={`${titulo} — ${texto}`}>
                    {titulo} — {texto}
                    {c.resultado === 'lista_para_revisar' && c.dudosas
                      ? ` · ${c.dudosas === 1 ? '1 línea' : `${c.dudosas} líneas`} por revisar`
                      : ''}
                  </span>
                  {c.resultado === 'lista_para_revisar' && (
                    <Boton variante="fantasma" onClick={() => alRevisar(c.id)}>
                      {BIB_PREP.accion.revisar}
                    </Boton>
                  )}
                  {c.resultado === 'elige_letra' && (
                    <Boton variante="fantasma" onClick={() => alAbrirLetra(c.id)}>
                      {BIB_PREP.accion.elegirLetra}
                    </Boton>
                  )}
                  {c.resultado === 'sin_letra' && (
                    <Boton variante="fantasma" onClick={() => alAbrirLetra(c.id)}>
                      {BIB_PREP.accion.anadirLetra}
                    </Boton>
                  )}
                  {c.resultado === 'error' && (
                    <Boton
                      variante="fantasma"
                      onClick={() => alCopiarDetalles(`${c.motivo ?? 'ERROR'}: ${titulo}`)}
                    >
                      {BIB_RESULTADO.copiarDetalles}
                    </Boton>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Dialogo>
  )
}
