import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configPredeterminada, type Config } from '@shared/config'
import type { ApiShinobi, EstadoRuntimeIpc, ProgresoRuntimeIpc } from '@shared/ipc'
import { ContenedorToasts } from '../../componentes/Toasts'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { NavegacionContexto } from '../../navegacion/estado'
import { Ajustes } from './Ajustes'

type Perfil = 'cuda' | 'cpu' | 'mps'
type Estim = {
  min: number
  max: number
  origen: 'medido_equipo' | 'referencia_medida' | 'estimado'
}

interface Opciones {
  perfil?: Perfil
  perfilPrevisto?: Perfil
  vramMb?: number | null
  rapido?: boolean
  calidadDescargado?: boolean
  volver?: EstadoRuntimeIpc['volverACalidad']
  origen?: Estim['origen']
  modoGuardado?: 'calidad' | 'rapido' | 'automatico'
}

function montar(o: Opciones = {}) {
  const config: Config = configPredeterminada()
  config.instalacion.perfil_hardware = o.perfil ?? 'cuda'
  config.instalacion.hardware = { gpu: null, vram_mb: o.vramMb === undefined ? 8192 : o.vramMb }
  config.separacion.modo = (o.modoGuardado ?? (o.rapido ? 'rapido' : 'calidad')) as 'calidad'
  if (o.rapido) {
    config.separacion.rapido_aceptado = '2026-11-05T10:00:00.000Z'
    config.separacion.modelos_descargados = ['rapido']
  }
  let estado: EstadoRuntimeIpc = {
    estado: 'completa',
    fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' },
    error: null,
    perfilPrevisto: o.perfilPrevisto ?? o.perfil ?? 'cuda',
    perfil: o.perfil ?? 'cuda',
    motivoRebaja: null,
    modo: o.rapido ? 'rapido' : 'calidad',
    bytesRestantes: 0,
    rapidoPendiente: false,
    ofrecerRapido: false,
    volverACalidad: o.volver ?? null
  }
  const cambiaConfig = new Set<(c: Config) => void>()
  const cambiaEstado = new Set<(e: EstadoRuntimeIpc) => void>()
  const progreso = new Set<(p: ProgresoRuntimeIpc) => void>()
  let resolver: () => void = () => undefined
  let rechazar: (e: unknown) => void = () => undefined
  const runtime = {
    estado: vi.fn(() => Promise.resolve(estado)),
    requisitos: vi.fn().mockResolvedValue({
      bytesCalidad: 913e6,
      calidadDescargado: o.calidadDescargado ?? false
    }),
    estimarSeparacion: vi.fn((_ms: number, m?: string): Promise<Estim> =>
      Promise.resolve(
        m === 'calidad'
          ? { min: 6.2, max: 14.4, origen: o.origen ?? 'referencia_medida' }
          : { min: 1.1, max: 1.6, origen: o.origen ?? 'referencia_medida' }
      )
    ),
    volverACalidad: vi.fn(
      () =>
        new Promise<void>((res, rej) => {
          resolver = res
          rechazar = rej
        })
    ),
    cancelarVolverACalidad: vi.fn(() => {
      rechazar({ codigo: 'CANCELADO' })
      return Promise.resolve()
    }),
    alCambiar: (cb: (e: EstadoRuntimeIpc) => void) => {
      cambiaEstado.add(cb)
      return () => cambiaEstado.delete(cb)
    },
    alProgreso: (cb: (p: ProgresoRuntimeIpc) => void) => {
      progreso.add(cb)
      return () => progreso.delete(cb)
    }
  }
  ;(window as unknown as { shinobi: ApiShinobi }).shinobi = {
    runtime,
    sistema: {
      info: vi.fn().mockResolvedValue({ version: '0.1.0', so: 'Darwin 25', plataforma: 'darwin' }),
      textoLegal: vi.fn().mockResolvedValue('# Avisos de terceros'),
      abrirEnlace: vi.fn(),
      abrirCarpetaDatos: vi.fn()
    },
    config: { obtener: () => Promise.resolve(config) },
    alCambiarConfig: (cb: (c: Config) => void) => {
      cambiaConfig.add(cb)
      return () => cambiaConfig.delete(cb)
    }
  } as unknown as ApiShinobi
  return {
    runtime,
    config,
    resolver: () => resolver(),
    rechazar: (e: unknown) => rechazar(e),
    pasarACalidad: () => {
      config.separacion.modo = 'calidad'
      estado = { ...estado, modo: 'calidad', volverACalidad: null }
      act(() => {
        cambiaConfig.forEach((cb) => cb({ ...config }))
        cambiaEstado.forEach((cb) => cb(estado))
      })
    },
    emitirEstado: (e: Partial<EstadoRuntimeIpc>) => {
      estado = { ...estado, ...e }
      act(() => cambiaEstado.forEach((cb) => cb(estado)))
    },
    emitirProgreso: (bytes: number, total: number) =>
      act(() =>
        progreso.forEach((cb) =>
          cb({ modo: 'calidad', bytes, total } as unknown as ProgresoRuntimeIpc)
        )
      )
  }
}

const abrir = async (o: Opciones = {}) => {
  const api = montar(o)
  render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'ajustes' }, ir: vi.fn() }}>
      <Ajustes />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  await screen.findByText(/^Modelo en uso:/)
  return api
}

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})
afterEach(() => cerrarTodosLosToasts())

describe('Ajustes: equipo', () => {
  it.each([
    [{ perfil: 'cuda', vramMb: 8192 }, 'Tu equipo: tarjeta gráfica NVIDIA (8 GB)'],
    [{ perfil: 'cuda', vramMb: null }, 'Tu equipo: tarjeta gráfica NVIDIA'],
    [{ perfil: 'mps' }, 'Tu equipo: Mac con chip Apple'],
    [{ perfil: 'cpu' }, 'Tu equipo: sin tarjeta gráfica compatible (se usa el procesador)'],
    [
      { perfil: 'cpu', perfilPrevisto: 'cuda' },
      'Tu equipo: tarjeta gráfica NVIDIA (no se puede usar: se usa el procesador)'
    ]
  ] as [Opciones, string][])('describe el equipo %#', async (o, texto) => {
    await abrir(o)
    expect(screen.getByText(texto)).toBeTruthy()
  })
})

describe('Ajustes: Calidad en uso', () => {
  it('muestra el modelo y el tiempo, sin acciones ni menciones a Rápido ni controles de modo', async () => {
    await abrir()
    expect(screen.getByText('Modelo en uso: Calidad')).toBeTruthy()
    expect(
      await screen.findByText(
        'Deja poca voz de fondo. Una canción de 4 minutos tarda entre 1 y 2 minutos en tu equipo.'
      )
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Volver a Calidad/ })).toBeNull()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(
      within(screen.getByRole('group', { name: 'Separación de voz' })).queryByText(/Rápido/)
    ).toBeNull()
  })

  it('un modo "automatico" guardado se muestra como Calidad', async () => {
    await abrir({ modoGuardado: 'automatico' })
    expect(screen.getByText('Modelo en uso: Calidad')).toBeTruthy()
  })

  it('usa la variante aproximada solo con origen "estimado"', async () => {
    await abrir({ origen: 'estimado' })
    expect(await screen.findByText(/en tu equipo, aproximadamente\.$/)).toBeTruthy()
  })

  it('sin aproximación con un factor medido', async () => {
    await abrir({ origen: 'medido_equipo' })
    expect(screen.queryByText(/aproximadamente/)).toBeNull()
  })
})

describe('Ajustes: Rápido en uso', () => {
  it('muestra el aviso con la fecha, la información de Calidad con descarga y el botón', async () => {
    await abrir({ rapido: true })
    expect(screen.getByText('Modelo en uso: Rápido')).toBeTruthy()
    expect(
      screen.getByText(/Lo usas bajo tu responsabilidad desde el 5 de noviembre de 2026/)
    ).toBeTruthy()
    expect(
      await screen.findByText(
        'Modelo Calidad: deja menos voz de fondo. En tu equipo, una canción de 4 minutos tardaría entre 6 y 15 minutos. Hay que descargar 913 MB.'
      )
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Volver a Calidad…' })).toBeTruthy()
    expect(
      screen.getByText(
        'El cambio se aplica a las próximas separaciones. Las canciones ya separadas no cambian.'
      )
    ).toBeTruthy()
  })

  it('"Créditos y licencias" abre el diálogo de créditos', async () => {
    const { runtime } = await abrir({ rapido: true })
    expect(runtime.estimarSeparacion).toHaveBeenCalledWith(240000, 'calidad')
    const aviso = screen.getByText(/Lo usas bajo tu responsabilidad/).closest('[role="status"]')!
    fireEvent.click(
      within(aviso as HTMLElement).getByRole('button', { name: 'Créditos y licencias' })
    )
    expect(
      await screen.findByRole('dialog', { name: 'Créditos y licencias de terceros' })
    ).toBeTruthy()
  })

  it('el diálogo pide siempre confirmación, con la frase de descarga si falta', async () => {
    await abrir({ rapido: true })
    await screen.findByText(/Hay que descargar 913 MB/)
    fireEvent.click(screen.getByRole('button', { name: 'Volver a Calidad…' }))
    const d = await screen.findByRole('dialog', { name: '¿Volver al modelo Calidad?' })
    expect(
      within(d).getByText(/entre 6 y 15 minutos en separarse\. Hay que descargar 913 MB\./)
    ).toBeTruthy()
    expect(within(d).getByText(/Desde Ajustes no podrás volver al modelo Rápido/)).toBeTruthy()
    expect(within(d).getByRole('button', { name: 'Volver a Calidad' })).toHaveFocus()
  })

  it('sin la frase de descarga si Calidad ya está descargado; Esc cancela', async () => {
    const { runtime } = await abrir({ rapido: true, calidadDescargado: true })
    await waitFor(() => expect(runtime.requisitos).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Volver a Calidad…' }))
    const d = await screen.findByRole('dialog')
    expect(within(d).queryByText(/Hay que descargar/)).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(runtime.volverACalidad).not.toHaveBeenCalled()
  })

  async function confirmar() {
    fireEvent.click(await screen.findByRole('button', { name: 'Volver a Calidad…' }))
    const d = await screen.findByRole('dialog')
    fireEvent.click(within(d).getByRole('button', { name: 'Volver a Calidad' }))
  }

  it('descarga con progreso y Cancelar vuelve el botón sin mensajes', async () => {
    const api = await abrir({ rapido: true })
    await confirmar()
    expect(api.runtime.volverACalidad).toHaveBeenCalledOnce()
    api.emitirProgreso(310e6, 913e6)
    expect(
      await screen.findByText('Descargando el modelo Calidad… 33 % · 310 MB de 913 MB')
    ).toBeTruthy()
    expect(screen.getByText('Mientras tanto se sigue usando el modelo Rápido.')).toBeTruthy()
    expect(screen.getByRole('progressbar')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Volver a Calidad…' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(api.runtime.cancelarVolverACalidad).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Volver a Calidad…' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('Ya usas el modelo Calidad.')).toBeNull()
  })

  it('error: texto del código, "Sigues usando el modelo Rápido" y Reintentar sin diálogo', async () => {
    const api = await abrir({ rapido: true })
    await confirmar()
    await act(async () => {
      api.rechazar({ codigo: 'SIN_CONEXION' })
    })
    const alerta = await screen.findByRole('alert')
    expect(within(alerta).getByText(/Sin conexión a internet\./)).toBeTruthy()
    expect(within(alerta).getByText(/Sigues usando el modelo Rápido\./)).toBeTruthy()
    fireEvent.click(within(alerta).getByRole('button', { name: 'Reintentar' }))
    expect(api.runtime.volverACalidad).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByRole('button', { name: 'Cancelar' })).toBeTruthy()
  })

  it('éxito: variante Calidad y toast', async () => {
    const api = await abrir({ rapido: true })
    await confirmar()
    api.pasarACalidad()
    await act(async () => {
      api.resolver()
    })
    expect(await screen.findByText('Modelo en uso: Calidad')).toBeTruthy()
    expect(screen.getByText('Ya usas el modelo Calidad.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Volver a Calidad/ })).toBeNull()
  })

  it('reenganche: muestra la descarga en curso y su fin con el toast', async () => {
    const api = await abrir({
      rapido: true,
      volver: { estado: 'descargando', bytes: 456e6, total: 913e6, error: null }
    })
    expect(
      await screen.findByText('Descargando el modelo Calidad… 49 % · 456 MB de 913 MB')
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Volver a Calidad…' })).toBeNull()
    api.pasarACalidad()
    expect(await screen.findByText('Ya usas el modelo Calidad.')).toBeTruthy()
  })

  it('reenganche: muestra el error en curso', async () => {
    await abrir({
      rapido: true,
      volver: {
        estado: 'error',
        bytes: 0,
        total: 913e6,
        error: { codigo: 'SIN_ESPACIO', mensaje: 'x' }
      }
    })
    const alerta = await screen.findByRole('alert')
    expect(within(alerta).getByText(/No queda espacio en el disco\./)).toBeTruthy()
    expect(within(alerta).getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })
})

describe('Ajustes: Acerca de', () => {
  it('incluye Acerca de y copia la información con Calidad y con Rápido', async () => {
    await abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Copiar información para soporte' }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('Modelo de separación: calidad\nDispositivo: cuda')
      )
    )
  })

  it('con Rápido copia la fecha del consentimiento', async () => {
    await abrir({ rapido: true })
    fireEvent.click(await screen.findByRole('button', { name: 'Copiar información para soporte' }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('Modelo de separación: rapido (aceptado el 2026-11-05)')
      )
    )
  })
})
