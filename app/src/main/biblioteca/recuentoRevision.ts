import type { Cancion, RevisionResumenIpc } from '../../shared'
import type { EventoCancion } from './operaciones'

/** Lo que el recuento necesita de la biblioteca. */
export interface BibliotecaRecuento {
  listar(): { id: string; modificada: string; estadoPreparacion?: string | null }[]
  obtener(id: string): Cancion | null
  suscribir(cb: (evento: EventoCancion) => void): () => void
}

export interface DependenciasRecuento {
  biblioteca: BibliotecaRecuento
  /** `contarDudosasGuardadas`: `null` sin letra. */
  contar(c: Cancion): Promise<{ dudosas: number; importantes: number } | null>
  registrar?(nivel: 'aviso', mensaje: string): void
}

const igual = (a: RevisionResumenIpc | null, b: RevisionResumenIpc | null): boolean =>
  a === b ||
  (!!a && !!b && a.dudosas === b.dudosas && a.dudosasImportantes === b.dudosasImportantes)

/**
 * Recuento de líneas por revisar de toda «Lista para revisar», tenga o no registro de preparación (ADR 0024,
 * revisión de la pregunta 0241). Solo vive en memoria: no escribe en `cancion.json` ni crea `preparacion`.
 * Se calcula en segundo plano, en serie, y se invalida con `modificada` (cada escritura de la letra) o con
 * los picos (`recalcular`).
 */
export class RecuentoRevision {
  private readonly cache = new Map<
    string,
    { modificada: string; valor: RevisionResumenIpc | null }
  >()
  private readonly cola: string[] = []
  private enMarcha = false
  private baja: (() => void) | null = null
  private readonly oyentes = new Set<(id: string) => void>()

  constructor(private readonly deps: DependenciasRecuento) {}

  /** Empieza a mirar la biblioteca y calcula en segundo plano las que ya están listas para revisar. */
  arrancar(): void {
    this.baja = this.deps.biblioteca.suscribir((e) => {
      if (e.eliminada === true) {
        this.cache.delete(e.id)
        return
      }
      const r = e.resumen
      if (
        r.estadoPreparacion === 'lista_para_revisar' &&
        this.cache.get(e.id)?.modificada !== r.modificada
      ) {
        this.encolar(e.id)
      }
    })
    for (const r of this.deps.biblioteca.listar()) {
      if (r.estadoPreparacion === 'lista_para_revisar') this.encolar(r.id)
    }
  }

  cerrar(): void {
    this.baja?.()
    this.baja = null
    this.oyentes.clear()
    this.cola.length = 0
  }

  /** Se avisa (con el id) cuando un recuento calculado cambia el valor que ya se conocía. */
  suscribir(cb: (id: string) => void): () => void {
    this.oyentes.add(cb)
    return () => this.oyentes.delete(cb)
  }

  /** Valor en memoria vigente para esa versión de la canción; `undefined` si aún no se ha calculado. */
  valor(id: string, modificada: string): RevisionResumenIpc | null | undefined {
    const e = this.cache.get(id)
    return e && e.modificada === modificada ? e.valor : undefined
  }

  /** Los picos de la canción acaban de quedar listos: se vuelve a calcular. */
  recalcular(id: string): void {
    this.cache.delete(id)
    const c = this.deps.biblioteca.obtener(id)
    if (c) this.encolar(id)
  }

  /** Calcula al momento (`biblioteca.recuentoRevision`). */
  async calcular(id: string): Promise<RevisionResumenIpc | null> {
    const cancion = this.deps.biblioteca.obtener(id)
    if (!cancion) return null
    const r = await this.deps.contar(cancion)
    const valor = r ? { dudosas: r.dudosas, dudosasImportantes: r.importantes } : null
    const previo = this.cache.get(id)
    this.cache.set(id, { modificada: cancion.modificada, valor })
    if (!previo || previo.modificada !== cancion.modificada || !igual(previo.valor, valor)) {
      for (const cb of this.oyentes) cb(id)
    }
    return valor
  }

  private encolar(id: string): void {
    if (!this.cola.includes(id)) this.cola.push(id)
    void this.bombear()
  }

  private async bombear(): Promise<void> {
    if (this.enMarcha) return
    this.enMarcha = true
    try {
      for (let id = this.cola.shift(); id !== undefined; id = this.cola.shift()) {
        try {
          await this.calcular(id)
        } catch (e) {
          this.deps.registrar?.('aviso', `recuento de revisión (${id}): ${String(e)}`)
        }
      }
    } finally {
      this.enMarcha = false
    }
  }
}
