import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ResumenCancionIpc } from '@shared/ipc'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion } from '../../navegacion/estado'
import { detallesDeError } from './errores'
import { copiarDetalles } from '../../soporte/detalles'
import { tituloDeTarjeta } from './tarjeta'
import { BIB_FINES } from './textosAjustarFines'
import { tituloDeError } from './textosError'
import { mensajeDeOmitida } from './textosPreparacion'

/** ¿Se ofrece «Ajustar los fines…» en esta tarjeta? (`prepararFinesSinMarca` del resumen; main lo decide.) */
export const puedeAjustarFines = (r: ResumenCancionIpc, hayTrabajo: boolean): boolean =>
  r.prepararFinesSinMarca === true &&
  (r.lineasSinFin ?? 0) > 0 &&
  !r.danada &&
  !hayTrabajo &&
  r.estadoPreparacion !== 'preparando'

const FINALES = new Set(['lista_para_revisar', 'error', 'detenida', 'sin_letra', 'elige_letra'])

/**
 * «Ajustar los fines…» (spec 02 · Feature 5, revisión 2026-11-22): confirma siempre, llama a
 * `preparar([id], { finesSinMarca: true })` y avisa con un toast al empezar y otro con cuántos fines
 * puso. No abre la vista de progreso ni cambia el estado de la canción.
 */
export function useAjustarFines(resumenDe: (id: string) => ResumenCancionIpc | undefined): {
  pedir(id: string): void
  dialogo: ReactNode
} {
  const { ir } = useNavegacion()
  const [id, setId] = useState<string | null>(null)
  /** Canciones en curso: id → líneas sin fin al confirmar y título. */
  const [siguiendo, setSiguiendo] = useState<ReadonlyMap<string, { n: number; titulo: string }>>(
    new Map()
  )
  const siguiendoRef = useRef(siguiendo)
  siguiendoRef.current = siguiendo

  useEffect(() => {
    if (siguiendo.size === 0) return
    return window.shinobi.preparacion.alCambiar(({ id: cambiado, preparacion }) => {
      const datos = siguiendoRef.current.get(cambiado)
      const p = preparacion as { estado?: string; fines?: { lineas?: number } } | null
      if (!datos || !p?.estado || !FINALES.has(p.estado)) return
      setSiguiendo((m) => {
        const nuevo = new Map(m)
        nuevo.delete(cambiado)
        return nuevo
      })
      if (p.estado !== 'lista_para_revisar') return
      const k = p.fines?.lineas ?? 0
      mostrarToast({
        tipo: 'info',
        mensaje: BIB_FINES.toastFin(datos.titulo, k, datos.n),
        ...(k > 0
          ? {
              accion: {
                etiqueta: BIB_FINES.verLaLetra,
                alAccionar: () => ir({ tipo: 'cancion', id: cambiado, paso: 'editor' })
              }
            }
          : null)
      })
    })
  }, [siguiendo.size, ir])

  const pedir = useCallback((cancionId: string) => setId(cancionId), [])
  const cerrar = useCallback(() => setId(null), [])

  const resumen = id ? resumenDe(id) : undefined
  const confirmar = async (): Promise<void> => {
    if (!id || !resumen) return
    const titulo = tituloDeTarjeta(resumen)
    const n = resumen.lineasSinFin ?? 0
    setId(null)
    try {
      const r = await window.shinobi.preparacion.preparar([id], { finesSinMarca: true })
      if (r.aceptadas.length === 0) {
        mostrarToast({ tipo: 'info', mensaje: mensajeDeOmitida(r.omitidas, id, titulo) })
        return
      }
      // Una Lista no tiene registro de preparación: main ya terminó y dice cuántos fines puso.
      const puestos = r.fines?.[id]
      if (puestos !== undefined) {
        mostrarToast({
          tipo: 'info',
          mensaje: BIB_FINES.toastFin(titulo, puestos, n),
          ...(puestos > 0
            ? {
                accion: {
                  etiqueta: BIB_FINES.verLaLetra,
                  alAccionar: () => ir({ tipo: 'cancion', id, paso: 'editor' })
                }
              }
            : null)
        })
        return
      }
      setSiguiendo((m) => new Map(m).set(id, { n, titulo }))
      mostrarToast({
        tipo: 'info',
        mensaje: BIB_FINES.toast(titulo),
        accion: {
          etiqueta: BIB_FINES.verLaLetra,
          alAccionar: () => ir({ tipo: 'cancion', id, paso: 'editor' })
        }
      })
    } catch (err) {
      const codigo =
        err && typeof err === 'object' && 'codigo' in err && typeof err.codigo === 'string'
          ? err.codigo
          : ''
      mostrarToast({
        tipo: 'error',
        mensaje: tituloDeError(codigo),
        accion: {
          etiqueta: 'Copiar detalles',
          alAccionar: () => void copiarDetalles(detallesDeError(err))
        }
      })
    }
  }

  const dialogo = resumen ? (
    <Dialogo
      abierto
      titulo={BIB_FINES.titulo(tituloDeTarjeta(resumen))}
      onCancelar={cerrar}
      enfoqueInicial="[data-cancelar-fines]"
      ancho="30rem"
      acciones={
        <>
          <Boton variante="secundario" data-cancelar-fines onClick={cerrar}>
            {BIB_FINES.cancelar}
          </Boton>
          <Boton variante="primario" onClick={() => void confirmar()}>
            {BIB_FINES.confirmar}
          </Boton>
        </>
      }
    >
      <p>{BIB_FINES.intro}</p>
      <ul>
        <li>{BIB_FINES.soloPondremos(resumen.lineasSinFin ?? 0)}</li>
        <li>{BIB_FINES.noMoveremos}</li>
        <li>{BIB_FINES.podrasQuitar}</li>
      </ul>
    </Dialogo>
  ) : null

  return { pedir, dialogo }
}
