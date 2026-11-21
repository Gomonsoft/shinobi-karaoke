import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  temaCatalogoPrueba,
  temasFalsos,
  impactoPrueba,
  type TemasFalsos
} from '../vistas/biblioteca/temasFalsos'
import { DialogoTemaGrupo } from './DialogoTemaGrupo'
import { textoQuitarGrupo } from './impactoGrupo'
import { afectada, impactoCon, instalar, origen } from './pruebas'

const NEON = '11111111-1111-4111-8111-111111111111'
const NOCHE = '22222222-2222-4222-8222-222222222222'
const temas = [
  temaCatalogoPrueba({ id: NEON, nombre: 'Neón' }),
  temaCatalogoPrueba({ id: NOCHE, nombre: 'Noche ninja' })
]

let t: TemasFalsos
const alAplicado = vi.fn()

function abrir(temaActualId: string | null = NEON) {
  render(
    <DialogoTemaGrupo
      abierto
      nivel="album"
      artista="Queen"
      album="A Night at the Opera"
      temaActualId={temaActualId}
      temas={temas}
      onCancelar={vi.fn()}
      onAplicado={alAplicado}
    />
  )
}

const llamadasPrevisualizar = () => t.llamadas.filter((l) => l.metodo === 'temas.previsualizar')

beforeEach(() => {
  vi.clearAllMocks()
  t = temasFalsos()
  instalar(t)
})

const quitando = (...despues: ReturnType<typeof origen>[]) =>
  impactoPrueba({
    afectadas: despues.map((d, i) =>
      afectada(String(i + 1), { despues: d, antes: origen('album', 'Neón') })
    ),
    totalGrupo: despues.length
  })

describe('textoQuitarGrupo', () => {
  const ctx = { nivel: 'album', artista: 'Queen', album: 'Opera' } as const
  it('mismo destino: variante quitar con tema y procedencia', () => {
    const r = textoQuitarGrupo(
      quitando(origen('artista', 'Neón'), origen('artista', 'Neón')).afectadas,
      ctx
    )
    expect(r.principal).toBe('2 canciones pasarán a usar «Neón», del artista Queen.')
    expect(r.noDisponible).toBeNull()
  })
  it('destinos distintos', () => {
    const r = textoQuitarGrupo(
      quitando(origen('aleatorio', 'Papel'), origen('predeterminado', 'Sol')).afectadas,
      ctx
    )
    expect(r.principal).toContain('volverán al tema que usaban sin el del álbum')
  })
  it('respaldo: nunca nombra tema; todas → «todas no disponibles»', () => {
    const todas = textoQuitarGrupo(
      quitando(origen('respaldo', 'Fantasma'), origen('respaldo', 'Fantasma')).afectadas,
      ctx
    )
    expect(todas.principal).toBe(
      '2 canciones se verán con el último aspecto guardado en cada una: su tema de origen no está en tus temas.'
    )
    expect(todas.noDisponible).toBeNull()
    expect(textoQuitarGrupo(quitando(origen('respaldo', 'F')).afectadas, ctx).principal).toMatch(
      /^1 canción se verá/
    )
    const mixta = textoQuitarGrupo(
      quitando(origen('respaldo', 'Fantasma'), origen('predeterminado', 'Sol')).afectadas,
      ctx
    )
    expect(mixta.principal).toBe('1 canción pasará a usar «Sol», tema predeterminado.')
    expect(mixta.noDisponible).toContain('1 de ellas quedará como «Tema no disponible»')
    expect(mixta.principal + (mixta.noDisponible ?? '')).not.toContain('Fantasma')
  })
})

describe('DialogoTemaGrupo', () => {
  it('foco inicial en el selector, Aplicar principal; una previsualización por cambio', async () => {
    t.programarImpacto(
      impactoCon(3, { totalGrupo: 4, excluidas: { propio: 1, cancion: 0, album: 0 } })
    )
    abrir()
    expect(await screen.findByText('Cambiará el aspecto de 3 de sus 4 canciones.')).toBeVisible()
    expect(
      screen.getByText('1 no cambia porque tiene tema personalizado o asignado.')
    ).toBeVisible()
    expect(screen.getByRole('button', { name: /^Tema: Neón/ })).toHaveFocus()
    expect(screen.getByText(/también lo usarán/)).toBeVisible()
    expect(llamadasPrevisualizar()).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /^Tema: Neón/ }))
    fireEvent.click(await screen.findByRole('option', { name: /Noche ninja/ }))
    await waitFor(() => expect(llamadasPrevisualizar()).toHaveLength(2))
    expect((llamadasPrevisualizar()[1]!.args[0] as { temaId: string }).temaId).toBe(NOCHE)
  })

  it('quitar el tema: variante con destino y filas con destino de cada una', async () => {
    t.programarImpacto((op) =>
      op.tipo === 'asignarGrupo' && op.temaId === null
        ? quitando(
            origen('respaldo', 'Fantasma'),
            origen('predeterminado', 'Sol'),
            origen('incluido')
          )
        : impactoCon(1)
    )
    abrir()
    await screen.findByText(/^Cambiará el aspecto/)
    fireEvent.click(screen.getByRole('button', { name: /^Tema: Neón/ }))
    fireEvent.click(
      await screen.findByRole('option', { name: /Sin tema de álbum \(usar el del artista/ })
    )
    expect(await screen.findByText(/volverán al tema que usaban sin el del álbum/)).toBeVisible()
    expect(screen.getByText(/^⚠ 1 de ellas quedará como «Tema no disponible»/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Ver las canciones/ }))
    const filas = screen.getAllByRole('listitem')
    expect(filas).toHaveLength(3)
    expect(filas[0]).toHaveTextContent(
      'Canción 1 — Queen · se verá con el último aspecto guardado (su tema de origen no está en tus temas)'
    )
    expect(filas[0]).not.toHaveTextContent('Fantasma')
    expect(within(filas[0]!).getByText('⚠')).toHaveAttribute('aria-hidden', 'true')
    expect(filas[1]).toHaveTextContent('Canción 2 — Queen · usará «Sol» (predeterminado)')
    expect(filas[2]).toHaveTextContent('Canción 3 — Queen · usará el estilo incluido')
    expect(screen.queryByText(/también lo usarán/)).toBeNull()
  })

  it('con 0 afectadas muestra bib.grupo.ninguna y Aplicar sigue disponible', async () => {
    t.programarImpacto(impactoCon(0, { totalGrupo: 2 }))
    abrir(null)
    expect(await screen.findByText('Ahora no cambiará ninguna canción.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    await waitFor(() => expect(alAplicado).toHaveBeenCalledTimes(1))
  })

  it('descarta respuestas antiguas de previsualizar', async () => {
    const pendientes: ((i: ReturnType<typeof impactoCon>) => void)[] = []
    t.api.temas.previsualizar = vi.fn(
      () => new Promise<ReturnType<typeof impactoCon>>((resolver) => pendientes.push(resolver))
    )
    abrir()
    fireEvent.click(screen.getByRole('button', { name: /^Tema: Neón/ }))
    fireEvent.click(await screen.findByRole('option', { name: /Noche ninja/ }))
    await waitFor(() => expect(pendientes).toHaveLength(2))
    pendientes[1]!(impactoCon(2, { totalGrupo: 5 }))
    expect(await screen.findByText('Cambiará el aspecto de 2 de sus 5 canciones.')).toBeVisible()
    pendientes[0]!(impactoCon(9, { totalGrupo: 9 }))
    await Promise.resolve()
    expect(screen.queryByText(/9/)).toBeNull()
  })
})

describe('lista del selector dentro del diálogo', () => {
  it('se abre dentro del diálogo: `Dialogo` pone `inert` al resto de <body> y fuera no recibiría clics (0176)', () => {
    abrir()
    const dialogo = screen.getByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: /^Tema:/ }))
    const lista = screen.getByRole('listbox', { name: 'Tema' })
    expect(dialogo).toContainElement(lista)
    expect(lista.closest('[inert]')).toBeNull()
  })
})
