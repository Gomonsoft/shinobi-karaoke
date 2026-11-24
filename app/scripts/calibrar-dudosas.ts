/**
 * Calibración de las líneas dudosas (tarea 0334, ADR 0024 §3). Herramienta de desarrollo: NO se
 * empaqueta y es de SOLO LECTURA (abre los archivos en modo lectura y no escribe nada). Solo imprime ids,
 * títulos y cifras; nunca texto de letra.
 *
 * Uso: npm run calibrar:dudosas -- <carpeta-de-biblioteca> [--ids a,b,c] [--json]
 *
 * Por cada canción con `cancion.json`, letra con tiempos y picos ya generados (el script no los genera),
 * cuenta las líneas que `detectarDudosas` señalaría con `PARAMETROS_DUDOSAS`, por motivo, ignorando las
 * marcas «está bien» (`revisada`) para medir la letra tal cual. Objetivo (ADR 0024): en canciones ya
 * revisadas, no más del 10 % de las líneas.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import {
  detectarDudosas,
  MOTIVOS_DUDOSA,
  type MotivoDudosa,
  type ParametrosDudosas
} from '../src/shared/dudosas'
import { detectarVoz } from '../src/shared/silencios'
import { letraSchema, type Letra } from '../src/shared/letra'
import { leerNivel } from './calibrar-encaje'

export const OBJETIVO_FRACCION = 0.1

export interface FilaDudosas {
  id: string
  titulo: string
  lineas: number
  señaladas: number
  fraccion: number
  motivos: Partial<Record<MotivoDudosa, number>>
  dentroDelObjetivo: boolean
}
export interface ResultadoDudosas {
  filas: FilaDudosas[]
  avisos: string[]
  resumen: { canciones: number; dentroDelObjetivo: number; lineas: number; señaladas: number }
}

const sinRevisadas = (letra: Letra): Letra => ({
  ...letra,
  lineas: letra.lineas.map((l) => {
    const copia = { ...l }
    delete copia.revisada
    return copia
  })
})

export async function calibrarDudosas(
  raiz: string,
  { ids, p }: { ids?: string[]; p?: ParametrosDudosas } = {}
): Promise<ResultadoDudosas> {
  const avisos: string[] = []
  const candidatas =
    ids ??
    (await readdir(raiz, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  const filas: FilaDudosas[] = []
  for (const id of candidatas) {
    const carpeta = join(raiz, id)
    if (!(await stat(join(carpeta, 'cancion.json')).catch(() => null))) {
      if (ids) avisos.push(`${id}: no existe; se omite`)
      continue
    }
    let json: { letra?: unknown; metadatos?: { titulo?: unknown } }
    try {
      json = JSON.parse(await readFile(join(carpeta, 'cancion.json'), 'utf8'))
    } catch {
      avisos.push(`${id}: no se pudo leer cancion.json; se omite`)
      continue
    }
    const letra = letraSchema.safeParse(json.letra)
    const lineas = letra.success ? letra.data.lineas.filter((l) => l.tipo === 'linea') : []
    if (!letra.success || !lineas.some((l) => l.inicio_ms !== null)) {
      avisos.push(`${id}: sin letra con tiempos; se omite`)
      continue
    }
    const nivel = await leerNivel(carpeta)
    if (!nivel) {
      avisos.push(`${id}: sin caché de picos válida (ábrela una vez en el editor); se omite`)
      continue
    }
    const voz = detectarVoz({ pasoMs: nivel.pasoMs, pares: nivel.pares })
    const dudosas = detectarDudosas(sinRevisadas(letra.data), voz, {
      duracionMs: nivel.duracionMs,
      ...(p ? { p } : {})
    })
    const motivos: Partial<Record<MotivoDudosa, number>> = {}
    for (const d of dudosas) for (const m of d.motivos) motivos[m] = (motivos[m] ?? 0) + 1
    const fraccion = Math.round((dudosas.length / lineas.length) * 1000) / 1000
    filas.push({
      id,
      titulo: typeof json.metadatos?.titulo === 'string' ? json.metadatos.titulo : id,
      lineas: lineas.length,
      señaladas: dudosas.length,
      fraccion,
      motivos,
      dentroDelObjetivo: fraccion <= OBJETIVO_FRACCION
    })
  }
  return {
    filas,
    avisos,
    resumen: {
      canciones: filas.length,
      dentroDelObjetivo: filas.filter((f) => f.dentroDelObjetivo).length,
      lineas: filas.reduce((n, f) => n + f.lineas, 0),
      señaladas: filas.reduce((n, f) => n + f.señaladas, 0)
    }
  }
}

export function formatearDudosas(r: ResultadoDudosas): string {
  const col = (v: string | number, n: number): string => String(v).padStart(n)
  const salida = [
    ...r.avisos.map((a) => `AVISO ${a}`),
    `Canciones: ${r.resumen.canciones}. Líneas señaladas con PARAMETROS_DUDOSAS (marcas «está bien» ignoradas):`,
    `id        líneas  señaladas      %  ${MOTIVOS_DUDOSA.map((m) => m.padStart(14)).join('')}  título`
  ]
  for (const f of r.filas) {
    salida.push(
      `${f.id.slice(0, 8).padEnd(8)} ${col(f.lineas, 7)} ${col(f.señaladas, 10)} ${col((f.fraccion * 100).toFixed(1), 6)}  ` +
        `${MOTIVOS_DUDOSA.map((m) => col(f.motivos[m] ?? 0, 14)).join('')}  ${f.titulo}` +
        (f.dentroDelObjetivo ? '' : '  <- supera el 10 %')
    )
  }
  const s = r.resumen
  salida.push(
    '',
    'Resumen:',
    `  canciones dentro del objetivo (≤ 10 %): ${s.dentroDelObjetivo}/${s.canciones}`,
    `  líneas señaladas: ${s.señaladas}/${s.lineas}`
  )
  return salida.join('\n')
}
