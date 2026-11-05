import { fireEvent, render, screen, within } from '@testing-library/react'
import type { EventoProgresoIpc, TrabajoIpc } from '@shared/ipc'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { paso, resumenPrueba } from '../biblioteca/resumenPrueba'
import { CabeceraCancion } from './CabeceraCancion'
import { MOTIVOS, pasosDeCancion, pasosDeNueva } from './pasos'

const trabajo = (extra: Partial<TrabajoIpc> = {}): TrabajoIpc => ({
  id: 't1',
  cancionId: 'c1',
  paso: 'separacion',
  cola: 'pesada',
  comando: 'separar',
  estado: 'en_curso',
  posicion: null,
  resultado: null,
  error: null,
  progreso: null,
  ...extra
})

function montar(
  resumen: Parameters<typeof CabeceraCancion>[0]['resumen'],
  actual: Parameters<typeof CabeceraCancion>[0]['actual'],
  trabajos: TrabajoIpc[] = [],
  progreso: Record<string, EventoProgresoIpc> = {}
) {
  const ir = vi.fn<(v: Vista) => void>()
  render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'anadir' }, ir }}>
      <TrabajosContexto.Provider value={{ trabajos, progreso, terminado: false }}>
        <CabeceraCancion resumen={resumen} actual={actual} />
      </TrabajosContexto.Provider>
    </NavegacionContexto.Provider>
  )
  return ir
}

const paso1 = () => screen.getByRole('button', { name: /^Paso 1/ })
const paso2 = () => screen.getByRole('button', { name: /^Paso 2/ })
const paso3 = () => screen.getByRole('button', { name: /^Paso 3/ })
const paso4 = () => screen.getByRole('button', { name: /^Paso 4/ })

describe('modo nueva canción', () => {
  it('muestra "Nueva canción", paso 1 actual y el resto no navegable', () => {
    montar(null, 'fuente')
    expect(screen.getByText('Nueva canción')).toBeInTheDocument()
    expect(paso1()).toHaveAttribute('aria-current', 'step')
    for (const p of [paso2(), paso3(), paso4()]) {
      expect(p).toHaveAttribute('aria-disabled', 'true')
    }
    expect(paso1()).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByText(/Borrador/)).not.toBeInTheDocument()
  })

  it('el tooltip de un paso bloqueado aparece al enfocarlo', () => {
    montar(null, 'fuente')
    fireEvent.focus(paso3())
    expect(screen.getByRole('tooltip')).toHaveTextContent('Primero añade el audio')
  })

  it('pasosDeNueva: ○ salvo el primero', () => {
    expect(pasosDeNueva().map((p) => p.indicador)).toEqual([
      'actual',
      'pendiente',
      'pendiente',
      'pendiente'
    ])
  })
})

describe('canción existente', () => {
  it('muestra «Título» · Artista y "Borrador · guardado"', () => {
    montar(resumenPrueba({ titulo: 'Bohemian Rhapsody', artista: 'Queen' }), 'letra')
    expect(screen.getByText(/«Bohemian Rhapsody»/)).toBeInTheDocument()
    expect(screen.getByText(/· Queen/)).toBeInTheDocument()
    expect(screen.getByText('Borrador · guardado ✓')).toBeInTheDocument()
  })

  it('muestra "Lista" si la canción está lista', () => {
    montar(resumenPrueba({ estado: 'lista' }), 'editor')
    expect(screen.getByText('Lista')).toBeInTheDocument()
  })

  it('"‹ Biblioteca" navega a la Biblioteca', () => {
    const ir = montar(resumenPrueba(), 'letra')
    fireEvent.click(screen.getByRole('button', { name: /Biblioteca/ }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'biblioteca' })
  })

  it('es un nav accesible con el paso actual marcado', () => {
    montar(resumenPrueba(), 'letra')
    const nav = screen.getByRole('navigation', { name: 'Pasos de la canción' })
    expect(within(nav).getAllByRole('button')).toHaveLength(4)
    expect(paso3()).toHaveAttribute('aria-current', 'step')
    expect(paso2()).not.toHaveAttribute('aria-current')
  })

  it('navegar por un paso usa ir({ tipo: cancion, id, paso })', () => {
    const ir = montar(resumenPrueba({ id: 'abc' }), 'letra')
    fireEvent.click(paso2())
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'abc', paso: 'progreso' })
  })

  it('un paso bloqueado no navega y muestra el motivo al pulsarlo', () => {
    const ir = montar(resumenPrueba({ id: 'abc' }), 'letra')
    expect(paso4()).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(paso4())
    expect(ir).not.toHaveBeenCalled()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Primero elige una letra')
  })

  it('el stepper cambia en vivo al guardar o vaciar la letra (nuevo resumen)', () => {
    const ir = vi.fn<(v: Vista) => void>()
    const con = (letra: 'pendiente' | 'completado') => (
      <NavegacionContexto.Provider value={{ vista: { tipo: 'anadir' }, ir }}>
        <TrabajosContexto.Provider value={{ trabajos: [], progreso: {}, terminado: false }}>
          <CabeceraCancion
            resumen={resumenPrueba({
              pasos: {
                fuente: paso('completado'),
                separacion: paso('en_curso', { progreso: 0.4 }),
                letra: paso(letra),
                edicion: paso('pendiente')
              }
            })}
            actual="letra"
          />
        </TrabajosContexto.Provider>
      </NavegacionContexto.Provider>
    )
    const { rerender } = render(con('pendiente'))
    expect(paso3()).toHaveAccessibleName(/paso actual/)
    expect(paso4()).toHaveAttribute('aria-disabled', 'true')
    rerender(con('completado'))
    expect(paso3()).toHaveAccessibleName(/completado|paso actual/)
    expect(paso4()).not.toHaveAttribute('aria-disabled')
    expect(paso2()).toHaveAccessibleName(/40 %/)
    rerender(con('pendiente'))
    expect(paso4()).toHaveAttribute('aria-disabled', 'true')
  })

  it('con trabajo vivo de separación muestra el porcentaje', () => {
    const resumen = resumenPrueba({
      pasos: {
        fuente: paso('completado'),
        separacion: paso('en_curso', { progreso: 0.1 }),
        letra: paso('pendiente'),
        edicion: paso('pendiente')
      }
    })
    montar(resumen, 'progreso', [trabajo()], {
      t1: {
        id: 't1',
        cancionId: 'c1',
        paso: 'separacion',
        fase: 'x',
        valor: 0.42,
        etaSegundos: null
      }
    })
    expect(paso2()).toHaveAccessibleName(/en curso, 42 %/)
    expect(paso2()).toHaveTextContent('42 %')
  })

  it('el trabajo vivo se actualiza al cambiar el contexto', () => {
    const resumen = resumenPrueba()
    montar(resumen, 'letra', [trabajo({ estado: 'en_cola', posicion: 1 })])
    expect(paso2()).toHaveTextContent('En cola')
  })
})

describe('indicadores (funciones puras)', () => {
  const r = (pasos: Partial<NonNullable<ReturnType<typeof resumenPrueba>['pasos']>>) =>
    resumenPrueba({
      pasos: {
        fuente: paso('completado'),
        separacion: paso('pendiente'),
        letra: paso('pendiente'),
        edicion: paso('pendiente'),
        ...pasos
      }
    })
  const ind = (res: ReturnType<typeof resumenPrueba>, actual = 'letra' as const) =>
    pasosDeCancion(res, actual).map((p) => p.indicador)

  it('fuente en curso: ⟳; separación y letra no navegables', () => {
    const p = pasosDeCancion(r({ fuente: paso('en_curso', { progreso: 0.3 }) }), 'progreso')
    expect(p[0]!.indicador).toBe('curso')
    expect(p[1]!.navegable).toBe(true)
    expect(p[2]!.navegable).toBe(false)
    expect(p[2]!.motivo).toBe('Espera a que termine la descarga')
  })

  it.each(['pendiente', 'error', 'interrumpido'] as const)(
    'fuente %s: Letra y Editor con "Primero añade el audio"',
    (estado) => {
      const p = pasosDeCancion(r({ fuente: paso(estado) }), 'fuente')
      expect(p[2]!.motivo).toBe(MOTIVOS['paso.motivo.sinFuente'])
      expect(p[1]!.motivo).toBe('Primero añade el audio')
      expect(p[3]!.motivo).toBe('Primero añade el audio')
    }
  )

  it('descargando: Letra y Editor con "Espera a que termine la descarga"', () => {
    const p = pasosDeCancion(r({ fuente: paso('en_curso', { progreso: 0.3 }) }), 'progreso')
    expect(p[2]!.motivo).toBe('Espera a que termine la descarga')
    expect(p[3]!.motivo).toBe('Espera a que termine la descarga')
  })

  it('con la fuente completada y sin letra: Letra navegable y Editor con "Primero elige una letra"', () => {
    const p = pasosDeCancion(r({ separacion: paso('en_curso', { progreso: 0.5 }) }), 'progreso')
    expect(p[2]!.navegable).toBe(true)
    expect(p[3]!.motivo).toBe('Primero elige una letra')
  })

  it('fuente con error: ✕ y navegable, pero el resto no', () => {
    const p = pasosDeCancion(r({ fuente: paso('error') }), 'fuente')
    expect(p[0]!.indicador).toBe('error')
    expect(p[0]!.navegable).toBe(true)
    expect(p[1]!.navegable).toBe(false)
  })

  it('fuente interrumpida: ⚠', () => {
    expect(ind(r({ fuente: paso('interrumpido') }))[0]).toBe('interrumpido')
  })

  it('fuente completada: ✓; separación pendiente: ○ y letra navegable', () => {
    const p = pasosDeCancion(r({}), 'progreso')
    expect(p[0]!.indicador).toBe('completado')
    expect(p[1]!.indicador).toBe('actual')
    expect(p[2]!.navegable).toBe(true)
  })

  it('separación en curso con % persistido', () => {
    const p = pasosDeCancion(r({ separacion: paso('en_curso', { progreso: 0.42 }) }), 'letra')
    expect(p[1]!.indicador).toBe('curso')
    expect(p[1]!.detalle).toBe('42 %')
  })

  it('separación en cola (trabajo vivo): "En cola"', () => {
    const p = pasosDeCancion(r({}), 'letra', {
      separacion: { trabajo: trabajo({ estado: 'en_cola', posicion: 2 }), progreso: null }
    })
    expect(p[1]!.indicador).toBe('pendiente')
    expect(p[1]!.detalle).toBe('En cola')
  })

  it('separación error e interrumpida', () => {
    expect(ind(r({ separacion: paso('error') }))[1]).toBe('error')
    expect(ind(r({ separacion: paso('interrumpido') }))[1]).toBe('interrumpido')
  })

  it('letra con líneas: ✓ (● si es el actual) y editor navegable', () => {
    const res = r({ letra: paso('completado') })
    const otra = pasosDeCancion(res, 'progreso')
    expect(otra[2]!.indicador).toBe('completado')
    expect(otra[3]!.navegable).toBe(true)
    expect(pasosDeCancion(res, 'letra')[2]!.indicador).toBe('actual')
  })

  it('sin letra: ● si es el actual y editor bloqueado', () => {
    const p = pasosDeCancion(r({}), 'letra')
    expect(p[2]!.indicador).toBe('actual')
    expect(p[3]!.navegable).toBe(false)
    expect(p[3]!.motivo).toBe('Primero elige una letra')
  })

  it('editor ✓ solo si la canción está lista', () => {
    const lista = resumenPrueba({ estado: 'lista', pasos: r({ letra: paso('completado') }).pasos })
    expect(pasosDeCancion(lista, 'progreso')[3]!.indicador).toBe('completado')
    expect(pasosDeCancion(r({ letra: paso('completado') }), 'progreso')[3]!.indicador).toBe(
      'pendiente'
    )
  })

  it('canción dañada (sin pasos): nada navegable', () => {
    const p = pasosDeCancion(resumenPrueba({ danada: true, pasos: null }), 'fuente')
    expect(p.every((x) => !x.navegable)).toBe(true)
  })
})
