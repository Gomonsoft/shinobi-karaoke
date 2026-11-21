import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ESTILO_PREDETERMINADO } from '@shared/estilo'
import {
  catalogoPrueba,
  temaCatalogoPrueba,
  temasFalsos,
  type TemasFalsos
} from '../vistas/biblioteca/temasFalsos'
import { ListaFalloAMitad } from './ListaFalloAMitad'
import { MuestraTema } from './MuestraTema'
import { SelectorTema } from './SelectorTema'
import { instalar } from './pruebas'
import { useCatalogoTemas } from './useCatalogoTemas'
import { derivarFallo } from './useOperacionTema'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'

let t: TemasFalsos
beforeEach(() => {
  t = temasFalsos()
  instalar(t)
})

describe('useCatalogoTemas', () => {
  it('carga, ordena sin tildes ni mayúsculas, oculta los en borrado y sigue los cambios', async () => {
    t.fijarCatalogo(
      catalogoPrueba({
        temas: [
          temaCatalogoPrueba({ id: A, nombre: 'zeta' }),
          temaCatalogoPrueba({ id: B, nombre: 'Álamo' }),
          temaCatalogoPrueba({ id: C, nombre: 'borrando', enBorrado: true })
        ]
      })
    )
    const { result } = renderHook(() => useCatalogoTemas())
    expect(result.current.cargando).toBe(true)
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.ofrecibles.map((x) => x.nombre)).toEqual(['Álamo', 'zeta'])
    expect(result.current.soloLectura).toBe(false)
    act(() => t.fijarCatalogo(catalogoPrueba({ soloLectura: true, temas: [] })))
    expect(result.current.soloLectura).toBe(true)
    expect(result.current.ofrecibles).toEqual([])
  })

  it('un error de carga deja cargando en false', async () => {
    t.fallar('temas.catalogo', 'ERROR_INTERNO')
    const { result } = renderHook(() => useCatalogoTemas())
    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.cargando).toBe(false)
  })
})

describe('derivarFallo', () => {
  const c = (id: string, estado: 'aplicada' | 'error' | 'pendiente') => ({
    id,
    titulo: id,
    artista: '',
    estado,
    ...(estado === 'error' ? { codigo: 'ERROR_INTERNO' as const } : {})
  })
  it('solo error y pendiente, en orden, con f', () => {
    const f = derivarFallo({
      catalogoEscrito: false,
      canciones: [c('1', 'aplicada'), c('2', 'aplicada'), c('3', 'error'), c('4', 'pendiente')]
    })
    expect(f?.fallida).toMatchObject({ id: '3', codigo: 'ERROR_INTERNO' })
    expect(f?.filas.map((x) => x.id)).toEqual(['3', '4'])
    expect(f?.f).toBe(2)
  })
  it('sin error no hay fallo', () => {
    expect(derivarFallo({ catalogoEscrito: true, canciones: [c('1', 'aplicada')] })).toBeNull()
  })
})

describe('ListaFalloAMitad', () => {
  it('título vacío → «Canción sin nombre», artista vacío → «Sin artista», scroll con más de 8 filas', () => {
    const filas = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      titulo: i === 0 ? '' : `T${i}`,
      artista: '',
      estado: i === 0 ? ('error' as const) : ('pendiente' as const),
      ...(i === 0 ? { codigo: 'ERROR_INTERNO' as const } : {})
    }))
    render(
      <ListaFalloAMitad
        fallo={{ fallida: { ...filas[0]!, codigo: 'ERROR_INTERNO' }, filas, f: 10 }}
        texto={{ clave: 'eliminar' }}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('«Canción sin nombre»')
    expect(screen.getByRole('alert')).toHaveTextContent('Faltan 10 canciones')
    expect(
      screen.getByText(/Canción sin nombre — Sin artista · No se pudo guardar\./)
    ).toBeVisible()
    expect(screen.getByRole('list')).toHaveAttribute('tabindex', '0')
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
  })
})

describe('MuestraTema', () => {
  it('es decorativa y usa fondo, fuente y color del tema', () => {
    const { container } = render(<MuestraTema estilo={ESTILO_PREDETERMINADO} tamano={64} />)
    const m = container.querySelector('[data-muestra-tema]') as HTMLElement
    expect(m).toHaveAttribute('aria-hidden', 'true')
    expect(m.style.getPropertyValue('--k-color')).toBe(ESTILO_PREDETERMINADO.letra.color)
    expect(m.style.getPropertyValue('--k-fondo')).not.toBe('')
    expect(m).toHaveTextContent('Aa')
  })
})

describe('SelectorTema', () => {
  const temas = [
    temaCatalogoPrueba({ id: A, nombre: 'Álamo' }),
    temaCatalogoPrueba({ id: B, nombre: 'Neón' })
  ]

  it('opciones con etiqueta Predeterminado, opción inicial y elección', () => {
    const alElegir = vi.fn()
    render(
      <SelectorTema
        temas={temas}
        valor={A}
        predeterminadoId={B}
        etiqueta="Tema"
        alElegir={alElegir}
        opcionInicial={{ texto: 'Ninguno · un tema al azar', posicion: 'ultimo' }}
      />
    )
    const boton = screen.getByRole('button', { name: 'Tema: Álamo' })
    fireEvent.click(boton)
    const opciones = screen.getAllByRole('option')
    expect(opciones.map((o) => o.getAttribute('aria-label') ?? o.textContent)).toEqual([
      expect.stringContaining('Álamo'),
      'Neón, predeterminado',
      expect.stringContaining('Ninguno')
    ])
    fireEvent.click(opciones[2]!)
    expect(alElegir).toHaveBeenCalledWith(null)
    expect(boton).toHaveFocus()
  })

  it('marcador no seleccionable y búsqueda por tecleo', () => {
    const alElegir = vi.fn()
    render(
      <SelectorTema
        temas={temas}
        valor={null}
        etiqueta="Tema"
        alElegir={alElegir}
        marcador="«Atardecer» (no disponible)"
      />
    )
    expect(screen.getByRole('button', { name: 'Tema: «Atardecer» (no disponible)' })).toBeVisible()
    fireEvent.click(screen.getByRole('button'))
    const marcador = screen.getAllByRole('option')[0]!
    expect(marcador).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(marcador)
    expect(alElegir).not.toHaveBeenCalled()
    const lista = screen.getByRole('listbox')
    fireEvent.keyDown(lista, { key: 'n' })
    fireEvent.keyDown(lista, { key: 'Enter' })
    expect(alElegir).toHaveBeenCalledWith(B)
  })
})
