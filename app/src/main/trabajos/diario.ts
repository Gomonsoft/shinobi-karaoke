import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { escribirJsonAtomico, flush, leerJson } from '../persistencia'

/**
 * Diario de lo pendiente (`<base>/trabajos/pendientes.json`, ADR 0025 §5): lo que está en curso o en cola,
 * para retomarlo al abrir la app. Escritura atómica (ADR 0006). Lo mantienen el gestor de trabajos
 * (`fuente`, `separacion`) y la preparación (`preparacion`).
 *
 * Una entrada sale del diario cuando su trabajo termina o se cancela; **se queda** si lo que lo paró fue
 * cerrar la app. `interrumpida` cuenta cuántos arranques seguidos pilló ese trabajo en curso.
 */
export const TIPOS_PENDIENTE = ['fuente', 'separacion', 'preparacion'] as const
export type TipoPendiente = (typeof TIPOS_PENDIENTE)[number]

const entradaSchema = z.object({
  cancionId: z.string().min(1),
  tipo: z.enum(TIPOS_PENDIENTE),
  orden: z.number().int().nonnegative(),
  interrupciones: z.number().int().nonnegative().catch(0),
  /** Estaba en curso (no solo en cola) cuando se escribió por última vez. */
  enCurso: z.boolean().catch(false)
})
export type EntradaPendiente = z.infer<typeof entradaSchema>

/** Lo que usan el gestor y la preparación. */
export interface PuertoDiario {
  alta(cancionId: string, tipo: TipoPendiente): void
  enCurso(cancionId: string, tipo: TipoPendiente): void
  /** `conservar`: el trabajo se paró por el cierre de la app y debe retomarse. */
  baja(cancionId: string, tipo: TipoPendiente, conservar?: boolean): void
}

const clave = (cancionId: string, tipo: TipoPendiente): string => `${tipo}:${cancionId}`

export class DiarioPendientes implements PuertoDiario {
  private readonly ruta: string
  private readonly actuales = new Map<string, EntradaPendiente>()
  /** Entradas de la sesión anterior que aún no se han retomado: se siguen escribiendo. */
  private heredadas: EntradaPendiente[] = []
  private siguienteOrden = 0
  private cadena: Promise<unknown> = Promise.resolve()

  constructor(
    dirBase: string,
    private readonly registrar?: (nivel: 'aviso' | 'error', mensaje: string) => void
  ) {
    this.ruta = join(dirBase, 'trabajos', 'pendientes.json')
  }

  /** Lee el diario de la sesión anterior (ausente o ilegible = vacío). */
  async cargar(): Promise<void> {
    const r = await leerJson(this.ruta, (j) => z.array(entradaSchema).parse(j))
    this.heredadas = r.ok ? r.datos : []
    this.siguienteOrden = this.heredadas.reduce((m, e) => Math.max(m, e.orden + 1), 0)
  }

  /** Entrega y olvida lo heredado, en su orden. Quien lo retoma lo restaura con `restaurar`. */
  tomarHeredadas(): EntradaPendiente[] {
    const h = [...this.heredadas].sort((a, b) => a.orden - b.orden)
    this.heredadas = []
    return h
  }

  /** Vuelve a anotar una entrada heredada (con sus `interrupciones` ya sumadas) antes de relanzarla. */
  restaurar(e: EntradaPendiente): void {
    this.actuales.set(clave(e.cancionId, e.tipo), { ...e, enCurso: false })
    this.escribir()
  }

  alta(cancionId: string, tipo: TipoPendiente): void {
    const k = clave(cancionId, tipo)
    if (!this.actuales.has(k)) {
      this.actuales.set(k, {
        cancionId,
        tipo,
        orden: this.siguienteOrden++,
        interrupciones: 0,
        enCurso: false
      })
    }
    this.escribir()
  }

  enCurso(cancionId: string, tipo: TipoPendiente): void {
    const e = this.actuales.get(clave(cancionId, tipo))
    if (e && !e.enCurso) {
      e.enCurso = true
      this.escribir()
    }
  }

  baja(cancionId: string, tipo: TipoPendiente, conservar = false): void {
    if (conservar) return
    if (this.actuales.delete(clave(cancionId, tipo))) this.escribir()
  }

  /** Espera a que lo anotado esté en disco (al cerrar la app). */
  async vaciar(): Promise<void> {
    await this.cadena
    await flush(this.ruta)
  }

  private escribir(): void {
    const datos = [...this.heredadas, ...this.actuales.values()]
    this.cadena = this.cadena
      .then(() => mkdir(dirname(this.ruta), { recursive: true }))
      .then(() => escribirJsonAtomico(this.ruta, datos))
      .catch((e: unknown) =>
        this.registrar?.('aviso', `no se pudo escribir el diario de pendientes: ${String(e)}`)
      )
  }
}
