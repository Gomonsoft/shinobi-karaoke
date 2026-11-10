import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import type { ResumenCancionIpc, SeleccionApariencia } from '@shared/ipc'
import type { Letra } from '@shared/letra'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion, type Vista } from '../../navegacion/estado'
import { registrarVaciadoAlCerrar } from '../../navegacion/salida'
import { GuardadoEditor, type EstadoGuardado } from './guardado'

/** Secuenciador de resúmenes vivos: la respuesta del pedido más reciente manda (ADR 0016 §9). */
export interface SecuenciaResumen {
  nuevo(): number
  aplicar(token: number, resumen: ResumenCancionIpc): void
}

interface Opciones {
  cancionId: string
  titulo: string
  obtenerSesion: () => string | null
  alDesactualizada: () => void | Promise<void>
  alSalirGuardado?: (destino: Vista) => void
  /** Hay un borrador de tema con cambios: main debe esperar al cerrar la ventana (ADR 0016 §10). */
  borradorPendiente?: boolean
  /** Primera guarda de salida: el aviso del borrador de tema (`tema.dialogo.salir`). */
  guardaBorrador?: () => Promise<boolean>
  resumenes?: SecuenciaResumen
}

export function useGuardadoEditor({
  cancionId,
  titulo,
  obtenerSesion,
  alDesactualizada,
  alSalirGuardado,
  borradorPendiente = false,
  guardaBorrador,
  resumenes
}: Opciones) {
  const { registrarGuardaSalida } = useNavegacion()
  const instancia = useRef<GuardadoEditor | null>(null)
  const confirmacion = useRef<{
    promesa: Promise<boolean>
    resolver(salir: boolean): void
  } | null>(null)
  const [estado, setEstado] = useState<EstadoGuardado['estado']>('guardado')
  const [dialogo, setDialogo] = useState(false)
  const sesion = useEffectEvent(obtenerSesion)
  const recargar = useEffectEvent(alDesactualizada)
  const tituloActual = useEffectEvent(() => titulo)
  const salidaGuardada = useEffectEvent((destino: Vista) => alSalirGuardado?.(destino))
  const guardaDeBorrador = useEffectEvent(() => guardaBorrador?.() ?? Promise.resolve(true))
  const sincronizarMain = useRef<() => void>(() => undefined)
  const borradorRef = useRef(borradorPendiente)

  useEffect(() => {
    borradorRef.current = borradorPendiente
    sincronizarMain.current()
  }, [borradorPendiente])

  const confirmarSinGuardar = useCallback((): Promise<boolean> => {
    if (confirmacion.current) return confirmacion.current.promesa
    let resolver!: (salir: boolean) => void
    const promesa = new Promise<boolean>((resuelve) => {
      resolver = resuelve
    })
    confirmacion.current = { promesa, resolver }
    setDialogo(true)
    return promesa
  }, [])

  useEffect(() => {
    let avisado = false
    let pendiente = false
    let enError = false
    const avisarMain = () => {
      const valor = (guardado.hayPendiente() || enError || borradorRef.current) ?? false
      if (valor === pendiente) return
      pendiente = valor
      void window.shinobi.app.guardadoPendiente(valor).catch(() => undefined)
    }
    sincronizarMain.current = avisarMain
    const guardado = new GuardadoEditor({
      cancionId,
      api: {
        guardarTiempos: (peticion) => {
          const id = sesion()
          return id
            ? window.shinobi.letras.guardarTiempos(peticion, id)
            : Promise.reject({ codigo: 'LETRA_DESACTUALIZADA', mensaje: 'La visita ha terminado.' })
        },
        guardarApariencia: async (id, seleccion: SeleccionApariencia) => {
          const token = resumenes?.nuevo()
          const resumen = await window.shinobi.biblioteca.guardarApariencia(id, seleccion)
          if (token !== undefined) resumenes?.aplicar(token, resumen)
          return resumen
        }
      },
      alEstado: (e) => {
        setEstado(e.estado)
        enError = e.estado === 'error'
        avisarMain()
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
    avisarMain()
    const cancelarVaciado = registrarVaciadoAlCerrar(() => guardado.vaciar())
    const cancelarGuarda = registrarGuardaSalida?.(async (destino) => {
      if (destino.tipo === 'cancion' && destino.id === cancionId && destino.paso === 'editor')
        return true
      // Primero el borrador de tema; después, el aviso de guardado de la canción.
      if (!(await guardaDeBorrador())) return false
      if (await guardado.vaciar()) {
        salidaGuardada(destino)
        return true
      }
      return confirmarSinGuardar()
    })
    return () => {
      cancelarVaciado()
      cancelarGuarda?.()
      guardado.destruir()
      instancia.current = null
      sincronizarMain.current = () => undefined
      confirmacion.current?.resolver(false)
      confirmacion.current = null
      if (pendiente) void window.shinobi.app.guardadoPendiente(false).catch(() => undefined)
    }
  }, [cancionId, confirmarSinGuardar, registrarGuardaSalida, resumenes])

  const cambiarLetra = useCallback((letra: Letra) => instancia.current?.cambiarLetra(letra), [])
  const cambiarApariencia = useCallback(
    (seleccion: SeleccionApariencia) => instancia.current?.cambiarApariencia(seleccion),
    []
  )
  const vaciar = useCallback(() => instancia.current?.vaciar() ?? Promise.resolve(true), [])

  function confirmar(salir: boolean) {
    setDialogo(false)
    confirmacion.current?.resolver(salir)
    confirmacion.current = null
  }

  return {
    estado,
    cambiarLetra,
    cambiarApariencia,
    vaciar,
    confirmarSinGuardar,
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
