import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { promises as fsp } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { Manifiesto, PerfilHardware } from '../../../shared'
import {
  perfilPrevisto,
  type DetectorGpu,
  type EntornoDeteccion,
  type EspacioLibre
} from '../deteccion'
import {
  interpreteVenv,
  type DescargadorModelos,
  type Diagnosticador,
  type ResultadoDiagnostico
} from '../gestor'
import { ErrorRuntime, type EjecutorUv, type ResultadoUv } from '../uv'
import { contenidoDiminuto, type EscenarioRuntimeFalso } from './escenario'

/** Dobles del gestor de runtime que siguen un escenario (tarea 0039, ADR 0009 §8). */

export interface DoblesRuntime {
  ejecutorUv: EjecutorUv
  diagnosticador: Diagnosticador
  descargador: DescargadorModelos
  espacio: EspacioLibre
  detectorGpu: DetectorGpu
  entorno: EntornoDeteccion
}

const PASO_MS = 50

const ENTORNO: Record<EscenarioRuntimeFalso['plataforma'], EntornoDeteccion> = {
  'darwin-arm64': { platform: 'darwin', arch: 'arm64', emulada: false, versionSo: '15.0' },
  'win32-x64': { platform: 'win32', arch: 'x64', emulada: false, versionSo: '10.0.22631' },
  'linux-x64': { platform: 'linux', arch: 'x64', emulada: false, versionSo: '6.8.0' }
}

const dormir = (ms: number, señal?: AbortSignal): Promise<void> =>
  new Promise((res) => {
    if (señal?.aborted) return res()
    const t = setTimeout(res, ms)
    señal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        res()
      },
      { once: true }
    )
  })

/** Crece un archivo disperso hasta `bytes` en `ms`; devuelve `false` si se canceló. */
async function crecer(
  ruta: string,
  bytes: number,
  ms: number,
  señal?: AbortSignal
): Promise<boolean> {
  await fsp.mkdir(dirname(ruta), { recursive: true })
  const fh = await fsp.open(ruta, 'w')
  try {
    const pasos = Math.max(1, Math.ceil(ms / PASO_MS))
    for (let i = 1; i <= pasos; i++) {
      await dormir(ms / pasos, señal)
      if (señal?.aborted) return false
      await fh.truncate(Math.floor((bytes * i) / pasos))
    }
    return true
  } finally {
    await fh.close()
  }
}

export function crearDoblesRuntime(o: {
  escenario: EscenarioRuntimeFalso
  /** Ruta del `escenario.json` (el registro de llamadas y `desdeArchivo` son relativos a su carpeta). */
  rutaEscenario: string
  /** Manifiesto ya adaptado al escenario. */
  manifiesto: Manifiesto
  plataformaSO?: NodeJS.Platform
}): DoblesRuntime {
  const { escenario, manifiesto } = o
  const dirEscenario = dirname(resolve(o.rutaEscenario))
  const entorno = ENTORNO[escenario.plataforma]
  const gpu = escenario.gpu ? { nombre: escenario.gpu.nombre, vramMb: escenario.gpu.vramMb } : null
  const previsto: PerfilHardware = perfilPrevisto(escenario.plataforma, gpu) ?? 'cpu'
  const so = o.plataformaSO ?? process.platform
  const rutaLlamadas = resolve(dirEscenario, escenario.llamadas ?? 'llamadas.jsonl')

  const anotar = (llamada: Record<string, unknown>): void => {
    mkdirSync(dirname(rutaLlamadas), { recursive: true })
    appendFileSync(rutaLlamadas, `${JSON.stringify(llamada)}\n`)
  }

  const fallos = new Map<string, number>()
  /** Lanza el fallo del escenario si toca en esta fase. */
  const posibleFallo = (fase: 'motor' | 'componentes' | 'diagnostico' | 'modelo'): void => {
    const f = escenario.fallo
    if (!f || f.fase !== fase) return
    const n = (fallos.get(fase) ?? 0) + 1
    fallos.set(fase, n)
    if (f.veces === 'siempre' || n <= f.veces) {
      throw new ErrorRuntime(f.codigo, `Fallo simulado en ${fase}`, `escenario: ${f.codigo}`)
    }
  }

  const bytesMotor = manifiesto.python.bytes_descarga[escenario.plataforma] ?? 0
  const bytesComponentes = manifiesto.runtime[escenario.plataforma]?.[previsto]?.bytes_descarga ?? 0

  const resultado = (sobre: Partial<ResultadoUv> = {}): ResultadoUv => ({
    codigo: 0,
    stdout: '',
    ultimasLineas: [],
    cancelado: false,
    ...sobre
  })

  const ejecutorUv: EjecutorUv = {
    async ejecutar(args, opciones) {
      const orden = args.filter((a) => a !== '--no-config')
      anotar({ t: 'uv', args: orden.slice(0, 2).join(' ') })
      const dirCache = opciones.env.UV_CACHE_DIR ?? join(dirEscenario, 'cache-uv')
      const dirPython = opciones.env.UV_PYTHON_INSTALL_DIR ?? join(dirEscenario, 'python')
      const señal = opciones.señal
      const [a, b] = orden
      if (a === 'python' && b === 'install') {
        const ok = await crecer(
          join(dirPython, 'cpython', 'bin', 'python'),
          bytesMotor,
          escenario.fases.motor.ms,
          señal
        )
        if (!ok) return resultado({ cancelado: true, codigo: 1 })
        posibleFallo('motor')
        return resultado()
      }
      if (a === 'python' && b === 'find') {
        return resultado({ stdout: `${join(dirPython, 'cpython', 'bin', 'python')}\n` })
      }
      if (a === 'venv') {
        const dirVenv = orden[orden.length - 1] as string
        const interprete = interpreteVenv(join(dirVenv, '..'), so)
        await fsp.mkdir(dirname(interprete), { recursive: true })
        await fsp.writeFile(interprete, '#!/bin/sh\n')
        return resultado()
      }
      if (a === 'pip' && b === 'install') {
        const ok = await crecer(
          join(dirCache, 'wheels', 'componentes.bin'),
          bytesComponentes,
          escenario.fases.componentes.ms,
          señal
        )
        if (!ok) return resultado({ cancelado: true, codigo: 1 })
        posibleFallo('componentes')
        return resultado()
      }
      if (a === 'cache' && b === 'clean') {
        await fsp.rm(dirCache, { recursive: true, force: true })
        return resultado()
      }
      throw new ErrorRuntime('ERROR_INTERNO', `uv falso: orden no prevista (${orden.join(' ')})`)
    }
  }

  const diagnosticador: Diagnosticador = {
    async diagnosticar({ señal }) {
      anotar({ t: 'diagnostico' })
      await dormir(escenario.fases.diagnostico.ms, señal)
      if (señal?.aborted) throw new Error('cancelado')
      posibleFallo('diagnostico')
      const d: ResultadoDiagnostico = {
        perfil: escenario.diagnostico.perfil ?? previsto,
        gpu: gpu?.nombre ?? null,
        vram_mb: gpu?.vramMb ?? null,
        motivo_rebaja: escenario.diagnostico.motivoRebaja
      }
      return d
    }
  }

  const descargador: DescargadorModelos = {
    async descargar(modelo, { dirModelos, señal, alProgreso }) {
      anotar({ t: 'descarga', modelo: modelo.id })
      await fsp.mkdir(dirModelos, { recursive: true })
      const archivos = [
        { archivo: modelo.archivo, bytes: modelo.bytes },
        ...modelo.extra.map((e) => ({ archivo: e.archivo, bytes: e.bytes }))
      ]
      const total = archivos.reduce((s, f) => s + f.bytes, 0)
      let antes = 0
      for (const f of archivos) {
        const destino = join(dirModelos, f.archivo)
        const parcial = `${destino}.descarga`
        const ms = (escenario.fases.modelo.ms * f.bytes) / Math.max(1, total)
        if (escenario.modelos === 'diminutos') {
          await dormir(ms, señal)
          if (señal?.aborted) throw new Error('cancelado')
          if (escenario.fallo?.fase === 'modelo') posibleFallo('modelo')
          await fsp.writeFile(parcial, contenidoDiminuto(f.archivo))
        } else {
          // Archivo disperso que crece; el progreso lo notifica el propio bucle.
          const pasos = Math.max(1, Math.ceil(ms / PASO_MS))
          const fh = await fsp.open(parcial, 'w')
          try {
            for (let i = 1; i <= pasos; i++) {
              await dormir(ms / pasos, señal)
              if (señal?.aborted) throw new Error('cancelado')
              const hecho = Math.floor((f.bytes * i) / pasos)
              await fh.truncate(hecho)
              alProgreso?.({ bytes: antes + hecho, total })
            }
          } finally {
            await fh.close()
          }
          posibleFallo('modelo')
        }
        await fsp.rename(parcial, destino)
        antes += f.bytes
        alProgreso?.({ bytes: antes, total })
      }
    }
  }

  const espacio: EspacioLibre = {
    async bytesLibres() {
      const e = escenario.espacioLibre
      if (typeof e === 'number') return e
      const n = Number(readFileSync(resolve(dirEscenario, e.desdeArchivo), 'utf8').trim())
      if (!Number.isFinite(n)) throw new Error('espacioLibre: el archivo no contiene un número')
      return n
    }
  }

  return {
    ejecutorUv,
    diagnosticador,
    descargador,
    espacio,
    detectorGpu: { detectar: async () => gpu },
    entorno
  }
}
