import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { configPredeterminada } from '../src/shared/config'
import { estiloPredeterminado } from '../src/shared/estilo'
import { instantaneaDePrueba } from '../src/shared/__fixtures__/exportacion'
import { crearTemporal } from './temporales'

/**
 * Captura real de la ventana offscreen (0234, ADR 0019 §2): tamaño exacto a escala 1 y BGRA.
 * La instantánea lleva un fondo rojo puro: los bytes del primer píxel deben ser `00 00 FF FF`.
 */
/**
 * En Linux con Xvfb y GPU por software (CI), Chromium recorta la superficie offscreen de 4K en 1 px
 * (3839×2159) y la app, con razón, la rechaza con PERFIL_NO_SOPORTADO. Es un límite del entorno,
 * no de la lógica: solo se omite ahí y solo con ese error. Queda cubierto por la guía manual de la
 * fase 6 (Linux real con GPU, docs/Test-manuales/). En macOS y Windows sigue siendo obligatoria.
 */
function omitirSiEntornoSinSuperficie(e: unknown, ancho: number, alto: number): void {
  const m = e instanceof Error ? /captura es de (\d+)×(\d+)/.exec(e.message) : null
  if (process.platform !== 'linux' || !m) return
  const [w, h] = [Number(m[1]), Number(m[2])]
  const mayor = ancho >= 3840
  test.skip(
    mayor && w <= ancho && h <= alto && ancho - w <= 2 && alto - h <= 2,
    `El entorno Linux sin GPU no crea la superficie offscreen de ${ancho}×${alto} (da ${w}×${h}). Verificar en Linux real con GPU.`
  )
}

/**
 * 0246: el defecto de 0244 (la ventana offscreen heredaba el área de trabajo del monitor) solo
 * aparece si la captura es mayor que esa área. En Windows el runner tiene una pantalla pequeña, así
 * que 3840×2160 la cubre; la prueba falla (no se omite) si algún día deja de ser mayor. En Linux, la
 * pantalla virtual de Xvfb ya mide 3840×2160 y esta comprobación no aplica.
 */
async function exigirMayorQueElAreaDeTrabajo(
  app: ElectronApplication,
  ancho: number,
  alto: number
): Promise<void> {
  if (process.platform === 'linux') return
  const area = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().workAreaSize)
  expect(
    ancho > area.width || alto > area.height,
    `El caso ${ancho}×${alto} ya no es mayor que el área de trabajo (${area.width}×${area.height}): ya no cubre el recorte de la ventana offscreen (0244). Usa un caso mayor.`
  ).toBe(true)
}

for (const [ancho, alto] of [
  [640, 480],
  [1920, 1080],
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
      if (ancho === 3840) await exigirMayorQueElAreaDeTrabajo(app, ancho, alto)
      let resultado: { longitud: number; pixel: number[] }
      try {
        resultado = await app.evaluate(
          async (_e, medidas) => {
            const g = globalThis as unknown as {
              __shinobiExportacion: {
                crear(o: unknown): Promise<{
                  lista: Promise<void>
                  pintar(n: number): Promise<void>
                  capturar(): Promise<{ imagen: Buffer; asentada: boolean; intentos: number }>
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
              const { imagen: bytes } = await ventana.capturar()
              return { longitud: bytes.length, pixel: [...bytes.subarray(0, 4)] }
            } finally {
              ventana.destruir()
            }
          },
          { ancho, alto, instantanea }
        )
      } catch (e) {
        omitirSiEntornoSinSuperficie(e, ancho, alto)
        throw e
      }
      expect(resultado.longitud).toBe(ancho * alto * 4)
      expect(resultado.pixel.join(',')).toBe('0,0,255,255')
    } finally {
      await app.close()
    }
  })
}
