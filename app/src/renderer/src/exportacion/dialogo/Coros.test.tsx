import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { crearApiExportacionFalsa, exportacionDePrueba } from '@shared/__fixtures__/exportacion'
import { cancionDosCantantes, cancionUnCantanteConCoros } from '@shared/__fixtures__/reparto'
import type { Letra } from '@shared/letra'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { SesionContexto, sesionVacia } from '../../sesion/ProveedorSesion'
import { ExportacionContexto, useExportaciones } from '../contexto'
import { cancionIpcDePrueba, instalarApiExportacion } from '../pruebas'
import { ProveedorExportacion } from '../ProveedorExportacion'
import { reiniciarSiExiste } from '../lote/useFormularioLote'
import { DialogoExportacion } from './DialogoExportacion'
import { resumenDe } from './DialogoSeguimiento'

/** Casilla «Incluir la voz en los coros» (0.2.3, tarea 0366; spec 10 · Feature 2). Letras inventadas. */

const conNivel = (letra: Letra, nivel: number | undefined): Letra => ({
  ...letra,
  partes: {
    cantantes: letra.partes?.cantantes ?? [{ id: 'c1' as const, nombre: null }],
    ...(nivel === undefined ? {} : { voz_en_coros: nivel })
  }
})
const letraCoros = (nivel?: number) => conNivel(cancionUnCantanteConCoros().letra!, nivel)
const sinCoros = (): Letra => ({
  ...cancionUnCantanteConCoros().letra!,
  lineas: cancionUnCantanteConCoros().letra!.lineas.filter((l) => l.parte !== 'coro')
})
const cancionCon = (letra: Letra, id = 'c1') =>
  cancionIpcDePrueba({
    id,
    letra,
    metadatos: { ...cancionIpcDePrueba().metadatos, duracion_ms: 30_000 }
  })

beforeEach(() => {
  cerrarTodosLosToasts()
  reiniciarSiExiste()
})
afterEach(() => cleanup())

function montarA(letra: Letra, config: Record<string, unknown> = {}) {
  const actualizar = vi.fn(async () => ({}))
  const api = instalarApiExportacion({
    cancion: cancionCon(letra),
    config,
    extra: {
      config: { obtener: () => Promise.resolve({ exportacion: config }), actualizar }
    }
  })
  render(
    <SesionContexto.Provider value={sesionVacia}>
      <ExportacionContexto.Provider
        value={{
          exportaciones: [],
          activaDe: () => undefined,
          abrir: () => undefined,
          lotes: [],
          abrirLote: () => undefined,
          verLote: () => undefined,
          cerrar: vi.fn(),
          iniciada: vi.fn(),
          pedirCancelar: () => undefined
        }}
      >
        <DialogoExportacion peticion={{ cancionId: 'c1' }} alCerrar={vi.fn()} />
      </ExportacionContexto.Provider>
    </SesionContexto.Provider>
  )
  return { api, actualizar }
}

const casilla = () => screen.queryByRole('checkbox', { name: /Incluir la voz en los coros/ })
const formulario = () => screen.findByRole('radiogroup', { name: 'Audio' })
const exportar = () => fireEvent.click(screen.getByRole('button', { name: 'Exportar' }))
const iniciar = (api: { llamadas: unknown[][] }) =>
  api.llamadas.find((l) => l[0] === 'iniciar')?.[1] as Record<string, unknown> | undefined

describe('casilla de los coros en el diálogo de una canción (A)', () => {
  it('C2-V1: con «Solo instrumental» y coros al 50 %, aparece marcada y se envía `coros`', async () => {
    const { api } = montarA(letraCoros())
    await formulario()
    const c = await screen.findByRole('checkbox', { name: 'Incluir la voz en los coros (50 %)' })
    expect(c).toBeChecked()
    expect(c).toHaveAccessibleDescription(
      'La voz original suena en las líneas de coro, como en el reproductor.'
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled())
    exportar()
    await waitFor(() => expect(iniciar(api)).toBeDefined())
    expect(iniciar(api)).toMatchObject({ audio: 'instrumental', coros: true })
  })

  it('con «Instrumental y voz» no hay casilla y no se envía `coros`', async () => {
    const { api } = montarA(letraCoros())
    await formulario()
    await screen.findByRole('checkbox', { name: /Incluir la voz/ })
    fireEvent.click(screen.getByRole('radio', { name: 'Instrumental y voz' }))
    expect(casilla()).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled())
    exportar()
    await waitFor(() => expect(iniciar(api)).toBeDefined())
    expect(iniciar(api)).not.toHaveProperty('coros')
  })

  it('una canción sin coros no la muestra ni envía `coros` (regresión 0.2.2)', async () => {
    const { api } = montarA(sinCoros())
    await formulario()
    expect(casilla()).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled())
    exportar()
    await waitFor(() => expect(iniciar(api)).toBeDefined())
    expect(iniciar(api)).not.toHaveProperty('coros')
  })

  it('C2-V4: con nivel 0 % hay una nota y no hay casilla', async () => {
    montarA(letraCoros(0))
    await formulario()
    expect(
      await screen.findByText(
        'Esta canción tiene la voz de los coros al 0 %: el video saldrá sin voz.'
      )
    ).toBeInTheDocument()
    expect(casilla()).toBeNull()
  })

  it('C2-V4: la elección se recuerda (`config.exportacion.coros`) y desmarcada no se envía', async () => {
    const { api, actualizar } = montarA(letraCoros(0.7), { coros: false })
    await formulario()
    const c = await screen.findByRole('checkbox', { name: 'Incluir la voz en los coros (70 %)' })
    expect(c).not.toBeChecked()
    fireEvent.click(c)
    expect(actualizar).toHaveBeenCalledWith({ exportacion: { coros: true } })
    fireEvent.click(c)
    expect(actualizar).toHaveBeenLastCalledWith({ exportacion: { coros: false } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled())
    exportar()
    await waitFor(() => expect(iniciar(api)).toBeDefined())
    expect(iniciar(api)).not.toHaveProperty('coros')
  })
})

function Disparador({ ids }: { ids: string[] }) {
  const { abrirLote } = useExportaciones()
  return <button onClick={() => abrirLote(ids, [])}>Abrir lote</button>
}

describe('casilla de los coros en el lote (G)', () => {
  const IDS = ['c1', 'c2', 'c3', 'c4', 'c5']
  const letras: Record<string, Letra> = {
    c1: letraCoros(0.2),
    c2: conNivel(cancionDosCantantes().letra!, 0.7),
    c3: sinCoros(),
    c4: sinCoros(),
    c5: sinCoros()
  }

  async function abrir(ids = IDS) {
    const actualizar = vi.fn(async () => ({}))
    const api = instalarApiExportacion({
      exportacion: crearApiExportacionFalsa(),
      extra: {
        biblioteca: { obtener: (id: string) => Promise.resolve(cancionCon(letras[id]!, id)) },
        config: { obtener: () => Promise.resolve({ exportacion: {} }), actualizar }
      }
    })
    render(
      <SesionContexto.Provider value={sesionVacia}>
        <ProveedorExportacion>
          <Disparador ids={ids} />
        </ProveedorExportacion>
      </SesionContexto.Provider>
    )
    await act(async () => undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir lote' }))
    return { api, actualizar }
  }

  it('C2-V5: 2 canciones con coros (20 % y 70 %) y 3 sin ellos: casilla con k = 2 y nota en «Ver cuáles»', async () => {
    const { api } = await abrir()
    expect(
      await screen.findByRole('checkbox', {
        name: 'Incluir la voz en los coros (en las 2 canciones que los tienen, cada una a su volumen)'
      })
    ).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Ver cuáles' }))
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Con la voz de los coros al 20 %')
    expect(items[1]).toHaveTextContent('Con la voz de los coros al 70 %')
    expect(items[2]).not.toHaveTextContent('coros')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Exportar 5 videos/ })).toBeEnabled()
    )
    fireEvent.click(screen.getByRole('button', { name: /^Exportar 5 videos/ }))
    await waitFor(() => expect(api.llamadas.some((l) => l[0] === 'iniciarLote')).toBe(true))
    expect(api.llamadas.find((l) => l[0] === 'iniciarLote')![1]).toMatchObject({ coros: true })
  })

  it('un lote sin coros no ofrece la casilla ni envía `coros`', async () => {
    const { api } = await abrir(['c3', 'c4'])
    await screen.findByRole('radiogroup', { name: 'Audio' })
    expect(casilla()).toBeNull()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Exportar 2 videos/ })).toBeEnabled()
    )
    fireEvent.click(screen.getByRole('button', { name: /^Exportar 2 videos/ }))
    await waitFor(() => expect(api.llamadas.some((l) => l[0] === 'iniciarLote')).toBe(true))
    expect(api.llamadas.find((l) => l[0] === 'iniciarLote')![1]).not.toHaveProperty('coros')
  })

  it('desmarcada se recuerda y no se envía', async () => {
    const { api, actualizar } = await abrir()
    const c = await screen.findByRole('checkbox', { name: /Incluir la voz en los coros/ })
    fireEvent.click(c)
    expect(actualizar).toHaveBeenCalledWith({ exportacion: { coros: false } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Exportar 5 videos/ })).toBeEnabled()
    )
    fireEvent.click(screen.getByRole('button', { name: /^Exportar 5 videos/ }))
    await waitFor(() => expect(api.llamadas.some((l) => l[0] === 'iniciarLote')).toBe(true))
    expect(api.llamadas.find((l) => l[0] === 'iniciarLote')![1]).not.toHaveProperty('coros')
  })
})

describe('línea de opciones (B, C, D)', () => {
  it('C2-V6: «Solo instrumental + coros al {n} %» si el video lleva la voz de los coros', () => {
    const e = exportacionDePrueba({ audio: 'instrumental', corosNivel: 0.5 })
    expect(resumenDe(e)).toContain('Solo instrumental + coros al 50 %')
  })

  it('sin voz de coros, o con «Instrumental y voz», el texto de siempre', () => {
    expect(resumenDe(exportacionDePrueba({ audio: 'instrumental' }))).toContain(
      '· Solo instrumental ·'
    )
    expect(resumenDe(exportacionDePrueba({ audio: 'instrumental_voz' }))).toContain(
      'Instrumental y voz'
    )
  })
})
