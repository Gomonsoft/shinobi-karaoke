import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PropuestaDatos, ValoresDatosIpc } from '@shared/ipc'
import { CamposDatos, RETRASO_UNIFICAR_MS, type ValoresDatos } from './CamposDatos'

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
  const esperar400 = () => act(() => void vi.advanceTimersByTime(RETRASO_UNIFICAR_MS))

  afterEach(() => vi.useRealTimers())

  it('400 ms después de la última tecla ofrece «Querido…» con el foco aún en el campo; Usar lo sustituye (F6-N3)', async () => {
    montar({ titulo: 'T', artista: '', album: '' })
    const album = await screen.findByRole('combobox', { name: 'Álbum' })
    vi.useFakeTimers()
    album.focus()
    fireEvent.change(album, { target: { value: 'Querido...' } })
    expect(screen.queryByText(/¿Te refieres a/)).toBeNull()
    esperar400()
    expect(
      screen.getByText('¿Te refieres a «Querido…», que ya está en tu biblioteca?')
    ).toBeInTheDocument()
    expect(album).toHaveFocus()
    // Tab lleva a [Usar «Querido…»]: la sugerencia ya estaba antes de salir del campo.
    const usar = screen.getByRole('button', { name: 'Usar «Querido…»' })
    fireEvent.click(usar)
    expect(album).toHaveValue('Querido…')
    expect(screen.queryByText(/¿Te refieres a/)).toBeNull()
  })

  it('salir del campo no calcula nada (nunca en el blur)', async () => {
    montar({ titulo: 'T', artista: '', album: '' })
    const album = await screen.findByRole('combobox', { name: 'Álbum' })
    vi.useFakeTimers()
    fireEvent.change(album, { target: { value: 'Querido...' } })
    fireEvent.blur(album)
    expect(screen.queryByText(/¿Te refieres a/)).toBeNull()
  })

  it('con Tab se calcula antes de que el foco salte', async () => {
    montar({ titulo: 'T', artista: '', album: '' })
    const album = await screen.findByRole('combobox', { name: 'Álbum' })
    fireEvent.change(album, { target: { value: 'Querido...' } })
    fireEvent.keyDown(album, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Usar «Querido…»' })).toBeInTheDocument()
  })

  it('la región de estado existe vacía desde el principio', async () => {
    montar({ titulo: 'T', artista: '', album: '' })
    await screen.findByRole('combobox', { name: 'Álbum' })
    const regiones = document.querySelectorAll('[role="status"]:empty')
    expect(regiones.length).toBeGreaterThanOrEqual(2)
  })

  it('con la sugerencia a la vista, la ayuda del Álbum sigue debajo (V1)', async () => {
    montar({ titulo: 'T', artista: '', album: '' })
    const album = await screen.findByRole('combobox', { name: 'Álbum' })
    fireEvent.change(album, { target: { value: 'Querido...' } })
    fireEvent.keyDown(album, { key: 'Tab' })
    const ayuda = screen.getByText(/Opcional, ayuda a encontrar la letra exacta/)
    const sugerencia = screen.getByText(/¿Te refieres a/)
    expect(
      sugerencia.compareDocumentPosition(ayuda) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('en «Añadir canción» (con propuesta) la ayuda del Álbum también sigue bajo la sugerencia (V1)', async () => {
    montar({ titulo: 'T', artista: 'Grupo Uno', album: 'Querido...' }, propuesta())
    const album = await screen.findByRole('combobox', { name: 'Álbum' })
    fireEvent.change(album, { target: { value: 'Querido..' } })
    fireEvent.keyDown(album, { key: 'Tab' })
    const sugerencia = await screen.findByText(/¿Te refieres a/)
    const ayuda = screen.getByText(/Opcional, ayuda a encontrar la letra exacta/)
    expect(
      sugerencia.compareDocumentPosition(ayuda) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('Dejarlo así oculta la sugerencia para ese valor; una diferencia solo de mayúsculas no la provoca', async () => {
    montar({ titulo: 'T', artista: '', album: '' })
    const album = await screen.findByRole('combobox', { name: 'Álbum' })
    fireEvent.change(album, { target: { value: 'Querido...' } })
    fireEvent.keyDown(album, { key: 'Tab' })
    fireEvent.click(screen.getByRole('button', { name: 'Dejarlo así' }))
    expect(screen.queryByText(/¿Te refieres a/)).toBeNull()
    fireEvent.keyDown(album, { key: 'Tab' })
    expect(screen.queryByText(/¿Te refieres a/)).toBeNull()
    fireEvent.change(album, { target: { value: 'QUERIDO…' } })
    fireEvent.keyDown(album, { key: 'Tab' })
    expect(screen.queryByText(/¿Te refieres a/)).toBeNull()
  })

  it('D5: «Intercambiar» conserva la sugerencia del Álbum', async () => {
    montar({ titulo: 'Tema Alfa', artista: 'Otra Voz', album: '' })
    const album = await screen.findByRole('combobox', { name: 'Álbum' })
    fireEvent.change(album, { target: { value: 'Querido...' } })
    fireEvent.keyDown(album, { key: 'Tab' })
    fireEvent.click(screen.getByRole('button', { name: /Intercambiar título y artista/ }))
    expect(screen.getByText(/¿Te refieres a «Querido…»/)).toBeInTheDocument()
  })
})

describe('CamposDatos: teclado de la lista', () => {
  it('D4: con la lista abierta y ninguna opción activa, ↑ activa la última', async () => {
    montar({ titulo: 'T', artista: '', album: '' })
    const artista = await screen.findByRole('combobox', { name: 'Artista' })
    fireEvent.change(artista, { target: { value: 'grupo' } })
    const opciones = await screen.findAllByRole('option')
    fireEvent.keyDown(artista, { key: 'ArrowUp' })
    expect(artista.getAttribute('aria-activedescendant')).toBe(opciones.at(-1)?.id)
  })

  it('la lista se cierra sola cuando lo escrito coincide exactamente con la única opción', async () => {
    montar({ titulo: 'T', artista: '', album: '' })
    const artista = await screen.findByRole('combobox', { name: 'Artista' })
    fireEvent.change(artista, { target: { value: 'Otra' } })
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    fireEvent.change(artista, { target: { value: 'Otra Voz' } })
    expect(screen.queryByRole('listbox')).toBeNull()
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
