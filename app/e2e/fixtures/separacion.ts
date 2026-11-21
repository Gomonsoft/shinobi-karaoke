import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Locator,
  type Page
} from '@playwright/test'
import { manifiestoSchema } from '../../src/shared/manifiesto'
import { contenidoDiminuto, manifiestoParaEscenario } from '../../src/main/runtime/falso/escenario'
import { crearTemporal } from '../temporales'

/**
 * Fixture de los E2E de la separación (0075, ADR 0009 §8): sin PyTorch, sin modelos reales y sin red.
 * - `SHINOBI_RUNTIME_FALSO` (modelos diminutos) y el modelo Calidad ya "verificado" en disco.
 * - `SHINOBI_SEPARADOR_FALSO`: escenario del separador del worker (segundos y pasos cortos).
 * - `SHINOBI_AVISOS_PRUEBAS`: registro de los avisos del sistema (una línea JSON por llamada).
 * - Audio de prueba: WAV con un tono, generado aquí (como en 0046).
 */

export interface EscenarioSeparador {
  segundos: number
  pasos: number
  fallos?: unknown[]
  morir_con_sigkill?: boolean
}

export interface Entorno {
  datos: string
  wav: string
  escenario: string
  avisos: string
  /** Registro de llamadas del runtime falso (descargas de modelos, etc.). */
  llamadas: string
}

/** Variantes del arranque (0076). */
export interface OpcionesPreparar {
  /** Campos del escenario del runtime falso (p. ej. `fallo` o `fases.modelo.ms`). */
  runtime?: Record<string, unknown>
  /** El modelo Calidad no está descargado (ni en `verificados.json`). */
  sinCalidad?: boolean
  /** Modo Rápido ya aceptado y en uso, con su modelo verificado. */
  rapido?: boolean
}

/** WAV PCM 16 bit estéreo con un tono de 440 Hz. */
export function escribirWav(ruta: string, segundos = 15, tasa = 22050): void {
  const n = segundos * tasa
  const b = Buffer.alloc(44 + n * 4)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 4, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20) // PCM
  b.writeUInt16LE(2, 22) // estéreo
  b.writeUInt32LE(tasa, 24)
  b.writeUInt32LE(tasa * 4, 28)
  b.writeUInt16LE(4, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    const izq = Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / tasa))
    const der = Math.round(5000 * Math.sin((2 * Math.PI * 660 * i) / tasa))
    b.writeInt16LE(izq, 44 + i * 4)
    b.writeInt16LE(der, 46 + i * 4)
  }
  writeFileSync(ruta, b)
}

const manifiesto = manifiestoSchema.parse(
  JSON.parse(readFileSync(join(process.cwd(), 'resources', 'runtime-manifest.json'), 'utf8'))
)

/** Modelos diminutos ya descargados y verificados (`verificados.json`); Calidad con su yaml. */
function sembrarModelos(datos: string, ids: ('calidad' | 'rapido')[]): void {
  const dir = join(datos, 'modelos')
  mkdirSync(dir, { recursive: true })
  const verificados: Record<string, { bytes: number; sha256: string; mtimeMs: number }> = {}
  for (const id of ids) {
    const m = manifiestoParaEscenario(manifiesto, { modelos: 'diminutos' }).modelos.find(
      (x) => x.id === id
    )
    if (!m) throw new Error(`manifiesto sin modelo ${id}`)
    // Principal y archivos extra (el .yaml de Calidad), como los deja el descargador.
    const archivos = [
      { archivo: m.archivo, bytes: m.bytes, sha256: m.sha256 },
      ...m.extra.map((e) => ({ archivo: e.archivo, bytes: e.bytes, sha256: e.sha256 }))
    ]
    for (const f of archivos) {
      const ruta = join(dir, f.archivo)
      writeFileSync(ruta, contenidoDiminuto(f.archivo))
      verificados[f.archivo] = {
        bytes: f.bytes,
        sha256: f.sha256,
        mtimeMs: Math.trunc(statSync(ruta).mtimeMs)
      }
    }
  }
  if (ids.length > 0) writeFileSync(join(dir, 'verificados.json'), JSON.stringify(verificados))
}

export function escribirEscenario(e: Entorno, escenario: EscenarioSeparador): void {
  writeFileSync(e.escenario, JSON.stringify(escenario))
}

export function preparar(
  nombre: string,
  escenario: EscenarioSeparador = { segundos: 4, pasos: 8 },
  opciones: OpcionesPreparar = {}
): Entorno {
  const datos = crearTemporal(nombre)
  const entrada = crearTemporal(`${nombre}-entrada`)
  const wav = join(entrada, 'Mi tema de prueba.wav')
  escribirWav(wav)
  const e: Entorno = {
    datos,
    wav,
    escenario: join(entrada, 'separador.json'),
    avisos: join(entrada, 'avisos.jsonl'),
    llamadas: join(entrada, 'llamadas.jsonl')
  }
  escribirEscenario(e, escenario)
  writeFileSync(
    join(entrada, 'runtime.json'),
    JSON.stringify({
      modelos: 'diminutos',
      fases: {
        motor: { ms: 0 },
        componentes: { ms: 0 },
        diagnostico: { ms: 0 },
        modelo: { ms: 0 }
      },
      ...opciones.runtime
    })
  )
  // Instalación completa: sin ella arranca el Primer arranque en vez de la Biblioteca.
  writeFileSync(
    join(datos, 'config.json'),
    JSON.stringify({
      esquema: 1,
      instalacion: {
        estado: 'completa',
        fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' },
        perfil_hardware: 'cpu'
      },
      separacion: opciones.rapido
        ? {
            modo: 'rapido',
            rapido_aceptado: new Date().toISOString(),
            modelos_descargados: ['rapido']
          }
        : { modelos_descargados: opciones.sinCalidad ? [] : ['calidad'] }
    })
  )
  sembrarModelos(datos, opciones.rapido ? ['rapido'] : opciones.sinCalidad ? [] : ['calidad'])
  return e
}

export function lanzar(
  e: Entorno,
  extra: Record<string, string> = {},
  argumentos: string[] = []
): Promise<ElectronApplication> {
  return electron.launch({
    args: [...argumentos, '.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      SHINOBI_DATOS: e.datos,
      SHINOBI_PAPELERA_PRUEBAS: join(e.datos, 'papelera'),
      SHINOBI_DIALOGO_PRUEBAS: e.wav,
      SHINOBI_RUNTIME_FALSO: join(e.escenario, '..', 'runtime.json'),
      SHINOBI_SEPARADOR_FALSO: e.escenario,
      SHINOBI_AVISOS_PRUEBAS: e.avisos,
      ...extra
    }
  })
}

/** Cierra la app confirmando el diálogo de cierre si hay trabajos vivos (0073). */
export async function cerrar(app: ElectronApplication): Promise<void> {
  const ventana = app.windows()[0]
  const cierre = app.close()
  await ventana
    ?.getByRole('dialog')
    .getByRole('button', { name: 'Cerrar de todos modos' })
    .click({ timeout: 3000 })
    .catch(() => undefined)
  await cierre
}

// --- Disco ---

export const canciones = (datos: string): string[] => {
  const d = join(datos, 'biblioteca')
  return existsSync(d)
    ? readdirSync(d).filter((x) => x !== '.importando' && !x.startsWith('temas.json'))
    : []
}
export const carpeta = (datos: string, id: string): string => join(datos, 'biblioteca', id)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const leerCancion = (datos: string, id: string): any =>
  JSON.parse(readFileSync(join(carpeta(datos, id), 'cancion.json'), 'utf8'))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const leerConfig = (datos: string): any =>
  JSON.parse(readFileSync(join(datos, 'config.json'), 'utf8'))

/** Id de la canción con ese título. */
export function idDe(datos: string, titulo: string): string {
  const id = canciones(datos).find((c) => leerCancion(datos, c).metadatos.titulo === titulo)
  if (!id) throw new Error(`no hay una canción «${titulo}»`)
  return id
}

/** Llamadas anotadas por los dobles del runtime falso (`t: 'descarga'`, `modelo`...). */
export function llamadasRuntime(e: Entorno): { t: string; modelo?: string }[] {
  if (!existsSync(e.llamadas)) return []
  return readFileSync(e.llamadas, 'utf8')
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => JSON.parse(l) as { t: string; modelo?: string })
}

/** Contenido de todos los registros del worker (`registros/worker-*.log`). */
export function registrosWorker(datos: string): string {
  const dir = join(datos, 'registros')
  if (!existsSync(dir)) return ''
  return readdirSync(dir)
    .filter((n) => n.startsWith('worker-'))
    .map((n) => readFileSync(join(dir, n), 'utf8'))
    .join('\n')
}

export function avisosRegistrados(e: Entorno): { tipo: string; cuerpo?: string }[] {
  if (!existsSync(e.avisos)) return []
  return readFileSync(e.avisos, 'utf8')
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => JSON.parse(l) as { tipo: string; cuerpo?: string })
}

/** Procesos del worker vivos de esta prueba (su línea de órdenes incluye la carpeta de datos). */
export function procesosWorker(datos: string): string[] {
  if (process.platform === 'win32') return []
  return execFileSync('ps', ['-eo', 'args'], { encoding: 'utf8' })
    .split('\n')
    .filter((l) => l.includes('shinobi_worker') && l.includes(datos))
}

// --- Interfaz ---

export const subpasos = (v: Page): Locator => v.getByRole('list', { name: 'Subpasos' })
export const filaPreparar = (v: Page): Locator => subpasos(v).getByRole('listitem').first()
export const filaSeparar = (v: Page): Locator => subpasos(v).getByRole('listitem').nth(1)
export const tarjeta = (v: Page, titulo: string): Locator =>
  v.getByRole('article', { name: new RegExp(`^${titulo},`) })

export async function irAAnadir(v: Page): Promise<void> {
  await v.getByRole('button', { name: 'Añadir canción' }).first().click()
  await expect(v.getByRole('heading', { level: 1, name: 'Añadir canción' })).toBeVisible()
}

/**
 * Importa el WAV con ese título y deja la vista de progreso abierta. La separación se encadena sola
 * al importar (0065).
 */
export async function importar(v: Page, titulo: string): Promise<void> {
  await irAAnadir(v)
  await v.getByRole('button', { name: 'Elegir archivo…' }).click()
  await expect(v.getByRole('heading', { name: 'Revisa los datos de la canción' })).toBeVisible({
    timeout: 30_000
  })
  await v.getByLabel('Título').fill(titulo)
  await v.getByRole('button', { name: 'Continuar' }).click()
  await expect(filaPreparar(v)).toContainText('Preparar el audio')
}

export async function volverABiblioteca(v: Page): Promise<void> {
  await v.getByRole('button', { name: 'Volver a la biblioteca' }).click()
  await expect(v.getByRole('heading', { level: 1, name: /Biblioteca/ })).toBeVisible()
}
