import { join } from 'node:path'
import { catalogoInicial, migrarCatalogo, type Catalogo, type Estilo } from '../../shared'
import { escribirJsonAtomico, leerJson, sistemaReal, type SistemaArchivos } from '../persistencia'
import type { RegistroApp } from '../registro'

const MODULO = 'temas'

export const NOMBRE_ARCHIVO_CATALOGO = 'temas.json'

export const rutaCatalogo = (dirBiblioteca: string): string =>
  join(dirBiblioteca, NOMBRE_ARCHIVO_CATALOGO)

export interface EstadoCatalogo {
  /** `null` solo en solo lectura (esquema más nuevo): no se interpreta el archivo. */
  catalogo: Catalogo | null
  soloLectura: boolean
}

export interface OpcionesCargaCatalogo {
  /** `config.estilo_predeterminado` (campo heredado de 0.1.0) para sembrar el primer tema. */
  estiloInicial: Estilo
  registro: RegistroApp
  ahora: () => string
  nuevoId: () => string
  /** Solo pruebas. */
  sistema?: SistemaArchivos
}

/** Validador para `leerJson`: lanza si el catálogo no es válido o es de un esquema más nuevo. */
function validar(json: unknown): Catalogo {
  const r = migrarCatalogo(json)
  if (r.tipo === 'ok') return r.catalogo
  throw new Error(r.tipo === 'mas_nuevo' ? 'Esquema más nuevo' : r.error)
}

/** ¿Este archivo es de un esquema más nuevo que el soportado? Nunca lanza. */
async function esMasNuevo(sis: SistemaArchivos, ruta: string): Promise<boolean> {
  try {
    return migrarCatalogo(JSON.parse(await sis.leer(ruta))).tipo === 'mas_nuevo'
  } catch {
    return false
  }
}

/** Escribe el catálogo de forma atómica (tmp, fsync, `.bak`, renombrado), sin debounce. */
export function escribirCatalogo(
  ruta: string,
  catalogo: Catalogo,
  sistema?: SistemaArchivos
): Promise<void> {
  return escribirJsonAtomico(ruta, catalogo, sistema ? { sistema } : {})
}

/**
 * Carga `temas.json` (ADR 0016 §1):
 * - sin archivo ni `.bak`: siembra un catálogo con `estiloInicial` y lo escribe;
 * - esquema más nuevo (en el principal, o en el `.bak` si el principal no se lee): solo lectura,
 *   sin escribir nunca;
 * - ilegible también desde `.bak`: se aparta como `temas.json.danado` (sustituye a uno anterior)
 *   y se siembra uno nuevo con `apartado` = ahora.
 */
export async function cargarCatalogo(
  ruta: string,
  opciones: OpcionesCargaCatalogo
): Promise<EstadoCatalogo> {
  const { registro } = opciones
  const sis = opciones.sistema ?? sistemaReal
  const bak = `${ruta}.bak`
  const sembrar = async (apartado: string | null): Promise<EstadoCatalogo> => {
    const ahora = opciones.ahora()
    const catalogo: Catalogo = {
      ...catalogoInicial({ estilo: opciones.estiloInicial, ahora, id: opciones.nuevoId() }),
      apartado
    }
    await escribirCatalogo(ruta, catalogo, opciones.sistema)
    return { catalogo, soloLectura: false }
  }
  const soloLectura = (motivo: string): EstadoCatalogo => {
    registro.escribir(
      'aviso',
      MODULO,
      `temas.json de un esquema más nuevo; solo lectura (${motivo})`
    )
    return { catalogo: null, soloLectura: true }
  }

  const hayPrincipal = await sis.existe(ruta)
  const hayBak = await sis.existe(bak)
  if (!hayPrincipal && !hayBak) {
    registro.escribir('info', MODULO, `temas.json creado con el tema inicial: ${ruta}`)
    return sembrar(null)
  }

  // Antes de leer: un principal más nuevo no puede recuperarse de un .bak antiguo (lo pisaría).
  if (hayPrincipal && (await esMasNuevo(sis, ruta))) return soloLectura('principal')

  const r = await leerJson(ruta, validar, opciones.sistema ? { sistema: opciones.sistema } : {})
  if (r.ok) {
    if (r.recuperadoDeBak)
      registro.escribir('aviso', MODULO, `temas.json recuperado de .bak: ${ruta}`)
    return { catalogo: r.datos, soloLectura: false }
  }
  if (hayBak && (await esMasNuevo(sis, bak))) return soloLectura('copia de seguridad')

  registro.escribir('error', MODULO, `temas.json inválido (${r.motivo}); se aparta: ${ruta}`)
  const origen = hayPrincipal ? ruta : bak
  const danado = `${ruta}.danado`
  await sis.borrar(danado).catch(() => undefined)
  await sis.renombrar(origen, danado).catch((e: unknown) => {
    registro.escribir('error', MODULO, `no se pudo apartar ${origen}: ${String(e)}`)
  })
  return sembrar(opciones.ahora())
}
