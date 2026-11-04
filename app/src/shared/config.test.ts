import { describe, expect, it } from 'vitest'
import { configPredeterminada, configSchema } from './config'
import { ESTILO_PREDETERMINADO } from './estilo'

describe('configSchema (lectura tolerante)', () => {
  it('{} produce todos los valores por defecto', () => {
    const c = configPredeterminada()
    expect(c).toEqual({
      esquema: 1,
      instalacion: {
        estado: 'pendiente',
        fases: { motor: 'pendiente', componentes: 'pendiente', modelo: 'pendiente' },
        perfil_hardware: null,
        hardware: { gpu: null, vram_mb: null }
      },
      separacion: { modo: 'automatico', modelos_descargados: [], factores_medidos: {} },
      reproductor: { volumen: 0.8, silenciado: false },
      aviso_youtube_aceptado: null,
      ultima_comprobacion_ytdlp: null,
      estilo_predeterminado: ESTILO_PREDETERMINADO
    })
  })
  it('el estilo predeterminado por defecto no comparte referencias', () => {
    const a = configPredeterminada()
    a.estilo_predeterminado.letra.color = '#000000'
    expect(configPredeterminada().estilo_predeterminado.letra.color).toBe('#FFFFFF')
  })
  it('rellena solo los campos ausentes en objetos parciales', () => {
    const c = configSchema.parse({
      instalacion: { estado: 'completa', fases: { motor: 'completada' } },
      reproductor: { volumen: 0.3 }
    })
    expect(c.instalacion.estado).toBe('completa')
    expect(c.instalacion.fases).toEqual({
      motor: 'completada',
      componentes: 'pendiente',
      modelo: 'pendiente'
    })
    expect(c.reproductor).toEqual({ volumen: 0.3, silenciado: false })
  })
  it('acepta el ejemplo del ADR 0006', () => {
    const c = configSchema.parse({
      esquema: 1,
      instalacion: {
        estado: 'completa',
        fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' },
        perfil_hardware: 'cpu',
        hardware: { gpu: null, vram_mb: null }
      },
      separacion: {
        modo: 'automatico',
        modelos_descargados: ['rapido'],
        factores_medidos: { rapido: 1.2 }
      },
      reproductor: { volumen: 0.8, silenciado: false },
      aviso_youtube_aceptado: '2026-11-03T10:00:00Z',
      ultima_comprobacion_ytdlp: '2026-11-01T09:00:00Z',
      estilo_predeterminado: ESTILO_PREDETERMINADO
    })
    expect(c.separacion.factores_medidos.rapido).toBe(1.2)
    expect(c.aviso_youtube_aceptado).toBe('2026-11-03T10:00:00Z')
  })
  it('rechaza valores fuera de rango o de enumeraciones', () => {
    expect(configSchema.safeParse({ reproductor: { volumen: 1.5 } }).success).toBe(false)
    expect(configSchema.safeParse({ separacion: { modo: 'turbo' } }).success).toBe(false)
    expect(configSchema.safeParse({ instalacion: { perfil_hardware: 'tpu' } }).success).toBe(false)
    expect(configSchema.safeParse({ aviso_youtube_aceptado: 'ayer' }).success).toBe(false)
    expect(
      configSchema.safeParse({ separacion: { factores_medidos: { rapido: -1 } } }).success
    ).toBe(false)
    expect(configSchema.safeParse({ estilo_predeterminado: { version: 1 } }).success).toBe(false)
  })
})
