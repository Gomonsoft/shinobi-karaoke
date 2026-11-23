import { describe, expect, it } from 'vitest'
import { letra, linea, pausa } from '@shared/__fixtures__'
import { estiloPredeterminado } from '@shared/estilo'
import { cancionConCoros, cancionConReparto } from './fixturesApi'
import { aparienciaPropia, estadoInicial, puedeDeshacer, reducirEditor } from './estado'
import type { AccionEditor, EstadoEditor } from './estado'

const ahora = 1000
const apariencia = aparienciaPropia(estiloPredeterminado())

/** Una canción de seis líneas con una pausa en medio; la principal es `b`. */
function simple(): EstadoEditor {
  const l = letra([
    linea('a', 'Uno', 1000),
    linea('b', 'Dos', 3000),
    pausa('p'),
    linea('c', 'Tres', 6000),
    linea('d', 'Cuatro', 8000),
    linea('e', 'Cinco', 10_000)
  ])
  return estadoInicial({ letra: l, apariencia }, 'b')
}

function aplicar(e: EstadoEditor, ...acciones: AccionEditor[]): EstadoEditor {
  return acciones.reduce(reducirEditor, e)
}
const partes = (e: EstadoEditor) => e.actual.letra.lineas.map((l) => l.parte)

describe('selección múltiple', () => {
  it('Ctrl + clic añade y quita; la tocada es la principal; la última no se puede quitar', () => {
    let e = aplicar(simple(), { tipo: 'alternar_seleccion', id: 'd' })
    expect(e.seleccionadas).toEqual(['b', 'd'])
    expect(e.seleccion).toBe('d')
    e = aplicar(e, { tipo: 'alternar_seleccion', id: 'd' })
    expect(e.seleccionadas).toEqual(['b'])
    expect(e.seleccion).toBe('b')
    expect(aplicar(e, { tipo: 'alternar_seleccion', id: 'b' })).toBe(e)
  })

  it('Mayús + clic y Mayús + ↑/↓ extienden desde el ancla saltando pausas y pueden encoger', () => {
    let e = aplicar(simple(), { tipo: 'extender_seleccion', id: 'd' })
    expect(e.seleccionadas).toEqual(['b', 'c', 'd'])
    e = aplicar(e, { tipo: 'mover_seleccion', sentido: 1, extender: true })
    expect(e.seleccionadas).toEqual(['b', 'c', 'd', 'e'])
    expect(e.seleccion).toBe('e')
    e = aplicar(e, { tipo: 'mover_seleccion', sentido: -1, extender: true })
    expect(e.seleccionadas).toEqual(['b', 'c', 'd'])
    e = aplicar(e, { tipo: 'mover_seleccion', sentido: -1, extender: true })
    e = aplicar(e, { tipo: 'mover_seleccion', sentido: -1, extender: true })
    expect(e.seleccion).toBe('b')
    expect(e.seleccionadas).toEqual(['b'])
    e = aplicar(e, { tipo: 'mover_seleccion', sentido: -1, extender: true })
    expect(e.seleccionadas).toEqual(['a', 'b'])
  })

  it('una selección normal, ↑/↓ sin Mayús y el modo al ritmo dejan una sola línea', () => {
    const multiple = aplicar(simple(), { tipo: 'extender_seleccion', id: 'd' })
    expect(aplicar(multiple, { tipo: 'seleccionar', id: 'd' }).seleccionadas).toEqual(['d'])
    expect(aplicar(multiple, { tipo: 'seleccionar', id: 'b' }).seleccionadas).toEqual(['b'])
    expect(aplicar(multiple, { tipo: 'mover_seleccion', sentido: 1 }).seleccionadas).toEqual(['e'])
    expect(aplicar(multiple, { tipo: 'entrar_sync', desdeId: null }).seleccionadas).toHaveLength(1)
  })

  it('en el modo al ritmo no se puede ampliar la selección', () => {
    const ritmo = aplicar(simple(), { tipo: 'entrar_sync', desdeId: 'b' })
    expect(aplicar(ritmo, { tipo: 'alternar_seleccion', id: 'd' })).toBe(ritmo)
    expect(aplicar(ritmo, { tipo: 'extender_seleccion', id: 'd' })).toBe(ritmo)
  })

  it('Esc (solo_principal) deja la principal y no hace nada con una', () => {
    const multiple = aplicar(simple(), { tipo: 'extender_seleccion', id: 'd' })
    const una = aplicar(multiple, { tipo: 'solo_principal' })
    expect(una.seleccionadas).toEqual(['d'])
    expect(una.seleccion).toBe('d')
    expect(aplicar(una, { tipo: 'solo_principal' })).toBe(una)
  })

  it('I, O y borrar actúan solo sobre la principal', () => {
    const multiple = aplicar(simple(), { tipo: 'extender_seleccion', id: 'd' })
    const e = aplicar(multiple, { tipo: 'ajustar_inicio', deltaMs: 100, ahora })
    const inicios = e.actual.letra.lineas.map((l) => l.inicio_ms)
    expect(inicios).toEqual([1000, 3000, null, 6000, 8100, 10_000])
  })
})

describe('reparto en el reducer', () => {
  it('asignar_parte pone la parte a todas las seleccionadas en un solo paso y se deshace exacto', () => {
    const antes = aplicar(
      simple(),
      { tipo: 'anadir_cantante', ahora },
      { tipo: 'extender_seleccion', id: 'd' }
    )
    const e = aplicar(antes, { tipo: 'asignar_parte', parte: 'c2', ahora: ahora + 5000 })
    expect(partes(e)).toEqual([undefined, 'c2', undefined, 'c2', 'c2', undefined])
    expect(e.pasado).toHaveLength(antes.pasado.length + 1)
    const deshecho = aplicar(e, { tipo: 'deshacer' })
    expect(deshecho.actual.letra).toBe(antes.actual.letra)
    expect(aplicar(deshecho, { tipo: 'rehacer' }).actual.letra).toEqual(e.actual.letra)
  })

  it('asignar no toca tiempos, textos ni marcas', () => {
    const base = simple()
    const e = aplicar(base, { tipo: 'asignar_parte', parte: 'coro', ahora })
    const sinParte = (x: EstadoEditor) =>
      x.actual.letra.lineas.map((l) => ({ ...l, parte: undefined }))
    expect(sinParte(e)).toEqual(sinParte(base))
    expect(e.actual.letra.lineas[1]?.parte).toBe('coro')
  })

  it('una parte que no existe no crea paso (cantante 3 con uno solo, «todos» con uno)', () => {
    const e = simple()
    expect(aplicar(e, { tipo: 'asignar_parte', parte: 'c3', ahora })).toBe(e)
    expect(aplicar(e, { tipo: 'asignar_parte', parte: 'todos', ahora })).toBe(e)
    expect(aplicar(e, { tipo: 'asignar_parte', parte: 'c1', ahora })).toBe(e)
  })

  it('añadir un cantante con la selección lo crea y asigna en un solo paso (C1-E5)', () => {
    const base = aplicar(simple(), { tipo: 'extender_seleccion', id: 'd' })
    const e = aplicar(base, { tipo: 'anadir_cantante', asignarA: base.seleccionadas, ahora })
    expect(e.actual.letra.partes?.cantantes.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(partes(e)).toEqual([undefined, 'c2', undefined, 'c2', 'c2', undefined])
    expect(e.pasado).toHaveLength(1)
    expect(aplicar(e, { tipo: 'deshacer' }).actual.letra).toBe(base.actual.letra)
  })

  it('con 4 cantantes no se añade ninguno', () => {
    const e = aplicar(
      simple(),
      ...Array.from({ length: 3 }, () => ({ tipo: 'anadir_cantante', ahora }) as const)
    )
    expect(e.actual.letra.partes?.cantantes).toHaveLength(4)
    expect(aplicar(e, { tipo: 'anadir_cantante', ahora })).toBe(e)
  })

  it('quitar un cantante pasa sus líneas al 1; con uno solo, «todos» también, y se normaliza', () => {
    const duo = estadoInicial({ letra: cancionConReparto().letra!, apariencia }, 'd1')
    const e = aplicar(duo, { tipo: 'quitar_cantante', id: 'c2', ahora })
    const lineas = e.actual.letra.lineas.filter((l) => l.tipo === 'linea')
    expect(lineas.map((l) => l.parte)).toEqual([
      undefined,
      undefined,
      undefined,
      'coro',
      undefined,
      'coro'
    ])
    expect(e.actual.letra.partes?.cantantes).toEqual([{ id: 'c1', nombre: 'Ana' }])
    expect(aplicar(e, { tipo: 'deshacer' }).actual.letra).toBe(duo.actual.letra)
  })

  it('sin nada que guardar, la normalización quita `partes`', () => {
    const e = aplicar(
      simple(),
      { tipo: 'anadir_cantante', ahora },
      { tipo: 'quitar_cantante', id: 'c2', ahora }
    )
    expect(e.actual.letra.partes).toBeUndefined()
    expect(e.pasado).toHaveLength(2)
  })

  it('renombrar recorta el nombre; vacío = predeterminado; un nombre igual no crea paso', () => {
    const e = aplicar(simple(), { tipo: 'anadir_cantante', ahora })
    const con = aplicar(e, { tipo: 'renombrar_cantante', id: 'c2', nombre: '  Luis ', ahora })
    expect(con.actual.letra.partes?.cantantes[1]?.nombre).toBe('Luis')
    expect(aplicar(con, { tipo: 'renombrar_cantante', id: 'c2', nombre: 'Luis', ahora })).toBe(con)
    const vacio = aplicar(con, { tipo: 'renombrar_cantante', id: 'c2', nombre: '   ', ahora })
    expect(vacio.actual.letra.partes?.cantantes[1]?.nombre).toBeNull()
  })

  it('marcar_como_coro asigna al coro las líneas enteras entre paréntesis, en un paso', () => {
    const l = letra([
      linea('a', '(ah, ah)', 1000),
      linea('b', 'Dos (no)', 3000),
      linea('c', '(oh)', 5000)
    ])
    const e = aplicar(estadoInicial({ letra: l, apariencia }, 'b'), {
      tipo: 'marcar_como_coro',
      ahora
    })
    expect(partes(e)).toEqual(['coro', undefined, 'coro'])
    expect(e.pasado).toHaveLength(1)
    expect(aplicar(e, { tipo: 'marcar_como_coro', ahora })).toBe(e)
  })

  it('fijar_voz_en_coros agrupa la ráfaga en un paso, redondea a 0,05 y 0,5 sin coros no deja rastro', () => {
    const base = estadoInicial({ letra: cancionConCoros().letra!, apariencia }, 'u1')
    const e = aplicar(
      base,
      { tipo: 'fijar_voz_en_coros', valor: 0.61, ahora: 1000 },
      { tipo: 'fijar_voz_en_coros', valor: 0.72, ahora: 1200 },
      { tipo: 'fijar_voz_en_coros', valor: 0.8, ahora: 1400 }
    )
    expect(e.actual.letra.partes?.voz_en_coros).toBe(0.8)
    expect(e.pasado).toHaveLength(1)
    const plano = aplicar(simple(), { tipo: 'fijar_voz_en_coros', valor: 0.5, ahora })
    expect(plano.actual.letra.partes).toBeUndefined()
  })

  it('las pulsaciones agrupadas de Alt + ↑/↓ (menos de 1 s) son un solo paso', () => {
    const base = aplicar(
      simple(),
      { tipo: 'anadir_cantante', ahora: 0 },
      { tipo: 'anadir_cantante', ahora: 0 }
    )
    const e = aplicar(
      base,
      { tipo: 'asignar_parte', parte: 'c2', agrupar: true, ahora: 5000 },
      { tipo: 'asignar_parte', parte: 'c3', agrupar: true, ahora: 5400 }
    )
    expect(e.pasado).toHaveLength(base.pasado.length + 1)
    expect(e.actual.letra.lineas[1]?.parte).toBe('c3')
    expect(aplicar(e, { tipo: 'deshacer' }).actual.letra).toBe(base.actual.letra)
  })

  it('durante el modo al ritmo ninguna acción del reparto cambia nada', () => {
    const ritmo = aplicar(simple(), { tipo: 'entrar_sync', desdeId: 'b' })
    expect(aplicar(ritmo, { tipo: 'asignar_parte', parte: 'coro', ahora })).toBe(ritmo)
    expect(aplicar(ritmo, { tipo: 'anadir_cantante', ahora })).toBe(ritmo)
    expect(puedeDeshacer(ritmo)).toBe(false)
  })
})
