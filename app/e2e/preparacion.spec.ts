import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron, expect, test, type Page } from '@playwright/test'
import { pulsosFlac } from '../src/main/biblioteca/flac'
import { sembrar } from '../src/main/biblioteca/semilla'
import { iniciarServidorLrclib, TITULOS, VOZ_SINTETICA } from './fixtures/lrclib/servidor'
import { crearTemporal } from './temporales'
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

/**
 * Abre el menú ⋯ de una tarjeta. Hacia el primer segundo, la Biblioteca se vuelve a renderizar una vez y
 * cierra un menú recién abierto (solo la primera apertura): se reabre hasta que el ítem se mantiene visible,
 * como hace `temas-biblioteca.spec.ts`. No tapa ninguna aserción sobre el producto.
 */
async function abrirMenuTarjeta(v: Page, titulo: string, item: string): Promise<void> {
  await expect(async () => {
    await v.getByRole('button', { name: `Más acciones de «${titulo}»` }).click()
    await expect(v.getByRole('menuitem', { name: item })).toBeVisible({ timeout: 1500 })
    await v.waitForTimeout(300)
    await expect(v.getByRole('menuitem', { name: item })).toBeVisible({ timeout: 500 })
  }).toPass({ timeout: 15_000 })
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
      await v.getByRole('button', { name: 'Elegir archivos…' }).click()
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

test.describe('letra sin marca `intacta` (pregunta 0278, tarea 0380)', () => {
  test.describe.configure({ timeout: 120_000 })

  test('«Preparar» pide confirmar y, confirmado, solo pone fines donde faltan', async () => {
    const datos = crearTemporal('prep-sin-marca')
    await sembrar(datos)
    // Canción 5 de la semilla: separada y sin letra. Se le da una letra LRC de antes de 0.2.2.
    const id = '5eed0000-0000-4000-8000-000000000005'
    const raiz = join(datos, 'biblioteca', id)
    const ruta = join(raiz, 'cancion.json')
    const c = JSON.parse(readFileSync(ruta, 'utf8'))
    c.metadatos.duracion_ms = 30_000
    c.letra = {
      origen: 'lrclib',
      lrclib_id: 1,
      offset_ms: 0,
      lineas: Array.from({ length: 6 }, (_, i) => ({
        id: `s${i}`,
        tipo: 'linea',
        texto: `Verso inventado ${i + 1}`,
        inicio_ms: 2000 + i * 5000,
        fin_ms: i === 0 ? 4000 : null,
        palabras: null
      }))
    }
    c.pasos.letra = { estado: 'completado', actualizado: '2026-11-22T10:00:00Z', error: null }
    writeFileSync(ruta, JSON.stringify(c, null, 2))
    writeFileSync(join(raiz, 'pistas', 'voz.flac'), pulsosFlac(VOZ_SINTETICA))

    const app = await electron.launch({
      args: ['.'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        SHINOBI_DATOS: datos,
        SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
        SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1'
      }
    })
    try {
      const v = await app.firstWindow()
      type Api = {
        preparacion: {
          previsualizar(ids: string[]): Promise<{ aplica: boolean; confirmar?: string }[]>
          preparar(
            ids: string[],
            o?: { finesSinMarca?: boolean }
          ): Promise<{ aceptadas: string[]; omitidas: { motivo: string }[] }>
        }
      }
      const previa = await v.evaluate(
        (i) => (globalThis as unknown as { shinobi: Api }).shinobi.preparacion.previsualizar([i]),
        id
      )
      expect(previa[0]).toMatchObject({ aplica: true, confirmar: 'finesSinMarca' })
      const sin = await v.evaluate(
        (i) => (globalThis as unknown as { shinobi: Api }).shinobi.preparacion.preparar([i]),
        id
      )
      expect(sin).toMatchObject({ aceptadas: [], omitidas: [{ motivo: 'NADA_QUE_HACER' }] })
      expect(JSON.parse(readFileSync(ruta, 'utf8')).letra.lineas[1].fin_ms).toBeNull()

      const con = await v.evaluate(
        (i) =>
          (globalThis as unknown as { shinobi: Api }).shinobi.preparacion.preparar([i], {
            finesSinMarca: true
          }),
        id
      )
      expect(con.aceptadas).toStrictEqual([id])
      await expect
        .poll(() => JSON.parse(readFileSync(ruta, 'utf8')).preparacion?.estado, { timeout: 90_000 })
        .toBe('lista_para_revisar')
      const { letra } = JSON.parse(readFileSync(ruta, 'utf8'))
      expect(letra.offset_ms).toBe(0)
      letra.lineas.forEach(
        (l: { inicio_ms: number; fin_ms: number | null; origen_fin?: string }, i: number) => {
          expect(l.inicio_ms).toBe(2000 + i * 5000)
          if (i === 0) expect(l.fin_ms).toBe(4000)
          else expect(l.origen_fin).toBe('preparacion')
        }
      )
    } finally {
      await cerrar(app)
    }
  })
  test('«Ajustar los fines…» del menú ⋯ confirma antes y deja los fines sin tocar los inicios (F5-B12)', async () => {
    const datos = crearTemporal('prep-fines-ui')
    await sembrar(datos)
    const id = '5eed0000-0000-4000-8000-000000000005'
    const raiz = join(datos, 'biblioteca', id)
    const ruta = join(raiz, 'cancion.json')
    const c = JSON.parse(readFileSync(ruta, 'utf8'))
    c.metadatos = { ...c.metadatos, titulo: 'Tema de antes', duracion_ms: 30_000 }
    c.letra = {
      origen: 'lrclib',
      lrclib_id: 1,
      offset_ms: 0,
      lineas: Array.from({ length: 6 }, (_, i) => ({
        id: `s${i}`,
        tipo: 'linea',
        texto: `Verso inventado ${i + 1}`,
        inicio_ms: 2000 + i * 5000,
        fin_ms: null,
        palabras: null
      }))
    }
    c.pasos.letra = { estado: 'completado', actualizado: '2026-11-22T10:00:00Z', error: null }
    writeFileSync(ruta, JSON.stringify(c, null, 2))
    writeFileSync(join(raiz, 'pistas', 'voz.flac'), pulsosFlac(VOZ_SINTETICA))
    const app = await electron.launch({
      args: ['.'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        SHINOBI_DATOS: datos,
        SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
        SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1'
      }
    })
    try {
      const v = await app.firstWindow()
      await abrirMenuTarjeta(v, 'Tema de antes', 'Ajustar los fines…')
      expect(await v.getByRole('menuitem', { name: 'Preparar', exact: true }).count()).toBe(0)
      await v.getByRole('menuitem', { name: 'Ajustar los fines…' }).click()
      const dlg = v.getByRole('dialog', { name: '¿Ajustar los fines de «Tema de antes»?' })
      await expect(dlg).toContainText('las 6 líneas que no lo tienen')
      await expect(dlg.getByRole('button', { name: 'Cancelar' })).toBeFocused()
      await dlg.getByRole('button', { name: 'Cancelar' }).click()
      expect(JSON.parse(readFileSync(ruta, 'utf8')).letra.lineas[0].fin_ms).toBeNull()

      await v.getByRole('button', { name: /Más acciones de «Tema de antes»/ }).click()
      await v.getByRole('menuitem', { name: 'Ajustar los fines…' }).click()
      await v.getByRole('dialog').getByRole('button', { name: 'Ajustar los fines' }).click()
      await expect(
        v.getByTestId('toast').filter({ hasText: /Pusimos fin a|No encontramos pausas/ })
      ).toBeVisible({
        timeout: 90_000
      })
      const { letra, estado } = JSON.parse(readFileSync(ruta, 'utf8'))
      expect(estado).toBe('borrador')
      letra.lineas.forEach((l: { inicio_ms: number; origen_fin?: string }, i: number) => {
        expect(l.inicio_ms).toBe(2000 + i * 5000)
        expect(l.origen_fin).toBe('preparacion')
      })
    } finally {
      await cerrar(app)
    }
  })
  test('una Lista recibe fines sin cambiar de estado y «Quitar esos fines» los devuelve (0386, F5-B12)', async () => {
    const datos = crearTemporal('prep-fines-lista')
    await sembrar(datos)
    const id = '5eed0000-0000-4000-8000-000000000005'
    const raiz = join(datos, 'biblioteca', id)
    const ruta = join(raiz, 'cancion.json')
    const c = JSON.parse(readFileSync(ruta, 'utf8'))
    c.estado = 'lista'
    c.metadatos = { ...c.metadatos, titulo: 'Lista de antes', duracion_ms: 30_000 }
    c.letra = {
      origen: 'lrclib',
      lrclib_id: 1,
      offset_ms: 0,
      lineas: Array.from({ length: 6 }, (_, i) => ({
        id: `s${i}`,
        tipo: 'linea',
        texto: `Verso inventado ${i + 1}`,
        inicio_ms: 2000 + i * 5000,
        fin_ms: null,
        palabras: null
      }))
    }
    c.pasos.letra = { estado: 'completado', actualizado: '2026-11-22T10:00:00Z', error: null }
    c.pasos.edicion = { estado: 'completado', actualizado: '2026-11-22T10:00:00Z', error: null }
    writeFileSync(ruta, JSON.stringify(c, null, 2))
    writeFileSync(join(raiz, 'pistas', 'voz.flac'), pulsosFlac(VOZ_SINTETICA))
    const app = await electron.launch({
      args: ['.'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        SHINOBI_DATOS: datos,
        SHINOBI_PAPELERA_PRUEBAS: join(datos, 'papelera'),
        SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1'
      }
    })
    try {
      const v = await app.firstWindow()
      // Sin picos, main omite una Lista (pregunta 0296: no encola nada). Una canción separada con la 0.2.1
      // o posterior ya los tiene; la semilla solo trae `voz.flac`, así que se generan antes, como al separar.
      await expect
        .poll(
          () =>
            v.evaluate(
              async (i) =>
                (
                  await (
                    globalThis as unknown as {
                      shinobi: { picos: { solicitar(i: string): Promise<{ estado: string }> } }
                    }
                  ).shinobi.picos.solicitar(i)
                ).estado,
              id
            ),
          { timeout: 30_000 }
        )
        .toBe('lista')
      await abrirMenuTarjeta(v, 'Lista de antes', 'Ajustar los fines…')
      await v.getByRole('menuitem', { name: 'Ajustar los fines…' }).click()
      await v.getByRole('dialog').getByRole('button', { name: 'Ajustar los fines' }).click()
      await expect(
        v.getByTestId('toast').filter({ hasText: /Pusimos fin a|No encontramos pausas/ })
      ).toBeVisible({ timeout: 60_000 })
      const { letra, estado, preparacion } = JSON.parse(readFileSync(ruta, 'utf8'))
      expect(estado).toBe('lista')
      expect(preparacion).toBeUndefined()
      letra.lineas.forEach((l: { inicio_ms: number; origen_fin?: string }, i: number) => {
        expect(l.inicio_ms).toBe(2000 + i * 5000)
        expect(l.origen_fin).toBe('preparacion')
      })
      // No se ofrece otra vez.
      await v.getByRole('button', { name: /Más acciones de «Lista de antes»/ }).click()
      expect(await v.getByRole('menuitem', { name: 'Ajustar los fines…' }).count()).toBe(0)
    } finally {
      await cerrar(app)
    }
  })
})
