import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  crearApiExportacionFalsa,
  destinoDePrueba,
  perfilesDePrueba,
  ID_DESTINO
} from '@shared/__fixtures__/exportacion'
import { SesionContexto, sesionVacia } from '../../sesion/ProveedorSesion'
import { ExportacionContexto } from '../contexto'
import { cancionIpcDePrueba, instalarApiExportacion } from '../pruebas'
import { DialogoExportacion } from './DialogoExportacion'

const ID = 'c1'

function montar(
  opciones: Parameters<typeof instalarApiExportacion>[0] = {},
  sesion = false,
  temaBorrador = false
) {
  const api = instalarApiExportacion(opciones)
  const alCerrar = vi.fn()
  const iniciada = vi.fn()
  const vista = render(
    <SesionContexto.Provider value={{ ...sesionVacia, haySesion: sesion }}>
      <ExportacionContexto.Provider
        value={{
          exportaciones: [],
          activaDe: () => undefined,
          abrir: () => undefined,
          cerrar: alCerrar,
          iniciada,
          pedirCancelar: () => undefined
        }}
      >
        <DialogoExportacion peticion={{ cancionId: ID, temaBorrador }} alCerrar={alCerrar} />
      </ExportacionContexto.Provider>
    </SesionContexto.Provider>
  )
  return { api, alCerrar, iniciada, ...vista }
}

const formulario = () => screen.findByRole('radiogroup', { name: 'Audio' })

describe('DialogoExportacion · formulario (A)', () => {
  it('muestra audio, proporción, resolución, FPS, formato, destino, estimación y muestra', async () => {
    montar()
    await formulario()
    expect(screen.getByRole('dialog', { name: 'Exportar video' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Solo instrumental' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '16:9 · Panorámica' })).toBeChecked()
    expect(screen.getByRole('button', { name: /Resolución: 1920 × 1080 · Full HD/ })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Fotogramas por segundo: 30' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'MKV (AV1 + Opus)' })).toBeChecked()
    expect(screen.getByRole('textbox', { name: /Guardar como, .*\.mkv/ })).toHaveAttribute(
      'readonly'
    )
    await screen.findByText('Ocupará unos 80 MB · tardará unos 2 minutos')
    expect(screen.getByRole('img', { name: /Muestra del video/ })).toBeInTheDocument()
    expect(screen.getByText('1920 × 1080 · 30 FPS · MKV', { exact: false })).toBeInTheDocument()
  })

  it('con el foco inicial en Audio y Esc cierra sin exportar', async () => {
    const { api, alCerrar } = montar()
    const audio = await screen.findByRole('radio', { name: 'Solo instrumental' })
    await waitFor(() => expect(audio).toHaveFocus())
    fireEvent.keyDown(audio, { key: 'Escape' })
    expect(alCerrar).toHaveBeenCalled()
    expect(api.llamadas.some((l) => l[0] === 'iniciar')).toBe(false)
  })

  it('lista las resoluciones de cada proporción y elige la equivalente al cambiarla', async () => {
    montar()
    await formulario()
    fireEvent.click(screen.getByRole('button', { name: /^Resolución:/ }))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '1280 × 720 · HD',
      '1920 × 1080 · Full HD',
      '2560 × 1440 · QHD',
      '3840 × 2160 · 4K UHD'
    ])
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('radio', { name: '4:3 · Clásica' }))
    expect(screen.getByRole('button', { name: /Resolución: 1024 × 768 · XGA/ })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /^Resolución:/ }))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '640 × 480 · SD',
      '1024 × 768 · XGA',
      '1600 × 1200 · UXGA',
      '2880 × 2160 · 4:3 máxima'
    ])
  })

  it('marca los perfiles no soportados con su motivo y cambia el FPS con aviso', async () => {
    const perfiles = perfilesDePrueba((p) =>
      p.alto === 2160 ? 'memoria' : p.alto === 1080 && p.fps === 60 ? 'codificador' : null
    )
    montar({ exportacion: crearApiExportacionFalsa({ perfiles }), config: { fps: 60 } })
    await formulario()
    // 1080p/60 no está soportado: se elige 30 al abrir, sin aviso (opciones recordadas).
    expect(screen.getByRole('radio', { name: 'Fotogramas por segundo: 30' })).toBeChecked()
    const f60 = screen.getByRole('radio', { name: /Fotogramas por segundo: 60 — no disponible/ })
    expect(f60).toHaveAttribute('aria-disabled', 'true')
    expect(f60).toHaveAccessibleDescription(
      /1920 × 1080 a 60 FPS en MKV.*no admite esta resolución/
    )
    fireEvent.click(f60)
    expect(screen.getByRole('radio', { name: 'Fotogramas por segundo: 30' })).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: /^Resolución:/ }))
    const uhd = screen.getByRole('option', { name: /3840 × 2160 · 4K UHD — no disponible/ })
    expect(uhd).toHaveAttribute('aria-disabled', 'true')
    expect(uhd).toHaveAccessibleDescription(/al menos 8 GB de memoria/)
    fireEvent.click(uhd)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('anuncia el cambio automático de FPS al cambiar de resolución', async () => {
    const perfiles = perfilesDePrueba((p) =>
      p.alto === 720 && p.fps === 30 ? 'codificador' : null
    )
    montar({ exportacion: crearApiExportacionFalsa({ perfiles }), config: { fps: 30 } })
    await formulario()
    fireEvent.click(screen.getByRole('button', { name: /^Resolución:/ }))
    fireEvent.click(screen.getByRole('option', { name: '1280 × 720 · HD' }))
    expect(screen.getByRole('radio', { name: 'Fotogramas por segundo: 24' })).toBeChecked()
    expect(
      screen.getByText('Tu equipo no admite 30 FPS con estas opciones. Se ha elegido 24.')
    ).toBeInTheDocument()
  })

  it('WebM cambia la pista, la extensión del destino y la estimación (V30)', async () => {
    const api = crearApiExportacionFalsa({
      destinoPropuesto: (p: { formato: string }) =>
        destinoDePrueba({
          ruta: `/v/Canción de prueba — Artista (karaoke).${p.formato === 'webm_vp9' ? 'webm' : 'mkv'}`
        })
    })
    montar({ exportacion: api })
    await formulario()
    expect(screen.getByText(/Recomendado\. Ocupa menos/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'WebM (VP9 + Opus)' }))
    expect(screen.getByText(/Se abre en más sitios: navegadores/)).toBeInTheDocument()
    await screen.findByDisplayValue(/\.webm$/)
    expect(screen.getByText('1920 × 1080 · 30 FPS · WebM', { exact: false })).toBeInTheDocument()
    const estimar = api.llamadas.filter((l) => l[0] === 'estimar')
    expect(estimar.at(-1)![1]).toMatchObject({ formato: 'webm_vp9' })
  })

  it('conserva el destino elegido al cambiar de formato y solo avisa si main vuelve al propuesto (0124)', async () => {
    const elegido = destinoDePrueba({ destinoId: 'e-1', ruta: '/mis/videos/Mi nombre.mkv' })
    const api = crearApiExportacionFalsa({
      elegirDestino: elegido,
      destinoPropuesto: vi
        .fn()
        .mockResolvedValueOnce(destinoDePrueba())
        .mockResolvedValueOnce(destinoDePrueba({ ruta: '/mis/videos/Mi nombre.webm' }))
        .mockResolvedValueOnce(destinoDePrueba({ ruta: '/propuesto/Canción.mkv' }))
    })
    montar({ exportacion: api })
    await formulario()
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar…' }))
    await screen.findByDisplayValue('/mis/videos/Mi nombre.mkv')

    fireEvent.click(screen.getByRole('radio', { name: 'WebM (VP9 + Opus)' }))
    await screen.findByDisplayValue('/mis/videos/Mi nombre.webm')
    const llamadas = api.llamadas.filter((l) => l[0] === 'destinoPropuesto')
    expect(llamadas[1]![1]).toMatchObject({ formato: 'webm_vp9', desdeDestinoId: 'e-1' })
    expect(screen.queryByText(/se ha vuelto a proponer el nombre/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'MKV (AV1 + Opus)' }))
    await screen.findByText(/Al cambiar el formato se ha vuelto a proponer el nombre: Canción\.mkv/)
  })

  it('el popover ⓘ se abre con Intro y Esc lo cierra devolviendo el foco', async () => {
    const { alCerrar } = montar()
    await formulario()
    const boton = screen.getByRole('button', { name: 'Qué formato elegir' })
    boton.focus()
    fireEvent.click(boton)
    const region = screen.getByRole('region', { name: 'Qué formato elegir' })
    expect(within(region).getByText(/Extensión de video AV1/)).toBeInTheDocument()
    fireEvent.keyDown(boton, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Qué formato elegir' })).not.toBeInTheDocument()
    expect(boton).toHaveFocus()
    expect(alCerrar).not.toHaveBeenCalled()
    // Con la ayuda ya cerrada, el siguiente Esc llega al diálogo y lo cierra.
    fireEvent.keyDown(boton, { key: 'Escape' })
    expect(alCerrar).toHaveBeenCalledTimes(1)
  })

  it('un formato sin soporte queda aria-disabled y se elige el otro', async () => {
    const perfiles = perfilesDePrueba((p) => (p.formato === 'mkv_av1' ? 'codificador' : null))
    montar({ exportacion: crearApiExportacionFalsa({ perfiles }) })
    await formulario()
    expect(screen.getByRole('radio', { name: 'WebM (VP9 + Opus)' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'MKV (AV1 + Opus)' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  it('sin voz deshabilita «Instrumental y voz» y fuerza el instrumental', async () => {
    const cancion = cancionIpcDePrueba({ pistas: null })
    montar({ cancion, config: { audio: 'instrumental_voz' } })
    await formulario()
    const voz = screen.getByRole('radio', { name: 'Instrumental y voz' })
    expect(voz).toHaveAttribute('aria-disabled', 'true')
    expect(voz).toHaveAccessibleDescription('La voz de esta canción no está disponible.')
    expect(screen.getByRole('radio', { name: 'Solo instrumental' })).toBeChecked()
  })

  it('con archivo existente avisa y el primario sustituye (E)', async () => {
    montar({
      exportacion: crearApiExportacionFalsa({ destinoPropuesto: destinoDePrueba({ existe: true }) })
    })
    await formulario()
    expect(screen.getByText(/Ya hay un archivo con este nombre/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar y sustituir' })).toBeEnabled()
  })

  it('muestra las notas en el orden de la spec y espacio solo si se conocen las dos cifras', async () => {
    const cancion = cancionIpcDePrueba({ estado: 'borrador' })
    montar(
      {
        cancion,
        exportacion: crearApiExportacionFalsa({
          estimar: { bytes: 5_000_000_000, segundos: 4000 },
          destinoPropuesto: destinoDePrueba({ libreBytes: 1_000_000_000 })
        })
      },
      true,
      true
    )
    await formulario()
    const notas = await screen.findByText(/Puede que no haya espacio/)
    const textos = Array.from(notas.closest('[data-notas]')!.children).map((n) => n.textContent)
    expect(textos).toEqual([
      expect.stringContaining(
        'Puede que no haya espacio: el video ocuparía unos 5,0 GB y quedan 1,0 GB libres'
      ),
      expect.stringContaining('El reproductor está abierto en otra pantalla'),
      expect.stringContaining('tardará bastante'),
      expect.stringContaining('aún es un borrador'),
      expect.stringContaining('tema sin guardar')
    ])
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled()
  })

  it('no avisa del espacio si falta una de las cifras', async () => {
    montar({
      exportacion: crearApiExportacionFalsa({
        estimar: { bytes: 5_000_000_000, segundos: null },
        destinoPropuesto: destinoDePrueba({ libreBytes: null })
      })
    })
    await formulario()
    await screen.findByText('Ocupará unos 5,0 GB')
    expect(screen.queryByText(/Puede que no haya espacio/)).not.toBeInTheDocument()
  })

  it('«Exportar» pide iniciar con las opciones y el destino, y avisa de los errores en el campo', async () => {
    const iniciar = vi
      .fn()
      .mockRejectedValueOnce({ codigo: 'DESTINO_OCUPADO', mensaje: 'x' })
      .mockResolvedValueOnce({ trabajoId: 't-1' })
    const api = crearApiExportacionFalsa({ iniciar })
    const { iniciada } = montar({ exportacion: api })
    await formulario()
    const exportar = screen.getByRole('button', { name: 'Exportar' })
    await waitFor(() => expect(exportar).toBeEnabled())
    fireEvent.click(exportar)
    await screen.findByText('Ya se está exportando un video a ese archivo.')
    expect(iniciar).toHaveBeenCalledWith({
      cancionId: ID,
      formato: 'mkv_av1',
      ancho: 1920,
      alto: 1080,
      fps: 30,
      audio: 'instrumental',
      destinoId: ID_DESTINO
    })
    expect(iniciada).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    await waitFor(() => expect(iniciada).toHaveBeenCalledWith('t-1', ID))
  })

  it('durante la validación el primario dice «Exportando…»', async () => {
    let resolver: (v: { trabajoId: string }) => void = () => undefined
    const iniciar = () => new Promise<{ trabajoId: string }>((r) => (resolver = r))
    montar({ exportacion: crearApiExportacionFalsa({ iniciar }) })
    await formulario()
    const exportar = screen.getByRole('button', { name: 'Exportar' })
    await waitFor(() => expect(exportar).toBeEnabled())
    fireEvent.click(exportar)
    await screen.findByRole('button', { name: /Exportando…/ })
    await act(async () => resolver({ trabajoId: 't' }))
  })

  it('mientras los perfiles tardan, el primario está inactivo y se explica la espera', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const perfiles = new Promise(() => undefined)
      montar({ exportacion: crearApiExportacionFalsa({ perfiles: () => perfiles }) })
      expect(screen.getByRole('button', { name: 'Exportar' })).toBeDisabled()
      await act(async () => {
        vi.advanceTimersByTime(400)
      })
      expect(screen.getByText('Comprobando qué puede exportar tu equipo…')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('DialogoExportacion · sin perfiles (F)', () => {
  it('con RUNTIME_NO_DISPONIBLE ofrece reparar el motor de audio', async () => {
    montar({
      exportacion: crearApiExportacionFalsa({
        perfiles: () => Promise.reject({ codigo: 'RUNTIME_NO_DISPONIBLE', mensaje: 'sin motor' })
      })
    })
    expect(await screen.findByText('Este equipo no puede crear videos.')).toBeInTheDocument()
    expect(screen.getByText(/Falta una parte del motor/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reparar el motor de audio' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Copiar detalles' })).toBeVisible()
  })

  it('con SIN_CODIFICADOR en todos los perfiles explica la falta del codificador y solo se puede cerrar', async () => {
    const { alCerrar } = montar({
      exportacion: crearApiExportacionFalsa({ perfiles: perfilesDePrueba(() => 'codificador') })
    })
    expect(await screen.findByText(/Falta el codificador de video/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reparar el motor de audio' })).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(alCerrar).toHaveBeenCalled()
  })

  it('con todos «no comprobado» pide reintentar o reiniciar', async () => {
    montar({
      exportacion: crearApiExportacionFalsa({ perfiles: perfilesDePrueba(() => 'no_comprobado') })
    })
    expect(
      await screen.findByText(/No se pudo comprobar qué videos puede crear/)
    ).toBeInTheDocument()
  })
})
