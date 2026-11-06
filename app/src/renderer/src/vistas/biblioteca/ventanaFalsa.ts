import type { ApiShinobi } from '@shared/ipc'

export function ventanaFalsa(): ApiShinobi['ventana'] & { reposo: boolean } {
  let completa = false
  let anterior: boolean | undefined
  const oyentes = new Set<(activa: boolean) => void>()

  function fijar(activa: boolean): void {
    if (activa === completa) return
    completa = activa
    for (const oyente of oyentes) oyente(activa)
  }

  return {
    reposo: false,
    async modoReproductor(activo) {
      if (activo && anterior === undefined) {
        anterior = completa
        fijar(true)
      } else if (!activo && anterior !== undefined) {
        const restaurar = anterior
        anterior = undefined
        fijar(restaurar)
      }
    },
    async fijarPantallaCompleta(activa) {
      fijar(activa)
    },
    async estaEnPantallaCompleta() {
      return completa
    },
    async evitarReposo(activo) {
      this.reposo = activo
    },
    alCambiarPantallaCompleta(cb) {
      oyentes.add(cb)
      return () => oyentes.delete(cb)
    }
  }
}
