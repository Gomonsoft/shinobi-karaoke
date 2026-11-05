import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { manifiestoSchema, type Manifiesto } from '../../shared'
import type { ServicioConfig } from '../configuracion'
import type { RegistroApp } from '../registro/registroApp'
import {
  crearEspacioLibre,
  crearDetectorGpu,
  crearServicioDeteccion,
  entornoReal,
  type ServicioDeteccion
} from './deteccion'
import {
  crearGestorRuntime,
  descargadorModelosReal,
  diagnosticadorReal,
  medidorReal,
  type GestorRuntime
} from './gestor'
import { crearServicioRuntime, ultimasLineasDeRegistro, type ServicioRuntime } from './servicio'
import { crearEjecutorUv, resolverUv } from './uv'
import { crearDoblesRuntime, manifiestoParaEscenario, type EscenarioRuntimeFalso } from './falso'

/** Recursos del runtime en disco: empaquetado, `process.resourcesPath`; si no, el repo (ADR 0009 §2). */
export interface RutasRecursosRuntime {
  manifiesto: string
  raizRecursos: string
  rutaCodigoWorker: string
}

export function rutasRecursosRuntime(o: {
  empaquetada: boolean
  dirRecursos: string
  dirApp: string
}): RutasRecursosRuntime {
  if (o.empaquetada) {
    return {
      manifiesto: join(o.dirRecursos, 'runtime-manifest.json'),
      raizRecursos: o.dirRecursos,
      rutaCodigoWorker: join(o.dirRecursos, 'worker')
    }
  }
  const repo = join(o.dirApp, '..')
  return {
    manifiesto: join(o.dirApp, 'resources', 'runtime-manifest.json'),
    raizRecursos: repo,
    rutaCodigoWorker: join(repo, 'worker')
  }
}

export interface OpcionesRuntimeReal {
  datos: string
  empaquetada: boolean
  dirRecursos: string
  dirApp: string
  plataforma: NodeJS.Platform
  /** `app.runningUnderARM64Translation` (Rosetta / x64 en Windows on ARM, preguntas/0014). */
  ejecutandoBajoTraduccionArm64: boolean
  versionApp: string
  descripcionSo: string
  config: ServicioConfig
  registro: RegistroApp
  env?: Record<string, string | undefined>
  /** `SHINOBI_RUNTIME_FALSO` ya cargado y con la app sin empaquetar (0039, ADR 0009 §8). */
  falso?: { escenario: EscenarioRuntimeFalso; ruta: string } | null
  /** Oferta de Rápido de la separación (0066); se enlaza tarde porque el servicio de separación nace después. */
  ofertaSeparacionVigente?: () => boolean
}

export interface RuntimeReal {
  manifiesto: Manifiesto
  deteccion: ServicioDeteccion
  gestor: GestorRuntime
  servicio: ServicioRuntime
}

/** Compone el runtime con los puertos reales (el resto de piezas dependen solo de interfaces). */
export function crearRuntimeReal(o: OpcionesRuntimeReal): RuntimeReal {
  const rutas = rutasRecursosRuntime(o)
  const manifiestoBase = manifiestoSchema.parse(JSON.parse(readFileSync(rutas.manifiesto, 'utf8')))
  const manifiesto = o.falso
    ? manifiestoParaEscenario(manifiestoBase, o.falso.escenario)
    : manifiestoBase
  const dobles = o.falso
    ? crearDoblesRuntime({
        escenario: o.falso.escenario,
        rutaEscenario: o.falso.ruta,
        manifiesto,
        plataformaSO: o.plataforma
      })
    : null
  const dirRegistros = join(o.datos, 'registros')
  const espacio = dobles?.espacio ?? crearEspacioLibre()
  const deteccion = crearServicioDeteccion(
    {
      manifiesto,
      rutaDatos: o.datos,
      detectorGpu: dobles?.detectorGpu ?? crearDetectorGpu(),
      espacio,
      entorno: dobles?.entorno ?? entornoReal(o.ejecutandoBajoTraduccionArm64)
    },
    o.config
  )
  const uv = resolverUv({
    empaquetada: o.empaquetada,
    dirRecursos: o.dirRecursos,
    plataforma: o.plataforma,
    ...(o.env ? { env: o.env } : {})
  })
  const gestor = crearGestorRuntime({
    datos: o.datos,
    manifiesto,
    config: o.config,
    deteccion,
    ejecutorUv:
      dobles?.ejecutorUv ?? crearEjecutorUv({ uv, dirRegistros, plataforma: o.plataforma }),
    diagnosticador: dobles?.diagnosticador ?? diagnosticadorReal,
    descargador: dobles?.descargador ?? descargadorModelosReal,
    medidor: medidorReal,
    espacio,
    raizRecursos: rutas.raizRecursos,
    rutaCodigoWorker: rutas.rutaCodigoWorker,
    registro: o.registro,
    plataformaSO: o.plataforma
  })
  const servicio = crearServicioRuntime({
    gestor,
    config: o.config,
    deteccion,
    manifiesto,
    datos: o.datos,
    versionApp: o.versionApp,
    descripcionSo: o.descripcionSo,
    ultimasLineasRegistro: (n) => ultimasLineasDeRegistro(dirRegistros, 'runtime', n),
    registrar: (nivel, m) => o.registro.escribir(nivel, 'runtime', m),
    ...(o.ofertaSeparacionVigente ? { ofertaSeparacionVigente: o.ofertaSeparacionVigente } : {})
  })
  return { manifiesto, deteccion, gestor, servicio }
}
