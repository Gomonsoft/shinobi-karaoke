export type TitularReposo = 'local' | 'sesion'

/** Subconjunto de `powerSaveBlocker`. */
export interface BloqueadorReposo {
  start(tipo: 'prevent-display-sleep'): number
  stop(id: number): void
  isStarted(id: number): boolean
}

/**
 * Un único bloqueo de `prevent-display-sleep` con varios titulares (ADR 0017 §4): se mantiene
 * mientras haya alguno. El reproductor local retiene como `local` y la sesión como `sesion`.
 */
export class GestorReposo {
  private readonly titulares = new Set<TitularReposo>()
  private bloqueo: number | null = null

  constructor(private readonly bloqueador: BloqueadorReposo) {}

  retener(titular: TitularReposo): void {
    this.titulares.add(titular)
    const id = this.bloqueo
    if (id === null || !this.bloqueador.isStarted(id)) {
      this.bloqueo = this.bloqueador.start('prevent-display-sleep')
    }
  }

  liberar(titular: TitularReposo): void {
    this.titulares.delete(titular)
    if (this.titulares.size === 0) this.soltar()
  }

  liberarTodo(): void {
    this.titulares.clear()
    this.soltar()
  }

  private soltar(): void {
    const id = this.bloqueo
    if (id !== null && this.bloqueador.isStarted(id)) this.bloqueador.stop(id)
    this.bloqueo = null
  }
}
