import type { RolVentana } from '../../shared/canales'

/** Lo mínimo que necesita el registro de una `BrowserWindow` (se simula en las pruebas). */
export interface VentanaRegistrable {
  readonly webContents: { send(canal: string, ...args: unknown[]): void }
  once(evento: 'closed', cb: () => void): unknown
}

/**
 * Roles de ventana (ADR 0017 §1). Main asigna el rol al crear la ventana; se guarda por identidad
 * de `webContents` y nunca se deduce de una URL, un argumento ni un mensaje del renderer.
 * Hay como mucho una ventana por rol y la baja es automática al cerrarse.
 */
export class RegistroVentanas<V extends VentanaRegistrable = VentanaRegistrable> {
  private readonly ventanas = new Map<RolVentana, V>()

  registrar(ventana: V, rol: RolVentana): void {
    if (this.ventanas.has(rol)) throw new Error(`Ya hay una ventana con el rol ${rol}`)
    this.ventanas.set(rol, ventana)
    ventana.once('closed', () => {
      if (this.ventanas.get(rol) === ventana) this.ventanas.delete(rol)
    })
  }

  principal(): V | null {
    return this.ventanas.get('principal') ?? null
  }

  secundaria(): V | null {
    return this.ventanas.get('secundaria') ?? null
  }

  /**
   * Envía un evento a la ventana con ese rol (ADR 0017 §11). Si no existe, no hace nada.
   * `enviarA('principal', …)` nunca llega a la secundaria.
   */
  enviarA(rol: RolVentana, canal: string, carga: unknown): void {
    const ventana = this.ventanas.get(rol)
    if (!ventana) return
    const wc = ventana.webContents as { isDestroyed?: () => boolean }
    if (wc.isDestroyed?.()) return
    ventana.webContents.send(canal, carga)
  }

  /** Rol del `webContents` dado, o `null` si no pertenece a ninguna ventana registrada. */
  rolDe(webContents: unknown): RolVentana | null {
    if (webContents === null || webContents === undefined) return null
    for (const [rol, ventana] of this.ventanas) {
      if (ventana.webContents === webContents) return rol
    }
    return null
  }
}
