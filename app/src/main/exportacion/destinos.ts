import { randomUUID } from 'node:crypto'
import { constants, promises as fsp } from 'node:fs'
import { basename, dirname, extname, join, posix, resolve, win32 } from 'node:path'
import type { CodigoError } from '../../shared/errores'
import {
  FORMATOS,
  nombrePropuesto,
  type DestinoIpc,
  type FormatoId
} from '../../shared/exportacion'

/**
 * Destinos de la exportación, archivo temporal y sustitución atómica (ADR 0019 §6). Sin Electron:
 * el diálogo, las rutas del sistema y el disco entran por puertos. El renderer nunca envía rutas;
 * main las asocia a un `destinoId` de un solo uso.
 */

/** Error con código estable de la IPC (`aErrorIpc` lo traduce). */
export class ErrorDestino extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje?: string,
    /** `LIMPIEZA_FALLIDA`: ruta del temporal para «Mostrar en la carpeta». */
    readonly detalles?: string
  ) {
    super(mensaje ?? codigo)
    this.name = 'ErrorDestino'
  }
}

export const CADUCIDAD_DESTINO_MS = 30 * 60 * 1000

export interface OpcionesDialogoGuardar {
  defaultPath: string
  extension: string
  nombreFiltro: string
}

/** Lo que usa de `fs`; por defecto, el real. */
export interface DiscoDestinos {
  esCarpetaEscribible(ruta: string): Promise<boolean>
  existe(ruta: string): Promise<boolean>
  libreBytes(carpeta: string): Promise<number | null>
  renombrar(origen: string, destino: string): Promise<void>
  borrar(ruta: string): Promise<void>
}

export interface PuertosDestinos<V = unknown> {
  disco?: DiscoDestinos
  /** `dialog.showSaveDialog`; `null` si se cancela. */
  dialogoGuardar(ventana: V, opciones: OpcionesDialogoGuardar): Promise<string | null>
  directorioDatos: string
  /** `app.getPath('videos')` y `app.getPath('home')`; pueden lanzar o devolver vacío. */
  carpetaVideos(): string
  carpetaHogar(): string
  plataforma?: NodeJS.Platform
  ahora?: () => number
  uuid?: () => string
}

export const discoReal: DiscoDestinos = {
  async esCarpetaEscribible(ruta) {
    try {
      if (!(await fsp.stat(ruta)).isDirectory()) return false
      await fsp.access(ruta, constants.W_OK)
      return true
    } catch {
      return false
    }
  },
  async existe(ruta) {
    try {
      await fsp.access(ruta)
      return true
    } catch {
      return false
    }
  },
  async libreBytes(carpeta) {
    try {
      const s = await fsp.statfs(carpeta)
      return Number(s.bavail) * Number(s.bsize)
    } catch {
      return null
    }
  },
  renombrar: (origen, destino) => fsp.rename(origen, destino),
  borrar: (ruta) => fsp.rm(ruta, { force: true })
}

export interface CancionDestino {
  titulo: string
  artista: string
}

interface EntradaDestino {
  ruta: string
  formato: FormatoId
  caduca: number
}

const RESERVADOS_WINDOWS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

function codigoDe(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null ? (e as { code?: string }).code : undefined
}

export class Destinos<V = unknown> {
  private readonly vigentes = new Map<string, EntradaDestino>()
  private readonly disco: DiscoDestinos
  private readonly plataforma: NodeJS.Platform
  private readonly ahora: () => number
  private readonly uuid: () => string

  constructor(private readonly p: PuertosDestinos<V>) {
    this.disco = p.disco ?? discoReal
    this.plataforma = p.plataforma ?? process.platform
    this.ahora = p.ahora ?? Date.now
    this.uuid = p.uuid ?? randomUUID
  }

  /**
   * Destino propuesto. `carpetaRecordada` es `config.exportacion.carpeta`. Con `desdeDestinoId`
   * válido conserva carpeta y nombre y solo cambia la extensión (0124); el anterior caduca.
   */
  async destinoPropuesto(
    cancion: CancionDestino,
    formato: FormatoId,
    carpetaRecordada: string | null,
    desdeDestinoId?: string
  ): Promise<DestinoIpc> {
    const extension = FORMATOS[formato].extension
    if (desdeDestinoId !== undefined) {
      const previo = this.sacar(desdeDestinoId)
      if (previo && (await this.disco.esCarpetaEscribible(dirname(previo.ruta)))) {
        const nombre = this.conExtension(basename(previo.ruta), extension, true)
        return this.emitir(join(dirname(previo.ruta), nombre), formato, false)
      }
    }
    const { carpeta, recordadaNoDisponible } = await this.carpetaInicial(carpetaRecordada)
    const nombre = nombrePropuesto(cancion.titulo, cancion.artista, extension)
    return this.emitir(join(carpeta, nombre), formato, recordadaNoDisponible)
  }

  /**
   * Para «Reintentar» (0133): misma carpeta y nombre que `ruta` (de un trabajo de esta sesión) con la
   * extensión del formato. Si esa carpeta ya no se puede escribir, el propuesto normal.
   */
  async destinoDesdeRuta(
    ruta: string,
    cancion: CancionDestino,
    formato: FormatoId,
    carpetaRecordada: string | null
  ): Promise<DestinoIpc> {
    if (await this.disco.esCarpetaEscribible(dirname(ruta))) {
      const nombre = this.conExtension(basename(ruta), FORMATOS[formato].extension, true)
      return this.emitir(join(dirname(ruta), nombre), formato, false)
    }
    return this.destinoPropuesto(cancion, formato, carpetaRecordada)
  }

  /** Ruta de un `destinoId` vigente sin gastarlo (para comprobar `DESTINO_OCUPADO` antes de `consumir`). */
  rutaDe(destinoId: string): string | null {
    return this.mirar(destinoId)?.ruta ?? null
  }

  /** Diálogo «Guardar»; `null` si se cancela (el `destinoId` actual sigue vigente). */
  async elegirDestino(destinoId: string, ventana: V): Promise<DestinoIpc | null> {
    const actual = this.mirar(destinoId)
    if (!actual) throw new ErrorDestino('DESTINO_NO_DISPONIBLE', 'El destino caducó o ya se usó.')
    const extension = FORMATOS[actual.formato].extension
    const elegida = await this.p.dialogoGuardar(ventana, {
      defaultPath: actual.ruta,
      extension,
      nombreFiltro: FORMATOS[actual.formato].nombreCorto
    })
    if (elegida === null) return null
    const absoluta = resolve(elegida)
    const ruta = join(dirname(absoluta), this.conExtension(basename(absoluta), extension, false))
    await this.validar(ruta)
    this.vigentes.delete(destinoId)
    return this.emitir(ruta, actual.formato, false)
  }

  /** Para `iniciar`: devuelve la ruta y gasta el `destinoId`. Rechaza el caducado o el ya usado. */
  async consumir(destinoId: string): Promise<string> {
    const e = this.mirar(destinoId)
    if (!e) throw new ErrorDestino('DESTINO_NO_DISPONIBLE', 'El destino caducó o ya se usó.')
    // Un destino que ya no se puede usar no se gasta: el usuario puede cambiarlo.
    await this.validar(e.ruta)
    if (!this.vigentes.delete(destinoId)) {
      throw new ErrorDestino('DESTINO_NO_DISPONIBLE', 'El destino caducó o ya se usó.')
    }
    return e.ruta
  }

  /** `<carpeta>/.<nombre>.<8 hex>.shinobi-parcial`, en la carpeta del destino (mismo sistema de archivos). */
  rutaTemporal(destino: string, trabajoId: string): string {
    const hex = trabajoId
      .replace(/[^0-9a-f]/gi, '')
      .toLowerCase()
      .slice(0, 8)
      .padEnd(8, '0')
    return join(dirname(destino), `.${basename(destino)}.${hex}.shinobi-parcial`)
  }

  /**
   * Sustituye el destino por el temporal con `rename` (atómico en el mismo volumen; en Windows
   * reemplaza el existente). Si falla, borra el temporal y el archivo anterior queda intacto.
   */
  async sustituir(temporal: string, destino: string): Promise<void> {
    try {
      await this.disco.renombrar(temporal, destino)
    } catch (e) {
      const c = codigoDe(e)
      await this.disco.borrar(temporal).catch(() => undefined)
      if (c === 'EBUSY' || c === 'EPERM' || c === 'EXDEV') {
        throw new ErrorDestino('DESTINO_NO_DISPONIBLE', `No se pudo guardar en ${destino} (${c}).`)
      }
      throw e
    }
  }

  async limpiar(temporal: string): Promise<void> {
    try {
      await this.disco.borrar(temporal)
    } catch {
      throw new ErrorDestino('LIMPIEZA_FALLIDA', `No se pudo borrar ${temporal}.`, temporal)
    }
  }

  // --- internos ----------------------------------------------------------------

  /** Cambia (o añade) la extensión. Con `soloConocidas` la quita siempre; si no, solo `.mkv`/`.webm`. */
  private conExtension(nombre: string, extension: string, soloConocidas: boolean): string {
    const actual = extname(nombre)
    const conocida = /^\.(mkv|webm)$/i.test(actual)
    if (actual.toLowerCase() === `.${extension}`) return nombre
    if (conocida || (soloConocidas && actual !== '')) {
      return `${nombre.slice(0, nombre.length - actual.length)}.${extension}`
    }
    return `${nombre}.${extension}`
  }

  private async carpetaInicial(
    recordada: string | null
  ): Promise<{ carpeta: string; recordadaNoDisponible: boolean }> {
    let recordadaNoDisponible = false
    if (recordada) {
      const r = resolve(recordada)
      if (!this.dentroDeDatos(r) && (await this.disco.esCarpetaEscribible(r))) {
        return { carpeta: r, recordadaNoDisponible: false }
      }
      recordadaNoDisponible = true
    }
    for (const obtener of [this.p.carpetaVideos, this.p.carpetaHogar]) {
      let c = ''
      try {
        c = obtener()
      } catch {
        /* sin esa carpeta del sistema */
      }
      if (c && !this.dentroDeDatos(resolve(c)) && (await this.disco.esCarpetaEscribible(c))) {
        return { carpeta: resolve(c), recordadaNoDisponible }
      }
    }
    throw new ErrorDestino('DESTINO_NO_DISPONIBLE', 'No hay ninguna carpeta donde guardar.')
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

  /** Rechaza fuera de las reglas: dentro de los datos, nombre reservado o carpeta no escribible. */
  private async validar(ruta: string): Promise<void> {
    const nombre = basename(ruta)
    const sinExt = nombre.slice(0, nombre.length - extname(nombre).length)
    if (
      this.dentroDeDatos(ruta) ||
      (this.plataforma === 'win32' && RESERVADOS_WINDOWS.test(sinExt.split('.')[0] ?? '')) ||
      !(await this.disco.esCarpetaEscribible(dirname(ruta)))
    ) {
      throw new ErrorDestino('DESTINO_NO_DISPONIBLE', `No se puede guardar en ${ruta}.`)
    }
  }

  private async emitir(
    ruta: string,
    formato: FormatoId,
    carpetaRecordadaNoDisponible: boolean
  ): Promise<DestinoIpc> {
    const destinoId = this.uuid()
    this.vigentes.set(destinoId, { ruta, formato, caduca: this.ahora() + CADUCIDAD_DESTINO_MS })
    return {
      destinoId,
      ruta,
      existe: await this.disco.existe(ruta),
      libreBytes: await this.disco.libreBytes(dirname(ruta)),
      carpetaRecordadaNoDisponible
    }
  }

  /** Entrada vigente sin gastarla; purga las caducadas. */
  private mirar(id: string): EntradaDestino | null {
    const ahora = this.ahora()
    for (const [k, v] of this.vigentes) if (v.caduca <= ahora) this.vigentes.delete(k)
    return this.vigentes.get(id) ?? null
  }

  private sacar(id: string): EntradaDestino | null {
    const e = this.mirar(id)
    if (e) this.vigentes.delete(id)
    return e
  }
}
