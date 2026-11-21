import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  exportacionDePrueba,
  exportacionEnCola,
  progresoDePrueba
} from '@shared/__fixtures__/exportacion'
import { NavegacionContexto, type Vista } from '../navegacion/estado'
import { IndicadorActividad } from '../navegacion/IndicadorActividad'
import { DialogoCierre } from '../navegacion/DialogoCierre'
import { cuerpoCierre, listaBreve } from '../navegacion/textosCierre'
import { TarjetaCancion, type AccionesTarjeta } from '../vistas/biblioteca/TarjetaCancion'
import { paso, resumenPrueba } from '../vistas/biblioteca/resumenPrueba'
import { ExportacionContexto, type ContextoExportacion } from './contexto'
import type { ExportacionVista } from './estado'
import { lineaDeExportacion } from './lineas'
import { useExportarDesdeEditor } from '../vistas/editor/useExportarDesdeEditor'

const vista = (e: Parameters<typeof exportacionDePrueba>[0] = {}): ExportacionVista =>
  exportacionDePrueba({ cancionId: 'c1', ...e })

function contexto(
  exportaciones: ExportacionVista[] = [],
  extra: Partial<ContextoExportacion> = {}
): ContextoExportacion {
  return {
    exportaciones,
    activaDe: (id) => exportaciones.find((e) => e.cancionId === id && e.estado !== 'terminada'),
    abrir: vi.fn(),
    cerrar: vi.fn(),
    iniciada: vi.fn(),
    pedirCancelar: vi.fn(),
    ...extra
  }
}

const conContexto = (valor: ContextoExportacion, hijos: ReactNode) => (
  <ExportacionContexto.Provider value={valor}>{hijos}</ExportacionContexto.Provider>
)

describe('tarjeta de la Biblioteca (X1–X3)', () => {
  const acciones = new Proxy({} as AccionesTarjeta, { get: () => vi.fn() })
  const montar = (resumen = resumenPrueba({ estado: 'lista' }), valor = contexto()) => {
    render(
      conContexto(
        valor,
        <TarjetaCancion
          resumen={{ ...resumen, titulo: 'La flaca' }}
          acciones={{ ...acciones, aplicarTema: vi.fn() }}
          activa
          alEnfocar={vi.fn()}
        />
      )
    )
    fireEvent.click(screen.getByRole('button', { name: /^Más acciones de/ }))
    return valor
  }
  const opciones = () => screen.getAllByRole('menuitem').map((i) => i.textContent)

  it('una Lista ofrece «Exportar video…» entre «Editar datos» y «Aplicar tema…» y abre el diálogo', () => {
    const valor = montar()
    const lista = opciones()
    expect(lista.indexOf('Exportar video…')).toBe(lista.indexOf('Editar datos') + 1)
    expect(lista.indexOf('Aplicar tema…')).toBe(lista.indexOf('Exportar video…') + 1)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Exportar video…' }))
    expect(valor.abrir).toHaveBeenCalledWith({ cancionId: resumenPrueba().id })
  })

  it('un borrador y una Dañada no ofrecen exportar', () => {
    montar(resumenPrueba({ estado: 'borrador' }))
    expect(opciones()).not.toContain('Exportar video…')
  })

  it('una Dañada no lo ofrece', () => {
    montar(resumenPrueba({ estado: 'lista', danada: true, motivo: 'json', pasos: null }))
    expect(opciones()).not.toContain('Exportar video…')
  })

  it('exportándose: «Ver exportación» y «Cancelar exportación…», y la línea con el porcentaje', () => {
    const id = resumenPrueba().id
    const valor = montar(
      resumenPrueba({ estado: 'lista' }),
      contexto([vista({ cancionId: id, progreso: progresoDePrueba({ valor: 0.42 }) })])
    )
    expect(opciones()).toContain('Ver exportación')
    expect(opciones()).not.toContain('Exportar video…')
    expect(screen.getByText('Exportando video 42 % · queda menos de 1 min')).toBeInTheDocument()
    const lista = opciones()
    expect(lista.indexOf('Cancelar exportación…')).toBeGreaterThan(
      lista.indexOf('Mostrar en la carpeta')
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cancelar exportación…' }))
    expect(valor.pedirCancelar).toHaveBeenCalledWith(valor.exportaciones[0]!.trabajoId)
  })

  it('un borrador que se exporta (desde el editor) ofrece ver y cancelar, y muestra la línea en cola', () => {
    const id = resumenPrueba().id
    const e = { ...vista({ cancionId: id }), ...exportacionEnCola(), cancionId: id }
    const valor = montar(
      resumenPrueba({
        estado: 'borrador',
        pasos: {
          fuente: paso('completado'),
          separacion: paso('completado'),
          letra: paso('completado'),
          edicion: paso('pendiente')
        }
      }),
      contexto([e])
    )
    expect(opciones()).toContain('Ver exportación')
    expect(opciones()).toContain('Cancelar exportación…')
    expect(screen.getByText('En cola para exportar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ver exportación' }))
    expect(valor.abrir).toHaveBeenCalledWith({ cancionId: id, trabajoId: e.trabajoId })
  })
})

describe('líneas de exportación', () => {
  it('indeterminada al preparar o terminar, y sin línea al terminar', () => {
    expect(
      lineaDeExportacion(vista({ progreso: progresoDePrueba({ fase: 'preparando', valor: null }) }))
    ).toEqual({
      tipo: 'curso',
      texto: 'Exportando video…',
      barra: null
    })
    expect(lineaDeExportacion(vista({ estado: 'terminada', progreso: null }))).toBeNull()
    expect(lineaDeExportacion(undefined)).toBeNull()
  })
})

describe('panel de actividad (X4, V12)', () => {
  const ir = vi.fn<(v: Vista) => void>()
  function pintar(valor: ContextoExportacion) {
    render(
      <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir }}>
        {conContexto(valor, <IndicadorActividad />)}
      </NavegacionContexto.Provider>
    )
  }

  it('cuenta las exportaciones y lista una fila con [Ir] y ✕', () => {
    const curso = vista({ progreso: progresoDePrueba({ valor: 0.42 }) })
    const cola = vista({
      trabajoId: 'b0000000-0000-4000-8000-000000000002',
      cancionId: 'c2',
      titulo: 'La flaca',
      estado: 'en_cola',
      posicion: 1,
      progreso: null
    })
    const valor = contexto([curso, cola])
    pintar(valor)
    fireEvent.click(screen.getByRole('button', { name: '1 en curso · 1 en cola' }))
    const filas = document.querySelectorAll('[data-exportacion]')
    expect(filas).toHaveLength(2)
    expect(
      within(filas[0] as HTMLElement).getByText('Canción de prueba — Exportando video 42 %')
    ).toBeInTheDocument()
    expect(
      within(filas[1] as HTMLElement).getByText('La flaca — En cola para exportar')
    ).toBeInTheDocument()
    fireEvent.click(within(filas[0] as HTMLElement).getByRole('button', { name: 'Ir' }))
    expect(valor.abrir).toHaveBeenCalledWith({ cancionId: 'c1', trabajoId: curso.trabajoId })
  })

  it('✕ pide cancelar con la confirmación del proveedor', () => {
    const curso = vista({})
    const valor = contexto([curso])
    pintar(valor)
    fireEvent.click(screen.getByRole('button', { name: /en curso/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar «Canción de prueba»' }))
    expect(valor.pedirCancelar).toHaveBeenCalledWith(curso.trabajoId)
  })
})

describe('diálogo de cierre (V25)', () => {
  let solicitar: (m?: unknown) => void
  const confirmarCierre = vi.fn().mockResolvedValue(undefined)
  function instalar(exportaciones: unknown[] | undefined) {
    confirmarCierre.mockClear()
    ;(window as unknown as { shinobi: unknown }).shinobi = {
      app: {
        confirmarCierre,
        alSolicitudCierre: (cb: (m?: unknown) => void) => {
          solicitar = cb
          return () => undefined
        }
      },
      trabajos: { listar: () => Promise.resolve([]) },
      biblioteca: { listar: () => Promise.resolve([]) },
      ...(exportaciones ? { exportacion: { estado: () => Promise.resolve(exportaciones) } } : null)
    }
  }

  it('lista «exportar «{título}»» y añade el texto de los videos a medio exportar', async () => {
    instalar([
      exportacionDePrueba(),
      exportacionEnCola(),
      exportacionDePrueba({ estado: 'terminada' })
    ])
    render(<DialogoCierre vista={{ tipo: 'biblioteca' }} />)
    await act(async () => solicitar())
    const cuerpo = screen.getByText(/Hay 2 trabajos sin terminar/)
    expect(cuerpo).toHaveTextContent(
      '(exportar «Canción de prueba» y exportar «Canción de prueba»)'
    )
    expect(cuerpo).toHaveTextContent(
      'Los videos a medio exportar no se guardarán; los archivos que ya existían no se tocan.'
    )
    expect(screen.getByRole('button', { name: 'Seguir trabajando' })).toHaveFocus()
    expect(confirmarCierre).not.toHaveBeenCalled()
  })

  it('sin exportaciones activas cierra sin preguntar', async () => {
    instalar([exportacionDePrueba({ estado: 'terminada', resultado: 'completada' })])
    render(<DialogoCierre vista={{ tipo: 'biblioteca' }} />)
    await act(async () => solicitar())
    expect(confirmarCierre).toHaveBeenCalled()
  })

  it('con trabajos y exportaciones suma las dos y nombra ambos', () => {
    expect(listaBreve(['A'], ['B'])).toBe('«A» y exportar «B»')
    expect(cuerpoCierre(2, ['A'], undefined, ['B'])).toMatch(
      /^Hay 2 trabajos sin terminar \(«A» y exportar «B»\)\./
    )
  })
})

describe('«Exportar video…» del editor (EX1–EX3)', () => {
  function Sonda(props: {
    hayPistas?: boolean
    lineasConInicio?: number
    inactivo?: boolean
    vaciar?: () => Promise<boolean>
    pausar?: () => void
  }) {
    const { exportar, item, dialogo } = useExportarDesdeEditor({
      cancionId: 'c1',
      hayPistas: props.hayPistas ?? true,
      lineasConInicio: props.lineasConInicio ?? 3,
      inactivo: props.inactivo ?? false,
      temaBorrador: true,
      pausar: props.pausar ?? (() => undefined),
      vaciar: props.vaciar ?? (() => Promise.resolve(true))
    })
    return (
      <>
        <button onClick={exportar} aria-disabled={item.noDisponible ? true : undefined}>
          {item.etiqueta}
        </button>
        <output>{item.noDisponible ?? ''}</output>
        {dialogo}
      </>
    )
  }
  const probar = (props: Parameters<typeof Sonda>[0], valor = contexto()) => {
    render(conContexto(valor, <Sonda {...props} />))
    return valor
  }

  it('pausa, vacía el guardado y abre el diálogo con la nota del borrador de tema', async () => {
    const pausar = vi.fn()
    const vaciar = vi.fn().mockResolvedValue(true)
    const valor = probar({ pausar, vaciar })
    await act(async () => fireEvent.click(screen.getByRole('button')))
    expect(pausar).toHaveBeenCalled()
    expect(vaciar).toHaveBeenCalled()
    expect(valor.abrir).toHaveBeenCalledWith({ cancionId: 'c1', temaBorrador: true })
  })

  it('sin pistas o sin líneas con inicio no hace nada y explica el motivo', async () => {
    const valor = probar({ hayPistas: false })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Podrás exportar cuando termine la separación.'
    )
    await act(async () => fireEvent.click(screen.getByRole('button')))
    expect(valor.abrir).not.toHaveBeenCalled()
  })

  it('sin líneas con inicio, el motivo es otro', () => {
    probar({ lineasConInicio: 0 })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sincroniza al menos una línea para exportar.'
    )
  })

  it('en el modo sincronizar no hace nada', async () => {
    const valor = probar({ inactivo: true })
    await act(async () => fireEvent.click(screen.getByRole('button')))
    expect(valor.abrir).not.toHaveBeenCalled()
  })

  it('si el guardado falla pregunta: «Quedarme» no abre nada y «Exportar igualmente» sí', async () => {
    const vaciar = vi.fn().mockResolvedValue(false)
    const valor = probar({ vaciar })
    await act(async () => fireEvent.click(screen.getByRole('button')))
    expect(
      screen.getByRole('dialog', { name: 'No se pudieron guardar los últimos cambios' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quedarme en el editor' })).toHaveFocus()
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Quedarme en el editor' }))
    )
    expect(valor.abrir).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Exportar video/ })))
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Exportar igualmente' }))
    )
    expect(valor.abrir).toHaveBeenCalledWith({ cancionId: 'c1', temaBorrador: true })
  })

  it('con una exportación de la canción en curso es «Ver exportación» y abre su estado', async () => {
    const e = vista({})
    const valor = probar({ hayPistas: false }, contexto([e]))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Ver exportación' })))
    expect(valor.abrir).toHaveBeenCalledWith({ cancionId: 'c1', trabajoId: e.trabajoId })
  })
})
