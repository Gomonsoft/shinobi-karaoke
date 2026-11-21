import { useCallback, useEffect, useRef } from 'react'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useSesion } from '../../sesion/ProveedorSesion'
import { COLA, SES } from '../../sesion/textos'
import { detallesDeError } from './errores'
import { tituloDeError } from './textosError'
import { copiarDetalles } from '../../soporte/detalles'

const codigoDe = (err: unknown): string =>
  err && typeof err === 'object' && 'codigo' in err && typeof err.codigo === 'string'
    ? err.codigo
    : ''

export type DondeTarjeta = 'final' | 'siguiente'

/**
 * «A la cola», «Reproducir a continuación» y «Agregar al final» (spec 02, «Tarjetas y menú durante
 * la sesión»): llama a `cola.agregar` y cuenta el resultado en un toast con [Deshacer] (quita solo la
 * entrada devuelta). Con una cola vacía abre el panel; en espera sin candidata el toast añade
 * [Iniciar ahora]; con la cola agotada (la cuenta ya ha empezado) usa `cola.toast.cuenta`.
 */
export function useAgregarACola(): (
  cancionId: string,
  titulo: string,
  donde: DondeTarjeta
) => Promise<void> {
  const sesion = useSesion()
  const ultima = useRef(sesion)
  useEffect(() => {
    ultima.current = sesion
  })

  return useCallback(async (cancionId, titulo, donde) => {
    const antes = ultima.current.estado
    try {
      const { acciones, abrirPanel } = ultima.current
      const { estado, entradaId } = await acciones.cola.agregar(cancionId, donde)
      if (antes && antes.pendientes.length === 0 && antes.activa === null) abrirPanel()

      const deshacer = {
        etiqueta: COLA.toast.deshacer,
        alAccionar: () => void acciones.cola.quitar(entradaId).catch(() => undefined)
      }
      const transicion = estado.sesion?.transicion ?? null
      const enCuenta = transicion !== null && transicion.candidataId === entradaId
      if (enCuenta && antes?.sesion?.fase === 'fin_de_cola') {
        mostrarToast({
          tipo: 'exito',
          mensaje: COLA.toast.cuenta(titulo, Math.ceil(transicion.restanteMs / 1000)),
          accion: deshacer,
          accionSecundaria: {
            etiqueta: COLA.toast.detener,
            alAccionar: () =>
              void acciones.detenerTransicion(transicion.transicionId).catch(() => undefined)
          }
        })
        return
      }
      const posicion = estado.pendientes.findIndex((e) => e.entradaId === entradaId) + 1
      const enEsperaSinCandidata = antes?.sesion?.fase === 'espera' && antes.pendientes.length === 0
      mostrarToast({
        tipo: 'exito',
        mensaje:
          donde === 'siguiente'
            ? COLA.toast.siguiente(titulo)
            : COLA.toast.final(titulo, posicion || estado.pendientes.length),
        accion: deshacer,
        ...(enEsperaSinCandidata
          ? {
              accionSecundaria: {
                etiqueta: COLA.toast.iniciarAhora,
                alAccionar: () => void acciones.empezar(entradaId).catch(() => undefined)
              }
            }
          : null)
      })
    } catch (err) {
      const codigo = codigoDe(err)
      if (codigo === 'COLA_LLENA') {
        mostrarToast({ tipo: 'error', mensaje: COLA.llena })
      } else if (codigo === 'CANCION_NO_DISPONIBLE') {
        mostrarToast({ tipo: 'error', mensaje: SES.errorNoDisponible(titulo) })
      } else {
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
  }, [])
}
