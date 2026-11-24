import { fireEvent, render, screen } from '@testing-library/react'
import type { Cancion } from '@shared/cancion'
import type { Letra as LetraDatos } from '@shared/letra'
import { cancionDosCantantes, cancionUnCantanteConCoros } from '@shared/__fixtures__/reparto'
import { NavegacionContexto } from '../../navegacion/estado'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { resumenPrueba } from '../biblioteca/resumenPrueba'
import { apiLetrasFalsa, lineasPorLinea } from './fixturesApi'
import { Letra } from './Letra'
import { existenteDe, useConfirmarSustituir } from './sustituir'

/** Reparto en la vista Letra (0.2.3, tarea 0362): aviso al sustituir y resumen de C. */

const FRASE =
  'También se perderá quién canta cada línea (se conservan los nombres de los cantantes).'

function montar(letra: LetraDatos) {
  const base = apiLetrasFalsa()
  window.shinobi = {
    biblioteca: {
      listar: () => Promise.resolve([resumenPrueba({ estado: 'borrador' })]),
      obtener: () =>
        Promise.resolve({
          metadatos: { titulo: 'Canción inventada', artista: 'Artista inventado', album: null },
          letra
        } as unknown as Cancion)
    },
    alCambiarCancion: () => () => undefined,
    sistema: { abrirEnlace: vi.fn() },
    letras: base.letras
  } as never
  render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: 'c1', paso: 'letra' }, ir: vi.fn() }}
    >
      <TrabajosContexto.Provider value={{ trabajos: [], progreso: {}, terminado: false }}>
        <Letra id="c1" />
      </TrabajosContexto.Provider>
    </NavegacionContexto.Provider>
  )
}

function Arnes({ letra }: { letra: LetraDatos }) {
  const { confirmar, dialogo } = useConfirmarSustituir(existenteDe(letra.lineas, letra))
  return (
    <>
      <button onClick={() => void confirmar()}>pedir</button>
      {dialogo}
    </>
  )
}

describe('resumen de la letra elegida', () => {
  it('con cantantes y coros añade la línea de reparto', async () => {
    montar(cancionDosCantantes().letra!)
    expect(await screen.findByText('2 cantantes · 2 líneas de coro')).toBeInTheDocument()
  })

  it('con un solo cantante y coros, solo los coros', async () => {
    montar(cancionUnCantanteConCoros().letra!)
    expect(await screen.findByText('2 líneas de coro')).toBeInTheDocument()
  })

  it('sin reparto no hay línea nueva (C1-L3)', async () => {
    montar({ origen: 'lrclib', lrclib_id: null, offset_ms: 0, lineas: lineasPorLinea() })
    await screen.findByText(/Letra actual/)
    expect(screen.queryByText(/cantantes|de coro/)).toBeNull()
  })
})

describe('diálogo de sustituir', () => {
  it('con reparto añade la frase de los cantantes', async () => {
    render(<Arnes letra={cancionDosCantantes().letra!} />)
    fireEvent.click(screen.getByText('pedir'))
    expect(await screen.findByText(FRASE)).toBeInTheDocument()
  })

  it('sin reparto no cambia (C1-L3)', async () => {
    render(
      <Arnes
        letra={{ origen: 'manual', lrclib_id: null, offset_ms: 0, lineas: lineasPorLinea() }}
      />
    )
    fireEvent.click(screen.getByText('pedir'))
    expect(await screen.findByText('Perderás la sincronía que hayas hecho.')).toBeInTheDocument()
    expect(screen.queryByText(FRASE)).toBeNull()
  })
})
