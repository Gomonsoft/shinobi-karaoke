import { randomUUID } from 'node:crypto'
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { isAbsolute, join, normalize } from 'node:path'
import {
  NOMBRES_PASO,
  estiloPredeterminado,
  migrarCancion,
  puedeMarcarseLista,
  motivosParaNoEstarLista,
  type Cancion,
  type Estilo,
  type PasoCancion
} from '../../shared'
import { escribirJsonAtomico, flush, leerJson } from '../persistencia'
import { registroNulo, type RegistroApp } from '../registro'
import {
  resumenDanadaPorJson,
  resumirCancion,
  type MotivoDanada,
  type ResumenCancion
} from './resumen'
import {
  ErrorBiblioteca,
  type CambioCancion,
  type DatosNuevaCancion,
  type EventoCancion,
  type ImportacionPreparada,
  type OpcionesActualizar,
  type ShellBiblioteca
} from './operaciones'

const MODULO = 'biblioteca'
const CONCURRENCIA = 32
const PISTAS_POR_DEFECTO = ['pistas/voz.flac', 'pistas/instrumental.flac']

export interface OpcionesServicioBiblioteca {
  registro?: RegistroApp
  /** Reloj inyectable (pruebas). */
  ahora?: () => Date
  /** Estilo que se copia a las canciones nuevas (`config.estilo_predeterminado`). */
  estiloPredeterminado?: () => Estilo
  /** `electron.shell` (papelera y abrir carpeta). */
  shell?: ShellBiblioteca
  /** Se espera antes de eliminar una canción (0014: cancela sus trabajos). */
  antesDeEliminar?: (id: string) => Promise<void>
}

interface Entrada {
  resumen: ResumenCancion
  cancion: Cancion | null
}

async function existe(ruta: string): Promise<boolean> {
  try {
    return (await stat(ruta)).isFile()
  } catch {
    return false
  }
}

/** Ruta relativa segura (dentro de la carpeta de la canción). */
function rutaInterna(carpeta: string, relativa: string): string | null {
  if (isAbsolute(relativa)) return null
  const norm = normalize(relativa)
  if (norm.startsWith('..')) return null
  return join(carpeta, norm)
}

async function existeRuta(ruta: string): Promise<boolean> {
  try {
    await stat(ruta)
    return true
  } catch {
    return false
  }
}

async function esCarpeta(ruta: string): Promise<boolean> {
  try {
    return (await stat(ruta)).isDirectory()
  } catch {
    return false
  }
}

async function enParalelo<T>(items: T[], f: (item: T) => Promise<void>): Promise<void> {
  let siguiente = 0
  const trabajadores = Array.from({ length: Math.min(CONCURRENCIA, items.length) }, async () => {
    while (siguiente < items.length) {
      const item = items[siguiente++] as T
      await f(item)
    }
  })
  await Promise.all(trabajadores)
}

/**
 * Índice en memoria de la biblioteca (ADR 0006). Lee `biblioteca/<id>/cancion.json`
 * al arrancar; las canciones ilegibles o sin pistas se indexan como dañadas.
 */
export class ServicioBiblioteca {
  private readonly dirBiblioteca: string
  private readonly registro: RegistroApp
  private readonly ahora: () => Date
  private readonly estiloBase: () => Estilo
  private readonly shell: ShellBiblioteca | null
  private readonly antesDeEliminar: ((id: string) => Promise<void>) | null
  private readonly oyentes = new Set<(evento: EventoCancion) => void>()
  /** Operaciones estructurales (crear/eliminar…) por id, en serie. */
  private readonly cadenas = new Map<string, Promise<unknown>>()
  private indice = new Map<string, Entrada>()

  constructor(datos: string, opciones: OpcionesServicioBiblioteca = {}) {
    this.dirBiblioteca = join(datos, 'biblioteca')
    this.registro = opciones.registro ?? registroNulo
    this.ahora = opciones.ahora ?? (() => new Date())
    this.estiloBase = opciones.estiloPredeterminado ?? estiloPredeterminado
    this.shell = opciones.shell ?? null
    this.antesDeEliminar = opciones.antesDeEliminar ?? null
  }

  /**
   * Recuperación al arrancar: vacía `.importando/`, pasa los pasos `en_curso` a
   * `interrumpido` (no puede haber trabajos vivos de otra sesión) y escanea.
   */
  async arrancar(): Promise<ResumenCancion[]> {
    await this.vaciarImportando()
    return this.escanear({ interrumpirEnCurso: true })
  }

  /** Recorre `biblioteca/*` (ignorando entradas con punto) y reconstruye el índice. */
  async escanear(opciones: { interrumpirEnCurso?: boolean } = {}): Promise<ResumenCancion[]> {
    await mkdir(this.dirBiblioteca, { recursive: true })
    const entradas = await readdir(this.dirBiblioteca, { withFileTypes: true })
    const ids = entradas
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)

    const nuevo = new Map<string, Entrada>()
    await enParalelo(ids, async (id) => {
      nuevo.set(id, await this.leerCancion(id, opciones.interrumpirEnCurso === true))
    })
    this.indice = nuevo
    return this.listar()
  }

  /** Resúmenes ordenados por `modificada` descendente. */
  listar(): ResumenCancion[] {
    return [...this.indice.values()]
      .map((e) => e.resumen)
      .sort((a, b) => b.modificada.localeCompare(a.modificada) || a.id.localeCompare(b.id))
  }

  /** Canción completa validada (copia), o null si no existe o está dañada por JSON. */
  obtener(id: string): Cancion | null {
    const c = this.indice.get(id)?.cancion
    return c ? structuredClone(c) : null
  }

  obtenerResumen(id: string): ResumenCancion | null {
    return this.indice.get(id)?.resumen ?? null
  }

  // ---- Escritura (0010): este servicio es el único escritor de cancion.json ----

  /** Se avisa tras cada escritura confirmada. Devuelve la función para darse de baja. */
  suscribir(cb: (evento: EventoCancion) => void): () => void {
    this.oyentes.add(cb)
    return () => this.oyentes.delete(cb)
  }

  /** Crea `biblioteca/.importando/<uuid>/` para que el trabajo `importar-archivo` escriba en ella. */
  async prepararImportacion(): Promise<ImportacionPreparada> {
    const id = randomUUID()
    const ruta = join(this.dirBiblioteca, '.importando', id)
    await mkdir(ruta, { recursive: true })
    return { id, ruta }
  }

  /**
   * Escribe `cancion.json` en la carpeta de preparación y la renombra a
   * `biblioteca/<id>/` (atómico en el mismo disco). Si el destino existe, falla sin tocar nada.
   */
  materializar(id: string, datos: DatosNuevaCancion): Promise<ResumenCancion> {
    return this.enSerie(id, async () => {
      const origen = this.carpetaImportacion(id)
      const destino = this.carpetaCancion(id)
      if (!(await esCarpeta(origen))) {
        throw new ErrorBiblioteca('ARGUMENTOS_NO_VALIDOS', `No hay importación preparada ${id}.`)
      }
      if (await existeRuta(destino)) {
        throw new ErrorBiblioteca('ARGUMENTOS_NO_VALIDOS', `Ya existe la canción ${id}.`)
      }
      const cancion = this.construir(id, datos)
      const ruta = join(origen, 'cancion.json')
      await this.escribir(ruta, cancion)
      try {
        await rename(origen, destino)
      } catch (e) {
        throw new ErrorBiblioteca('ERROR_INTERNO', `No se pudo crear la canción: ${String(e)}`)
      }
      return this.indexar(id, cancion)
    })
  }

  /** Borra la carpeta de preparación (el usuario abandonó la importación). */
  descartarImportacion(id: string): Promise<void> {
    return this.enSerie(id, async () => {
      this.exigirIdSeguro(id)
      await rm(this.carpetaImportacion(id), { recursive: true, force: true })
    })
  }

  /** Crea directamente `biblioteca/<id>/cancion.json` (YouTube, ADR 0006). */
  crear(datos: DatosNuevaCancion, id: string = randomUUID()): Promise<ResumenCancion> {
    return this.enSerie(id, async () => {
      this.exigirIdSeguro(id)
      const cancion = this.construir(id, datos)
      const carpeta = this.carpetaCancion(id)
      await mkdir(this.dirBiblioteca, { recursive: true })
      try {
        await mkdir(carpeta)
      } catch {
        throw new ErrorBiblioteca('ARGUMENTOS_NO_VALIDOS', `Ya existe la canción ${id}.`)
      }
      try {
        await this.escribir(join(carpeta, 'cancion.json'), cancion)
      } catch (e) {
        await rm(carpeta, { recursive: true, force: true })
        throw e
      }
      return this.indexar(id, cancion)
    })
  }

  /**
   * Aplica un cambio parcial, valida la canción completa, actualiza `modificada`
   * y escribe con la cola de 0007. Un cambio inválido se rechaza sin escribir.
   * El índice se actualiza al momento; el evento sale al confirmarse la escritura.
   */
  async actualizar(
    id: string,
    cambio: CambioCancion,
    opciones: OpcionesActualizar = {}
  ): Promise<ResumenCancion> {
    const previa = this.exigirCancion(id)
    const candidata = this.aplicarCambio(previa, cambio)
    return this.guardar(id, candidata, opciones.debounceMs ?? 0)
  }

  /** Solo si `puedeMarcarseLista`; deja `pasos.edicion` completado. */
  async marcarLista(id: string): Promise<ResumenCancion> {
    const previa = this.exigirCancion(id)
    if (!puedeMarcarseLista(previa)) {
      const motivos = motivosParaNoEstarLista(previa)
        .map((m) => m.mensaje)
        .join(' ')
      throw new ErrorBiblioteca(
        'ARGUMENTOS_NO_VALIDOS',
        `La canción no puede marcarse lista. ${motivos}`
      )
    }
    const marca = this.ahora().toISOString()
    const candidata = structuredClone(previa)
    candidata.estado = 'lista'
    candidata.pasos.edicion = {
      ...candidata.pasos.edicion,
      estado: 'completado',
      actualizado: marca,
      error: null
    }
    return this.guardar(id, candidata, 0)
  }

  /** Cambia solo `estado` a borrador. */
  async volverABorrador(id: string): Promise<ResumenCancion> {
    const candidata = structuredClone(this.exigirCancion(id))
    candidata.estado = 'borrador'
    return this.guardar(id, candidata, 0)
  }

  /** Mueve la carpeta a la papelera; si falla, error y no se borra nada. */
  async eliminar(id: string): Promise<void> {
    // Fuera de la cadena del id: la cancelación escribe pasos con `actualizar`.
    if (this.antesDeEliminar && this.indice.has(id)) await this.antesDeEliminar(id)
    return this.enSerie(id, async () => {
      this.exigirIdSeguro(id)
      if (!this.indice.has(id)) {
        throw new ErrorBiblioteca('ARGUMENTOS_NO_VALIDOS', `No existe la canción ${id}.`)
      }
      const shell = this.exigirShell()
      const carpeta = this.carpetaCancion(id)
      // Que no quede una escritura pendiente que recree el archivo tras la papelera.
      await flush(join(carpeta, 'cancion.json')).catch(() => undefined)
      try {
        await shell.trashItem(carpeta)
      } catch (e) {
        this.registro.escribir(
          'error',
          MODULO,
          `no se pudo enviar ${id} a la papelera: ${String(e)}`
        )
        throw new ErrorBiblioteca('ERROR_INTERNO', 'No se pudo mover la canción a la papelera.')
      }
      this.indice.delete(id)
      this.emitir({ id, eliminada: true })
    })
  }

  /** Abre la carpeta de la canción en el explorador del sistema. */
  async mostrarEnCarpeta(id: string): Promise<void> {
    this.exigirIdSeguro(id)
    if (!this.indice.has(id)) {
      throw new ErrorBiblioteca('ARGUMENTOS_NO_VALIDOS', `No existe la canción ${id}.`)
    }
    const error = await this.exigirShell().openPath(this.carpetaCancion(id))
    if (error) {
      // El texto del sistema operativo (puede incluir rutas) solo va al registro.
      this.registro.escribir('error', MODULO, `openPath falló para ${id}: ${error}`)
      throw new ErrorBiblioteca('ERROR_INTERNO', 'No se pudo abrir la carpeta de la canción.')
    }
  }

  /** Fuerza las escrituras pendientes (al cerrar la app). */
  async flushTodo(): Promise<void> {
    await flush()
  }

  private carpetaCancion(id: string): string {
    return join(this.dirBiblioteca, id)
  }

  private carpetaImportacion(id: string): string {
    return join(this.dirBiblioteca, '.importando', id)
  }

  private exigirIdSeguro(id: string): void {
    if (!id || id.startsWith('.') || id !== normalize(id) || /[\\/]/.test(id)) {
      throw new ErrorBiblioteca('ARGUMENTOS_NO_VALIDOS', 'Identificador de canción no válido.')
    }
  }

  private exigirShell(): ShellBiblioteca {
    if (!this.shell) throw new ErrorBiblioteca('ERROR_INTERNO', 'Operación no disponible.')
    return this.shell
  }

  private exigirCancion(id: string): Cancion {
    this.exigirIdSeguro(id)
    const cancion = this.indice.get(id)?.cancion
    if (!cancion) {
      throw new ErrorBiblioteca(
        'ARGUMENTOS_NO_VALIDOS',
        `No existe la canción ${id} o está dañada.`
      )
    }
    return cancion
  }

  private enSerie<T>(id: string, f: () => Promise<T>): Promise<T> {
    const previa = this.cadenas.get(id) ?? Promise.resolve()
    const actual = previa.then(f, f)
    const cola = actual.catch(() => undefined)
    this.cadenas.set(id, cola)
    void cola.then(() => {
      if (this.cadenas.get(id) === cola) this.cadenas.delete(id)
    })
    return actual
  }

  private emitir(evento: EventoCancion): void {
    for (const cb of this.oyentes) {
      try {
        cb(evento)
      } catch (e) {
        this.registro.escribir('error', MODULO, `oyente de cambios falló: ${String(e)}`)
      }
    }
  }

  /** Valida la canción completa; lanza ErrorBiblioteca si no es válida. */
  private validar(candidata: unknown): Cancion {
    try {
      return migrarCancion(candidata)
    } catch (e) {
      throw new ErrorBiblioteca(
        'ARGUMENTOS_NO_VALIDOS',
        e instanceof Error ? e.message : 'Datos de canción no válidos.'
      )
    }
  }

  private construir(id: string, datos: DatosNuevaCancion): Cancion {
    const marca = this.ahora().toISOString()
    const pendiente = (): PasoCancion => ({ estado: 'pendiente', actualizado: null, error: null })
    return this.validar({
      esquema: 1,
      id,
      creada: marca,
      modificada: marca,
      estado: 'borrador',
      metadatos: datos.metadatos,
      fuente: datos.fuente,
      pistas: datos.pistas ?? null,
      letra: datos.letra ?? null,
      estilo: this.estiloBase(),
      pasos: {
        fuente: datos.pasos?.fuente ?? pendiente(),
        separacion: datos.pasos?.separacion ?? pendiente(),
        letra: datos.pasos?.letra ?? pendiente(),
        edicion: datos.pasos?.edicion ?? pendiente()
      }
    })
  }

  private aplicarCambio(previa: Cancion, cambio: CambioCancion): Cancion {
    const c = structuredClone(previa) as Cancion
    if (cambio.metadatos) Object.assign(c.metadatos, structuredClone(cambio.metadatos))
    if (cambio.fuente) Object.assign(c.fuente, structuredClone(cambio.fuente))
    if ('pistas' in cambio && cambio.pistas !== undefined) c.pistas = structuredClone(cambio.pistas)
    if ('letra' in cambio && cambio.letra !== undefined) c.letra = structuredClone(cambio.letra)
    if (cambio.estilo) c.estilo = structuredClone(cambio.estilo)
    if (cambio.pasos) {
      for (const n of NOMBRES_PASO) {
        const p = cambio.pasos[n]
        if (p) Object.assign(c.pasos[n], structuredClone(p))
      }
    }
    c.modificada = this.ahora().toISOString()
    return this.validar(c)
  }

  /** Escritura inmediata y confirmada (creación). */
  private async escribir(ruta: string, cancion: Cancion): Promise<void> {
    try {
      await escribirJsonAtomico(ruta, cancion)
      await flush(ruta)
    } catch (e) {
      this.registro.escribir('error', MODULO, `no se pudo escribir ${ruta}: ${String(e)}`)
      throw new ErrorBiblioteca('ERROR_INTERNO', 'No se pudo guardar la canción.')
    }
  }

  private async indexar(id: string, cancion: Cancion): Promise<ResumenCancion> {
    const entrada = await this.entradaDe(id, cancion)
    this.indice.set(id, entrada)
    this.emitir({ id, resumen: entrada.resumen })
    return entrada.resumen
  }

  private async entradaDe(id: string, cancion: Cancion): Promise<Entrada> {
    const carpeta = this.carpetaCancion(id)
    const motivo = await this.detectarDanada(carpeta, cancion)
    let miniatura: string | null = null
    if (cancion.fuente.miniatura) {
      const ruta = rutaInterna(carpeta, cancion.fuente.miniatura)
      if (ruta && (await existe(ruta))) miniatura = ruta
    }
    return { resumen: resumirCancion(id, cancion, miniatura, motivo), cancion }
  }

  /**
   * Actualiza el índice en el acto (la lectura inmediata ve el último valor) y
   * encola la escritura; el evento sale cuando se confirma. Si falla, se revierte.
   */
  private async guardar(
    id: string,
    candidata: Cancion,
    debounceMs: number
  ): Promise<ResumenCancion> {
    const anterior = this.indice.get(id) as Entrada
    const miniatura = anterior.resumen.miniatura
    const motivo = anterior.resumen.motivo === 'pistas' ? 'pistas' : null
    const entrada: Entrada = {
      resumen: resumirCancion(id, candidata, miniatura, motivo),
      cancion: candidata
    }
    this.indice.set(id, entrada)
    const ruta = join(this.carpetaCancion(id), 'cancion.json')
    try {
      await escribirJsonAtomico(ruta, candidata, { debounceMs })
    } catch (e) {
      if (this.indice.get(id) === entrada) this.indice.set(id, anterior)
      this.registro.escribir('error', MODULO, `no se pudo guardar ${id}: ${String(e)}`)
      throw new ErrorBiblioteca('ERROR_INTERNO', 'No se pudo guardar la canción.')
    }
    // Las pistas pudieron cambiar: se recalcula "dañada por pistas" ya confirmada la escritura.
    if (this.indice.get(id) === entrada) {
      const fresca = await this.entradaDe(id, candidata)
      if (this.indice.get(id) === entrada) this.indice.set(id, fresca)
      this.emitir({ id, resumen: fresca.resumen })
      return fresca.resumen
    }
    const actual = this.indice.get(id)
    if (actual) this.emitir({ id, resumen: actual.resumen })
    return actual?.resumen ?? entrada.resumen
  }

  private async vaciarImportando(): Promise<void> {
    const dir = join(this.dirBiblioteca, '.importando')
    await mkdir(dir, { recursive: true })
    for (const nombre of await readdir(dir)) {
      await rm(join(dir, nombre), { recursive: true, force: true })
    }
  }

  private async leerCancion(id: string, interrumpir: boolean): Promise<Entrada> {
    const carpeta = join(this.dirBiblioteca, id)
    const lectura = await leerJson(join(carpeta, 'cancion.json'), migrarCancion)
    if (!lectura.ok) {
      this.registro.escribir('error', MODULO, `canción dañada (${id}): ${lectura.motivo}`)
      return { resumen: resumenDanadaPorJson(id), cancion: null }
    }
    let cancion = lectura.datos
    if (lectura.recuperadoDeBak) {
      this.registro.escribir('aviso', MODULO, `canción ${id} recuperada desde .bak`)
    }
    if (interrumpir) cancion = await this.interrumpirEnCurso(carpeta, id, cancion)

    const motivo = await this.detectarDanada(carpeta, cancion)
    if (motivo) this.registro.escribir('error', MODULO, `canción dañada (${id}): faltan pistas`)

    let miniatura: string | null = null
    if (cancion.fuente.miniatura) {
      const ruta = rutaInterna(carpeta, cancion.fuente.miniatura)
      if (ruta && (await existe(ruta))) miniatura = ruta
    }
    return { resumen: resumirCancion(id, cancion, miniatura, motivo), cancion }
  }

  private async interrumpirEnCurso(
    carpeta: string,
    id: string,
    cancion: Cancion
  ): Promise<Cancion> {
    if (!NOMBRES_PASO.some((n) => cancion.pasos[n].estado === 'en_curso')) return cancion
    const copia = structuredClone(cancion)
    const marca = this.ahora().toISOString()
    for (const n of NOMBRES_PASO) {
      const p = copia.pasos[n]
      if (p.estado === 'en_curso') {
        p.estado = 'interrumpido'
        p.actualizado = marca
      }
    }
    const ruta = join(carpeta, 'cancion.json')
    try {
      await escribirJsonAtomico(ruta, copia)
      await flush(ruta)
    } catch (e) {
      this.registro.escribir(
        'error',
        MODULO,
        `no se pudo guardar ${id} tras interrumpir: ${String(e)}`
      )
    }
    return copia
  }

  private async detectarDanada(carpeta: string, cancion: Cancion): Promise<MotivoDanada | null> {
    if (cancion.pasos.separacion.estado !== 'completado') return null
    const relativas = cancion.pistas
      ? [cancion.pistas.voz, cancion.pistas.instrumental]
      : PISTAS_POR_DEFECTO
    for (const rel of relativas) {
      const ruta = rutaInterna(carpeta, rel)
      if (!ruta || !(await existe(ruta))) return 'pistas'
    }
    return null
  }
}
