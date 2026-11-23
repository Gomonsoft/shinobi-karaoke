import { randomUUID } from 'node:crypto'
import { open, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, posix, resolve, win32 } from 'node:path'
import { MAX_NOMBRE_ARCHIVO, sanearNombre } from '../../shared/exportacion'
import type { CodigoError } from '../../shared/errores'
import type { Cancion } from '../../shared'
import { exportarLrc } from '../../shared/letras'

/**
 * Exportar la letra a `.lrc` (ADR 0027 §4 y su revisión 2026-11-22, pregunta 0166). Main abre el
 * diálogo del sistema dentro de la llamada y el renderer solo recibe un `ubicacionId` (nunca rutas).
 */

export class ErrorExportarLrc extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string
  ) {
    super(mensaje)
    this.name = 'ErrorExportarLrc'
  }
}

export interface PuertosExportarLrc<V = unknown> {
  biblioteca: { obtener(id: string): Cancion | null }
  directorioDatos: string
  ventana(): V
  /** `dialog.showSaveDialog`; `null` si se cancela. */
  dialogoGuardar(ventana: V, opciones: { defaultPath: string }): Promise<string | null>
  /** `dialog.showOpenDialog` con `openDirectory`; `null` si se cancela. */
  dialogoCarpeta(ventana: V, opciones: { defaultPath: string }): Promise<string | null>
  /** `app.getPath('documents')`; puede lanzar. */
  carpetaDocumentos(): string
  mostrarEnCarpeta(ruta: string): void
  plataforma?: NodeJS.Platform
  uuid?: () => string
}

const MAX_UBICACIONES = 50

const codigoFs = (e: unknown): string | undefined =>
  typeof e === 'object' && e !== null ? (e as { code?: string }).code : undefined

/** Un fallo de disco, con el código estable que la interfaz traduce. */
function errorDeEscritura(e: unknown): ErrorExportarLrc {
  const c = codigoFs(e)
  if (c === 'ENOSPC' || c === 'EDQUOT') return new ErrorExportarLrc('SIN_ESPACIO', 'Disco lleno.')
  if (c && ['EACCES', 'EPERM', 'EROFS', 'ENOENT', 'ENOTDIR'].includes(c)) {
    return new ErrorExportarLrc('DESTINO_NO_DISPONIBLE', 'No se puede escribir en esa carpeta.')
  }
  return new ErrorExportarLrc('ERROR_INTERNO', 'No se pudo guardar la letra.')
}

/** `{título} — {artista}.lrc`; sin artista, `{título}.lrc` (`lrc.nombre`). */
export function nombreLrc(titulo: string, artista: string): string {
  const t = titulo.trim() || 'Sin título'
  const a = artista.trim()
  const base = sanearNombre(a ? `${t} — ${a}` : t)
  const recortado = sanearNombre([...base].slice(0, MAX_NOMBRE_ARCHIVO).join(''))
  return `${recortado || 'letra'}.lrc`
}

/** El texto de una canción, o `null` si no tiene ninguna línea con inicio. */
export function lrcDeCancion(c: Cancion): { texto: string; lineasOmitidas: number } | null {
  const lineas = c.letra?.lineas.filter((e) => e.tipo === 'linea') ?? []
  const conInicio = lineas.filter((e) => e.inicio_ms !== null).length
  if (!c.letra || conInicio === 0) return null
  const texto = exportarLrc(c.letra, {
    titulo: c.metadatos.titulo,
    artista: c.metadatos.artista,
    album: c.metadatos.album,
    duracionMs: c.metadatos.duracion_ms
  })
  return { texto, lineasOmitidas: lineas.length - conInicio }
}

export class ExportadorLrc<V = unknown> {
  private ultimaCarpeta: string | null = null
  private readonly ubicaciones = new Map<string, string>()
  private readonly plataforma: NodeJS.Platform
  private readonly uuid: () => string

  constructor(private readonly p: PuertosExportarLrc<V>) {
    this.plataforma = p.plataforma ?? process.platform
    this.uuid = p.uuid ?? randomUUID
  }

  async exportarUna(
    cancionId: string
  ): Promise<{ lineasOmitidas: number; ubicacionId: string } | null> {
    const cancion = this.p.biblioteca.obtener(cancionId)
    if (!cancion) throw new ErrorExportarLrc('CANCION_NO_DISPONIBLE', 'No existe la canción.')
    const lrc = lrcDeCancion(cancion)
    if (!lrc) throw new ErrorExportarLrc('ARGUMENTOS_NO_VALIDOS', 'La letra no tiene tiempos.')
    const elegida = await this.p.dialogoGuardar(this.p.ventana(), {
      defaultPath: join(
        this.ultimaCarpeta ?? this.documentos(),
        nombreLrc(cancion.metadatos.titulo, cancion.metadatos.artista)
      )
    })
    if (elegida === null) return null
    const absoluta = resolve(elegida)
    const destino = extname(absoluta) === '' ? `${absoluta}.lrc` : absoluta
    this.exigirFueraDeDatos(destino)
    // Temporal y `rename`: un fallo a mitad no deja medio archivo ni toca el que había.
    const hex = this.uuid().replace(/-/g, '').slice(0, 8)
    const temporal = join(dirname(destino), `.${basename(destino)}.${hex}.shinobi-parcial`)
    try {
      await writeFile(temporal, lrc.texto, 'utf8')
      await rename(temporal, destino)
    } catch (e) {
      await rm(temporal, { force: true }).catch(() => undefined)
      throw errorDeEscritura(e)
    }
    this.ultimaCarpeta = dirname(destino)
    return { lineasOmitidas: lrc.lineasOmitidas, ubicacionId: this.recordar(destino) }
  }

  async exportarVarias(ids: string[]): Promise<{
    escritas: number
    omitidas: { id: string; motivo: string }[]
    ubicacionId: string
  } | null> {
    const elegida = await this.p.dialogoCarpeta(this.p.ventana(), {
      defaultPath: this.ultimaCarpeta ?? this.documentos()
    })
    if (elegida === null) return null
    const carpeta = resolve(elegida)
    this.exigirFueraDeDatos(carpeta)
    const omitidas: { id: string; motivo: string }[] = []
    let escritas = 0
    let primera: string | null = null
    for (const id of ids) {
      const cancion = this.p.biblioteca.obtener(id)
      if (!cancion) {
        omitidas.push({ id, motivo: 'CANCION_NO_DISPONIBLE' })
        continue
      }
      const lrc = lrcDeCancion(cancion)
      if (!lrc) {
        omitidas.push({ id, motivo: 'SIN_TIEMPOS' })
        continue
      }
      try {
        const ruta = await this.escribirSinSustituir(
          carpeta,
          nombreLrc(cancion.metadatos.titulo, cancion.metadatos.artista),
          lrc.texto
        )
        primera ??= ruta
        escritas++
      } catch (e) {
        omitidas.push({ id, motivo: errorDeEscritura(e).codigo })
      }
    }
    this.ultimaCarpeta = carpeta
    return { escritas, omitidas, ubicacionId: this.recordar(primera ?? carpeta) }
  }

  /** Para el botón del toast: revela en el explorador lo escrito por `exportarLrc*`. */
  mostrarEnCarpeta(ubicacionId: string): void {
    const ruta = this.ubicaciones.get(ubicacionId)
    if (!ruta) throw new ErrorExportarLrc('ARGUMENTOS_NO_VALIDOS', 'La ubicación ya no es válida.')
    this.p.mostrarEnCarpeta(ruta)
  }

  /** `nombre.lrc`, `nombre (2).lrc`… con `wx`: nunca sustituye un archivo que ya existe. */
  private async escribirSinSustituir(
    carpeta: string,
    nombre: string,
    texto: string
  ): Promise<string> {
    const ext = extname(nombre)
    const raiz = nombre.slice(0, nombre.length - ext.length)
    for (let n = 1; n < 1000; n++) {
      const ruta = join(carpeta, n === 1 ? nombre : `${raiz} (${n})${ext}`)
      let archivo
      try {
        archivo = await open(ruta, 'wx')
      } catch (e) {
        if (codigoFs(e) === 'EEXIST') continue
        throw e
      }
      try {
        await archivo.writeFile(texto, 'utf8')
      } catch (e) {
        await archivo.close().catch(() => undefined)
        await rm(ruta, { force: true }).catch(() => undefined)
        throw e
      }
      await archivo.close()
      return ruta
    }
    throw new ErrorExportarLrc('ERROR_INTERNO', 'Demasiados archivos con el mismo nombre.')
  }

  /** Asocia una ruta escrita a un `ubicacionId` (también lo usa `ServicioCopias` para su toast). */
  recordar(ruta: string): string {
    const id = this.uuid()
    this.ubicaciones.set(id, ruta)
    if (this.ubicaciones.size > MAX_UBICACIONES) {
      this.ubicaciones.delete(this.ubicaciones.keys().next().value as string)
    }
    return id
  }

  private documentos(): string {
    try {
      const d = this.p.carpetaDocumentos()
      if (d) return d
    } catch {
      /* sin carpeta Documentos */
    }
    return this.p.directorioDatos === '' ? '.' : dirname(this.p.directorioDatos)
  }

  /** El directorio de datos de la app no es un destino válido. */
  private exigirFueraDeDatos(ruta: string): void {
    const ruteo = this.plataforma === 'win32' ? win32 : posix
    const norm = (r: string): string => (this.plataforma === 'win32' ? r.toLowerCase() : r)
    const rel = ruteo.relative(
      norm(ruteo.resolve(this.p.directorioDatos)),
      norm(ruteo.resolve(ruta))
    )
    if (rel === '' || (!rel.startsWith('..') && !ruteo.isAbsolute(rel))) {
      throw new ErrorExportarLrc(
        'DESTINO_NO_DISPONIBLE',
        'No se puede guardar en los datos de la app.'
      )
    }
  }
}
