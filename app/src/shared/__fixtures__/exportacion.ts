/**
 * Fixtures y API falsa de la exportación (0230) para las pruebas de main, de la ventana de
 * exportación y de la interfaz (0233–0241). Cada llamada construye datos nuevos.
 */
import { estiloPredeterminado } from '../estilo'
import {
  combinaciones,
  nombrePropuesto,
  totalFotogramas,
  type AvisoExportacionIpc,
  type DestinoIpc,
  type ExportacionIpc,
  type InicialExportacionIpc,
  type InstantaneaExportacion,
  type PerfilesIpc,
  type ProgresoExportacionIpc
} from '../exportacion'
import type { ApiShinobi } from '../ipc'
import { letraSincronizada } from './index'

export const ID_TRABAJO = 'b0000000-0000-4000-8000-000000000001'
export const ID_DESTINO = 'c0000000-0000-4000-8000-000000000001'
export const ID_CARPETA = 'c0000000-0000-4000-8000-000000000002'
export const ID_LOTE = 'd0000000-0000-4000-8000-000000000001'

export function instantaneaDePrueba(
  sobrescribir: Partial<InstantaneaExportacion> = {}
): InstantaneaExportacion {
  return {
    titulo: 'Canción de prueba',
    artista: 'Artista',
    duracionMs: 40_000,
    letra: letraSincronizada(),
    estilo: estiloPredeterminado(),
    modalidad: 'karaoke',
    gananciaDb: -2.5,
    vozDisponible: true,
    ...sobrescribir
  }
}

export function inicialDePrueba(
  sobrescribir: Partial<InicialExportacionIpc> = {}
): InicialExportacionIpc {
  const instantanea = sobrescribir.instantanea ?? instantaneaDePrueba()
  const fps = sobrescribir.fps ?? 30
  return {
    trabajoId: ID_TRABAJO,
    instantanea,
    ancho: 1280,
    alto: 720,
    fps,
    total: totalFotogramas(instantanea.duracionMs, fps),
    ...sobrescribir
  }
}

/** Las 48 combinaciones, todas soportadas salvo que se indique lo contrario. */
export function perfilesDePrueba(
  noSoportado: (
    p: PerfilesIpc['perfiles'][number]
  ) => PerfilesIpc['perfiles'][number]['motivo'] = () => null
): PerfilesIpc {
  return {
    formatos: [
      { id: 'mkv_av1', extension: 'mkv' },
      { id: 'webm_vp9', extension: 'webm' }
    ],
    perfiles: combinaciones().map((c) => {
      const base = { ...c, soportado: true, motivo: null as null }
      const motivo = noSoportado(base)
      return motivo ? { ...base, soportado: false, motivo } : base
    })
  }
}

export function destinoDePrueba(sobrescribir: Partial<DestinoIpc> = {}): DestinoIpc {
  return {
    destinoId: ID_DESTINO,
    ruta: `/home/usuario/Videos/${nombrePropuesto('Canción de prueba', 'Artista', 'mkv')}`,
    existe: false,
    libreBytes: 50_000_000_000,
    carpetaRecordadaNoDisponible: false,
    ...sobrescribir
  }
}

export function progresoDePrueba(
  sobrescribir: Partial<ProgresoExportacionIpc> = {}
): ProgresoExportacionIpc {
  return {
    trabajoId: ID_TRABAJO,
    fase: 'codificando',
    valor: 0.5,
    fotograma: 600,
    total: 1200,
    posicionMs: 20_000,
    duracionMs: 40_000,
    etaSegundos: 30,
    ...sobrescribir
  }
}

export function exportacionDePrueba(sobrescribir: Partial<ExportacionIpc> = {}): ExportacionIpc {
  return {
    trabajoId: ID_TRABAJO,
    cancionId: '6f1c2a10-0000-4000-8000-000000000001',
    titulo: 'Canción de prueba',
    artista: 'Artista',
    formato: 'mkv_av1',
    ancho: 1920,
    alto: 1080,
    fps: 30,
    audio: 'instrumental',
    estado: 'en_curso',
    posicion: null,
    resultado: null,
    error: null,
    progreso: progresoDePrueba(),
    archivo: nombrePropuesto('Canción de prueba', 'Artista', 'mkv'),
    carpeta: '/home/usuario/Videos',
    bytes: null,
    fotogramas: null,
    duracionMs: 40_000,
    destinoExistia: false,
    iniciadaEn: '2026-11-20T10:00:00.000Z',
    terminadaEn: null,
    limpiezaFallida: false,
    ...sobrescribir
  }
}

/** Exportación terminada con éxito. */
export const exportacionCompletada = (): ExportacionIpc =>
  exportacionDePrueba({
    estado: 'terminada',
    resultado: 'completada',
    progreso: null,
    bytes: 3_400_000,
    fotogramas: 1200,
    terminadaEn: '2026-11-20T10:02:00.000Z'
  })

/** Exportación en cola (posición 1). */
export const exportacionEnCola = (): ExportacionIpc =>
  exportacionDePrueba({ estado: 'en_cola', posicion: 1, progreso: null, iniciadaEn: null })

/** Exportación fallida con la posición alcanzada. */
export const exportacionFallida = (
  codigo: 'SIN_ESPACIO' | 'MEMORIA_INSUFICIENTE' = 'SIN_ESPACIO'
) =>
  exportacionDePrueba({
    estado: 'terminada',
    resultado: 'error',
    progreso: null,
    terminadaEn: '2026-11-20T10:01:00.000Z',
    error: { codigo, mensaje: 'Fallo de prueba', posicionMs: 12_000 }
  })

// --- API falsa -----------------------------------------------------------------

export type ApiExportacionPrincipal = ApiShinobi['exportacion']

export interface ApiExportacionFalsa {
  api: ApiExportacionPrincipal
  /** Llamadas recibidas, como `[método, ...argumentos]`. */
  llamadas: unknown[][]
  emitirCambio(exportacion: ExportacionIpc): void
  emitirProgreso(progreso: ProgresoExportacionIpc): void
  emitirAviso(aviso: AvisoExportacionIpc): void
}

/**
 * Doble de `window.shinobi.exportacion` para el renderer: respuestas por defecto válidas
 * (todos los perfiles soportados), llamadas registradas y emisores de eventos. `respuestas`
 * sustituye el resultado de un método (o lo hace fallar si es una función que lanza).
 */
export function crearApiExportacionFalsa(
  respuestas: Partial<{ [K in keyof ApiExportacionPrincipal]: unknown }> = {}
): ApiExportacionFalsa {
  const llamadas: unknown[][] = []
  const cambios = new Set<(e: ExportacionIpc) => void>()
  const progresos = new Set<(p: ProgresoExportacionIpc) => void>()
  const avisos = new Set<(a: AvisoExportacionIpc) => void>()
  const defecto: Record<string, unknown> = {
    perfiles: perfilesDePrueba(),
    estimar: { bytes: 80_000_000, segundos: 120 },
    destinoPropuesto: destinoDePrueba(),
    elegirDestino: destinoDePrueba(),
    iniciar: { trabajoId: ID_TRABAJO },
    cancelar: undefined,
    estado: [],
    mostrarEnCarpeta: undefined,
    avisosPendientes: [],
    destinoCarpeta: {
      carpetaId: ID_CARPETA,
      ruta: '/home/usuario/Videos',
      libreBytes: 50_000_000_000
    },
    iniciarLote: (peticion: { cancionIds: string[] }) => ({
      loteId: ID_LOTE,
      encoladas: peticion.cancionIds.map((cancionId, i) => ({
        cancionId,
        trabajoId: `b0000000-0000-4000-8000-${String(i + 10).padStart(12, '0')}`
      })),
      omitidas: []
    }),
    previsualizarLote: (peticion: { cancionIds: string[] }) => ({
      filas: peticion.cancionIds.map((cancionId) => ({
        cancionId,
        archivo: `${cancionId}.mkv`,
        existe: false,
        accion: 'nuevo' as const
      })),
      exportables: peticion.cancionIds.length
    }),
    mostrarCarpetaLote: undefined,
    cancelarLote: undefined,
    reintentarLote: { loteId: ID_LOTE, encoladas: [], omitidas: [] }
  }
  const metodo =
    (nombre: string) =>
    (...args: unknown[]): Promise<unknown> => {
      llamadas.push([nombre, ...args])
      const r =
        nombre in respuestas ? (respuestas as Record<string, unknown>)[nombre] : defecto[nombre]
      return typeof r === 'function' ? Promise.resolve().then(() => r(...args)) : Promise.resolve(r)
    }
  const suscribir =
    <T>(conjunto: Set<(v: T) => void>) =>
    (cb: (v: T) => void): (() => void) => {
      conjunto.add(cb)
      return () => {
        conjunto.delete(cb)
      }
    }
  const api = {
    perfiles: metodo('perfiles'),
    estimar: metodo('estimar'),
    destinoPropuesto: metodo('destinoPropuesto'),
    elegirDestino: metodo('elegirDestino'),
    iniciar: metodo('iniciar'),
    cancelar: metodo('cancelar'),
    estado: metodo('estado'),
    mostrarEnCarpeta: metodo('mostrarEnCarpeta'),
    avisosPendientes: metodo('avisosPendientes'),
    destinoCarpeta: metodo('destinoCarpeta'),
    iniciarLote: metodo('iniciarLote'),
    previsualizarLote: metodo('previsualizarLote'),
    mostrarCarpetaLote: metodo('mostrarCarpetaLote'),
    cancelarLote: metodo('cancelarLote'),
    reintentarLote: metodo('reintentarLote'),
    alAviso: suscribir(avisos),
    alCambiar: suscribir(cambios),
    alProgreso: suscribir(progresos)
  } as unknown as ApiExportacionPrincipal
  return {
    api,
    llamadas,
    emitirCambio: (e) => cambios.forEach((cb) => cb(e)),
    emitirProgreso: (p) => progresos.forEach((cb) => cb(p)),
    emitirAviso: (a) => avisos.forEach((cb) => cb(a))
  }
}
