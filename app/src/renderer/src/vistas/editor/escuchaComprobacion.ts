import type { MotorAudio } from '../../karaoke/motorAudio'

type Puerto = Pick<
  MotorAudio,
  'estado' | 'posicionMs' | 'reproducir' | 'pausar' | 'buscar' | 'suscribir'
>
type Temporizador = { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout }

export class EscuchaComprobacion {
  private timer: ReturnType<typeof setTimeout> | undefined
  private previa: number | null = null
  private baja: (() => void) | null = null
  private intento = 0

  constructor(
    private readonly motor: Puerto,
    // Envueltos: `window.setTimeout` llamado como método de otro objeto lanza "Illegal invocation".
    private readonly reloj: Temporizador = {
      setTimeout: ((f: () => void, ms?: number) => setTimeout(f, ms)) as typeof setTimeout,
      clearTimeout: ((t?: ReturnType<typeof setTimeout>) => clearTimeout(t)) as typeof clearTimeout
    }
  ) {}

  escuchar(centroMs: number, campo: 'inicio' | 'fin'): void {
    if (this.previa === null && this.motor.estado().sonando) return
    this.previa ??= this.motor.posicionMs()
    this.reloj.clearTimeout(this.timer)
    const intento = ++this.intento
    this.timer = this.reloj.setTimeout(() => {
      const antes = campo === 'inicio' ? 1000 : 2000
      const despues = campo === 'inicio' ? 2000 : 1000
      const desdeMs = Math.max(0, centroMs - antes)
      const hastaMs = Math.min(this.motor.estado().duracionMs ?? Infinity, centroMs + despues)
      this.baja?.()
      this.baja = this.motor.suscribir((e) => {
        if (!e.sonando && this.intento === intento) this.restaurar()
      })
      void this.motor.reproducir({ desdeMs, hastaMs }).then(
        () => {
          if (this.intento === intento && !this.motor.estado().sonando) this.restaurar()
        },
        () => {
          if (this.intento === intento) this.restaurar()
        }
      )
    }, 400)
  }

  private restaurar(): void {
    const posicion = this.previa
    this.cancelar()
    if (posicion !== null) {
      this.motor.pausar()
      this.motor.buscar(posicion)
    }
  }

  cancelar(): void {
    this.intento++
    this.reloj.clearTimeout(this.timer)
    this.timer = undefined
    this.baja?.()
    this.baja = null
    this.previa = null
  }
}
