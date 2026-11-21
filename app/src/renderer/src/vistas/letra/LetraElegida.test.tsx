import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Cancion } from '@shared/cancion'
import type { ElementoLetra, Letra as LetraDatos } from '@shared/letra'
import type { ResumenCancionIpc } from '@shared/ipc'
import { aplicarTextoEditado, letraATexto } from '@shared/letras'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { resumenPrueba } from '../biblioteca/resumenPrueba'
import { apiLetrasFalsa, lineasPorLinea, lineasPorPalabra, lineasTexto } from './fixturesApi'
import { Letra } from './Letra'

interface Opciones {
  origen?: LetraDatos['origen']
  lineas?: ElementoLetra[]
  estado?: ResumenCancionIpc['estado']
}

function montar(o: Opciones = {}) {
  const base = apiLetrasFalsa()
  let letra: LetraDatos = {
    origen: o.origen ?? 'lrclib',
    lrclib_id: null,
    offset_ms: 0,
    lineas: o.lineas ?? lineasPorLinea()
  }
  const estado = o.estado ?? 'borrador'
  const llamadas: string[] = []
  const editarTexto = vi.fn(async ({ texto }: { cancionId: string; texto: string }) => {
    llamadas.push(texto)
    const nueva = aplicarTextoEditado(letra, texto)
    if (estado === 'lista' && nueva.lineas.length === 0) {
      throw { codigo: 'ARGUMENTOS_NO_VALIDOS', mensaje: '' }
    }
    letra = nueva
    return resumenPrueba({ estado })
  })
  const eventos: ((ev: { id: string; eliminada?: boolean; resumen: ResumenCancionIpc }) => void)[] =
    []
  const abrirEnlace = vi.fn().mockResolvedValue(undefined)
  const buscar = vi.fn(base.letras.buscar)
  window.shinobi = {
    biblioteca: {
      listar: () => Promise.resolve([resumenPrueba({ estado })]),
      obtener: () =>
        Promise.resolve({
          metadatos: { titulo: 'Canción inventada', artista: 'Artista inventado', album: null },
          letra
        } as unknown as Cancion)
    },
    alCambiarCancion: (cb: never) => {
      eventos.push(cb)
      return () => undefined
    },
    sistema: { abrirEnlace },
    letras: { ...base.letras, editarTexto, buscar }
  } as never
  const ir = vi.fn<(v: Vista) => void>()
  const utils = render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: 'c1', paso: 'letra' }, ir }}
    >
      <TrabajosContexto.Provider value={{ trabajos: [], progreso: {}, terminado: false }}>
        <Letra id="c1" />
      </TrabajosContexto.Provider>
    </NavegacionContexto.Provider>
  )
  return {
    ir,
    editarTexto,
    llamadas,
    buscar,
    abrirEnlace,
    eventos,
    ...utils,
    cambiarLetra: (l: LetraDatos) => {
      letra = l
    }
  }
}

const area = async (): Promise<HTMLTextAreaElement> =>
  (await screen.findByLabelText('Texto de la letra')) as HTMLTextAreaElement

describe('Letra elegida (C): resumen', () => {
  it.each([
    ['lrclib', 'de LRCLIB'],
    ['manual', 'pegada'],
    ['archivo', 'de un archivo']
  ] as const)('origen %s', async (origen, texto) => {
    montar({ origen })
    expect(
      await screen.findByText(`Letra actual · ${texto} · sincronizada por línea · 3 líneas`)
    ).toBeInTheDocument()
  })

  it('las cuatro sincronías', async () => {
    const parte = lineasPorLinea()
    parte[1] = { ...parte[1]!, inicio_ms: null }
    const casos: [ElementoLetra[], string][] = [
      [lineasPorPalabra(), 'sincronizada por palabra · 2 líneas'],
      [lineasPorLinea(), 'sincronizada por línea · 3 líneas'],
      [parte, 'sincronizada en parte · 3 líneas'],
      [lineasTexto(), 'sin sincronizar · 3 líneas']
    ]
    for (const [lineas, texto] of casos) {
      const { unmount } = montar({ lineas, origen: 'manual' })
      expect(await screen.findByText(`Letra actual · pegada · ${texto}`)).toBeInTheDocument()
      unmount()
    }
  })

  it('1 línea en singular', async () => {
    montar({ lineas: lineasPorLinea().slice(0, 1) })
    expect(
      await screen.findByText('Letra actual · de LRCLIB · sincronizada por línea · 1 línea')
    ).toBeInTheDocument()
  })

  it('la atribución solo aparece con LRCLIB y abre el enlace', async () => {
    const { abrirEnlace, unmount } = montar({ origen: 'lrclib' })
    fireEvent.click(await screen.findByRole('link', { name: 'Letra: LRCLIB' }))
    expect(abrirEnlace).toHaveBeenCalledWith('https://lrclib.net')
    unmount()
    montar({ origen: 'manual' })
    await area()
    expect(screen.queryByRole('link', { name: 'Letra: LRCLIB' })).toBeNull()
  })

  it('el área trae el texto de la letra y el aviso de edición está siempre', async () => {
    montar({ lineas: lineasTexto() })
    expect((await area()).value).toBe(letraATexto({ lineas: lineasTexto() }))
    expect(screen.getByText(/esa línea tendrá que volver a sincronizarse/)).toBeInTheDocument()
  })
})

describe('Letra elegida (C): autoguardado', () => {
  it('guarda al salir del área (blur) y no repite sin cambios', async () => {
    const { editarTexto } = montar()
    const a = await area()
    fireEvent.change(a, { target: { value: `${a.value}\nOtro verso` } })
    expect(editarTexto).not.toHaveBeenCalled()
    fireEvent.blur(a)
    await waitFor(() => expect(editarTexto).toHaveBeenCalledTimes(1))
    expect(editarTexto.mock.calls[0]?.[0]).toEqual({
      cancionId: 'c1',
      texto: `${a.value}`
    })
    fireEvent.blur(a)
    await act(async () => {})
    expect(editarTexto).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/sincronizada en parte · 4 líneas/)).toBeInTheDocument()
  })

  it('guarda tras 1 s sin escribir', async () => {
    vi.useFakeTimers()
    try {
      const { editarTexto } = montar()
      await act(async () => {})
      const a = screen.getByLabelText('Texto de la letra')
      fireEvent.change(a, { target: { value: 'uno' } })
      await act(async () => {
        vi.advanceTimersByTime(900)
      })
      fireEvent.change(a, { target: { value: 'uno dos' } })
      await act(async () => {
        vi.advanceTimersByTime(900)
      })
      expect(editarTexto).not.toHaveBeenCalled()
      await act(async () => {
        vi.advanceTimersByTime(200)
      })
      expect(editarTexto).toHaveBeenCalledTimes(1)
      expect(editarTexto.mock.calls[0]?.[0].texto).toBe('uno dos')
    } finally {
      vi.useRealTimers()
    }
  })

  it('guarda al desmontar si hay cambios pendientes', async () => {
    const { editarTexto, unmount } = montar()
    const a = await area()
    fireEvent.change(a, { target: { value: 'cambio pendiente' } })
    unmount()
    expect(editarTexto).toHaveBeenCalledTimes(1)
    expect(editarTexto.mock.calls[0]?.[0].texto).toBe('cambio pendiente')
  })

  it('no guarda al desmontar si no hay cambios', async () => {
    const { editarTexto, unmount } = montar()
    await area()
    unmount()
    expect(editarTexto).not.toHaveBeenCalled()
  })

  it('no reescribe el área con el foco aunque el guardado normalice', async () => {
    const { editarTexto } = montar()
    const a = await area()
    a.focus()
    fireEvent.change(a, { target: { value: 'uno\n\n\n\ndos' } })
    fireEvent.blur(a)
    await waitFor(() => expect(editarTexto).toHaveBeenCalled())
    a.focus()
    await act(async () => {})
    expect(a.value).toBe('uno\n\n\n\ndos')
  })
})

describe('Letra elegida (C): avisos', () => {
  it('let.edicion.marcas aparece y desaparece al escribir o borrar una marca', async () => {
    montar()
    const a = await area()
    const marcas = /Aquí las marcas como «\[01:23\.45\]» se guardan como texto/
    expect(screen.queryByText(marcas)).toBeNull()
    fireEvent.change(a, { target: { value: `${a.value}\n[01:23.45] verso` } })
    expect(screen.getByText(marcas)).toBeInTheDocument()
    fireEvent.change(a, { target: { value: 'verso [01:23.45] al final' } })
    expect(screen.queryByText(marcas)).toBeNull()
  })

  it('las marcas se guardan como texto y no bloquean el guardado', async () => {
    const { editarTexto } = montar()
    const a = await area()
    fireEvent.change(a, { target: { value: '[00:10] verso' } })
    fireEvent.blur(a)
    await waitFor(() => expect(editarTexto).toHaveBeenCalledTimes(1))
  })
})

describe('Letra elegida (C): cero líneas', () => {
  it('en borrador guarda, sigue en C con let.actual.vacia y "Ir al editor" inactivo', async () => {
    const { editarTexto, ir } = montar({ estado: 'borrador' })
    const a = await area()
    fireEvent.change(a, { target: { value: '' } })
    fireEvent.blur(a)
    await waitFor(() => expect(editarTexto).toHaveBeenCalledTimes(1))
    expect(
      await screen.findByText('Sin letra todavía. Escribe o pega aquí la letra, o busca otra.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Letra actual/)).toBeNull()
    const boton = screen.getByRole('button', { name: /Ir al editor/ })
    expect(boton).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(boton)
    expect(ir).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Texto de la letra')).toBeInTheDocument()
  })

  it('en lista no guarda: avisa sin borrar lo escrito y se va al escribir una línea', async () => {
    const { editarTexto } = montar({ estado: 'lista' })
    const a = await area()
    fireEvent.change(a, { target: { value: '  ' } })
    fireEvent.blur(a)
    expect(
      await screen.findByText(
        'Una canción lista necesita al menos una línea de letra. Este cambio no se ha guardado.'
      )
    ).toBeInTheDocument()
    expect(a.value).toBe('  ')
    fireEvent.change(a, { target: { value: 'ya hay una línea' } })
    expect(screen.queryByText(/Una canción lista necesita/)).toBeNull()
    fireEvent.blur(a)
    await waitFor(() => expect(editarTexto).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/· 1 línea$/)).toBeInTheDocument()
    expect(screen.queryByText(/Una canción lista necesita/)).toBeNull()
  })
})

describe('Letra elegida (C): botones y cambios externos', () => {
  it('"Buscar otra letra" lanza la búsqueda sin caché', async () => {
    const { buscar } = montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Buscar otra letra' }))
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    expect(buscar).toHaveBeenCalledTimes(1)
    expect(buscar.mock.calls[0]?.[0]).toMatchObject({ cancionId: 'c1', usarCache: false })
  })

  it('"Ir al editor" navega', async () => {
    const { ir } = montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Ir al editor' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c1', paso: 'editor' })
  })

  it('"Importar archivo" importa y C muestra los renglones ignorados hasta cerrarlos', async () => {
    const { letras } = apiLetrasFalsa()
    montar()
    window.shinobi.letras = {
      ...window.shinobi.letras,
      leerArchivo: () =>
        Promise.resolve({
          cancelado: false as const,
          nombre: 'x.lrc',
          lineas: lineasPorPalabra(),
          sincronia: 'palabra' as const,
          ignoradas: 2
        }),
      guardar: letras.guardar
    }
    fireEvent.click(await screen.findByRole('button', { name: 'Importar archivo' }))
    // Pide confirmar la sustitución (la letra actual tiene líneas).
    fireEvent.click(await screen.findByRole('button', { name: /Sustituir/ }))
    expect(
      await screen.findByText('Hemos ignorado 2 renglones sin tiempo del archivo.')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Letra actual · de un archivo · sincronizada por palabra · 2 líneas/)
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar el aviso' }))
    expect(screen.queryByText(/Hemos ignorado/)).toBeNull()
  })

  it('una letra distinta llegada de fuera recarga el texto si no hay foco ni cambios', async () => {
    const { eventos, cambiarLetra } = montar()
    const a = await area()
    cambiarLetra({ origen: 'archivo', lrclib_id: null, offset_ms: 0, lineas: lineasTexto() })
    await act(async () => {
      eventos.forEach((cb) => cb({ id: 'c1', resumen: resumenPrueba() }))
    })
    await waitFor(() => expect(a.value).toBe(letraATexto({ lineas: lineasTexto() })), {
      timeout: 5000
    })
    expect(screen.getByText(/de un archivo · sin sincronizar · 3 líneas/)).toBeInTheDocument()
  })

  it('no recarga si el área tiene el foco', async () => {
    const { eventos, cambiarLetra } = montar()
    const a = await area()
    const antes = a.value
    a.focus()
    cambiarLetra({ origen: 'archivo', lrclib_id: null, offset_ms: 0, lineas: lineasTexto() })
    await act(async () => {
      eventos.forEach((cb) => cb({ id: 'c1', resumen: resumenPrueba() }))
    })
    expect(a.value).toBe(antes)
  })
})

it.each([
  { texto: 'é'.repeat((512 * 1024) / 2 + 1), limite: 'bytes' },
  { texto: 'línea\n'.repeat(5000) + 'otra', limite: 'renglones' }
])(
  'el límite de $limite conserva el texto sin enviar IPC y se limpia al corregir',
  async ({ texto }) => {
    const { editarTexto, unmount } = montar()
    const campo = await area()
    fireEvent.change(campo, { target: { value: texto } })
    fireEvent.blur(campo)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'El texto es demasiado largo para ser una letra. Este cambio no se ha guardado.'
    )
    expect(campo).toHaveValue(texto)
    expect(editarTexto).not.toHaveBeenCalled()
    fireEvent.change(campo, { target: { value: 'Solo un verso' } })
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.blur(campo)
    await waitFor(() => expect(editarTexto).toHaveBeenCalledTimes(1))
    fireEvent.change(campo, { target: { value: texto } })
    unmount()
    expect(editarTexto).toHaveBeenCalledTimes(1)
  }
)

it('muestra el aviso de tamaño si main rechaza un guardado por ese motivo', async () => {
  const { editarTexto, unmount } = montar()
  editarTexto.mockRejectedValueOnce({
    codigo: 'ARGUMENTOS_NO_VALIDOS',
    mensaje: 'El texto supera el límite.'
  })
  const campo = await area()
  fireEvent.change(campo, { target: { value: 'Un verso nuevo' } })
  fireEvent.blur(campo)
  expect(await screen.findByRole('alert')).toHaveTextContent('Este cambio no se ha guardado.')
  unmount()
  expect(editarTexto).toHaveBeenCalledTimes(1)
})
