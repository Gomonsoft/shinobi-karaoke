import { describe, expect, it } from 'vitest'
import { CANALES, ROLES_POR_CANAL } from './canales'
import { configPredeterminada, configSchema, preferenciasSecundariaSchema } from './config'
import { CODIGOS_ERROR, CODIGOS_SOLO_MAIN } from './errores'
import { CONTRATO, configParcialRendererSchema } from './ipc'
import {
  MAXIMO_PENDIENTES,
  comandoSecundariaIpcSchema,
  estadoSecundariaIpcSchema,
  estadoSesionIpcSchema,
  informeSecundariaIpcSchema,
  listaPantallasIpcSchema
} from './sesion'
import {
  entrada,
  estadoP1,
  estadoP2,
  estadoP3,
  estadoP4,
  estadoP4FinDeCola,
  estadoP5,
  estadoP6,
  estadoS1,
  estadoS2,
  estadoS3,
  estadoS4,
  estadoSinCola,
  pantalla,
  SESION_ID
} from './__fixtures__/sesion'
import { estiloPredeterminado } from './estilo'
import { lista } from './__fixtures__'

const id = '0b9f7a4e-3c1d-4f6a-9d2e-5a8b1c7e4f30'
const args = (canal: keyof typeof CONTRATO, a: unknown[]): boolean =>
  CONTRATO[canal].args.safeParse(a).success

describe('ROLES_POR_CANAL', () => {
  it('cubre exactamente los canales de CONTRATO', () => {
    expect(Object.keys(ROLES_POR_CANAL).sort()).toEqual(Object.keys(CONTRATO).sort())
    for (const roles of Object.values(ROLES_POR_CANAL)) expect(roles.length).toBeGreaterThan(0)
  })

  it('solo la pantalla completa y los canales compartidos admiten ambos roles', () => {
    const ambos = Object.entries(ROLES_POR_CANAL)
      .filter(([, r]) => r.length === 2)
      .map(([c]) => c)
      .sort()
    expect(ambos).toEqual(
      [
        CANALES.ventana.fijarPantallaCompleta,
        CANALES.ventana.estaEnPantallaCompleta,
        CANALES.sesion.siguiente,
        CANALES.sesion.empezar,
        CANALES.sesion.detenerTransicion,
        CANALES.sesion.repetir,
        CANALES.sesion.solicitarCierre,
        CANALES.sesion.confirmarCierre,
        CANALES.sesion.cancelarCierre
      ].sort()
    )
  })

  it('la secundaria solo llama a sus canales y a los compartidos', () => {
    const deSecundaria = Object.entries(ROLES_POR_CANAL)
      .filter(([, r]) => r.includes('secundaria'))
      .map(([c]) => c)
    expect(deSecundaria.every((c) => /^(sesion|ventana):/.test(c))).toBe(true)
    for (const c of Object.keys(ROLES_POR_CANAL)) {
      if (/^(biblioteca|temas|config|cola|letras|fuente|runtime|app):/.test(c)) {
        expect(ROLES_POR_CANAL[c as keyof typeof ROLES_POR_CANAL]).toEqual(['principal'])
      }
    }
    expect(ROLES_POR_CANAL[CANALES.ventana.modoReproductor]).toEqual(['principal'])
    expect(ROLES_POR_CANAL[CANALES.ventana.evitarReposo]).toEqual(['principal'])
  })
})

describe('códigos de error nuevos', () => {
  it('existen y los genera solo main', () => {
    for (const c of [
      'EDICION_BLOQUEADA',
      'SESION_EN_CURSO',
      'SESION_NO_ACTIVA',
      'GUARDADO_PENDIENTE',
      'PANTALLA_NO_DISPONIBLE',
      'CANCION_NO_DISPONIBLE',
      'CANCION_EN_REPRODUCCION',
      'ENTRADA_NO_ENCONTRADA',
      'COLA_LLENA'
    ] as const) {
      expect(CODIGOS_ERROR).toContain(c)
      expect(CODIGOS_SOLO_MAIN).toContain(c)
    }
  })
})

describe('estados y fixtures', () => {
  it('los estados P1–P6 cumplen el esquema', () => {
    for (const e of [
      estadoP1(),
      estadoP2(),
      estadoP3(),
      estadoP4(),
      estadoP4FinDeCola(),
      estadoP5(),
      estadoP6(),
      estadoSinCola()
    ]) {
      expect(estadoSesionIpcSchema.safeParse(e).success).toBe(true)
    }
  })

  it('los estados S1–S4 cumplen el esquema', () => {
    for (const e of [estadoS1(), estadoS2(), estadoS3(), estadoS4()]) {
      expect(estadoSecundariaIpcSchema.safeParse(e).success).toBe(true)
    }
  })

  it('rechaza revisiones negativas, claves ajenas y más de 500 pendientes', () => {
    expect(estadoSesionIpcSchema.safeParse({ ...estadoP1(), revision: -1 }).success).toBe(false)
    expect(estadoSesionIpcSchema.safeParse({ ...estadoP1(), ruta: '/x' }).success).toBe(false)
    const muchas = Array.from({ length: MAXIMO_PENDIENTES + 1 }, (_, i) => ({
      ...entrada(1),
      entradaId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
    }))
    expect(estadoSesionIpcSchema.safeParse({ ...estadoP6(), pendientes: muchas }).success).toBe(
      false
    )
    expect(
      estadoSesionIpcSchema.safeParse({ ...estadoP6(), pendientes: muchas.slice(1) }).success
    ).toBe(true)
  })

  it('el estado de la secundaria no admite la lista de pendientes', () => {
    expect(
      estadoSecundariaIpcSchema.safeParse({ ...estadoS1(), pendientes: [entrada(1)] }).success
    ).toBe(false)
  })

  it('la lista de pantallas admite las dos colocaciones', () => {
    expect(
      listaPantallasIpcSchema.safeParse({
        pantallas: [pantalla(1), pantalla(2)],
        colocacion: 'libre'
      }).success
    ).toBe(true)
    expect(listaPantallasIpcSchema.safeParse({ pantallas: [], colocacion: 'otra' }).success).toBe(
      false
    )
  })
})

describe('informes de la secundaria', () => {
  const base = { sesionId: SESION_ID, entradaId: id }
  it('acepta cada tipo', () => {
    for (const i of [
      { tipo: 'lista', ...base },
      { tipo: 'reproduciendo', ...base },
      { tipo: 'pausada', ...base, posicionMs: 1000 },
      { tipo: 'posicion', ...base, posicionMs: 1000 },
      { tipo: 'fin', ...base },
      { tipo: 'error', ...base, error: { motivo: 'lectura', pista: 'instrumental' } }
    ]) {
      expect(informeSecundariaIpcSchema.safeParse(i).success).toBe(true)
    }
  })

  it('rechaza tipo desconocido, UUID mal formado y posición fuera de rango', () => {
    const rechaza = (i: unknown): boolean => !informeSecundariaIpcSchema.safeParse(i).success
    expect(rechaza({ tipo: 'saltar', ...base })).toBe(true)
    expect(rechaza({ tipo: 'fin', sesionId: 'no-uuid', entradaId: id })).toBe(true)
    expect(rechaza({ tipo: 'fin', sesionId: SESION_ID, entradaId: '1234' })).toBe(true)
    expect(rechaza({ tipo: 'posicion', ...base, posicionMs: -60_001 })).toBe(true)
    expect(rechaza({ tipo: 'posicion', ...base, posicionMs: 86_400_001 })).toBe(true)
    expect(rechaza({ tipo: 'posicion', ...base, posicionMs: 1.5 })).toBe(true)
    expect(rechaza({ tipo: 'posicion', ...base })).toBe(true)
    expect(
      informeSecundariaIpcSchema.safeParse({ tipo: 'posicion', ...base, posicionMs: -60_000 })
        .success
    ).toBe(true)
    expect(
      informeSecundariaIpcSchema.safeParse({ tipo: 'posicion', ...base, posicionMs: 86_400_000 })
        .success
    ).toBe(true)
    expect(rechaza({ tipo: 'error', ...base, error: { motivo: 'otro', pista: 'voz' } })).toBe(true)
  })

  it('sesion.informar valida el informe y responde { aplicado }', () => {
    expect(args(CANALES.sesion.informar, [{ tipo: 'fin', ...base }])).toBe(true)
    expect(args(CANALES.sesion.informar, [{ tipo: 'fin', ...base, extra: 1 }])).toBe(false)
    expect(CONTRATO[CANALES.sesion.informar].res.safeParse({ aplicado: false }).success).toBe(true)
  })
})

describe('comandos a la secundaria', () => {
  const base = { sesionId: SESION_ID, revision: 3 }
  const letra = lista().letra!
  const cargar = {
    entradaId: id,
    cancionId: 'c1',
    titulo: 'T',
    artista: 'A',
    duracionMs: 180000,
    gananciaDb: 0,
    letra,
    estilo: estiloPredeterminado(),
    lineasSinSincronizar: 0,
    silencioPrevio: true
  }
  it('acepta los siete comandos', () => {
    for (const c of [
      { tipo: 'cargar', ...base, entrada: cargar, desdeMs: 0, pausada: false, anuncio: 'inicio' },
      { tipo: 'pausar', ...base, entradaId: id, causa: 'operador' },
      { tipo: 'reanudar', ...base, entradaId: id },
      { tipo: 'reiniciar', ...base, entradaId: id },
      {
        tipo: 'transicion',
        ...base,
        transicion: { candidata: { titulo: 'T', artista: 'A' }, restanteMs: 4000, duracionMs: 4000 }
      },
      { tipo: 'transicion', ...base, transicion: null },
      { tipo: 'fin_de_cola', ...base },
      { tipo: 'error', ...base, motivo: 'sin_pistas' }
    ]) {
      expect(comandoSecundariaIpcSchema.safeParse(c).success).toBe(true)
    }
  })

  it('el DTO de cargar no admite rutas de archivo', () => {
    const c = {
      tipo: 'cargar',
      ...base,
      entrada: { ...cargar, ruta: '/tmp/x.flac' },
      desdeMs: 0,
      pausada: false,
      anuncio: 'inicio'
    }
    expect(comandoSecundariaIpcSchema.safeParse(c).success).toBe(false)
    expect(comandoSecundariaIpcSchema.safeParse({ tipo: 'borrar', ...base }).success).toBe(false)
  })
})

describe('canales de cola y sesión', () => {
  it('cola.agregar acepta siguiente, final y la forma de deshacer', () => {
    expect(args(CANALES.cola.agregar, [{ cancionId: 'c', donde: 'siguiente' }])).toBe(true)
    expect(args(CANALES.cola.agregar, [{ cancionId: 'c', donde: 'final' }])).toBe(true)
    expect(
      args(CANALES.cola.agregar, [{ cancionId: 'c', donde: { antesDe: id, siRevision: 4 } }])
    ).toBe(true)
    expect(
      args(CANALES.cola.agregar, [{ cancionId: 'c', donde: { antesDe: null, siRevision: 0 } }])
    ).toBe(true)
  })

  it('cola.agregar rechaza un donde desconocido o incompleto', () => {
    expect(args(CANALES.cola.agregar, [{ cancionId: 'c', donde: 'medio' }])).toBe(false)
    expect(args(CANALES.cola.agregar, [{ cancionId: 'c', donde: { antesDe: id } }])).toBe(false)
    expect(
      args(CANALES.cola.agregar, [{ cancionId: 'c', donde: { antesDe: id, siRevision: -1 } }])
    ).toBe(false)
    expect(args(CANALES.cola.agregar, [{ cancionId: '', donde: 'final' }])).toBe(false)
  })

  it('cola.mover exige antesDe (uuid o null)', () => {
    expect(args(CANALES.cola.mover, [{ entradaId: id }])).toBe(false)
    expect(args(CANALES.cola.mover, [{ entradaId: id, antesDe: null }])).toBe(true)
    expect(args(CANALES.cola.mover, [{ entradaId: id, antesDe: id }])).toBe(true)
    expect(args(CANALES.cola.mover, [{ entradaId: 'x', antesDe: null }])).toBe(false)
  })

  it('cola.quitar y cola.vaciar', () => {
    expect(args(CANALES.cola.quitar, [{ entradaId: id }])).toBe(true)
    expect(args(CANALES.cola.quitar, [{ entradaId: 'no' }])).toBe(false)
    expect(args(CANALES.cola.vaciar, [{ contexto: true }])).toBe(true)
    expect(args(CANALES.cola.vaciar, [{}])).toBe(false)
    const res = CONTRATO[CANALES.cola.quitar].res
    expect(res.safeParse({ estado: estadoP1(), antesDe: null }).success).toBe(true)
    expect(
      CONTRATO[CANALES.cola.agregar].res.safeParse({ estado: estadoP1(), entradaId: id }).success
    ).toBe(true)
  })

  it('sesion.abrir valida las tres formas de inicio', () => {
    const base = { pantallaId: 2, pantallaCompleta: true }
    expect(args(CANALES.sesion.abrir, [{ ...base, inicio: { tipo: 'cola' } }])).toBe(true)
    expect(args(CANALES.sesion.abrir, [{ ...base, inicio: { tipo: 'reanudar' } }])).toBe(true)
    expect(
      args(CANALES.sesion.abrir, [
        { ...base, inicio: { tipo: 'cancion', cancionId: 'c', donde: 'ahora' } }
      ])
    ).toBe(true)
    expect(
      args(CANALES.sesion.abrir, [
        { ...base, inicio: { tipo: 'cancion', cancionId: 'c', donde: 'final' } }
      ])
    ).toBe(false)
    expect(args(CANALES.sesion.abrir, [{ ...base, inicio: { tipo: 'otro' } }])).toBe(false)
    expect(
      args(CANALES.sesion.abrir, [{ ...base, pantallaId: 1.5, inicio: { tipo: 'cola' } }])
    ).toBe(false)
  })

  it('transporte, confirmarCierre y empezar usan enumeraciones cerradas y UUID', () => {
    expect(args(CANALES.sesion.transporte, [{ accion: 'pausar', entradaId: id }])).toBe(true)
    expect(args(CANALES.sesion.transporte, [{ accion: 'saltar', entradaId: id }])).toBe(false)
    expect(args(CANALES.sesion.confirmarCierre, [{ cola: 'conservar', revision: 0 }])).toBe(true)
    expect(args(CANALES.sesion.confirmarCierre, [{ cola: 'borrar', revision: 0 }])).toBe(false)
    expect(args(CANALES.sesion.confirmarCierre, [{ cola: 'eliminar', revision: -1 }])).toBe(false)
    expect(args(CANALES.sesion.empezar, [{ candidataId: 'x' }])).toBe(false)
    expect(args(CANALES.sesion.siguiente, [{ desdeEntradaId: id }])).toBe(true)
    expect(args(CANALES.sesion.detenerTransicion, [{ transicionId: id }])).toBe(true)
    expect(args(CANALES.sesion.repetir, [{ entradaId: id }])).toBe(true)
  })
})

describe('preferencias de la secundaria', () => {
  it('guardarPreferencias es estricto y rechaza claves ajenas', () => {
    expect(
      args(CANALES.sesion.guardarPreferencias, [{ volumen: 0.5, voz_guia_silenciada: false }])
    ).toBe(true)
    expect(args(CANALES.sesion.guardarPreferencias, [{ transicion_s: 5 }])).toBe(false)
    expect(args(CANALES.sesion.guardarPreferencias, [{ secundaria: null }])).toBe(false)
    expect(preferenciasSecundariaSchema.safeParse({ volumen: 1.1 }).success).toBe(false)
  })
})

describe('config.reproductor (fase 4)', () => {
  it('transicion_s inválido se lee como 4 sin apartar el archivo', () => {
    for (const valor of [0, '4', 99, 2.5, null]) {
      const r = configSchema.safeParse({ reproductor: { transicion_s: valor } })
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.reproductor.transicion_s).toBe(4)
    }
    expect(configSchema.parse({ reproductor: { transicion_s: 15 } }).reproductor.transicion_s).toBe(
      15
    )
    expect(configSchema.parse({ reproductor: { transicion_s: 1 } }).reproductor.transicion_s).toBe(
      1
    )
    expect(configSchema.parse({ reproductor: { transicion_s: 30 } }).reproductor.transicion_s).toBe(
      30
    )
  })

  it('secundaria mal formada se lee como null; bien formada se conserva', () => {
    for (const valor of [
      {},
      'x',
      3,
      { pantalla: { id: 'a' }, pantalla_completa: true },
      { pantalla: null }
    ]) {
      expect(
        configSchema.parse({ reproductor: { secundaria: valor } }).reproductor.secundaria
      ).toBeNull()
    }
    const buena = {
      pantalla: { id: 2779098405, etiqueta: 'DELL U2419H', ancho: 1920, alto: 1080 },
      pantalla_completa: true
    }
    expect(
      configSchema.parse({ reproductor: { secundaria: buena } }).reproductor.secundaria
    ).toEqual(buena)
    expect(configPredeterminada().reproductor.secundaria).toBeNull()
  })

  it('el parcial del renderer admite transicion_s de 1 a 30 y no admite secundaria', () => {
    const ok = (reproductor: unknown): boolean =>
      configParcialRendererSchema.safeParse({ reproductor }).success
    expect(ok({ transicion_s: 2 })).toBe(true)
    expect(ok({ transicion_s: 15 })).toBe(true)
    expect(ok({ transicion_s: 0 })).toBe(false)
    expect(ok({ transicion_s: 31 })).toBe(false)
    expect(ok({ transicion_s: 4.5 })).toBe(false)
    expect(ok({ transicion_s: '4' })).toBe(false)
    expect(ok({ secundaria: null })).toBe(false)
  })
})
