import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const MAX_BYTES_REGISTRO_APP = 5 * 1024 * 1024
/** Archivos conservados: `app.log`, `app.1.log` y `app.2.log`. */
export const MAX_ARCHIVOS_REGISTRO_APP = 3

export type NivelRegistro = 'debug' | 'info' | 'aviso' | 'error'

export interface RegistroApp {
  escribir(nivel: NivelRegistro, modulo: string, mensaje: string): void
}

/** Registro nulo (pruebas y uso sin disco). */
export const registroNulo: RegistroApp = { escribir: () => undefined }

/**
 * Registro de la app en `registros/app.log`: una línea por evento con fecha ISO,
 * nivel y módulo. Rota al llegar a 5 MB (app.log → app.1.log → app.2.log).
 * No registrar datos personales salvo rutas. Nunca lanza.
 */
export class RegistroArchivo implements RegistroApp {
  private preparado = false

  constructor(
    private readonly dir: string,
    private readonly ahora: () => Date = () => new Date(),
    private readonly maxBytes = MAX_BYTES_REGISTRO_APP
  ) {}

  escribir(nivel: NivelRegistro, modulo: string, mensaje: string): void {
    try {
      if (!this.preparado) {
        mkdirSync(this.dir, { recursive: true })
        this.preparado = true
      }
      const ruta = join(this.dir, 'app.log')
      this.rotarSiGrande(ruta)
      const limpio = mensaje.replace(/\r?\n/g, ' ⏎ ')
      const linea = `${this.ahora().toISOString()} [${nivel.toUpperCase()}] [${modulo}] ${limpio}\n`
      appendFileSync(ruta, linea, 'utf8')
    } catch {
      // un fallo de disco no debe romper la app
    }
  }

  private rotarSiGrande(ruta: string): void {
    let tam: number
    try {
      tam = statSync(ruta).size
    } catch {
      return
    }
    if (tam < this.maxBytes) return
    const numerado = (n: number): string => join(this.dir, `app.${n}.log`)
    rmSync(numerado(MAX_ARCHIVOS_REGISTRO_APP - 1), { force: true })
    for (let n = MAX_ARCHIVOS_REGISTRO_APP - 2; n >= 1; n--) {
      try {
        renameSync(numerado(n), numerado(n + 1))
      } catch {
        // no existe
      }
    }
    renameSync(ruta, numerado(1))
  }
}
