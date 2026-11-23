import { randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import {
  contarLineas,
  detectarIdioma,
  estadoPasoLetra,
  letraSchema,
  sinPalabras,
  validarPalabrasManuales,
  type Cancion,
  type EdicionLetraIpc,
  type ElementoLetra,
  type Letra,
  type Preparacion
} from '../../shared'
import {
  MAX_BYTES_LETRA,
  aplicarTextoEditado,
  esLrc,
  lrcALetra,
  normalizarLetra,
  retirarCamposObsoletos,
  textoPlanoALetra
} from '../../shared/letras'
import {
  sincroniaDe,
  type ArchivoLetraLeido,
  type EditarTextoLetra,
  type EditarTextoLinea,
  type GuardarTiempos,
  type GuardarLetra
} from '../../shared/letrasBusqueda'
import { corregirDesfase } from '../../shared/encaje'
import { ErrorBiblioteca } from '../biblioteca/operaciones'
import type { ServicioBiblioteca } from '../biblioteca/servicio'
import type { ResumenCancion } from '../biblioteca/resumen'
import type { DialogoArchivos } from '../fuente/archivo'

/** Espera para agrupar las ediciones de texto seguidas (ADR 0006: ~1 s). */
export const DEBOUNCE_EDICION_MS = 1000

export interface OpcionesServicioLetras {
  biblioteca: ServicioBiblioteca
  /** Selector nativo de archivos (con el doble de pruebas ya aplicado). */
  dialogo: DialogoArchivos
  ahora?: () => Date
  debounceEdicionMs?: number
}

const sinLetra = (mensaje: string): ErrorBiblioteca =>
  new ErrorBiblioteca('ARCHIVO_SIN_LETRA', mensaje)
const noValido = (mensaje: string): ErrorBiblioteca =>
  new ErrorBiblioteca('ARGUMENTOS_NO_VALIDOS', mensaje)

/**
 * Decodifica el archivo: BOM UTF-8 o UTF-16 LE/BE; si no, UTF-8 estricto y, si falla, Windows-1252
 * (ADR 0005, Revisión 2026-11-05). Devuelve null si parece binario (bytes NUL sin BOM UTF-16).
 */
export function decodificarTextoLetra(bytes: Uint8Array): string | null {
  const b = bytes
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(b.subarray(2))
  }
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(b.subarray(2))
  }
  if (b.includes(0)) return null
  const inicio = b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(inicio))
  } catch {
    return new TextDecoder('windows-1252').decode(b.subarray(inicio))
  }
}

/** Una letra nueva solo trae texto, tiempos y palabras: nada de campos de revisión o reparto. */
function soloTextoYTiempos(e: ElementoLetra): ElementoLetra {
  const { id, tipo, texto, inicio_ms, fin_ms, palabras } = e
  return { id, tipo, texto, inicio_ms, fin_ms, palabras }
}

/**
 * Único escritor de `letra`: guardar, editarTexto, editarTextoLinea, guardarTiempos (ADR 0006 y 0010).
 * Escribe siempre con `ServicioBiblioteca.actualizar`, que emite `evento:cancion`.
 */
export class ServicioLetras {
  private readonly biblioteca: ServicioBiblioteca
  private readonly dialogo: DialogoArchivos
  private readonly ahora: () => Date
  private readonly debounceMs: number
  private visita: { id: string; cancionId: string; referencia: Letra | null } | null = null
  private readonly escriturasTiempos = new Map<string, Promise<ResumenCancion>>()

  constructor(opciones: OpcionesServicioLetras) {
    this.biblioteca = opciones.biblioteca
    this.dialogo = opciones.dialogo
    this.ahora = opciones.ahora ?? (() => new Date())
    this.debounceMs = opciones.debounceEdicionMs ?? DEBOUNCE_EDICION_MS
  }

  /**
   * Sustituye la letra entera. `porPreparacion` (solo la preparación desatendida, ADR 0025) la escribe
   * sin contarla como una edición del usuario.
   */
  async guardar(
    peticion: GuardarLetra,
    opciones: { porPreparacion?: boolean } = {}
  ): Promise<ResumenCancion> {
    const cancion = this.biblioteca.obtener(peticion.cancionId)
    if (!cancion) throw noValido('La canción no existe o está dañada.')
    let lineas: ElementoLetra[]
    let letra: Letra
    // Con `desfase_ms` la letra se guarda ya corregida: solo cambia `offset_ms` (ADR 0024 §1).
    const correccion = corregirDesfase({ offset_ms: 0 }, peticion.desfase_ms ?? 0)
    try {
      // Letra nueva: solo cuentan texto y tiempos; el fin que traía es `origen_fin: "letra"` (ADR 0024 §4).
      lineas = normalizarLetra(peticion.lineas.map(soloTextoYTiempos)).map((l) =>
        l.tipo === 'linea' && l.fin_ms !== null ? { ...l, origen_fin: 'letra' as const } : l
      )
      const idioma = detectarIdioma(lineas)
      letra = letraSchema.parse({
        origen: peticion.origen,
        lrclib_id: peticion.lrclib_id,
        ...correccion,
        lineas,
        intacta: true,
        ...(idioma ? { idioma } : {})
      })
    } catch {
      throw noValido('La letra no es válida.')
    }
    if (contarLineas(letra) < 1) throw noValido('La letra necesita al menos una línea.')
    this.invalidarEdicionDe(peticion.cancionId)
    return this.escribir(peticion.cancionId, letra, 0, !opciones.porPreparacion)
  }

  /** Aplica el texto editado sobre la letra guardada en este momento (conserva ids y tiempos). */
  async editarTexto(peticion: EditarTextoLetra): Promise<ResumenCancion> {
    // Todo el cálculo es síncrono hasta `actualizar`: dos llamadas seguidas se aplican en orden.
    const cancion = this.biblioteca.obtener(peticion.cancionId)
    if (!cancion) throw noValido('La canción no existe o está dañada.')
    const previa: Letra = cancion.letra ?? {
      origen: 'manual',
      lrclib_id: null,
      offset_ms: 0,
      lineas: []
    }
    let nueva: Letra
    try {
      nueva = letraSchema.parse(aplicarTextoEditado(previa, peticion.texto))
    } catch {
      throw noValido('El texto de la letra no es válido.')
    }
    const resumenActual = this.biblioteca.obtenerResumen(peticion.cancionId)
    if (JSON.stringify(nueva.lineas) === JSON.stringify(previa.lineas)) {
      if (resumenActual) return resumenActual
    }
    if (contarLineas(nueva) === 0 && cancion.estado === 'lista') {
      throw noValido('Una canción lista necesita al menos una línea de letra.')
    }
    this.invalidarEdicionDe(peticion.cancionId)
    return this.escribir(peticion.cancionId, nueva, this.debounceMs, true)
  }

  /** Elige y lee un `.lrc`/`.txt`. No escribe nada; la ruta no sale de aquí. */
  async leerArchivo(): Promise<ArchivoLetraLeido> {
    const r = await this.dialogo.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Letra (.lrc, .txt)', extensions: ['lrc', 'txt'] }]
    })
    const ruta = r.canceled ? undefined : r.filePaths[0]
    if (!ruta) return { cancelado: true }

    let bytes: Uint8Array
    try {
      if ((await stat(ruta)).size > MAX_BYTES_LETRA)
        throw sinLetra('El archivo es demasiado grande.')
      bytes = await readFile(ruta)
    } catch (e) {
      if (e instanceof ErrorBiblioteca) throw e
      throw sinLetra('No se pudo leer el archivo.')
    }
    if (bytes.length > MAX_BYTES_LETRA) throw sinLetra('El archivo es demasiado grande.')
    const texto = decodificarTextoLetra(bytes)
    if (texto === null) throw sinLetra('El archivo no contiene texto.')

    let lineas: ElementoLetra[]
    let ignoradas = 0
    try {
      if (esLrc(texto)) {
        const l = lrcALetra(texto)
        lineas = l.lineas
        ignoradas = l.ignoradas
      } else {
        lineas = textoPlanoALetra(texto)
      }
    } catch {
      throw sinLetra('El archivo no contiene letra legible.')
    }
    if (!lineas.some((l) => l.tipo === 'linea')) throw sinLetra('El archivo no contiene letra.')
    return {
      cancelado: false,
      nombre: basename(ruta),
      lineas,
      sincronia: sincroniaDe(lineas),
      ignoradas
    }
  }

  abrirEdicion(cancionId: string): EdicionLetraIpc | null {
    this.liberarEdicion()
    const cancion = this.biblioteca.obtener(cancionId)
    if (!cancion) return null
    const sesionId = randomUUID()
    this.visita = { id: sesionId, cancionId, referencia: structuredClone(cancion.letra) }
    return { cancion, sesionId }
  }

  cerrarEdicion(sesionId: string): void {
    if (this.visita?.id === sesionId) this.liberarEdicion()
  }

  liberarEdicion(): void {
    this.visita = null
  }

  /**
   * Cambia solo el texto de una línea (ADR 0021 §7): conserva `id`, `inicio_ms` y `fin_ms`, quita sus
   * palabras y **actualiza** la referencia de la visita en lugar de invalidarla, para que el historial
   * del editor siga valiendo. En la referencia se actualiza el texto y se conservan las palabras de la
   * línea: así deshacer puede restaurar unas palabras importadas con `guardarTiempos`. Se escribe sin
   * *debounce* y en la misma cola que `guardarTiempos` (texto → tiempos, en orden).
   */
  async editarTextoLinea(peticion: EditarTextoLinea, sesionId: string): Promise<ResumenCancion> {
    const { cancionId, id, texto } = peticion
    const cancion = this.biblioteca.obtener(cancionId)
    if (!cancion) throw noValido('La canción no existe o está dañada.')
    const { letra } = cancion
    const visita = this.visita
    const referencia = visita?.referencia
    if (
      visita?.id !== sesionId ||
      visita.cancionId !== cancionId ||
      !letra ||
      !referencia ||
      letra.lineas.length !== referencia.lineas.length ||
      letra.lineas.some((linea, i) => linea.id !== referencia.lineas[i]?.id)
    ) {
      throw new ErrorBiblioteca(
        'LETRA_DESACTUALIZADA',
        'La letra ha cambiado desde que se abrió el editor.'
      )
    }
    const i = letra.lineas.findIndex((l) => l.id === id)
    const actual = letra.lineas[i]
    if (!actual || actual.tipo !== 'linea') throw noValido('La línea no existe en la letra.')

    const resumen = this.biblioteca.obtenerResumen(cancionId)
    if (actual.texto === texto) {
      if (resumen) return this.escriturasTiempos.get(cancionId) ?? resumen
    }
    const lineas = letra.lineas.map((l, j) => (j === i ? { ...sinPalabras(l), texto } : l))
    const nueva = letraSchema.safeParse({ ...letra, lineas })
    if (!nueva.success) throw noValido('El texto de la línea no es válido.')

    // Se actualiza antes de ceder el turno: el siguiente `guardarTiempos` ya ve el texto nuevo.
    referencia.lineas[i] = { ...referencia.lineas[i]!, texto }
    return this.escribirTiempos(cancionId, nueva.data)
  }

  /** Escritura sin *debounce* compartida por `guardarTiempos` y `editarTextoLinea`. */
  private async escribirTiempos(
    cancionId: string,
    letra: Letra,
    porUsuario = true
  ): Promise<ResumenCancion> {
    const escritura = this.escribir(cancionId, letra, 0, porUsuario)
    this.escriturasTiempos.set(cancionId, escritura)
    try {
      return await escritura
    } finally {
      if (this.escriturasTiempos.get(cancionId) === escritura)
        this.escriturasTiempos.delete(cancionId)
    }
  }

  /**
   * Corrección diferida del desfase (ADR 0024 §1, tarea 0367): sin sesión de edición, por el mismo camino
   * de escritura de `guardarTiempos`. Solo si la letra está `intacta`, sin corrección previa, la canción
   * es un borrador y el editor no la tiene abierta (su copia en memoria la revertiría). Devuelve el
   * desfase realmente aplicado, o `null` si no procede.
   */
  async corregirDesfaseDiferido(cancionId: string, desfaseMs: number): Promise<number | null> {
    const cancion = this.biblioteca.obtener(cancionId)
    const letra = cancion?.letra
    if (!cancion || !letra || cancion.estado !== 'borrador') return null
    if (
      letra.intacta !== true ||
      letra.desfase_corregido_ms !== undefined ||
      letra.desfase_descartado === true
    )
      return null
    if (this.visita?.cancionId === cancionId) return null
    const c = corregirDesfase(letra, desfaseMs)
    if (c.offset_ms === letra.offset_ms) return null
    const nueva = letraSchema.safeParse({
      ...letra,
      offset_ms: c.offset_ms,
      desfase_corregido_ms: c.desfase_corregido_ms
    })
    if (!nueva.success) return null
    // Corrección automática: no es una edición del usuario.
    await this.escribirTiempos(cancionId, nueva.data, false)
    return c.offset_ms - letra.offset_ms
  }

  private invalidarEdicionDe(cancionId: string): void {
    if (this.visita?.cancionId === cancionId) this.liberarEdicion()
  }

  /** Valida la visita y encola la escritura sin ceder el turno entre lectura y actualización. */
  async guardarTiempos(peticion: GuardarTiempos, sesionId: string): Promise<ResumenCancion> {
    const { cancionId, offset_ms, tiempos } = peticion
    const cancion = this.biblioteca.obtener(cancionId)
    if (!cancion) throw noValido('La canción no existe o está dañada.')
    const { letra } = cancion
    const visita = this.visita
    const referencia = visita?.referencia
    if (
      visita?.id !== sesionId ||
      visita.cancionId !== cancionId ||
      !letra ||
      !referencia ||
      letra.lineas.length !== tiempos.length ||
      referencia.lineas.length !== tiempos.length ||
      letra.lineas.some(
        (linea, i) => linea.id !== tiempos[i]?.id || linea.id !== referencia.lineas[i]?.id
      )
    ) {
      throw new ErrorBiblioteca(
        'LETRA_DESACTUALIZADA',
        'La letra ha cambiado desde que se abrió el editor.'
      )
    }

    // Cambiar el desfase mueve la letra entera respecto a la voz: las líneas dadas por buenas dejan de
    // estar comprobadas (ADR 0024 §4, pregunta 0172). Vale aunque el cliente envíe `revisada`.
    const cambiaDesfase = offset_ms !== letra.offset_ms
    const lineas = letra.lineas.map((guardada, i): ElementoLetra => {
      const inicial = referencia.lineas[i]!
      const { inicio_ms, fin_ms, palabras, origen_palabras, origen_fin, revisada } = tiempos[i]!
      // `origen_palabras` solo se escribe con palabras manuales: en cualquier otro caso se quita.
      // `origen_fin` y `revisada` son el estado completo de la línea: ausentes = a mano / sin revisar.
      const linea = sinPalabras(guardada)
      delete linea.origen_fin
      delete linea.revisada
      if (origen_fin) linea.origen_fin = origen_fin
      if (revisada && !cambiaDesfase) linea.revisada = revisada
      if (linea.tipo === 'pausa') {
        if (
          palabras !== null ||
          (inicio_ms !== null && inicio_ms !== inicial.inicio_ms) ||
          (fin_ms !== null && fin_ms !== inicial.fin_ms)
        )
          throw noValido('Los tiempos de la pausa no coinciden con la letra guardada.')
        return { ...linea, inicio_ms, fin_ms, palabras: null }
      }
      if (palabras === null) return { ...linea, inicio_ms, fin_ms, palabras }
      if (origen_palabras === 'manual') {
        // Palabras hechas a mano: se validan contra el texto guardado y el fin de la línea (el fijado o,
        // si no hay, el inicio del siguiente elemento); no se comparan con la referencia.
        const tope = fin_ms ?? tiempos[i + 1]?.inicio_ms ?? null
        if (validarPalabrasManuales({ texto: linea.texto, inicio_ms, palabras }, tope).length > 0)
          throw noValido('Las palabras no son válidas para la línea.')
        return { ...linea, inicio_ms, fin_ms, palabras, origen_palabras: 'manual' }
      }
      const originales = inicial.palabras
      if (
        !originales ||
        originales.length !== palabras.length ||
        inicio_ms === null ||
        inicial.inicio_ms === null
      ) {
        throw noValido('Las palabras no coinciden con la letra guardada.')
      }
      const delta = inicio_ms - inicial.inicio_ms
      const validadas = originales.map((original, j) => {
        const nueva = palabras[j]!
        if (
          nueva.texto !== original.texto ||
          nueva.inicio_ms !== original.inicio_ms + delta ||
          nueva.fin_ms !== original.fin_ms + delta
        ) {
          throw noValido('Las palabras no coinciden con la letra guardada.')
        }
        return { texto: original.texto, inicio_ms: nueva.inicio_ms, fin_ms: nueva.fin_ms }
      })
      return { ...linea, inicio_ms, fin_ms, palabras: validadas }
    })

    // `desfase_corregido_ms`: número = se anota, `null` = se borra, ausente = igual (ADR 0024 §1).
    const { desfase_corregido_ms, ...sinDesfase } = letra
    const desfase =
      peticion.desfase_corregido_ms === undefined
        ? desfase_corregido_ms
        : peticion.desfase_corregido_ms
    // Quitar una corrección que existía deja la marca: la diferida no la repone (pregunta 0207).
    const descartado =
      desfase_corregido_ms !== undefined && peticion.desfase_corregido_ms === null
        ? { desfase_descartado: true as const }
        : {}
    const nueva = letraSchema.safeParse({
      ...sinDesfase,
      ...descartado,
      offset_ms,
      ...(desfase != null ? { desfase_corregido_ms: desfase } : {}),
      lineas
    })
    if (!nueva.success) throw noValido('Los tiempos no son válidos.')
    const resumen = this.biblioteca.obtenerResumen(cancionId)
    if (resumen && JSON.stringify(nueva.data) === JSON.stringify(letra)) {
      return this.escriturasTiempos.get(cancionId) ?? resumen
    }
    return this.escribirTiempos(cancionId, nueva.data)
  }

  /**
   * Una escritura del usuario sobre una canción preparada por la app la da por revisada y, si cambia de
   * letra (otro `lrclib_id` u otro origen), `eleccion.por` pasa a `usuario` (ADR 0025 §1).
   */
  private preparacionTrasEscribir(
    cancion: Cancion | null,
    letra: Letra,
    porUsuario: boolean
  ): { preparacion: Preparacion } | Record<string, never> {
    const p = cancion?.preparacion
    if (!porUsuario || !p) return {}
    const otraLetra =
      p.eleccion != null &&
      (letra.origen !== cancion.letra?.origen || letra.lrclib_id !== cancion.letra?.lrclib_id)
    return {
      preparacion: {
        ...p,
        revisada: true,
        ...(otraLetra && p.eleccion ? { eleccion: { ...p.eleccion, por: 'usuario' as const } } : {})
      }
    }
  }

  private escribir(
    id: string,
    letra: Letra,
    debounceMs: number,
    porUsuario = true
  ): Promise<ResumenCancion> {
    const cancion = this.biblioteca.obtener(id)
    // Reglas de retirada de intacta, origen_fin, revisada y alineacion (ADR 0024 §4).
    if (cancion) letra = retirarCamposObsoletos(cancion.letra, letra, cancion.metadatos.duracion_ms)
    return this.biblioteca.actualizar(
      id,
      {
        letra,
        ...this.preparacionTrasEscribir(cancion, letra, porUsuario),
        pasos: {
          letra: {
            estado: estadoPasoLetra(letra),
            actualizado: this.ahora().toISOString(),
            error: null
          }
        }
      },
      { debounceMs }
    )
  }
}
