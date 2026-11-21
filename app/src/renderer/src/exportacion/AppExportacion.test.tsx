import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { inicialDePrueba } from '@shared/__fixtures__/exportacion'
import type { FotogramaExportacionIpc } from '@shared/exportacion'
import type { ApiExportacion } from '@shared/ipc'
import { AppExportacion } from './AppExportacion'

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(0), 0))
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      load: vi.fn(() => Promise.resolve([])),
      ready: Promise.resolve()
    })
  })
})
afterEach(() => vi.unstubAllGlobals())

function apiFalsa() {
  const inicial = inicialDePrueba()
  let oyente: (p: FotogramaExportacionIpc) => void = () => undefined
  const api: ApiExportacion = {
    inicial: vi.fn(() => Promise.resolve(inicial)),
    listo: vi.fn(() => Promise.resolve()),
    alFotograma: vi.fn((cb) => {
      oyente = cb
      return () => undefined
    })
  }
  return { api, inicial, pedir: (n: number) => oyente({ trabajoId: inicial.trabajoId, n }) }
}

it('espera las fuentes, pinta el fotograma pedido con marca de agua y confirma con listo', async () => {
  const { api, inicial, pedir } = apiFalsa()
  const { container } = render(<AppExportacion api={api} />)
  await waitFor(() => expect(container.querySelector('[data-marca-agua]')).not.toBeNull())
  expect(document.fonts.load).toHaveBeenCalledWith(expect.stringContaining('Atkinson'))
  pedir(0)
  await waitFor(() => expect(api.listo).toHaveBeenCalledWith(inicial.trabajoId, 0))
  expect(container.querySelector('[data-marca-agua]')).toHaveTextContent('Shinobi Karaoke')
  // Antes de la primera línea: pantalla de título.
  expect(container).toHaveTextContent(inicial.instantanea.titulo)
  // 60 s a 30 fps: el fotograma 1500 es el segundo 50.
  pedir(1500)
  await waitFor(() => expect(api.listo).toHaveBeenCalledWith(inicial.trabajoId, 1500))
})

it('ignora fotogramas de otro trabajo', async () => {
  const { api, inicial } = apiFalsa()
  let emitir: (p: FotogramaExportacionIpc) => void = () => undefined
  vi.mocked(api.alFotograma).mockImplementation((cb) => {
    emitir = cb
    return () => undefined
  })
  const { container } = render(<AppExportacion api={api} />)
  await waitFor(() => expect(container.querySelector('[data-marca-agua]')).not.toBeNull())
  emitir({ trabajoId: 'otro', n: 3 })
  await new Promise((r) => setTimeout(r, 20))
  expect(api.listo).not.toHaveBeenCalled()
  expect(inicial.trabajoId).not.toBe('otro')
})
