import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import type { ApiShinobi } from '../src/shared/ipc'
import { sembrar } from '../src/main/biblioteca/semilla'
import { crearTemporal } from './temporales'

/**
 * Feature 9 (0326): exportar con audio una canción de la semilla e importarla con «Conservar las dos».
 * Nada toca la carpeta de datos ni Documentos reales: `SHINOBI_DATOS`, `SHINOBI_DOCUMENTOS` y
 * `SHINOBI_DIALOGO_PRUEBAS` (el paquete que «elige» el selector de «Restaurar o importar…») son temporales.
 */
async function lanzar(
  datos: string,
  documentos: string,
  paquete: string
): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHINOBI_DATOS: datos,
      SHINOBI_DOCUMENTOS: documentos,
      SHINOBI_DIALOGO_PRUEBAS: paquete,
      SHINOBI_SILENCIAR_AUDIO: '1'
    }
  })
}

test('exportar un paquete completo y volver a importarlo con «Conservar las dos»', async () => {
  const datos = crearTemporal('paquetes')
  const documentos = crearTemporal('paquetes-documentos')
  mkdirSync(documentos, { recursive: true })
  await sembrar(datos)
  // El destino propuesto es `{título} — {artista}.shinobi` en la carpeta de Documentos de la prueba.
  const paquete = join(documentos, 'Canción lista — Artista Uno.shinobi')
  const app = await lanzar(datos, documentos, paquete)
  try {
    const v = await app.firstWindow()
    const tarjeta = v.getByRole('article', { name: /^Canción lista,/ })
    const id = (await tarjeta.getAttribute('data-tarjeta'))!
    await expect(v.getByRole('article')).toHaveCount(20)

    // Exportar paquete…: las dos opciones con tamaño, el destino y el aviso de derechos siempre visible.
    await tarjeta.getByRole('button', { name: 'Más acciones de «Canción lista»' }).click()
    await v.getByRole('menuitem', { name: 'Exportar paquete…' }).click()
    const exportar = v.getByRole('dialog', { name: 'Exportar paquete' })
    await expect(exportar.getByRole('radio', { name: /Completo, con el audio/ })).toBeChecked()
    await expect(exportar.getByText(/Es una copia para ti\./)).toBeVisible()
    await expect(exportar.getByLabel('Guardar como')).toHaveValue(paquete)
    await exportar.getByRole('button', { name: 'Exportar paquete' }).click()

    // Fin: nombre, tamaño y «Mostrar en la carpeta»; en la carpeta solo está el archivo final.
    const creado = v.getByRole('dialog', { name: 'Paquete creado' })
    await expect(creado).toBeVisible({ timeout: 60_000 })
    await expect(creado.getByRole('button', { name: 'Mostrar en la carpeta' })).toBeFocused()
    expect(readdirSync(documentos)).toEqual(['Canción lista — Artista Uno.shinobi'])
    await creado.getByRole('button', { name: 'Cerrar' }).click()

    // Para que no sea «Ya la tienes igual», la canción local cambia después de exportarla.
    await v.evaluate(async (cancionId) => {
      const api = (globalThis as unknown as { shinobi: ApiShinobi }).shinobi.biblioteca
      const c = await api.obtener(cancionId)
      await api.actualizarMetadatos(cancionId, {
        titulo: c!.metadatos.titulo,
        artista: c!.metadatos.artista,
        album: 'Disco de después'
      })
    }, id)

    // Restaurar o importar… (Ajustes) con el selector de pruebas.
    await v.getByRole('button', { name: 'Ajustes' }).click()
    await expect(v.getByRole('heading', { name: 'Copia de seguridad' })).toBeVisible()
    await v.getByRole('button', { name: 'Restaurar o importar…' }).click()
    const importar = v.getByRole('dialog', { name: 'Importar paquete' })
    await expect(importar.getByText(/Ya la tienes\. La del paquete es más antigua/)).toBeVisible()
    await expect(importar.getByRole('button', { name: 'Importar 0 canciones' })).toBeVisible()
    await importar.getByRole('radio', { name: 'Conservar las dos' }).click()
    await importar.getByRole('button', { name: 'Importar 1 canción' }).click()

    // Resultado: una fila por canción; la importada como copia con otro identificador.
    const resultado = v.getByRole('dialog', { name: 'Importar paquete' })
    await expect(resultado.getByText('Se importó 1 canción.')).toBeVisible({ timeout: 60_000 })
    await expect(resultado.getByText('Importada como «Canción lista (importada)»')).toBeVisible()
    await resultado.getByRole('button', { name: 'Cerrar' }).click()

    // Vuelve a la Biblioteca con 21 canciones; la existente no cambió y la copia tiene su carpeta.
    await expect(v.getByRole('article')).toHaveCount(21)
    await expect(v.getByRole('article', { name: /^Canción lista \(importada\),/ })).toBeVisible()
    const carpetas = readdirSync(join(datos, 'biblioteca')).filter((n) => !n.startsWith('.'))
    // La semilla trae una carpeta más que tarjetas (la dañada sin ficha) y la copia suma otra.
    expect(carpetas).toHaveLength(22)
    const original = JSON.parse(readFileSync(join(datos, 'biblioteca', id, 'cancion.json'), 'utf8'))
    expect(original.metadatos).toMatchObject({ titulo: 'Canción lista', album: 'Disco de después' })
    const copiaId = carpetas.find((n) => {
      const j = join(datos, 'biblioteca', n, 'cancion.json')
      if (n === id || !existsSync(j)) return false
      try {
        return JSON.parse(readFileSync(j, 'utf8')).metadatos.titulo === 'Canción lista (importada)'
      } catch {
        return false // la semilla trae una ficha rota a propósito
      }
    })
    expect(copiaId).toBeTruthy()
    expect(existsSync(join(datos, 'biblioteca', copiaId!, 'pistas', 'voz.flac'))).toBe(true)
    // `.importando/` queda vacía: nunca una canción a medias.
    expect(readdirSync(join(datos, 'biblioteca', '.importando'))).toEqual([])
  } finally {
    await app.close()
  }
})
