import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  crearApiExportacionFalsa,
  destinoDePrueba,
  exportacionCompletada,
  exportacionDePrueba,
  exportacionEnCola,
  exportacionFallida,
  ID_TRABAJO,
  progresoDePrueba,
  type ApiExportacionFalsa
} from '@shared/__fixtures__/exportacion'
import type { ExportacionIpc } from '@shared/exportacion'
import { ContenedorToasts } from '../componentes/Toasts'
import { cerrarTodosLosToasts } from '../componentes/gestorToasts'
import { SesionContexto, sesionVacia } from '../sesion/ProveedorSesion'
import { useExportaciones } from './contexto'
import { instalarApiExportacion } from './pruebas'
import { ProveedorExportacion } from './ProveedorExportacion'

const CANCION = 'cancion-1'

function Disparador() {
  const { abrir } = useExportaciones()
  return (
    <>
      <button onClick={() => abrir({ cancionId: CANCION })}>Abrir</button>
      <button onClick={() => abrir({ cancionId: CANCION, trabajoId: ID_TRABAJO })}>Reabrir</button>
    </>
  )
}

async function montar(
  api: ApiExportacionFalsa = crearApiExportacionFalsa(),
  opciones: Parameters<typeof instalarApiExportacion>[0] = {}
) {
  instalarApiExportacion({ exportacion: api, ...opciones })
  const vista = render(
    <SesionContexto.Provider value={sesionVacia}>
      <ProveedorExportacion>
        <Disparador />
      </ProveedorExportacion>
      <ContenedorToasts />
    </SesionContexto.Provider>
  )
  // `estado()` inicial.
  await act(async () => undefined)
  return { api, ...vista }
}

const emitir = (api: ApiExportacionFalsa, e: ExportacionIpc) => act(() => api.emitirCambio(e))
const doble = (e: Partial<ExportacionIpc>) => exportacionDePrueba({ cancionId: CANCION, ...e })

beforeEach(() => {
  cerrarTodosLosToasts()
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
})
afterEach(() => vi.restoreAllMocks())

describe('exportación en curso (B)', () => {
  it('muestra los tres subpasos, el porcentaje, la posición y el tiempo restante', async () => {
    const api = crearApiExportacionFalsa({ estado: [doble({})] })
    await montar(api)
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
    const d = await screen.findByRole('dialog', { name: 'Exportando video' })
    expect(d).toHaveTextContent('Preparar la canción')
    expect(d).toHaveTextContent('Crear el video')
    expect(d).toHaveTextContent('Terminar el archivo')
    expect(d).toHaveTextContent('Creando el video… 50 %')
    expect(d).toHaveTextContent('0:20 de 0:40')
    expect(d).toHaveTextContent('menos de 1 minuto')
    expect(d).toHaveTextContent('1920 × 1080 · 30 FPS · Solo instrumental · MKV')
    expect(screen.getByRole('progressbar', { name: 'Crear el video' })).toHaveAttribute(
      'aria-valuenow',
      '50'
    )
    expect(screen.getByRole('button', { name: 'Seguir en segundo plano' })).toHaveFocus()
  })

  it('el porcentaje no retrocede con un evento atrasado', async () => {
    const api = crearApiExportacionFalsa({ estado: [doble({})] })
    await montar(api)
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
    await screen.findByText('Creando el video… 50 %')
    act(() => api.emitirProgreso(progresoDePrueba({ valor: 0.3, fotograma: 360 })))
    expect(screen.getByText('Creando el video… 50 %')).toBeInTheDocument()
    act(() => api.emitirProgreso(progresoDePrueba({ valor: 0.8, fotograma: 960 })))
    expect(screen.getByText('Creando el video… 80 %')).toBeInTheDocument()
  })

  it('«Seguir en segundo plano» y Esc cierran sin cancelar', async () => {
    const api = crearApiExportacionFalsa({ estado: [doble({})] })
    await montar(api)
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Seguir en segundo plano' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
    await screen.findByRole('dialog')
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.llamadas.some((l) => l[0] === 'cancelar')).toBe(false)
  })

  it('confirma la cancelación en línea (B3), con Esc que vuelve, y pasa a B4 y al cerrar con aviso', async () => {
    const api = crearApiExportacionFalsa({ estado: [doble({})] })
    await montar(api)
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar exportación' }))
    expect(screen.getByText('¿Cancelar la exportación?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seguir exportando' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByText('¿Cancelar la exportación?')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Exportando video' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar exportación' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancelar exportación' }).at(-1)!)
    await screen.findByText('Cancelando y borrando el archivo temporal…')
    expect(api.llamadas.filter((l) => l[0] === 'cancelar')).toEqual([['cancelar', ID_TRABAJO]])
    expect(screen.getByRole('button', { name: 'Seguir en segundo plano' })).toBeDisabled()
    await emitir(api, doble({ estado: 'terminada', resultado: 'cancelada', progreso: null }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // El toast y el anuncio de la región educada llevan el mismo texto.
    expect(screen.getAllByText('Exportación cancelada.')).toHaveLength(2)
  })

  it('en la confirmación avisa de que el archivo previo no se toca solo si existía', async () => {
    const api = crearApiExportacionFalsa({
      destinoPropuesto: destinoDePrueba({ existe: true }),
      iniciar: { trabajoId: ID_TRABAJO },
      estado: [doble({})]
    })
    await montar(api, { cancion: undefined })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    // La canción de la API ya está en curso: el diálogo se abre en su estado y no en el formulario.
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar exportación' }))
    expect(screen.queryByText('El archivo que ya había con ese nombre no se toca.')).toBeNull()
  })
})

describe('en cola (B2)', () => {
  it('explica detrás de qué exportación espera y la quita sin confirmar', async () => {
    const otra = doble({
      trabajoId: 'b0000000-0000-4000-8000-000000000009',
      cancionId: 'otra',
      titulo: 'La flaca'
    })
    const api = crearApiExportacionFalsa({
      estado: [otra, { ...exportacionEnCola(), cancionId: CANCION }]
    })
    await montar(api)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    await screen.findByText('En cola: empezará cuando termine la exportación de «La flaca».')
    expect(screen.getByRole('button', { name: 'Seguir en segundo plano' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar de la cola' }))
    expect(api.llamadas.filter((l) => l[0] === 'cancelar')).toEqual([['cancelar', ID_TRABAJO]])
    await emitir(api, doble({ estado: 'terminada', resultado: 'cancelada', progreso: null }))
    // En cola → «quitada», no «cancelada».
    expect(
      screen.getByText('«Canción de prueba» ya no está en la cola de exportación.')
    ).toBeInTheDocument()
  })
})

describe('resultado con el diálogo abierto (C y D)', () => {
  it('éxito: muestra los datos y enfoca «Mostrar en la carpeta»', async () => {
    const api = crearApiExportacionFalsa({ estado: [doble({})] })
    await montar(api)
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
    await screen.findByRole('dialog', { name: 'Exportando video' })
    await emitir(api, { ...exportacionCompletada(), cancionId: CANCION })
    const d = await screen.findByRole('dialog', { name: 'Video exportado' })
    expect(d).toHaveTextContent(
      'Canción de prueba (karaoke).mkv'.replace('Canción de prueba', 'Canción de prueba — Artista')
    )
    expect(d).toHaveTextContent('1920 × 1080 · 30 FPS · MKV')
    expect(d).toHaveTextContent('0:40')
    expect(d).toHaveTextContent('3 MB')
    expect(d).toHaveTextContent('En /home/usuario/Videos')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mostrar en la carpeta' })).toHaveFocus()
    )
    expect(screen.queryByText('«Canción de prueba»: video exportado.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar en la carpeta' }))
    expect(api.llamadas).toContainEqual(['mostrarEnCarpeta', { trabajoId: ID_TRABAJO }])
    expect(screen.getByText('Video exportado.')).toBeInTheDocument()
  })

  it.each([
    ['SIN_ESPACIO', 'No queda espacio en el disco.', ['Cambiar opciones', 'Reintentar']],
    [
      'DESTINO_NO_DISPONIBLE',
      'No se puede guardar en esa carpeta.',
      ['Cambiar opciones', 'Reintentar']
    ],
    ['CANCION_NO_DISPONIBLE', 'No se encuentran las pistas de esta canción.', ['Cerrar']],
    [
      'PERFIL_NO_SOPORTADO',
      'Tu equipo no puede crear el video con estas opciones.',
      ['Cambiar opciones']
    ],
    ['MEMORIA_INSUFICIENTE', 'Tu equipo se quedó sin memoria.', ['Cambiar opciones', 'Reintentar']],
    ['RUNTIME_NO_DISPONIBLE', 'Hay que reparar el motor de audio.', ['Reparar el motor de audio']],
    ['SIN_CODIFICADOR', 'Este equipo no puede crear videos en este formato.', ['Cambiar opciones']],
    ['ERROR_INTERNO', 'Algo salió mal al crear el video.', ['Reintentar']]
  ] as const)(
    'fallo %s: título, explicación, posición y acciones',
    async (codigo, titulo, botones) => {
      const fallo = doble({
        estado: 'terminada',
        resultado: 'error',
        progreso: null,
        error: { codigo, mensaje: 'detalle', posicionMs: 12_000 }
      })
      const api = crearApiExportacionFalsa({ estado: [fallo] })
      await montar(api)
      fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
      const d = await screen.findByRole('dialog', { name: 'No se pudo exportar el video' })
      expect(screen.getByRole('alert')).toHaveTextContent(titulo)
      expect(d).toHaveTextContent('Se detuvo en 0:12 de 0:40.')
      for (const b of botones) expect(screen.getByRole('button', { name: b })).toBeVisible()
      expect(screen.getByRole('button', { name: 'Copiar detalles' })).toBeVisible()
      if (!(botones as readonly string[]).includes('Reintentar')) {
        expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
      }
    }
  )

  it.each([
    ['SIN_ESPACIO', undefined, 'Reintentar'],
    ['DESTINO_NO_DISPONIBLE', undefined, 'Reintentar'],
    ['CANCION_NO_DISPONIBLE', undefined, 'Cerrar'],
    ['PERFIL_NO_SOPORTADO', undefined, 'Cambiar opciones'],
    ['MEMORIA_INSUFICIENTE', undefined, 'Reintentar'],
    ['RUNTIME_NO_DISPONIBLE', undefined, 'Reparar el motor de audio'],
    ['SIN_CODIFICADOR', undefined, 'Cambiar opciones'],
    ['ERROR_INTERNO', undefined, 'Reintentar'],
    ['PERFIL_NO_SOPORTADO', false, 'Cambiar opciones'],
    ['PERFIL_NO_SOPORTADO', true, 'Reintentar']
  ] as const)(
    'V34: %s (captura reintentable: %s) enfoca «%s»',
    async (codigo, reintentable, foco) => {
      const fallo = doble({
        estado: 'terminada',
        resultado: 'error',
        progreso: null,
        error: {
          codigo,
          mensaje: 'x',
          posicionMs: null,
          ...(reintentable === undefined ? {} : { detalle: { causa: 'captura', reintentable } })
        }
      })
      await montar(crearApiExportacionFalsa({ estado: [fallo] }))
      fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
      await screen.findByRole('dialog', { name: 'No se pudo exportar el video' })
      await waitFor(() => expect(screen.getByRole('button', { name: foco })).toHaveFocus())
    }
  )

  it('un fallo de captura que no se arregla (V33) explica el tamaño y no ofrece reintentar', async () => {
    const fallo = doble({
      estado: 'terminada',
      resultado: 'error',
      progreso: null,
      ancho: 3840,
      alto: 2160,
      error: {
        codigo: 'PERFIL_NO_SOPORTADO',
        mensaje: 'x',
        posicionMs: null,
        detalle: { causa: 'captura', reintentable: false }
      }
    })
    await montar(crearApiExportacionFalsa({ estado: [fallo] }))
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('Tu equipo no puede crear el video a este tamaño.')
    expect(aviso).toHaveTextContent('No consigue preparar la imagen a 3840 × 2160.')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
  })

  it('un fallo de captura pasajero (V33) ofrece reintentar', async () => {
    const fallo = doble({
      estado: 'terminada',
      resultado: 'error',
      progreso: null,
      error: {
        codigo: 'PERFIL_NO_SOPORTADO',
        mensaje: 'x',
        posicionMs: null,
        detalle: { causa: 'captura', reintentable: true }
      }
    })
    await montar(crearApiExportacionFalsa({ estado: [fallo] }))
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo preparar la imagen del video.'
    )
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  })

  it('un fallo antes del primer fotograma lo dice', async () => {
    const fallo = doble({
      estado: 'terminada',
      resultado: 'error',
      progreso: null,
      error: { codigo: 'ERROR_INTERNO', mensaje: 'x', posicionMs: null }
    })
    await montar(crearApiExportacionFalsa({ estado: [fallo] }))
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
    await screen.findByText('Se detuvo mientras preparaba la canción.')
  })

  it('«Reintentar» exporta con las mismas opciones y una instantánea nueva', async () => {
    const fallo = doble({
      estado: 'terminada',
      resultado: 'error',
      progreso: null,
      formato: 'webm_vp9',
      ancho: 1280,
      alto: 720,
      fps: 24,
      audio: 'instrumental_voz',
      error: { codigo: 'SIN_ESPACIO', mensaje: 'x', posicionMs: 5000 }
    })
    const api = crearApiExportacionFalsa({
      estado: [fallo],
      iniciar: { trabajoId: 'b0000000-0000-4000-8000-0000000000aa' }
    })
    await montar(api)
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() =>
      expect(api.llamadas.find((l) => l[0] === 'iniciar')?.[1]).toMatchObject({
        cancionId: CANCION,
        formato: 'webm_vp9',
        ancho: 1280,
        alto: 720,
        fps: 24,
        audio: 'instrumental_voz'
      })
    )
    // El destino sale del trabajo fallido: mismo nombre aunque se hubiera cambiado a mano (0133).
    expect(api.llamadas.find((l) => l[0] === 'destinoPropuesto')?.[1]).toMatchObject({
      cancionId: CANCION,
      formato: 'webm_vp9',
      desdeTrabajoId: ID_TRABAJO
    })
  })

  it('«Tardó…» sale de los datos de main, aunque este diálogo no lanzó la exportación', async () => {
    const hecha = doble({
      ...exportacionCompletada(),
      iniciadaEn: '2026-11-20T10:00:00.000Z',
      terminadaEn: '2026-11-20T10:07:12.000Z'
    })
    await montar(crearApiExportacionFalsa({ estado: [hecha] }))
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
    expect(await screen.findByRole('dialog', { name: 'Video exportado' })).toHaveTextContent(
      'Tardó 7 min 12 s.'
    )
  })

  it('el archivo conservado sale de `destinoExistia`, no de lo que lanzó este diálogo', async () => {
    const fallo = doble({
      estado: 'terminada',
      resultado: 'error',
      progreso: null,
      destinoExistia: true,
      error: { codigo: 'SIN_ESPACIO', mensaje: 'x', posicionMs: 5000 }
    })
    await montar(crearApiExportacionFalsa({ estado: [fallo] }))
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El archivo que ya había con ese nombre no se ha tocado.'
    )
  })

  it('«Cambiar opciones» vuelve al formulario con las opciones anteriores', async () => {
    const fallo = doble({
      estado: 'terminada',
      resultado: 'error',
      progreso: null,
      formato: 'webm_vp9',
      ancho: 1280,
      alto: 720,
      fps: 24,
      error: { codigo: 'SIN_ESPACIO', mensaje: 'x', posicionMs: 5000 }
    })
    await montar(crearApiExportacionFalsa({ estado: [fallo] }), { config: { fps: 60 } })
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar opciones' }))
    await screen.findByRole('radiogroup', { name: 'Audio' })
    expect(screen.getByRole('radio', { name: 'WebM (VP9 + Opus)' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Fotogramas por segundo: 24' })).toBeChecked()
    expect(screen.getByRole('button', { name: /Resolución: 1280 × 720/ })).toBeVisible()
  })
})

describe('resultado con el diálogo cerrado', () => {
  it('éxito: toast con «Mostrar en la carpeta» y, si ya no existe, aviso', async () => {
    const api = crearApiExportacionFalsa({
      estado: [doble({})],
      mostrarEnCarpeta: () => Promise.reject({ codigo: 'DESTINO_NO_DISPONIBLE', mensaje: 'x' })
    })
    await montar(api)
    await emitir(api, { ...exportacionCompletada(), cancionId: CANCION })
    expect(screen.getByText('«Canción de prueba»: video exportado.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar en la carpeta' }))
    await screen.findByText('El video ya no está en esa carpeta.')
  })

  it('fallo: toast persistente con [Ver] que abre D', async () => {
    const api = crearApiExportacionFalsa({ estado: [doble({})] })
    await montar(api)
    await emitir(api, { ...exportacionFallida('MEMORIA_INSUFICIENTE'), cancionId: CANCION })
    expect(
      screen.getByText('«Canción de prueba»: no se pudo exportar el video.')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }))
    expect(
      await screen.findByRole('dialog', { name: 'No se pudo exportar el video' })
    ).toHaveTextContent('Tu equipo se quedó sin memoria.')
  })

  it('limpieza fallida: toast con «Mostrar en la carpeta»', async () => {
    const api = crearApiExportacionFalsa({ estado: [doble({})] })
    await montar(api)
    await emitir(
      api,
      doble({
        estado: 'terminada',
        resultado: 'cancelada',
        progreso: null,
        limpiezaFallida: true
      })
    )
    // El resultado real mantiene su aviso normal y se suma el de la limpieza.
    // (toast y anuncio de la región educada)
    expect(screen.getAllByText('Exportación cancelada.')).toHaveLength(2)
    expect(
      screen.getByText('No se pudo borrar un archivo temporal. Puedes borrarlo a mano.')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar en la carpeta' }))
    expect(api.llamadas).toContainEqual(['mostrarEnCarpeta', { trabajoId: ID_TRABAJO }])
  })

  it('tras una caída avisa una sola vez, con el título y la acción de exportar', async () => {
    const aviso = {
      avisoId: 'a0000000-0000-4000-8000-000000000001',
      tipo: 'interrumpida' as const,
      cancionId: CANCION,
      titulo: 'Canción de prueba'
    }
    // Pendiente desde antes de montar; el mismo aviso llegando también por el evento no se repite.
    const api = crearApiExportacionFalsa({ avisosPendientes: [aviso] })
    await montar(api)
    act(() => api.emitirAviso(aviso))
    expect(
      screen.getAllByText(
        'La exportación de «Canción de prueba» no terminó porque Shinobi Karaoke se cerró.'
      )
    ).toHaveLength(1)
    expect(screen.queryByText(/no se pudo exportar el video/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Exportar video…' }))
    expect(await screen.findByRole('dialog', { name: 'Exportar video' })).toBeInTheDocument()
  })

  it('aviso de limpieza fallida al arrancar: «Mostrar en la carpeta» usa el avisoId', async () => {
    const aviso = {
      avisoId: 'a0000000-0000-4000-8000-000000000002',
      tipo: 'limpieza_fallida' as const,
      cancionId: CANCION,
      titulo: 'Canción de prueba'
    }
    const api = crearApiExportacionFalsa()
    await montar(api)
    act(() => api.emitirAviso(aviso))
    expect(
      screen.getByText('No se pudo borrar un archivo temporal. Puedes borrarlo a mano.')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar en la carpeta' }))
    expect(api.llamadas).toContainEqual(['mostrarEnCarpeta', { avisoId: aviso.avisoId }])
  })

  it('con la ventana sin foco guarda los avisos hasta que vuelve', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    const api = crearApiExportacionFalsa({ estado: [doble({})] })
    await montar(api)
    await emitir(api, { ...exportacionCompletada(), cancionId: CANCION })
    expect(screen.queryByText('«Canción de prueba»: video exportado.')).not.toBeInTheDocument()
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(screen.getByText('«Canción de prueba»: video exportado.')).toBeInTheDocument()
  })
})

describe('anuncios', () => {
  it('anuncia solo los hitos en la región educada', async () => {
    const api = crearApiExportacionFalsa()
    const { container } = await montar(api)
    const region = () => container.ownerDocument.querySelector('[data-anuncios-exportacion]')!
    await emitir(api, doble({ progreso: null }))
    expect(region()).toHaveTextContent('Exportando «Canción de prueba».')
    act(() =>
      api.emitirProgreso(progresoDePrueba({ fase: 'preparando', valor: null, fotograma: 0 }))
    )
    expect(region()).toHaveTextContent('Preparando la canción…')
    act(() => api.emitirProgreso(progresoDePrueba({ valor: 0.2, fotograma: 240 })))
    expect(region()).toHaveTextContent('Creando el video…')
    act(() => api.emitirProgreso(progresoDePrueba({ valor: 0.3, fotograma: 360 })))
    expect(region()).toHaveTextContent('Creando el video: 25 %.')
    act(() => api.emitirProgreso(progresoDePrueba({ valor: 0.31, fotograma: 372 })))
    expect(region()).toHaveTextContent('Creando el video: 25 %.')
    expect(region()).toHaveAttribute('aria-live', 'polite')
  })
})
