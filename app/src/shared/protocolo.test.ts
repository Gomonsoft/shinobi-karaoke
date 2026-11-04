import { describe, expect, it } from 'vitest'
import { CODIGOS_ERROR, esCodigoError } from './errores'
import { parsearLineaWorker } from './protocolo'

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
      'DEMO_FALLO'
    ]) {
      expect(CODIGOS_ERROR).toContain(c)
    }
    expect(new Set(CODIGOS_ERROR).size).toBe(CODIGOS_ERROR.length)
  })
  it('esCodigoError', () => {
    expect(esCodigoError('SIN_CONEXION')).toBe(true)
    expect(esCodigoError('NOPE')).toBe(false)
    expect(esCodigoError(3)).toBe(false)
  })
})
