import { access, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { migrarConfig, type Config } from '../../shared'
import { escribirJsonAtomico, leerJson } from '../persistencia'
import { registroNulo, type RegistroApp } from '../registro'
import { asegurarEstructuraDatos } from './estructura'

const MODULO = 'configuracion'

/** Parcial profundo: los objetos se fusionan; arrays y valores simples se sustituyen. */
type ParcialProfundo<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: ParcialProfundo<T[K]> }
    : T

export type ConfigParcial = ParcialProfundo<Config>

export type ModoSeparacion = 'calidad' | 'rapido'

const esObjetoPlano = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function fusionar(base: unknown, parcial: unknown): unknown {
  if (!esObjetoPlano(base) || !esObjetoPlano(parcial)) return parcial
  const salida: Record<string, unknown> = { ...base }
  for (const [clave, valor] of Object.entries(parcial)) {
    if (valor === undefined) continue
    salida[clave] = fusionar(base[clave], valor)
  }
  return salida
}

/**
 * Modelo vigente (ADR 0004, Revisiones 2026-11-05): `calidad`, salvo que el usuario haya aceptado
 * usar Rápido (`rapido_aceptado`) y lo tenga como `modo`. Nunca `rapido` sin consentimiento.
 */
export function modoSeparacionVigente(config: Config): ModoSeparacion {
  const { modo, rapido_aceptado } = config.separacion
  return modo === 'rapido' && rapido_aceptado !== null ? 'rapido' : 'calidad'
}

/**
 * Modo de separación efectivo: el vigente, y Calidad si el vigente es Rápido pero ese modelo
 * no está descargado.
 */
export function modoSeparacionEfectivo(config: Config): ModoSeparacion {
  const modo = modoSeparacionVigente(config)
  return modo === 'rapido' && !config.separacion.modelos_descargados.includes('rapido')
    ? 'calidad'
    : modo
}

export interface OpcionesServicioConfig {
  registro?: RegistroApp
  /** Espera de agrupación de escrituras (ms). Por defecto, inmediata. */
  debounceMs?: number
}

export class ServicioConfig {
  private config: Config
  private readonly oyentes = new Set<(config: Config) => void>()
  private cola: Promise<unknown> = Promise.resolve()

  private constructor(
    readonly rutaConfig: string,
    inicial: Config,
    private readonly registro: RegistroApp,
    private readonly debounceMs: number
  ) {
    this.config = inicial
  }

  /**
   * Crea la estructura de datos y carga `config.json` (lo crea con los valores
   * por defecto si no existe; si está ilegible y no hay copia válida, lo aparta
   * como `config.json.danado` y parte de los valores por defecto).
   */
  static async abrir(
    datos: string,
    opciones: OpcionesServicioConfig = {}
  ): Promise<ServicioConfig> {
    const registro = opciones.registro ?? registroNulo
    await asegurarEstructuraDatos(datos)
    const ruta = join(datos, 'config.json')
    const existe = await access(ruta).then(
      () => true,
      () => false
    )
    let inicial: Config | null = null
    if (existe) {
      const r = await leerJson(ruta, migrarConfig)
      if (r.ok) {
        inicial = r.datos
        if (r.recuperadoDeBak)
          registro.escribir('aviso', MODULO, `config.json recuperado de .bak: ${ruta}`)
      } else {
        registro.escribir('error', MODULO, `config.json inválido (${r.motivo}); se aparta: ${ruta}`)
        await rename(ruta, `${ruta}.danado`).catch(() => undefined)
      }
    } else {
      registro.escribir('info', MODULO, `config.json creado con valores por defecto: ${ruta}`)
    }
    const servicio = new ServicioConfig(
      ruta,
      inicial ?? migrarConfig({}),
      registro,
      opciones.debounceMs ?? 0
    )
    // Reescribe siempre: crea el archivo si faltaba y completa campos ausentes.
    await escribirJsonAtomico(ruta, servicio.config)
    return servicio
  }

  /** Copia de la configuración vigente. */
  obtener(): Config {
    return structuredClone(this.config)
  }

  modoSeparacionEfectivo(): ModoSeparacion {
    return modoSeparacionEfectivo(this.config)
  }

  /**
   * Fusiona `parcial` con la configuración, valida el resultado y lo escribe.
   * Si no es válido lanza `ErrorDatosInvalidos` y no cambia nada. Devuelve la
   * configuración resultante.
   */
  actualizar(parcial: ConfigParcial): Promise<Config> {
    const tarea = this.cola.then(async () => {
      const candidata = migrarConfig(fusionar(this.config, parcial))
      await escribirJsonAtomico(this.rutaConfig, candidata, { debounceMs: this.debounceMs })
      this.config = candidata
      for (const cb of [...this.oyentes]) {
        try {
          cb(structuredClone(candidata))
        } catch (e) {
          this.registro.escribir('error', MODULO, `oyente de configuración falló: ${String(e)}`)
        }
      }
      return structuredClone(candidata)
    })
    this.cola = tarea.catch((e: unknown) => {
      this.registro.escribir('aviso', MODULO, `actualización rechazada: ${String(e)}`)
    })
    return tarea
  }

  /** Avisa de cada cambio con la nueva configuración. Devuelve la función para darse de baja. */
  suscribir(cb: (config: Config) => void): () => void {
    this.oyentes.add(cb)
    return () => {
      this.oyentes.delete(cb)
    }
  }
}
