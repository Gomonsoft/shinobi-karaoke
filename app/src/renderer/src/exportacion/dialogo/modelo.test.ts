import { perfilesDePrueba } from '@shared/__fixtures__/exportacion'
import {
  ajustarFps,
  cambiarFormato,
  cambiarProporcion,
  causaSinPerfiles,
  equivalente,
  esCostoso,
  normalizar,
  sinPerfiles,
  type OpcionesExportacion
} from './modelo'
import { formatearTamano, formatearTiempoEstimado } from './textos'

const base: OpcionesExportacion = {
  audio: 'instrumental',
  formato: 'mkv_av1',
  ancho: 1920,
  alto: 1080,
  fps: 30
}

describe('equivalente', () => {
  it.each([
    [720, '4:3', 480],
    [1080, '4:3', 768],
    [1440, '4:3', 1200],
    [2160, '4:3', 2160],
    [480, '16:9', 720],
    [768, '16:9', 720],
    [1200, '16:9', 1080],
    [2160, '16:9', 2160]
  ] as const)('%i → %s da %i líneas', (alto, proporcion, esperado) => {
    expect(equivalente({ alto }, proporcion).alto).toBe(esperado)
  })
})

describe('perfiles no soportados', () => {
  it('baja al FPS soportado más alto que no supere al elegido', () => {
    const perfiles = perfilesDePrueba((p) => (p.alto === 2160 && p.fps === 60 ? 'memoria' : null))
    expect(ajustarFps(perfiles, 'mkv_av1', 3840, 2160, 60)).toBe(30)
    expect(ajustarFps(perfiles, 'mkv_av1', 3840, 2160, 24)).toBe(24)
  })

  it('sube al más bajo si ninguno es menor', () => {
    const perfiles = perfilesDePrueba((p) =>
      p.alto === 720 && p.fps === 24 ? 'codificador' : null
    )
    expect(ajustarFps(perfiles, 'mkv_av1', 1280, 720, 24)).toBe(30)
  })

  it('cambiar de proporción elige la resolución equivalente y corrige el FPS', () => {
    const perfiles = perfilesDePrueba((p) =>
      p.proporcion === '4:3' && p.alto === 768 && p.fps === 30 ? 'codificador' : null
    )
    const { opciones, cambio } = cambiarProporcion(perfiles, base, '4:3')
    expect(opciones).toMatchObject({ ancho: 1024, alto: 768, fps: 24 })
    expect(cambio).toEqual({
      resolucion: { ancho: 1024, alto: 768 },
      fps: { anterior: 30, nuevo: 24 }
    })
  })

  it('cambiar de formato baja la resolución si ya no está soportada a ningún FPS', () => {
    const perfiles = perfilesDePrueba((p) =>
      p.formato === 'webm_vp9' && p.alto >= 1440 && p.proporcion === '16:9' ? 'codificador' : null
    )
    const { opciones, cambio } = cambiarFormato(
      perfiles,
      { ...base, ancho: 3840, alto: 2160 },
      'webm_vp9'
    )
    expect(opciones).toMatchObject({ formato: 'webm_vp9', ancho: 1920, alto: 1080 })
    expect(cambio.resolucion).toEqual({ ancho: 1920, alto: 1080 })
  })

  it('un formato sin soporte se sustituye por el otro al normalizar las opciones recordadas', () => {
    const perfiles = perfilesDePrueba((p) => (p.formato === 'mkv_av1' ? 'codificador' : null))
    expect(normalizar(perfiles, base).opciones.formato).toBe('webm_vp9')
  })

  it('distingue la causa de la ausencia total de perfiles', () => {
    const todos = perfilesDePrueba(() => 'codificador')
    expect(sinPerfiles(todos)).toBe(true)
    expect(causaSinPerfiles(todos)).toBe('codificador')
    expect(
      causaSinPerfiles(perfilesDePrueba((p) => (p.fps === 24 ? 'memoria' : 'no_comprobado')))
    ).toBe('no_comprobado')
    expect(sinPerfiles(perfilesDePrueba())).toBe(false)
  })
})

describe('costoso y cifras', () => {
  it('marca 30 min, 4 GB o 2160 a 60 FPS', () => {
    expect(esCostoso({ alto: 1080, fps: 30 }, { bytes: 1e9, segundos: 600 })).toBe(false)
    expect(esCostoso({ alto: 1080, fps: 30 }, { bytes: 1e9, segundos: 1801 })).toBe(true)
    expect(esCostoso({ alto: 1080, fps: 30 }, { bytes: 4.1e9, segundos: 60 })).toBe(true)
    expect(esCostoso({ alto: 2160, fps: 60 }, null)).toBe(true)
  })

  it('formatea tamaños y tiempos como la spec', () => {
    expect(formatearTamano(40_400_000)).toBe('40 MB')
    expect(formatearTamano(1_440_000_000)).toBe('1,4 GB')
    expect(formatearTiempoEstimado(30)).toBe('menos de 1 minuto')
    expect(formatearTiempoEstimado(480)).toBe('unos 8 minutos')
    expect(formatearTiempoEstimado(4800)).toBe('unos 1 h 20 min')
  })
})
