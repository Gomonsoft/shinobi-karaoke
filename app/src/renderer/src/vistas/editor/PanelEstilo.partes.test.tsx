import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { cancionDosCantantes, cancionUnCantanteConCoros } from '@shared/__fixtures__/reparto'
import { estiloPredeterminado, type Estilo } from '@shared/estilo'
import type { Letra } from '@shared/letra'
import { evaluarContraste } from '../../karaoke/contraste'
import { vistaTema, type EstadoTema } from './aparienciaVista'
import { PanelEstilo } from './PanelEstilo'
import { partesEnUso } from './estilo/partesEnUso'
import { catalogoPrueba } from '../biblioteca/temasFalsos'
import { resumenPrueba } from '../biblioteca/resumenPrueba'
import type { ControlTema } from './SeccionTema'

// 0.2.3 · tarea 0347: «Colores de los cantantes» en el panel Estilo (C1-E17, C1-E18, C1-E19).
const sinLetra: Letra = { origen: 'manual', lrclib_id: null, offset_ms: 0, lineas: [] }

function control(estilo: Estilo, estado: EstadoTema): ControlTema {
  const vista = vistaTema({
    seleccion: { modo: 'propio' },
    estiloPropio: estilo,
    resumen: resumenPrueba({ estilo }),
    catalogo: catalogoPrueba(),
    borrador: null
  })
  const acciones = new Proxy({}, { get: () => vi.fn() }) as ControlTema['acciones']
  return {
    vista: { ...vista, estado },
    ofrecibles: [],
    predeterminadoId: null,
    grupo: { album: null, artista: null },
    usos: 0,
    nombreBorrador: null,
    borradorModificado: false,
    nuevoCreado: null,
    foco: null,
    acciones
  }
}

function Montaje({
  letra,
  inicial = estiloPredeterminado(),
  estado = 'd2'
}: {
  letra: Letra
  inicial?: Estilo
  estado?: EstadoTema
}) {
  const [estilo, setEstilo] = useState(inicial)
  return (
    <>
      <PanelEstilo
        estilo={estilo}
        letra={letra}
        contraste={evaluarContraste(estilo, partesEnUso(letra))}
        inactivo={false}
        tema={control(estilo, estado)}
        alCambiar={setEstilo}
      />
      <pre data-testid="estilo">{JSON.stringify(estilo)}</pre>
    </>
  )
}

const estiloActual = (): Estilo => JSON.parse(screen.getByTestId('estilo').textContent!)
const titulo = () => screen.queryByRole('heading', { name: 'Colores de los cantantes' })

describe('«Colores de los cantantes»', () => {
  it('no aparece en una canción sin reparto (D2) y está plegada en D3', () => {
    const { unmount } = render(<Montaje letra={sinLetra} />)
    expect(titulo()).toBeNull()
    unmount()
    render(<Montaje letra={sinLetra} estado="d3" />)
    expect(titulo()).toBeInTheDocument()
    expect(screen.getByText(/Colores para dúos y coros \(esta canción no los usa\)/)).toBeVisible()
    expect(screen.queryByLabelText('Abrir selector de color de Luis')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }))
    expect(screen.getByLabelText('Abrir selector de color de Cantante 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Abrir selector de color de Coro')).toBeInTheDocument()
  })

  it('con un dúo: Cantante 1 como enlace, una fila por parte en uso y «Más colores»', () => {
    render(<Montaje letra={cancionDosCantantes().letra!} />)
    expect(titulo()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ana: Ir a «Color de lo ya cantado»/ })).toBeVisible()
    expect(screen.getByLabelText('Abrir selector de color de Luis')).toBeInTheDocument()
    expect(screen.getByLabelText('Abrir selector de color de Todos')).toBeInTheDocument()
    expect(screen.getByLabelText('Abrir selector de color de Coro')).toBeInTheDocument()
    const mas = screen.getByRole('button', { name: /Más colores \(Cantante 3, Cantante 4\)/ })
    expect(screen.queryByLabelText('Abrir selector de color de Cantante 3')).toBeNull()
    fireEvent.click(mas)
    expect(screen.getByLabelText('Abrir selector de color de Cantante 4')).toBeInTheDocument()
    // Abrir el panel no escribe nada en el tema (C1-E18).
    expect(estiloActual().letra.colores_partes).toBeUndefined()
  })

  it('el enlace lleva el foco a «Color de lo ya cantado»', () => {
    render(<Montaje letra={cancionDosCantantes().letra!} />)
    fireEvent.click(screen.getByRole('button', { name: /Ana: Ir a/ }))
    expect(screen.getByLabelText('Color de lo ya cantado')).toHaveFocus()
  })

  it('un solo cantante con coros: solo la fila del Coro', () => {
    render(<Montaje letra={cancionUnCantanteConCoros().letra!} />)
    expect(screen.getByLabelText('Abrir selector de color de Coro')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ir a «Color/ })).toBeNull()
    expect(screen.queryByLabelText('Abrir selector de color de Todos')).toBeNull()
  })

  it('cambiar un color escribe solo esa ranura y muestra el predeterminado de las demás', () => {
    render(<Montaje letra={cancionDosCantantes().letra!} />)
    const campo = screen.getByLabelText('Luis')
    expect(campo).toHaveValue('#35C6E8')
    fireEvent.change(campo, { target: { value: '#112233' } })
    expect(estiloActual().letra.colores_partes).toEqual({ c2: '#112233' })
    expect(screen.getByLabelText('Coro')).toHaveValue('#FF9F1C')
  })

  it('en D1 muestra un resumen de solo lectura, sin selectores', () => {
    render(<Montaje letra={cancionDosCantantes().letra!} estado="d1" />)
    expect(screen.getByText('Colores de los cantantes')).toBeInTheDocument()
    expect(screen.getByText(/Luis #35C6E8/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Abrir selector de color de Luis')).toBeNull()
  })
})

describe('avisos de contraste por parte', () => {
  it('un color de parte casi invisible avisa y «Sugerir un color» lo arregla', () => {
    const estilo = estiloPredeterminado()
    estilo.letra.colores_partes = { c2: '#2BB5B5', c3: '#2A1A44' }
    const letra = cancionDosCantantes().letra!
    letra.partes = {
      cantantes: [
        { id: 'c1', nombre: 'Ana' },
        { id: 'c2', nombre: 'Luis' },
        { id: 'c3', nombre: null }
      ]
    }
    render(<Montaje letra={letra} inicial={estilo} />)
    expect(screen.getByText('El color de Cantante 3 apenas se ve sobre el fondo.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir un color' }))
    expect(screen.queryByText(/apenas se ve sobre el fondo/)).toBeNull()
    expect(estiloActual().letra.colores_partes!.c3).not.toBe('#2A1A44')
  })
})
