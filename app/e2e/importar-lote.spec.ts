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
 * Importación por lotes (feature 7, 0314 y 0315) con la app compilada, el worker real de desarrollo y el doble de
 * yt-dlp, sin red, **con la interfaz real**: «Elegir carpeta…» con 3 WAV inventados y, después, el enlace de una
 * lista falsa de 2 vídeos (y uno privado) en la tabla de revisión = 5 canciones en cola, con la cabecera de la
 * cola de preparación en el panel de actividad. Se comprueba en la Biblioteca y en `cancion.json`.
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

/** Volcado para el CI: solo se imprime si la prueba falla (estado de cada canción, trabajos y registro de la app). */
async function volcarDiagnostico(v: Page, datos: string): Promise<void> {
  const lineas: string[] = ['--- diagnóstico de importar-lote ---']
  for (const id of ids(datos)) {
    try {
      const c = JSON.parse(readFileSync(join(datos, 'biblioteca', id, 'cancion.json'), 'utf8')) as {
        metadatos: { titulo: string }
        fuente: unknown
        pasos: Record<string, unknown>
      }
      lineas.push(
        `canción ${id} «${c.metadatos.titulo}»: fuente=${JSON.stringify(c.fuente)} pasos=${JSON.stringify(c.pasos)}`
      )
    } catch (e) {
      lineas.push(`canción ${id}: ilegible (${String(e)})`)
    }
  }
  try {
    const trabajos = await v.evaluate(() =>
      (
        globalThis as unknown as { shinobi: { trabajos: { listar(): Promise<unknown[]> } } }
      ).shinobi.trabajos.listar()
    )
    lineas.push(`trabajos del gestor: ${JSON.stringify(trabajos)}`)
  } catch (e) {
    lineas.push(`trabajos del gestor: no se pudieron leer (${String(e)})`)
  }
  for (const nombre of ['registros/app.log', 'registros/worker.log']) {
    const ruta = join(datos, nombre)
    lineas.push(
      existsSync(ruta)
        ? `${nombre} (últimas líneas):\n${readFileSync(ruta, 'utf8').split('\n').slice(-40).join('\n')}`
        : `${nombre}: no existe`
    )
  }
  if (existsSync(join(datos, 'registros'))) {
    lineas.push(`registros/: ${readdirSync(join(datos, 'registros')).join(', ')}`)
  }
  console.log(lineas.join('\n'))
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
    test.setTimeout(150_000)
    const datos = crearTemporal('lote')
    const falsos = join(datos, '..', `falsos-lote-${Date.now()}`)
    const carpeta = join(datos, '..', `entrada-lote-${Date.now()}`, 'Disco de prueba')
    mkdirSync(falsos, { recursive: true })
    mkdirSync(carpeta, { recursive: true })
    cpSync(FIXTURES, falsos, { recursive: true })
    // Separador falso (como en `separacion.spec.ts`): sin él, la separación encadenada falla con
    // `RUNTIME_NO_DISPONIBLE` (no hay PyTorch en el CI) y, por diseño, esa parada total retiene las descargas
    // que aún esperan su turno; que llegue antes o después de ellas dependía de la velocidad del equipo.
    const escenarioSeparador = join(datos, '..', `separador-lote-${Date.now()}.json`)
    writeFileSync(escenarioSeparador, JSON.stringify({ segundos: 1, pasos: 2 }))
    // Contador del doble: cada `info-youtube` apunta el id (la descarga no cuenta: reutiliza su `info`).
    writeFileSync(join(falsos, 'llamadas-info.log'), '')
    // Al descargar, los dos vídeos traen campos de YouTube Music (en la copia, no en la fixture compartida).
    for (const [id, pista] of [
      ['Normal_0001', 'Tema de música uno'],
      ['Normal_0002', 'Tema de música dos']
    ] as const) {
      const ruta = join(falsos, `${id}.json`)
      const info = JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, unknown>
      Object.assign(info, { track: pista, artists: ['Grupo Inventado'], album: 'Disco de música' })
      writeFileSync(ruta, JSON.stringify(info))
    }
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
        SHINOBI_SEPARADOR_FALSO: escenarioSeparador,
        SHINOBI_DIALOGO_PRUEBAS: carpeta,
        SHINOBI_LRCLIB_URL: lrclib.url
      }
    })
    try {
      const v: Page = await app.firstWindow()
      await expect(v.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeVisible({
        timeout: 30_000
      })
      // 0. La lectura del lote no entrega ninguna ruta al renderer (ADR 0008, tarea 0390): solo `ref`.
      const lectura = await v.evaluate(() =>
        (
          globalThis as unknown as {
            shinobi: { fuente: { leerCarpeta(): Promise<{ filas: unknown[] } | null> } }
          }
        ).shinobi.fuente.leerCarpeta()
      )
      expect(lectura?.filas).toHaveLength(3)
      for (const fila of lectura!.filas as Record<string, unknown>[]) {
        expect(Object.keys(fila)).not.toContain('ruta')
      }
      expect(JSON.stringify(lectura)).not.toContain(carpeta)

      // 1. Carpeta: «Elegir carpeta…» (el diálogo nativo lo sustituye SHINOBI_DIALOGO_PRUEBAS).
      await v.getByRole('button', { name: 'Añadir canción' }).first().click()
      await v.getByRole('button', { name: 'Elegir carpeta…' }).click()
      await expect(v.getByRole('heading', { level: 1, name: 'Añadir 3 canciones' })).toBeVisible({
        timeout: 30_000
      })
      await expect(v.getByText('De la carpeta «Disco de prueba» · 3 archivos')).toBeVisible()
      await expect(v.getByRole('checkbox', { name: /^Añadir «/ })).toHaveCount(3)
      await v.getByRole('button', { name: 'Añadir 3 canciones' }).click()
      await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible({
        timeout: 30_000
      })
      await expect(
        v.getByText(
          'Se añadieron 3 canciones. Se están separando; la letra tendrás que buscarla tú.'
        )
      ).toBeVisible()

      // 2. Lista de YouTube: aviso ya aceptado, tabla con 2 videos y uno privado sin casilla.
      await v.getByRole('button', { name: 'Añadir canción' }).first().click()
      await v.getByRole('radio', { name: 'Enlaces de YouTube' }).click()
      await v
        .getByLabel('Enlaces de YouTube')
        .fill(`https://music.youtube.com/playlist?list=${LISTA}`)
      await v.getByRole('button', { name: 'Buscar' }).click()
      await expect(v.getByRole('heading', { level: 1, name: 'Añadir 2 canciones' })).toBeVisible({
        timeout: 30_000
      })
      await expect(v.getByText('De la lista «Disco de prueba» · 3 videos')).toBeVisible()
      await expect(v.getByText('No disponible: no se puede añadir')).toBeVisible()
      // La tabla se rellena solo con la lista: ni una consulta a YouTube por vídeo.
      await expect(v.getByText(/Completando los datos/)).toHaveCount(0)
      expect(readFileSync(join(falsos, 'llamadas-info.log'), 'utf8')).toBe('')
      // El usuario cambia el título del segundo vídeo en la tabla: la descarga no lo toca.
      await v
        .locator('tr[data-clave="yt:Normal_0002"]')
        .getByRole('textbox')
        .first()
        .fill('Título que escribí yo')
      await v.getByRole('button', { name: 'Descargar y añadir 2 canciones' }).click()
      await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible({
        timeout: 60_000
      })

      // Las 5 tarjetas aparecen al momento, en el orden de la tabla.
      for (const titulo of ['Tema Uno', 'Tema Dos', 'Tema Tres']) {
        await expect(v.getByText(titulo, { exact: true }).first()).toBeVisible({ timeout: 30_000 })
      }
      await expect.poll(() => ids(datos).length, { timeout: 30_000 }).toBe(5)
      // La cola de preparación de la tanda: botón en la barra superior y cabecera en el panel de actividad.
      const actividad = v.locator('[data-actividad]')
      if (await actividad.isVisible()) {
        await actividad.click()
        await expect(
          v.getByRole('heading', { name: /^Cola de preparación · \d de 5 terminadas$/ })
        ).toBeVisible()
        await v.keyboard.press('Escape')
      }

      try {
        // La fuente de las 5 termina sola (cola `ligera`, de una en una).
        await expect
          .poll(
            () =>
              ids(datos).filter((id) => leerCancion(datos, id).pasos.fuente.estado === 'completado')
                .length,
            {
              timeout: 120_000
            }
          )
          .toBe(5)
      } catch (e) {
        await volcarDiagnostico(v, datos)
        throw e
      }
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
      // Datos de YouTube Music al descargar: cambia el título que salía de la lista, no el editado en la tabla.
      const yt = ids(datos).filter((id) => leerCancion(datos, id).fuente.tipo === 'youtube')
      const titulos = yt.map((id) => leerCancion(datos, id).metadatos.titulo).sort()
      expect(titulos).toEqual(['Tema de música uno', 'Título que escribí yo'])
      expect(readFileSync(join(falsos, 'llamadas-info.log'), 'utf8')).toBe('')
      // Privacidad: con la búsqueda automática apagada, el lote no hace ninguna petición a LRCLIB.
      await v.waitForTimeout(3000)
      expect(lrclib.peticiones).toHaveLength(0)
    } finally {
      await cerrar(app)
      await lrclib.cerrar()
    }
  })

  /**
   * El escenario del CI de 80dfa1f (tarea 0390): el motor de separación no está disponible
   * (`RUNTIME_NO_DISPONIBLE`) y las descargas del lote siguen y terminan; las canciones quedan esperando su
   * separación. `conSeparadorFalso` fuerza el fallo del separador; sin él, es el motor real del equipo (en el CI
   * no hay PyTorch: el mismo error; en un equipo con motor, la separación puede avanzar y solo se exige que las
   * descargas terminen y que la cola no quede parada por completo).
   */
  for (const conSeparadorFalso of [true, false]) {
    test(`sin motor de separación las descargas del lote terminan (${conSeparadorFalso ? 'separador falso que falla' : 'sin separador falso'})`, async () => {
      test.setTimeout(150_000)
      const datos = crearTemporal('lote-sin-motor')
      const falsos = join(datos, '..', `falsos-lote-sm-${Date.now()}`)
      mkdirSync(falsos, { recursive: true })
      cpSync(FIXTURES, falsos, { recursive: true })
      const escenario = join(datos, '..', `separador-sm-${Date.now()}.json`)
      writeFileSync(
        escenario,
        JSON.stringify({
          segundos: 0,
          pasos: 1,
          fallos: [{ cuando: {}, codigo: 'RUNTIME_NO_DISPONIBLE', reintentable: false }]
        })
      )
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
          preparacion: { automatica: false }
        })
      )
      const lrclib = await iniciarServidorLrclib()
      const app = await electron.launch({
        args: ['.'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          SHINOBI_DATOS: datos,
          SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
          SHINOBI_YTDLP_FALSO: falsos,
          ...(conSeparadorFalso ? { SHINOBI_SEPARADOR_FALSO: escenario } : {}),
          SHINOBI_LRCLIB_URL: lrclib.url
        }
      })
      try {
        const v: Page = await app.firstWindow()
        await expect(v.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeVisible({
          timeout: 30_000
        })
        await v.getByRole('button', { name: 'Añadir canción' }).first().click()
        await v.getByRole('radio', { name: 'Enlaces de YouTube' }).click()
        await v
          .getByLabel('Enlaces de YouTube')
          .fill(`https://music.youtube.com/playlist?list=${LISTA}`)
        await v.getByRole('button', { name: 'Buscar' }).click()
        await expect(v.getByRole('heading', { level: 1, name: 'Añadir 2 canciones' })).toBeVisible({
          timeout: 30_000
        })
        await v.getByRole('button', { name: 'Descargar y añadir 2 canciones' }).click()
        await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible({
          timeout: 60_000
        })
        try {
          // Las dos descargas terminan aunque la separación de la primera ya haya fallado sin motor.
          await expect
            .poll(
              () =>
                ids(datos).filter(
                  (id) => leerCancion(datos, id).pasos.fuente.estado === 'completado'
                ).length,
              { timeout: 120_000 }
            )
            .toBe(2)
        } catch (e) {
          await volcarDiagnostico(v, datos)
          throw e
        }
        const leerTanda = () =>
          v.evaluate(() =>
            (
              globalThis as unknown as {
                shinobi: {
                  preparacion: {
                    tanda(): Promise<{
                      motivoPausa: string | null
                      separacionesParadas: string | null
                    } | null>
                  }
                }
              }
            ).shinobi.preparacion.tanda()
          )
        // Con el separador falso, el fallo llega cuando termina su (simulada) preparación del modelo.
        if (conSeparadorFalso) {
          await expect
            .poll(async () => (await leerTanda())?.separacionesParadas, { timeout: 90_000 })
            .toBe('RUNTIME_NO_DISPONIBLE')
        }
        const tanda = await leerTanda()
        // Nunca una parada total por el motor: a lo sumo, solo las separaciones.
        expect(tanda?.motivoPausa ?? null).toBeNull()
        if (tanda?.separacionesParadas === 'RUNTIME_NO_DISPONIBLE') {
          // Las canciones esperan su separación: ninguna la tiene hecha.
          for (const id of ids(datos)) {
            const c = leerCancion(datos, id) as unknown as {
              pasos: { separacion: { estado: string } }
            }
            expect(c.pasos.separacion.estado).not.toBe('completado')
          }
        }
      } finally {
        await cerrar(app)
        await lrclib.cerrar()
      }
    })
  }
})
