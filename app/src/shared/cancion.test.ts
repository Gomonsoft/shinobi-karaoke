import { describe, expect, it } from 'vitest'
import { cancionSchema, resumirErroresZod } from './cancion'
import { FIXTURES, conError, lista, listaConPalabras } from './__fixtures__'

describe('cancionSchema', () => {
  it.each(Object.entries(FIXTURES))('la fixture %s es válida', (_nombre, f) => {
    const r = cancionSchema.safeParse(f())
    expect(r.error?.issues).toBeUndefined()
    expect(r.success).toBe(true)
  })

  it('las fixtures son independientes entre llamadas', () => {
    const a = lista()
    a.letra!.lineas[0]!.texto = 'cambiado'
    expect(lista().letra!.lineas[0]!.texto).not.toBe('cambiado')
  })

  it('acepta el ejemplo del ADR 0006 con palabras', () => {
    expect(cancionSchema.safeParse(listaConPalabras()).success).toBe(true)
  })

  it('rechaza esquema distinto de 1', () => {
    expect(cancionSchema.safeParse({ ...lista(), esquema: 2 }).success).toBe(false)
  })

  it('rechaza estados, fechas y tipos inválidos', () => {
    expect(cancionSchema.safeParse({ ...lista(), estado: 'otra' }).success).toBe(false)
    expect(cancionSchema.safeParse({ ...lista(), creada: 'ayer' }).success).toBe(false)
    expect(
      cancionSchema.safeParse({ ...lista(), fuente: { ...lista().fuente, tipo: 'cd' } }).success
    ).toBe(false)
    const c = lista()
    c.pasos.fuente.estado = 'raro' as never
    expect(cancionSchema.safeParse(c).success).toBe(false)
  })

  it('acepta pistas y letra null, pero no ausentes', () => {
    const c = lista()
    expect(cancionSchema.safeParse({ ...c, pistas: null, letra: null }).success).toBe(true)
    const sinPistas: Record<string, unknown> = { ...c }
    delete sinPistas.pistas
    expect(cancionSchema.safeParse(sinPistas).success).toBe(false)
  })

  it('error de paso conserva código y mensaje; tolera códigos desconocidos', () => {
    const r = cancionSchema.parse(conError())
    expect(r.pasos.separacion.error).toEqual({
      codigo: 'MEMORIA_INSUFICIENTE',
      mensaje: 'Sin memoria durante la separación'
    })
    const c = conError()
    c.pasos.separacion.error = { codigo: 'ALGO_NUEVO', mensaje: 'x' }
    expect(cancionSchema.safeParse(c).success).toBe(true)
  })

  it('valida el progreso 0–1', () => {
    const c = lista()
    c.pasos.separacion.progreso = 1.2
    expect(cancionSchema.safeParse(c).success).toBe(false)
  })

  it('propaga los invariantes de la letra con mensaje comprensible', () => {
    const c = lista()
    c.letra!.lineas[1]!.inicio_ms = 1000
    const r = cancionSchema.safeParse(c)
    expect(r.success).toBe(false)
    if (!r.success) expect(resumirErroresZod(r.error)).toMatch(/letra\.lineas: La línea 2/)
  })

  it('resumirErroresZod sin ruta', () => {
    const r = cancionSchema.safeParse(null)
    expect(r.success).toBe(false)
    if (!r.success) expect(resumirErroresZod(r.error)).toBeTruthy()
  })
})
