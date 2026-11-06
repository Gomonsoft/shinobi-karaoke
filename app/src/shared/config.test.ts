import { describe, expect, it } from 'vitest'
import { configPredeterminada, configSchema } from './config'
import { configParcialRendererSchema } from './ipc'
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
        perfil_previsto: null,
        motivo_rebaja: null,
        error: null,
        version_manifiesto: null,
        hardware: { gpu: null, vram_mb: null }
      },
      separacion: {
        modo: 'calidad',
        rapido_aceptado: null,
        modelos_descargados: [],
        factores_medidos: {}
      },
      reproductor: { volumen: 0.8, silenciado: false, voz_guia: 0.3, voz_guia_silenciada: true },
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
    expect(c.reproductor).toEqual({
      volumen: 0.3,
      silenciado: false,
      voz_guia: 0.3,
      voz_guia_silenciada: true
    })
  })
  it('acepta el ejemplo del ADR 0006', () => {
    const c = configSchema.parse({
      esquema: 1,
      instalacion: {
        estado: 'completa',
        fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' },
        perfil_hardware: 'cpu',
        perfil_previsto: 'cpu',
        motivo_rebaja: null,
        error: null,
        version_manifiesto: 1,
        hardware: { gpu: null, vram_mb: null }
      },
      separacion: {
        modo: 'automatico',
        rapido_aceptado: '2026-11-05T10:00:00Z',
        modelos_descargados: ['rapido'],
        factores_medidos: { rapido: 1.2 }
      },
      reproductor: { volumen: 0.8, silenciado: false, voz_guia: 0.3, voz_guia_silenciada: true },
      aviso_youtube_aceptado: '2026-11-03T10:00:00Z',
      ultima_comprobacion_ytdlp: '2026-11-01T09:00:00Z',
      estilo_predeterminado: ESTILO_PREDETERMINADO
    })
    expect(c.separacion.factores_medidos.rapido).toBe(1.2)
    expect(c.separacion.modo).toBe('calidad') // 'automatico' se lee como Calidad
    expect(c.separacion.rapido_aceptado).toBe('2026-11-05T10:00:00Z')
    expect(c.aviso_youtube_aceptado).toBe('2026-11-03T10:00:00Z')
  })
  it('el renderer no puede cambiar el modo ni el consentimiento de Rápido', () => {
    expect(configParcialRendererSchema.safeParse({ separacion: { modo: 'rapido' } }).success).toBe(
      false
    )
    expect(
      configParcialRendererSchema.safeParse({
        separacion: { rapido_aceptado: '2026-11-05T10:00:00Z' }
      }).success
    ).toBe(false)
    expect(configParcialRendererSchema.safeParse({ reproductor: { volumen: 0.5 } }).success).toBe(
      true
    )
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

  it('una config antigua sin los campos de la Fase 2 se lee igual', () => {
    const c = configSchema.parse({
      esquema: 1,
      instalacion: {
        estado: 'completa',
        fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' },
        perfil_hardware: 'mps',
        hardware: { gpu: 'Apple M1', vram_mb: null }
      }
    })
    expect(c.esquema).toBe(1)
    expect(c.instalacion.perfil_hardware).toBe('mps')
    expect(c.instalacion.perfil_previsto).toBeNull()
    expect(c.instalacion.motivo_rebaja).toBeNull()
    expect(c.instalacion.error).toBeNull()
    expect(c.instalacion.version_manifiesto).toBeNull()
  })
  it('acepta y valida los campos nuevos de la instalación', () => {
    const c = configSchema.parse({
      instalacion: {
        perfil_previsto: 'cuda',
        motivo_rebaja: 'memoria',
        error: { codigo: 'SIN_ESPACIO', mensaje: 'x', fase: 'componentes' },
        version_manifiesto: 3
      }
    })
    expect(c.instalacion.error?.codigo).toBe('SIN_ESPACIO')
    expect(configSchema.safeParse({ instalacion: { motivo_rebaja: 'otro' } }).success).toBe(false)
    expect(configSchema.safeParse({ instalacion: { perfil_previsto: 'tpu' } }).success).toBe(false)
    expect(configSchema.safeParse({ instalacion: { error: { codigo: 'X' } } }).success).toBe(false)
  })
})
