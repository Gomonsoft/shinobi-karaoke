import { act, fireEvent, render, screen } from '@testing-library/react'
import { DialogoCierre } from './DialogoCierre'
import { registrarBorradorAlCerrar } from './salida'
import { cuerpoCierre, listaBreve } from './textosCierre'
import type { Vista } from './estado'
import { iniciarSeguimiento, reiniciarPaquetes } from '../vistas/biblioteca/paquete/almacen'

let solicitar: (m?: unknown) => void
const confirmarCierre = vi.fn().mockResolvedValue(undefined)

function instalar(trabajos: string[], titulos: Record<string, string>) {
  confirmarCierre.mockClear()
  ;(window as unknown as { shinobi: unknown }).shinobi = {
    app: {
      confirmarCierre,
      alSolicitudCierre: (cb: (m?: unknown) => void) => {
        solicitar = cb
        return () => undefined
      }
    },
    trabajos: {
      listar: () => Promise.resolve(trabajos.map((cancionId) => ({ cancionId })))
    },
    biblioteca: {
      listar: () => Promise.resolve(Object.entries(titulos).map(([id, titulo]) => ({ id, titulo })))
    }
  }
}

async function pedir(vista: Vista = { tipo: 'biblioteca' }, motivo?: unknown) {
  render(<DialogoCierre vista={vista} />)
  await act(async () => solicitar(motivo))
}

describe('textos de cierre', () => {
  it('lista breve: hasta 3 títulos y "y {k} más"', () => {
    expect(listaBreve(['A'])).toBe('«A»')
    expect(listaBreve(['A', 'B', 'C'])).toBe('«A», «B» y «C»')
    expect(listaBreve(['A', 'B', 'C', 'D', 'E'])).toBe('«A», «B», «C» y 2 más')
  })
  it('singular y plural', () => {
    expect(cuerpoCierre(1, ['A'])).toMatch(/^Hay 1 trabajo sin terminar \(«A»\)\./)
    expect(cuerpoCierre(2, [])).toMatch(/^Hay 2 trabajos sin terminar\./)
  })
})

const motivo = (sesion: boolean, cola: boolean, variante = 'salir', trabajos = false) => ({
  trabajos,
  sesion,
  cola,
  variante
})

describe('solicitud de cierre que llegó antes de montar el diálogo (0236)', () => {
  it('se pregunta a main al montar y, con trabajos, sale el diálogo sin esperar otro evento', async () => {
    instalar(['c1'], { c1: 'Tema inventado' })
    ;(
      window as unknown as { shinobi: { app: Record<string, unknown> } }
    ).shinobi.app.solicitudCierrePendiente = () =>
      Promise.resolve(motivo(false, false, 'salir', true))
    await act(async () => {
      render(<DialogoCierre vista={{ tipo: 'biblioteca' }} />)
    })
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/«Tema inventado»/)).toBeInTheDocument()
    expect(confirmarCierre).not.toHaveBeenCalled()
  })

  it('sin solicitud pendiente no sale nada', async () => {
    instalar(['c1'], { c1: 'Tema inventado' })
    ;(
      window as unknown as { shinobi: { app: Record<string, unknown> } }
    ).shinobi.app.solicitudCierrePendiente = () => Promise.resolve(null)
    await act(async () => {
      render(<DialogoCierre vista={{ tipo: 'biblioteca' }} />)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('DialogoCierre con sesión o cola (S13)', () => {
  const biblio = { tipo: 'biblioteca' } as const
  it('con sesión pregunta ses.salir con el foco en Cancelar', async () => {
    instalar([], {})
    await pedir(biblio, motivo(true, true))
    expect(screen.getByRole('dialog', { name: '¿Salir de Shinobi Karaoke?' })).toBeInTheDocument()
    expect(screen.getByText(/se cerrará y la cola se perderá\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    expect(confirmarCierre).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Salir' })))
    expect(confirmarCierre).toHaveBeenCalledOnce()
  })
  it('cancelar no cambia nada', async () => {
    instalar([], {})
    await pedir(biblio, motivo(true, true))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(confirmarCierre).not.toHaveBeenCalled()
  })
  it('sin sesión y con cola: solo la cola se perderá', async () => {
    instalar([], {})
    await pedir(biblio, motivo(false, true))
    expect(screen.getByText('La cola se perderá.')).toBeInTheDocument()
  })
  it('con sesión y trabajos: un solo diálogo, el de trabajos con ses.salir.extra', async () => {
    instalar(['a'], { a: 'A' })
    await pedir(biblio, motivo(true, true, 'salir', true))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByText(/Hay 1 trabajo sin terminar.*la cola se perderá\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seguir trabajando' })).toHaveFocus()
  })
  it('macOS, cerrar ventana: la cola se conserva', async () => {
    instalar([], {})
    await pedir(biblio, motivo(true, false, 'cerrarVentanaMac'))
    expect(screen.getByRole('dialog', { name: '¿Cerrar la ventana?' })).toBeInTheDocument()
    expect(screen.getByText(/La cola se conservará/)).toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cerrar' })))
    expect(confirmarCierre).toHaveBeenCalledOnce()
  })
})

describe('DialogoCierre', () => {
  it('con trabajos muestra el diálogo con el foco en "Seguir trabajando"', async () => {
    instalar(['a', 'b'], { a: 'Bohemian Rhapsody', b: 'Imagine' })
    await pedir()
    expect(screen.getByRole('dialog', { name: '¿Cerrar Shinobi Karaoke?' })).toBeInTheDocument()
    expect(
      screen.getByText(/Hay 2 trabajos sin terminar \(«Bohemian Rhapsody» y «Imagine»\)/)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seguir trabajando' })).toHaveFocus()
    expect(confirmarCierre).not.toHaveBeenCalled()
  })

  it('nombra como máximo 3 canciones y resume el resto', async () => {
    instalar(['a', 'b', 'c', 'd', 'e'], { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' })
    await pedir()
    expect(screen.getByText(/«A», «B», «C» y 2 más/)).toBeInTheDocument()
  })

  it('Esc y "Seguir trabajando" cierran el diálogo sin cerrar la app', async () => {
    instalar(['a'], { a: 'A' })
    await pedir()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(confirmarCierre).not.toHaveBeenCalled()
  })

  it('"Cerrar de todos modos" confirma el cierre a main', async () => {
    instalar(['a'], { a: 'A' })
    await pedir()
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar de todos modos' }))
    )
    expect(confirmarCierre).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sin trabajos responde sin diálogo', async () => {
    instalar([], {})
    await pedir()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(confirmarCierre).toHaveBeenCalledOnce()
  })

  it('durante el primer arranque lo gestiona esa vista', async () => {
    instalar(['a'], { a: 'A' })
    await pedir({ tipo: 'primer-arranque' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(confirmarCierre).not.toHaveBeenCalled()
  })

  it('con un borrador de tema sin guardar delega en su diálogo: seguir cancela el cierre', async () => {
    instalar([], {})
    const baja = registrarBorradorAlCerrar(async () => false)
    await pedir()
    expect(confirmarCierre).not.toHaveBeenCalled()
    baja()
  })

  it('con un borrador de tema, descartarlo o guardarlo permite el cierre', async () => {
    instalar([], {})
    const baja = registrarBorradorAlCerrar(async () => true)
    await pedir()
    expect(confirmarCierre).toHaveBeenCalledOnce()
    baja()
  })
})

describe('cierre con una tanda de la cola de preparación (cierre.cuerpo.cola)', () => {
  it('dice cuántas canciones faltan y que seguirán solas', async () => {
    instalar(['c1', 'c2'], { c1: 'Tema uno', c2: 'Tema dos' })
    ;(window as unknown as { shinobi: { preparacion: unknown } }).shinobi.preparacion = {
      tanda: () => Promise.resolve({ total: 5, terminadas: 2 })
    }
    await pedir()
    expect(
      screen.getByText(
        /^Faltan 3 canciones por preparar\. Si cierras ahora, se pararán y seguirán solas/
      )
    ).toBeInTheDocument()
  })
})

describe('DialogoCierre con un paquete en curso (0383)', () => {
  it('lo cuenta como un trabajo y lo cancela al confirmar', async () => {
    instalar([], {})
    const cancelar = vi.fn().mockResolvedValue(undefined)
    ;(window as unknown as { shinobi: Record<string, unknown> }).shinobi.copias = { cancelar }
    reiniciarPaquetes()
    iniciarSeguimiento({
      tipo: 'exportar',
      trabajoId: 'p1',
      completo: true,
      esCopia: false,
      n: 1,
      peticion: null
    })
    await pedir({ tipo: 'biblioteca' }, motivo(false, false, 'salir', true))
    expect(screen.getByText(/Hay 1 trabajo sin terminar/)).toBeInTheDocument()
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar de todos modos' }))
    )
    expect(cancelar).toHaveBeenCalledWith('p1')
    expect(confirmarCierre).toHaveBeenCalledOnce()
    reiniciarPaquetes()
  })
})
