import { describe, expect, it } from 'vitest'
import { letra, linea } from '@shared/__fixtures__'
import { estiloPredeterminado } from '@shared/estilo'
import {
  aparienciaPropia,
  aSeleccionIpc,
  borradorModificado,
  estadoInicial,
  puedeDeshacer,
  puedeRehacer,
  reducirEditor
} from './estado'

describe('apariencia y borrador de tema (0170, 0171)', () => {
  const TEMA = '0b9f7a4e-3c1d-4f6a-9d2e-5a8b1c7e4f30'
  const OTRO = '5d2c8f10-7b3a-4e1d-8c6f-2a9e0b4d7c11'
  const base = estiloPredeterminado()
  const otro = { ...base, fondo: { tipo: 'solido' as const, color: '#101010' } }
  const inicial = () =>
    estadoInicial(
      { letra: letra([linea('a', 'Uno', 1000)]), apariencia: aparienciaPropia(base) },
      'a'
    )
  const asignar = (e: ReturnType<typeof inicial>, temaId: string, ahora: number) =>
    reducirEditor(e, {
      tipo: 'apariencia',
      apariencia: { seleccion: { modo: 'tema', temaId }, estilo: base },
      clave: 'tema',
      ahora
    })

  it('cada cambio de selección es un paso aunque ocurra en menos de 1 s, y se deshace', () => {
    let e = asignar(inicial(), TEMA, 0)
    e = asignar(e, OTRO, 10)
    expect(e.pasado).toHaveLength(2)
    expect(aSeleccionIpc(e.actual.apariencia)).toEqual({ modo: 'tema', temaId: OTRO })
    e = reducirEditor(e, { tipo: 'deshacer' })
    expect(aSeleccionIpc(e.actual.apariencia)).toEqual({ modo: 'tema', temaId: TEMA })
    e = reducirEditor(e, { tipo: 'deshacer' })
    expect(aSeleccionIpc(e.actual.apariencia)).toEqual({ modo: 'propio', estilo: base })
  })

  it('una selección idéntica no añade pasos y el estilo solo se edita con estilo propio', () => {
    const e = asignar(inicial(), TEMA, 0)
    expect(asignar(e, TEMA, 5)).toBe(e)
    expect(reducirEditor(e, { tipo: 'estilo', estilo: otro, clave: 'x', ahora: 9 })).toBe(e)
  })

  it('D3: los pasos del borrador se recorren solo dentro del borrador y se retiran al salir', () => {
    let e = asignar(inicial(), TEMA, 0)
    const antes = e.pasado.length
    e = reducirEditor(e, {
      tipo: 'entrar_borrador',
      borrador: { temaId: TEMA, nombre: 'Sol', revision: 1, base, estilo: base }
    })
    expect(e.pasado).toHaveLength(antes)
    expect(puedeDeshacer(e)).toBe(false)
    expect(reducirEditor(e, { tipo: 'deshacer' })).toBe(e)
    e = reducirEditor(e, { tipo: 'estilo_borrador', estilo: otro, clave: 'fondo', ahora: 10 })
    expect(borradorModificado(e.actual.borrador)).toBe(true)
    expect(e.actual.apariencia.estilo).toBe(base)
    expect(puedeDeshacer(e)).toBe(true)
    e = reducirEditor(e, { tipo: 'deshacer' })
    expect(borradorModificado(e.actual.borrador)).toBe(false)
    expect(puedeRehacer(e)).toBe(true)
    e = reducirEditor(e, { tipo: 'rehacer' })
    e = reducirEditor(e, { tipo: 'salir_borrador' })
    expect(e.actual.borrador).toBeNull()
    expect(e.pasado).toHaveLength(antes)
    expect(e.futuro).toHaveLength(0)
    expect(puedeRehacer(e)).toBe(false)
  })

  it('T20: eliminar un tema retira los pasos que lo asignarían y conserva el resto', () => {
    let e = asignar(inicial(), TEMA, 0)
    e = reducirEditor(e, { tipo: 'ajustar_inicio', deltaMs: 10, ahora: 5000 })
    e = asignar(e, OTRO, 6000)
    e = reducirEditor(e, { tipo: 'deshacer' })
    e = reducirEditor(e, { tipo: 'tema_eliminado', temaId: TEMA, estilo: base })
    expect(aSeleccionIpc(e.actual.apariencia)).toEqual({ modo: 'propio', estilo: base })
    expect(e.pasado.some((p) => p.antes.apariencia.seleccion.modo === 'tema')).toBe(false)
    expect(e.pasado.some((p) => p.clave.startsWith('inicio:'))).toBe(true)
    // Ningún paso restante vuelve a vincular la canción al tema borrado.
    while (puedeDeshacer(e)) {
      e = reducirEditor(e, { tipo: 'deshacer' })
      expect(e.actual.apariencia.seleccion).not.toEqual({ modo: 'tema', temaId: TEMA })
    }
    while (puedeRehacer(e)) {
      e = reducirEditor(e, { tipo: 'rehacer' })
      expect(e.actual.apariencia.seleccion).not.toEqual({ modo: 'tema', temaId: TEMA })
    }
  })
})
