import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Cancion } from '@shared/cancion'
import type { EventoEncajeLetras, CandidatoLetra } from '@shared/letrasBusqueda'
import type { Letra as LetraDatos } from '@shared/letra'
import type { GuardarTiempos } from '@shared/letrasBusqueda'
import { resumenPrueba } from '../biblioteca/resumenPrueba'
import { olvidarPicosBase } from '../editor/picosBase'
import { BusquedaLetra } from './BusquedaLetra'
import { LetraElegida } from './LetraElegida'
import { apiLetrasFalsa } from './fixturesApi'
import {
  DURACION_PICOS_MS,
  apiPicosFalsa,
  cantosDeEjemplo,
  lineasSobreCantos
} from './fixturesPicos'

const cantos = cantosDeEjemplo()

const candidato = (
  id: number,
  lineas: CandidatoLetra['lineas'],
  encaje?: CandidatoLetra['encaje']
): CandidatoLetra => ({
  lrclib_id: id,
  titulo: `Canción ${id}`,
  artista: 'Artista inventado',
  album: null,
  duracion_ms: DURACION_PICOS_MS,
  sincronia: 'linea',
  diferencia_ms: 0,
  lineas,
  ...(encaje === undefined ? {} : { encaje })
})

beforeEach(() => olvidarPicosBase())

describe('Letra A · comprobación con la voz', () => {
  function montarA(
    candidatos: CandidatoLetra[],
    o: { picos?: ReturnType<typeof apiPicosFalsa>; separada?: boolean } = {}
  ) {
    const base = apiLetrasFalsa()
    const guardar = vi.fn(base.letras.guardar)
    const oyentes: ((e: EventoEncajeLetras) => void)[] = []
    window.shinobi = {
      letras: {
        ...base.letras,
        buscar: () => Promise.resolve({ candidatos, instrumental: false }),
        guardar,
        alEncaje: (cb: (e: EventoEncajeLetras) => void) => {
          oyentes.push(cb)
          return () => undefined
        }
      },
      picos: o.picos ?? apiPicosFalsa(cantos),
      sistema: { abrirEnlace: vi.fn() }
    } as never
    const onUsada = vi.fn()
    render(
      <BusquedaLetra
        cancionId="c1"
        tituloInicial="Canción"
        artistaInicial="Artista"
        onUsada={onUsada}
        separada={o.separada ?? true}
        duracionMs={DURACION_PICOS_MS}
      />
    )
    return {
      guardar,
      onUsada,
      emitir: (e: EventoEncajeLetras) => act(() => oyentes.forEach((cb) => cb(e)))
    }
  }

  it('F4-L1: cada veredicto con su texto; los concluyentes no muestran la duración', async () => {
    montarA([
      candidato(1, lineasSobreCantos(cantos), { veredicto: 'coincide', desfaseMs: 0 }),
      candidato(2, lineasSobreCantos(cantos, 800), { veredicto: 'desfasada', desfaseMs: 800 }),
      candidato(3, lineasSobreCantos(cantos), { veredicto: 'dudosa', desfaseMs: 0 }),
      candidato(4, lineasSobreCantos(cantos), { veredicto: 'no_coincide', desfaseMs: 0 })
    ])
    const opciones = await screen.findAllByRole('option')
    expect(opciones).toHaveLength(4)
    expect(opciones[0]).toHaveTextContent('Coincide con tu audio')
    expect(opciones[0]).not.toHaveTextContent('Duración igual')
    expect(opciones[1]).toHaveTextContent('Va 0,8 s adelantada: la corregiremos')
    expect(opciones[1]).not.toHaveTextContent('Duración igual')
    expect(opciones[2]).toHaveTextContent('No está claro si coincide con tu audio')
    expect(opciones[2]).toHaveTextContent('Duración igual')
    expect(opciones[3]).toHaveTextContent('No coincide con tu audio: puede ser otra versión')
  })

  it('F4-L4/L5: un candidato desfasado enseña los tiempos corregidos y se guarda con la corrección', async () => {
    const { guardar, onUsada } = montarA([
      candidato(2, lineasSobreCantos(cantos, 800), { veredicto: 'desfasada', desfaseMs: 800 })
    ])
    await screen.findByRole('option')
    const bloque = screen.getByRole('region', { name: 'Comprobación con tu audio' })
    expect(bloque).toHaveTextContent('Toda la letra sale 0,8 s antes que la voz')
    // Primer canto en 3000 ms: la letra trae 2200 y la vista previa la muestra ya movida.
    expect(screen.getByText(/\[00:03\.0\]/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Usar esta letra' }))
    await waitFor(() => expect(onUsada).toHaveBeenCalled())
    expect(guardar.mock.calls[0]![0]).toMatchObject({ desfase_ms: 800 })
    expect(guardar.mock.calls[0]![0].lineas[0]?.inicio_ms).toBe(2200)
    expect(onUsada.mock.calls[0]![3]).toEqual({ offset_ms: 800, desfase_corregido_ms: 800 })
  })

  it('F4-L4: un candidato que no coincide lista sus motivos con tramos en m:ss', async () => {
    const lejos: [number, number][] = [0, 1, 2, 3, 4, 5].map((i) => [
      50_000 + i * 1500,
      51_000 + i * 1500
    ])
    montarA([candidato(4, lineasSobreCantos(lejos), { veredicto: 'no_coincide', desfaseMs: 0 })])
    const bloque = await screen.findByRole('region', { name: 'Comprobación con tu audio' })
    await waitFor(() => expect(bloque).toHaveTextContent(/líneas caen donde no hay voz/))
    expect(bloque).toHaveTextContent(/de 0:50 a 0:5\d/)
    expect(bloque).toHaveTextContent('Puede ser otra versión de la canción')
  })

  it('F4-L6: sin voz separada, pendiente junto a la duración; al llegar la comprobación avisa sin reordenar', async () => {
    const { emitir } = montarA(
      [
        candidato(1, lineasSobreCantos(cantos)),
        candidato(2, lineasSobreCantos(cantos)),
        candidato(3, lineasSobreCantos(cantos))
      ],
      { picos: apiPicosFalsa(cantos, 'generando'), separada: false }
    )
    const opciones = await screen.findAllByRole('option')
    expect(opciones[0]).toHaveTextContent('Se comprobará con tu audio al terminar la separación')
    expect(opciones[0]).toHaveTextContent('Duración igual')
    emitir({
      cancionId: 'c1',
      encajes: [
        { lrclib_id: 1, encaje: { veredicto: 'no_coincide', desfaseMs: 0 } },
        { lrclib_id: 2, encaje: { veredicto: 'no_coincide', desfaseMs: 0 } },
        { lrclib_id: 3, encaje: { veredicto: 'coincide', desfaseMs: 0 } }
      ]
    })
    const texto = await screen.findByText(/La que mejor coincide es la 3\.ª/)
    const aviso = texto.closest('[role="status"]') as HTMLElement
    expect(aviso).not.toBeNull()
    // No se reordena ni cambia la selección.
    const despues = screen.getAllByRole('option')
    expect(despues[0]).toHaveAttribute('aria-selected', 'true')
    expect(despues[2]).toHaveTextContent('Coincide con tu audio')
    fireEvent.click(within(aviso).getByRole('button', { name: 'Seleccionarla' }))
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText(/La que mejor coincide/)).not.toBeInTheDocument()
  })

  it('F4-L8: con la forma de onda en error, no se pudo comprobar y se puede usar la letra', async () => {
    montarA([candidato(1, lineasSobreCantos(cantos))], { picos: apiPicosFalsa(cantos, 'error') })
    const opcion = await screen.findByRole('option')
    expect(opcion).toHaveTextContent('No se pudo comprobar con tu audio')
    expect(screen.getByRole('button', { name: 'Usar esta letra' })).toBeEnabled()
  })
})

describe('Letra C · letra elegida contra la voz', () => {
  function montarC(letraInicial: LetraDatos, o: { picos?: ReturnType<typeof apiPicosFalsa> } = {}) {
    const base = apiLetrasFalsa()
    const peticiones: GuardarTiempos[] = []
    window.shinobi = {
      biblioteca: { obtener: () => Promise.resolve({ letra: letraInicial } as unknown as Cancion) },
      alCambiarCancion: () => () => undefined,
      sistema: { abrirEnlace: vi.fn() },
      picos: o.picos ?? apiPicosFalsa(cantos),
      letras: {
        ...base.letras,
        abrirEdicion: () => Promise.resolve({ cancion: { letra: letraInicial }, sesionId: 's1' }),
        guardarTiempos: (p: GuardarTiempos) => {
          peticiones.push(p)
          return Promise.resolve(resumenPrueba())
        },
        cerrarEdicion: () => Promise.resolve()
      }
    } as never
    render(
      <LetraElegida
        cancionId="c1"
        letraInicial={letraInicial}
        estado="borrador"
        fuenteLista
        esperandoFuente={false}
        ignoradas={0}
        onCerrarIgnoradas={() => undefined}
        onResumen={() => undefined}
        onOtra={() => undefined}
        onIrAlEditor={() => undefined}
        separada
        duracionMs={DURACION_PICOS_MS}
      />
    )
    return peticiones
  }
  const letra = (desfase: number, extra: Partial<LetraDatos> = {}): LetraDatos => ({
    origen: 'lrclib',
    lrclib_id: null,
    offset_ms: 0,
    lineas: lineasSobreCantos(cantos, desfase),
    ...extra
  })

  it('coincide: una línea y ningún botón', async () => {
    montarC(letra(0))
    expect(await screen.findByText('Coincide con la voz de tu audio.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Corregir el desfase' })).not.toBeInTheDocument()
  })

  it('F4-L5: Corregir el desfase escribe offset y desfase sin tocar los tiempos; Quitar la corrección los deshace', async () => {
    const peticiones = montarC(letra(800))
    await screen.findByText(/Toda la letra va 0,8 s adelantada respecto a la voz\./)
    fireEvent.click(screen.getByRole('button', { name: 'Corregir el desfase' }))
    await screen.findByText(/Movimos toda la letra 0,8 s más tarde/)
    expect(peticiones[0]).toMatchObject({ offset_ms: 800, desfase_corregido_ms: 800 })
    expect(peticiones[0]!.tiempos.map((t) => t.inicio_ms)).toEqual(
      lineasSobreCantos(cantos, 800).map((l) => l.inicio_ms)
    )
    // Se anuncia con `role="status"`.
    expect(
      screen.getAllByRole('status').some((e) => e.textContent === 'Letra movida 0,8 s más tarde.')
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Quitar la corrección' }))
    await screen.findByText(/Toda la letra va 0,8 s adelantada respecto a la voz\./)
    expect(peticiones[1]).toMatchObject({ offset_ms: 0, desfase_corregido_ms: null })
  })

  it('F4-L11: un fallo al corregir muestra el error y ofrece Copiar detalles', async () => {
    const copiar = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText: copiar } })
    montarC(letra(800))
    await screen.findByText(/Toda la letra va 0,8 s adelantada/)
    ;(window.shinobi.letras as { guardarTiempos: unknown }).guardarTiempos = () =>
      Promise.reject({ codigo: 'ERROR_INTERNO', mensaje: 'falló' })
    fireEvent.click(screen.getByRole('button', { name: 'Corregir el desfase' }))
    expect(await screen.findByText('No se pudo mover la letra. Vuelve a intentarlo.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Copiar detalles' }))
    await waitFor(() => expect(copiar).toHaveBeenCalled())
    expect(copiar.mock.calls[0]![0]).toContain('ERROR_INTERNO')
  })

  it('una letra ya corregida (por la vista o la preparación) muestra Quitar la corrección', async () => {
    montarC(letra(800, { offset_ms: 800, desfase_corregido_ms: 800 }))
    expect(await screen.findByText(/Movimos toda la letra 0,8 s más tarde/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar la corrección' })).toBeInTheDocument()
  })

  it('no coincide: Ver por qué despliega los motivos; sin voz separada, pendiente', async () => {
    const lejos: [number, number][] = [0, 1, 2, 3, 4, 5].map((i) => [
      50_000 + i * 1500,
      51_000 + i * 1500
    ])
    montarC({ ...letra(0), lineas: lineasSobreCantos(lejos) })
    await screen.findByText(/La letra no coincide con la voz de tu audio/)
    const porQue = screen.getByRole('button', { name: 'Ver por qué' })
    expect(porQue).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(porQue)
    expect(porQue).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/líneas caen donde no hay voz/)).toBeInTheDocument()
  })
})
