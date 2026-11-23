import { createHash } from 'node:crypto'
import { createWriteStream, type WriteStream } from 'node:fs'
import { open as abrirArchivo, type FileHandle } from 'node:fs/promises'
import { pipeline, Transform, type Readable } from 'node:stream'
import yauzl from 'yauzl'
import { ZipFile } from 'yazl'
import { ErrorPaquete, LIMITES } from './formato'

/**
 * Lectura (`yauzl`) y escritura (`yazl`) del ZIP, en streaming y sin dependencias nativas (ADR 0027 §7).
 * Nada de aquí conoce el significado de las entradas: eso es de `servicio.ts`.
 */

// ---------------------------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------------------------

/** Los mensajes de `yauzl` que describen un nombre inseguro (ruta con `..`, absoluta o con `\`). */
const NOMBRE_INSEGURO =
  /invalid relative path|absolute path|invalid characters in fileName|encrypt|compression method/i

const MODO_ENLACE = 0o120000
const MASCARA_TIPO = 0o170000

export class PaqueteLector {
  private constructor(
    private readonly zip: yauzl.ZipFile,
    readonly entradas: ReadonlyMap<string, yauzl.Entry>
  ) {}

  /**
   * Abre y recorre el índice central. Rechaza el paquete **entero** si no es un ZIP (`PAQUETE_NO_VALIDO`),
   * si está cortado (`PAQUETE_INCOMPLETO`: empieza como un ZIP pero no tiene índice) o si alguna entrada
   * es peligrosa: nombre con `..`, absoluto o con barra invertida, enlace simbólico, cifrada, repetida o
   * con un tamaño declarado fuera de los límites (`PAQUETE_NO_VALIDO`).
   */
  static async abrir(ruta: string): Promise<PaqueteLector> {
    await exigirCabeceraZip(ruta)
    const zip = await new Promise<yauzl.ZipFile>((ok, error) => {
      yauzl.open(
        ruta,
        {
          lazyEntries: true,
          autoClose: false,
          validateEntrySizes: true,
          decodeStrings: true,
          strictFileNames: true
        },
        (e, z) => (e || !z ? error(clasificar(e)) : ok(z))
      )
    })
    try {
      if (zip.entryCount > LIMITES.maxEntradas) {
        throw new ErrorPaquete('PAQUETE_NO_VALIDO', 'El paquete tiene demasiadas entradas.')
      }
      return new PaqueteLector(zip, await listar(zip))
    } catch (e) {
      zip.close()
      throw e
    }
  }

  /** Contenido de una entrada con un tope de bytes (los JSON pequeños: manifiesto, temas, ajustes, `cancion.json`). */
  async leerBuffer(nombre: string, maxBytes: number): Promise<Buffer> {
    const entrada = this.entradas.get(nombre)
    if (!entrada) throw new ErrorPaquete('PAQUETE_NO_VALIDO', `Falta ${nombre}.`)
    if (entrada.uncompressedSize > maxBytes) {
      throw new ErrorPaquete('PAQUETE_NO_VALIDO', `${nombre} es demasiado grande.`)
    }
    const flujo = await this.abrirLectura(nombre)
    const trozos: Buffer[] = []
    let total = 0
    try {
      for await (const trozo of flujo) {
        total += (trozo as Buffer).length
        if (total > maxBytes)
          throw new ErrorPaquete('PAQUETE_NO_VALIDO', `${nombre} es demasiado grande.`)
        trozos.push(trozo as Buffer)
      }
    } catch (e) {
      flujo.destroy()
      if (e instanceof ErrorPaquete) throw e
      throw new ErrorPaquete('PAQUETE_INCOMPLETO', `No se pudo leer ${nombre}.`)
    }
    return Buffer.concat(trozos)
  }

  /** Flujo de una entrada; `yauzl` comprueba que los bytes leídos coinciden con el tamaño declarado. */
  abrirLectura(nombre: string): Promise<Readable> {
    const entrada = this.entradas.get(nombre)
    if (!entrada) return Promise.reject(new ErrorPaquete('PAQUETE_INCOMPLETO', `Falta ${nombre}.`))
    return new Promise((ok, error) => {
      this.zip.openReadStream(entrada, (e, flujo) =>
        e || !flujo ? error(new ErrorPaquete('PAQUETE_INCOMPLETO', 'Entrada ilegible.')) : ok(flujo)
      )
    })
  }

  cerrar(): void {
    this.zip.close()
  }
}

async function exigirCabeceraZip(ruta: string): Promise<void> {
  let archivo: FileHandle | undefined
  try {
    archivo = await abrirArchivo(ruta, 'r')
    const cabecera = Buffer.alloc(4)
    const { bytesRead } = await archivo.read(cabecera, 0, 4, 0)
    const firma = cabecera.subarray(0, bytesRead).toString('latin1')
    // Entrada local (`PK\3\4`) o ZIP vacío (`PK\5\6`); cualquier otra cosa no es un ZIP.
    if (firma !== 'PK\u0003\u0004' && firma !== 'PK\u0005\u0006') {
      throw new ErrorPaquete('PAQUETE_NO_VALIDO', 'No es un archivo ZIP.')
    }
  } catch (e) {
    if (e instanceof ErrorPaquete) throw e
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ErrorPaquete('ARCHIVO_NO_ENCONTRADO', 'El archivo ya no existe.')
    }
    throw new ErrorPaquete('PAQUETE_INCOMPLETO', 'No se pudo leer el archivo.')
  } finally {
    await archivo?.close()
  }
}

function clasificar(e: Error | null): ErrorPaquete {
  const mensaje = e?.message ?? ''
  return NOMBRE_INSEGURO.test(mensaje)
    ? new ErrorPaquete('PAQUETE_NO_VALIDO', 'El paquete contiene una ruta no válida.')
    : new ErrorPaquete('PAQUETE_INCOMPLETO', 'El paquete está cortado o dañado.')
}

function listar(zip: yauzl.ZipFile): Promise<Map<string, yauzl.Entry>> {
  return new Promise((ok, error) => {
    const entradas = new Map<string, yauzl.Entry>()
    let total = 0
    zip.on('error', (e) => error(clasificar(e)))
    zip.on('end', () => ok(entradas))
    zip.on('entry', (entrada: yauzl.Entry) => {
      const nombre = entrada.fileName
      if (!nombre.endsWith('/')) {
        // `versionMadeBy >> 8 === 3`: atributos de Unix, donde el tipo de archivo vive en los 16 bits altos.
        const unix = entrada.versionMadeBy >> 8 === 3
        const modo = entrada.externalFileAttributes >>> 16
        const malo =
          entradas.has(nombre) ||
          entrada.isEncrypted() ||
          (unix && (modo & MASCARA_TIPO) === MODO_ENLACE) ||
          entrada.uncompressedSize > LIMITES.maxAudio
        if (malo) return error(new ErrorPaquete('PAQUETE_NO_VALIDO', 'Entrada no permitida.'))
        total += entrada.uncompressedSize
        if (total > LIMITES.maxTotal) {
          return error(
            new ErrorPaquete('PAQUETE_NO_VALIDO', 'El paquete declara demasiados datos.')
          )
        }
        entradas.set(nombre, entrada)
      }
      zip.readEntry()
    })
    zip.readEntry()
  })
}

// ---------------------------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------------------------

export class ErrorCancelado extends Error {
  readonly codigo = 'CANCELADO'
  constructor() {
    super('Cancelado')
    this.name = 'ErrorCancelado'
  }
}

export interface ArchivoEscrito {
  bytes: number
  sha256: string
}

/**
 * Escribe un ZIP en `ruta` entrada a entrada, calculando el SHA-256 y contando los bytes sobre la marcha.
 * Cada `anadir*` espera a que su entrada se haya consumido, así que la memoria no crece con el audio y el
 * manifiesto puede ir al final con las comprobaciones ya conocidas. Un fallo de disco o una cancelación
 * rechazan la entrada en curso; `abortar` destruye los flujos y deja el temporal para que lo borre quien llama.
 */
export class EscritorZip {
  private readonly zip = new ZipFile()
  private readonly salida: WriteStream
  private readonly terminado: Promise<void>
  private readonly guardia: Promise<never>
  private rechazar!: (e: unknown) => void
  private readonly vivos = new Set<{ destroy(e?: Error): unknown }>()

  constructor(
    ruta: string,
    private readonly signal: AbortSignal,
    private readonly alBytes: (n: number) => void = () => undefined
  ) {
    this.guardia = new Promise<never>((_, rej) => {
      this.rechazar = rej
    })
    this.guardia.catch(() => undefined)
    this.salida = createWriteStream(ruta, { flags: 'wx' })
    this.zip.on('error', (e) => this.rechazar(e))
    this.terminado = new Promise<void>((ok, rej) => {
      pipeline(this.zip.outputStream, this.salida, (e) => (e ? rej(e) : ok()))
    })
    this.terminado.catch((e) => this.rechazar(e))
    if (signal.aborted) this.rechazar(new ErrorCancelado())
    signal.addEventListener('abort', () => this.rechazar(new ErrorCancelado()), { once: true })
  }

  /** Un buffer pequeño (JSON); `comprimir` aplica deflate. */
  async anadirBuffer(ruta: string, contenido: Buffer, comprimir = true): Promise<ArchivoEscrito> {
    this.exigirVivo()
    this.zip.addBuffer(contenido, ruta, { compress: comprimir, mtime: new Date(0) })
    this.alBytes(contenido.length)
    return { bytes: contenido.length, sha256: createHash('sha256').update(contenido).digest('hex') }
  }

  /** Un archivo ya abierto (el audio y la miniatura van sin comprimir). */
  async anadirArchivo(
    ruta: string,
    archivo: FileHandle,
    comprimir = false
  ): Promise<ArchivoEscrito> {
    this.exigirVivo()
    const { size } = await archivo.stat()
    const hash = createHash('sha256')
    let bytes = 0
    const origen = archivo.createReadStream()
    const medidor = new Transform({
      transform: (trozo: Buffer, _codificacion, listo) => {
        hash.update(trozo)
        bytes += trozo.length
        this.alBytes(trozo.length)
        listo(null, trozo)
      }
    })
    origen.on('error', (e) => medidor.destroy(e))
    origen.pipe(medidor)
    this.vivos.add(origen)
    this.vivos.add(medidor)
    const consumido = new Promise<void>((ok, rej) => {
      medidor.on('end', ok)
      medidor.on('error', rej)
    })
    this.zip.addReadStream(medidor, ruta, { compress: comprimir, size, mtime: new Date(0) })
    try {
      await Promise.race([consumido, this.guardia])
    } finally {
      this.vivos.delete(origen)
      this.vivos.delete(medidor)
    }
    return { bytes, sha256: hash.digest('hex') }
  }

  /** Cierra el índice central y espera a que todo esté en disco. */
  async terminar(): Promise<void> {
    this.exigirVivo()
    this.zip.end()
    await Promise.race([this.terminado, this.guardia])
  }

  /** Interrumpe todo: el temporal queda a medias y lo borra quien llama. */
  async abortar(): Promise<void> {
    this.rechazar(new ErrorCancelado())
    for (const flujo of this.vivos) flujo.destroy()
    this.vivos.clear()
    const salidaZip = this.zip.outputStream as unknown as Readable
    salidaZip.unpipe()
    salidaZip.destroy()
    await new Promise<void>((ok) => {
      if (this.salida.destroyed) return ok()
      this.salida.once('close', () => ok())
      this.salida.destroy()
    })
  }

  private exigirVivo(): void {
    if (this.signal.aborted) throw new ErrorCancelado()
  }
}
