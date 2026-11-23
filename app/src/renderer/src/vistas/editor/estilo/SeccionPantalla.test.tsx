import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { letra, linea } from '@shared/__fixtures__'
import { estiloPredeterminado } from '@shared/estilo'
import { PANTALLA_PREDETERMINADA, type Pantalla } from '@shared/pantalla'
import { aparienciaPropia, aSeleccionIpc, estadoInicial, reducirEditor } from '../estado'
import { SeccionPantalla, type ControlPantalla } from './SeccionPantalla'
import { T_PANTALLA as T } from './textosPantalla'

function control(parcial: Partial<ControlPantalla> = {}): ControlPantalla {
  return {
    resumen: false,
    propia: false,
    d3Propia: false,
    pantalla: { ...PANTALLA_PREDETERMINADA },
    procedencia: 'cancion',
    temaNombre: 'Noche ninja',
    ejemploActivo: false,
    movimientoReducido: false,
    cambiar: vi.fn(),
    cambiarSoloCancion: vi.fn(),
    usarLaDelTema: vi.fn(),
    alternarEjemplo: vi.fn(),
    ...parcial
  }
}
const montar = (c: ControlPantalla) => render(<SeccionPantalla control={c} inactivo={false} />)
const pantallaDe = (lineas: number, pasadas: number): Pantalla => ({
  ...PANTALLA_PREDETERMINADA,
  lineas,
  pasadas
})

describe('SeccionPantalla', () => {
  it('F1-E1/E3: tres grupos, el resumen dice lo que se ve y cambiar las líneas avisa al historial', () => {
    const c = control()
    montar(c)
    expect(screen.getByRole('radiogroup', { name: 'Líneas a la vez' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Líneas ya cantadas' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Cambio de línea' })).toBeInTheDocument()
    expect(screen.getByText(/1 ya cantada y las 3 siguientes\./)).toBeVisible()
    fireEvent.click(screen.getByRole('radio', { name: '7' }))
    expect(c.cambiar).toHaveBeenCalledWith({ ...PANTALLA_PREDETERMINADA, lineas: 7 }, 'lineas.7')
  })

  it('F1-E3: con 2 líneas el resumen termina «y la siguiente.»', () => {
    montar(control({ pantalla: pantallaDe(2, 0) }))
    expect(screen.getByText('Se ven la línea que suena y la siguiente.')).toBeVisible()
  })

  it.each([
    [3, [true, true], T.minimo1],
    [5, [false, true], T.minimo2],
    [7, [false, false], null]
  ])(
    'F1-E4: con %i líneas, «1» y «2» no disponibles %j y motivo visible',
    (n, [uno, dos], motivo) => {
      montar(control({ pantalla: pantallaDe(n as number, 1) }))
      const grupo = screen.getByRole('radiogroup', { name: 'Líneas ya cantadas' })
      const opciones = Array.from(grupo.querySelectorAll('[role="radio"]'))
      expect(opciones[1]!.getAttribute('aria-disabled') === 'true').toBe(uno)
      expect(opciones[2]!.getAttribute('aria-disabled') === 'true').toBe(dos)
      if (motivo) expect(screen.getAllByText(motivo as string).length).toBeGreaterThan(0)
      else expect(screen.queryByText(T.minimo2)).toBeNull()
    }
  )

  it('F1-E5: la elección «2» se recuerda: con 5 líneas se ve «1» y con 7, «2»', () => {
    const { rerender } = montar(control({ pantalla: pantallaDe(5, 2) }))
    const elegida = () =>
      screen
        .getByRole('radiogroup', { name: 'Líneas ya cantadas' })
        .querySelector('[aria-checked="true"]')!.textContent
    expect(elegida()).toBe('1')
    rerender(<SeccionPantalla control={control({ pantalla: pantallaDe(7, 2) })} inactivo={false} />)
    expect(elegida()).toBe('2')
  })

  it('una opción no disponible no se puede elegir', () => {
    const c = control({ pantalla: pantallaDe(3, 0) })
    montar(c)
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Líneas ya cantadas' })).getByRole('radio', {
        name: '2'
      })
    )
    expect(c.cambiar).not.toHaveBeenCalled()
  })

  it('«Cambio de línea»: los tres radios con su ayuda', () => {
    const c = control()
    montar(c)
    fireEvent.click(screen.getByRole('radio', { name: /^Fundido/ }))
    expect(c.cambiar).toHaveBeenCalledWith(
      { ...PANTALLA_PREDETERMINADA, transicion: 'fundido' },
      'cambio.fundido'
    )
    expect(screen.getByText(T.opciones.ninguna[1])).toBeVisible()
  })

  it('D1: resumen con procedencia y «Cambiar solo en esta canción»; con bloque propio, «Usar la del tema»', () => {
    const c = control({ resumen: true })
    const v = montar(c)
    expect(screen.getByText('5 líneas · 1 ya cantada · desplazamiento')).toBeVisible()
    expect(screen.getByText('Del tema «Noche ninja»')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: T.soloCancion }))
    expect(c.cambiarSoloCancion).toHaveBeenCalled()
    v.unmount()
    const propia = control({ propia: true })
    montar(propia)
    expect(screen.getByText(T.propia('Noche ninja'))).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: T.usarTema }))
    expect(propia.usarLaDelTema).toHaveBeenCalled()
  })

  it('F1-E12: con movimiento reducido del sistema sale la nota y los controles siguen', () => {
    const c = control({ movimientoReducido: true })
    montar(c)
    expect(screen.getByText(T.reducido)).toBeVisible()
    fireEvent.click(screen.getByRole('radio', { name: '4' }))
    expect(c.cambiar).toHaveBeenCalled()
  })

  it('«Ver un ejemplo» y «Detener el ejemplo»', () => {
    const v = montar(control())
    fireEvent.click(screen.getByRole('button', { name: T.ejemplo }))
    v.unmount()
    montar(control({ ejemploActivo: true }))
    expect(screen.getByRole('button', { name: T.detenerEjemplo })).toBeVisible()
  })
})

describe('reducer: acción «pantalla»', () => {
  const inicial = (tema: boolean) =>
    estadoInicial(
      {
        letra: letra([linea('a', 'Uno', 1000)]),
        apariencia: tema
          ? {
              seleccion: { modo: 'tema', temaId: '0b9f7a4e-3c1d-4f6a-9d2e-5a8b1c7e4f30' },
              estilo: estiloPredeterminado(),
              reemplazos: {
                espera: {
                  puntos: true,
                  barra: false,
                  cuenta: false,
                  primera_entrada: false,
                  umbral_ms: 4000
                }
              }
            }
          : aparienciaPropia(estiloPredeterminado())
      },
      'a'
    )

  it('con estilo propio escribe `estilo.pantalla`; cada cambio es un paso y se deshace', () => {
    let e = reducirEditor(inicial(false), {
      tipo: 'pantalla',
      pantalla: pantallaDe(7, 2),
      clave: 'lineas.7',
      ahora: 0
    })
    expect(e.actual.apariencia.estilo.pantalla).toEqual(pantallaDe(7, 2))
    e = reducirEditor(e, {
      tipo: 'pantalla',
      pantalla: pantallaDe(7, 1),
      clave: 'pasadas.1',
      ahora: 5
    })
    expect(e.pasado).toHaveLength(2)
    e = reducirEditor(e, { tipo: 'deshacer' })
    expect(e.actual.apariencia.estilo.pantalla).toEqual(pantallaDe(7, 2))
  })

  it('con tema escribe el reemplazo sin tocar la espera, lo envía aparte y `null` lo quita', () => {
    let e = reducirEditor(inicial(true), {
      tipo: 'pantalla',
      pantalla: pantallaDe(3, 0),
      clave: 'propia',
      ahora: 0
    })
    expect(e.actual.apariencia.estilo.pantalla).toBeUndefined()
    expect(e.actual.apariencia.reemplazos).toMatchObject({
      pantalla: pantallaDe(3, 0),
      espera: { puntos: true }
    })
    expect(aSeleccionIpc(e.actual.apariencia)).toMatchObject({
      modo: 'tema',
      reemplazos: { espera: { puntos: true } },
      reemplazo_pantalla: pantallaDe(3, 0)
    })
    e = reducirEditor(e, { tipo: 'pantalla', pantalla: null, clave: 'usarTema', ahora: 10 })
    expect(e.actual.apariencia.reemplazos).toEqual({ espera: expect.any(Object) })
    expect(aSeleccionIpc(e.actual.apariencia)).toMatchObject({ reemplazo_pantalla: null })
  })

  it('el mismo valor no añade pasos', () => {
    const e = reducirEditor(inicial(false), {
      tipo: 'pantalla',
      pantalla: null,
      clave: 'x',
      ahora: 0
    })
    expect(e.pasado).toHaveLength(0)
  })
})
