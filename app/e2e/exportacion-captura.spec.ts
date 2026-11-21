import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { configPredeterminada } from '../src/shared/config'
import { estiloPredeterminado } from '../src/shared/estilo'
import { instantaneaDePrueba } from '../src/shared/__fixtures__/exportacion'
import { crearTemporal } from './temporales'

/**
 * Captura real de la ventana offscreen (0234, ADR 0019 §2): tamaño exacto a escala 1 y BGRA.
 * La instantánea lleva un fondo rojo puro: los bytes del primer píxel deben ser `00 00 FF FF`.
 */
for (const [ancho, alto] of [
  [640, 480],
  [3840, 2160]
] as const) {
  test(`captura ${ancho}x${alto} exacta y en BGRA`, async () => {
    test.setTimeout(60_000)
    const datos = crearTemporal(`exportacion-captura-${ancho}`)
    const config = configPredeterminada()
    config.instalacion.estado = 'completa'
    mkdirSync(datos, { recursive: true })
    writeFileSync(join(datos, 'config.json'), JSON.stringify(config))
    const env = { ...process.env, SHINOBI_DATOS: datos, SHINOBI_PRUEBA_EXPORTACION: '1' }
    const app = await electron.launch({ args: ['.'], cwd: process.cwd(), env })
    const estilo = estiloPredeterminado()
    estilo.fondo = { tipo: 'solido', color: '#FF0000' }
    const instantanea = instantaneaDePrueba({ estilo })
    try {
      const principal = await app.firstWindow()
      await expect(principal.getByRole('banner')).toBeVisible()
      const resultado = await app.evaluate(
        async (_e, medidas) => {
          const g = globalThis as unknown as {
            __shinobiExportacion: {
              crear(o: unknown): Promise<{
                lista: Promise<void>
                pintar(n: number): Promise<void>
                capturar(): Promise<Buffer>
                destruir(): void
              }>
            }
          }
          const ventana = await g.__shinobiExportacion.crear({
            ...medidas,
            trabajoId: '00000000-0000-4000-8000-000000000001',
            inicial: { instantanea: medidas.instantanea, fps: 30, total: 1 }
          })
          try {
            await ventana.lista
            await ventana.pintar(0)
            const bytes = await ventana.capturar()
            return { longitud: bytes.length, pixel: [...bytes.subarray(0, 4)] }
          } finally {
            ventana.destruir()
          }
        },
        { ancho, alto, instantanea }
      )
      expect(resultado.longitud).toBe(ancho * alto * 4)
      expect(resultado.pixel.join(',')).toBe('0,0,255,255')
    } finally {
      await app.close()
    }
  })
}
