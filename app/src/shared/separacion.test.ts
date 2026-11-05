import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import fixtures from './__fixtures__/separacion.json'
import { CODIGOS_ERROR, CODIGOS_SOLO_MAIN } from './errores'
import {
  FASES_PROGRESO,
  FASES_SEPARACION_MAIN,
  FASES_SEPARACION_WORKER,
  argsSepararSchema,
  parsearLineaWorker,
  resultadoSepararSchema
} from './protocolo'
import {
  CANALES,
  CONTRATO,
  estimacionCancionSchema,
  eventoProgresoSchema,
  trabajoSchema
} from './ipc'
import { escenarioSeparadorSchema } from './separacion'

const pyProtocolo = readFileSync(
  join(__dirname, '../../../worker/shinobi_worker/protocolo.py'),
  'utf-8'
)

describe('argsSepararSchema', () => {
  it('acepta rutas POSIX y de Windows', () => {
    expect(argsSepararSchema.safeParse(fixtures.argsValidos).success).toBe(true)
    expect(argsSepararSchema.safeParse(fixtures.argsValidosWindows).success).toBe(true)
  })
  it.each(Object.entries(fixtures.argsInvalidos))('rechaza %s', (_n, cambio) => {
    expect(argsSepararSchema.safeParse({ ...fixtures.argsValidos, ...cambio }).success).toBe(false)
  })
  it('rechaza si falta una clave', () => {
    const sin: Record<string, unknown> = { ...fixtures.argsValidos }
    delete sin.bloques
    expect(argsSepararSchema.safeParse(sin).success).toBe(false)
  })
})

describe('resultado y eventos de separar', () => {
  it('el resultado de ejemplo es válido y rechaza otras rutas', () => {
    expect(resultadoSepararSchema.safeParse(fixtures.resultado).success).toBe(true)
    expect(resultadoSepararSchema.safeParse({ ...fixtures.resultado, voz: 'x.flac' }).success).toBe(
      false
    )
    expect(
      resultadoSepararSchema.safeParse({ ...fixtures.resultado, dispositivo: 'mps' }).success
    ).toBe(false)
  })
  it('cada evento de ejemplo es una línea válida del protocolo y de una fase conocida', () => {
    for (const [fase, evento] of Object.entries(fixtures.eventos)) {
      expect(evento.fase).toBe(fase)
      expect(FASES_PROGRESO).toContain(fase)
      expect(parsearLineaWorker(JSON.stringify(evento)).ok).toBe(true)
    }
  })
  it('las fases del worker y del main no se solapan y están en FASES_PROGRESO', () => {
    const todas = [...FASES_SEPARACION_WORKER, ...FASES_SEPARACION_MAIN]
    expect(new Set(todas).size).toBe(todas.length)
    for (const f of todas) expect(FASES_PROGRESO).toContain(f)
  })
  it('las fases del worker coinciden con FASES_SEPARACION de protocolo.py', () => {
    const bloque = /FASES_SEPARACION\s*=\s*\(([^)]*)\)/.exec(pyProtocolo)?.[1] ?? ''
    const fasesPy = [...bloque.matchAll(/"([a-z_]+)"/g)].map((m) => m[1])
    expect(fasesPy).toEqual([...FASES_SEPARACION_WORKER])
  })
})

describe('eventos de progreso hacia el renderer', () => {
  const base = { id: 't1', cancionId: 'c1', paso: 'separacion', etaSegundos: null }
  it('admite el detalle de cada fase y el intento', () => {
    for (const ev of Object.values(fixtures.eventos)) {
      const e: { fase: string; valor: number | null; detalle?: unknown } = ev
      const r = eventoProgresoSchema.safeParse({
        ...base,
        fase: e.fase,
        valor: e.valor,
        ...(e.detalle ? { detalle: e.detalle } : {}),
        intento: 2
      })
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.detalle).toEqual(e.detalle)
    }
  })
  it('rechaza un intento fuera de 1–3 o un motivo desconocido', () => {
    expect(
      eventoProgresoSchema.safeParse({ ...base, fase: 'x', valor: null, intento: 4 }).success
    ).toBe(false)
    expect(
      eventoProgresoSchema.safeParse({
        ...base,
        fase: 'reintentando',
        valor: null,
        detalle: { motivo: 'otro' }
      }).success
    ).toBe(false)
  })
  it('TrabajoIpc admite modo, dispositivo e intento (y su ausencia)', () => {
    const trabajo = {
      id: 't1',
      cancionId: 'c1',
      paso: 'separacion',
      cola: 'pesada',
      comando: 'separar',
      estado: 'en_curso',
      posicion: null,
      resultado: null,
      error: null,
      progreso: null
    }
    expect(trabajoSchema.safeParse(trabajo).success).toBe(true)
    expect(
      trabajoSchema.safeParse({ ...trabajo, modo: 'calidad', dispositivo: 'cuda', intento: 3 })
        .success
    ).toBe(true)
    expect(trabajoSchema.safeParse({ ...trabajo, modo: null, dispositivo: null }).success).toBe(
      true
    )
    expect(trabajoSchema.safeParse({ ...trabajo, modo: 'mps' }).success).toBe(false)
  })
})

describe('errores', () => {
  it('PROCESO_TERMINADO existe y solo lo genera el main', () => {
    expect(CODIGOS_ERROR).toContain('PROCESO_TERMINADO')
    expect(CODIGOS_SOLO_MAIN).toEqual(['PROCESO_TERMINADO', 'ARCHIVO_SIN_LETRA'])
  })
})

describe('IPC de separación', () => {
  it('separar recibe un id y estimar devuelve minutos con origen o null', () => {
    expect(CONTRATO[CANALES.separacion.separar].args.safeParse(['c1']).success).toBe(true)
    expect(CONTRATO[CANALES.separacion.separar].args.safeParse([]).success).toBe(false)
    expect(CONTRATO[CANALES.separacion.estimar].args.safeParse(['c1']).success).toBe(true)
    for (const origen of ['medido_equipo', 'referencia_medida', 'estimado']) {
      expect(estimacionCancionSchema.safeParse({ min: 5, max: 6, origen }).success).toBe(true)
    }
    expect(estimacionCancionSchema.safeParse(null).success).toBe(true)
    expect(estimacionCancionSchema.safeParse({ min: 5, max: 6 }).success).toBe(false)
    expect(estimacionCancionSchema.safeParse({ min: 5, max: 6, origen: 'x' }).success).toBe(false)
  })
})

describe('escenarioSeparadorSchema', () => {
  it('acepta el ejemplo y el mínimo', () => {
    expect(escenarioSeparadorSchema.safeParse(fixtures.escenario).success).toBe(true)
    expect(escenarioSeparadorSchema.safeParse({ segundos: 0, pasos: 1 }).success).toBe(true)
    expect(
      escenarioSeparadorSchema.safeParse({ segundos: 1, pasos: 2, morir_con_sigkill: true }).success
    ).toBe(true)
  })
  it.each([
    ['sin pasos', { segundos: 1 }],
    ['pasos 0', { segundos: 1, pasos: 0 }],
    ['segundos negativos', { segundos: -1, pasos: 1 }],
    [
      'código fuera de separar',
      {
        segundos: 1,
        pasos: 1,
        fallos: [{ cuando: {}, codigo: 'SIN_CONEXION', reintentable: false }]
      }
    ],
    [
      'intento 4',
      {
        segundos: 1,
        pasos: 1,
        fallos: [{ cuando: { intento: 4 }, codigo: 'ERROR_INTERNO', reintentable: false }]
      }
    ],
    ['clave extra', { segundos: 1, pasos: 1, extra: true }]
  ])('rechaza %s', (_n, esc) => {
    expect(escenarioSeparadorSchema.safeParse(esc).success).toBe(false)
  })
})
