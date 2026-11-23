import { expect, test } from '@playwright/test'
import { iniciarServidorLrclib, TITULOS } from './fixtures/lrclib/servidor'
import { escribirWavConVoz } from './fixtures/lrclib/wavConVoz'
import {
  cerrar,
  idDe,
  irAAnadir,
  lanzar,
  leerCancion,
  preparar,
  volverABiblioteca
} from './fixtures/separacion'

/**
 * Preparación desatendida (feature 5, ADR 0025, tarea 0308): añadir un WAV con el doble de LRCLIB y el
 * separador falso y ver la canción llegar sola a «Lista para revisar». La tarjeta y los avisos son de
 * las tareas 0310 y 0311: aquí se mira el registro `cancion.preparacion` en disco.
 *
 * El separador falso saca la voz de la diferencia de canales (L − R) / 2: el WAV lleva los cantos de
 * `VOZ_SINTETICA` en antifase, y así la voz separada canta donde dice el doble de LRCLIB.
 * La privacidad (interruptor apagado = 0 peticiones) la cubre `importar-archivo.spec.ts`.
 */

test.describe('preparación desatendida', () => {
  test.describe.configure({ timeout: 120_000 })

  test('añadir un WAV con el doble de LRCLIB y el separador falso llega sola a «Lista para revisar»', async () => {
    const e = preparar('prep-lista', { segundos: 3, pasos: 6 })
    escribirWavConVoz(e.wav)
    const lrclib = await iniciarServidorLrclib()
    const app = await lanzar(e, { SHINOBI_LRCLIB_URL: lrclib.url })
    try {
      const v = await app.firstWindow()
      // Anota todos los toasts que salgan (D7: «ya se puede marcar como lista» no se suma al de la preparación).
      await v.evaluate(() => {
        const w = window as unknown as { __toasts: string[] }
        w.__toasts = []
        new MutationObserver(() => {
          for (const n of document.querySelectorAll('[data-testid="toast"]')) {
            const t = n.textContent ?? ''
            if (t && !w.__toasts.includes(t)) w.__toasts.push(t)
          }
        }).observe(document.body, { childList: true, subtree: true, characterData: true })
      })
      await irAAnadir(v)
      await v.getByRole('button', { name: 'Elegir archivo…' }).click()
      await expect(v.getByLabel('Título')).toBeVisible({ timeout: 30_000 })
      await v.getByLabel('Título').fill(TITULOS.conVoz)
      await v.getByLabel('Artista').fill('Artista inventado')
      await v.getByRole('button', { name: 'Continuar' }).click()
      await volverABiblioteca(v)

      const id = idDe(e.datos, TITULOS.conVoz)
      await expect
        .poll(() => leerCancion(e.datos, id).preparacion?.estado, { timeout: 90_000 })
        .toBe('lista_para_revisar')

      await expect(
        v.getByTestId('toast').filter({ hasText: 'está lista para revisar' })
      ).toBeVisible()
      const toasts = await v.evaluate(() => (window as unknown as { __toasts: string[] }).__toasts)
      expect(toasts.filter((t) => t.includes('ya se puede marcar como lista'))).toHaveLength(0)
      expect(toasts.filter((t) => t.includes('está lista para revisar'))).toHaveLength(1)

      const c = leerCancion(e.datos, id)
      // Nunca se marca Lista sola; la letra es de LRCLIB y la eligió la app.
      expect(c.estado).toBe('borrador')
      expect(c.letra).toMatchObject({ origen: 'lrclib' })
      expect(c.letra.lineas.filter((l: { tipo: string }) => l.tipo === 'linea')).toHaveLength(6)
      expect(c.preparacion).toMatchObject({
        origen: 'automatica',
        paso: null,
        eleccion: { por: 'app' },
        fines: { metodo: 'silencios' },
        revisada: false
      })
      expect(c.preparacion.busqueda).toMatchObject({ resultado: 'elegida', candidatas: 3 })
      expect(c.preparacion.busqueda.ids).toHaveLength(3)
      // Los registros guardados no llevan texto de las letras no elegidas.
      expect(JSON.stringify(c.preparacion)).not.toContain('Verso inventado')
      // El álbum estaba vacío: se rellena desde LRCLIB con su origen.
      expect(c.metadatos).toMatchObject({ album: 'Álbum inventado', origen: { album: 'lrclib' } })
      expect(c.letra.datos_lrclib).toMatchObject({ album: 'Álbum inventado' })
      // Una sola petición a la vez y sin cookies (ADR 0005).
      expect(lrclib.maxSimultaneas).toBe(1)
      expect(lrclib.peticiones.every((p) => p.cookie === undefined)).toBe(true)
    } finally {
      await cerrar(app)
      await lrclib.cerrar()
    }
  })
})
