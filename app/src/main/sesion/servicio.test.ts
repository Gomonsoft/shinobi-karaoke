import { describe, expect, it, vi } from 'vitest'
import { CANALES } from '../../shared/canales'
import type { Cancion } from '../../shared/cancion'
import { configPredeterminada, type Config } from '../../shared/config'
import { estiloPredeterminado } from '../../shared/estilo'
import { lista as cancionLista, borradorRecienCreado } from '../../shared/__fixtures__'
import {
  comandoSecundariaIpcSchema,
  estadoSecundariaIpcSchema,
  estadoSesionIpcSchema,
  type ComandoSecundariaIpc,
  EstadoSecundariaIpc,
  EstadoSesionIpc,
  InformeSecundariaIpc,
  ListaPantallasIpc
} from '../../shared/sesion'
import type { EventoCancion, ResumenCancion } from '../biblioteca'
import { ErrorSesion, ServicioSesion } from './servicio'
import type { ManejadorSecundaria } from './ventanaSecundaria'

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const PANTALLAS: ListaPantallasIpc = {
  colocacion: 'libre',
  pantallas: [
    {
      id: 1,
      etiqueta: 'Principal',
      ancho: 1920,
      alto: 1080,
      escala: 1,
      principal: true,
      conVentanaPrincipal: true
    },
    {
      id: 2,
      etiqueta: 'Escenario',
      ancho: 1920,
      alto: 1080,
      escala: 1,
      principal: false,
      conVentanaPrincipal: false
    }
  ]
}

function resumenDe(c: Cancion, extra: Partial<ResumenCancion> = {}): ResumenCancion {
  return {
    id: c.id,
    titulo: c.metadatos.titulo,
    artista: c.metadatos.artista,
    duracionMs: c.metadatos.duracion_ms,
    estado: c.estado,
    danada: false,
    motivo: null,
    ...extra
  } as ResumenCancion
}

class Diferida {
  promesa: Promise<void>
  resolver!: () => void
  constructor() {
    this.promesa = new Promise<void>((r) => (this.resolver = r))
  }
}

/** Banco: biblioteca, ventana, reloj, temporizadores y eventos enviados, todo simulado. */
class Banco {
  ahora = 1000
  nuevoIdN = 0
  canciones = new Map<string, Cancion>()
  resumenes = new Map<string, ResumenCancion>()
  oyentesBiblioteca: ((e: EventoCancion) => void)[] = []
  retrasoPistas: Diferida | null = null
  enviados: { rol: string; canal: string; carga: unknown }[] = []
  temporizadores: { ms: number; cb: () => void; activo: boolean }[] = []
  config: Config = configPredeterminada()
  actualizaciones: unknown[] = []
  silenciada = false
  silencios: boolean[] = []
  reposo: string[] = []
  visitasLiberadas = 0
  ventanasCreadas = 0
  cierres: string[] = []
  oyentesVentana: Record<string, ((...a: unknown[]) => void)[]> = {}
  webContents = { id: 'wc-secundaria' }
  pantallaCompleta = false
  servicio: ServicioSesion

  constructor(opciones: { pantallas?: ListaPantallasIpc } = {}) {
    const pantallas = opciones.pantallas ?? PANTALLAS
    this.servicio = new ServicioSesion({
      biblioteca: {
        obtener: (id) => structuredClone(this.canciones.get(id) ?? null),
        obtenerResumen: (id) => this.resumenes.get(id) ?? null,
        estiloDe: () => estiloPredeterminado(),
        comprobarPistas: async (id) => {
          await this.retrasoPistas?.promesa
          return this.resumenes.get(id) ?? null
        },
        suscribir: (cb) => {
          this.oyentesBiblioteca.push(cb)
          return () => undefined
        }
      },
      config: {
        obtener: () => this.config,
        actualizar: async (parcial) => {
          this.actualizaciones.push(parcial)
          return this.config
        }
      },
      abrirVentana: () => this.crearVentana(),
      pantallas: { listar: () => pantallas, observar: () => () => undefined },
      enviarA: (rol, canal, carga) => this.enviados.push({ rol, canal, carga }),
      principal: {
        estaSilenciada: () => this.silenciada,
        silenciar: (v) => {
          this.silencios.push(v)
          this.silenciada = v
        }
      },
      reposo: {
        retener: (t) => void this.reposo.push(`retener:${t}`),
        liberar: (t) => void this.reposo.push(`liberar:${t}`)
      },
      liberarVisitaLetra: () => void this.visitasLiberadas++,
      ahora: () => this.ahora,
      programar: (ms, cb) => {
        const t = { ms, cb, activo: true }
        this.temporizadores.push(t)
        return () => void (t.activo = false)
      },
      nuevoId: () => uuid(5000 + ++this.nuevoIdN)
    })
  }

  private emitirVentana(evento: string, ...args: unknown[]): void {
    for (const cb of this.oyentesVentana[evento] ?? []) cb(...args)
  }

  private crearVentana(): ManejadorSecundaria {
    this.ventanasCreadas++
    const en = (evento: string) => (cb: (...a: never[]) => void) =>
      void (this.oyentesVentana[evento] ??= []).push(cb as never)
    const cerrar = (): void => {
      this.cierres.push('cerrar')
      const evento = { preventDefault: vi.fn(), defaultPrevented: false }
      evento.preventDefault = vi.fn(() => void (evento.defaultPrevented = true))
      this.emitirVentana('close', evento)
      if (!evento.defaultPrevented) this.emitirVentana('closed')
    }
    return {
      ventana: {
        webContents: this.webContents,
        once: (evento: string, cb: () => void) => en(evento)(cb),
        on: (evento: string, cb: () => void) => en(evento)(cb)
      } as never,
      moverA: vi.fn(),
      fijarPantallaCompleta: vi.fn((activa: boolean) => {
        this.pantallaCompleta = activa
      }),
      estaEnPantallaCompleta: () => this.pantallaCompleta,
      mostrar: vi.fn(),
      cerrar,
      destruir: () => {
        this.cierres.push('destruir')
        this.emitirVentana('closed')
      },
      alCerrarSolicitado: en('close'),
      alCambiarPantallaCompleta: (cb: (a: boolean) => void) => {
        en('pantallaCompleta')(cb as never)
        return () => undefined
      },
      alCaer: en('caer'),
      alNoResponder: en('noResponde'),
      alResponder: en('responde'),
      alPantallaPerdida: en('perdida'),
      alPantallaReconectada: en('reconectada')
    } as unknown as ManejadorSecundaria
  }

  /** Añade una canción a la biblioteca (lista por defecto). */
  cancion(n: number, parcial: Partial<Cancion> = {}): string {
    const base = cancionLista()
    const c: Cancion = {
      ...base,
      id: `cancion-${n}`,
      metadatos: { ...base.metadatos, titulo: `Título ${n}`, artista: `Artista ${n}` },
      ...parcial
    }
    this.canciones.set(c.id, c)
    this.resumenes.set(c.id, resumenDe(c))
    return c.id
  }

  emitirBiblioteca(e: EventoCancion): void {
    for (const cb of this.oyentesBiblioteca) cb(e)
  }

  avanzar(ms: number): void {
    this.ahora += ms
    for (const t of this.temporizadores) {
      if (t.activo && t.ms <= ms) {
        t.activo = false
        t.cb()
      }
    }
  }

  get sec(): unknown {
    return this.webContents
  }

  comandos(): ComandoSecundariaIpc[] {
    return this.enviados
      .filter((e) => e.canal === CANALES.eventos.sesionComando)
      .map((e) => e.carga as ComandoSecundariaIpc)
  }

  ultimoComando(tipo?: string): ComandoSecundariaIpc | undefined {
    const todos = this.comandos().filter((c) => !tipo || c.tipo === tipo)
    return todos.at(-1)
  }

  estadosPrincipal(): EstadoSesionIpc[] {
    return this.enviados
      .filter((e) => e.canal === CANALES.eventos.sesionEstado)
      .map((e) => e.carga as EstadoSesionIpc)
  }

  estadosSecundaria(): EstadoSecundariaIpc[] {
    return this.enviados
      .filter((e) => e.canal === CANALES.eventos.sesionEstadoSecundaria)
      .map((e) => e.carga as EstadoSecundariaIpc)
  }

  principal(): EstadoSesionIpc {
    return this.servicio.estadoPrincipal()
  }

  /** Abre la sesión sobre la cola actual y deja la primera canción cargada y sonando. */
  async abrirYSonar(inicio: unknown = { tipo: 'cola' }): Promise<void> {
    await this.servicio.abrir({ pantallaId: 2, pantallaCompleta: true, inicio } as never)
    await this.servicio.inicial(this.webContents)
    await this.esperar()
    const cargar = this.ultimoComando('cargar')
    if (cargar?.tipo === 'cargar') await this.sonar(cargar.entrada.entradaId)
  }

  async sonar(entradaId: string): Promise<void> {
    await this.informar({ tipo: 'lista', sesionId: this.sesionId(), entradaId })
    await this.informar({ tipo: 'reproduciendo', sesionId: this.sesionId(), entradaId })
  }

  sesionId(): string {
    return this.principal().sesion!.sesionId
  }

  informar(informe: InformeSecundariaIpc, sender: unknown = this.webContents) {
    return this.servicio.informar(informe, sender)
  }

  async fin(entradaId: string, sender: unknown = this.webContents) {
    return this.informar({ tipo: 'fin', sesionId: this.sesionId(), entradaId }, sender)
  }

  async esperar(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await this.servicio.esperar()
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  entradaDe(cancionId: string): string {
    const e = this.principal()
    const todas = [e.activa, ...e.pendientes, e.contexto?.entrada]
    return todas.find((x) => x?.cancionId === cancionId)!.entradaId
  }
}

async function conCola(...ns: number[]): Promise<Banco> {
  const b = new Banco()
  for (const n of ns) {
    b.cancion(n)
    await b.servicio.agregar(`cancion-${n}`, 'final')
  }
  return b
}

describe('apertura y cierre', () => {
  it('abre la sesión: ventana, bloqueo, silencio, reposo, preferencia y primer cargar', async () => {
    const b = await conCola(1, 2)
    await b.servicio.abrir({
      pantallaId: 2,
      pantallaCompleta: true,
      inicio: { tipo: 'cola' }
    })
    expect(b.ventanasCreadas).toBe(1)
    expect(b.servicio.edicionBloqueada()).toBe(true)
    expect(b.silencios).toEqual([true])
    expect(b.reposo).toEqual(['retener:sesion'])
    expect(b.visitasLiberadas).toBe(1)
    expect(b.actualizaciones).toEqual([
      {
        reproductor: {
          secundaria: {
            pantalla: { id: 2, etiqueta: 'Escenario', ancho: 1920, alto: 1080 },
            pantalla_completa: true
          }
        }
      }
    ])
    expect(b.principal().sesion?.fase).toBe('abriendo')
    // El documento carga y pide el estado inicial: entonces se consume la primera y se revalida.
    const inicial = await b.servicio.inicial(b.webContents)
    expect(inicial.sesionId).toBe(b.sesionId())
    await b.esperar()
    const cargar = b.ultimoComando('cargar')
    expect(cargar).toMatchObject({
      tipo: 'cargar',
      sesionId: b.sesionId(),
      desdeMs: 0,
      anuncio: 'inicio',
      entrada: { cancionId: 'cancion-1', titulo: 'Título 1', silencioPrevio: true }
    })
    // El DTO cumple el esquema estricto: sin rutas ni campos internos.
    expect(comandoSecundariaIpcSchema.parse(cargar)).toEqual(cargar)
    expect(b.principal().sesion?.fase).toBe('cargando')
    expect(b.estadosPrincipal().at(-1)?.revision).toBe(b.principal().revision)
    // Todo lo que sale por la IPC cumple su esquema.
    for (const e of b.estadosPrincipal()) expect(estadoSesionIpcSchema.parse(e)).toEqual(e)
    for (const e of b.estadosSecundaria()) expect(estadoSecundariaIpcSchema.parse(e)).toEqual(e)
    for (const c of b.comandos()) expect(comandoSecundariaIpcSchema.parse(c)).toEqual(c)
  })

  it('una segunda apertura responde SESION_EN_CURSO sin crear otra ventana', async () => {
    const b = await conCola(1)
    await b.abrirYSonar()
    await expect(
      b.servicio.abrir({ pantallaId: 2, pantallaCompleta: false, inicio: { tipo: 'cola' } })
    ).rejects.toMatchObject({ codigo: 'SESION_EN_CURSO' })
    expect(b.ventanasCreadas).toBe(1)
  })

  it('una pantalla que ya no existe responde PANTALLA_NO_DISPONIBLE y no bloquea la edición', async () => {
    const b = await conCola(1)
    await expect(
      b.servicio.abrir({ pantallaId: 99, pantallaCompleta: false, inicio: { tipo: 'cola' } })
    ).rejects.toMatchObject({ codigo: 'PANTALLA_NO_DISPONIBLE' })
    expect(b.servicio.edicionBloqueada()).toBe(false)
    expect(b.ventanasCreadas).toBe(0)
  })

  it('si la ventana no se puede crear, la sesión se deshace y la edición se libera', async () => {
    const b = await conCola(1)
    ;(b as unknown as { crearVentana(): never }).crearVentana = () => {
      throw new ErrorSesion('PANTALLA_NO_DISPONIBLE')
    }
    await expect(
      b.servicio.abrir({ pantallaId: 2, pantallaCompleta: false, inicio: { tipo: 'cola' } })
    ).rejects.toMatchObject({ codigo: 'PANTALLA_NO_DISPONIBLE' })
    expect(b.servicio.edicionBloqueada()).toBe(false)
    expect(b.silencios).toEqual([true, false])
    expect(b.principal().sesion).toBeNull()
  })

  it('abrir con una canción la pone al frente y la carga; las pendientes siguen detrás', async () => {
    const b = await conCola(1)
    b.cancion(7)
    await b.abrirYSonar({ tipo: 'cancion', cancionId: 'cancion-7', donde: 'ahora' })
    const e = b.principal()
    expect(e.activa?.cancionId).toBe('cancion-7')
    expect(e.pendientes.map((p) => p.cancionId)).toEqual(['cancion-1'])
    expect(e.sesion?.fase).toBe('reproduciendo')
  })

  it('cerrar sin pendientes cierra la ventana sin preguntar y libera todo', async () => {
    const b = await conCola(1)
    await b.abrirYSonar()
    await b.servicio.solicitarCierre('principal')
    await b.esperar()
    expect(b.cierres).toContain('cerrar')
    expect(b.principal().sesion).toBeNull()
    expect(b.servicio.edicionBloqueada()).toBe(false)
    expect(b.silencios).toEqual([true, false])
    expect(b.reposo).toEqual(['retener:sesion', 'liberar:sesion'])
    // Sin pendientes, la cola se elimina al cerrar (spec 02).
    expect(b.principal().pendientes).toEqual([])
    expect(b.principal().contexto).toBeNull()
  })

  it('el cierre de la secundaria con pendientes pregunta y confirmar conserva la cola', async () => {
    const b = await conCola(1, 2, 3)
    await b.abrirYSonar()
    // El botón de cierre de la ventana se intercepta y se convierte en una solicitud.
    const evento = { preventDefault: vi.fn() }
    b.oyentesVentana.close!.forEach((cb) => cb(evento))
    expect(evento.preventDefault).toHaveBeenCalled()
    await b.esperar()
    expect(b.principal().sesion?.cierrePendiente).toEqual({ origen: 'secundaria' })
    expect(b.estadosSecundaria().at(-1)?.cierrePendiente).toEqual({ origen: 'secundaria' })
    const { revision } = b.principal()
    await b.servicio.confirmarCierre('conservar', revision)
    await b.esperar()
    expect(b.principal().sesion).toBeNull()
    expect(b.principal().pendientes.map((p) => p.cancionId)).toEqual(['cancion-2', 'cancion-3'])
    expect(b.principal().contexto).toMatchObject({ terminada: false, pausada: false })
    expect(b.servicio.edicionBloqueada()).toBe(false)
  })

  it('confirmar con una revisión vieja responde CONFIRMACION_OBSOLETA', async () => {
    const b = await conCola(1, 2)
    await b.abrirYSonar()
    await b.servicio.solicitarCierre('secundaria')
    await expect(b.servicio.confirmarCierre('eliminar', 0)).rejects.toMatchObject({
      codigo: 'CONFIRMACION_OBSOLETA'
    })
  })

  it('el bloqueo de edición dura también con el diálogo de cierre abierto, y se libera al cancelar y cerrar', async () => {
    const b = await conCola(1, 2)
    await b.abrirYSonar()
    await b.servicio.solicitarCierre('principal')
    expect(b.servicio.edicionBloqueada()).toBe(true)
    await b.servicio.cancelarCierre()
    expect(b.servicio.edicionBloqueada()).toBe(true)
    await b.servicio.forzarCierre()
    expect(b.servicio.edicionBloqueada()).toBe(false)
  })

  it('cae el renderer de la secundaria: la sesión termina, conserva la cola y suelta los bloqueos', async () => {
    const b = await conCola(1, 2)
    await b.abrirYSonar()
    await b.informar({
      tipo: 'posicion',
      sesionId: b.sesionId(),
      entradaId: b.entradaDe('cancion-1'),
      posicionMs: 12_000
    })
    b.oyentesVentana.caer!.forEach((cb) => cb('crashed'))
    await b.esperar()
    expect(b.cierres).toContain('destruir')
    const e = b.principal()
    expect(e.sesion).toBeNull()
    expect(e.incidencia).toEqual({ tipo: 'secundaria_caida' })
    expect(e.pendientes.map((p) => p.cancionId)).toEqual(['cancion-2'])
    expect(e.contexto).toMatchObject({ posicionMs: expect.any(Number), terminada: false })
    expect(b.servicio.edicionBloqueada()).toBe(false)
    expect(b.silencios.at(-1)).toBe(false)
    expect(b.reposo.at(-1)).toBe('liberar:sesion')
  })

  it('se restaura el valor previo del silencio de la principal', async () => {
    const b = await conCola(1)
    b.silenciada = true
    await b.abrirYSonar()
    await b.servicio.forzarCierre()
    expect(b.silencios).toEqual([true, true])
    expect(b.silenciada).toBe(true)
  })

  it('«no responde» y forzar el cierre conservan la cola', async () => {
    const b = await conCola(1, 2)
    await b.abrirYSonar()
    b.oyentesVentana.noResponde!.forEach((cb) => cb())
    await b.esperar()
    expect(b.principal().sesion?.incidencia).toEqual({ tipo: 'secundaria_no_responde' })
    await b.servicio.forzarCierre()
    expect(b.principal().sesion).toBeNull()
    expect(b.principal().pendientes).toHaveLength(1)
  })

  it('prepararSalida cierra la secundaria sin diálogo y deja de contar sesión y cola', async () => {
    const b = await conCola(1, 2)
    await b.abrirYSonar()
    expect(b.servicio.sesionActiva()).toBe(true)
    expect(b.servicio.colaNoVacia()).toBe(true)
    await b.servicio.prepararSalida()
    expect(b.servicio.sesionActiva()).toBe(false)
    expect(b.servicio.colaNoVacia()).toBe(false)
    expect(b.servicio.edicionBloqueada()).toBe(false)
  })

  it('cerrarConservando (macOS) cierra la secundaria y conserva la cola', async () => {
    const b = await conCola(1, 2)
    await b.abrirYSonar()
    await b.servicio.cerrarConservando()
    expect(b.principal().sesion).toBeNull()
    expect(b.servicio.colaNoVacia()).toBe(true)
  })
})

describe('informes y avance', () => {
  it('un fin y otro fin repetido producen una sola cuenta', async () => {
    const b = await conCola(1, 2)
    await b.abrirYSonar()
    const id = b.entradaDe('cancion-1')
    expect(await b.fin(id)).toEqual({ aplicado: true })
    expect(await b.fin(id)).toEqual({ aplicado: false })
    const e = b.principal()
    expect(e.sesion?.fase).toBe('transicion')
    expect(b.temporizadores.filter((t) => t.activo)).toHaveLength(1)
    expect(
      b.comandos().filter((c) => c.tipo === 'transicion' && c.transicion !== null)
    ).toHaveLength(1)
    const transicion = b.ultimoComando('transicion')
    expect(transicion).toMatchObject({
      transicion: { candidata: { entradaId: b.entradaDe('cancion-2') }, restanteMs: 4000 }
    })
  })

  it('un informe de otra sesión o de un webContents ajeno no se aplica', async () => {
    const b = await conCola(1, 2)
    await b.abrirYSonar()
    const id = b.entradaDe('cancion-1')
    expect(await b.fin(id, { id: 'wc-viejo' })).toEqual({ aplicado: false })
    expect(await b.informar({ tipo: 'fin', sesionId: uuid(42), entradaId: id })).toEqual({
      aplicado: false
    })
    expect(b.principal().sesion?.fase).toBe('reproduciendo')
  })

  it('al vencer la cuenta se consume la candidata y se carga', async () => {
    const b = await conCola(1, 2)
    await b.abrirYSonar()
    await b.fin(b.entradaDe('cancion-1'))
    b.avanzar(4000)
    await b.esperar()
    expect(b.ultimoComando('cargar')).toMatchObject({
      entrada: { cancionId: 'cancion-2' },
      anuncio: 'inicio'
    })
    expect(b.principal().sesion?.fase).toBe('cargando')
  })

  it('un fin y dos «siguiente» intercalados con una revalidación lenta producen un solo avance', async () => {
    const b = await conCola(1, 2, 3)
    await b.abrirYSonar()
    const primera = b.entradaDe('cancion-1')
    // La revalidación de la siguiente será lenta.
    b.retrasoPistas = new Diferida()
    const fin = b.fin(primera)
    const s1 = b.servicio.siguiente(primera)
    const s2 = b.servicio.siguiente(primera)
    await Promise.all([fin, s1, s2])
    expect(b.principal().sesion?.fase).toBe('transicion')
    b.avanzar(4000)
    await b.esperar()
    expect(b.principal().sesion?.fase).toBe('cargando')
    b.retrasoPistas.resolver()
    await b.esperar()
    // Solo avanzó una vez: la activa es la 2 y la 3 sigue pendiente.
    const e = b.principal()
    expect(e.activa?.cancionId).toBe('cancion-2')
    expect(e.pendientes.map((p) => p.cancionId)).toEqual(['cancion-3'])
    expect(b.comandos().filter((c) => c.tipo === 'cargar')).toHaveLength(2)
  })

  it('«Empezar ya» consume la candidata al momento y «Siguiente» desde la activa empieza la cuenta', async () => {
    const b = await conCola(1, 2, 3)
    await b.abrirYSonar()
    await b.servicio.siguiente(b.entradaDe('cancion-1'))
    expect(b.principal().sesion?.fase).toBe('transicion')
    const candidata = b.estadosSecundaria().at(-1)!.candidata!
    expect(candidata.entradaId).toBe(b.entradaDe('cancion-2'))
    await b.servicio.empezar(candidata.entradaId)
    await b.esperar()
    expect(b.principal().activa?.cancionId).toBe('cancion-2')
    // El temporizador de la cuenta ya no entrega nada.
    b.avanzar(10_000)
    await b.esperar()
    expect(b.comandos().filter((c) => c.tipo === 'cargar')).toHaveLength(2)
  })

  it('un error del instrumental pasa a error con su id y título, y comprueba las pistas', async () => {
    const b = await conCola(1, 2)
    await b.abrirYSonar()
    const id = b.entradaDe('cancion-1')
    await b.informar({
      tipo: 'error',
      sesionId: b.sesionId(),
      entradaId: id,
      error: { motivo: 'no_encontrada', pista: 'instrumental' }
    })
    expect(b.principal().sesion?.fase).toBe('error')
    expect(b.ultimoComando('error')).toMatchObject({ entradaId: id, titulo: 'Título 1' })
    expect(b.estadosSecundaria().at(-1)?.activa).toMatchObject({ entradaId: id })
  })

  it('la posición sale como mucho una vez por segundo', async () => {
    const b = await conCola(1)
    await b.abrirYSonar()
    const posiciones = () =>
      b.enviados.filter((e) => e.canal === CANALES.eventos.sesionPosicion).length
    const antes = posiciones()
    const id = b.entradaDe('cancion-1')
    const informar = (posicionMs: number) =>
      b.informar({ tipo: 'posicion', sesionId: b.sesionId(), entradaId: id, posicionMs })
    await informar(1000)
    await informar(1500)
    await informar(1900)
    expect(posiciones() - antes).toBeLessThanOrEqual(1)
    b.ahora += 1000
    await informar(2900)
    expect(posiciones() - antes).toBeGreaterThanOrEqual(1)
    const ultima = b.enviados.filter((e) => e.canal === CANALES.eventos.sesionPosicion).at(-1)
    expect(ultima?.carga).toMatchObject({ entradaId: id, posicionMs: expect.any(Number) })
  })
})

describe('cola y biblioteca', () => {
  it('cola.mover durante una revalidación lenta se aplica después, sin perderse', async () => {
    const b = await conCola(1, 2, 3)
    b.retrasoPistas = new Diferida()
    await b.servicio.abrir({ pantallaId: 2, pantallaCompleta: false, inicio: { tipo: 'cola' } })
    await b.servicio.inicial(b.webContents)
    await b.esperar()
    // La primera está revalidándose (sin `cargar` todavía).
    expect(b.principal().sesion?.fase).toBe('cargando')
    expect(b.ultimoComando('cargar')).toBeUndefined()
    await b.servicio.mover(b.entradaDe('cancion-3'), b.entradaDe('cancion-2'))
    expect(b.principal().pendientes.map((p) => p.cancionId)).toEqual(['cancion-3', 'cancion-2'])
    b.retrasoPistas.resolver()
    await b.esperar()
    expect(b.ultimoComando('cargar')).toMatchObject({ entrada: { cancionId: 'cancion-1' } })
    expect(b.principal().pendientes.map((p) => p.cancionId)).toEqual(['cancion-3', 'cancion-2'])
  })

  it('una canción eliminada mientras espera desaparece de la cola', async () => {
    const b = await conCola(1, 2, 3)
    await b.abrirYSonar()
    b.emitirBiblioteca({ id: 'cancion-2', eliminada: true })
    await b.esperar()
    expect(b.principal().pendientes.map((p) => p.cancionId)).toEqual(['cancion-3'])
    // La activa no se quita aunque llegue el evento.
    b.emitirBiblioteca({ id: 'cancion-1', eliminada: true })
    await b.esperar()
    expect(b.principal().activa?.cancionId).toBe('cancion-1')
  })

  it('una canción que vuelve a borrador queda no_lista y, al consumirla, da error sin cargar', async () => {
    const b = await conCola(1, 2)
    await b.abrirYSonar()
    const c2 = b.canciones.get('cancion-2')!
    const borrador = { ...c2, estado: 'borrador' as const }
    b.canciones.set('cancion-2', borrador)
    const resumen = resumenDe(borrador)
    b.resumenes.set('cancion-2', resumen)
    b.emitirBiblioteca({ id: 'cancion-2', resumen })
    await b.esperar()
    expect(b.principal().pendientes[0]).toMatchObject({
      cancionId: 'cancion-2',
      disponibilidad: 'no_lista'
    })
    const cargas = b.comandos().filter((c) => c.tipo === 'cargar').length
    await b.servicio.siguiente(b.entradaDe('cancion-1'))
    // Ya se sabe no disponible: error sin cuenta ni `cargar`.
    expect(b.principal().sesion?.fase).toBe('error')
    expect(b.ultimoComando('error')).toMatchObject({ motivo: 'no_lista', titulo: 'Título 2' })
    expect(b.comandos().filter((c) => c.tipo === 'cargar')).toHaveLength(cargas)
  })

  it('al consumirla con la disponibilidad desactualizada, la revalidación da error sin cargar', async () => {
    const b = await conCola(1, 2)
    await b.abrirYSonar()
    // El borrador no llegó como evento: se descubre al consumir.
    b.canciones.set('cancion-2', { ...b.canciones.get('cancion-2')!, estado: 'borrador' })
    await b.servicio.siguiente(b.entradaDe('cancion-1'))
    b.avanzar(4000)
    await b.esperar()
    expect(b.principal().sesion?.fase).toBe('error')
    expect(b.ultimoComando('error')).toMatchObject({ motivo: 'no_lista' })
    expect(b.comandos().filter((c) => c.tipo === 'cargar')).toHaveLength(1)
  })

  it('el motivo es ilegible sin cancion.json y sin_pistas si falta el instrumental', async () => {
    const b = await conCola(1, 2, 3)
    await b.abrirYSonar()
    // `obtener` devuelve null pero el índice la conoce: dañada por JSON.
    b.canciones.delete('cancion-2')
    await b.servicio.siguiente(b.entradaDe('cancion-1'))
    b.avanzar(4000)
    await b.esperar()
    expect(b.ultimoComando('error')).toMatchObject({ motivo: 'ilegible' })

    const c = await conCola(1, 2)
    await c.abrirYSonar()
    c.resumenes.set(
      'cancion-2',
      resumenDe(c.canciones.get('cancion-2')!, {
        danada: true,
        motivo: 'pistas'
      })
    )
    await c.servicio.siguiente(c.entradaDe('cancion-1'))
    c.avanzar(4000)
    await c.esperar()
    expect(c.ultimoComando('error')).toMatchObject({ motivo: 'sin_pistas' })
  })

  it('un cambio de título actualiza la cola y agregar una borrador la marca no_lista', async () => {
    const b = await conCola(1, 2)
    b.emitirBiblioteca({
      id: 'cancion-2',
      resumen: resumenDe(b.canciones.get('cancion-2')!, { titulo: 'Nuevo', artista: 'Otro' })
    })
    await b.esperar()
    expect(b.principal().pendientes[1]).toMatchObject({ titulo: 'Nuevo', artista: 'Otro' })
    b.canciones.set('d', borradorRecienCreado())
    b.resumenes.set('d', resumenDe(borradorRecienCreado(), { id: 'd' }))
    const { entradaId } = await b.servicio.agregar('d', 'final')
    expect(b.principal().pendientes.find((p) => p.entradaId === entradaId)?.disponibilidad).toBe(
      'no_lista'
    )
  })

  it('agregar una canción desconocida responde CANCION_NO_DISPONIBLE', async () => {
    const b = await conCola(1)
    await expect(b.servicio.agregar('fantasma', 'final')).rejects.toMatchObject({
      codigo: 'CANCION_NO_DISPONIBLE'
    })
  })

  it('quitar devuelve la entrada que seguía y vaciar limpia la cola', async () => {
    const b = await conCola(1, 2, 3)
    const { antesDe, estado } = await b.servicio.quitar(b.entradaDe('cancion-2'))
    expect(antesDe).toBe(b.entradaDe('cancion-3'))
    expect(estado.pendientes).toHaveLength(2)
    expect((await b.servicio.vaciar(false)).pendientes).toEqual([])
  })
})

describe('el rol y la secundaria', () => {
  it('solo el webContents de la sesión vigente es la secundaria', async () => {
    const b = await conCola(1)
    expect(b.servicio.esSecundariaVigente(b.webContents)).toBe(false)
    await b.abrirYSonar()
    expect(b.servicio.esSecundariaVigente(b.webContents)).toBe(true)
    expect(b.servicio.esSecundariaVigente({ id: 'otro' })).toBe(false)
    await b.servicio.forzarCierre()
    expect(b.servicio.esSecundariaVigente(b.webContents)).toBe(false)
  })

  it('el estado de la secundaria sin sesión es SESION_NO_ACTIVA', async () => {
    const b = await conCola(1)
    expect(() => b.servicio.estadoDelRol('secundaria')).toThrow(ErrorSesion)
    expect(b.servicio.estadoDelRol('principal')).toMatchObject({ sesion: null })
  })

  it('la pantalla completa se refleja en el estado y se avisa a la secundaria', async () => {
    const b = await conCola(1)
    await b.abrirYSonar()
    b.oyentesVentana.pantallaCompleta!.forEach((cb) => cb(false))
    await b.esperar()
    expect(b.principal().sesion?.pantallaCompleta).toBe(false)
    expect(
      b.enviados.filter((e) => e.canal === CANALES.eventos.pantallaCompleta).at(-1)
    ).toMatchObject({ rol: 'secundaria', carga: false })
  })

  it('la pantalla perdida y la reconectada quedan como incidencias', async () => {
    const b = await conCola(1)
    await b.abrirYSonar()
    b.oyentesVentana.perdida!.forEach((cb) =>
      cb({ id: 2, etiqueta: 'Escenario', ancho: 1920, alto: 1080 })
    )
    await b.esperar()
    expect(b.principal().sesion?.incidencia).toEqual({
      tipo: 'pantalla_perdida',
      etiqueta: 'Escenario',
      estabaEnPantallaCompleta: true
    })
    expect(b.principal().sesion?.pantalla?.principal).toBe(true)
    b.oyentesVentana.reconectada!.forEach((cb) =>
      cb({ id: 2, etiqueta: 'Escenario', ancho: 1920, alto: 1080 })
    )
    await b.esperar()
    expect(b.principal().sesion?.incidencia).toEqual({
      tipo: 'pantalla_reconectada',
      etiqueta: 'Escenario',
      pantallaId: 2
    })
  })

  it('mover a otra pantalla limpia la incidencia; una pantalla inexistente falla', async () => {
    const b = await conCola(1)
    await b.abrirYSonar()
    await expect(b.servicio.moverAPantalla(99)).rejects.toMatchObject({
      codigo: 'PANTALLA_NO_DISPONIBLE'
    })
    const e = await b.servicio.moverAPantalla(1)
    expect(e.sesion?.pantalla?.id).toBe(1)
  })

  it('un comando sale a la secundaria con el sesionId y la revisión del estado', async () => {
    const b = await conCola(1)
    await b.abrirYSonar()
    await b.servicio.transporte('pausar', b.entradaDe('cancion-1'))
    expect(b.ultimoComando('pausar')).toMatchObject({
      sesionId: b.sesionId(),
      entradaId: b.entradaDe('cancion-1'),
      causa: 'principal'
    })
    // `sesion.inicial` devuelve el último comando que define la pantalla, no el transporte.
    const inicial = await b.servicio.inicial(b.webContents)
    expect(inicial.comandoActual?.tipo).toBe('cargar')
    expect(inicial.estado.sesionId).toBe(b.sesionId())
  })
})
