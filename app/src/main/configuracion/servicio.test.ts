import { mkdtemp, readFile, rm, stat, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorDatosInvalidos, estiloPredeterminado, type Config } from '../../shared'
import { RegistroArchivo, type RegistroApp } from '../registro'
import { asegurarEstructuraDatos } from './estructura'
import { modoSeparacionEfectivo, ServicioConfig } from './servicio'

let datos: string
beforeEach(async () => {
  datos = await mkdtemp(join(tmpdir(), 'shinobi-cfg-'))
})
afterEach(async () => {
  await rm(datos, { recursive: true, force: true })
})

const leerConfigDisco = async (): Promise<Config> =>
  JSON.parse(await readFile(join(datos, 'config.json'), 'utf8')) as Config

describe('estructura de datos', () => {
  it('crea las carpetas del ADR 0006 y es idempotente', async () => {
    const nuevo = join(datos, 'x')
    await asegurarEstructuraDatos(nuevo)
    await asegurarEstructuraDatos(nuevo)
    for (const d of ['biblioteca', 'biblioteca/.importando', 'modelos', 'registros', 'runtime']) {
      expect((await stat(join(nuevo, d))).isDirectory()).toBe(true)
    }
  })
})

describe('ServicioConfig', () => {
  it('crea config.json con los valores por defecto', async () => {
    const s = await ServicioConfig.abrir(datos)
    const c = await leerConfigDisco()
    expect(c.instalacion.estado).toBe('pendiente')
    expect(c.separacion.modo).toBe('automatico')
    expect(c.reproductor.volumen).toBe(0.8)
    expect(c.estilo_predeterminado).toEqual(estiloPredeterminado())
    expect(s.obtener()).toEqual(c)
    expect((await stat(join(datos, 'biblioteca', '.importando'))).isDirectory()).toBe(true)
  })

  it('lectura tolerante: completa campos ausentes y conserva los presentes', async () => {
    await writeFile(
      join(datos, 'config.json'),
      JSON.stringify({
        esquema: 1,
        instalacion: { estado: 'completa' },
        reproductor: { volumen: 0.3 }
      })
    )
    const s = await ServicioConfig.abrir(datos)
    const c = s.obtener()
    expect(c.instalacion.estado).toBe('completa')
    expect(c.instalacion.fases.motor).toBe('pendiente')
    expect(c.reproductor).toEqual({ volumen: 0.3, silenciado: false })
    expect(c.separacion.modo).toBe('automatico')
  })

  it('actualización parcial: fusiona en profundidad, escribe y devuelve el resultado', async () => {
    const s = await ServicioConfig.abrir(datos)
    const r = await s.actualizar({ reproductor: { volumen: 0.5 }, separacion: { modo: 'calidad' } })
    expect(r.reproductor).toEqual({ volumen: 0.5, silenciado: false })
    expect(r.separacion.modo).toBe('calidad')
    expect(r.instalacion.estado).toBe('pendiente')
    expect(await leerConfigDisco()).toEqual(r)
    // Una instancia nueva ve lo escrito.
    expect((await ServicioConfig.abrir(datos)).obtener()).toEqual(r)
  })

  it('rechaza valores inválidos sin cambiar nada', async () => {
    const s = await ServicioConfig.abrir(datos)
    const antes = s.obtener()
    await expect(s.actualizar({ reproductor: { volumen: 2 } })).rejects.toBeInstanceOf(
      ErrorDatosInvalidos
    )
    expect(s.obtener()).toEqual(antes)
    expect(await leerConfigDisco()).toEqual(antes)
    // La cola sigue funcionando tras un rechazo.
    await s.actualizar({ reproductor: { volumen: 0.1 } })
    expect(s.obtener().reproductor.volumen).toBe(0.1)
  })

  it('suscribir notifica cada cambio y permite darse de baja', async () => {
    const s = await ServicioConfig.abrir(datos)
    const cb = vi.fn()
    const baja = s.suscribir(cb)
    await s.actualizar({ reproductor: { silenciado: true } })
    expect(cb).toHaveBeenCalledTimes(1)
    expect((cb.mock.calls[0]?.[0] as Config).reproductor.silenciado).toBe(true)
    baja()
    await s.actualizar({ reproductor: { silenciado: false } })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('no notifica si la actualización es inválida; un oyente que falla no rompe', async () => {
    const mensajes: string[] = []
    const registro: RegistroApp = { escribir: (_n, _m, msg) => void mensajes.push(msg) }
    const s = await ServicioConfig.abrir(datos, { registro })
    const cb = vi.fn()
    s.suscribir(() => {
      throw new Error('boom')
    })
    s.suscribir(cb)
    await expect(s.actualizar({ reproductor: { volumen: -1 } })).rejects.toThrow()
    expect(cb).not.toHaveBeenCalled()
    await s.actualizar({ reproductor: { volumen: 0.2 } })
    expect(cb).toHaveBeenCalledTimes(1)
    expect(mensajes.some((m) => m.includes('boom'))).toBe(true)
  })

  it('actualizaciones concurrentes se aplican en orden', async () => {
    const s = await ServicioConfig.abrir(datos)
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => s.actualizar({ reproductor: { volumen: i / 20 } }))
    )
    expect(s.obtener().reproductor.volumen).toBe(19 / 20)
    expect((await leerConfigDisco()).reproductor.volumen).toBe(19 / 20)
  })

  it('config.json ilegible sin copia: se aparta y se parte de los valores por defecto', async () => {
    await writeFile(join(datos, 'config.json'), '{ no es json')
    const s = await ServicioConfig.abrir(datos)
    expect(s.obtener().separacion.modo).toBe('automatico')
    expect(await readdir(datos)).toContain('config.json.danado')
  })

  it('obtener devuelve una copia que no altera el estado interno', async () => {
    const s = await ServicioConfig.abrir(datos)
    s.obtener().reproductor.volumen = 0
    expect(s.obtener().reproductor.volumen).toBe(0.8)
  })
})

describe('modoSeparacionEfectivo', () => {
  it('respeta un modo explícito', async () => {
    const s = await ServicioConfig.abrir(datos)
    await s.actualizar({ separacion: { modo: 'rapido' }, instalacion: { perfil_hardware: 'cuda' } })
    expect(s.modoSeparacionEfectivo()).toBe('rapido')
  })
  it('automático: cuda/mps → calidad; cpu y sin perfil → rapido', async () => {
    const s = await ServicioConfig.abrir(datos)
    expect(s.modoSeparacionEfectivo()).toBe('rapido')
    for (const [perfil, esperado] of [
      ['cuda', 'calidad'],
      ['mps', 'calidad'],
      ['cpu', 'rapido']
    ] as const) {
      await s.actualizar({ instalacion: { perfil_hardware: perfil } })
      expect(s.modoSeparacionEfectivo()).toBe(esperado)
      expect(modoSeparacionEfectivo(s.obtener())).toBe(esperado)
    }
  })
})

describe('RegistroArchivo', () => {
  it('escribe nivel, fecha y módulo', async () => {
    const r = new RegistroArchivo(join(datos, 'registros'), () => new Date('2026-11-04T10:00:00Z'))
    r.escribir('info', 'prueba', 'hola\nmundo')
    const t = await readFile(join(datos, 'registros', 'app.log'), 'utf8')
    expect(t).toBe('2026-11-04T10:00:00.000Z [INFO] [prueba] hola ⏎ mundo\n')
  })

  it('rota a app.1.log y app.2.log y conserva solo 3 archivos', async () => {
    const dir = join(datos, 'registros')
    const r = new RegistroArchivo(dir, () => new Date(0), 100)
    for (let i = 0; i < 40; i++) r.escribir('info', 'm', `linea ${i} ${'x'.repeat(30)}`)
    const nombres = (await readdir(dir)).sort()
    expect(nombres).toEqual(['app.1.log', 'app.2.log', 'app.log'])
    expect(await readFile(join(dir, 'app.log'), 'utf8')).toContain('linea 39')
  })

  it('no lanza si el directorio no es escribible', () => {
    const r = new RegistroArchivo(join(datos, 'config-no-existe', '\0'))
    expect(() => r.escribir('error', 'm', 'x')).not.toThrow()
  })
})
