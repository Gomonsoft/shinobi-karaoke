import { useCallback, useEffect, useRef } from 'react'
import { mostrarToast } from '../../../componentes/gestorToasts'
import { useSesion } from '../../../sesion/ProveedorSesion'
import { COLA } from '../../../sesion/textos'
import { copiarDetalles } from '../../../soporte/detalles'
import { detallesDeError } from '../errores'
import { tituloDeError } from '../textosError'
import { ACC } from './textos'

const codigoDe = (e: unknown): string =>
  e && typeof e === 'object' && 'codigo' in e && typeof e.codigo === 'string' ? e.codigo : ''

/**
 * «A la cola» de varias (spec 02 · Feature 8): sin diálogo, las Listas al final y en orden; un toast con
 * [Deshacer] (quita solo las entradas de esa acción) y la variante «parcial» con la cola llena. Con la
 * cola vacía y sin sesión abre el panel; en espera sin candidata añade [Iniciar ahora].
 */
export function useAgregarVarias(): (ids: string[]) => Promise<boolean> {
  const sesion = useSesion()
  const ultima = useRef(sesion)
  useEffect(() => {
    ultima.current = sesion
  })

  return useCallback(async (ids) => {
    const antes = ultima.current.estado
    try {
      const { acciones, abrirPanel } = ultima.current
      const r = await acciones.cola.agregarVarias(ids)
      const a = r.entradaIds.length
      if (a === 0) {
        mostrarToast({
          tipo: r.omitidas.some((o) => o.motivo === 'COLA_LLENA') ? 'error' : 'info',
          mensaje: COLA.llena
        })
        return false
      }
      if (antes && antes.pendientes.length === 0 && antes.activa === null) abrirPanel()
      const llena = r.omitidas.some((o) => o.motivo === 'COLA_LLENA')
      const enEsperaSinCandidata = antes?.sesion?.fase === 'espera' && antes.pendientes.length === 0
      mostrarToast({
        tipo: 'exito',
        mensaje: llena ? ACC.cola.toastParcial(a, ids.length) : ACC.cola.toast(a),
        accion: {
          etiqueta: ACC.cola.deshacer,
          alAccionar: () => void acciones.cola.quitarVarias(r.entradaIds).catch(() => undefined)
        },
        ...(enEsperaSinCandidata
          ? {
              accionSecundaria: {
                etiqueta: ACC.cola.iniciarAhora,
                alAccionar: () => void acciones.empezar(r.entradaIds[0]!).catch(() => undefined)
              }
            }
          : null)
      })
      return true
    } catch (e) {
      mostrarToast({
        tipo: 'error',
        mensaje: tituloDeError(codigoDe(e)),
        accion: {
          etiqueta: ACC.copiarDetalles,
          alAccionar: () => void copiarDetalles(detallesDeError(e))
        }
      })
      return false
    }
  }, [])
}
