import { randomInt as randomIntReal, randomUUID } from 'node:crypto'
import {
  ESTILO_PREDETERMINADO,
  claveNombreTema,
  claveTexto,
  crearIndiceCatalogo,
  ErrorDatosInvalidos,
  esAparienciaNeutra,
  estiloTemaSchema,
  nombreTemaSchema,
  resolverApariencia,
  type Apariencia,
  type Cancion,
  type Catalogo,
  type DestinoHeredarIpc,
  type Estilo,
  type ImpactoIpc,
  type IndiceCatalogo,
  type OperacionTema,
  type ProgresoTemaIpc,
  type ResolucionApariencia,
  type Tema
} from '../../shared'
import type { SistemaArchivos } from '../persistencia'
import { registroNulo, type RegistroApp } from '../registro'
import { cargarCatalogo, escribirCatalogo, rutaCatalogo } from './catalogo'
import { cancelarDiario, continuarBorrado, iniciarBorrado } from './borrado'
import { ColaApariencia } from './cola'
import { ErrorTemas } from './errores'
import { Fichas, operacionCanonica } from './fichas'
import { calcularImpacto, mismoImpacto, type ImpactoCalculado } from './impacto'
import {
  ejecutarAplicar,
  ejecutarEditar,
  ejecutarGrupo,
  ejecutarPredeterminadoATema,
  ejecutarQuitarPredeterminado,
  type ContextoOperaciones,
  type ResultadoTemas
} from './operaciones'
import { construirCatalogoTemas, type CancionIndice, type CatalogoTemas } from './usos'

const MODULO = 'temas'

/** Agrupación del evento `temas:cambiado` tras cambios del índice de canciones (ADR 0016 §9). */
export const ESPERA_INDICE_MS = 250

export { ErrorTemas }

/** Resolución de una canción más lo que 0168 copia al resumen y a `resuelta` (ADR 0016 §3). */
export interface ResolucionCancion extends ResolucionApariencia {
  neutra: boolean
  /** Lo que daría la canción si heredara (conservando su `base`). Nunca `propio` ni `cancion`. */
  alHeredar: DestinoHeredarIpc
}

/** Acceso a las canciones de la biblioteca, inyectado (en 0168, `ServicioBiblioteca`). */
export interface PuertoCanciones {
  /** Resumen en memoria de todas las canciones (incluidas las dañadas). */
  indice(): readonly CancionIndice[]
  leer(id: string): Cancion | null
  /** Aplica `mutador` a la canción y la escribe (refrescando su instantánea de respaldo). */
  actualizar(id: string, mutador: (cancion: Cancion) => Cancion): Promise<void>
}

/** Forma de `TemaIpc` (0164). */
export interface TemaPublico {
  id: string
  nombre: string
  revision: number
  estilo: Estilo
}

/** Apariencia con la que nace una canción y la resolución para su instantánea (ADR 0016 §6). */
export interface AparienciaInicial {
  apariencia: Apariencia
  /** Estilo resuelto: va a `cancion.estilo`. */
  estilo: Estilo
}

export interface OpcionesServicioTemas {
  /** Carpeta `<base>/biblioteca/`. */
  dirBiblioteca: string
  puerto: PuertoCanciones
  /** `config.estilo_predeterminado` (campo heredado de 0.1.0), para sembrar el primer tema. */
  estiloInicial: Estilo
  registro?: RegistroApp
  /** Emisor de `temas:cambiado`. */
  alCambiar?: (catalogo: CatalogoTemas) => void
  /** Solo pruebas. */
  ahora?: () => string
  nuevoId?: () => string
  sistema?: SistemaArchivos
  esperaIndiceMs?: number
  /** Emisor de `temas:progreso`. */
  alProgreso?: (progreso: ProgresoTemaIpc) => void
  /** Solo pruebas: reloj en milisegundos (fichas y límite del progreso). */
  reloj?: () => number
}

const hacerPublico = (t: Tema): TemaPublico => ({
  id: t.id,
  nombre: t.nombre,
  revision: t.revision,
  estilo: structuredClone(t.estilo)
})

/**
 * Único escritor de `biblioteca/temas.json` (ADR 0016). Toda mutación pasa por `enCola`, que
 * también deben usar quienes crean canciones o cambian su apariencia o metadatos (0166–0168).
 */
export class ServicioTemas {
  private readonly cola = new ColaApariencia()
  private temporizadorIndice: NodeJS.Timeout | null = null
  private readonly fichas: Fichas

  private constructor(
    private readonly ruta: string,
    private estado: Catalogo | null,
    private readonly lecturaSola: boolean,
    private readonly o: Required<
      Pick<
        OpcionesServicioTemas,
        'puerto' | 'registro' | 'ahora' | 'nuevoId' | 'esperaIndiceMs' | 'estiloInicial' | 'reloj'
      >
    > &
      Pick<OpcionesServicioTemas, 'alCambiar' | 'alProgreso' | 'sistema'>
  ) {
    this.fichas = new Fichas(o.reloj)
  }

  static async abrir(opciones: OpcionesServicioTemas): Promise<ServicioTemas> {
    const registro = opciones.registro ?? registroNulo
    const ahora = opciones.ahora ?? ((): string => new Date().toISOString())
    const nuevoId = opciones.nuevoId ?? randomUUID
    const ruta = rutaCatalogo(opciones.dirBiblioteca)
    const e = await cargarCatalogo(ruta, {
      estiloInicial: opciones.estiloInicial,
      registro,
      ahora,
      nuevoId,
      ...(opciones.sistema ? { sistema: opciones.sistema } : {})
    })
    return new ServicioTemas(ruta, e.catalogo, e.soloLectura, {
      puerto: opciones.puerto,
      estiloInicial: opciones.estiloInicial,
      registro,
      ahora,
      nuevoId,
      esperaIndiceMs: opciones.esperaIndiceMs ?? ESPERA_INDICE_MS,
      alCambiar: opciones.alCambiar,
      alProgreso: opciones.alProgreso,
      reloj: opciones.reloj ?? Date.now,
      sistema: opciones.sistema
    })
  }

  // ---------------------------------------------------------------- lectura

  /** Catálogo con usos, grupos y referencias que faltan. */
  catalogo(): CatalogoTemas {
    return construirCatalogoTemas(this.estado, this.o.puerto.indice(), {
      soloLectura: this.lecturaSola
    })
  }

  /** ¿El catálogo es de un esquema más nuevo? Nada se escribe. */
  get soloLectura(): boolean {
    return this.lecturaSola
  }

  /** Catálogo en memoria (`null` en solo lectura). Solo lectura: no mutar. */
  datos(): Readonly<Catalogo> | null {
    return this.estado
  }

  /** Resolución de una canción con el catálogo vigente (`indice = null` en solo lectura). */
  resolver(cancion: {
    metadatos: { artista?: string | null; album?: string | null }
    estilo: Estilo
    apariencia?: Apariencia | undefined
  }): ResolucionCancion {
    const indice = this.indice()
    const r = resolverApariencia(cancion, indice)
    const base = cancion.apariencia?.base
    const h = resolverApariencia(
      {
        metadatos: cancion.metadatos,
        estilo: cancion.estilo,
        apariencia: base ? { modo: 'heredar', base } : { modo: 'heredar' }
      },
      indice
    )
    return {
      ...r,
      neutra: esAparienciaNeutra(r, cancion, this.o.estiloInicial),
      // Con `modo: heredar` la resolución nunca da `propio` ni `cancion`.
      alHeredar: {
        procedencia: h.procedencia as DestinoHeredarIpc['procedencia'],
        temaId: h.temaId,
        temaNombre: h.temaNombre
      }
    }
  }

  private indice(): IndiceCatalogo | null {
    return this.estado ? crearIndiceCatalogo(this.estado) : null
  }

  /**
   * Apariencia de una canción nueva (§6). Llamar dentro de `enCola`, en el mismo turno que la
   * creación. Con predeterminado: `heredar` sin base; si no, `base: aleatorio` con un tema que no
   * esté en borrado (uniforme); con catálogo vacío o en solo lectura, `base: incluido`.
   */
  aparienciaInicial(
    metadatos: { artista?: string | null; album?: string | null },
    randomInt: (min: number, max: number) => number = randomIntReal
  ): AparienciaInicial {
    const c = this.estado
    let apariencia: Apariencia = { modo: 'heredar' }
    if (!c || c.predeterminado === null) {
      const candidatos = (c?.temas ?? []).filter((t) => t.id !== c?.borrado_pendiente?.tema_id)
      apariencia =
        candidatos.length > 0
          ? {
              modo: 'heredar',
              base: {
                tipo: 'aleatorio',
                tema_id: candidatos[randomInt(0, candidatos.length)]!.id
              }
            }
          : { modo: 'heredar', base: { tipo: 'incluido' } }
    }
    const r = resolverApariencia(
      { metadatos, estilo: ESTILO_PREDETERMINADO, apariencia },
      this.indice()
    )
    if (r.temaNombre !== null) apariencia = { ...apariencia, tema_nombre: r.temaNombre }
    return { apariencia, estilo: structuredClone(r.estilo) }
  }

  // ---------------------------------------------------------------- cola y eventos

  /** Serializa una mutación con el resto de la cola única de apariencia. */
  enCola<T>(tarea: () => Promise<T> | T): Promise<T> {
    return this.cola.enCola(tarea)
  }

  /** El índice de canciones cambió (apariencia, metadatos, creación, papelera): reemite agrupado. */
  notificarIndiceCambiado(): void {
    if (this.temporizadorIndice) return
    this.temporizadorIndice = setTimeout(() => {
      this.temporizadorIndice = null
      this.emitir()
    }, this.o.esperaIndiceMs)
  }

  /** Cancela el temporizador pendiente (cierre de la app). */
  cerrar(): void {
    if (this.temporizadorIndice) clearTimeout(this.temporizadorIndice)
    this.temporizadorIndice = null
  }

  private emitir(): void {
    if (!this.o.alCambiar) return
    try {
      this.o.alCambiar(this.catalogo())
    } catch (e) {
      this.o.registro.escribir('error', MODULO, `oyente de temas falló: ${String(e)}`)
    }
  }

  /**
   * Escribe `nuevo` (atómico, sin debounce), lo adopta en memoria solo si se escribió y emite
   * `temas:cambiado`. Debe llamarse dentro de `enCola`. Uso interno de las operaciones (0166, 0167).
   */
  async confirmarCatalogo(nuevo: Catalogo): Promise<void> {
    this.exigirEscritura()
    await escribirCatalogo(this.ruta, nuevo, this.o.sistema)
    this.estado = nuevo
    this.emitir()
  }

  private exigirEscritura(): Catalogo {
    if (this.lecturaSola || !this.estado) {
      throw new ErrorTemas('TEMAS_SOLO_LECTURA', 'El catálogo de temas es de una versión más nueva')
    }
    return this.estado
  }

  // ---------------------------------------------------------------- operaciones sin impacto

  crear(datos: { nombre: string; estilo: Estilo }): Promise<TemaPublico> {
    return this.enCola(async () => {
      const c = this.exigirEscritura()
      const nombre = this.nombreValido(datos.nombre)
      const estilo = estiloTemaSchema.safeParse(datos.estilo)
      if (!estilo.success) {
        throw new ErrorTemas('ARGUMENTOS_NO_VALIDOS', 'El estilo del tema no es válido')
      }
      this.exigirNombreLibre(c, nombre)
      const ahora = this.o.ahora()
      const tema: Tema = {
        id: this.o.nuevoId(),
        nombre,
        creado: ahora,
        modificado: ahora,
        revision: 1,
        estilo: structuredClone(estilo.data)
      }
      await this.confirmarCatalogo({ ...c, temas: [...c.temas, tema] })
      return hacerPublico(tema)
    })
  }

  renombrar(datos: { temaId: string; revisionTema: number; nombre: string }): Promise<TemaPublico> {
    return this.enCola(async () => {
      const c = this.exigirEscritura()
      const actual = this.temaActivo(c, datos.temaId)
      if (actual.revision !== datos.revisionTema) {
        throw new ErrorTemas('CONFIRMACION_OBSOLETA', 'El tema cambió desde que lo viste')
      }
      const nombre = this.nombreValido(datos.nombre)
      this.exigirNombreLibre(c, nombre, actual.id)
      const tema: Tema = {
        ...actual,
        nombre,
        modificado: this.o.ahora(),
        revision: actual.revision + 1
      }
      await this.confirmarCatalogo({
        ...c,
        temas: c.temas.map((t) => (t.id === tema.id ? tema : t))
      })
      return hacerPublico(tema)
    })
  }

  /** Copia el estilo con id nuevo, sin usos ni asignaciones. */
  duplicar(datos: { temaId: string; nombre: string }): Promise<TemaPublico> {
    return this.enCola(async () => {
      const c = this.exigirEscritura()
      const origen = this.temaActivo(c, datos.temaId)
      const nombre = this.nombreValido(datos.nombre)
      this.exigirNombreLibre(c, nombre)
      const ahora = this.o.ahora()
      const tema: Tema = {
        id: this.o.nuevoId(),
        nombre,
        creado: ahora,
        modificado: ahora,
        revision: 1,
        estilo: structuredClone(origen.estilo)
      }
      await this.confirmarCatalogo({ ...c, temas: [...c.temas, tema] })
      return hacerPublico(tema)
    })
  }

  /** Deja `apartado` en `null` de forma persistente (aviso único de Ajustes). */
  descartarAvisoApartado(): Promise<void> {
    return this.enCola(async () => {
      const c = this.exigirEscritura()
      if (c.apartado === null) return
      await this.confirmarCatalogo({ ...c, apartado: null })
    })
  }

  // ---------------------------------------------------------------- operaciones con impacto

  /** Calcula el impacto de una operación sin escribir y guarda su ficha (un solo uso, 10 min). */
  previsualizar(op: OperacionTema): Promise<ImpactoIpc> {
    return this.enCola(() => {
      const c = this.exigirEscritura()
      this.validarOperacion(c, op)
      const impacto = this.impacto(c, op)
      const ficha = this.fichas.crear(op, impacto)
      if (op.tipo === 'editar' && op.revisionTema !== impacto.revisionTema) {
        throw new ErrorTemas('CONFIRMACION_OBSOLETA', 'El tema cambió desde que lo viste', {
          ficha,
          ...impacto
        })
      }
      return { ficha, ...impacto }
    })
  }

  /**
   * Ejecuta la operación previsualizada. Recalcula el impacto dentro de la cola: si difiere de lo
   * confirmado responde `CONFIRMACION_OBSOLETA` (con el impacto nuevo) sin escribir. `aplicar`
   * compara por canción. `borrar` escribe el diario y congela (0167).
   */
  ejecutar(op: OperacionTema, ficha: string): Promise<ResultadoTemas> {
    return this.enCola(async () => {
      const c = this.exigirEscritura()
      const guardada = this.fichas.tomar(ficha)
      if (!guardada) {
        this.validarOperacion(c, op)
        throw this.obsoleta(c, op)
      }
      if (operacionCanonica(op) !== operacionCanonica(guardada.op)) {
        throw new ErrorDatosInvalidos('La operación no es la que se previsualizó')
      }
      this.validarOperacion(c, op)
      const ahora = this.impacto(c, op)
      const revisionCambiada = op.tipo === 'editar' && op.revisionTema !== ahora.revisionTema
      if (revisionCambiada || (op.tipo !== 'aplicar' && !mismoImpacto(guardada.impacto, ahora))) {
        throw this.obsoleta(c, op)
      }
      const ctx = this.contexto()
      switch (op.tipo) {
        case 'editar':
          return ejecutarEditar(ctx, op)
        case 'asignarGrupo':
          return ejecutarGrupo(ctx, op)
        case 'aplicar':
          return ejecutarAplicar(ctx, ficha, op, guardada.impacto)
        case 'predeterminado':
          return op.temaId === null
            ? ejecutarQuitarPredeterminado(ctx, ficha, ahora.afectadas)
            : ejecutarPredeterminadoATema(ctx, op.temaId)
        case 'borrar':
          await iniciarBorrado(ctx, op.temaId, ahora)
          return continuarBorrado(ctx, op.temaId, ficha)
      }
    })
  }

  /** Repite la congelación del tema en borrado pendiente y lo retira (idempotente). */
  reanudarBorrado(): Promise<ResultadoTemas> {
    return this.enCola(() => {
      const c = this.exigirEscritura()
      if (c.borrado_pendiente === null) {
        throw new ErrorTemas('TEMA_NO_ENCONTRADO', 'No hay ningún borrado pendiente')
      }
      return continuarBorrado(this.contexto(), c.borrado_pendiente.tema_id, null)
    })
  }

  /** Quita el diario: el tema vuelve a ofrecerse y las canciones ya convertidas siguen como propias. */
  cancelarBorrado(): Promise<void> {
    return this.enCola(async () => {
      this.exigirEscritura()
      await cancelarDiario(this.contexto())
    })
  }

  private contexto(): ContextoOperaciones {
    return {
      catalogo: () => this.exigirEscritura(),
      puerto: this.o.puerto,
      ahora: this.o.ahora,
      reloj: this.o.reloj,
      confirmarCatalogo: (nuevo) => this.confirmarCatalogo(nuevo),
      emitirProgreso: (p) => {
        try {
          this.o.alProgreso?.(p)
        } catch (e) {
          this.o.registro.escribir('error', MODULO, `oyente de progreso falló: ${String(e)}`)
        }
      },
      indiceCambiado: () => this.notificarIndiceCambiado(),
      registro: this.o.registro
    }
  }

  private impacto(c: Catalogo, op: OperacionTema): ImpactoCalculado {
    return calcularImpacto(op, c, this.o.puerto.indice())
  }

  private obsoleta(c: Catalogo, op: OperacionTema): ErrorTemas {
    const impacto = this.impacto(c, op)
    const ficha = this.fichas.crear(op, impacto)
    return new ErrorTemas(
      'CONFIRMACION_OBSOLETA',
      'La operación ya no coincide con lo confirmado',
      {
        ficha,
        ...impacto
      }
    )
  }

  /** El tema existe y no está en borrado; solo hay un borrado a la vez. */
  private validarOperacion(c: Catalogo, op: OperacionTema): void {
    const pendiente = c.borrado_pendiente?.tema_id
    switch (op.tipo) {
      case 'editar':
        this.temaActivo(c, op.temaId)
        return
      case 'borrar':
        this.temaActivo(c, op.temaId)
        if (pendiente) throw new ErrorTemas('BORRADO_PENDIENTE', 'Hay otro borrado pendiente')
        return
      case 'aplicar':
        if (op.seleccion.modo === 'tema') this.temaActivo(c, op.seleccion.temaId)
        return
      case 'asignarGrupo':
        if (
          claveTexto(op.artista) === null ||
          (op.nivel === 'album' && claveTexto(op.album) === null)
        ) {
          throw new ErrorTemas(
            'ARGUMENTOS_NO_VALIDOS',
            'El artista y el álbum no pueden estar vacíos'
          )
        }
        if (op.temaId !== null) this.temaActivo(c, op.temaId)
        return
      case 'predeterminado':
        if (op.temaId !== null) this.temaActivo(c, op.temaId)
        else if (pendiente !== undefined && c.predeterminado === pendiente) {
          throw new ErrorTemas(
            'BORRADO_PENDIENTE',
            'El tema predeterminado está pendiente de borrarse'
          )
        }
        return
    }
  }

  // ---------------------------------------------------------------- auxiliares

  private nombreValido(nombre: string): string {
    const r = nombreTemaSchema.safeParse(nombre)
    if (!r.success) {
      throw new ErrorTemas(
        'ARGUMENTOS_NO_VALIDOS',
        'El nombre del tema debe tener de 1 a 60 caracteres'
      )
    }
    return r.data
  }

  private exigirNombreLibre(c: Catalogo, nombre: string, salvoId?: string): void {
    const clave = claveNombreTema(nombre)
    if (c.temas.some((t) => t.id !== salvoId && claveNombreTema(t.nombre) === clave)) {
      throw new ErrorTemas('TEMA_NOMBRE_DUPLICADO', 'Ya existe un tema con ese nombre')
    }
  }

  /** Tema existente y que no está en borrado. */
  private temaActivo(c: Catalogo, id: string): Tema {
    const tema = c.temas.find((t) => t.id === id)
    if (!tema) throw new ErrorTemas('TEMA_NO_ENCONTRADO', 'El tema no existe')
    if (c.borrado_pendiente?.tema_id === id) {
      throw new ErrorTemas('BORRADO_PENDIENTE', 'El tema está pendiente de borrarse')
    }
    return tema
  }
}
