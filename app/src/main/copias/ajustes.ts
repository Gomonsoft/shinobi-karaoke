import type { Config } from '../../shared'
import type { ConfigParcial } from '../configuracion'

/**
 * Ajustes que viajan en una copia de seguridad (ADR 0027 §3, 0157 §9). Nunca: `instalacion`, `hardware`,
 * `separacion`, carpetas recordadas (`exportacion.carpeta`), pantallas (`reproductor.secundaria`, la
 * geometría de la ventana del editor preciso) ni consentimientos (`aviso_youtube_*`, `rapido_aceptado`).
 */

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function elegir(origen: unknown, claves: readonly string[]): Record<string, unknown> {
  const salida: Record<string, unknown> = {}
  if (!esObjeto(origen)) return salida
  for (const k of claves) if (k in origen && origen[k] !== undefined) salida[k] = origen[k]
  return salida
}

/** `editor.paneles` sin la geometría de la ventana del editor preciso, que depende de las pantallas. */
function paneles(origen: unknown): Record<string, unknown> | undefined {
  if (!esObjeto(origen)) return undefined
  const { preciso, ...resto } = origen
  const salida: Record<string, unknown> = { ...resto }
  if (esObjeto(preciso) && 'margen_ms' in preciso) salida.preciso = { margen_ms: preciso.margen_ms }
  return salida
}

/** Lo que se guarda en `ajustes.json`, de cualquier configuración (la local al crear; la del archivo al leer). */
export function ajustesQueViajan(config: unknown): ConfigParcial {
  const c = esObjeto(config) ? config : {}
  const editorPaneles = esObjeto(c.editor) ? paneles(c.editor.paneles) : undefined
  const parcial: Record<string, unknown> = {
    biblioteca: elegir(c.biblioteca, ['agrupar']),
    reproductor: elegir(c.reproductor, [
      'transicion_s',
      'volumen',
      'silenciado',
      'voz_guia',
      'voz_guia_silenciada',
      'subrayar_cantado'
    ]),
    exportacion: elegir(c.exportacion, ['formato', 'audio', 'ancho', 'alto', 'fps']),
    editor: editorPaneles ? { paneles: editorPaneles } : {},
    preparacion: elegir(c.preparacion, ['automatica']),
    actualizaciones: elegir(c.actualizaciones, ['avisar'])
  }
  for (const k of Object.keys(parcial)) {
    if (Object.keys(parcial[k] as object).length === 0) delete parcial[k]
  }
  return parcial as ConfigParcial
}

export function ajustesDeConfig(config: Config): ConfigParcial {
  return ajustesQueViajan(config)
}
