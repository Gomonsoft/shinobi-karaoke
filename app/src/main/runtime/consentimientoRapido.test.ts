import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manifiestoSchema, type Manifiesto } from '../../shared'
import { ServicioConfig } from '../configuracion'
import { crearGestorRuntime, type DependenciasGestor } from './gestor'

const manifiesto: Manifiesto = manifiestoSchema.parse(
  JSON.parse(readFileSync(join(__dirname, '../../../resources/runtime-manifest.json'), 'utf8'))
)

let datos: string
let config: ServicioConfig
let descargar: ReturnType<typeof vi.fn>

beforeEach(async () => {
  datos = mkdtempSync(join(tmpdir(), 'shinobi-consentimiento-rapido-'))
  config = await ServicioConfig.abrir(datos)
  descargar = vi.fn(async () => undefined)
})

afterEach(() => rmSync(datos, { recursive: true, force: true }))

function gestor() {
  const dependencias = {
    datos,
    manifiesto,
    config,
    descargador: { descargar }
  } as unknown as DependenciasGestor
  return crearGestorRuntime(dependencias)
}

describe('consentimiento del modelo Rápido', () => {
  it('rechaza descargarModelo sin consentimiento y no entrega el modelo al descargador', async () => {
    const runtime = gestor()

    await expect(runtime.descargarModelo('rapido')).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })

    expect(config.obtener().separacion.rapido_aceptado).toBeNull()
    expect(descargar).not.toHaveBeenCalled()
    expect(
      descargar.mock.calls
        .flat()
        .some((arg) =>
          manifiesto.modelos.find((modelo) => modelo.id === 'rapido')?.urls.includes(String(arg))
        )
    ).toBe(false)
  })

  it('rechaza instalar con modelo Rápido sin consentimiento antes de iniciar el runtime', async () => {
    const runtime = gestor()

    await expect(runtime.instalar({ modelo: 'rapido' })).rejects.toMatchObject({
      codigo: 'ARGUMENTOS_NO_VALIDOS'
    })

    expect(config.obtener().separacion.rapido_aceptado).toBeNull()
    expect(runtime.instalando()).toBe(false)
    expect(descargar).not.toHaveBeenCalled()
  })

  it('descarga el modelo solo después de guardar el consentimiento', async () => {
    const runtime = gestor()
    const fecha = '2026-11-05T10:00:00.000Z'
    await config.actualizar({ separacion: { rapido_aceptado: fecha } })

    await runtime.descargarModelo('rapido')

    expect(descargar).toHaveBeenCalledOnce()
    expect(descargar.mock.calls[0]?.[0].id).toBe('rapido')
    expect(config.obtener().separacion.modelos_descargados).toContain('rapido')
  })
})
