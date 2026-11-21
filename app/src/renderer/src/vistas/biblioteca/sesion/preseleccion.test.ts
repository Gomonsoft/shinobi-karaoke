import { pantalla } from '@shared/__fixtures__/sesion'
import type { ListaPantallasIpc } from '@shared/sesion'
import { completaPorDefecto, preseleccionarPantalla, type PantallaGuardada } from './preseleccion'

const principal = pantalla(1)
const externa = pantalla(2)
const otra = pantalla(3)
const lista = (...pantallas: ListaPantallasIpc['pantallas']): ListaPantallasIpc => ({
  pantallas,
  colocacion: 'libre'
})
const guardada = (p: typeof externa, completa: boolean): PantallaGuardada => ({
  pantalla: { id: p.id, etiqueta: p.etiqueta, ancho: p.ancho, alto: p.alto },
  pantalla_completa: completa
})

describe('preseleccionarPantalla', () => {
  it('sin pantallas no hay selección', () => {
    expect(preseleccionarPantalla(lista(), null)).toBeNull()
  })

  it('con una sola pantalla, esa', () => {
    expect(preseleccionarPantalla(lista(principal), null)).toBe(principal)
  })

  it('sin guardada, la primera que no es la de la ventana principal', () => {
    expect(preseleccionarPantalla(lista(principal, externa, otra), null)).toBe(externa)
  })

  it('la guardada si sigue conectada, por id', () => {
    expect(preseleccionarPantalla(lista(principal, externa, otra), guardada(otra, true))).toBe(otra)
  })

  it('si cambió el id, la busca por etiqueta y tamaño', () => {
    const g = guardada(otra, true)
    g.pantalla.id = 9999
    expect(preseleccionarPantalla(lista(principal, externa, otra), g)).toBe(otra)
  })

  it('si la guardada ya no está, vuelve a la regla general', () => {
    const g = guardada(pantalla(7), true)
    expect(preseleccionarPantalla(lista(principal, externa), g)).toBe(externa)
  })
})

describe('completaPorDefecto', () => {
  it('marcada en una pantalla distinta de la principal', () => {
    expect(completaPorDefecto(lista(principal, externa), externa, null)).toBe(true)
  })

  it('desmarcada en la de la ventana principal', () => {
    expect(completaPorDefecto(lista(principal, externa), principal, null)).toBe(false)
  })

  it('desmarcada con una sola pantalla', () => {
    expect(completaPorDefecto(lista(externa), externa, null)).toBe(false)
  })

  it('respeta lo guardado para la pantalla guardada', () => {
    expect(completaPorDefecto(lista(principal, externa), externa, guardada(externa, false))).toBe(
      false
    )
  })
})
