import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { letra, linea } from '@shared/__fixtures__'
import type { EstadoMotor } from '../../karaoke/motorAudio'
import { Transporte } from './Transporte'

const estadoListo = {
  sonando: false,
  cargando: false,
  duracionMs: 30_000,
  pista: 'original',
  velocidad: 1
} as EstadoMotor

function montar(extra: Partial<Parameters<typeof Transporte>[0]> = {}) {
  return render(
    <Transporte
      estado={estadoListo}
      posicionMs={4200}
      duracionMs={30_000}
      letra={letra([linea('a', 'Uno', 1000)])}
      separacion={{ disponible: true, enCola: false, porcentaje: null }}
      volumen={0.8}
      silenciado={false}
      usarPista={vi.fn()}
      reproducir={vi.fn()}
      buscar={vi.fn()}
      fijarVelocidad={vi.fn()}
      fijarVolumen={vi.fn()}
      alternarSilencio={vi.fn()}
      entrarSync={vi.fn()}
      acciones={<button type="button">Marcar como lista</button>}
      {...extra}
    />
  )
}

const filas = () => [...screen.getByRole('region', { name: 'Reproducción' }).children]
const nombres = (fila: Element) =>
  [...fila.querySelectorAll('button, input[type=range]')].map(
    (e) => e.getAttribute('aria-label') ?? e.textContent?.trim()
  )

it('tiene exactamente dos filas con los controles en el orden de la spec', () => {
  montar()
  const [fila1, fila2, ...mas] = filas()
  expect(mas).toHaveLength(0)
  expect(nombres(fila1!)).toEqual([
    'Ir al principio',
    'Reproducir',
    'Tiempo de reproducción',
    '0,5×',
    '0,75×',
    '1×',
    'Silenciar',
    'Volumen'
  ])
  expect(fila1!.textContent).toMatch(/00:04\.2 \/ 00:30/)
  expect(fila1!.textContent).toContain('Velocidad')
  expect(nombres(fila2!)).toEqual([
    'Original',
    'Voz',
    'Instrumental',
    'Sincronizar al ritmo (S)',
    'Marcar como lista'
  ])
})

it('«Cargando audio…» sustituye al tiempo sin añadir fila', () => {
  montar({ estado: { ...estadoListo, cargando: true, duracionMs: null } as EstadoMotor })
  const [fila1, ...resto] = filas()
  expect(resto).toHaveLength(1)
  expect(fila1!.textContent).toContain('Cargando audio…')
  expect(fila1!.textContent).not.toMatch(/\d\d:\d\d\.\d \//)
})

it('en el modo sincronizar la segunda fila conserva solo «Escuchar»', () => {
  montar({ sincronizando: true })
  const [, fila2] = filas()
  expect(nombres(fila2!)).toEqual(['Original', 'Voz', 'Instrumental'])
})
