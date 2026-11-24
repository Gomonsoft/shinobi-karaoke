import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { letraAleatoria, mulberry32 } from '@shared/__fixtures__/letrasAleatorias'
import { estiloPredeterminado } from '@shared/estilo'
import type { Letra } from '@shared/letra'
import { PANTALLA_PREDETERMINADA } from '@shared/pantalla'
import { carriles, cantantesDe, PARTES, validarReparto, type Parte } from '@shared/reparto'
import { PantallaLetra } from '../../karaoke/PantallaLetra'
import { aparienciaPropia, estadoInicial, reducirEditor } from './estado'
import type { AccionEditor, EstadoEditor } from './estado'
import { PistaSincronia } from './PistaSincronia'

/*
 * I-1 · B2. Secuencias pseudoaleatorias de acciones del editor (asignar, añadir y quitar cantantes, deshacer,
 * rehacer, cambiar «Varias voces», seleccionar) sobre letras aleatorias con reparto. Tras cada paso se renderiza,
 * sin desmontar entre pasos, la línea de tiempo y la vista previa (en pausa y sonando): cualquier excepción
 * al dibujar fallaría aquí. La vista previa sonando con un cambio de zonas es la que desmontaba el editor.
 */
const DURACION = 60_000
const noop = () => {}
const apariencia = aparienciaPropia(estiloPredeterminado())

function accionAlAzar(e: EstadoEditor, rng: () => number, t: number): AccionEditor {
  const lineas = e.actual.letra.lineas.filter((l) => l.tipo === 'linea')
  const ids = lineas.map((l) => l.id)
  const algunos = () => ids.filter(() => rng() < 0.3)
  const k = Math.floor(rng() * 10)
  switch (k) {
    case 0:
    case 1:
    case 2: {
      const parte = PARTES[Math.floor(rng() * PARTES.length)] as Parte
      return { tipo: 'asignar_parte', parte, ids: algunos(), ahora: t }
    }
    case 3:
      return { tipo: 'anadir_cantante', ...(rng() < 0.5 ? { asignarA: algunos() } : {}), ahora: t }
    case 4: {
      const c = cantantesDe(e.actual.letra)
      return {
        tipo: 'quitar_cantante',
        id: c[Math.floor(rng() * c.length)]!.id,
        ahora: t
      }
    }
    case 5:
      return { tipo: 'deshacer' }
    case 6:
      return { tipo: 'rehacer' }
    case 7:
      return {
        tipo: 'pantalla',
        pantalla: { ...PANTALLA_PREDETERMINADA, zonas: rng() < 0.5 ? 'una' : 'por_parte' },
        clave: 'zonas',
        ahora: t
      }
    default:
      return { tipo: 'seleccionar', id: ids[Math.floor(rng() * ids.length)] ?? null }
  }
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(720)
})
afterEach(() => vi.restoreAllMocks())

describe('editor con reparto: secuencias aleatorias de acciones y dibujo', () => {
  it.each([3, 11, 29, 47, 101, 233, 1009, 4242])(
    'semilla %i: la línea de tiempo y la vista previa se dibujan siempre',
    async (semilla) => {
      const rng = mulberry32(semilla)
      const inicial: Letra = letraAleatoria(rng, true)
      let e = estadoInicial({ letra: inicial, apariencia }, inicial.lineas[0]!.id)
      const dibujar = (sonando: boolean) => {
        const letra = e.actual.letra
        const { estilo: base, reemplazos } = e.actual.apariencia
        const estilo = reemplazos?.pantalla ? { ...base, pantalla: reemplazos.pantalla } : base
        return (
          <>
            <PistaSincronia
              letra={letra}
              seleccion={e.seleccion}
              seleccionadas={e.seleccionadas}
              duracionMs={DURACION}
              inactiva={false}
              sonando={sonando}
              posicionMs={0}
              obtenerTiempoAudio={() => 3000}
              buscar={noop}
              seleccionar={noop}
              iniciarMarcador={() => false}
              moverMarcador={noop}
              terminarMarcador={noop}
              ajustarMarcador={noop}
              bordeArrastrado={undefined}
              limite={null}
              reparto={{
                carriles: carriles(letra),
                altoCarril: 32,
                juntos: rng() < 0.3,
                juntosPorEspacio: false,
                alternarJuntos: noop,
                estilo,
                cantantes: cantantesDe(letra).length,
                asignar: noop
              }}
            />
            <PantallaLetra
              letra={letra}
              estilo={estilo}
              duracionMs={DURACION}
              titulo="Inventada"
              artista="Shinobi"
              vistaPrevia
              reproduciendo={sonando}
              obtenerTiempoAudio={() => 2000 + Math.floor(rng() * 20_000)}
              idEstatico={e.seleccion}
              movimiento="completo"
            />
          </>
        )
      }
      let sonando = false
      const r = render(dibujar(sonando))
      for (let paso = 0; paso < 25; paso++) {
        const accion = accionAlAzar(e, rng, 1000 + paso * 1000)
        e = reducirEditor(e, accion)
        // Con reparto, la letra que queda siempre es válida para main.
        expect(validarReparto(e.actual.letra), `tras ${JSON.stringify(accion)}`).toEqual([])
        if (rng() < 0.3) sonando = !sonando
        r.rerender(dibujar(sonando))
        if (sonando) {
          await act(async () => {
            await new Promise((res) => setTimeout(res, 20))
          })
        }
      }
      r.unmount()
    },
    60_000
  )
})
