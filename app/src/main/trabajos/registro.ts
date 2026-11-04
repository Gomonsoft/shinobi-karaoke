import { appendFileSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const MAX_BYTES_REGISTRO = 5 * 1024 * 1024
export const MAX_ARCHIVOS_REGISTRO = 7

/** Fecha local `YYYY-MM-DD`. */
export function fechaLocal(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Registro de la salida de error del worker en `registros/worker-<fecha>.log`.
 * Rotación: un archivo por día, se conservan los últimos 7 y, si uno pasa de
 * 5 MB, el contenido anterior pasa a `worker-<fecha>.1.log` (sustituyendo al previo).
 * Nunca lanza: un fallo de disco no debe romper el trabajo.
 */
export class RegistroWorker {
  private preparado = false

  constructor(
    private readonly dir: string,
    private readonly ahora: () => Date = () => new Date()
  ) {}

  escribir(linea: string): void {
    try {
      const fecha = fechaLocal(this.ahora())
      if (!this.preparado) {
        mkdirSync(this.dir, { recursive: true })
        this.podar()
        this.preparado = true
      }
      const ruta = join(this.dir, `worker-${fecha}.log`)
      this.rotarSiGrande(ruta, join(this.dir, `worker-${fecha}.1.log`))
      const hora = this.ahora().toISOString()
      appendFileSync(ruta, `${hora} ${linea}\n`, 'utf8')
    } catch {
      // ignorado a propósito
    }
  }

  private rotarSiGrande(ruta: string, anterior: string): void {
    try {
      if (statSync(ruta).size >= MAX_BYTES_REGISTRO) renameSync(ruta, anterior)
    } catch {
      // el archivo aún no existe
    }
  }

  private podar(): void {
    const dias = new Set(
      readdirSync(this.dir)
        .map((n) => /^worker-(\d{4}-\d{2}-\d{2})(\.1)?\.log$/.exec(n)?.[1])
        .filter((d): d is string => d !== undefined)
    )
    const ordenados = [...dias].sort()
    const sobran = ordenados.slice(0, Math.max(0, ordenados.length - (MAX_ARCHIVOS_REGISTRO - 1)))
    for (const d of sobran) {
      rmSync(join(this.dir, `worker-${d}.log`), { force: true })
      rmSync(join(this.dir, `worker-${d}.1.log`), { force: true })
    }
  }
}

/** Conserva las últimas `max` líneas. */
export class ColaLineas {
  private lineas: string[] = []
  constructor(private readonly max = 50) {}
  añadir(linea: string): void {
    this.lineas.push(linea)
    if (this.lineas.length > this.max) this.lineas.shift()
  }
  texto(): string {
    return this.lineas.join('\n')
  }
}
