import { describe, expect, it } from 'vitest'
import type { InformeSecundariaIpc, PantallaIpc } from '../../shared/sesion'
import { MAXIMO_PENDIENTES } from '../../shared/sesion'
import {
  crearEstado,
  posicionActual,
  reducir,
  type Efecto,
  type EstadoMaquina,
  type Evento,
  type InicioApertura,
  type Resultado
} from './maquina'
import { aIpcPrincipal } from './proyeccion'

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const SESION = uuid(1)
const PANTALLA: PantallaIpc = {
  id: 2,
  etiqueta: 'Pantalla 2',
  ancho: 1920,
  alto: 1080,
  escala: 1,
  principal: false,
  conVentanaPrincipal: false
}

/** Reloj y entorno simulados alrededor del reducer. */
class Banco {
  ahora = 1000
  transicionS = 4
  contador = 1000
  estado: EstadoMaquina
  ultimo!: Resultado
  constructor() {
    this.estado = crearEstado({
      nuevoId: () => uuid(++this.contador),
      transicionS: () => this.transicionS
    })
  }

  enviar(evento: Evento): Resultado {
    this.ultimo = reducir(this.estado, evento, this.ahora)
    this.estado = this.ultimo.estado
    return this.ultimo
  }

  avanzar(ms: number): void {
    this.ahora += ms
  }

  get fase(): string | undefined {
    return this.estado.sesion?.fase
  }
  get pendientes(): string[] {
    return this.estado.cola.pendientes.map((p) => p.cancionId)
  }
  get activaId(): string {
    return this.estado.cola.activa!.entradaId
  }
  get transicionId(): string {
    return this.estado.sesion!.transicion!.transicionId
  }
  get principal(): ReturnType<typeof aIpcPrincipal> {
    return aIpcPrincipal(this.estado, this.ahora)
  }

  agregar(n: number, donde: 'siguiente' | 'final' = 'final'): string {
    return this.enviar({
      tipo: 'agregar',
      cancionId: `c${n}`,
      titulo: `T${n}`,
      artista: `A${n}`,
      donde
    }).entradaId!
  }
  entradaDe(n: number): string {
    return this.estado.cola.pendientes.find((p) => p.cancionId === `c${n}`)!.entradaId
  }

  /** abrir → aceptada → documento listo. */
  abrir(inicio: InicioApertura = { tipo: 'cola' }): Resultado {
    this.enviar({ tipo: 'abrir', sesionId: SESION, inicio })
    this.enviar({
      tipo: 'aceptadaApertura',
      sesionId: SESION,
      pantalla: PANTALLA,
      pantallaCompleta: true
    })
    return this.enviar({ tipo: 'documentoListo', sesionId: SESION })
  }
  /** La activa se revalida y empieza a sonar. */
  sonar(duracionMs = 200_000, primeraLineaMs?: number): void {
    this.enviar({
      tipo: 'revalidada',
      entradaId: this.activaId,
      resultado: 'ok',
      duracionMs,
      primeraLineaMs
    })
    this.informe({ tipo: 'reproduciendo', entradaId: this.activaId, posicionMs: 0 })
  }
  informe(
    parcial: Partial<InformeSecundariaIpc> & { tipo: InformeSecundariaIpc['tipo'] }
  ): Resultado {
    return this.enviar({
      tipo: 'informe',
      informe: { sesionId: SESION, entradaId: this.activaId, ...parcial } as InformeSecundariaIpc
    })
  }
  fin(entradaId = this.activaId): Resultado {
    return this.enviar({ tipo: 'informe', informe: { tipo: 'fin', sesionId: SESION, entradaId } })
  }
  /** Sesión abierta con las canciones indicadas y la primera sonando. */
  sesionSonando(...ns: number[]): void {
    for (const n of ns) this.agregar(n)
    this.abrir()
    this.sonar()
  }
  /** La primera suena y termina: la sesión queda en transición hacia la siguiente. */
  enTransicion(...ns: number[]): void {
    this.sesionSonando(...ns)
    this.fin()
  }
}

const tipos = (r: Resultado): string[] => r.efectos.map((e) => e.tipo)
const comandos = (r: Resultado): Efecto[] => r.efectos.filter((e) => e.tipo === 'comando')

describe('apertura', () => {
  it('abrir bloquea la edición; aceptar guarda la preferencia; el documento consume la primera', () => {
    const b = new Banco()
    b.agregar(1)
    b.agregar(2)
    const r1 = b.enviar({ tipo: 'abrir', sesionId: SESION, inicio: { tipo: 'cola' } })
    expect(b.fase).toBe('abriendo')
    expect(tipos(r1)).toEqual(['bloquearEdicion', 'difundir'])

    const r2 = b.enviar({
      tipo: 'aceptadaApertura',
      sesionId: SESION,
      pantalla: PANTALLA,
      pantallaCompleta: true
    })
    expect(r2.efectos).toContainEqual({
      tipo: 'guardarPreferenciaPantalla',
      pantalla: PANTALLA,
      pantallaCompleta: true
    })

    const r3 = b.enviar({ tipo: 'documentoListo', sesionId: SESION })
    expect(b.fase).toBe('cargando')
    expect(b.estado.cola.activa?.cancionId).toBe('c1')
    expect(b.pendientes).toEqual(['c2'])
    expect(r3.efectos).toContainEqual({
      tipo: 'revalidar',
      entradaId: b.activaId,
      cancionId: 'c1'
    })
  })

  it('con la cola vacía empieza en espera sin candidata', () => {
    const b = new Banco()
    b.abrir()
    expect(b.fase).toBe('espera')
    expect(b.estado.cola.activa).toBeNull()
  })

  it('sin pantalla conocida (Wayland) no guarda preferencia', () => {
    const b = new Banco()
    b.enviar({ tipo: 'abrir', sesionId: SESION, inicio: { tipo: 'cola' } })
    const r = b.enviar({
      tipo: 'aceptadaApertura',
      sesionId: SESION,
      pantalla: null,
      pantallaCompleta: false
    })
    expect(tipos(r)).not.toContain('guardarPreferenciaPantalla')
  })

  it('ignora eventos de apertura de otra sesión', () => {
    const b = new Banco()
    b.enviar({ tipo: 'abrir', sesionId: SESION, inicio: { tipo: 'cola' } })
    const antes = b.estado
    b.enviar({
      tipo: 'aceptadaApertura',
      sesionId: uuid(2),
      pantalla: PANTALLA,
      pantallaCompleta: true
    })
    b.enviar({ tipo: 'documentoListo', sesionId: uuid(2) })
    expect(b.estado).toBe(antes)
    // Un segundo documentoListo no vuelve a consumir.
    b.enviar({ tipo: 'documentoListo', sesionId: SESION })
    const despues = b.estado
    b.enviar({ tipo: 'documentoListo', sesionId: SESION })
    expect(b.estado).toBe(despues)
  })

  it('abrir con una sesión en curso responde SESION_EN_CURSO', () => {
    const b = new Banco()
    b.abrir()
    const antes = b.estado
    const r = b.enviar({ tipo: 'abrir', sesionId: uuid(5), inicio: { tipo: 'cola' } })
    expect(r.error).toBe('SESION_EN_CURSO')
    expect(b.estado).toBe(antes)
    expect(r.efectos).toEqual([])
  })

  it('abrir con una canción la pone delante y descarta la última reproducida interrumpida', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    b.informe({ tipo: 'posicion', posicionMs: 40_000 })
    b.enviar({ tipo: 'cerrada', causa: 'forzada' })
    expect(b.estado.cola.contexto?.terminada).toBe(false)

    b.abrir({ tipo: 'cancion', cancionId: 'c9', titulo: 'T9', artista: 'A9' })
    expect(b.estado.cola.activa?.cancionId).toBe('c9')
    expect(b.estado.cola.contexto).toBeNull()
    expect(b.pendientes).toEqual(['c2'])
  })

  it('abrir con una canción y la cola llena responde COLA_LLENA', () => {
    const b = new Banco()
    for (let i = 0; i < MAXIMO_PENDIENTES; i++) b.agregar(i)
    const r = b.enviar({
      tipo: 'abrir',
      sesionId: SESION,
      inicio: { tipo: 'cancion', cancionId: 'x', titulo: 'x', artista: 'x' }
    })
    expect(r.error).toBe('COLA_LLENA')
    expect(b.estado.sesion).toBeNull()
  })

  it('si la cola se llena durante la apertura, la sesión queda en espera', () => {
    const b = new Banco()
    b.enviar({
      tipo: 'abrir',
      sesionId: SESION,
      inicio: { tipo: 'cancion', cancionId: 'x', titulo: 'x', artista: 'x' }
    })
    for (let i = 0; i < MAXIMO_PENDIENTES; i++) b.agregar(i)
    b.enviar({ tipo: 'documentoListo', sesionId: SESION })
    expect(b.fase).toBe('espera')
  })

  it('con contexto terminado, abrir deja la espera con la primera pendiente', () => {
    const b = new Banco()
    b.enTransicion(1, 2)
    b.enviar({ tipo: 'cerrada', causa: 'forzada' })
    b.abrir({ tipo: 'reanudar' })
    expect(b.fase).toBe('espera')
    expect(b.estado.cola.activa).toBeNull()
    expect(b.pendientes).toEqual(['c2'])
  })

  it('abrir con la cola y un contexto interrumpido empieza por la primera pendiente', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    b.enviar({ tipo: 'cerrada', causa: 'forzada' })
    b.abrir({ tipo: 'cola' })
    expect(b.estado.cola.activa?.cancionId).toBe('c2')
  })

  it('reanudar sin contexto equivale a abrir con la cola', () => {
    const b = new Banco()
    b.agregar(1)
    b.abrir({ tipo: 'reanudar' })
    expect(b.estado.cola.activa?.cancionId).toBe('c1')
  })
})

describe('informes, duplicados y tardíos', () => {
  it('lista y reproduciendo llevan de cargando a reproduciendo; la posición no sube la revisión', () => {
    const b = new Banco()
    b.agregar(1)
    b.abrir()
    expect(b.fase).toBe('cargando')
    expect(b.informe({ tipo: 'lista' }).aplicado).toBe(true)
    b.enviar({ tipo: 'revalidada', entradaId: b.activaId, resultado: 'ok', duracionMs: 200_000 })
    b.informe({ tipo: 'reproduciendo', posicionMs: 0 })
    expect(b.fase).toBe('reproduciendo')
    const revision = b.estado.revision
    const r = b.informe({ tipo: 'posicion', posicionMs: 12_000 })
    expect(r.aplicado).toBe(true)
    expect(r.efectos).toEqual([])
    expect(b.estado.revision).toBe(revision)
    expect(posicionActual(b.estado.sesion!, b.ahora)).toBe(12_000)
    // Repetir la misma fase tampoco es observable.
    b.informe({ tipo: 'reproduciendo', posicionMs: 13_000 })
    expect(b.estado.revision).toBe(revision)
    b.informe({ tipo: 'pausada', posicionMs: 14_000 })
    expect(b.fase).toBe('pausada')
    expect(b.estado.revision).toBe(revision + 1)
  })

  it('pausada y reproduciendo sin posición conservan la extrapolada', () => {
    const b = new Banco()
    b.sesionSonando(1)
    b.informe({ tipo: 'posicion', posicionMs: 10_000 })
    b.avanzar(2000)
    b.informe({ tipo: 'pausada' })
    expect(posicionActual(b.estado.sesion!, b.ahora)).toBe(12_000)
    b.avanzar(5000)
    expect(posicionActual(b.estado.sesion!, b.ahora)).toBe(12_000)
    b.informe({ tipo: 'reproduciendo' })
    b.avanzar(1000)
    expect(posicionActual(b.estado.sesion!, b.ahora)).toBe(13_000)
  })

  it('dos fin de la misma entrada producen una sola cuenta', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    const entrada = b.activaId
    const primero = b.fin(entrada)
    const id = b.transicionId
    expect(primero.aplicado).toBe(true)
    expect(primero.efectos.filter((e) => e.tipo === 'programar')).toHaveLength(1)
    const segundo = b.fin(entrada)
    expect(segundo.aplicado).toBe(false)
    expect(segundo.efectos).toEqual([])
    expect(b.transicionId).toBe(id)
  })

  it('un fin de la entrada anterior tras consumir la siguiente no hace nada', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    const anterior = b.activaId
    b.fin()
    b.avanzar(4000)
    b.enviar({ tipo: 'vencida', transicionId: b.transicionId })
    expect(b.estado.cola.activa?.cancionId).toBe('c2')
    const antes = b.estado
    const r = b.fin(anterior)
    expect(r.aplicado).toBe(false)
    expect(b.estado).toBe(antes)
  })

  it('un vencida con transicionId obsoleto no consume', () => {
    const b = new Banco()
    b.enTransicion(1, 2, 3)
    const vieja = b.transicionId
    b.enviar({ tipo: 'mover', entradaId: b.entradaDe(3), antesDe: b.entradaDe(2) })
    expect(b.transicionId).not.toBe(vieja)
    const antes = b.estado
    const r = b.enviar({ tipo: 'vencida', transicionId: vieja })
    expect(b.estado).toBe(antes)
    expect(r.efectos).toEqual([])
    expect(b.fase).toBe('transicion')
    // Y sin transición alguna tampoco.
    const c = new Banco()
    c.sesionSonando(1)
    c.enviar({ tipo: 'vencida', transicionId: uuid(7) })
    expect(c.fase).toBe('reproduciendo')
  })

  it('un informe de otra sesión o de otra entrada se ignora', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    const antes = b.estado
    const ajeno = b.enviar({
      tipo: 'informe',
      informe: { tipo: 'fin', sesionId: uuid(77), entradaId: b.activaId }
    })
    const otraEntrada = b.fin(uuid(78))
    expect(ajeno.aplicado).toBe(false)
    expect(otraEntrada.aplicado).toBe(false)
    expect(b.estado).toBe(antes)
    // Sin sesión.
    const c = new Banco()
    const r = c.enviar({
      tipo: 'informe',
      informe: { tipo: 'lista', sesionId: SESION, entradaId: uuid(3) }
    })
    expect(r.aplicado).toBe(false)
  })

  it('los informes fuera de las fases en curso no se aplican', () => {
    const b = new Banco()
    b.enTransicion(1, 2)
    // La activa ya no existe: todo informe sobre ella es tardío.
    for (const tipo of ['lista', 'reproduciendo', 'pausada'] as const) {
      const informe = { tipo, sesionId: SESION, entradaId: uuid(9) } as InformeSecundariaIpc
      expect(b.enviar({ tipo: 'informe', informe }).aplicado).toBe(false)
    }
  })

  it('informes de una activa fallida o en espera no se aplican', () => {
    const b = new Banco()
    b.agregar(1)
    b.abrir()
    b.enviar({ tipo: 'revalidada', entradaId: b.activaId, resultado: 'sin_pistas' })
    expect(b.fase).toBe('error')
    expect(b.informe({ tipo: 'lista' }).aplicado).toBe(false)
    expect(b.informe({ tipo: 'reproduciendo' }).aplicado).toBe(false)
    expect(b.informe({ tipo: 'posicion', posicionMs: 1 }).aplicado).toBe(false)
    expect(
      b.informe({ tipo: 'error', error: { motivo: 'lectura', pista: 'instrumental' } }).aplicado
    ).toBe(false)
    expect(b.fin().aplicado).toBe(false)
  })

  it('fin durante la carga se ignora', () => {
    const b = new Banco()
    b.agregar(1)
    b.abrir()
    expect(b.fin().aplicado).toBe(false)
    expect(b.fase).toBe('cargando')
  })

  it('un error del instrumental pasa a error sin avanzar; el de la voz se ignora', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    const voz = b.informe({ tipo: 'error', error: { motivo: 'lectura', pista: 'voz' } })
    expect(voz.aplicado).toBe(true)
    expect(b.fase).toBe('reproduciendo')
    const r = b.informe({
      tipo: 'error',
      error: { motivo: 'decodificacion', pista: 'instrumental' }
    })
    expect(r.aplicado).toBe(true)
    expect(b.fase).toBe('error')
    expect(b.estado.sesion?.error).toEqual({
      entradaId: b.activaId,
      motivo: 'decodificacion',
      codigo: 'decodificacion:instrumental'
    })
    expect(comandos(r)).toEqual([
      {
        tipo: 'comando',
        comando: { tipo: 'error', motivo: 'decodificacion', entradaId: b.activaId, titulo: 'T1' }
      }
    ])
    expect(b.pendientes).toEqual(['c2'])
    expect(b.estado.cola.activa?.cancionId).toBe('c1')
  })
})

describe('fin natural y cuenta', () => {
  it('el fin pasa la activa a contexto terminado y empieza la cuenta con la duración configurada', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    const entrada = b.activaId
    const r = b.fin()
    expect(b.fase).toBe('transicion')
    expect(b.estado.cola.activa).toBeNull()
    expect(b.estado.cola.contexto).toMatchObject({ terminada: true, posicionMs: null })
    expect(b.estado.cola.contexto?.entrada.entradaId).toBe(entrada)
    expect(r.efectos).toContainEqual({ tipo: 'programar', transicionId: b.transicionId, ms: 4000 })
    expect(comandos(r)).toEqual([
      {
        tipo: 'comando',
        comando: {
          tipo: 'transicion',
          transicion: {
            candidata: { entradaId: b.entradaDe(2), titulo: 'T2', artista: 'A2' },
            restanteMs: 4000,
            duracionMs: 4000
          }
        }
      }
    ])
    expect(b.principal.sesion?.transicion).toMatchObject({
      candidataId: b.entradaDe(2),
      restanteMs: 4000,
      congelada: false
    })
  })

  it('vencer la cuenta consume la candidata y la revalida', () => {
    const b = new Banco()
    b.enTransicion(1, 2)
    b.avanzar(4000)
    expect(b.principal.sesion?.transicion?.restanteMs).toBe(0)
    const r = b.enviar({ tipo: 'vencida', transicionId: b.transicionId })
    expect(b.fase).toBe('cargando')
    expect(b.estado.cola.activa?.cancionId).toBe('c2')
    expect(r.efectos).toContainEqual({ tipo: 'revalidar', entradaId: b.activaId, cancionId: 'c2' })
    expect(b.estado.sesion?.transicion).toBeNull()
  })

  it('al llegar la revalidación se emite cargar; si el motivo falla, error sin avanzar', () => {
    const b = new Banco()
    b.agregar(1)
    b.abrir()
    const r = b.enviar({
      tipo: 'revalidada',
      entradaId: b.activaId,
      resultado: 'ok',
      duracionMs: 90_000
    })
    expect(comandos(r)).toEqual([
      {
        tipo: 'comando',
        comando: {
          tipo: 'cargar',
          entradaId: b.activaId,
          cancionId: 'c1',
          desdeMs: 0,
          pausada: false,
          anuncio: 'inicio'
        }
      }
    ])
    // Una revalidación de otra entrada o repetida no hace nada.
    const antes = b.estado
    b.enviar({ tipo: 'revalidada', entradaId: uuid(9), resultado: 'sin_pistas' })
    expect(b.estado).toBe(antes)
  })

  it.each(['no_encontrada', 'no_lista', 'sin_pistas', 'ilegible'] as const)(
    'revalidación fallida (%s) deja la activa fallida sin sonar',
    (motivo) => {
      const b = new Banco()
      b.agregar(1)
      b.agregar(2)
      b.abrir()
      const r = b.enviar({ tipo: 'revalidada', entradaId: b.activaId, resultado: motivo })
      expect(b.fase).toBe('error')
      expect(b.estado.sesion?.error?.motivo).toBe(motivo)
      expect(b.estado.cola.activa?.cancionId).toBe('c1')
      expect(comandos(r)).toEqual([
        {
          tipo: 'comando',
          comando: { tipo: 'error', motivo, entradaId: b.activaId, titulo: 'T1' }
        }
      ])
      // No avanza sola.
      b.avanzar(60_000)
      expect(b.fase).toBe('error')
    }
  )

  it('con la candidata ya conocida como no disponible, el fin pasa a error sin cuenta', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    b.enviar({ tipo: 'disponibilidad', cancionId: 'c2', motivo: 'no_lista' })
    const r = b.fin()
    expect(b.fase).toBe('error')
    expect(b.estado.sesion?.error).toMatchObject({ entradaId: b.entradaDe(2), motivo: 'no_lista' })
    expect(tipos(r)).not.toContain('programar')
    expect(b.estado.cola.pendientes).toHaveLength(1)
  })

  it('«siguiente» desde la fallida pasa a la siguiente con cuenta; sin más no hace nada', () => {
    const b = new Banco()
    b.sesionSonando(1, 2, 3)
    b.enviar({ tipo: 'disponibilidad', cancionId: 'c2', motivo: 'no_lista' })
    b.fin()
    const fallida = b.entradaDe(2)
    const r = b.enviar({ tipo: 'siguiente', desdeEntradaId: fallida })
    expect(b.fase).toBe('transicion')
    expect(b.estado.sesion?.transicion?.candidataId).toBe(b.entradaDe(3))
    expect(b.pendientes).toEqual(['c3'])
    expect(r.efectos.filter((e) => e.tipo === 'programar')).toHaveLength(1)
    // Segunda vez con la misma referencia: nada.
    const antes = b.estado
    b.enviar({ tipo: 'siguiente', desdeEntradaId: fallida })
    expect(b.estado).toBe(antes)

    const c = new Banco()
    c.sesionSonando(1, 2)
    c.enviar({ tipo: 'disponibilidad', cancionId: 'c2', motivo: 'no_lista' })
    c.fin()
    const unica = c.estado.sesion!.error!.entradaId
    const antesC = c.estado
    c.enviar({ tipo: 'siguiente', desdeEntradaId: unica })
    expect(c.estado).toBe(antesC)
  })

  it('«siguiente» desde una activa fallida la descarta y cuenta hacia la siguiente', () => {
    const b = new Banco()
    b.agregar(1)
    b.agregar(2)
    b.abrir()
    const fallida = b.activaId
    b.enviar({ tipo: 'revalidada', entradaId: fallida, resultado: 'ilegible' })
    b.enviar({ tipo: 'siguiente', desdeEntradaId: fallida })
    expect(b.fase).toBe('transicion')
    expect(b.estado.cola.activa).toBeNull()
    expect(b.estado.sesion?.transicion?.candidataId).toBe(b.entradaDe(2))
    // Sin pendientes, no hace nada.
    const c = new Banco()
    c.agregar(1)
    c.abrir()
    c.enviar({ tipo: 'revalidada', entradaId: c.activaId, resultado: 'ilegible' })
    const antes = c.estado
    c.enviar({ tipo: 'siguiente', desdeEntradaId: c.activaId })
    expect(c.estado).toBe(antes)
  })

  it('sin pendientes, el fin pasa a fin_de_cola sin cuenta', () => {
    const b = new Banco()
    b.sesionSonando(1)
    const r = b.fin()
    expect(b.fase).toBe('fin_de_cola')
    expect(b.estado.sesion?.transicion).toBeNull()
    expect(comandos(r)).toEqual([{ tipo: 'comando', comando: { tipo: 'fin_de_cola' } }])
    expect(tipos(r)).not.toContain('programar')
  })

  it('añadir en fin_de_cola arranca la cuenta (0059-3B)', () => {
    const b = new Banco()
    b.sesionSonando(1)
    b.fin()
    const r = b.agregar(2)
    expect(r).toBeDefined()
    expect(b.fase).toBe('transicion')
    expect(b.estado.sesion?.transicion?.candidataId).toBe(b.entradaDe(2))
    expect(b.ultimo.efectos.filter((e) => e.tipo === 'programar')).toHaveLength(1)
    expect(b.estado.cola.contexto?.terminada).toBe(true)
  })

  it('añadir en fin_de_cola con candidata no disponible pasa a error', () => {
    const b = new Banco()
    b.sesionSonando(1)
    b.fin()
    b.agregar(2)
    // La candidata se vuelve no disponible durante la cuenta: se cancela y pasa a error.
    const id = b.transicionId
    const r = b.enviar({ tipo: 'disponibilidad', cancionId: 'c2', motivo: 'sin_pistas' })
    expect(b.fase).toBe('error')
    expect(r.efectos).toContainEqual({ tipo: 'cancelar', transicionId: id })
    expect(b.estado.sesion?.transicion).toBeNull()
  })

  it('quitar la única candidata durante la cuenta vuelve a fin_de_cola', () => {
    const b = new Banco()
    b.enTransicion(1, 2)
    const id = b.transicionId
    const r = b.enviar({ tipo: 'quitar', entradaId: b.entradaDe(2) })
    expect(b.fase).toBe('fin_de_cola')
    expect(r.efectos).toContainEqual({ tipo: 'cancelar', transicionId: id })
    expect(comandos(r)).toEqual([{ tipo: 'comando', comando: { tipo: 'fin_de_cola' } }])
    expect(r.antesDe).toBeNull()
  })

  it('en espera, añadir no arranca la cuenta', () => {
    const b = new Banco()
    b.abrir()
    expect(b.fase).toBe('espera')
    b.agregar(1)
    expect(b.fase).toBe('espera')
    expect(b.estado.sesion?.transicion).toBeNull()
    expect(tipos(b.ultimo)).toEqual(['difundir'])
    expect(b.principal.pendientes).toHaveLength(1)
  })

  it('«detener cuenta» pasa a espera con la candidata y «empezar» la consume sin cuenta', () => {
    const b = new Banco()
    b.enTransicion(1, 2)
    const id = b.transicionId
    const r = b.enviar({ tipo: 'detenerTransicion', transicionId: id })
    expect(b.fase).toBe('espera')
    expect(r.efectos).toContainEqual({ tipo: 'cancelar', transicionId: id })
    expect(comandos(r)).toEqual([
      { tipo: 'comando', comando: { tipo: 'transicion', transicion: null } }
    ])
    // Un vencida tardío ya no consume.
    b.enviar({ tipo: 'vencida', transicionId: id })
    expect(b.fase).toBe('espera')
    // Detener con otro id o ya detenida no hace nada.
    const antes = b.estado
    b.enviar({ tipo: 'detenerTransicion', transicionId: id })
    expect(b.estado).toBe(antes)

    const e = b.enviar({ tipo: 'empezar', candidataId: b.entradaDe(2) })
    expect(b.fase).toBe('cargando')
    expect(tipos(e)).not.toContain('programar')
    expect(b.estado.cola.activa?.cancionId).toBe('c2')
  })

  it('«empezar» durante la cuenta consume y cancela el temporizador', () => {
    const b = new Banco()
    b.enTransicion(1, 2)
    const id = b.transicionId
    const r = b.enviar({ tipo: 'empezar', candidataId: b.entradaDe(2) })
    expect(b.fase).toBe('cargando')
    expect(r.efectos).toContainEqual({ tipo: 'cancelar', transicionId: id })
  })

  it('«empezar» con una candidata obsoleta se ignora', () => {
    const b = new Banco()
    b.enTransicion(1, 2, 3)
    b.enviar({ tipo: 'mover', entradaId: b.entradaDe(3), antesDe: b.entradaDe(2) })
    const antes = b.estado
    const r = b.enviar({ tipo: 'empezar', candidataId: b.entradaDe(2) })
    expect(b.estado).toBe(antes)
    expect(r.efectos).toEqual([])
    // Tampoco sin sesión ni sonando.
    const c = new Banco()
    c.sesionSonando(1, 2)
    const a2 = c.estado
    c.enviar({ tipo: 'empezar', candidataId: c.entradaDe(2) })
    expect(c.estado).toBe(a2)
  })

  it('«siguiente» interrumpe la activa y empieza la cuenta, de forma idempotente', () => {
    const b = new Banco()
    b.sesionSonando(1, 2, 3)
    const desde = b.activaId
    const r1 = b.enviar({ tipo: 'siguiente', desdeEntradaId: desde })
    expect(b.fase).toBe('transicion')
    expect(b.estado.cola.contexto).toMatchObject({ terminada: true })
    expect(r1.efectos.filter((e) => e.tipo === 'programar')).toHaveLength(1)
    const id = b.transicionId
    // Dos ventanas a la vez: la segunda no produce otra cuenta.
    const antes = b.estado
    const r2 = b.enviar({ tipo: 'siguiente', desdeEntradaId: desde })
    expect(b.estado).toBe(antes)
    expect(r2.efectos).toEqual([])
    expect(b.transicionId).toBe(id)
  })

  it('«siguiente» sin pendientes no hace nada', () => {
    const b = new Banco()
    b.sesionSonando(1)
    const antes = b.estado
    b.enviar({ tipo: 'siguiente', desdeEntradaId: b.activaId })
    expect(b.estado).toBe(antes)
    // Y sin sesión tampoco.
    const c = new Banco()
    const a = c.estado
    c.enviar({ tipo: 'siguiente', desdeEntradaId: uuid(5) })
    expect(c.estado).toBe(a)
  })

  it('quitar la activa fallida (Descartar) sin pendientes pasa a espera sin candidata', () => {
    const b = new Banco()
    b.agregar(1)
    b.abrir()
    b.enviar({ tipo: 'revalidada', entradaId: b.activaId, resultado: 'no_encontrada' })
    const r = b.enviar({ tipo: 'quitar', entradaId: b.activaId })
    expect(r.error).toBeUndefined()
    expect(b.fase).toBe('espera')
    expect(b.estado.cola.activa).toBeNull()
    expect(b.estado.sesion?.error).toBeNull()
    expect(b.principal.pendientes).toEqual([])
  })

  it('quitar una pendiente fallida (candidata) pasa a espera y la activa que suena no se quita', () => {
    const b = new Banco()
    b.sesionSonando(1, 2, 3)
    const activa = b.activaId
    const sonando = b.enviar({ tipo: 'quitar', entradaId: activa })
    expect(sonando.error).toBe('ENTRADA_NO_ENCONTRADA')
    b.enviar({ tipo: 'disponibilidad', cancionId: 'c2', motivo: 'no_lista' })
    b.fin()
    expect(b.fase).toBe('error')
    b.enviar({ tipo: 'quitar', entradaId: b.entradaDe(2) })
    expect(b.fase).toBe('espera')
    expect(b.estado.sesion?.error).toBeNull()
    expect(b.pendientes).toEqual(['c3'])
  })

  it('si la fallida deja de ser la candidata, la sesión pasa a espera', () => {
    const b = new Banco()
    b.sesionSonando(1, 2, 3)
    b.enviar({ tipo: 'disponibilidad', cancionId: 'c2', motivo: 'no_lista' })
    b.fin()
    b.enviar({ tipo: 'mover', entradaId: b.entradaDe(3), antesDe: b.entradaDe(2) })
    expect(b.fase).toBe('espera')
  })

  it('deshacer un «Quitar» vuelve a su sitio con la misma revisión y al final con otra', () => {
    const b = new Banco()
    b.sesionSonando(1, 2, 3, 4)
    const q = b.enviar({ tipo: 'quitar', entradaId: b.entradaDe(3) })
    const revisionTrasQuitar = b.estado.revision
    expect(q.antesDe).toBe(b.entradaDe(4))
    b.enviar({
      tipo: 'agregar',
      cancionId: 'c3',
      titulo: 'T3',
      artista: 'A3',
      donde: { antesDe: q.antesDe!, siRevision: revisionTrasQuitar }
    })
    expect(b.pendientes).toEqual(['c2', 'c3', 'c4'])

    const q2 = b.enviar({ tipo: 'quitar', entradaId: b.entradaDe(2) })
    const vieja = b.estado.revision
    b.enviar({ tipo: 'quitar', entradaId: b.entradaDe(4) })
    b.enviar({
      tipo: 'agregar',
      cancionId: 'c2',
      titulo: 'T2',
      artista: 'A2',
      donde: { antesDe: q2.antesDe ?? null, siRevision: vieja }
    })
    expect(b.pendientes).toEqual(['c3', 'c2'])
  })
})

describe('cola durante la cuenta', () => {
  it('mover las posteriores conserva la fecha límite; mover otra al frente reinicia con la duración original', () => {
    const b = new Banco()
    b.enTransicion(1, 2, 3, 4)
    const id = b.transicionId
    const vence = b.estado.sesion!.transicion!.venceMs
    b.avanzar(1000)

    const r1 = b.enviar({ tipo: 'mover', entradaId: b.entradaDe(4), antesDe: b.entradaDe(3) })
    expect(b.transicionId).toBe(id)
    expect(b.estado.sesion!.transicion!.venceMs).toBe(vence)
    expect(tipos(r1)).toEqual(['difundir'])

    b.transicionS = 10 // un cambio de configuración no afecta a la cuenta en marcha
    const r2 = b.enviar({ tipo: 'mover', entradaId: b.entradaDe(3), antesDe: b.entradaDe(2) })
    expect(b.transicionId).not.toBe(id)
    expect(b.estado.sesion!.transicion).toMatchObject({
      candidataId: b.entradaDe(3),
      duracionMs: 4000,
      venceMs: b.ahora + 4000
    })
    expect(r2.efectos.slice(0, 3)).toMatchObject([
      { tipo: 'cancelar', transicionId: id },
      { tipo: 'programar', ms: 4000 },
      { tipo: 'comando', comando: { tipo: 'transicion' } }
    ])
  })

  it('transicion_s cambiada vale para la siguiente cuenta', () => {
    const b = new Banco()
    b.enTransicion(1, 2)
    b.transicionS = 7
    b.avanzar(4000)
    b.enviar({ tipo: 'vencida', transicionId: b.transicionId })
    b.sonar()
    b.fin()
    // La segunda canción termina sin pendientes: añadimos otra y comprobamos la duración nueva.
    b.agregar(3)
    expect(b.estado.sesion?.transicion?.duracionMs).toBe(7000)
  })

  it('un mover nulo no sube la revisión', () => {
    const b = new Banco()
    b.sesionSonando(1, 2, 3)
    const revision = b.estado.revision
    const r = b.enviar({ tipo: 'mover', entradaId: b.entradaDe(3), antesDe: null })
    expect(b.estado.revision).toBe(revision)
    expect(r.efectos).toEqual([])
    const v = b.enviar({ tipo: 'vaciar', contexto: false })
    expect(b.estado.revision).toBe(revision + 1)
    expect(tipos(v)).toEqual(['difundir'])
    b.enviar({ tipo: 'vaciar', contexto: false })
    expect(b.estado.revision).toBe(revision + 1)
  })

  it('las operaciones de cola no interrumpen la activa ni envían comandos', () => {
    const b = new Banco()
    b.sesionSonando(1, 2, 3)
    b.agregar(4, 'siguiente')
    b.enviar({ tipo: 'mover', entradaId: b.entradaDe(3), antesDe: b.entradaDe(4) })
    const r = b.enviar({ tipo: 'quitar', entradaId: b.entradaDe(2) })
    expect(comandos(r)).toEqual([])
    expect(b.fase).toBe('reproduciendo')
    expect(b.pendientes).toEqual(['c3', 'c4'])
  })

  it('vaciar durante la cuenta vuelve a fin_de_cola', () => {
    const b = new Banco()
    b.enTransicion(1, 2, 3)
    b.enviar({ tipo: 'vaciar', contexto: false })
    expect(b.fase).toBe('fin_de_cola')
  })

  it('errores de la cola: ENTRADA_NO_ENCONTRADA y COLA_LLENA no cambian el estado', () => {
    const b = new Banco()
    b.agregar(1)
    const antes = b.estado
    const r = b.enviar({ tipo: 'mover', entradaId: uuid(9), antesDe: null })
    expect(r.error).toBe('ENTRADA_NO_ENCONTRADA')
    expect(b.estado).toBe(antes)
    expect(b.enviar({ tipo: 'quitar', entradaId: uuid(9) }).error).toBe('ENTRADA_NO_ENCONTRADA')
    const c = new Banco()
    for (let i = 0; i < MAXIMO_PENDIENTES; i++) c.agregar(i)
    const llena = c.enviar({
      tipo: 'agregar',
      cancionId: 'x',
      titulo: 'x',
      artista: 'x',
      donde: 'final'
    })
    expect(llena.error).toBe('COLA_LLENA')
    expect(llena.efectos).toEqual([])
  })

  it('eliminar una canción pendiente quita sus entradas; la de la activa se rechaza', () => {
    const b = new Banco()
    b.sesionSonando(1, 2, 3, 2)
    const r = b.enviar({ tipo: 'cancionEliminada', cancionId: 'c2' })
    expect(r.error).toBeUndefined()
    expect(b.pendientes).toEqual(['c3'])
    const activa = b.enviar({ tipo: 'cancionEliminada', cancionId: 'c1' })
    expect(activa.error).toBe('CANCION_EN_REPRODUCCION')
    const borrador = b.enviar({ tipo: 'disponibilidad', cancionId: 'c1', motivo: 'no_lista' })
    expect(borrador.error).toBe('CANCION_EN_REPRODUCCION')
    expect(b.estado.cola.activa?.cancionId).toBe('c1')
    // Marcarla Lista otra vez no es un rechazo.
    expect(
      b.enviar({ tipo: 'disponibilidad', cancionId: 'c1', motivo: 'ok' }).error
    ).toBeUndefined()
  })

  it('los títulos vivos se actualizan', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    b.enviar({ tipo: 'titulos', cancionId: 'c2', titulo: 'Nuevo', artista: 'Otro' })
    expect(b.principal.pendientes[0]).toMatchObject({ titulo: 'Nuevo', artista: 'Otro' })
  })

  it('eliminar la candidata durante la cuenta cambia de candidata y reinicia', () => {
    const b = new Banco()
    b.enTransicion(1, 2, 3)
    const id = b.transicionId
    b.enviar({ tipo: 'cancionEliminada', cancionId: 'c2' })
    expect(b.transicionId).not.toBe(id)
    expect(b.estado.sesion?.transicion?.candidataId).toBe(b.entradaDe(3))
  })
})

describe('repetir y transporte', () => {
  it('«Otra vez» solo en fin_de_cola con el contexto terminado, como entrada nueva', () => {
    const b = new Banco()
    b.sesionSonando(1)
    const original = b.activaId
    b.fin()
    const r = b.enviar({ tipo: 'repetir', entradaId: original })
    expect(b.fase).toBe('cargando')
    expect(b.activaId).not.toBe(original)
    expect(b.estado.cola.activa?.cancionId).toBe('c1')
    expect(r.efectos).toContainEqual({ tipo: 'revalidar', entradaId: b.activaId, cancionId: 'c1' })
    // En otras fases, o con otro id, no actúa.
    const c = new Banco()
    c.enTransicion(1, 2)
    const antes = c.estado
    c.enviar({ tipo: 'repetir', entradaId: c.estado.cola.contexto!.entrada.entradaId })
    expect(c.estado).toBe(antes)
    const d = new Banco()
    d.sesionSonando(1)
    d.fin()
    const a2 = d.estado
    d.enviar({ tipo: 'repetir', entradaId: uuid(9) })
    expect(d.estado).toBe(a2)
  })

  it('el transporte se reenvía solo si la entrada es la activa', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    const id = b.activaId
    expect(comandos(b.enviar({ tipo: 'transporte', accion: 'pausar', entradaId: id }))).toEqual([
      { tipo: 'comando', comando: { tipo: 'pausar', entradaId: id, causa: 'principal' } }
    ])
    b.informe({ tipo: 'pausada', posicionMs: 5000 })
    expect(comandos(b.enviar({ tipo: 'transporte', accion: 'reanudar', entradaId: id }))).toEqual([
      { tipo: 'comando', comando: { tipo: 'reanudar', entradaId: id } }
    ])
    b.informe({ tipo: 'reproduciendo', posicionMs: 5000 })
    b.avanzar(3000)
    const rei = b.enviar({ tipo: 'transporte', accion: 'reiniciar', entradaId: id })
    expect(comandos(rei)).toEqual([
      { tipo: 'comando', comando: { tipo: 'reiniciar', entradaId: id } }
    ])
    expect(posicionActual(b.estado.sesion!, b.ahora)).toBe(0)
    expect(b.pendientes).toEqual(['c2'])

    const ajeno = b.enviar({ tipo: 'transporte', accion: 'pausar', entradaId: uuid(9) })
    expect(ajeno.efectos).toEqual([])
    // Sin sesión o en transición tampoco.
    const c = new Banco()
    c.enviar({ tipo: 'transporte', accion: 'pausar', entradaId: uuid(9) })
    const d = new Banco()
    d.enTransicion(1, 2)
    expect(d.enviar({ tipo: 'transporte', accion: 'pausar', entradaId: uuid(9) }).efectos).toEqual(
      []
    )
  })
})

describe('cierre', () => {
  it('sin pendientes se cierra sin preguntar y descarta activa y contexto', () => {
    const b = new Banco()
    b.sesionSonando(1)
    const r = b.enviar({ tipo: 'solicitarCierre', origen: 'secundaria' })
    expect(tipos(r)).toEqual(['cerrarVentana', 'difundir'])
    expect(b.estado.sesion?.cierrePendiente).toBeNull()
    const c = b.enviar({ tipo: 'cerrada', causa: 'confirmada' })
    expect(b.estado.sesion).toBeNull()
    expect(b.estado.cola).toEqual({ activa: null, pendientes: [], contexto: null })
    expect(c.efectos).toContainEqual({ tipo: 'liberarEdicion' })
    expect(b.estado.incidencia).toBeNull()
    // Pedirlo otra vez durante el cierre no hace nada.
    const d = b.enviar({ tipo: 'solicitarCierre', origen: 'principal' })
    expect(d.error).toBe('SESION_NO_ACTIVA')
  })

  it('un segundo solicitarCierre mantiene el origen; con cierre ya decidido no hace nada', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    b.enviar({ tipo: 'solicitarCierre', origen: 'secundaria' })
    const antes = b.estado
    b.enviar({ tipo: 'solicitarCierre', origen: 'principal' })
    expect(b.estado).toBe(antes)
    expect(b.estado.sesion?.cierrePendiente).toEqual({ origen: 'secundaria' })
  })

  it('con pendientes congela la cuenta: restanteMs no cambia en 5 s y cancelar sigue desde 2,4 s', () => {
    const b = new Banco()
    b.enTransicion(1, 2, 3, 4)
    const id = b.transicionId
    b.avanzar(1600)
    expect(b.principal.sesion?.transicion?.restanteMs).toBe(2400)
    const r = b.enviar({ tipo: 'solicitarCierre', origen: 'principal' })
    expect(r.efectos).toContainEqual({ tipo: 'cancelar', transicionId: id })
    expect(b.principal.sesion).toMatchObject({
      cierrePendiente: { origen: 'principal' },
      transicion: { restanteMs: 2400, congelada: true }
    })
    b.avanzar(5000)
    expect(b.principal.sesion?.transicion?.restanteMs).toBe(2400)
    // Un vencida que llegara igualmente no consume.
    b.enviar({ tipo: 'vencida', transicionId: id })
    expect(b.fase).toBe('transicion')

    const c = b.enviar({ tipo: 'cancelarCierre' })
    expect(c.efectos).toContainEqual({ tipo: 'programar', transicionId: id, ms: 2400 })
    expect(b.principal.sesion?.cierrePendiente).toBeNull()
    expect(b.principal.sesion?.transicion).toMatchObject({ restanteMs: 2400, congelada: false })
    b.avanzar(2400)
    expect(b.principal.sesion?.transicion?.restanteMs).toBe(0)
    b.enviar({ tipo: 'vencida', transicionId: id })
    expect(b.estado.cola.activa?.cancionId).toBe('c2')
  })

  it('confirmar con una revisión vieja responde CONFIRMACION_OBSOLETA', () => {
    const b = new Banco()
    b.enTransicion(1, 2, 3)
    b.enviar({ tipo: 'solicitarCierre', origen: 'secundaria' })
    const vista = b.estado.revision
    b.agregar(4)
    const antes = b.estado
    const r = b.enviar({ tipo: 'confirmarCierre', cola: 'eliminar', revision: vista })
    expect(r.error).toBe('CONFIRMACION_OBSOLETA')
    expect(b.estado).toBe(antes)
    expect(r.efectos).toEqual([])
    // Con la revisión actual sí.
    const ok = b.enviar({ tipo: 'confirmarCierre', cola: 'eliminar', revision: b.estado.revision })
    expect(ok.error).toBeUndefined()
    expect(tipos(ok)).toContain('cerrarVentana')
  })

  it('confirmar sin diálogo abierto responde SESION_NO_ACTIVA', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    expect(b.enviar({ tipo: 'confirmarCierre', cola: 'eliminar', revision: 0 }).error).toBe(
      'SESION_NO_ACTIVA'
    )
  })

  it('eliminar vacía pendientes, activa y contexto', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    b.enviar({ tipo: 'solicitarCierre', origen: 'principal' })
    b.enviar({ tipo: 'confirmarCierre', cola: 'eliminar', revision: b.estado.revision })
    b.enviar({ tipo: 'cerrada', causa: 'confirmada' })
    expect(b.estado.cola).toEqual({ activa: null, pendientes: [], contexto: null })
    expect(b.estado.sesion).toBeNull()
  })

  it('conservar a mitad de canción extrapola la posición y marca la entrada como reanudable', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    b.informe({ tipo: 'posicion', posicionMs: 132_600 })
    b.avanzar(400)
    b.enviar({ tipo: 'solicitarCierre', origen: 'secundaria' })
    b.enviar({ tipo: 'confirmarCierre', cola: 'conservar', revision: b.estado.revision })
    b.enviar({ tipo: 'cerrada', causa: 'confirmada' })
    const ctx = b.estado.cola.contexto!
    expect(ctx.terminada).toBe(false)
    expect(ctx.pausada).toBe(false)
    expect(ctx.posicionMs).toBeGreaterThanOrEqual(132_950)
    expect(ctx.posicionMs).toBeLessThanOrEqual(133_050)
    expect(b.estado.cola.activa).toBeNull()
    expect(b.pendientes).toEqual(['c2'])
  })

  it('conservar en pausa guarda la posición informada y pausada', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    b.informe({ tipo: 'pausada', posicionMs: 60_000 })
    b.avanzar(10_000)
    b.enviar({ tipo: 'cerrada', causa: 'forzada' })
    expect(b.estado.cola.contexto).toMatchObject({
      posicionMs: 60_000,
      pausada: true,
      terminada: false
    })
  })

  it('con la misma canción dos veces, solo esa entrada queda reanudable', () => {
    const b = new Banco()
    b.sesionSonando(1, 1)
    const activa = b.activaId
    b.informe({ tipo: 'posicion', posicionMs: 20_000 })
    b.enviar({ tipo: 'cerrada', causa: 'forzada' })
    expect(b.estado.cola.contexto?.entrada.entradaId).toBe(activa)
    expect(b.estado.cola.pendientes[0]!.entradaId).not.toBe(activa)
    b.abrir({ tipo: 'reanudar' })
    expect(b.activaId).toBe(activa)
    expect(b.pendientes).toEqual(['c1'])
  })

  it('reanudar carga en el segundo y en el mismo estado, sin título', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    b.informe({ tipo: 'pausada', posicionMs: 61_000 })
    b.enviar({ tipo: 'cerrada', causa: 'forzada' })
    b.abrir({ tipo: 'reanudar' })
    expect(b.fase).toBe('cargando')
    expect(b.estado.cola.contexto).toBeNull()
    const r = b.enviar({
      tipo: 'revalidada',
      entradaId: b.activaId,
      resultado: 'ok',
      duracionMs: 200_000,
      primeraLineaMs: 8000
    })
    expect(comandos(r)).toEqual([
      {
        tipo: 'comando',
        comando: {
          tipo: 'cargar',
          entradaId: b.activaId,
          cancionId: 'c1',
          desdeMs: 61_000,
          pausada: true,
          anuncio: 'reanudacion'
        }
      }
    ])
  })

  it('reanudar con la posición anterior a la primera línea empieza desde el principio', () => {
    const b = new Banco()
    b.sesionSonando(1)
    b.informe({ tipo: 'posicion', posicionMs: 3000 })
    b.enviar({ tipo: 'cerrada', causa: 'forzada' })
    b.abrir({ tipo: 'reanudar' })
    const r = b.enviar({
      tipo: 'revalidada',
      entradaId: b.activaId,
      resultado: 'ok',
      primeraLineaMs: 8000
    })
    expect(comandos(r)[0]).toMatchObject({
      comando: { tipo: 'cargar', desdeMs: 0, pausada: false, anuncio: 'inicio' }
    })
  })

  it('reanudar con la entrada ya no disponible aplica el flujo de error', () => {
    const b = new Banco()
    b.sesionSonando(1)
    b.informe({ tipo: 'posicion', posicionMs: 30_000 })
    b.enviar({ tipo: 'cerrada', causa: 'forzada' })
    b.abrir({ tipo: 'reanudar' })
    b.enviar({ tipo: 'revalidada', entradaId: b.activaId, resultado: 'no_encontrada' })
    expect(b.fase).toBe('error')
  })

  it('conservar en transición deja el contexto terminado y la candidata pendiente', () => {
    const b = new Banco()
    b.enTransicion(1, 2)
    const id = b.transicionId
    const c = b.enviar({ tipo: 'cerrada', causa: 'forzada' })
    expect(c.efectos).toContainEqual({ tipo: 'cancelar', transicionId: id })
    expect(b.estado.cola.contexto).toMatchObject({ terminada: true })
    expect(b.pendientes).toEqual(['c2'])
    expect(b.estado.cola.activa).toBeNull()
  })

  it('con el cierre pendiente y la cuenta congelada, cerrar no deja temporizador', () => {
    const b = new Banco()
    b.enTransicion(1, 2)
    b.enviar({ tipo: 'solicitarCierre', origen: 'principal' })
    const c = b.enviar({ tipo: 'cerrada', causa: 'salida' })
    expect(c.efectos.filter((e) => e.tipo === 'cancelar')).toEqual([])
  })

  it('si la canción termina con el diálogo abierto queda terminada, sin cuenta', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    b.enviar({ tipo: 'solicitarCierre', origen: 'secundaria' })
    const r = b.fin()
    expect(b.fase).toBe('espera')
    expect(b.estado.cola.contexto).toMatchObject({ terminada: true })
    expect(tipos(r)).not.toContain('programar')
    // Cancelar el cierre no arranca cuenta sola.
    b.enviar({ tipo: 'cancelarCierre' })
    expect(b.fase).toBe('espera')
    // Sin más pendientes, el fin con el diálogo abierto da fin de cola.
    const c = new Banco()
    c.sesionSonando(1, 2)
    c.enviar({ tipo: 'solicitarCierre', origen: 'secundaria' })
    c.enviar({ tipo: 'quitar', entradaId: c.entradaDe(2) })
    c.fin()
    expect(c.fase).toBe('fin_de_cola')
  })

  it('con el diálogo abierto, los controles de sesión no actúan y las operaciones de cola sí', () => {
    const b = new Banco()
    b.enTransicion(1, 2, 3)
    b.enviar({ tipo: 'solicitarCierre', origen: 'secundaria' })
    const antes = b.estado
    b.enviar({ tipo: 'siguiente', desdeEntradaId: uuid(9) })
    b.enviar({ tipo: 'empezar', candidataId: b.entradaDe(2) })
    b.enviar({ tipo: 'detenerTransicion', transicionId: b.transicionId })
    expect(b.estado).toBe(antes)
    // Cambiar la candidata sigue congelado y con la duración original.
    b.enviar({ tipo: 'mover', entradaId: b.entradaDe(3), antesDe: b.entradaDe(2) })
    expect(b.estado.sesion?.transicion).toMatchObject({ restanteCongeladoMs: 4000 })
    expect(tipos(b.ultimo)).not.toContain('programar')
    // En fin_de_cola con el diálogo, añadir no arranca; al cancelar sí.
    const c = new Banco()
    c.sesionSonando(1, 2)
    c.enviar({ tipo: 'solicitarCierre', origen: 'secundaria' })
    c.enviar({ tipo: 'quitar', entradaId: c.entradaDe(2) })
    c.fin()
    c.agregar(3)
    expect(c.fase).toBe('fin_de_cola')
    c.enviar({ tipo: 'cancelarCierre' })
    expect(c.fase).toBe('transicion')
  })

  it('«Otra vez» y «siguiente» no actúan con el cierre pendiente', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    b.enviar({ tipo: 'solicitarCierre', origen: 'principal' })
    const antes = b.estado
    b.enviar({ tipo: 'siguiente', desdeEntradaId: b.activaId })
    expect(b.estado).toBe(antes)
    // cancelarCierre sin cierre pendiente o ya confirmado no hace nada.
    const c = new Banco()
    c.sesionSonando(1, 2)
    const a2 = c.estado
    c.enviar({ tipo: 'cancelarCierre' })
    expect(c.estado).toBe(a2)
    c.enviar({ tipo: 'solicitarCierre', origen: 'principal' })
    c.enviar({ tipo: 'confirmarCierre', cola: 'conservar', revision: c.estado.revision })
    const a3 = c.estado
    c.enviar({ tipo: 'cancelarCierre' })
    expect(c.estado).toBe(a3)
  })

  it('la caída conserva la cola sin preguntar y registra la incidencia', () => {
    const b = new Banco()
    b.sesionSonando(1, 2, 3)
    b.informe({ tipo: 'posicion', posicionMs: 50_000 })
    const r = b.enviar({ tipo: 'cerrada', causa: 'caida' })
    expect(r.efectos).toContainEqual({ tipo: 'liberarEdicion' })
    expect(b.estado.sesion).toBeNull()
    expect(b.pendientes).toEqual(['c2', 'c3'])
    expect(b.estado.cola.contexto?.terminada).toBe(false)
    expect(b.principal.incidencia).toEqual({ tipo: 'secundaria_caida' })
    // Reabrir limpia la incidencia.
    b.abrir({ tipo: 'reanudar' })
    expect(b.principal.incidencia).toBeNull()
  })

  it('el cierre forzado y la salida conservan la cola aunque se hubiera elegido eliminar', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    b.enviar({ tipo: 'solicitarCierre', origen: 'principal' })
    b.enviar({ tipo: 'confirmarCierre', cola: 'eliminar', revision: b.estado.revision })
    b.enviar({ tipo: 'cerrada', causa: 'salida' })
    expect(b.pendientes).toEqual(['c2'])
    expect(b.estado.incidencia).toBeNull()
  })

  it('conservar durante la carga: vuelve al frente si es nueva y reanudable si era una reanudación', () => {
    const b = new Banco()
    b.agregar(1)
    b.agregar(2)
    b.abrir()
    b.enviar({ tipo: 'cerrada', causa: 'forzada' })
    expect(b.pendientes).toEqual(['c1', 'c2'])
    expect(b.estado.cola.activa).toBeNull()

    const c = new Banco()
    c.sesionSonando(1)
    c.informe({ tipo: 'posicion', posicionMs: 9000 })
    c.enviar({ tipo: 'cerrada', causa: 'forzada' })
    c.abrir({ tipo: 'reanudar' })
    c.enviar({ tipo: 'cerrada', causa: 'forzada' })
    expect(c.estado.cola.contexto).toMatchObject({
      posicionMs: 9000,
      terminada: false,
      pausada: false
    })
  })

  it('conservar con la activa fallida la devuelve al frente con su disponibilidad', () => {
    const b = new Banco()
    b.agregar(1)
    b.agregar(2)
    b.abrir()
    b.enviar({ tipo: 'revalidada', entradaId: b.activaId, resultado: 'sin_pistas' })
    b.enviar({ tipo: 'cerrada', causa: 'forzada' })
    expect(b.estado.cola.pendientes[0]).toMatchObject({
      cancionId: 'c1',
      disponibilidad: 'sin_pistas'
    })
    // Un fallo de lectura (no es un motivo de disponibilidad) la devuelve tal cual.
    const c = new Banco()
    c.sesionSonando(1, 2)
    c.informe({ tipo: 'error', error: { motivo: 'lectura', pista: 'instrumental' } })
    c.enviar({ tipo: 'cerrada', causa: 'forzada' })
    expect(c.estado.cola.pendientes[0]).toMatchObject({ cancionId: 'c1', disponibilidad: 'ok' })
  })

  it('cerrada sin sesión no hace nada', () => {
    const b = new Banco()
    const antes = b.estado
    b.enviar({ tipo: 'cerrada', causa: 'caida' })
    expect(b.estado).toBe(antes)
  })

  it('solicitarCierre en transición sin candidata cancelable y en espera con pendientes', () => {
    const b = new Banco()
    b.agregar(1)
    b.abrir()
    b.enviar({ tipo: 'revalidada', entradaId: b.activaId, resultado: 'ok' })
    b.agregar(2)
    // Cola con pendientes pero sin cuenta (cargando): solo marca el diálogo.
    b.enviar({ tipo: 'solicitarCierre', origen: 'principal' })
    expect(b.estado.sesion?.transicion).toBeNull()
    expect(b.estado.sesion?.cierrePendiente).toEqual({ origen: 'principal' })
  })
})

describe('pantallas y respuesta de la secundaria', () => {
  it('perder la pantalla no pausa ni toca la cola y deja la incidencia', () => {
    const b = new Banco()
    b.sesionSonando(1, 2)
    const cola = b.estado.cola
    const nueva: PantallaIpc = { ...PANTALLA, id: 1, etiqueta: 'Pantalla 1' }
    const r = b.enviar({
      tipo: 'pantalla',
      cambio: {
        tipo: 'perdida',
        etiqueta: 'Pantalla 2',
        estabaEnPantallaCompleta: true,
        pantalla: nueva
      }
    })
    expect(b.fase).toBe('reproduciendo')
    expect(b.estado.cola).toBe(cola)
    expect(comandos(r)).toEqual([])
    expect(b.principal.sesion).toMatchObject({
      pantalla: nueva,
      pantallaCompleta: false,
      incidencia: {
        tipo: 'pantalla_perdida',
        etiqueta: 'Pantalla 2',
        estabaEnPantallaCompleta: true
      }
    })
  })

  it('reconectarse registra la incidencia sin mover; moverla a mano la limpia', () => {
    const b = new Banco()
    b.sesionSonando(1)
    b.enviar({
      tipo: 'pantalla',
      cambio: { tipo: 'reconectada', etiqueta: 'Pantalla 2', pantallaId: 2 }
    })
    expect(b.principal.sesion?.incidencia).toEqual({
      tipo: 'pantalla_reconectada',
      etiqueta: 'Pantalla 2',
      pantallaId: 2
    })
    expect(b.principal.sesion?.pantalla).toEqual(PANTALLA)
    b.enviar({
      tipo: 'pantalla',
      cambio: { tipo: 'movida', pantalla: PANTALLA, pantallaCompleta: true }
    })
    expect(b.principal.sesion).toMatchObject({ incidencia: null, pantallaCompleta: true })
  })

  it('moverla a mano no borra una incidencia de «no responde»', () => {
    const b = new Banco()
    b.sesionSonando(1)
    b.enviar({ tipo: 'responde', responde: false })
    b.enviar({
      tipo: 'pantalla',
      cambio: { tipo: 'movida', pantalla: null, pantallaCompleta: false }
    })
    expect(b.principal.sesion?.incidencia).toEqual({ tipo: 'secundaria_no_responde' })
    b.enviar({
      tipo: 'pantalla',
      cambio: { tipo: 'movida', pantalla: null, pantallaCompleta: false }
    })
  })

  it('«no responde» y «responde» alternan la incidencia', () => {
    const b = new Banco()
    b.sesionSonando(1)
    b.enviar({ tipo: 'responde', responde: false })
    expect(b.principal.sesion?.incidencia).toEqual({ tipo: 'secundaria_no_responde' })
    const antes = b.estado
    b.enviar({ tipo: 'responde', responde: false })
    expect(b.estado).toBe(antes)
    b.enviar({ tipo: 'responde', responde: true })
    expect(b.principal.sesion?.incidencia).toBeNull()
    const despues = b.estado
    b.enviar({ tipo: 'responde', responde: true })
    expect(b.estado).toBe(despues)
  })

  it('la pantalla completa cambia el estado sin tocar las incidencias y es idempotente', () => {
    const b = new Banco()
    b.sesionSonando(1)
    b.enviar({ tipo: 'responde', responde: false })
    b.enviar({ tipo: 'pantallaCompleta', activa: true })
    expect(b.principal.sesion).toMatchObject({
      pantallaCompleta: true,
      incidencia: { tipo: 'secundaria_no_responde' }
    })
    const antes = b.estado
    b.enviar({ tipo: 'pantallaCompleta', activa: true })
    expect(b.estado).toBe(antes)
  })

  it('sin sesión los eventos de pantalla y respuesta se ignoran', () => {
    const b = new Banco()
    const antes = b.estado
    b.enviar({ tipo: 'pantalla', cambio: { tipo: 'reconectada', etiqueta: 'x', pantallaId: 1 } })
    b.enviar({ tipo: 'responde', responde: false })
    expect(b.estado).toBe(antes)
  })
})

describe('revisión', () => {
  it('sube con cada cambio observable y emite difundir al final', () => {
    const b = new Banco()
    expect(b.estado.revision).toBe(0)
    const r = b.enviar({
      tipo: 'agregar',
      cancionId: 'c1',
      titulo: 'T',
      artista: 'A',
      donde: 'final'
    })
    expect(b.estado.revision).toBe(1)
    expect(r.efectos.at(-1)).toEqual({ tipo: 'difundir' })
    expect(r.entradaId).toBe(b.entradaDe(1))
  })
})
