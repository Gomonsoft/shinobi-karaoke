import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { configPredeterminada } from '../src/shared/config'
import { estiloPredeterminado } from '../src/shared/estilo'
import type { ApiShinobi } from '../src/shared/ipc'
import { instantaneaDePrueba } from '../src/shared/__fixtures__/exportacion'
import { crearTemporal } from './temporales'

/**
 * Captura real de la ventana offscreen (0234, ADR 0019 §2): tamaño exacto a escala 1 y BGRA.
 * La instantánea lleva un fondo rojo puro: los bytes del primer píxel deben ser `00 00 FF FF`.
 */
/**
 * En Linux con Xvfb y GPU por software (CI), Chromium recorta la superficie offscreen de 4K en 1 px
 * (3839×2159) y la app, con razón, la rechaza con PERFIL_NO_SOPORTADO. Es un límite del entorno, no
 * de la lógica, y desde la 0260 ya no se omite: el sondeo de captura marca esos perfiles con
 * `captura` antes de que nadie los elija, y es eso lo que se comprueba. Linux real con GPU queda en
 * la guía manual (docs/Test-manuales/). En macOS y Windows la captura exacta sigue siendo obligatoria.
 */
/** Líneas de exportación de `app.log`, para diagnosticar el sondeo cuando la prueba falla. */
function registroDe(datos: string): string {
  try {
    return readFileSync(join(datos, 'registros', 'app.log'), 'utf8')
      .split(/\r?\n/)
      .filter((l) => /exportaci/i.test(l))
      .join(' | ')
  } catch {
    return '(sin app.log)'
  }
}

async function comprobarMarcadoPorCaptura(
  e: unknown,
  datos: string,
  principal: Page,
  ancho: number,
  alto: number
): Promise<void> {
  const m = e instanceof Error ? /captura es de (\d+)×(\d+)/.exec(e.message) : null
  if (process.platform !== 'linux' || !m) throw e
  const [w, h] = [Number(m[1]), Number(m[2])]
  if (!(ancho >= 3840 && w <= ancho && h <= alto && ancho - w <= 2 && alto - h <= 2)) throw e
  const marcados = await principal.evaluate(async () => {
    const api = (globalThis as unknown as { shinobi: ApiShinobi }).shinobi.exportacion
    const { perfiles } = await api.perfiles()
    return perfiles
      .filter((p) => p.ancho === 3840 && p.alto === 2160 && p.fps === 30)
      .map((p) => `${p.formato} ${p.ancho}x${p.alto} ${p.soportado} ${p.motivo}`)
  })
  // Solo el tamaño que la ventana no llega a tomar. 2880×2160 sí se captura en Xvfb: el recorte
  // es de la pantalla virtual de 3840 de ancho, no de la altura.
  expect(marcados, `Registro de la app: ${registroDe(datos)}`).toEqual([
    'mkv_av1 3840x2160 false captura',
    'webm_vp9 3840x2160 false captura'
  ])
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
        // Sin superficie exacta (Linux sin GPU): vale que el sondeo marque los perfiles 4K.
        await comprobarMarcadoPorCaptura(e, datos, principal, ancho, alto)
        return
      }
      expect(resultado.longitud).toBe(ancho * alto * 4)
      expect(resultado.pixel.join(',')).toBe('0,0,255,255')
    } finally {
      await app.close()
    }
  })
}
