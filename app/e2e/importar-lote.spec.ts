import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { iniciarServidorLrclib } from './fixtures/lrclib/servidor'
import { crearTemporal } from './temporales'

/**
 * Importación por lotes (feature 7, 0314) con la app compilada, el worker real de desarrollo y el doble de
 * yt-dlp, sin red. Hasta que exista la interfaz del modo lote (0315) la prueba usa la API del preload
 * (`window.shinobi.fuente.*`) y comprueba el resultado en la Biblioteca y en `cancion.json`:
 *   3 WAV inventados en una carpeta + una lista falsa de 2 vídeos (y uno privado) = 5 canciones en cola.
 * La búsqueda automática de letra va apagada: el lote no debe hacer ninguna petición a LRCLIB.
 */

const FIXTURES = join(process.cwd(), 'e2e', 'fixtures', 'youtube')
const LISTA = 'OLAK5uy_e2eLote001'

/** WAV PCM 16 bit mono con un tono de 440 Hz. */
function escribirWav(ruta: string, segundos = 12, tasa = 8000): void {
  const n = segundos * tasa
  const b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 2, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(tasa, 24)
  b.writeUInt32LE(tasa * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / tasa)), 44 + i * 2)
  }
  writeFileSync(ruta, b)
}

interface CancionJson {
  metadatos: { titulo: string; album: string | null }
  fuente: { tipo: string; ruta_pendiente?: string }
  pasos: { fuente: { estado: string } }
}
const leerCancion = (datos: string, id: string): CancionJson =>
  JSON.parse(readFileSync(join(datos, 'biblioteca', id, 'cancion.json'), 'utf8'))
const ids = (datos: string): string[] =>
  existsSync(join(datos, 'biblioteca'))
    ? readdirSync(join(datos, 'biblioteca')).filter(
        (x) => x !== '.importando' && !x.startsWith('temas.json')
      )
    : []

/** Lo mínimo de la API del preload que usa esta prueba. */
interface ApiLote {
  fuente: {
    leerCarpeta(ruta: string): Promise<{ filas: { ref: string; metadatos: object }[] } | null>
    infoLista(url: string): Promise<{ entradas: { id: string; disponible: boolean }[] }>
    lote(l: {
      entradas: ({ tipo: 'archivo'; ref: string } | { tipo: 'youtube'; id: string })[]
      metadatos: { titulo: string; artista: string; album: string | null }[]
    }): Promise<{ creadas: { id: string }[]; omitidas: unknown[] }>
  }
}

async function cerrar(app: ElectronApplication): Promise<void> {
  const ventana = app.windows()[0]
  const cierre = app.close()
  await ventana
    ?.getByRole('dialog')
    .getByRole('button', { name: 'Cerrar de todos modos' })
    .click({ timeout: 3000 })
    .catch(() => undefined)
  await cierre
}

test.describe('importación por lotes', () => {
  test('3 WAV de una carpeta y una lista falsa de 2 vídeos: 5 tarjetas y las 5 fuentes completadas', async () => {
    const datos = crearTemporal('lote')
    const falsos = join(datos, '..', `falsos-lote-${Date.now()}`)
    const carpeta = join(datos, '..', `entrada-lote-${Date.now()}`, 'Disco de prueba')
    mkdirSync(falsos, { recursive: true })
    mkdirSync(carpeta, { recursive: true })
    cpSync(FIXTURES, falsos, { recursive: true })
    for (const n of ['01 Tema Uno', '02 Tema Dos', '03 Tema Tres'])
      escribirWav(join(carpeta, `${n}.wav`))
    const ahora = new Date().toISOString()
    writeFileSync(
      join(datos, 'config.json'),
      JSON.stringify({
        esquema: 1,
        instalacion: {
          estado: 'completa',
          fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' },
          perfil_hardware: 'cpu'
        },
        separacion: { modelos_descargados: ['calidad'] },
        aviso_youtube_aceptado: ahora,
        aviso_youtube_listas_aceptado: ahora,
        // Privacidad: sin búsqueda automática, un lote no sale a la red.
        preparacion: { automatica: false }
      })
    )

    // El doble cuenta todas las peticiones (también un HEAD de comprobación de conexión).
    const lrclib = await iniciarServidorLrclib()
    const app = await electron.launch({
      args: ['.'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        SHINOBI_DATOS: datos,
        SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
        SHINOBI_YTDLP_FALSO: falsos,
        SHINOBI_LRCLIB_URL: lrclib.url
      }
    })
    try {
      const v: Page = await app.firstWindow()
      await expect(v.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeVisible({
        timeout: 30_000
      })
      const resultado = await v.evaluate(
        async ({ carpeta: dir, lista }) => {
          const api = (window as unknown as { shinobi: ApiLote }).shinobi
          const archivos = await api.fuente.leerCarpeta(dir)
          const entradas = await api.fuente.infoLista(lista)
          const videos = entradas.entradas.filter((e) => e.disponible)
          return await api.fuente.lote({
            entradas: [
              ...(archivos?.filas ?? []).map((f) => ({ tipo: 'archivo' as const, ref: f.ref })),
              ...videos.map((e) => ({ tipo: 'youtube' as const, id: e.id }))
            ],
            metadatos: [
              ...(archivos?.filas ?? []).map((f) => ({
                ...(f.metadatos as { titulo: string; artista: string; album: string | null }),
                artista: 'Grupo de prueba'
              })),
              ...videos.map((_, i) => ({
                titulo: `Vídeo ${i + 1}`,
                artista: 'Grupo de prueba',
                album: 'Disco de prueba'
              }))
            ]
          })
        },
        { carpeta, lista: `https://music.youtube.com/playlist?list=${LISTA}` }
      )
      expect(resultado.creadas).toHaveLength(5)
      expect(resultado.omitidas).toEqual([])

      // Las 5 tarjetas aparecen al momento, en el orden de la tabla.
      for (const titulo of ['Tema Uno', 'Tema Dos', 'Tema Tres', 'Vídeo 1', 'Vídeo 2']) {
        await expect(v.getByText(titulo, { exact: true }).first()).toBeVisible({ timeout: 30_000 })
      }
      expect(ids(datos)).toHaveLength(5)

      // La fuente de las 5 termina sola (cola `ligera`, de una en una).
      await expect
        .poll(
          () =>
            ids(datos).filter((id) => leerCancion(datos, id).pasos.fuente.estado === 'completado')
              .length,
          {
            timeout: 90_000
          }
        )
        .toBe(5)
      for (const id of ids(datos)) {
        const c = leerCancion(datos, id)
        expect(c.fuente.ruta_pendiente).toBeUndefined()
        expect(existsSync(join(datos, 'biblioteca', id, 'fuente', 'mezcla.flac'))).toBe(true)
      }
      expect(
        ids(datos)
          .map((id) => leerCancion(datos, id).fuente.tipo)
          .sort()
      ).toEqual(['archivo', 'archivo', 'archivo', 'youtube', 'youtube'])
      // Privacidad: con la búsqueda automática apagada, el lote no hace ninguna petición a LRCLIB.
      await v.waitForTimeout(3000)
      expect(lrclib.peticiones).toHaveLength(0)
    } finally {
      await cerrar(app)
      await lrclib.cerrar()
    }
  })
})
