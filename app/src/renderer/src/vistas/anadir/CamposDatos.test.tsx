import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PropuestaDatos, ValoresDatosIpc } from '@shared/ipc'
import { CamposDatos, type ValoresDatos } from './CamposDatos'

const BIBLIOTECA: ValoresDatosIpc = {
  artistas: [
    { valor: 'Grupo Uno', clave: 'grupo uno', canciones: 7 },
    { valor: 'Grupo Uno Tributo', clave: 'grupo uno tributo', canciones: 2 },
    { valor: 'Otra Voz', clave: 'otra voz', canciones: 1 }
  ],
  albumes: [
    { valor: 'Disco Alfa', clave: 'disco alfa', canciones: 5, artistas: ['otra voz'] },
    { valor: 'Querido…', clave: 'querido…', canciones: 3, artistas: ['grupo uno'] }
  ]
}

const campo = (valor: string, origen: PropuestaDatos['titulo']['origen'], extra = {}) => ({
  valor,
  origen,
  dudoso: false,
  ...extra
})
const propuesta = (p: Partial<PropuestaDatos> = {}): PropuestaDatos => ({
  titulo: campo('Tema Alfa', 'nombre'),
  artista: campo('Grupo Uno', 'etiquetas'),
  album: campo('Querido...', 'etiquetas'),
  ...p
})

function Prueba({ inicial, propuesta: p }: { inicial: ValoresDatos; propuesta?: PropuestaDatos }) {
  const [v, setV] = useState(inicial)
  return (
    <form>
      <CamposDatos valores={v} onCambio={setV} propuesta={p} />
    </form>
  )
}

function montar(inicial: ValoresDatos, p?: PropuestaDatos, biblioteca = BIBLIOTECA) {
  window.shinobi = {
    biblioteca: { valoresDatos: vi.fn().mockResolvedValue(biblioteca) }
  } as never
  return render(<Prueba inicial={inicial} propuesta={p} />)
}
const VALORES = { titulo: 'Tema Alfa', artista: 'Grupo Uno', album: 'Querido...' }

describe('CamposDatos: procedencia', () => {
  it('muestra la procedencia bajo cada campo y la quita al editar (F6-N6)', async () => {
    montar(VALORES, propuesta())
    expect(screen.getByText('Del nombre del archivo')).toBeInTheDocument()
    expect(screen.getAllByText('De las etiquetas del archivo')).toHaveLength(2)
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Otro' } })
    expect(screen.queryByText('Del nombre del archivo')).toBeNull()
    expect(screen.getAllByText('De las etiquetas del archivo')).toHaveLength(2)
  })

  it('un dato dudoso lleva «compruébalo»; el del canal, también', () => {
    montar(VALORES, propuesta({ artista: campo('Grupo Uno', 'canal', { dudoso: true }) }))
    expect(screen.getByText('Del nombre del canal: compruébalo')).toBeInTheDocument()
  })

  it('sin artista: ayuda informativa; el álbum vacío conserva su ayuda', () => {
    montar(
      { titulo: 'T', artista: '', album: '' },
      propuesta({
        artista: campo('', null),
        album: campo('', null)
      })
    )
    expect(screen.getByText('Sin artista es más difícil encontrar la letra.')).toBeInTheDocument()
    expect(screen.getByText(/Opcional, ayuda a encontrar la letra exacta/)).toBeInTheDocument()
  })

  it('sin propuesta (Editar datos) no hay líneas de procedencia', () => {
    montar(VALORES)
    expect(screen.queryByText('De las etiquetas del archivo')).toBeNull()
  })
})

describe('CamposDatos: autocompletado', () => {
  it('lista valores que contienen lo escrito, con su recuento, y Intro elige (F6-N4)', async () => {
    montar({ titulo: 'T', artista: '', album: '' })
    const artista = await screen.findByRole('combobox', { name: 'Artista' })
    fireEvent.change(artista, { target: { value: 'gRÚpo' } })
    const opciones = await screen.findAllByRole('option')
    expect(opciones.map((o) => o.getAttribute('aria-label'))).toEqual([
      'Grupo Uno, 7 canciones',
      'Grupo Uno Tributo, 2 canciones'
    ])
    expect(artista).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(artista, { key: 'ArrowDown' })
    fireEvent.keyDown(artista, { key: 'ArrowDown' })
    expect(artista.getAttribute('aria-activedescendant')).toBe(opciones[1]?.id)
    fireEvent.keyDown(artista, { key: 'Enter' })
    expect(artista).toHaveValue('Grupo Uno Tributo')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('Esc cierra la lista y no se propaga; en el álbum salen primero los del artista', async () => {
    montar({ titulo: 'T', artista: 'Grupo Uno', album: '' })
    const album = await screen.findByRole('combobox', { name: 'Álbum' })
    fireEvent.keyDown(album, { key: 'ArrowDown' })
    const nombres = screen.getAllByRole('option').map((o) => o.textContent)
    expect(nombres[0]).toContain('Querido…')
    const alEscape = vi.fn()
    document.addEventListener('keydown', alEscape)
    fireEvent.keyDown(album, { key: 'Escape' })
    document.removeEventListener('keydown', alEscape)
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(alEscape).not.toHaveBeenCalled()
  })

  it('con la biblioteca vacía no hay lista ni botón ▾', async () => {
    montar({ titulo: 'T', artista: '', album: '' }, undefined, { artistas: [], albumes: [] })
    await waitFor(() => expect(window.shinobi.biblioteca.valoresDatos).toHaveBeenCalled())
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByLabelText('Mostrar sugerencias de tu biblioteca')).toBeNull()
  })
})

describe('CamposDatos: unificar', () => {
  it('al salir con «Querido...» ofrece «Querido…»; Usar lo sustituye (F6-N3)', async () => {
    montar({ titulo: 'T', artista: '', album: '' })
    const album = await screen.findByRole('combobox', { name: 'Álbum' })
    fireEvent.change(album, { target: { value: 'Querido...' } })
    fireEvent.blur(album)
    expect(
      screen.getByText('¿Te refieres a «Querido…», que ya está en tu biblioteca?')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Usar «Querido…»' }))
    expect(album).toHaveValue('Querido…')
    expect(screen.queryByText(/¿Te refieres a/)).toBeNull()
  })

  it('Dejarlo así oculta la sugerencia para ese valor; una diferencia solo de mayúsculas no la provoca', async () => {
    montar({ titulo: 'T', artista: '', album: '' })
    const album = await screen.findByRole('combobox', { name: 'Álbum' })
    fireEvent.change(album, { target: { value: 'Querido...' } })
    fireEvent.blur(album)
    fireEvent.click(screen.getByRole('button', { name: 'Dejarlo así' }))
    expect(screen.queryByText(/¿Te refieres a/)).toBeNull()
    fireEvent.blur(album)
    expect(screen.queryByText(/¿Te refieres a/)).toBeNull()
    fireEvent.change(album, { target: { value: 'QUERIDO…' } })
    fireEvent.blur(album)
    expect(screen.queryByText(/¿Te refieres a/)).toBeNull()
  })
})

describe('CamposDatos: intercambiar', () => {
  it('solo con título y artista; intercambia, quita la procedencia y se anuncia (F6-N5)', async () => {
    montar({ titulo: 'Grupo Uno', artista: 'Tema Alfa', album: '' }, propuesta())
    await screen.findByRole('combobox', { name: 'Artista' })
    fireEvent.click(screen.getByRole('button', { name: /Intercambiar título y artista/ }))
    expect(screen.getByLabelText('Título *')).toHaveValue('Tema Alfa')
    expect(screen.getByRole('combobox', { name: 'Artista' })).toHaveValue('Grupo Uno')
    expect(screen.queryByText('Del nombre del archivo')).toBeNull()
    expect(screen.getByText('Título y artista intercambiados.')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Artista' }), { target: { value: '' } })
    expect(screen.queryByRole('button', { name: /Intercambiar/ })).toBeNull()
  })
})
