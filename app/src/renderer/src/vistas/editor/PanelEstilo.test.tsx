import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useReducer } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { estiloPredeterminado, type Estilo } from '@shared/estilo'
import { ControlSegmentado } from '../../componentes/ControlSegmentado'
import { ContenedorToasts } from '../../componentes/Toasts'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { evaluarContraste } from '../../karaoke/contraste'
import { aparienciaPropia, estadoInicial, reducirEditor } from './estado'
import { catalogoPrueba } from '../biblioteca/temasFalsos'
import { resumenPrueba } from '../biblioteca/resumenPrueba'
import { vistaTema } from './aparienciaVista'
import type { ControlTema } from './SeccionTema'
import { PanelEstilo } from './PanelEstilo'
import { E } from './textos'

const accionesVacias = (): ControlTema['acciones'] =>
  Object.fromEntries(
    [
      'elegir',
      'heredar',
      'personalizar',
      'pasarADefinidos',
      'editar',
      'guardarEn',
      'descartar',
      'guardarNuevo',
      'usarNuevo',
      'cerrarNuevoCreado',
      'renombrar',
      'duplicar',
      'temaDelAlbum',
      'temaDelArtista',
      'administrar',
      'eliminar'
    ].map((k) => [k, vi.fn()])
  ) as unknown as ControlTema['acciones']

/** Control de D2 (estilo propio): la sección Tema no interviene en estas pruebas. */
function controlPropio(estilo: Estilo): ControlTema {
  const resumen = resumenPrueba({ estilo })
  return {
    vista: vistaTema({
      seleccion: { modo: 'propio' },
      estiloPropio: estilo,
      resumen,
      catalogo: catalogoPrueba(),
      borrador: null
    }),
    ofrecibles: [],
    predeterminadoId: null,
    grupo: { album: null, artista: null },
    usos: 0,
    nombreBorrador: null,
    borradorModificado: false,
    nuevoCreado: null,
    foco: null,
    acciones: accionesVacias()
  }
}

function Montaje({ inicial, inactivo }: { inicial: Estilo; inactivo: boolean }) {
  const [estado, despachar] = useReducer(
    reducirEditor,
    estadoInicial(
      {
        letra: { origen: 'manual', lrclib_id: null, offset_ms: 0, lineas: [] },
        apariencia: aparienciaPropia(inicial)
      },
      null
    )
  )
  const { estilo } = estado.actual.apariencia

  return (
    <>
      <PanelEstilo
        estilo={estilo}
        contraste={evaluarContraste(estilo)}
        inactivo={inactivo}
        tema={controlPropio(estilo)}
        alCambiar={(estilo, clave, agruparGesto) =>
          despachar({ tipo: 'estilo', estilo, clave, agruparGesto, ahora: Date.now() })
        }
      />
      <button type="button" onClick={() => despachar({ tipo: 'deshacer' })}>
        Deshacer
      </button>
      <pre data-testid="estilo">{JSON.stringify(estilo)}</pre>
      <ContenedorToasts />
    </>
  )
}

function montar(inicial = estiloPredeterminado(), inactivo = false) {
  return render(<Montaje inicial={inicial} inactivo={inactivo} />)
}

function estiloActual(): Estilo {
  return JSON.parse(screen.getByTestId('estilo').textContent ?? '')
}

function cambiarCampo(etiqueta: string, value: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: etiqueta }), { target: { value } })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  act(() => cerrarTodosLosToasts())
})

describe('panel Estilo', () => {
  it('aplica los avisos del sistema visual y sus acciones deshacibles', () => {
    montar()
    expect(screen.getByRole('status')).toHaveTextContent(E.contrasteOk)

    cambiarCampo(E.colorLetra, '#5A1E6E')
    expect(screen.getByText(E.contrasteLetra)).toBeVisible()
    const estado = screen.getByRole('status')
    expect(estado).toHaveTextContent('Contraste bajo')
    fireEvent.click(screen.getByRole('button', { name: E.usarBlanca }))
    expect(estiloActual().letra.color).toBe('#FFFFFF')
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(estiloActual().letra.color).toBe('#5A1E6E')

    cambiarCampo(E.colorLetra, '#FFFFFF')
    cambiarCampo(E.colorResaltado, '#F2F3F7')
    expect(screen.getByText(E.contrasteDiferencia)).toBeVisible()
    expect(screen.getByRole('status')).toBe(estado)
    expect(estado).toHaveTextContent('Contraste bajo')
    fireEvent.click(screen.getByRole('button', { name: E.sugerirResaltado }))
    expect(screen.queryByText(E.contrasteDiferencia)).not.toBeInTheDocument()
    expect(estado).toHaveTextContent(E.contrasteOk)
  })

  it('permite dos a cuatro paradas y las reparte al añadir o quitar', () => {
    montar()
    const anadir = screen.getByRole('button', { name: E.anadirColor })
    expect(screen.queryByRole('button', { name: E.quitarColor })).not.toBeInTheDocument()
    fireEvent.click(anadir)
    expect(estiloActual().fondo).toMatchObject({
      paradas: [{ posicion: 0 }, { posicion: 0.5 }, { posicion: 1 }]
    })
    fireEvent.click(anadir)
    expect(estiloActual().fondo).toMatchObject({
      paradas: [{ posicion: 0 }, { posicion: 1 / 3 }, { posicion: 2 / 3 }, { posicion: 1 }]
    })
    expect(screen.queryByRole('button', { name: E.anadirColor })).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: E.quitarColor })[1]!)
    expect(estiloActual().fondo).toMatchObject({
      paradas: [{ posicion: 0 }, { posicion: 0.5 }, { posicion: 1 }]
    })
  })

  it('convierte el fondo con la variante de luminosidad y rechaza el hex inválido', () => {
    montar()
    fireEvent.click(screen.getByRole('radio', { name: E.solido }))
    expect(estiloActual().fondo).toEqual({ tipo: 'solido', color: '#1B1033' })
    cambiarCampo(E.color, 'rojo')
    expect(screen.getByText(E.errorHex)).toBeVisible()
    expect(estiloActual().fondo).toEqual({ tipo: 'solido', color: '#1B1033' })
    fireEvent.click(screen.getByRole('radio', { name: E.degradado }))
    expect(estiloActual().fondo).toMatchObject({
      tipo: 'degradado',
      paradas: [{ color: '#1B1033' }, { color: '#5935A7' }]
    })
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(estiloActual().fondo).toEqual({ tipo: 'solido', color: '#1B1033' })
  })

  it('agrupa los eventos de una apertura nativa aunque pasen más de 1000 ms', () => {
    const reloj = vi.spyOn(Date, 'now').mockReturnValue(1000)
    montar()
    const abrir = screen.getByRole('button', { name: 'Abrir selector de color de ' + E.colorLetra })
    const nativo = abrir.parentElement!.querySelector('input[type="color"]')!
    const deshacer = screen.getByRole('button', { name: 'Deshacer' })

    fireEvent.click(abrir)
    fireEvent.input(nativo, { target: { value: '#112233' } })
    reloj.mockReturnValue(2500)
    fireEvent.input(nativo, { target: { value: '#223344' } })
    reloj.mockReturnValue(2550)
    fireEvent.click(abrir)
    fireEvent.input(nativo, { target: { value: '#334455' } })
    expect(estiloActual().letra.color).toBe('#334455')

    fireEvent.click(deshacer)
    expect(estiloActual().letra.color).toBe('#223344')
    fireEvent.click(deshacer)
    expect(estiloActual().letra.color).toBe('#FFFFFF')
  })

  it('ya no ofrece restablecer ni guardar el estilo como predeterminado de canciones nuevas', () => {
    montar()
    expect(screen.queryByRole('button', { name: /Restablecer estilo predeterminado/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /canciones nuevas/ })).toBeNull()
  })

  it('bloquea todas las ediciones de estilo mientras se sincroniza', () => {
    const inicial = estiloPredeterminado()
    montar(inicial, true)
    expect(screen.getByRole('heading', { name: E.fondo }).closest('[inert]')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: E.solido }))
    cambiarCampo(E.colorLetra, '#112233')
    expect(estiloActual()).toEqual(inicial)
  })
})

it('muestra el punto de aviso con su descripción y conserva el nombre Estilo', () => {
  render(
    <ControlSegmentado
      etiqueta="Panel del editor"
      valor="sincronia"
      opciones={[
        { valor: 'sincronia', etiqueta: 'Sincronía' },
        { valor: 'estilo', etiqueta: 'Estilo', aviso: 'Contraste bajo' }
      ]}
      onCambio={vi.fn()}
    />
  )
  const paneles = screen.getByRole('radiogroup', { name: 'Panel del editor' })
  const estilo = within(paneles).getByRole('radio', { name: 'Estilo' })
  expect(estilo).toHaveAccessibleDescription('Contraste bajo')
  expect(estilo.querySelector('[data-aviso]')).toHaveAttribute('aria-hidden', 'true')
})
