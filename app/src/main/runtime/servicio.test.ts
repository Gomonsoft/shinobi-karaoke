import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { configPredeterminada, manifiestoSchema, type Config } from '../../shared'
import { ocultarRutas, crearServicioRuntime } from './servicio'

const manifiesto = manifiestoSchema.parse(
  JSON.parse(readFileSync(join(__dirname, '../../../resources/runtime-manifest.json'), 'utf8'))
)

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
function fusionar(base: Record<string, unknown>, parcial: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(parcial)) {
    const actual = base[k]
    if (esObjeto(v) && esObjeto(actual)) fusionar(actual, v)
    else base[k] = v
  }
}

function preparar(
  parcial: (c: Config) => void = () => undefined,
  extra: { ofertaSeparacionVigente?: () => boolean; espacioLibre?: number } = {}
) {
  const cfg = configPredeterminada()
  parcial(cfg)
  const oyentes: ((c: Config) => void)[] = []
  let instalando = false
  const gestor = {
    instalar: vi.fn((opciones?: { modelo?: 'calidad' | 'rapido' }) => {
      void opciones
      instalando = true
      return Promise.resolve({ estado: 'completa' as const }).finally(() => (instalando = false))
    }),
    pausar: vi.fn(() => Promise.resolve()),
    marcarDanada: vi.fn((motivo: 'componentes') => {
      cfg.instalacion.estado = 'dañada'
      cfg.instalacion.fases[motivo] = 'pendiente'
      for (const cb of oyentes) cb(cfg)
      return Promise.resolve()
    }),
    instalando: () => instalando,
    suscribir: vi.fn(() => () => undefined),
    descargarModelo: vi.fn(
      (
        id: 'calidad' | 'rapido',
        señal?: AbortSignal,
        alProgreso?: (p: { bytes: number; total: number }) => void
      ) => {
        void señal
        void alProgreso
        cfg.separacion.modelos_descargados = [
          ...new Set([...cfg.separacion.modelos_descargados, id])
        ]
        return Promise.resolve()
      }
    )
  }
  const previos = {
    plataforma: 'darwin-arm64' as const,
    motivo: null,
    versionMinimaSo: null,
    equipo: { so: 'macos' as const, versionSo: '15.1', arquitectura: 'arm64' as const },
    emulada: false,
    perfil: 'mps' as const,
    gpu: null,
    bytesDescarga: 1,
    espacioRequerido: 2,
    espacioLibre: extra.espacioLibre ?? 3,
    modoPrevisto: 'calidad' as const
  }
  const registrar = vi.fn()
  const servicio = crearServicioRuntime({
    gestor,
    config: {
      obtener: () => structuredClone(cfg),
      actualizar: (p) => {
        fusionar(cfg as unknown as Record<string, unknown>, p as Record<string, unknown>)
        for (const cb of oyentes) cb(cfg)
        return Promise.resolve(structuredClone(cfg))
      },
      suscribir: (cb) => (oyentes.push(cb), () => undefined)
    },
    deteccion: { requisitosPrevios: () => Promise.resolve(previos) },
    manifiesto,
    datos: '/Users/ana/datos',
    versionApp: '1.2.3',
    descripcionSo: 'Darwin 24',
    ultimasLineasRegistro: () =>
      Promise.resolve([
        'x [runtime] fallo en /Users/ana/datos/runtime/venv y /Users/ana/Música/a.wav'
      ]),
    directorioUsuario: '/Users/ana',
    ...(extra.ofertaSeparacionVigente
      ? { ofertaSeparacionVigente: extra.ofertaSeparacionVigente }
      : {}),
    registrar
  })
  return { servicio, cfg, gestor, oyentes, registrar }
}

describe('servicio de runtime (0036)', () => {
  it('delega el diagnóstico de componentes y difunde el cambio de configuración', async () => {
    const { servicio, gestor } = preparar((c) => {
      c.instalacion.estado = 'completa'
      c.instalacion.fases.componentes = 'completada'
    })
    const alCambiar = vi.fn()
    servicio.alCambiar(alCambiar)

    await servicio.marcarDanada('componentes')
    expect(gestor.marcarDanada).toHaveBeenCalledWith('componentes')
    await vi.waitFor(() =>
      expect(alCambiar).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: 'dañada',
          fases: expect.objectContaining({ componentes: 'pendiente' })
        })
      )
    )
  })

  it('estado pendiente con perfil previsto: modo y bytes restantes', async () => {
    const { servicio } = preparar((c) => {
      c.instalacion.perfil_previsto = 'mps'
    })
    const e = await servicio.estado()
    expect(e).toMatchObject({ estado: 'pendiente', modo: 'calidad', perfilPrevisto: 'mps' })
    expect(e.bytesRestantes).toBeGreaterThan(0)
  })

  it('las fases completadas no cuentan en bytesRestantes; en_curso guardado sin proceso es pendiente', async () => {
    const { servicio } = preparar((c) => {
      c.instalacion.perfil_previsto = 'mps'
      c.instalacion.estado = 'en_curso'
    })
    const antes = (await servicio.estado()).bytesRestantes as number
    const otro = preparar((c) => {
      c.instalacion.perfil_previsto = 'mps'
      c.instalacion.fases.motor = 'completada'
    })
    expect((await servicio.estado()).estado).toBe('pendiente')
    expect((await otro.servicio.estado()).bytesRestantes).toBeLessThan(antes)
  })

  it('sin perfil: modo y bytes null; completa() solo con estado completa', async () => {
    const a = preparar()
    expect(await a.servicio.estado()).toMatchObject({ modo: null, bytesRestantes: null })
    expect(a.servicio.completa()).toBe(false)
    const b = preparar((c) => {
      c.instalacion.estado = 'completa'
    })
    expect(b.servicio.completa()).toBe(true)
    b.servicio.fijarVerificando(true)
    expect(b.servicio.completa()).toBe(false)
    expect((await b.servicio.estado()).estado).toBe('verificando')
  })

  it('instalar lanza el gestor, pasa a en_curso y avisa de los cambios', async () => {
    const { servicio, gestor } = preparar()
    const cb = vi.fn()
    servicio.alCambiar(cb)
    servicio.instalar()
    expect(gestor.instalar).toHaveBeenCalledOnce()
    expect(servicio.instalando()).toBe(true)
    await vi.waitFor(() => expect(cb).toHaveBeenCalled())
    expect(cb.mock.calls[0]?.[0].estado).toBe('en_curso')
  })

  it('requisitos incluye motivo y versionMinimaSo', async () => {
    const r = await preparar().servicio.requisitos(true)
    expect(r).toMatchObject({ motivo: null, versionMinimaSo: null, plataforma: 'darwin-arm64' })
  })

  it('estimarSeparacion usa perfil y modo vigentes; null sin perfil', () => {
    expect(preparar().servicio.estimarSeparacion(240000)).toBeNull()
    const { servicio } = preparar((c) => {
      c.instalacion.perfil_hardware = 'mps'
    })
    const r = servicio.estimarSeparacion(240000)
    expect(r?.max).toBeGreaterThanOrEqual(r?.min ?? 0)
  })

  it('perfil cpu: el modo publicado y la estimación son los de Calidad, no los de Rápido', async () => {
    const { servicio } = preparar((c) => {
      c.instalacion.perfil_hardware = 'cpu'
    })
    expect((await servicio.estado()).modo).toBe('calidad')
    const r = servicio.estimarSeparacion(240000)
    expect(r?.origen).toBe('estimado')
    expect(r?.min).toBeCloseTo(6 + 10 / 60)
    expect(r?.max).toBeCloseTo(16 + 20 / 60)
  })

  it('modo rapido sin consentimiento nunca se publica ni se estima como Rápido', async () => {
    const { servicio } = preparar((c) => {
      c.instalacion.perfil_hardware = 'cpu'
      c.separacion.modo = 'rapido'
    })
    expect((await servicio.estado()).modo).toBe('calidad')
    const r = servicio.estimarSeparacion(240000)
    expect(r?.origen).toBe('estimado')
    expect(r?.min).toBeCloseTo(6 + 10 / 60)
    expect(r?.max).toBeCloseTo(16 + 20 / 60)
  })

  it('detalles: versión, SO, fase, código y registro sin rutas del usuario', async () => {
    const { servicio } = preparar((c) => {
      c.instalacion.error = { codigo: 'SIN_ESPACIO', mensaje: 'poco', fase: 'motor' }
    })
    const t = await servicio.detalles()
    expect(t).toContain('1.2.3')
    expect(t).toContain('Darwin 24')
    expect(t).toContain('Fase: motor')
    expect(t).toContain('SIN_ESPACIO')
    expect(t).toContain('<datos>')
    expect(t).not.toContain('/Users/ana')
  })
})

const FALLO_MODELO = (codigo: string) => (c: Config) => {
  c.instalacion.perfil_hardware = 'mps'
  c.instalacion.error = { codigo, mensaje: 'x', fase: 'modelo' }
}

describe('oferta del modelo Rápido (0057)', () => {
  it.each([
    ['VERIFICACION_FALLIDA', true],
    ['SERVICIO_NO_DISPONIBLE', true],
    ['SIN_CONEXION', false],
    ['ERROR_INTERNO', false]
  ])('ofrecerRapido con %s en la fase de modelo: %s', async (codigo, esperado) => {
    const { servicio } = preparar(FALLO_MODELO(codigo))
    expect((await servicio.estado()).ofrecerRapido).toBe(esperado)
  })

  it('ofrecerRapido es false con un error de otra fase', async () => {
    const { servicio } = preparar((c) => {
      FALLO_MODELO('VERIFICACION_FALLIDA')(c)
      c.instalacion.error = { codigo: 'VERIFICACION_FALLIDA', mensaje: 'x', fase: 'componentes' }
    })
    expect((await servicio.estado()).ofrecerRapido).toBe(false)
  })

  it('SIN_ESPACIO solo ofrece Rápido si sobran sus bytes más 100 MB', async () => {
    const rapido = manifiesto.modelos.find((m) => m.id === 'rapido')!.bytes
    const justo = preparar(FALLO_MODELO('SIN_ESPACIO'), { espacioLibre: rapido + 100e6 })
    expect((await justo.servicio.estado()).ofrecerRapido).toBe(true)
    const corto = preparar(FALLO_MODELO('SIN_ESPACIO'), { espacioLibre: rapido + 100e6 - 1 })
    expect((await corto.servicio.estado()).ofrecerRapido).toBe(false)
  })

  it('rapidoPendiente se deriva de config.json y apaga la oferta', async () => {
    const { servicio } = preparar((c) => {
      FALLO_MODELO('VERIFICACION_FALLIDA')(c)
      c.separacion.rapido_aceptado = '2026-11-05T10:00:00.000Z'
    })
    const e = await servicio.estado()
    expect(e.rapidoPendiente).toBe(true)
    expect(e.ofrecerRapido).toBe(false)
    // Con Rápido verificado ya no está pendiente.
    const hecho = preparar((c) => {
      c.separacion.rapido_aceptado = '2026-11-05T10:00:00.000Z'
      c.separacion.modelos_descargados = ['rapido']
    })
    expect((await hecho.servicio.estado()).rapidoPendiente).toBe(false)
  })

  it('requisitos expone el tamaño de Rápido para el aviso', async () => {
    const r = await preparar().servicio.requisitos(false)
    expect(r.bytesRapido).toBe(manifiesto.modelos.find((m) => m.id === 'rapido')!.bytes)
    expect(r.rapidoDescargado).toBe(false)
  })
})

describe('aceptarYUsarRapido (0057)', () => {
  const FECHA = '2026-11-05T10:00:00.000Z'

  it('sin oferta ni Rápido pendiente se rechaza y no escribe nada', async () => {
    const { servicio, cfg, gestor } = preparar()
    await expect(servicio.aceptarYUsarRapido('primer_arranque')).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    await expect(servicio.aceptarYUsarRapido('separacion')).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    expect(cfg.separacion.rapido_aceptado).toBeNull()
    expect(gestor.instalar).not.toHaveBeenCalled()
    expect(gestor.descargarModelo).not.toHaveBeenCalled()
  })

  it('primer arranque con oferta: guarda el consentimiento, instala con Rápido y lo registra', async () => {
    const { servicio, cfg, gestor, registrar } = preparar(FALLO_MODELO('VERIFICACION_FALLIDA'))
    await servicio.aceptarYUsarRapido('primer_arranque')
    expect(cfg.separacion.rapido_aceptado).not.toBeNull()
    expect(gestor.instalar).toHaveBeenCalledWith({ modelo: 'rapido' })
    expect(registrar).toHaveBeenCalledWith('info', expect.stringContaining('primer_arranque'))
  })

  it('el modo solo cambia al verificar el modelo: si la instalación falla, se conserva el consentimiento', async () => {
    const { servicio, cfg, gestor } = preparar(FALLO_MODELO('VERIFICACION_FALLIDA'))
    gestor.instalar.mockResolvedValueOnce({
      estado: 'error',
      error: { codigo: 'SERVICIO_NO_DISPONIBLE', mensaje: 'x', fase: 'modelo', detalles: '' }
    } as never)
    await expect(servicio.aceptarYUsarRapido('primer_arranque')).rejects.toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE'
    })
    expect(cfg.separacion.modo).toBe('calidad')
    expect(cfg.separacion.rapido_aceptado).not.toBeNull()
  })

  it('con Rápido pendiente acepta sin escribir otra fecha', async () => {
    const { servicio, cfg } = preparar((c) => {
      FALLO_MODELO('SERVICIO_NO_DISPONIBLE')(c)
      c.separacion.rapido_aceptado = FECHA
    })
    await servicio.aceptarYUsarRapido('primer_arranque')
    expect(cfg.separacion.rapido_aceptado).toBe(FECHA)
  })

  it('Rápido ya verificado y vuelta a Calidad: sin oferta nueva se rechaza', async () => {
    const { servicio } = preparar((c) => {
      c.separacion.rapido_aceptado = FECHA
      c.separacion.modelos_descargados = ['calidad', 'rapido']
      c.separacion.modo = 'calidad'
    })
    await expect(servicio.aceptarYUsarRapido('primer_arranque')).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
  })

  it('separación con oferta vigente (instalación completa): descarga con progreso y fija el modo', async () => {
    const { servicio, cfg, gestor } = preparar(
      (c) => {
        c.instalacion.estado = 'completa'
      },
      { ofertaSeparacionVigente: () => true }
    )
    const progreso = vi.fn()
    servicio.alProgreso(progreso)
    gestor.descargarModelo.mockImplementationOnce(async (id, _s, alProgreso) => {
      expect(cfg.separacion.modo).toBe('calidad')
      alProgreso?.({ bytes: 10, total: 100 })
      cfg.separacion.modelos_descargados = [id]
    })
    await servicio.aceptarYUsarRapido('separacion')
    expect(gestor.descargarModelo).toHaveBeenCalledWith(
      'rapido',
      expect.any(AbortSignal),
      expect.any(Function)
    )
    expect(cfg.separacion.modo).toBe('rapido')
    expect(cfg.separacion.rapido_aceptado).not.toBeNull()
    expect(progreso).toHaveBeenCalledWith(
      expect.objectContaining({ modo: 'rapido', bytes: 10, total: 100 })
    )
  })

  it('si la descarga falla o se cancela, el modo no cambia y el consentimiento se conserva', async () => {
    const { servicio, cfg, gestor } = preparar(
      (c) => {
        c.instalacion.estado = 'completa'
      },
      { ofertaSeparacionVigente: () => true }
    )
    gestor.descargarModelo.mockRejectedValueOnce(
      Object.assign(new Error('cancelada'), { codigo: 'CANCELADO' })
    )
    await expect(servicio.aceptarYUsarRapido('separacion')).rejects.toMatchObject({
      codigo: 'CANCELADO'
    })
    expect(cfg.separacion.modo).toBe('calidad')
    expect(cfg.separacion.rapido_aceptado).not.toBeNull()
    expect((await servicio.estado()).rapidoPendiente).toBe(true)
  })

  it('estado().ofrecerRapido refleja la oferta de la separación, salvo con Rápido pendiente; el origen primer_arranque no la usa', async () => {
    const { servicio, cfg } = preparar(
      (c) => {
        c.instalacion.estado = 'completa'
      },
      { ofertaSeparacionVigente: () => true }
    )
    expect((await servicio.estado()).ofrecerRapido).toBe(true)
    await expect(servicio.aceptarYUsarRapido('primer_arranque')).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
    cfg.separacion.rapido_aceptado = new Date().toISOString()
    const e = await servicio.estado()
    expect(e.rapidoPendiente).toBe(true)
    expect(e.ofrecerRapido).toBe(false)
  })

  it('sin oferta vigente en la separación, aceptarYUsarRapido(separacion) -> ARGUMENTOS_NO_VALIDOS', async () => {
    const { servicio } = preparar((c) => {
      c.instalacion.estado = 'completa'
    })
    expect((await servicio.estado()).ofrecerRapido).toBe(false)
    await expect(servicio.aceptarYUsarRapido('separacion')).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })
  })

  it('dos llamadas simultáneas comparten promesa', async () => {
    const { servicio, gestor } = preparar(FALLO_MODELO('VERIFICACION_FALLIDA'))
    const a = servicio.aceptarYUsarRapido('primer_arranque')
    const b = servicio.aceptarYUsarRapido('primer_arranque')
    expect(a).toBe(b)
    await a
    expect(gestor.instalar).toHaveBeenCalledOnce()
  })
})

describe('volverACalidad (0057)', () => {
  const rapidoActivo = (c: Config): void => {
    c.instalacion.estado = 'completa'
    c.separacion.rapido_aceptado = '2026-11-05T10:00:00.000Z'
    c.separacion.modo = 'rapido'
    c.separacion.modelos_descargados = ['rapido']
  }

  it('éxito: descarga Calidad, fija el modo y conserva Rápido y el consentimiento', async () => {
    const { servicio, cfg, gestor } = preparar(rapidoActivo)
    const cambios = vi.fn()
    servicio.alCambiar(cambios)
    const p = servicio.volverACalidad()
    expect((await servicio.estado()).volverACalidad).toMatchObject({ estado: 'descargando' })
    await p
    expect(gestor.descargarModelo).toHaveBeenCalledWith(
      'calidad',
      expect.any(AbortSignal),
      expect.any(Function)
    )
    expect(cfg.separacion.modo).toBe('calidad')
    expect(cfg.separacion.rapido_aceptado).not.toBeNull()
    expect(cfg.separacion.modelos_descargados).toContain('rapido')
    expect((await servicio.estado()).volverACalidad).toBeNull()
  })

  it('no cuenta como instalación ni como trabajo: instalando() sigue en false', async () => {
    const { servicio, gestor } = preparar(rapidoActivo)
    let seguir!: () => void
    gestor.descargarModelo.mockImplementationOnce(() => new Promise<void>((r) => (seguir = r)))
    const p = servicio.volverACalidad()
    expect(servicio.instalando()).toBe(false)
    seguir()
    await p
  })

  it('una segunda llamada recibe la misma promesa', async () => {
    const { servicio, gestor } = preparar(rapidoActivo)
    let seguir!: () => void
    gestor.descargarModelo.mockImplementationOnce(() => new Promise<void>((r) => (seguir = r)))
    const a = servicio.volverACalidad()
    expect(servicio.volverACalidad()).toBe(a)
    seguir()
    await a
    expect(gestor.descargarModelo).toHaveBeenCalledOnce()
  })

  it('fallo de verificación: sigue en rápido, devuelve el error y lo deja en el estado', async () => {
    const { servicio, cfg, gestor } = preparar(rapidoActivo)
    gestor.descargarModelo.mockRejectedValueOnce(
      Object.assign(new Error('no coincide'), { codigo: 'VERIFICACION_FALLIDA' })
    )
    await expect(servicio.volverACalidad()).rejects.toMatchObject({
      codigo: 'VERIFICACION_FALLIDA'
    })
    expect(cfg.separacion.modo).toBe('rapido')
    expect((await servicio.estado()).volverACalidad).toMatchObject({
      estado: 'error',
      error: { codigo: 'VERIFICACION_FALLIDA' }
    })
    // El siguiente intento vuelve a empezar.
    await servicio.volverACalidad()
    expect(cfg.separacion.modo).toBe('calidad')
    expect((await servicio.estado()).volverACalidad).toBeNull()
  })

  it('cancelación: aborta la descarga, no cambia el modo y limpia el estado', async () => {
    const { servicio, cfg, gestor } = preparar(rapidoActivo)
    gestor.descargarModelo.mockImplementationOnce(
      (_id, señal) =>
        new Promise<void>((_r, rechazar) =>
          señal?.addEventListener('abort', () =>
            rechazar(Object.assign(new Error('cancelada'), { codigo: 'CANCELADO' }))
          )
        )
    )
    const p = servicio.volverACalidad()
    servicio.cancelarVolverACalidad()
    await expect(p).rejects.toMatchObject({ codigo: 'CANCELADO' })
    expect(cfg.separacion.modo).toBe('rapido')
    expect((await servicio.estado()).volverACalidad).toBeNull()
  })

  it('cerrar() aborta la descarga sin preguntar', async () => {
    const { servicio, gestor } = preparar(rapidoActivo)
    let señalVista: AbortSignal | undefined
    gestor.descargarModelo.mockImplementationOnce((_id, señal) => {
      señalVista = señal
      return new Promise<void>(() => undefined)
    })
    void servicio.volverACalidad()
    servicio.cerrar()
    expect(señalVista?.aborted).toBe(true)
  })
})

describe('ocultarRutas', () => {
  it('sustituye datos, carpeta personal y rutas de usuario de Windows', () => {
    const t = ocultarRutas(
      'a C:\\Users\\Ana\\x\\y.txt b /home/ana/z c D:\\Datos\\runtime\\v d /usr/bin/uv',
      'D:\\Datos',
      '/home/ana'
    )
    expect(t).toBe('a <datos> b <datos> c <datos> d /usr/bin/uv')
  })
})
