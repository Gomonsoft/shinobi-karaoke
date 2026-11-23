import { writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { iniciarServidorLrclib, TITULOS, VOZ_SINTETICA } from './fixtures/lrclib/servidor'
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

/** WAV PCM 16 bit estéreo, con un tono de 440 Hz en los cantos de la voz sintética (L = −R). */
function escribirWavConVoz(ruta: string, tasa = 22050): void {
  const { segundos, periodoMs, duracionPulsoMs, desfaseMs } = VOZ_SINTETICA
  const n = segundos * tasa
  const b = Buffer.alloc(44 + n * 4)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 4, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(2, 22)
  b.writeUInt32LE(tasa, 24)
  b.writeUInt32LE(tasa * 4, 28)
  b.writeUInt16LE(4, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    const ms = (i / tasa) * 1000
    const canta = ms >= desfaseMs && (ms - desfaseMs) % periodoMs < duracionPulsoMs
    const v = canta ? Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / tasa)) : 0
    b.writeInt16LE(v, 44 + i * 4)
    b.writeInt16LE(-v, 46 + i * 4)
  }
  writeFileSync(ruta, b)
}

test.describe('preparación desatendida', () => {
  test.describe.configure({ timeout: 120_000 })

  test('añadir un WAV con el doble de LRCLIB y el separador falso llega sola a «Lista para revisar»', async () => {
    const e = preparar('prep-lista', { segundos: 3, pasos: 6 })
    escribirWavConVoz(e.wav)
    const lrclib = await iniciarServidorLrclib()
    const app = await lanzar(e, { SHINOBI_LRCLIB_URL: lrclib.url })
    try {
      const v = await app.firstWindow()
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
