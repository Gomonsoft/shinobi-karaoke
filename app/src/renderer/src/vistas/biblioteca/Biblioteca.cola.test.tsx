import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import {
  estadoP1,
  estadoP4,
  estadoP4FinDeCola,
  estadoP6,
  estadoSinCola,
  pantalla,
  TRANSICION_ID
} from '@shared/__fixtures__/sesion'
import type { EstadoSesionIpc } from '@shared/sesion'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { useSesion } from '../../sesion/ProveedorSesion'
import { BIB_COLA, COLA, EDI_BLOQUEO, SES } from '../../sesion/textos'
import { montarConSesion } from './montarConSesion'
import { paso, resumenPrueba } from './resumenPrueba'

const DOS = { pantallas: [pantalla(1), pantalla(2)], colocacion: 'libre' as const }
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

// Los ids coinciden con `cancionId` de las entradas de los estados doble (`cancion-N`).
const activa = resumenPrueba({ id: 'cancion-1', titulo: 'Bohemian Rhapsody', estado: 'lista' })
const pendiente = resumenPrueba({ id: 'cancion-2', titulo: 'La flaca', estado: 'lista' })
const libre = resumenPrueba({ id: 'cancion-9', titulo: 'Despacito', estado: 'lista' })
const borradorListo = resumenPrueba({
  id: 'cancion-8',
  titulo: 'Casi lista',
  estado: 'borrador',
  pasos: {
    fuente: paso('completado'),
    separacion: paso('completado'),
    letra: paso('completado'),
    edicion: paso('pendiente')
  }
})

afterEach(() => {
  cleanup()
  cerrarTodosLosToasts()
})

const tarjeta = async (titulo: string) =>
  (await screen.findAllByRole('article')).find((a) =>
    a.getAttribute('aria-label')?.startsWith(`${titulo},`)
  )!
const abrirMenu = async (titulo: string) => {
  const t = await tarjeta(titulo)
  fireEvent.click(within(t).getByRole('button', { name: `Más acciones de «${titulo}»` }))
  return t
}
const opciones = () => screen.getAllByRole('menuitem').map((m) => m.textContent)
const item = (nombre: string) => screen.getByRole('menuitem', { name: new RegExp(nombre) })

/** Espera a que el estado de la sesión haya llegado al proveedor. */
async function conSesion(estado: EstadoSesionIpc) {
  const r = montarConSesion([activa, pendiente, libre, borradorListo], estado, { pantallas: DOS })
  await tarjeta('Despacito')
  await act(async () => {})
  return r
}

describe('tarjetas durante la sesión (S10, E1)', () => {
  it('la acción principal de una Lista es «A la cola» y agrega al final', async () => {
    const { sesion } = await conSesion(estadoP1())
    const t = await tarjeta('Despacito')
    expect(within(t).queryByRole('button', { name: /^Reproducir/ })).toBeNull()
    fireEvent.click(within(t).getByRole('button', { name: BIB_COLA.botonAria('Despacito') }))
    await waitFor(() =>
      expect(sesion.llamadas).toContainEqual(['cola.agregar', 'cancion-9', 'final'])
    )
  })

  it('Intro en la tarjeta (portada) agrega al final y no abre el reproductor', async () => {
    const { sesion, abrir } = await conSesion(estadoP1())
    const t = await tarjeta('Despacito')
    t.focus()
    fireEvent.keyDown(t, { key: 'Enter' })
    await waitFor(() =>
      expect(sesion.llamadas).toContainEqual(['cola.agregar', 'cancion-9', 'final'])
    )
    expect(abrir).not.toHaveBeenCalled()
  })

  it('el ⋯ de una Lista no ofrece «Reproducir» ni «Reproducir en otra pantalla…»', async () => {
    await conSesion(estadoP1())
    await abrirMenu('Despacito')
    expect(opciones()).toEqual([
      'Reproducir a continuación',
      'Agregar al final',
      'Editar',
      'Editar datos',
      'Aplicar tema…',
      'Volver a borrador',
      'Mostrar en la carpeta',
      'Eliminar…'
    ])
  })

  it('E1: «Editar» es aria-disabled con candado y abre edi.bloqueo sin navegar', async () => {
    const { ir } = await conSesion(estadoP1())
    await abrirMenu('Despacito')
    const editar = screen.getByRole('menuitem', { name: `Editar${EDI_BLOQUEO.aria}` })
    expect(editar).toHaveAttribute('aria-disabled', 'true')
    expect(editar).toHaveAccessibleName(`Editar${EDI_BLOQUEO.aria}`)
    fireEvent.click(editar)
    expect(await screen.findByRole('dialog', { name: EDI_BLOQUEO.titulo })).toBeInTheDocument()
    expect(ir).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: EDI_BLOQUEO.entendido }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('E1: «Continuar» hacia Letra o Editor y su portada muestran el bloqueo', async () => {
    const { ir } = await conSesion(estadoP1())
    const t = await tarjeta('Casi lista')
    fireEvent.click(within(t).getByRole('button', { name: /^Continuar/ }))
    expect(await screen.findByRole('dialog', { name: EDI_BLOQUEO.titulo })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: EDI_BLOQUEO.entendido }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(within(t).getByRole('button', { name: 'Casi lista' }))
    expect(await screen.findByRole('dialog', { name: EDI_BLOQUEO.titulo })).toBeInTheDocument()
    expect(ir).not.toHaveBeenCalled()
  })

  it('Eliminar y Volver a borrador de la activa quedan aria-disabled con su motivo', async () => {
    await conSesion(estadoP1())
    await abrirMenu('Bohemian Rhapsody')
    expect(item('Eliminar…')).toHaveAttribute('aria-disabled', 'true')
    expect(item('Eliminar…')).toHaveAttribute('title', BIB_COLA.activaBloqueada)
    expect(item('Volver a borrador')).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(item('Eliminar…'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Editar datos y Aplicar tema siguen disponibles', async () => {
    await conSesion(estadoP1())
    await abrirMenu('Despacito')
    expect(item('Editar datos')).not.toHaveAttribute('aria-disabled')
    expect(item('Aplicar tema…')).not.toHaveAttribute('aria-disabled')
  })

  it('la línea de cola: «Sonando» en la activa y «En la cola» en las pendientes', async () => {
    await conSesion(estadoP1())
    expect(within(await tarjeta('Bohemian Rhapsody')).getByText(BIB_COLA.sonando)).toBeVisible()
    expect(within(await tarjeta('La flaca')).getByText(BIB_COLA.enCola)).toBeVisible()
    expect(within(await tarjeta('Despacito')).queryByText(BIB_COLA.enCola)).toBeNull()
  })
})

describe('sin sesión con la cola preparada', () => {
  it('«Reproducir» abre el reproductor local y la tarjeta muestra «En la cola»', async () => {
    const { abrir } = montarConSesion([activa, pendiente], estadoP6(), { pantallas: DOS })
    const t = await tarjeta('Bohemian Rhapsody')
    await waitFor(() => expect(within(t).getByText(BIB_COLA.enCola)).toBeVisible())
    fireEvent.click(within(t).getByRole('button', { name: 'Reproducir «Bohemian Rhapsody»' }))
    expect(abrir).toHaveBeenCalledWith('cancion-1')
  })

  it('el ⋯ ofrece Reproducir, Reproducir en otra pantalla…, a continuación y al final', async () => {
    montarConSesion([libre], estadoSinCola(), { pantallas: DOS })
    await abrirMenu('Despacito')
    expect(opciones().slice(0, 4)).toEqual([
      'Reproducir',
      SES.menuOtraPantalla,
      'Reproducir a continuación',
      'Agregar al final'
    ])
    fireEvent.click(item(SES.menuOtraPantalla))
    expect(await screen.findByRole('dialog', { name: SES.dialogoTitulo })).toBeInTheDocument()
    expect(screen.getByText(/Empezará con «Despacito»/)).toBeInTheDocument()
  })

  it('Borradores y Dañadas no ofrecen las opciones de cola', async () => {
    montarConSesion([borradorListo], estadoSinCola(), { pantallas: DOS })
    await abrirMenu('Casi lista')
    expect(opciones()).not.toContain('Agregar al final')
    expect(opciones()).not.toContain('Reproducir a continuación')
  })

  it('con la primera entrada de una cola vacía se abre el panel', async () => {
    function Sonda() {
      return <output data-testid="panel">{String(useSesion().panelAbierto)}</output>
    }
    montarConSesion([libre], estadoSinCola(), { pantallas: DOS, hijos: <Sonda /> })
    await abrirMenu('Despacito')
    fireEvent.click(item('Agregar al final'))
    await waitFor(() => expect(screen.getByTestId('panel')).toHaveTextContent('true'))
  })
})

describe('agregar a la cola (S4)', () => {
  /** `cola.agregar` con una entrada distinta cada vez. */
  function dobleAgregar(r: Awaited<ReturnType<typeof conSesion>>, errores: unknown[] = []) {
    let n = 100
    Object.assign(window.shinobi.cola, {
      agregar: (cancionId: string, donde: unknown) => {
        r.sesion.llamadas.push(['cola.agregar', cancionId, donde])
        const fallo = errores.shift()
        if (fallo) return Promise.reject(fallo)
        n++
        const estado = estadoP1({
          pendientes: [{ ...estadoP1().pendientes[0]!, entradaId: uuid(n) }]
        })
        return Promise.resolve({ estado: { ...estado, revision: n }, entradaId: uuid(n) })
      }
    })
  }

  it('la misma canción dos veces da dos entradas y [Deshacer] quita solo la suya', async () => {
    const r = await conSesion(estadoP1())
    dobleAgregar(r)
    const t = await tarjeta('Despacito')
    const boton = () => within(t).getByRole('button', { name: BIB_COLA.botonAria('Despacito') })
    fireEvent.click(boton())
    await screen.findByText(COLA.toast.final('Despacito', 1))
    fireEvent.click(boton())
    await waitFor(() =>
      expect(screen.getAllByText(COLA.toast.final('Despacito', 1))).toHaveLength(2)
    )
    const deshacer = screen.getAllByRole('button', { name: COLA.toast.deshacer })
    fireEvent.click(deshacer[0]!)
    await waitFor(() =>
      expect(r.sesion.llamadas.filter((l) => l[0] === 'cola.quitar')).toEqual([
        ['cola.quitar', uuid(101)]
      ])
    )
  })

  it('«Reproducir a continuación» usa donde: siguiente y su toast', async () => {
    const r = await conSesion(estadoP1())
    dobleAgregar(r)
    await abrirMenu('Despacito')
    fireEvent.click(item('Reproducir a continuación'))
    expect(await screen.findByText(COLA.toast.siguiente('Despacito'))).toBeInTheDocument()
    expect(r.sesion.llamadas).toContainEqual(['cola.agregar', 'cancion-9', 'siguiente'])
  })

  it('COLA_LLENA: toast cola.llena', async () => {
    const r = await conSesion(estadoP1())
    dobleAgregar(r, [{ codigo: 'COLA_LLENA', mensaje: 'x' }])
    const t = await tarjeta('Despacito')
    fireEvent.click(within(t).getByRole('button', { name: BIB_COLA.botonAria('Despacito') }))
    expect(await screen.findByText(COLA.llena)).toBeInTheDocument()
  })

  it('CANCION_NO_DISPONIBLE: toast de error y ninguna entrada', async () => {
    const r = await conSesion(estadoP1())
    dobleAgregar(r, [{ codigo: 'CANCION_NO_DISPONIBLE', mensaje: 'x' }])
    const t = await tarjeta('Despacito')
    fireEvent.click(within(t).getByRole('button', { name: BIB_COLA.botonAria('Despacito') }))
    expect(await screen.findByText(SES.errorNoDisponible('Despacito'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: COLA.toast.deshacer })).toBeNull()
  })

  it('en espera sin candidata, el toast añade [Iniciar ahora] y empieza la entrada', async () => {
    const r = await conSesion(estadoP4({ pendientes: [] }))
    dobleAgregar(r)
    const t = await tarjeta('Despacito')
    fireEvent.click(within(t).getByRole('button', { name: BIB_COLA.botonAria('Despacito') }))
    fireEvent.click(await screen.findByRole('button', { name: COLA.toast.iniciarAhora }))
    await waitFor(() => expect(r.sesion.llamadas).toContainEqual(['sesion.empezar', uuid(101)]))
  })

  it('en el fin de la cola, el toast es cola.toast.cuenta y puede detener la cuenta', async () => {
    const r = await conSesion(estadoP4FinDeCola())
    const entradaId = uuid(300)
    Object.assign(window.shinobi.cola, {
      agregar: () => {
        const base = estadoP4FinDeCola({ revision: 40 })
        return Promise.resolve({
          entradaId,
          estado: {
            ...base,
            pendientes: [{ ...estadoP1().pendientes[0]!, entradaId }],
            sesion: {
              ...base.sesion!,
              fase: 'transicion' as const,
              transicion: {
                transicionId: TRANSICION_ID,
                candidataId: entradaId,
                restanteMs: 3000,
                duracionMs: 4000,
                congelada: false
              }
            }
          }
        })
      }
    })
    const t = await tarjeta('Despacito')
    fireEvent.click(within(t).getByRole('button', { name: BIB_COLA.botonAria('Despacito') }))
    expect(await screen.findByText(COLA.toast.cuenta('Despacito', 3))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: COLA.toast.detener }))
    await waitFor(() =>
      expect(r.sesion.llamadas).toContainEqual(['sesion.detenerTransicion', TRANSICION_ID])
    )
  })
})

describe('diálogos de una pendiente (S11)', () => {
  it('Eliminar una pendiente añade bib.cola.dialogo.eliminar', async () => {
    await conSesion(estadoP1())
    await abrirMenu('La flaca')
    fireEvent.click(item('Eliminar…'))
    expect(await screen.findByText(new RegExp(BIB_COLA.dialogoEliminar))).toBeInTheDocument()
  })

  it('Volver a borrador de una pendiente añade bib.cola.dialogo.borrador', async () => {
    await conSesion(estadoP1())
    await abrirMenu('La flaca')
    fireEvent.click(item('Volver a borrador'))
    expect(await screen.findByText(new RegExp(BIB_COLA.dialogoBorrador))).toBeInTheDocument()
  })

  it('una canción que no está en la cola no lleva la frase', async () => {
    await conSesion(estadoP1())
    await abrirMenu('Despacito')
    fireEvent.click(item('Eliminar…'))
    await screen.findByRole('dialog')
    expect(screen.queryByText(new RegExp(BIB_COLA.dialogoEliminar))).toBeNull()
  })
})
