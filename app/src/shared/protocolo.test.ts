import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CODIGOS_ERROR, CODIGOS_SOLO_MAIN, esCodigoError } from './errores'
import {
  parsearLineaWorker,
  resultadoDescargarYoutubeSchema,
  resultadoDiagnosticoSchema,
  resultadoImportarArchivoSchema,
  resultadoInfoYoutubeSchema
} from './protocolo'

describe('protocolo JSON Lines', () => {
  it.each([
    [
      'progreso',
      '{"tipo":"progreso","fase":"descargando","valor":0.37,"detalle":{"bytes":1,"total":3}}'
    ],
    ['progreso indeterminado', '{"tipo":"progreso","fase":"cargando_modelo","valor":null}'],
    ['log', '{"tipo":"log","nivel":"info","mensaje":"hola"}'],
    ['resultado', '{"tipo":"resultado","datos":{"voz":"pistas/voz.flac"}}'],
    ['error', '{"tipo":"error","codigo":"MEMORIA_INSUFICIENTE","mensaje":"x","reintentable":true}']
  ])('acepta %s', (_n, linea) => {
    expect(parsearLineaWorker(linea).ok).toBe(true)
  })

  it('error sin reintentable → false', () => {
    const r = parsearLineaWorker('{"tipo":"error","codigo":"X","mensaje":"m"}')
    expect(r.ok && r.mensaje.tipo === 'error' && r.mensaje.reintentable).toBe(false)
  })

  it.each([
    ['no JSON', 'esto no es json'],
    ['tipo desconocido', '{"tipo":"otro"}'],
    ['valor fuera de rango', '{"tipo":"progreso","fase":"a","valor":1.5}'],
    ['nivel de log desconocido', '{"tipo":"log","nivel":"grito","mensaje":"x"}'],
    ['resultado sin datos', '{"tipo":"resultado"}'],
    ['error sin código', '{"tipo":"error","mensaje":"x"}']
  ])('rechaza %s sin lanzar', (_n, linea) => {
    const r = parsearLineaWorker(linea)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBeTruthy()
  })
})

describe('catálogo de errores', () => {
  it('incluye los códigos de arquitectura.md y los técnicos', () => {
    for (const c of [
      'SIN_CONEXION',
      'SIN_ESPACIO',
      'FORMATO_NO_SOPORTADO',
      'AUDIO_DEMASIADO_CORTO',
      'URL_NO_VALIDA',
      'URL_NO_SOPORTADA',
      'VIDEO_NO_DISPONIBLE',
      'YOUTUBE_BLOQUEADO',
      'MEMORIA_INSUFICIENTE',
      'MODELO_NO_DISPONIBLE',
      'LETRA_NO_ENCONTRADA',
      'INSTRUMENTAL',
      'SERVICIO_NO_DISPONIBLE',
      'ARGUMENTOS_NO_VALIDOS',
      'ERROR_INTERNO',
      'VERIFICACION_FALLIDA',
      'PLATAFORMA_NO_SOPORTADA',
      'DEMO_FALLO'
    ]) {
      expect(CODIGOS_ERROR).toContain(c)
    }
    expect(new Set(CODIGOS_ERROR).size).toBe(CODIGOS_ERROR.length)
  })
  it('coincide con CODIGOS_ERROR de worker/shinobi_worker/errores.py', () => {
    const py = readFileSync(join(__dirname, '../../../worker/shinobi_worker/errores.py'), 'utf-8')
    const bloque = /CODIGOS_ERROR\s*=\s*\(([^)]*)\)/.exec(py)?.[1] ?? ''
    const codigosPy = [...bloque.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1])
    expect(codigosPy.length).toBeGreaterThan(0)
    const delWorker = CODIGOS_ERROR.filter(
      (c) => !(CODIGOS_SOLO_MAIN as readonly string[]).includes(c)
    )
    expect([...codigosPy].sort()).toEqual([...delWorker].sort())
  })
  it('esCodigoError', () => {
    expect(esCodigoError('SIN_CONEXION')).toBe(true)
    expect(esCodigoError('NOPE')).toBe(false)
    expect(esCodigoError(3)).toBe(false)
  })
})

describe('resultados de la Fase 2', () => {
  const importar = {
    duracion_ms: 215000,
    metadatos: { titulo: 'Canción', artista: 'Artista', album: '' },
    ganancia_db: 4.2,
    lufs: -20.2,
    nombre_original: 'cancion.mp3',
    mezcla: 'fuente/mezcla.flac'
  }
  it('importar-archivo', () => {
    expect(resultadoImportarArchivoSchema.safeParse(importar).success).toBe(true)
    expect(resultadoImportarArchivoSchema.safeParse({ ...importar, lufs: null }).success).toBe(true)
    expect(resultadoImportarArchivoSchema.safeParse({ ...importar, ganancia_db: 25 }).success).toBe(
      false
    )
    expect(
      resultadoImportarArchivoSchema.safeParse({ ...importar, duracion_ms: 1.5 }).success
    ).toBe(false)
    const sinMezcla: Record<string, unknown> = { ...importar }
    delete sinMezcla.mezcla
    expect(resultadoImportarArchivoSchema.safeParse(sinMezcla).success).toBe(false)
  })
  it('descargar-youtube exige bytes_descargados', () => {
    expect(resultadoDescargarYoutubeSchema.safeParse(importar).success).toBe(false)
    expect(
      resultadoDescargarYoutubeSchema.safeParse({ ...importar, bytes_descargados: 3400000 }).success
    ).toBe(true)
  })
  it('info-youtube con y sin miniatura', () => {
    const info = {
      id_video: 'dQw4w9WgXcQ',
      titulo_original: 'Artista - Canción (Official Video)',
      canal: 'ArtistaVEVO',
      duracion_s: 213,
      metadatos: { titulo: 'Canción', artista: 'Artista', album: '' }
    }
    expect(resultadoInfoYoutubeSchema.safeParse(info).success).toBe(true)
    expect(
      resultadoInfoYoutubeSchema.safeParse({ ...info, miniatura_jpeg_base64: '/9j/4AAQ' }).success
    ).toBe(true)
    expect(resultadoInfoYoutubeSchema.safeParse({ ...info, id_video: 'corto' }).success).toBe(false)
  })
  it('diagnostico', () => {
    const d = {
      perfil: 'cpu',
      dispositivo: 'cpu',
      gpu: null,
      vram_mb: null,
      motivo_rebaja: null,
      torch: null,
      onnxruntime: null
    }
    expect(resultadoDiagnosticoSchema.safeParse(d).success).toBe(true)
    expect(
      resultadoDiagnosticoSchema.safeParse({ ...d, perfil: 'cuda', motivo_rebaja: 'memoria' })
        .success
    ).toBe(true)
    expect(resultadoDiagnosticoSchema.safeParse({ ...d, motivo_rebaja: 'raro' }).success).toBe(
      false
    )
  })
})
