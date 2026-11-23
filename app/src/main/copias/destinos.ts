import { randomUUID } from 'node:crypto'
import { promises as fsp } from 'node:fs'
import { basename, dirname, extname, join, posix, resolve, win32 } from 'node:path'
import { MAX_NOMBRE_ARCHIVO, sanearNombre } from '../../shared/exportacion'
import { probarEscritura } from '../exportacion/destinos'
import { EXTENSION_PAQUETE, ErrorPaquete } from './formato'

/**
 * Destino de un paquete o una copia con el patrón `destinoId` de ADR 0019 §6: el renderer nunca envía
 * rutas; main las asocia a un id de un solo uso que caduca. El nombre propuesto es el de la spec
 * (`paq.exp.nombre`, `aj.copia.nombre`) y la carpeta, la última usada para paquetes en esta sesión o,
 * si no, Documentos. Dentro de la carpeta de datos de la app no se puede guardar.
 */

export const CADUCIDAD_DESTINO_MS = 30 * 60 * 1000

export interface DestinoPropuesto {
  destinoId: string
  nombre: string
  carpeta: string
  libreBytes: number | null
  existe: boolean
}

export interface PuertosDestinosCopias<V = unknown> {
  directorioDatos: string
  /** `dialog.showSaveDialog`; `null` si se cancela. */
  dialogoGuardar(ventana: V, opciones: { defaultPath: string }): Promise<string | null>
  ventana(): V
  /** `app.getPath('documents')` y `app.getPath('home')`; pueden lanzar o devolver vacío. */
  carpetaDocumentos(): string
  carpetaHogar(): string
  plataforma?: NodeJS.Platform
  ahora?: () => number
  uuid?: () => string
}

interface Vigente {
  ruta: string
  caduca: number
}

const RESERVADOS_WINDOWS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

const sinPermiso = (mensaje: string): ErrorPaquete =>
  new ErrorPaquete('DESTINO_NO_DISPONIBLE', mensaje)

const dos = (n: number): string => String(n).padStart(2, '0')
export const fechaNombre = (d: Date): string =>
  `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`

/** `{título} — {artista}.shinobi`, `{n} canciones de Shinobi Karaoke {fecha}.shinobi` o `Copia de Shinobi Karaoke {fecha}.shinobi`. */
export function nombrePaquete(
  tipo: 'canciones' | 'biblioteca',
  canciones: readonly { titulo: string; artista: string }[],
  fecha: Date
): string {
  let base: string
  if (tipo === 'biblioteca') base = `Copia de Shinobi Karaoke ${fechaNombre(fecha)}`
  else if (canciones.length === 1) {
    const t = canciones[0]!.titulo.trim() || 'Sin título'
    const a = canciones[0]!.artista.trim()
    base = a ? `${t} — ${a}` : t
  } else base = `${canciones.length} canciones de Shinobi Karaoke ${fechaNombre(fecha)}`
  const saneado = sanearNombre([...sanearNombre(base)].slice(0, MAX_NOMBRE_ARCHIVO).join(''))
  return `${saneado || 'Shinobi Karaoke'}.${EXTENSION_PAQUETE}`
}

export class DestinosCopias<V = unknown> {
  private readonly vigentes = new Map<string, Vigente>()
  private ultimaCarpeta: string | null = null
  private readonly plataforma: NodeJS.Platform
  private readonly ahora: () => number
  private readonly uuid: () => string

  constructor(private readonly p: PuertosDestinosCopias<V>) {
    this.plataforma = p.plataforma ?? process.platform
    this.ahora = p.ahora ?? Date.now
    this.uuid = p.uuid ?? randomUUID
  }

  async propuesto(nombre: string): Promise<DestinoPropuesto> {
    const carpeta = await this.carpetaInicial()
    return this.emitir(join(carpeta, nombre))
  }

  /** Diálogo «Guardar»; `null` si se cancela (el destino actual sigue vigente). */
  async elegir(destinoId: string): Promise<DestinoPropuesto | null> {
    const actual = this.mirar(destinoId)
    if (!actual) throw sinPermiso('El destino caducó o ya se usó.')
    const elegida = await this.p.dialogoGuardar(this.p.ventana(), { defaultPath: actual.ruta })
    if (elegida === null) return null
    const absoluta = resolve(elegida)
    const ruta =
      extname(absoluta).toLowerCase() === `.${EXTENSION_PAQUETE}`
        ? absoluta
        : `${absoluta}.${EXTENSION_PAQUETE}`
    await this.validar(ruta)
    this.vigentes.delete(destinoId)
    return this.emitir(ruta)
  }

  /** Gasta el `destinoId` y devuelve la ruta, tras comprobar de nuevo que se puede escribir en ella. */
  async consumir(destinoId: string): Promise<string> {
    const e = this.mirar(destinoId)
    if (!e) throw sinPermiso('El destino caducó o ya se usó.')
    await this.validar(e.ruta)
    this.vigentes.delete(destinoId)
    this.ultimaCarpeta = dirname(e.ruta)
    return e.ruta
  }

  /** `<carpeta>/.<nombre>.<8 hex>.shinobi-parcial`, junto al destino (mismo volumen, para `rename`). */
  rutaTemporal(destino: string, trabajoId: string): string {
    const hex = trabajoId
      .replace(/[^0-9a-f]/gi, '')
      .toLowerCase()
      .slice(0, 8)
      .padEnd(8, '0')
    return join(dirname(destino), `.${basename(destino)}.${hex}.shinobi-parcial`)
  }

  async libreBytes(carpeta: string): Promise<number | null> {
    try {
      const s = await fsp.statfs(carpeta)
      return Number(s.bavail) * Number(s.bsize)
    } catch {
      return null
    }
  }

  // ------------------------------------------------------------------------------------------

  private async carpetaInicial(): Promise<string> {
    const candidatas = [
      this.ultimaCarpeta,
      ...[this.p.carpetaDocumentos, this.p.carpetaHogar].map(seguro)
    ]
    for (const c of candidatas) {
      if (c && !this.dentroDeDatos(resolve(c)) && (await esCarpetaEscribible(c))) return resolve(c)
    }
    throw sinPermiso('No hay ninguna carpeta donde guardar.')
  }

  private dentroDeDatos(ruta: string): boolean {
    const ruteo = this.plataforma === 'win32' ? win32 : posix
    const norm = (r: string): string => (this.plataforma === 'win32' ? r.toLowerCase() : r)
    const rel = ruteo.relative(
      norm(ruteo.resolve(this.p.directorioDatos)),
      norm(ruteo.resolve(ruta))
    )
    return rel === '' || (!rel.startsWith('..') && !ruteo.isAbsolute(rel))
  }

  private async validar(ruta: string): Promise<void> {
    const nombre = basename(ruta)
    const sinExt = nombre.slice(0, nombre.length - extname(nombre).length)
    if (
      this.dentroDeDatos(ruta) ||
      (this.plataforma === 'win32' && RESERVADOS_WINDOWS.test(sinExt.split('.')[0] ?? '')) ||
      !(await esCarpetaEscribible(dirname(ruta)))
    ) {
      throw sinPermiso(`No se puede guardar en ${ruta}.`)
    }
  }

  private async emitir(ruta: string): Promise<DestinoPropuesto> {
    const destinoId = this.uuid()
    this.vigentes.set(destinoId, { ruta, caduca: this.ahora() + CADUCIDAD_DESTINO_MS })
    return {
      destinoId,
      nombre: basename(ruta),
      carpeta: dirname(ruta),
      libreBytes: await this.libreBytes(dirname(ruta)),
      existe: await fsp.access(ruta).then(
        () => true,
        () => false
      )
    }
  }

  private mirar(id: string): Vigente | null {
    const ahora = this.ahora()
    for (const [k, v] of this.vigentes) if (v.caduca <= ahora) this.vigentes.delete(k)
    return this.vigentes.get(id) ?? null
  }
}

function seguro(obtener: () => string): string {
  try {
    return obtener()
  } catch {
    return ''
  }
}

async function esCarpetaEscribible(ruta: string): Promise<boolean> {
  try {
    if (!(await fsp.stat(ruta)).isDirectory()) return false
  } catch {
    return false
  }
  return probarEscritura(ruta)
}
