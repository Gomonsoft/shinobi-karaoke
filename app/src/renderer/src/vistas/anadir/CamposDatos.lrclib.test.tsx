import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CamposDatos, datosLrclibDe, type DatosLrclib, type ValoresDatos } from './CamposDatos'

function Prueba({
  inicial,
  lrclib,
  onAplicar
}: {
  inicial: ValoresDatos
  lrclib: DatosLrclib
  onAplicar?: (v: ValoresDatos) => void
}) {
  const [v, setV] = useState(inicial)
  return (
    <form>
      <CamposDatos valores={v} onCambio={setV} lrclib={lrclib} onAplicar={onAplicar} />
    </form>
  )
}

function montar(inicial: ValoresDatos, lrclib: DatosLrclib, onAplicar?: (v: ValoresDatos) => void) {
  window.shinobi = {
    biblioteca: { valoresDatos: vi.fn().mockResolvedValue({ artistas: [], albumes: [] }) }
  } as never
  render(<Prueba inicial={inicial} lrclib={lrclib} onAplicar={onAplicar} />)
}
afterEach(cleanup)

describe('F6-N7 · datos de LRCLIB en CamposDatos', () => {
  it('un álbum tomado de LRCLIB muestra su origen con [Quitar], que lo vacía', () => {
    const onAplicar = vi.fn()
    montar(
      { titulo: 'Eco de Plata', artista: 'Duo Ficticio', album: 'Disco Inventado' },
      { albumDeLrclib: true, registro: null },
      onAplicar
    )
    expect(screen.getByText('Tomado de LRCLIB')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }))
    expect(screen.getByLabelText(/^Álbum/)).toHaveValue('')
    expect(screen.queryByText('Tomado de LRCLIB')).toBeNull()
    expect(onAplicar).toHaveBeenCalledWith({
      titulo: 'Eco de Plata',
      artista: 'Duo Ficticio',
      album: ''
    })
  })

  it('un álbum que no es de LRCLIB no muestra el origen', () => {
    montar(
      { titulo: 'Eco', artista: 'Duo', album: 'Disco' },
      { albumDeLrclib: false, registro: null }
    )
    expect(screen.queryByText('Tomado de LRCLIB')).toBeNull()
  })

  it('si el título o el artista difieren, ofrece [Usar estos datos] y los aplica', () => {
    const onAplicar = vi.fn()
    montar(
      { titulo: 'eco de plata (en vivo)', artista: 'Duo Ficticio', album: '' },
      { albumDeLrclib: false, registro: { titulo: 'Eco de Plata', artista: 'Dúo Ficticio' } },
      onAplicar
    )
    expect(screen.getByText('LRCLIB la llama «Eco de Plata», de «Dúo Ficticio».')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Usar estos datos' }))
    expect(screen.getByLabelText(/^Título/)).toHaveValue('Eco de Plata')
    expect(onAplicar).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: 'Eco de Plata', artista: 'Dúo Ficticio' })
    )
    expect(screen.queryByText(/LRCLIB la llama/)).toBeNull()
  })

  it('si coinciden, no hay sugerencia', () => {
    montar(
      { titulo: 'Eco de Plata', artista: 'Duo Ficticio', album: '' },
      { albumDeLrclib: false, registro: { titulo: 'Eco de Plata', artista: 'Duo Ficticio' } }
    )
    expect(screen.queryByText(/LRCLIB la llama/)).toBeNull()
  })

  it('datosLrclibDe lee el origen del álbum y el registro de la letra', () => {
    expect(
      datosLrclibDe({
        metadatos: { origen: { album: 'lrclib' } },
        letra: { datos_lrclib: { titulo: 'T', artista: 'A' } }
      })
    ).toEqual({ albumDeLrclib: true, registro: { titulo: 'T', artista: 'A' } })
    expect(datosLrclibDe({ metadatos: {}, letra: null })).toEqual({
      albumDeLrclib: false,
      registro: null
    })
  })
})
