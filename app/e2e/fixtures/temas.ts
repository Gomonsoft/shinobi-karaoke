import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Locator,
  type Page
} from '@playwright/test'
import {
  catalogoDeSemilla,
  sembrar,
  TEMA_INEXISTENTE,
  TEMA_NEON,
  TEMA_NOCHE_NINJA,
  TEMA_SOL
} from '../../src/main/biblioteca/semilla'
import { crearTemporal } from '../temporales'
import { idSemilla, lanzar } from './editor'
import { leerCancion } from './separacion'

/**
 * Ayudantes de los E2E de temas (tarea 0176): siembra con catálogo, lectura del catálogo en disco,
 * hashes de `cancion.json` e inyección de fallos de escritura.
 */

export { catalogoDeSemilla, idSemilla, TEMA_INEXISTENTE, TEMA_NEON, TEMA_NOCHE_NINJA, TEMA_SOL }

/** Id de la canción de la semilla de temas `n` (30–41). */
export const idTemas = idSemilla

export const rutaCatalogo = (datos: string): string => join(datos, 'biblioteca', 'temas.json')
export const rutaCancion = (datos: string, id: string): string =>
  join(datos, 'biblioteca', id, 'cancion.json')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Catalogo = any

export const leerCatalogo = (datos: string): Catalogo =>
  JSON.parse(readFileSync(rutaCatalogo(datos), 'utf8'))
export const escribirCatalogo = (datos: string, catalogo: unknown): void =>
  writeFileSync(rutaCatalogo(datos), JSON.stringify(catalogo, null, 2) + '\n')

/** Ids de las carpetas de canciones de la biblioteca. */
export function idsCanciones(datos: string): string[] {
  return readdirSync(join(datos, 'biblioteca'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort()
}

/** SHA-256 de cada `cancion.json` de la biblioteca, por id. */
export function hashesCanciones(datos: string): Record<string, string> {
  const r: Record<string, string> = {}
  for (const id of idsCanciones(datos)) {
    try {
      r[id] = createHash('sha256')
        .update(readFileSync(rutaCancion(datos, id)))
        .digest('hex')
    } catch {
      /* carpeta sin cancion.json (p. ej. recién creada) */
    }
  }
  return r
}

/**
 * Hace fallar la próxima escritura de `ruta` (cancion.json o temas.json): deja un directorio no
 * vacío donde la persistencia crea su archivo temporal (`<ruta>.tmp`). Es portable (Windows, macOS
 * y Linux) y no requiere permisos ni variables de entorno.
 */
export function envenenarEscritura(ruta: string): void {
  mkdirSync(join(`${ruta}.tmp`, 'bloqueo'), { recursive: true })
}

/** Quita el bloqueo creado por `envenenarEscritura`. */
export async function repararEscritura(ruta: string): Promise<void> {
  const { rmSync } = await import('node:fs')
  rmSync(`${ruta}.tmp`, { recursive: true, force: true })
}

/**
 * Reescribe `cancion.json` con un cambio (antes de lanzar la app), p. ej. una base que apunta a un
 * tema que no está en `temas.json`, como una carpeta copiada de otro equipo.
 */
export function modificarCancion(datos: string, id: string, cambio: (c: Catalogo) => void): void {
  const c = leerCancion(datos, id)
  cambio(c)
  writeFileSync(rutaCancion(datos, id), JSON.stringify(c, null, 2) + '\n')
}

/** Siembra una canción más (copia de una de la semilla) con otro título, artista, álbum y apariencia. */
export function clonarCancion(
  datos: string,
  origen: string,
  id: string,
  campos: { titulo: string; artista?: string; album?: string | null; apariencia?: unknown }
): void {
  const base = leerCancion(datos, origen)
  const carpetaOrigen = join(datos, 'biblioteca', origen)
  const carpeta = join(datos, 'biblioteca', id)
  mkdirSync(join(carpeta, 'fuente'), { recursive: true })
  mkdirSync(join(carpeta, 'pistas'), { recursive: true })
  for (const f of [
    ['fuente', 'mezcla.flac'],
    ['pistas', 'voz.flac'],
    ['pistas', 'instrumental.flac']
  ] as const) {
    try {
      writeFileSync(join(carpeta, ...f), readFileSync(join(carpetaOrigen, ...f)))
    } catch {
      /* canción sin pistas */
    }
  }
  base.id = id
  base.metadatos = {
    ...base.metadatos,
    titulo: campos.titulo,
    artista: campos.artista ?? '',
    album: campos.album ?? null
  }
  if (campos.apariencia === undefined) delete base.apariencia
  else base.apariencia = campos.apariencia
  writeFileSync(join(carpeta, 'cancion.json'), JSON.stringify(base, null, 2) + '\n')
}

/** Siembra con temas, lanza, ejecuta la prueba y cierra siempre. */
export async function conTemas(
  nombre: string,
  prueba: (v: Page, datos: string, app: ElectronApplication) => Promise<void>,
  opciones: {
    preparar?: (datos: string) => void
    dpr?: number
    temas?: boolean
    ancho?: number
    alto?: number
  } = {}
): Promise<void> {
  const datos = crearTemporal(nombre)
  await sembrar(datos, { temas: opciones.temas ?? true })
  opciones.preparar?.(datos)
  const app = await lanzar(datos, opciones.dpr)
  try {
    const v = await app.firstWindow()
    await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
    await prueba(v, datos, app)
  } finally {
    await app.close().catch(() => undefined)
  }
}

/** Lanza de nuevo sobre los mismos datos (reinicio de la app). */
export async function reabrir(
  datos: string,
  dpr?: number
): Promise<{ app: ElectronApplication; v: Page }> {
  const app = await lanzar(datos, dpr)
  const v = await app.firstWindow()
  await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
  return { app, v }
}

export { electron }

/**
 * Comprueba que todos los botones del diálogo son visibles y quedan dentro de su rectángulo (un
 * pie con tres botones que no caben no debe cortar ninguno; ver «Seguir editando», fase 3).
 */
export async function botonesDentroDelDialogo(dialogo: Locator): Promise<number> {
  const caja = await dialogo.boundingBox()
  expect(caja, 'el diálogo tiene caja').not.toBeNull()
  const botones = dialogo.getByRole('button')
  const n = await botones.count()
  for (let i = 0; i < n; i++) {
    const b = botones.nth(i)
    const c = await b.boundingBox()
    const nombre = (await b.getAttribute('aria-label')) ?? (await b.innerText())
    expect(c, `«${nombre}» tiene caja`).not.toBeNull()
    await expect(b, `«${nombre}» visible`).toBeVisible()
    expect(c!.x, `«${nombre}» no se corta por la izquierda`).toBeGreaterThanOrEqual(caja!.x - 1)
    expect(c!.x + c!.width, `«${nombre}» no se corta por la derecha`).toBeLessThanOrEqual(
      caja!.x + caja!.width + 1
    )
    expect(c!.y, `«${nombre}» no se corta por arriba`).toBeGreaterThanOrEqual(caja!.y - 1)
    expect(c!.y + c!.height, `«${nombre}» no se corta por abajo`).toBeLessThanOrEqual(
      caja!.y + caja!.height + 1
    )
  }
  return n
}
