import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { EstadoSesionIpc, ListaPantallasIpc, PosicionSesionIpc } from '@shared/sesion'
import { crearAcciones, type AccionesSesion } from './acciones'
import { DialogoBloqueo } from './DialogoBloqueo'
import { aplicarEstado, edicionBloqueada, haySesion } from './estadoSesion'

export interface Sesion {
  /** `null` hasta la primera lectura. */
  estado: EstadoSesionIpc | null
  haySesion: boolean
  /** `true` mientras haya sesión (spec 06): Letra, Editor y la escucha de Progreso quedan bloqueados. */
  edicionBloqueada: boolean
  /** Instante (`Date.now()`) en que llegó `estado`: base de los relojes locales de la cuenta. */
  recibidoEn: number
  /** Última posición de la entrada activa (≤ 1 por segundo). */
  posicion: PosicionSesionIpc | null
  pantallas: ListaPantallasIpc | null
  /** Panel «Cola de reproducción» abierto; en memoria durante la vida de la app. */
  panelAbierto: boolean
  abrirPanel(): void
  cerrarPanel(): void
  /** Abre el diálogo `edi.bloqueo`; el foco vuelve al elemento que lo tenía. */
  abrirBloqueo(): void
  acciones: AccionesSesion
}

const sinAcciones = new Proxy({} as AccionesSesion, {
  get: () => () => Promise.reject(new Error('Sesión no disponible'))
})

/** Valor sin sesión: lo que ven los componentes fuera de `ProveedorSesion` (pruebas, muestrario). */
export const sesionVacia: Sesion = {
  estado: null,
  recibidoEn: 0,
  haySesion: false,
  edicionBloqueada: false,
  posicion: null,
  pantallas: null,
  panelAbierto: false,
  abrirPanel: () => {},
  cerrarPanel: () => {},
  abrirBloqueo: () => {},
  acciones: sinAcciones
}

export const SesionContexto = createContext<Sesion>(sesionVacia)

export function useSesion(): Sesion {
  return useContext(SesionContexto)
}

/**
 * Estado de la sesión en la ventana principal (ADR 0017 §11): lee `sesion.estado()` al montar y
 * sigue los eventos `alCambiarSesion` (solo avanza con revisiones mayores), `alPosicionSesion` y
 * `alCambiarPantallas`.
 */
export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [recibido, setRecibido] = useState<{ estado: EstadoSesionIpc | null; en: number }>({
    estado: null,
    en: 0
  })
  const { estado, en: recibidoEn } = recibido
  const [posicion, setPosicion] = useState<PosicionSesionIpc | null>(null)
  const [pantallas, setPantallas] = useState<ListaPantallasIpc | null>(null)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [bloqueo, setBloqueo] = useState(false)

  const aplicar = useCallback((nuevo: EstadoSesionIpc) => {
    const ahora = Date.now()
    setRecibido((actual) => {
      const vigente = aplicarEstado(actual.estado, nuevo)
      return vigente === actual.estado ? actual : { estado: vigente, en: ahora }
    })
  }, [])
  const acciones = useMemo(() => crearAcciones(() => window.shinobi, aplicar), [aplicar])

  useEffect(() => {
    let activo = true
    const bajas: (() => void)[] = []
    const suscribir = (alta: () => () => void) => {
      try {
        bajas.push(alta())
      } catch {
        // Sin la API de sesión (p. ej. el muestrario) no hay nada que seguir.
      }
    }
    const api = window.shinobi
    suscribir(() => api.alCambiarSesion((e) => activo && aplicar(e)))
    suscribir(() => api.alPosicionSesion((p) => activo && setPosicion(p)))
    suscribir(() => api.alCambiarPantallas((l) => activo && setPantallas(l)))
    // Los eventos que lleguen antes de las lecturas ganan por revisión.
    void Promise.resolve()
      .then(() => api.sesion.estado())
      .then((e) => activo && aplicar(e))
      .catch(() => undefined)
    void Promise.resolve()
      .then(() => api.pantallas.listar())
      .then((l) => activo && setPantallas((actual) => actual ?? l))
      .catch(() => undefined)
    return () => {
      activo = false
      bajas.forEach((baja) => baja())
    }
  }, [aplicar])

  const hay = haySesion(estado)
  const valor = useMemo<Sesion>(
    () => ({
      estado,
      recibidoEn,
      haySesion: hay,
      edicionBloqueada: edicionBloqueada(estado),
      posicion: hay ? posicion : null,
      pantallas,
      panelAbierto,
      abrirPanel: () => setPanelAbierto(true),
      cerrarPanel: () => setPanelAbierto(false),
      abrirBloqueo: () => setBloqueo(true),
      acciones
    }),
    [estado, recibidoEn, hay, posicion, pantallas, panelAbierto, acciones]
  )

  return (
    <SesionContexto.Provider value={valor}>
      {children}
      <DialogoBloqueo
        abierto={bloqueo}
        alCerrar={() => setBloqueo(false)}
        alCerrarReproductor={() => {
          setBloqueo(false)
          // La confirmación con cola, si hace falta, llega por el estado (`cierrePendiente`).
          void acciones.solicitarCierre().catch(() => undefined)
        }}
      />
    </SesionContexto.Provider>
  )
}
