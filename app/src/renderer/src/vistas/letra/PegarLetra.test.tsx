import { useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Cancion } from '@shared/cancion'
import type { ElementoLetra } from '@shared/letra'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { resumenPrueba } from '../biblioteca/resumenPrueba'
import {
  apiLetrasFalsa,
  lineasPorLinea,
  lineasTexto,
  type OpcionesApiLetrasFalsa
} from './fixturesApi'
import { BusquedaLetra } from './BusquedaLetra'
import { useImportarArchivo } from './importar'
import { Letra } from './Letra'
import { PegarLetra } from './PegarLetra'
import { existenteDe, useConfirmarSustituir } from './sustituir'

type Opciones = OpcionesApiLetrasFalsa

function montar(o: Opciones = {}) {
  const { letras, llamadas } = apiLetrasFalsa(o)
  const cancion = {
    metadatos: { titulo: 'Canción inventada', artista: 'Artista inventado', album: null },
    letra: null
  } as unknown as Cancion
  window.shinobi = {
    biblioteca: {
      listar: () => Promise.resolve([resumenPrueba()]),
      obtener: () => Promise.resolve(cancion)
    },
    alCambiarCancion: () => () => undefined,
    sistema: { abrirEnlace: vi.fn() },
    letras
  } as never
  const ir = vi.fn<(v: Vista) => void>()
  const ui = () => (
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: 'c1', paso: 'letra' }, ir }}
    >
      <TrabajosContexto.Provider value={{ trabajos: [], progreso: {}, terminado: false }}>
        <Letra id="c1" />
      </TrabajosContexto.Provider>
    </NavegacionContexto.Provider>
  )
  const r = render(ui())
  return { ir, llamadas, ...r }
}

const guardados = (l: { canal: string; args: unknown[] }[]) =>
  l.filter((x) => x.canal === 'guardar').map((x) => x.args[0] as Record<string, unknown>)

/** Abre B desde A (sin letra existente la vista empieza en A). */
async function abrirB(o: Opciones = {}) {
  const m = montar(o)
  fireEvent.click(await screen.findByRole('button', { name: 'Pegar la letra' }))
  const area = await screen.findByRole('textbox', { name: 'Letra' })
  return { ...m, area }
}

const escribir = (area: HTMLElement, texto: string) =>
  fireEvent.change(area, { target: { value: texto } })

const IMPORTAR = 'Importar archivo .lrc o .txt'

describe('Letra: pegar (B)', () => {
  it('muestra título, ayuda y área con el foco', async () => {
    const { area } = await abrirB()
    expect(screen.getByRole('heading', { name: 'Pega la letra' })).toBeInTheDocument()
    expect(screen.getByText(/Borra los renglones que no se cantan/)).toBeInTheDocument()
    await waitFor(() => expect(area).toHaveFocus())
  })

  it('el contador ignora renglones vacíos y estrofas; 0 líneas deshabilita', async () => {
    const { area } = await abrirB()
    const usar = screen.getByRole('button', { name: 'Usar esta letra' })
    expect(usar).toBeDisabled()
    expect(screen.getByText('0 líneas · se sincronizarán en el editor')).toBeInTheDocument()
    escribir(area, '\n\nuno\ndos\n\n\n\ntres\n\n')
    expect(await screen.findByText('3 líneas · se sincronizarán en el editor')).toBeInTheDocument()
    expect(usar).toBeEnabled()
    escribir(area, 'solo una')
    expect(await screen.findByText('1 línea · se sincronizarán en el editor')).toBeInTheDocument()
  })

  it('detecta LRC y avisa; ignoradas con 1 y con 2, nada con 0', async () => {
    const { area } = await abrirB()
    escribir(area, 'uno\ndos')
    await screen.findByText('2 líneas · se sincronizarán en el editor')
    expect(screen.queryByText(/Hemos detectado tiempos/)).toBeNull()

    escribir(area, '[00:01.0] uno\n[00:02.0] dos')
    expect(await screen.findByText(/Hemos detectado tiempos/)).toBeInTheDocument()
    expect(screen.queryByText(/Ignoraremos/)).toBeNull()

    escribir(area, '[00:01.0] uno\n[00:02.0] dos\n[00:03.0] tres\nsin tiempo')
    expect(await screen.findByText('Ignoraremos 1 renglón sin tiempo.')).toBeInTheDocument()

    escribir(area, '[00:01.0] uno\n[00:02.0] dos\n[00:03.0] tres\nsin a\nsin b')
    expect(await screen.findByText('Ignoraremos 2 renglones sin tiempo.')).toBeInTheDocument()
  })

  it('guarda texto plano como manual y sin sincronía', async () => {
    const { area, llamadas, ir } = await abrirB()
    escribir(area, 'uno\ndos')
    await screen.findByText('2 líneas · se sincronizarán en el editor')
    fireEvent.click(screen.getByRole('button', { name: 'Usar esta letra' }))
    expect(await screen.findByText(/^Letra actual · .* · 2 líneas$/)).toBeInTheDocument()
    const [g] = guardados(llamadas)
    expect(g).toMatchObject({ cancionId: 'c1', origen: 'manual', lrclib_id: null })
    const lineas = g!.lineas as { texto: string; inicio_ms: number | null }[]
    expect(lineas.map((l) => [l.texto, l.inicio_ms])).toEqual([
      ['uno', null],
      ['dos', null]
    ])
    expect(llamadas.some((x) => x.canal === 'leerArchivo')).toBe(false)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ir al editor' })).toHaveFocus())
    expect(ir).not.toHaveBeenCalled()
  })

  it('guarda un LRC conservando los tiempos', async () => {
    const { area, llamadas } = await abrirB()
    escribir(area, '[00:01.5] uno\n[00:03.0] dos')
    await screen.findByText(/Hemos detectado tiempos/)
    fireEvent.click(screen.getByRole('button', { name: 'Usar esta letra' }))
    await screen.findByText(/^Letra actual · .* · 2 líneas$/)
    const lineas = guardados(llamadas)[0]!.lineas as { inicio_ms: number | null }[]
    expect(lineas.map((l) => l.inicio_ms)).toEqual([1500, 3000])
  })

  it('Ctrl+Intro usa la letra', async () => {
    const { area, llamadas } = await abrirB()
    escribir(area, 'uno')
    await screen.findByText('1 línea · se sincronizarán en el editor')
    fireEvent.keyDown(area, { key: 'Enter', ctrlKey: true })
    await screen.findByText(/^Letra actual · .* · 1 línea$/)
    expect(guardados(llamadas)).toHaveLength(1)
  })

  it('conserva el texto al volver a los resultados y se descarta al salir de la vista', async () => {
    const { area, unmount } = await abrirB()
    escribir(area, 'uno\ndos')
    fireEvent.click(screen.getByRole('button', { name: 'Volver a los resultados' }))
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Letra' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Pegar la letra' }))
    expect(await screen.findByRole('textbox', { name: 'Letra' })).toHaveValue('uno\ndos')

    unmount()
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Pegar la letra' }))
    expect(await screen.findByRole('textbox', { name: 'Letra' })).toHaveValue('')
  })
})

describe('Letra: confirmar la sustitución sin letra previa', () => {
  it('con cero líneas no pregunta', async () => {
    const { area, llamadas } = await abrirB()
    escribir(area, 'uno')
    await screen.findByText('1 línea · se sincronizarán en el editor')
    fireEvent.click(screen.getByRole('button', { name: 'Usar esta letra' }))
    await screen.findByText(/^Letra actual · .* · 1 línea$/)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(guardados(llamadas)).toHaveLength(1)
  })
})

describe('Letra: importar', () => {
  it('cancelado no hace nada', async () => {
    const { llamadas } = montar({ archivo: { cancelado: true } })
    fireEvent.click(await screen.findByRole('button', { name: IMPORTAR }))
    await waitFor(() => expect(llamadas.some((x) => x.canal === 'leerArchivo')).toBe(true))
    expect(guardados(llamadas)).toHaveLength(0)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('válido guarda como archivo y pasa a C', async () => {
    const { llamadas } = montar()
    fireEvent.click(await screen.findByRole('button', { name: IMPORTAR }))
    await screen.findByText(/^Letra actual · .* · 3 líneas$/)
    expect(guardados(llamadas)).toEqual([
      expect.objectContaining({ cancionId: 'c1', origen: 'archivo', lrclib_id: null })
    ])
    expect(screen.queryByText(/Hemos ignorado/)).toBeNull()
  })

  it('ARCHIVO_SIN_LETRA: aviso en línea y nada se guarda', async () => {
    const { llamadas } = montar({ errorArchivo: true })
    fireEvent.click(await screen.findByRole('button', { name: IMPORTAR }))
    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('Este archivo no contiene letra que podamos leer.')
    expect(guardados(llamadas)).toHaveLength(0)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('también se importa desde B', async () => {
    const { llamadas } = await abrirB()
    fireEvent.click(screen.getByRole('button', { name: IMPORTAR }))
    await screen.findByText(/^Letra actual · .* · 3 líneas$/)
    expect(guardados(llamadas)[0]).toMatchObject({ origen: 'archivo' })
  })

  it('un LRC con ignoradas: C muestra el aviso (1 y 2)', async () => {
    const archivo = (n: number) => ({
      cancelado: false as const,
      nombre: 'x.lrc',
      lineas: lineasPorLinea(),
      sincronia: 'linea' as const,
      ignoradas: n
    })
    const a = montar({ archivo: archivo(2) })
    fireEvent.click(await screen.findByRole('button', { name: IMPORTAR }))
    expect(
      await screen.findByText('Hemos ignorado 2 renglones sin tiempo del archivo.')
    ).toBeInTheDocument()
    a.unmount()
    montar({ archivo: archivo(1) })
    fireEvent.click(await screen.findByRole('button', { name: IMPORTAR }))
    expect(
      await screen.findByText('Hemos ignorado 1 renglón sin tiempo del archivo.')
    ).toBeInTheDocument()
  })
})

// Con letra existente la vista abre en C (0086 añade "Buscar otra letra"), así que los tres
// caminos con diálogo (A, B, Importar) se ejercitan con un montaje directo de cada pieza.
function Arnes({ camino, existente }: { camino: 'A' | 'B' | 'I'; existente: ElementoLetra[] }) {
  const { confirmar, dialogo } = useConfirmarSustituir(existenteDe(existente))
  const { importar, errorArchivo } = useImportarArchivo('c1', confirmar, () => undefined)
  const [texto, setTexto] = useState('uno\ndos')
  return (
    <>
      {camino === 'A' && (
        <BusquedaLetra
          cancionId="c1"
          tituloInicial="t"
          artistaInicial="a"
          confirmar={confirmar}
          onUsada={() => undefined}
        />
      )}
      {camino === 'B' && (
        <PegarLetra
          cancionId="c1"
          texto={texto}
          onTexto={setTexto}
          confirmar={confirmar}
          onVolver={() => undefined}
          onImportar={() => undefined}
          onUsada={() => undefined}
        />
      )}
      {camino === 'I' && <button onClick={() => void importar()}>importar</button>}
      {errorArchivo && <p role="alert">error</p>}
      {dialogo}
    </>
  )
}

function montarArnes(camino: 'A' | 'B' | 'I', existente: ElementoLetra[], o: Opciones = {}) {
  const { letras, llamadas } = apiLetrasFalsa(o)
  window.shinobi = { letras, sistema: { abrirEnlace: vi.fn() } } as never
  render(<Arnes camino={camino} existente={existente} />)
  return llamadas
}

const BOTON: Record<'A' | 'B' | 'I', () => Promise<HTMLElement>> = {
  A: async () => {
    await screen.findByRole('listbox')
    return screen.getByRole('button', { name: 'Usar esta letra' })
  },
  B: async () => screen.getByRole('button', { name: 'Usar esta letra' }),
  I: async () => screen.getByRole('button', { name: 'importar' })
}

describe('Letra: diálogo de sustituir', () => {
  describe.each(['A', 'B', 'I'] as const)('desde %s', (camino) => {
    it.each([
      ['con sincronía', lineasPorLinea(), 'Perderás la sincronía que hayas hecho.'],
      ['sin sincronía', lineasTexto(), 'Se reemplazará el texto que tienes ahora.']
    ] as const)('%s: texto y foco en Cancelar; Cancelar no guarda', async (_n, previa, texto) => {
      const llamadas = montarArnes(camino, previa)
      fireEvent.click(await BOTON[camino]())
      const d = await screen.findByRole('dialog', { name: '¿Sustituir la letra actual?' })
      expect(within(d).getByText(texto)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(guardados(llamadas)).toHaveLength(0)
    })

    it('Esc no guarda y Sustituir guarda', async () => {
      const llamadas = montarArnes(camino, lineasTexto())
      fireEvent.click(await BOTON[camino]())
      await screen.findByRole('dialog')
      fireEvent.keyDown(document, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(guardados(llamadas)).toHaveLength(0)

      fireEvent.click(await BOTON[camino]())
      await screen.findByRole('dialog')
      fireEvent.click(screen.getByRole('button', { name: 'Sustituir' }))
      await waitFor(() => expect(guardados(llamadas)).toHaveLength(1))
    })

    it('sin líneas previas no hay diálogo', async () => {
      const llamadas = montarArnes(camino, [])
      fireEvent.click(await BOTON[camino]())
      await waitFor(() => expect(guardados(llamadas)).toHaveLength(1))
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('importar un archivo sin letra no pregunta y no guarda', async () => {
    const llamadas = montarArnes('I', lineasPorLinea(), { errorArchivo: true })
    fireEvent.click(await BOTON.I())
    await screen.findByRole('alert')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(guardados(llamadas)).toHaveLength(0)
  })

  it('importar cancelado no pregunta', async () => {
    const llamadas = montarArnes('I', lineasPorLinea(), { archivo: { cancelado: true } })
    fireEvent.click(await BOTON.I())
    await waitFor(() => expect(llamadas.some((x) => x.canal === 'leerArchivo')).toBe(true))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
