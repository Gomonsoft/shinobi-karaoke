import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path'
import type { CambioCopiaIpc, ProgresoCopiaIpc, ResumenPaqueteIpc } from '../../shared/ipc'
import type { CodigoError } from '../../shared/errores'
import type { Avance, PuertosCopias } from './contexto'
import { DestinosCopias, nombrePaquete, type DestinoPropuesto } from './destinos'
import { bytesDelPlan, codigoDeExportacion, exportarPaquete, planificarCanciones } from './exportar'
import { EXTENSION_PAQUETE, ErrorPaquete } from './formato'
import {
  abrirPaquete,
  codigoDeImportacion,
  importarPaquete,
  resumirPaquete,
  type PeticionImportar
} from './importar'
import { ErrorCancelado } from './zip'

/**
 * Paquetes de canción y copias de seguridad (ADR 0027): cola propia de concurrencia 1 (una copia, un
 * paquete o una importación a la vez), progreso `copias:progreso` con un máximo de 4 por segundo y
 * cancelación. Es el único que escribe `config.copias.ultima`.
 */

export const INTERVALO_PROGRESO_MS = 250
export const CADUCIDAD_ORIGEN_MS = 30 * 60 * 1000

export interface PuertosServicioCopias<V = unknown> extends PuertosCopias {
  directorioDatos: string
  /** `dialog.showSaveDialog`. */
  dialogoGuardar(ventana: V, opciones: { defaultPath: string }): Promise<string | null>
  /** `dialog.showOpenDialog` con el filtro `.shinobi`; `null` si se cancela. */
  dialogoAbrir(ventana: V): Promise<string | null>
  ventana(): V
  carpetaDocumentos(): string
  carpetaHogar(): string
  /** Recuerda la carpeta escrita y devuelve el `ubicacionId` de `letras.mostrarEnCarpeta`. */
  recordarUbicacion(ruta: string): string
  emitirCambio(evento: CambioCopiaIpc): void
  emitirProgreso(evento: ProgresoCopiaIpc): void
  reloj?: () => number
}

interface Trabajo {
  id: string
  tipo: 'exportar' | 'importar'
  abortar: AbortController
  /** Ya empezó (si no, está en cola y cancelar basta con sacarlo). */
  iniciado: boolean
  /** Quita un trabajo en cola sin ejecutarlo. */
  descartar?: () => void
}

interface Origen {
  ruta: string
  caduca: number
}

export class ServicioCopias<V = unknown> {
  private readonly destinos: DestinosCopias<V>
  private readonly trabajos = new Map<string, Trabajo>()
  private readonly origenes = new Map<string, Origen>()
  private cola: Promise<unknown> = Promise.resolve()
  private cerrado = false

  constructor(private readonly p: PuertosServicioCopias<V>) {
    this.destinos = new DestinosCopias<V>({
      directorioDatos: p.directorioDatos,
      dialogoGuardar: p.dialogoGuardar,
      ventana: p.ventana,
      carpetaDocumentos: p.carpetaDocumentos,
      carpetaHogar: p.carpetaHogar,
      ...(p.reloj ? { ahora: p.reloj } : {})
    })
  }

  // ---------------------------------------------------------------------------- destino

  /** Nombre y carpeta propuestos para el diálogo de exportar, con el tamaño estimado de cada variante. */
  async destinoPropuesto(peticion: {
    tipo: 'canciones' | 'biblioteca'
    ids?: string[] | undefined
  }): Promise<DestinoPropuesto & { estimacion: { completoBytes: number; ligeroBytes: number } }> {
    const ids = peticion.tipo === 'canciones' ? (peticion.ids ?? []) : null
    if (ids !== null && ids.length === 0) {
      throw new ErrorPaquete('ARGUMENTOS_NO_VALIDOS', 'Falta elegir canciones.')
    }
    const ahora = new Date((this.p.reloj ?? Date.now)())
    const filas = (ids ?? this.p.biblioteca.listar().map((r) => r.id))
      .map((id) => this.p.biblioteca.obtenerResumen(id))
      .filter((r) => r !== null)
    const nombre = nombrePaquete(peticion.tipo, filas, ahora)
    const [destino, estimacion] = await Promise.all([
      this.destinos.propuesto(nombre),
      this.estimar(ids)
    ])
    return { ...destino, estimacion }
  }

  /** Suma de tamaños de archivo (más ~1 %) de cada variante; sin leer el contenido. */
  async estimar(
    ids: readonly string[] | null
  ): Promise<{ completoBytes: number; ligeroBytes: number }> {
    const [completo, ligero] = await Promise.all([
      planificarCanciones(this.p, ids, true),
      planificarCanciones(this.p, ids, false)
    ])
    return { completoBytes: bytesDelPlan(completo.plan), ligeroBytes: bytesDelPlan(ligero.plan) }
  }

  elegirDestino(destinoId: string): Promise<DestinoPropuesto | null> {
    return this.destinos.elegir(destinoId)
  }

  // ---------------------------------------------------------------------------- exportar

  async exportarCanciones(peticion: {
    ids: string[]
    conAudio: boolean
    destinoId: string
  }): Promise<{ trabajoId: string }> {
    return this.iniciarExportacion({
      tipo: 'cancion',
      ids: peticion.ids,
      conAudio: peticion.conAudio,
      ajustes: false,
      destinoId: peticion.destinoId
    })
  }

  async exportarBiblioteca(peticion: {
    conAudio: boolean
    ajustes: boolean
    destinoId: string
  }): Promise<{ trabajoId: string }> {
    if (this.p.biblioteca.listar().length === 0) {
      throw new ErrorPaquete('NADA_QUE_HACER', 'La biblioteca está vacía.')
    }
    return this.iniciarExportacion({
      tipo: 'copia',
      ids: null,
      conAudio: peticion.conAudio,
      ajustes: peticion.ajustes,
      destinoId: peticion.destinoId
    })
  }

  private async iniciarExportacion(o: {
    tipo: 'cancion' | 'copia'
    ids: readonly string[] | null
    conAudio: boolean
    ajustes: boolean
    destinoId: string
  }): Promise<{ trabajoId: string }> {
    this.exigirAbierto()
    const destino = await this.destinos.consumir(o.destinoId)
    const trabajoId = (this.p.uuid ?? randomUUID)()
    const temporal = this.destinos.rutaTemporal(destino, trabajoId)
    this.encolar(trabajoId, 'exportar', async (signal, avance) => {
      const libreBytes = await this.p.libreBytes(dirname(destino))
      const r = await exportarPaquete(
        this.p,
        { ...o, destino, temporal, libreBytes },
        signal,
        avance
      )
      const { conAudio, ...resultado } = r
      if (o.tipo === 'copia') {
        await this.p.config
          .actualizar({
            copias: {
              ultima: {
                fecha: (this.p.ahora?.() ?? new Date()).toISOString(),
                canciones: r.canciones,
                bytes: r.bytes,
                tipo: conAudio ? 'completa' : 'ligera'
              }
            }
          })
          .catch((e: unknown) =>
            this.p.registrar?.('aviso', `copias: no se pudo guardar la última copia: ${String(e)}`)
          )
      }
      return { ...resultado, ubicacionId: this.p.recordarUbicacion(destino) }
    }).catch(() => undefined) // el fallo ya salió por `copias:cambio`
    return { trabajoId }
  }

  // ---------------------------------------------------------------------------- importar

  /** Diálogo «Abrir» del sistema (filtro `.shinobi`); `null` si se cancela. */
  async elegirOrigen(): Promise<{ origenId: string; nombre: string } | null> {
    const ruta = await this.p.dialogoAbrir(this.p.ventana())
    return ruta === null ? null : this.registrarOrigen(ruta)
  }

  /** Para un archivo que main ya conoce (p. ej. el arrastrado a la ventana): el renderer solo ve el id. */
  registrarOrigen(ruta: string): { origenId: string; nombre: string } {
    const origenId = (this.p.uuid ?? randomUUID)()
    this.origenes.set(origenId, { ruta, caduca: this.ahora() + CADUCIDAD_ORIGEN_MS })
    return { origenId, nombre: basename(ruta) }
  }

  /** Valida el ZIP y devuelve el resumen para la confirmación; no escribe nada. */
  async leer(origenId: string): Promise<ResumenPaqueteIpc> {
    const origen = this.origen(origenId)
    const paquete = await abrirPaquete(origen.ruta)
    try {
      return await resumirPaquete(this.p, paquete, basename(origen.ruta))
    } finally {
      paquete.lector.cerrar()
    }
  }

  /**
   * Importa o restaura. Devuelve el `trabajoId` al aceptarse; el resultado por canción llega en
   * `copias:cambio` `terminada` (o `cancelada`) → `resultado`.
   */
  async importar(
    peticion: PeticionImportar & { origenId: string }
  ): Promise<{ trabajoId: string }> {
    this.exigirAbierto()
    const origen = this.origen(peticion.origenId)
    const trabajoId = (this.p.uuid ?? randomUUID)()
    this.encolar(trabajoId, 'importar', async (signal, avance) => {
      const paquete = await abrirPaquete(origen.ruta)
      try {
        return await importarPaquete(this.p, paquete, peticion, signal, avance)
      } finally {
        paquete.lector.cerrar()
      }
    })
      .then(() => this.origenes.delete(peticion.origenId))
      .catch(() => undefined) // el fallo ya salió por `copias:cambio`
    return { trabajoId }
  }

  /**
   * Un `.shinobi` soltado en la ventana: el preload obtiene la ruta de `File` y main la valida (archivo
   * existente, extensión `.shinobi`, fuera de los datos de la app) antes de registrarla. `null` si no sirve.
   */
  async origenDesdeRuta(ruta: string): Promise<{ origenId: string; nombre: string } | null> {
    const absoluta = resolve(ruta)
    if (extname(absoluta).toLowerCase() !== `.${EXTENSION_PAQUETE}`) return null
    const rel = relative(resolve(this.p.directorioDatos), absoluta)
    if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return null
    try {
      if (!(await stat(absoluta)).isFile()) return null
    } catch {
      return null
    }
    return this.registrarOrigen(absoluta)
  }

  // ---------------------------------------------------------------------------- cola

  /** Cancela un trabajo en marcha (se detiene tras el archivo en curso) o en cola (no llega a empezar). */
  cancelar(trabajoId: string): void {
    const t = this.trabajos.get(trabajoId)
    if (!t) return
    t.abortar.abort()
    t.descartar?.()
  }

  hayTrabajos(): boolean {
    return this.trabajos.size > 0
  }

  /** Cierre de la app: cancela todo lo que haya (los temporales se borran al abortar). */
  async cerrar(): Promise<void> {
    this.cerrado = true
    for (const t of this.trabajos.values()) t.abortar.abort()
    await this.cola.catch(() => undefined)
  }

  private encolar<T>(
    id: string,
    tipo: Trabajo['tipo'],
    tarea: (signal: AbortSignal, avance: Avance) => Promise<T>
  ): Promise<T> {
    const trabajo: Trabajo = { id, tipo, abortar: new AbortController(), iniciado: false }
    this.trabajos.set(id, trabajo)
    if (this.trabajos.size > 1) this.p.emitirCambio({ trabajoId: id, estado: 'en_cola', tipo })
    const resultado = this.cola.then(async () => {
      if (trabajo.abortar.signal.aborted) throw new ErrorCancelado()
      trabajo.iniciado = true
      this.p.emitirCambio({ trabajoId: id, estado: 'en_curso', tipo })
      return tarea(trabajo.abortar.signal, this.avance(id))
    })
    this.cola = resultado.catch(() => undefined)
    return resultado.then(
      (valor) => {
        this.trabajos.delete(id)
        const cancelada = trabajo.abortar.signal.aborted
        this.p.emitirCambio({
          trabajoId: id,
          estado: cancelada ? 'cancelada' : 'terminada',
          tipo,
          resultado: valor as CambioCopiaIpc['resultado']
        })
        return valor
      },
      (e: unknown) => {
        this.trabajos.delete(id)
        const codigo = tipo === 'exportar' ? codigoDeExportacion(e) : codigoDeImportacion(e)
        if (codigo === 'CANCELADO') {
          this.p.emitirCambio({ trabajoId: id, estado: 'cancelada', tipo })
        } else {
          this.p.registrar?.('error', `copias ${tipo}: ${codigo}: ${String(e)}`)
          this.p.emitirCambio({ trabajoId: id, estado: 'error', tipo, codigo })
        }
        throw e instanceof ErrorPaquete
          ? e
          : new ErrorPaquete(codigo as CodigoError, 'No se pudo completar.')
      }
    )
  }

  /** Progreso por bytes y por canción, repartido como mucho cada `INTERVALO_PROGRESO_MS`. */
  private avance(trabajoId: string): Avance {
    let ultimo = Number.NEGATIVE_INFINITY
    let total = 0
    let hechos = 0
    let cancion: ProgresoCopiaIpc['cancion']
    const emitir = (forzar: boolean): void => {
      const ahora = this.ahora()
      if (!forzar && ahora - ultimo < INTERVALO_PROGRESO_MS) return
      ultimo = ahora
      const fraccion =
        total > 0
          ? hechos / total
          : cancion && cancion.total > 0
            ? cancion.hechas / cancion.total
            : 0
      this.p.emitirProgreso({
        trabajoId,
        fraccion: Math.min(1, Math.max(0, fraccion)),
        ...(cancion ? { cancion } : {})
      })
    }
    return {
      total: (n) => {
        total = n
      },
      bytes: (n) => {
        hechos = n
        emitir(false)
      },
      cancion: (hechas, totalCanciones, titulo) => {
        cancion = { hechas, total: totalCanciones, titulo }
        emitir(true)
      }
    }
  }

  private origen(origenId: string): Origen {
    const o = this.origenes.get(origenId)
    if (!o || o.caduca <= this.ahora()) {
      this.origenes.delete(origenId)
      throw new ErrorPaquete(
        'ARCHIVO_NO_ENCONTRADO',
        'El archivo elegido caducó. Vuelve a elegirlo.'
      )
    }
    return o
  }

  private ahora(): number {
    return (this.p.reloj ?? Date.now)()
  }

  private exigirAbierto(): void {
    if (this.cerrado) throw new ErrorPaquete('ERROR_INTERNO', 'La aplicación se está cerrando.')
  }
}
