import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { FIXTURES } from '../../shared/__fixtures__'
import {
  estiloPredeterminado,
  FUENTES_REGISTRO,
  migrarConfig,
  type Cancion,
  type Estilo
} from '../../shared'
import { silencioFlac } from './flac'

export interface ResultadoSemilla {
  creadas: string[]
  existentes: string[]
}

const familia = (i: number): string => FUENTES_REGISTRO[i % FUENTES_REGISTRO.length]!.familia

function estiloVariado(i: number): Estilo {
  const colores = [
    ['#0B3D2E', '#1F8A5B', '#FFFFFF', '#FFE066'],
    ['#2B0A0A', '#8A1F1F', '#FFF4E0', '#FF9F43'],
    ['#0A1A33', '#1E5AA8', '#E8F1FF', '#4DE1FF'],
    ['#222222', '#222222', '#F2F2F2', '#FF4D8D']
  ][i % 4]!
  const [a, b, color, resalte] = colores as [string, string, string, string]
  return {
    version: 1,
    fondo:
      a === b
        ? { tipo: 'solido', color: a }
        : {
            tipo: 'degradado',
            angulo_grados: (i * 45) % 360,
            paradas: [
              { color: a, posicion: 0 },
              { color: b, posicion: 1 }
            ]
          },
    letra: { fuente: { familia: familia(i), origen: 'incluida' }, color, color_resaltado: resalte }
  }
}

interface Plan {
  id: string
  cancion: Cancion
  /** Escribe los FLAC de pistas (por defecto sí, si hay pistas). */
  conPistas?: boolean
  /** Contenido literal de cancion.json (canción dañada por JSON). */
  jsonCrudo?: string
  /** Miniatura JPEG de `scripts/fixtures/` que se copia a `fuente/miniatura.jpg`. */
  miniatura?: string
}

/** Carpeta de las miniaturas generadas (tarea 0052); la semilla se ejecuta siempre desde `app/`. */
const rutaFixture = (nombre: string): string =>
  resolve(process.cwd(), 'scripts', 'fixtures', nombre)

/** Canción de YouTube ya descargada, con miniatura. `propio` = estilo modificado por el usuario. */
function youtube(n: number, titulo: string, artista: string, ytId: string, propio: boolean): Plan {
  const base = FIXTURES.borradorRecienCreado()
  const fecha = new Date(Date.UTC(2026, 10, 3, 10, 20 - n)).toISOString().replace('.000Z', 'Z')
  return {
    id: idN(n),
    miniatura: n === 12 ? 'miniatura-a.jpg' : 'miniatura-b.jpg',
    cancion: {
      ...base,
      id: idN(n),
      modificada: fecha,
      metadatos: { ...base.metadatos, titulo, artista },
      fuente: {
        ...base.fuente,
        tipo: 'youtube',
        nombre_original: null,
        url: `https://youtu.be/${ytId}`,
        youtube_id: ytId,
        miniatura: 'fuente/miniatura.jpg'
      },
      estilo: propio ? estiloVariado(n) : estiloPredeterminado()
    }
  }
}

const idN = (n: number): string => `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`

function plan(): Plan[] {
  const f = FIXTURES
  const con = (n: number, c: Cancion, titulo: string, artista: string, minutos = 0): Plan => {
    const fecha = new Date(Date.UTC(2026, 10, 3, 10, 20 - minutos))
      .toISOString()
      .replace('.000Z', 'Z')
    return {
      id: idN(n),
      cancion: {
        ...c,
        id: idN(n),
        modificada: fecha,
        metadatos: { ...c.metadatos, titulo, artista },
        estilo: estiloVariado(n)
      }
    }
  }
  const danadaPistas = con(10, f.lista(), 'Sin pistas', 'Artista dañado', 9)
  return [
    con(1, f.lista(), 'Canción lista', 'Artista Uno', 1),
    con(2, f.listaConPalabras(), 'Lista con palabras', 'Artista Dos', 2),
    con(3, f.listaIncompletaUna(), 'Lista incompleta', 'Artista Tres', 3),
    con(4, f.borradorRecienCreado(), 'Borrador recién creado', 'Artista Cuatro', 4),
    con(5, f.sinLetra(), 'Borrador sin letra', 'Artista Cinco', 5),
    con(6, f.letraAMediasUnaSinInicio(), 'Borrador con letra a medias', 'Artista Seis', 6),
    con(7, f.conError(), 'Separación con error', 'Artista Siete', 7),
    con(8, f.interrumpida(), 'Separación interrumpida', 'Artista Ocho', 8),
    { ...danadaPistas, conPistas: false },
    { id: idN(11), cancion: f.lista(), conPistas: false, jsonCrudo: '{ "esquema": 1, "id": ' },
    // YouTube con miniatura: una usa la miniatura como portada, otra tiene estilo propio.
    youtube(12, 'Desde YouTube con portada', 'Artista Doce', 'sEeD0000012', false),
    youtube(13, 'Desde YouTube con estilo propio', 'Artista Trece', 'sEeD0000013', true)
  ]
}

async function existe(ruta: string): Promise<boolean> {
  try {
    await stat(ruta)
    return true
  } catch {
    return false
  }
}

/**
 * Crea una biblioteca de desarrollo con las fixtures de 0006 y un `config.json`
 * con la instalación completa. Idempotente: no toca lo que ya existe;
 * con `limpiar` borra `biblioteca/` y `config.json` y los recrea.
 */
export async function sembrar(
  datos: string,
  opciones: { limpiar?: boolean } = {}
): Promise<ResultadoSemilla> {
  const biblioteca = join(datos, 'biblioteca')
  if (opciones.limpiar) {
    await rm(biblioteca, { recursive: true, force: true })
    await rm(join(datos, 'config.json'), { force: true })
  }
  await mkdir(join(biblioteca, '.importando'), { recursive: true })

  const resultado: ResultadoSemilla = { creadas: [], existentes: [] }
  const rutaConfig = join(datos, 'config.json')
  if (!(await existe(rutaConfig))) {
    const config = migrarConfig({
      esquema: 1,
      instalacion: {
        estado: 'completa',
        fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' },
        perfil_hardware: 'cpu'
      },
      separacion: { modelos_descargados: ['rapido'] }
    })
    await writeFile(rutaConfig, JSON.stringify(config, null, 2) + '\n')
  }

  const audio = silencioFlac()
  for (const p of plan()) {
    const carpeta = join(biblioteca, p.id)
    if (await existe(carpeta)) {
      resultado.existentes.push(p.id)
      continue
    }
    await mkdir(join(carpeta, 'fuente'), { recursive: true })
    await mkdir(join(carpeta, 'pistas'), { recursive: true })
    await writeFile(join(carpeta, 'fuente', 'mezcla.flac'), audio)
    if (p.miniatura) {
      await writeFile(
        join(carpeta, 'fuente', 'miniatura.jpg'),
        await readFile(rutaFixture(p.miniatura))
      )
    }
    const hayPistas =
      p.cancion.pistas !== null || p.cancion.pasos.separacion.estado === 'completado'
    if (hayPistas && p.conPistas !== false) {
      await writeFile(join(carpeta, 'pistas', 'voz.flac'), audio)
      await writeFile(join(carpeta, 'pistas', 'instrumental.flac'), audio)
    }
    await writeFile(
      join(carpeta, 'cancion.json'),
      p.jsonCrudo ?? JSON.stringify(p.cancion, null, 2) + '\n'
    )
    resultado.creadas.push(p.id)
  }
  return resultado
}

/** Número de entradas visibles en `biblioteca/` (utilidad de pruebas). */
export async function contarCanciones(datos: string): Promise<number> {
  const e = await readdir(join(datos, 'biblioteca'))
  return e.filter((n) => !n.startsWith('.')).length
}
