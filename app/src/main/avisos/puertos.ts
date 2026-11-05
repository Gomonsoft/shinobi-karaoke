import { appendFileSync } from 'node:fs'
import type { Dock, Notificador, Ventana } from './servicio'

/** Variable que sustituye los puertos del sistema por un registro en E2E (0072); se ignora empaquetada. */
export const VARIABLE_AVISOS_PRUEBAS = 'SHINOBI_AVISOS_PRUEBAS'

export interface PuertosAvisos {
  notificador: Notificador
  dock: Dock
}

type VentanaElectron = {
  isFocused(): boolean
  isMinimized(): boolean
  isVisible(): boolean
  flashFrame(activo: boolean): void
  show(): void
  restore(): void
  focus(): void
}
type NotificacionElectron = {
  on(evento: 'click' | 'failed', cb: () => void): unknown
  show(): void
}
interface ElectronMinimo {
  Notification: {
    new (o: { title: string; body: string }): NotificacionElectron
    isSupported(): boolean
  }
  dock?: { bounce(tipo: 'informational'): unknown; setBadge(texto: string): void } | undefined
}

/** Adaptadores de Electron a los puertos (la lógica está en `ServicioAvisos`). */
export function ventanaDeElectron(v: VentanaElectron): Ventana {
  return {
    enfocada: () => v.isFocused() && !v.isMinimized() && v.isVisible(),
    parpadear: (activo) => v.flashFrame(activo),
    traer: () => {
      if (v.isMinimized()) v.restore()
      v.show()
      v.focus()
    }
  }
}

export function puertosDeElectron(e: ElectronMinimo): PuertosAvisos {
  return {
    notificador: {
      soportado: () => e.Notification.isSupported(),
      mostrar: ({ titulo, cuerpo, alClic, alFallar }) => {
        const n = new e.Notification({ title: titulo, body: cuerpo })
        n.on('click', alClic)
        n.on('failed', alFallar)
        n.show()
      }
    },
    dock: {
      rebotar: () => void e.dock?.bounce('informational'),
      fijarInsignia: (texto) => e.dock?.setBadge(texto)
    }
  }
}

/**
 * Con `SHINOBI_AVISOS_PRUEBAS=<archivo>` los puertos escriben una línea JSON por llamada en vez de tocar
 * el sistema, y la ventana cuenta siempre como sin foco. Devuelve `null` si no aplica.
 */
export function puertosDePruebas(opciones: {
  env: NodeJS.ProcessEnv
  empaquetada: boolean
}): (PuertosAvisos & { ventana: (real: Ventana) => Ventana }) | null {
  const archivo = opciones.env[VARIABLE_AVISOS_PRUEBAS]
  if (opciones.empaquetada || !archivo) return null
  const anotar = (r: Record<string, unknown>): void =>
    appendFileSync(archivo, `${JSON.stringify(r)}\n`)
  return {
    notificador: {
      soportado: () => true,
      mostrar: ({ cuerpo }) => anotar({ tipo: 'notificacion', cuerpo })
    },
    dock: {
      rebotar: () => anotar({ tipo: 'rebote' }),
      fijarInsignia: (texto) => anotar({ tipo: 'insignia', texto })
    },
    ventana: (real) => ({
      enfocada: () => false,
      parpadear: (activo) => anotar({ tipo: 'parpadeo', activo }),
      traer: () => real.traer()
    })
  }
}
