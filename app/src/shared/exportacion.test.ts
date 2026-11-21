import { describe, expect, it } from 'vitest'
import {
  FORMATOS,
  MEMORIA_MINIMA,
  combinaciones,
  esCombinacionValida,
  estimarBytes,
  estimarSegundos,
  memoriaMinimaDe,
  nombrePropuesto,
  parametrosDe,
  perfilCompatibleConSesion,
  tiempoDeFotograma,
  totalFotogramas
} from './exportacion'

describe('catálogo', () => {
  it('da 48 combinaciones únicas, pares y dentro de los techos de 0050', () => {
    const todas = combinaciones()
    expect(todas).toHaveLength(48)
    expect(new Set(todas.map((c) => JSON.stringify(c))).size).toBe(48)
    for (const c of todas) {
      expect(c.ancho % 2).toBe(0)
      expect(c.alto % 2).toBe(0)
      expect(c.alto).toBeLessThanOrEqual(2160)
      expect(c.ancho).toBeLessThanOrEqual(c.proporcion === '16:9' ? 3840 : 2880)
      expect(esCombinacionValida(c)).toBe(true)
    }
  })

  it('rechaza resoluciones, FPS o formatos fuera del catálogo', () => {
    const ok = { formato: 'mkv_av1' as const, ancho: 1920, alto: 1080, fps: 30 }
    expect(esCombinacionValida(ok)).toBe(true)
    expect(esCombinacionValida({ ...ok, ancho: 1921 })).toBe(false)
    expect(esCombinacionValida({ ...ok, fps: 25 })).toBe(false)
    expect(esCombinacionValida({ ...ok, formato: 'mp4' as never })).toBe(false)
  })

  it('los formatos y los parámetros siguen el ADR 0019 §5', () => {
    expect(FORMATOS.mkv_av1.extension).toBe('mkv')
    expect(parametrosDe('mkv_av1', 480)).toEqual({ preset: 8, crf: 32 })
    expect(parametrosDe('mkv_av1', 1200)).toEqual({ preset: 8, crf: 32 })
    expect(parametrosDe('mkv_av1', 1440)).toEqual({ preset: 8, crf: 34 })
    expect(parametrosDe('mkv_av1', 2160)).toEqual({ preset: 10, crf: 35 })
    expect(parametrosDe('webm_vp9', 1080)).toEqual({ cpu_used: 8, crf: 32 })
    expect(parametrosDe('webm_vp9', 1440)).toEqual({ cpu_used: 8, crf: 33 })
    expect(parametrosDe('webm_vp9', 2160)).toEqual({ cpu_used: 8, crf: 34 })
  })

  it('solo las resoluciones de 2160 líneas piden 7 GiB', () => {
    expect(Object.keys(MEMORIA_MINIMA)).toHaveLength(8)
    expect(memoriaMinimaDe(3840, 2160)).toBe(7 * 1024 ** 3)
    expect(memoriaMinimaDe(2880, 2160)).toBe(7 * 1024 ** 3)
    expect(memoriaMinimaDe(2560, 1440)).toBeNull()
  })

  it('no bloquea ningún perfil con la sesión por ahora', () => {
    for (const c of combinaciones()) {
      for (const so of ['win32', 'darwin', 'linux']) {
        expect(perfilCompatibleConSesion(c, so)).toBe(true)
      }
    }
  })
})

describe('estimaciones', () => {
  const base = { formato: 'mkv_av1' as const, alto: 1080, fps: 30, duracionMs: 240_000 }

  it('tamaño: (video + 1,44) × minutos × 1,3', () => {
    // (3 + 1,44) × 4 × 1,3 = 23,088 MB
    expect(estimarBytes(base)).toBe(23_088_000)
    const caro = estimarBytes({ ...base, fps: 60, fondoMovil: true, formato: 'webm_vp9' })
    expect(caro).toBe(Math.round((3 * 1.3 * 1.5 * 1.3 + 1.44) * 4 * 1.3 * 1e6))
    expect(estimarBytes({ ...base, alto: 480 })).toBeLessThan(estimarBytes(base))
    expect(estimarBytes({ ...base, alto: 2160 })).toBeGreaterThan(estimarBytes(base))
  })

  it('tiempo: factor por línea × duración × corrección, doble a 60 FPS y VP9 × 1,2', () => {
    expect(estimarSegundos({ ...base, alto: 768 })).toBe(144)
    expect(estimarSegundos(base)).toBe(288)
    expect(estimarSegundos({ ...base, alto: 1440 })).toBe(480)
    expect(estimarSegundos({ ...base, alto: 2160 })).toBe(1440)
    expect(estimarSegundos({ ...base, fps: 60 })).toBe(576)
    expect(estimarSegundos({ ...base, formato: 'webm_vp9' })).toBe(346)
    expect(estimarSegundos({ ...base, factorCorrector: 2 })).toBe(576)
  })

  it('acota el factor corrector entre 0,25 y 8', () => {
    expect(estimarSegundos({ ...base, factorCorrector: 100 })).toBe(288 * 8)
    expect(estimarSegundos({ ...base, factorCorrector: 0 })).toBe(72)
    expect(estimarSegundos({ ...base, factorCorrector: NaN })).toBe(288)
  })
})

describe('nombrePropuesto', () => {
  it('compone título, artista y extensión', () => {
    expect(nombrePropuesto('Mi canción', 'Ella', 'mkv')).toBe('Mi canción — Ella (karaoke).mkv')
    expect(nombrePropuesto('Mi canción', 'Ella', '.webm')).toBe('Mi canción — Ella (karaoke).webm')
  })

  it('sin artista omite su parte', () => {
    expect(nombrePropuesto('Mi canción', '  ', 'mkv')).toBe('Mi canción (karaoke).mkv')
  })

  it('sustituye caracteres prohibidos y de control', () => {
    expect(nombrePropuesto('AC/DC: "Hey?"', 'x\ty', 'mkv')).toBe(
      'AC-DC- -Hey-- — x-y (karaoke).mkv'
    )
    expect(nombrePropuesto('<a>|b*\\', '', 'mkv')).toBe('-a--b-- (karaoke).mkv')
  })

  it('recorta puntos y espacios finales y limita a 120 caracteres antes de la extensión', () => {
    expect(nombrePropuesto('a'.repeat(300), '', 'mkv')).toBe(`${'a'.repeat(120)}.mkv`)
    // El corte cae justo tras un punto y un espacio: se recortan también.
    expect(nombrePropuesto(`${'b'.repeat(118)}. más texto`, '', 'mkv')).toBe(
      `${'b'.repeat(118)}.mkv`
    )
    expect(nombrePropuesto('Título...', '', 'mkv')).toBe('Título... (karaoke).mkv')
  })

  it('un título vacío no deja un nombre vacío', () => {
    expect(nombrePropuesto('', '', 'webm')).toBe('Sin título (karaoke).webm')
  })
})

describe('fotogramas', () => {
  it('N = ceil(duración × fps / 1000)', () => {
    expect(totalFotogramas(40_000, 30)).toBe(1200)
    expect(totalFotogramas(40_001, 30)).toBe(1201)
    expect(totalFotogramas(1000, 24)).toBe(24)
    expect(totalFotogramas(215_000, 60)).toBe(12_900)
  })

  it('el instante del fotograma n es n × 1000 / fps', () => {
    expect(tiempoDeFotograma(0, 30)).toBe(0)
    expect(tiempoDeFotograma(30, 30)).toBe(1000)
    expect(tiempoDeFotograma(1, 24)).toBeCloseTo(41.6667, 3)
  })
})
