import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import type { Estilo } from '@shared/estilo'
import type { Letra } from '@shared/letra'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion } from '../../navegacion/estado'
import { registrarVaciadoAlCerrar } from '../../navegacion/salida'
import { GuardadoEditor, type EstadoGuardado } from './guardado'

export function useGuardadoEditor(
  cancionId: string,
  titulo: string,
  obtenerSesion: () => string | null,
  alDesactualizada: () => void | Promise<void>
) {
  const { registrarGuardaSalida } = useNavegacion()
  const instancia = useRef<GuardadoEditor | null>(null)
  const resolverSalida = useRef<((salir: boolean) => void) | null>(null)
  const [estado, setEstado] = useState<EstadoGuardado['estado']>('guardado')
  const [dialogo, setDialogo] = useState(false)
  const sesion = useEffectEvent(obtenerSesion)
  const recargar = useEffectEvent(alDesactualizada)
  const tituloActual = useEffectEvent(() => titulo)

  useEffect(() => {
    let avisado = false
    let pendiente = false
    const avisarMain = (valor: boolean) => {
      if (valor === pendiente) return
      pendiente = valor
      void window.shinobi.app.guardadoPendiente(valor).catch(() => undefined)
    }
    const guardado = new GuardadoEditor({
      cancionId,
      api: {
        guardarTiempos: (peticion) => {
          const id = sesion()
          return id
            ? window.shinobi.letras.guardarTiempos(peticion, id)
            : Promise.reject({ codigo: 'LETRA_DESACTUALIZADA', mensaje: 'La visita ha terminado.' })
        },
        guardarEstilo: (id, estilo) => window.shinobi.biblioteca.guardarEstilo(id, estilo)
      },
      alEstado: (e) => {
        setEstado(e.estado)
        avisarMain(guardado.hayPendiente() || e.estado === 'error')
        if (e.estado === 'guardado') avisado = false
        if (e.estado !== 'error' || avisado) return
        avisado = true
        mostrarToast({
          tipo: 'error',
          mensaje: `No se pudieron guardar los cambios de «${tituloActual()}». Lo seguimos intentando.`,
          accion: {
            etiqueta: 'Copiar detalles',
            alAccionar: () =>
              void navigator.clipboard
                ?.writeText(`${e.error.codigo}: ${e.error.mensaje}`)
                .catch(() => undefined)
          }
        })
      },
      alDesactualizada: async () => {
        try {
          await recargar()
        } catch {
          /* la vista muestra el estado de carga fallida */
        }
      }
    })
    instancia.current = guardado
    const cancelarVaciado = registrarVaciadoAlCerrar(() => guardado.vaciar())
    const cancelarGuarda = registrarGuardaSalida?.(async (destino) => {
      if (destino.tipo === 'cancion' && destino.id === cancionId && destino.paso === 'editor')
        return true
      if (await guardado.vaciar()) return true
      return new Promise<boolean>((resolver) => {
        resolverSalida.current = resolver
        setDialogo(true)
      })
    })
    return () => {
      cancelarVaciado()
      cancelarGuarda?.()
      guardado.destruir()
      instancia.current = null
      resolverSalida.current?.(false)
      resolverSalida.current = null
      avisarMain(false)
    }
  }, [cancionId, registrarGuardaSalida])

  const cambiarLetra = useCallback((letra: Letra) => instancia.current?.cambiarLetra(letra), [])
  const cambiarEstilo = useCallback(
    (estilo: Estilo) => instancia.current?.cambiarEstilo(estilo),
    []
  )
  const vaciar = useCallback(() => instancia.current?.vaciar() ?? Promise.resolve(true), [])

  function confirmar(salir: boolean) {
    setDialogo(false)
    resolverSalida.current?.(salir)
    resolverSalida.current = null
  }

  return {
    estado,
    cambiarLetra,
    cambiarEstilo,
    vaciar,
    dialogoSalida: (
      <Dialogo
        abierto={dialogo}
        titulo="No se pudieron guardar los últimos cambios."
        enfoqueInicial="[data-quedarme]"
        onCancelar={() => confirmar(false)}
        acciones={
          <>
            <Boton data-quedarme onClick={() => confirmar(false)}>
              Quedarme en el editor
            </Boton>
            <Boton variante="destructivo" onClick={() => confirmar(true)}>
              Salir sin guardarlos
            </Boton>
          </>
        }
      >
        <p>Si sales ahora, perderás lo que has cambiado en los últimos segundos.</p>
      </Dialogo>
    )
  }
}
