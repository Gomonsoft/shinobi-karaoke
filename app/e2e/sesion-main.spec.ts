import { _electron as electron, expect, test, type Page } from '@playwright/test'
import { join } from 'node:path'
import { sembrar } from '../src/main/biblioteca/semilla'
import type { EstadoSesionIpc } from '../src/shared/sesion'
import { crearTemporal } from './temporales'

/** E2E mínimo de la integración de la sesión en main (0181); los escenarios completos son de 0190. */

const idSemilla = (n: number): string => `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`

const PANTALLAS = JSON.stringify([
  { id: 1, label: 'Principal', bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
  { id: 2, label: 'Escenario', bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
])

type Ventana = {
  shinobi: {
    alCambiarSesion(cb: (e: EstadoSesionIpc) => void): () => void
    sesion: { abrir(p: unknown): Promise<EstadoSesionIpc>; estado(): Promise<EstadoSesionIpc> }
    cola: { agregar(cancionId: string, donde: string): Promise<unknown> }
  }
  shinobiReproductor: {
    sesion: { informar(i: unknown): Promise<{ aplicado: boolean }> }
  }
  __estados: EstadoSesionIpc[]
}

test.describe('sesión en main', () => {
  test.describe.configure({ timeout: 90_000 })

  test('abre la ventana secundaria, la carga y un `fin` repetido cuenta una sola vez', async () => {
    const datos = crearTemporal('sesion-main')
    await sembrar(datos)
    const app = await electron.launch({
      args: ['.'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        SHINOBI_DATOS: datos,
        SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
        SHINOBI_SILENCIAR_AUDIO: '1',
        SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1',
        SHINOBI_PANTALLAS_SIMULADAS: PANTALLAS,
        SHINOBI_PANTALLA_COMPLETA_SIMULADA: '1'
      }
    })
    try {
      const principal: Page = await app.firstWindow()
      await expect(principal.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
      await principal.evaluate(() => {
        const w = window as unknown as Ventana
        w.__estados = []
        w.shinobi.alCambiarSesion((e) => w.__estados.push(e))
      })

      // La segunda canción espera en la cola; la primera se abre «ahora».
      const nueva = app.waitForEvent('window')
      await principal.evaluate(
        async ([primera, segunda]) => {
          const w = window as unknown as Ventana
          await w.shinobi.sesion.abrir({
            pantallaId: 2,
            pantallaCompleta: false,
            inicio: { tipo: 'cancion', cancionId: primera, donde: 'ahora' }
          })
          await w.shinobi.cola.agregar(segunda, 'final')
        },
        [idSemilla(20), idSemilla(21)] as const
      )
      const secundaria = await nueva
      await secundaria.waitForLoadState('domcontentloaded')
      expect(secundaria.url()).toMatch(/\/reproductor\.html$/)

      // El documento pide `sesion.inicial`, main revalida, envía `cargar` y la secundaria reproduce.
      const estado = () =>
        principal.evaluate(() => (window as unknown as Ventana).shinobi.sesion.estado())
      await expect
        .poll(async () => (await estado()).sesion?.fase, { timeout: 30_000 })
        .toBe('reproduciendo')
      const { sesion, activa } = await estado()
      expect(activa?.cancionId).toBe(idSemilla(20))

      // El mismo `fin` informado dos veces desde la secundaria: solo el primero se aplica.
      const informes = await secundaria.evaluate(
        async ([sesionId, entradaId]) => {
          const api = (window as unknown as Ventana).shinobiReproductor.sesion
          const fin = { tipo: 'fin', sesionId, entradaId }
          return [await api.informar(fin), await api.informar(fin)]
        },
        [sesion!.sesionId, activa!.entradaId] as const
      )
      expect(informes).toEqual([{ aplicado: true }, { aplicado: false }])

      // Una sola cuenta hacia la segunda canción, comprobada en `sesion:estado`.
      await expect.poll(async () => (await estado()).sesion?.fase).toBe('transicion')
      const cuentas = await principal.evaluate(() => {
        const ids = (window as unknown as Ventana).__estados
          .map((e) => e.sesion?.transicion?.transicionId)
          .filter((id): id is string => Boolean(id))
        return [...new Set(ids)]
      })
      expect(cuentas).toHaveLength(1)
      expect((await estado()).pendientes.map((p) => p.cancionId)).toEqual([idSemilla(21)])
    } finally {
      await app.close()
    }
  })
})
