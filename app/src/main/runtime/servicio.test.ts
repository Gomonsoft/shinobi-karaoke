import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { configPredeterminada, manifiestoSchema, type Config } from '../../shared'
import { ocultarRutas, crearServicioRuntime } from './servicio'

const manifiesto = manifiestoSchema.parse(
  JSON.parse(readFileSync(join(__dirname, '../../../resources/runtime-manifest.json'), 'utf8'))
)

function preparar(parcial: (c: Config) => void = () => undefined) {
  const cfg = configPredeterminada()
  parcial(cfg)
  const oyentes: ((c: Config) => void)[] = []
  let instalando = false
  const gestor = {
    instalar: vi.fn(() => {
      instalando = true
      return Promise.resolve({ estado: 'completa' as const }).finally(() => (instalando = false))
    }),
    pausar: vi.fn(() => Promise.resolve()),
    instalando: () => instalando,
    suscribir: vi.fn(() => () => undefined)
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
    espacioLibre: 3,
    modoPrevisto: 'calidad' as const
  }
  const servicio = crearServicioRuntime({
    gestor,
    config: { obtener: () => cfg, suscribir: (cb) => (oyentes.push(cb), () => undefined) },
    deteccion: { requisitosPrevios: () => Promise.resolve(previos) },
    manifiesto,
    datos: '/Users/ana/datos',
    versionApp: '1.2.3',
    descripcionSo: 'Darwin 24',
    ultimasLineasRegistro: () =>
      Promise.resolve([
        'x [runtime] fallo en /Users/ana/datos/runtime/venv y /Users/ana/Música/a.wav'
      ]),
    directorioUsuario: '/Users/ana'
  })
  return { servicio, cfg, gestor, oyentes }
}

describe('servicio de runtime (0036)', () => {
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
