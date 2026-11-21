import { describe, expect, it } from 'vitest'
import { letraAMediasUnaSinInicio, letra, linea, lista, idDePrueba } from './__fixtures__'
import { entradaCargarDePrueba, resumenDePrueba } from './__fixtures__/fase5'
import { CANALES } from './canales'
import { cancionSchema, modalidadEfectiva } from './cancion'
import { configSchema } from './config'
import { motivosParaNoEstarLetraLista, puedeMarcarseLetraLista } from './derivados'
import { ESPERA_LEGADA } from './espera'
import {
  CONTRATO,
  configParcialRendererSchema,
  resumenCancionSchema,
  seleccionAparienciaSchema
} from './ipc'
import { entradaCargarIpcSchema } from './sesion'
import { aparienciaSchema } from './temas'

describe('modalidad (0201)', () => {
  it('sin modalidad vale karaoke; con borrador también', () => {
    const c = lista()
    expect(cancionSchema.safeParse(c).success).toBe(true)
    expect(modalidadEfectiva(c)).toBe('karaoke')
    expect(modalidadEfectiva({ ...c, modalidad: 'letra_lista' })).toBe('letra_lista')
    expect(modalidadEfectiva({ ...c, estado: 'borrador', modalidad: 'letra_lista' })).toBe(
      'karaoke'
    )
    expect(cancionSchema.safeParse({ ...c, modalidad: 'otra' }).success).toBe(false)
  })
})

describe('aparienciaSchema.reemplazos (0201)', () => {
  const espera = { ...ESPERA_LEGADA, cuenta: true }
  it('admite espera con tema y heredar', () => {
    expect(aparienciaSchema.safeParse({ modo: 'heredar', reemplazos: { espera } }).success).toBe(
      true
    )
    expect(
      aparienciaSchema.safeParse({ modo: 'tema', tema_id: idDePrueba(1), reemplazos: { espera } })
        .success
    ).toBe(true)
  })
  it('rechaza propio y claves fuera de la lista blanca', () => {
    expect(aparienciaSchema.safeParse({ modo: 'propio', reemplazos: { espera } }).success).toBe(
      false
    )
    expect(aparienciaSchema.safeParse({ modo: 'heredar', reemplazos: { fondo: 1 } }).success).toBe(
      false
    )
  })
})

describe('motivosParaNoEstarLetraLista (0201)', () => {
  it('una letra sincronizada no da motivos', () => {
    expect(motivosParaNoEstarLetraLista(lista())).toEqual([])
    expect(puedeMarcarseLetraLista(lista())).toBe(true)
  })
  it('una línea sin inicio da LINEAS_SIN_INICIO con su número', () => {
    const m = motivosParaNoEstarLetraLista(letraAMediasUnaSinInicio())
    expect(m.find((x) => x.codigo === 'LINEAS_SIN_INICIO')?.lineas).toEqual([4])
  })
  it('un fin fijado que pasa del siguiente inicio da FIN_NO_VALIDO', () => {
    const c = lista()
    c.letra = letra([linea('a', 'uno', 1000, { fin_ms: 5000 }), linea('b', 'dos', 3000)])
    expect(motivosParaNoEstarLetraLista(c)).toEqual([
      expect.objectContaining({ codigo: 'FIN_NO_VALIDO', lineas: [1] })
    ])
  })
})

describe('config.editor.omitir_aviso_letra_lista (0201)', () => {
  it('lectura tolerante', () => {
    const leer = (v: unknown): boolean =>
      configSchema.parse({ editor: { omitir_aviso_letra_lista: v } }).editor
        .omitir_aviso_letra_lista
    expect(configSchema.parse({}).editor.omitir_aviso_letra_lista).toBe(false)
    expect(leer('x')).toBe(false)
    expect(leer(true)).toBe(true)
  })
  it('el renderer solo admite booleanos', () => {
    const ok = (v: unknown): boolean =>
      configParcialRendererSchema.safeParse({ editor: { omitir_aviso_letra_lista: v } }).success
    expect(ok('x')).toBe(false)
    expect(ok(true)).toBe(true)
  })
})

describe('contrato IPC de la fase 5 (0201)', () => {
  const marcar = CONTRATO[CANALES.biblioteca.marcarLista].args
  it('marcarLista admite [id] y modalidad; rechaza desconocidas y claves extra', () => {
    expect(marcar.safeParse(['c']).success).toBe(true)
    expect(marcar.safeParse(['c', { modalidad: 'letra_lista' }]).success).toBe(true)
    expect(marcar.safeParse(['c', { modalidad: 'otra' }]).success).toBe(false)
    expect(marcar.safeParse(['c', { modalidad: 'karaoke', x: 1 }]).success).toBe(false)
  })
  it('guardarApariencia admite reemplazos ausentes, null u objeto', () => {
    const ok = (v: unknown): boolean => seleccionAparienciaSchema.safeParse(v).success
    expect(ok({ modo: 'heredar' })).toBe(true)
    expect(ok({ modo: 'heredar', reemplazos: null })).toBe(true)
    expect(ok({ modo: 'heredar', reemplazos: { espera: ESPERA_LEGADA } })).toBe(true)
    expect(ok({ modo: 'tema', temaId: idDePrueba(1), reemplazos: { x: 1 } })).toBe(false)
  })
  it('los dobles cumplen sus esquemas', () => {
    expect(resumenCancionSchema.safeParse(resumenDePrueba()).success).toBe(true)
    expect(entradaCargarIpcSchema.safeParse(entradaCargarDePrueba()).success).toBe(true)
  })
})
