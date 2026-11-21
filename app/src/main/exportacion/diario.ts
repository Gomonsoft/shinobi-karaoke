import { promises as fsp } from 'node:fs'
import { join } from 'node:path'
import { escribirJsonAtomico, leerJson, type SistemaArchivos } from '../persistencia'

/**
 * Diario `exportacion/en-curso.json` (ADR 0019 §6). Existe solo mientras hay una exportación en
 * curso; si la app cae, al arrancar se borran los restos y se avisa una sola vez.
 */

export interface EntradaDiario {
  trabajoId: string
  cancionId: string
  titulo: string
  temporal: string
  destino: string
  inicio: number
}

export interface Interrumpida {
  titulo: string
  cancionId: string
  /** Temporal que dejó la exportación (para «Mostrar en la carpeta» si no se pudo borrar). */
  temporal: string
  /** El temporal sigue ahí porque no se pudo borrar (aviso `limpieza_fallida`, 0132). */
  limpiezaFallida: boolean
}

function validar(json: unknown): EntradaDiario {
  const o = json as Partial<Record<keyof EntradaDiario, unknown>> | null
  const textos = ['trabajoId', 'cancionId', 'titulo', 'temporal', 'destino'] as const
  if (typeof o !== 'object' || o === null || textos.some((k) => typeof o[k] !== 'string')) {
    throw new Error('Diario de exportación no válido')
  }
  return o as EntradaDiario
}

export interface OpcionesDiario {
  sistema?: SistemaArchivos
  /** Solo pruebas: falla el borrado de un archivo. */
  borrarArchivo?: (ruta: string) => Promise<void>
}

export class DiarioExportacion {
  readonly ruta: string
  private readonly borrarArchivo: (ruta: string) => Promise<void>

  constructor(
    directorioDatos: string,
    private readonly opciones: OpcionesDiario = {}
  ) {
    this.ruta = join(directorioDatos, 'exportacion', 'en-curso.json')
    this.borrarArchivo = opciones.borrarArchivo ?? ((r) => fsp.rm(r, { force: true }))
  }

  async escribir(entrada: EntradaDiario): Promise<void> {
    await fsp.mkdir(join(this.ruta, '..'), { recursive: true })
    await escribirJsonAtomico(this.ruta, entrada, { sistema: this.opciones.sistema })
  }

  /** Al terminar, cancelar o fallar con el temporal ya borrado. */
  async borrar(): Promise<void> {
    await this.borrarArchivo(this.ruta)
    await this.borrarArchivo(`${this.ruta}.bak`)
    await this.borrarArchivo(`${this.ruta}.tmp`)
  }

  /**
   * Al arrancar: borra el temporal que quedara y el diario, y devuelve qué exportación se
   * interrumpió (una sola vez). `null` si no había diario.
   */
  async recuperarAlArrancar(): Promise<Interrumpida | null> {
    const r = await leerJson(this.ruta, validar, { sistema: this.opciones.sistema })
    if (!r.ok) {
      // Ausente o ilegible: no hay nada fiable que recuperar; se retiran los restos.
      await this.borrar().catch(() => undefined)
      return null
    }
    // Si el temporal no se puede borrar no se reintenta: el aviso es único (V26).
    let limpiezaFallida = false
    await this.borrarArchivo(r.datos.temporal).catch(() => {
      limpiezaFallida = true
    })
    await this.borrar()
    return {
      titulo: r.datos.titulo,
      cancionId: r.datos.cancionId,
      temporal: r.datos.temporal,
      limpiezaFallida
    }
  }
}
