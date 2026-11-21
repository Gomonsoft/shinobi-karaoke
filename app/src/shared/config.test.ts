import { describe, expect, it } from 'vitest'
import { configPredeterminada, configSchema } from './config'
import { configParcialRendererSchema } from './ipc'
import { ESTILO_PREDETERMINADO } from './estilo'
import { LIMITES_PANELES, preferenciasPanelesPredeterminadas } from './paneles'

describe('configSchema (lectura tolerante)', () => {
  it('{} produce todos los valores por defecto', () => {
    const c = configPredeterminada()
    expect(c).toEqual({
      esquema: 1,
      instalacion: {
        estado: 'pendiente',
        reinstalar_componentes: false,
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
      reproductor: {
        volumen: 0.8,
        silenciado: false,
        voz_guia: 0.3,
        voz_guia_silenciada: true,
        transicion_s: 4,
        secundaria: null
      },
      editor: {
        paneles: {
          lista: { ancho: 300, minimizado: false },
          panel: { ancho: 360, minimizado: false },
          linea_tiempo: { alto: null, minimizado: false }
        }
      },
      biblioteca: { agrupar: 'ninguno' },
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
    expect(c.instalacion.reinstalar_componentes).toBe(false)
    expect(c.instalacion.fases).toEqual({
      motor: 'completada',
      componentes: 'pendiente',
      modelo: 'pendiente'
    })
    expect(c.reproductor).toEqual({
      volumen: 0.3,
      silenciado: false,
      voz_guia: 0.3,
      voz_guia_silenciada: true,
      transicion_s: 4,
      secundaria: null
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
      reproductor: {
        volumen: 0.8,
        silenciado: false,
        voz_guia: 0.3,
        voz_guia_silenciada: true,
        transicion_s: 4,
        secundaria: null
      },
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
  it('el renderer ya no puede escribir estilo_predeterminado (0170)', () => {
    expect(
      configParcialRendererSchema.safeParse({ estilo_predeterminado: ESTILO_PREDETERMINADO })
        .success
    ).toBe(false)
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

describe('editor.paneles (lectura tolerante campo a campo)', () => {
  const defecto = preferenciasPanelesPredeterminadas()
  it('el defecto coincide con paneles.ts', () => {
    expect(configPredeterminada().editor.paneles).toEqual(defecto)
  })
  it.each([
    ['sin editor', {}],
    ['editor: 5', { editor: 5 }],
    ['paneles: []', { editor: { paneles: [] } }]
  ])('%s abre con los defectos', (_n, entrada) => {
    expect(configSchema.parse(entrada).editor.paneles).toEqual(defecto)
  })
  it('un valor inválido solo cambia su propio campo', () => {
    const c = configSchema.parse({
      reproductor: { volumen: 0.4 },
      editor: {
        paneles: {
          lista: { ancho: 2000, minimizado: true },
          panel: { ancho: 299.5, minimizado: 'si' },
          linea_tiempo: { alto: 'x', minimizado: true }
        }
      }
    })
    expect(c.editor.paneles).toEqual({
      lista: { ancho: 300, minimizado: true },
      panel: { ancho: 360, minimizado: false },
      linea_tiempo: { alto: null, minimizado: true }
    })
    expect(c.reproductor.volumen).toBe(0.4)
  })
  it('conserva los valores válidos, incluidos los extremos', () => {
    const c = configSchema.parse({
      editor: {
        paneles: {
          lista: { ancho: 256 },
          panel: { ancho: 480 },
          linea_tiempo: { alto: 960 }
        }
      }
    })
    expect(c.editor.paneles.lista.ancho).toBe(256)
    expect(c.editor.paneles.panel.ancho).toBe(480)
    expect(c.editor.paneles.linea_tiempo.alto).toBe(960)
  })
})

describe('configParcialRendererSchema.editor', () => {
  const ok = (editor: unknown) => configParcialRendererSchema.safeParse({ editor }).success
  it('acepta parciales dentro de rango y alto null', () => {
    expect(ok({ paneles: { lista: { ancho: 320 } } })).toBe(true)
    expect(ok({ paneles: { linea_tiempo: { alto: null } } })).toBe(true)
    expect(ok({ paneles: {} })).toBe(true)
  })
  it('rechaza fuera de rango, no enteros y claves desconocidas', () => {
    expect(ok({ paneles: { lista: { ancho: 255 } } })).toBe(false)
    expect(ok({ paneles: { lista: { ancho: 481 } } })).toBe(false)
    expect(ok({ paneles: { lista: { ancho: 300.5 } } })).toBe(false)
    expect(ok({ paneles: { linea_tiempo: { alto: 175 } } })).toBe(false)
    expect(ok({ paneles: { lista: { otro: 1 } } })).toBe(false)
    expect(ok({ otro: 1 })).toBe(false)
  })
  it('los límites de paneles.ts y los de los esquemas coinciden', () => {
    const casos = [
      ['lista', 'ancho', LIMITES_PANELES.lista],
      ['panel', 'ancho', LIMITES_PANELES.panel],
      ['linea_tiempo', 'alto', LIMITES_PANELES.linea_tiempo]
    ] as const
    for (const [panel, campo, lim] of casos) {
      const prueba = (v: number): [boolean, boolean] => [
        ok({ paneles: { [panel]: { [campo]: v } } }),
        configSchema.parse({ editor: { paneles: { [panel]: { [campo]: v } } } }).editor.paneles[
          panel
        ][campo as never] === v
      ]
      expect(prueba(lim.min)).toEqual([true, true])
      expect(prueba(lim.max)).toEqual([true, true])
      expect(prueba(lim.min - 1)[0]).toBe(false)
      expect(prueba(lim.max + 1)[0]).toBe(false)
      expect(prueba(lim.min - 1)[1]).toBe(false)
      expect(prueba(lim.max + 1)[1]).toBe(false)
    }
  })
})

describe('biblioteca.agrupar (lectura tolerante, ADR 0016 §9)', () => {
  it('el defecto es "ninguno"', () => {
    expect(configPredeterminada().biblioteca.agrupar).toBe('ninguno')
  })
  it.each([
    ['sin biblioteca', {}],
    ['biblioteca: 3', { biblioteca: 3 }],
    ['biblioteca: []', { biblioteca: [] }],
    ['agrupar: "x"', { biblioteca: { agrupar: 'x' } }],
    ['agrupar: 7', { biblioteca: { agrupar: 7 } }]
  ])('%s abre con "ninguno" y conserva el resto', (_nombre, entrada) => {
    const c = configSchema.parse({ ...entrada, reproductor: { volumen: 0.3 } })
    expect(c.biblioteca).toEqual({ agrupar: 'ninguno' })
    expect(c.reproductor.volumen).toBe(0.3)
  })
  it.each(['ninguno', 'artista', 'album'])('conserva "%s"', (agrupar) => {
    expect(configSchema.parse({ biblioteca: { agrupar } }).biblioteca.agrupar).toBe(agrupar)
  })
  it('el renderer solo puede escribir el enum, sin `.catch` ni claves extra', () => {
    const ok = (biblioteca: unknown): boolean =>
      configParcialRendererSchema.safeParse({ biblioteca }).success
    expect(ok({ agrupar: 'album' })).toBe(true)
    expect(ok({ agrupar: 'x' })).toBe(false)
    expect(ok({})).toBe(false)
    expect(ok({ agrupar: 'artista', otro: 1 })).toBe(false)
    expect(ok(3)).toBe(false)
  })
})
