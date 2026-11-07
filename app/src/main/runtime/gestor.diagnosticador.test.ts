import { beforeEach, describe, expect, it, vi } from 'vitest'

const { crearClienteWorkerMock } = vi.hoisted(() => {
  const ejecutarMock = vi.fn().mockResolvedValue({
    perfil: 'cpu',
    gpu: null,
    vram_mb: null,
    motivo_rebaja: null
  })
  return { crearClienteWorkerMock: vi.fn(() => ({ ejecutar: ejecutarMock })) }
})

vi.mock('../trabajos/worker', () => ({ crearClienteWorker: crearClienteWorkerMock }))

import { crearClienteWorker } from '../trabajos/worker'
import { diagnosticadorReal } from './gestor'

describe('diagnosticadorReal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('desactiva la escritura de bytecode al ejecutar Python del runtime', async () => {
    await diagnosticadorReal.diagnosticar({
      perfilPrevisto: 'cpu',
      interprete: '/datos/runtime/venv/bin/python',
      rutaCodigoWorker: '/app/resources/worker'
    })

    expect(crearClienteWorker).toHaveBeenCalledWith({
      lanzador: {
        comando: '/datos/runtime/venv/bin/python',
        argsBase: ['-m', 'shinobi_worker'],
        env: {
          PYTHONPATH: '/app/resources/worker',
          PYTHONDONTWRITEBYTECODE: '1'
        }
      }
    })
  })
})
