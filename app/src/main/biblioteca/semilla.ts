import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { FIXTURES, letra, linea, pausa } from '../../shared/__fixtures__'
import {
  crearIndiceCatalogo,
  estiloPredeterminado,
  FUENTES_REGISTRO,
  migrarConfig,
  resolverApariencia,
  VERSION_CLAVES,
  VERSION_ESQUEMA_CATALOGO,
  type Apariencia,
  type Cancion,
  type Catalogo,
  type Estilo,
  type Letra
} from '../../shared'
import { pulsosFlac, silencioFlac, silencioFlacSegundos } from './flac'

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
  audio?: () => Buffer
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
  // Letras inventadas para probar el paso Letra (0087).
  const sincronizadaLrclib = (): Letra => ({
    origen: 'lrclib',
    lrclib_id: 987654,
    offset_ms: 0,
    lineas: [
      'Luces sobre el río dormido',
      'Cantan los grillos al viento',
      'Vuelve el eco a mi ventana'
    ].map((texto, i) => linea(`s${i + 1}`, texto, 12000 + i * 4000))
  })
  const pegadaSinSincronizar = (): Letra => ({
    origen: 'manual',
    lrclib_id: null,
    offset_ms: 0,
    lineas: [
      'Sombras de papel en la pared',
      'Barcos de tinta sin mar',
      'Hoy el faro es una canción'
    ].map((texto, i) => linea(`m${i + 1}`, texto, null))
  })
  const conLetra = (letra: Letra): Cancion => {
    const c = f.sinLetra()
    return { ...c, letra, pasos: { ...c.pasos, letra: f.lista().pasos.letra } }
  }
  const clics = conLetra(
    letra(Array.from({ length: 12 }, (_, i) => linea(`clic${i + 1}`, `Clic ${i + 1}`, null)))
  )
  clics.letra!.lineas.splice(6, 0, pausa('pausa-clics'))
  const textoSeparando = [
    'Amanece sobre el río',
    'La brisa mueve la vela',
    'Remamos hasta el puente',
    'El puente guarda un secreto',
    'El agua dobla las luces',
    'Se despierta la ciudad'
  ]
  const separando = conLetra(
    letra(textoSeparando.map((texto, i) => linea(`s${i + 1}`, texto, 2000 + i * 4000)))
  )
  separando.pasos.separacion = f.separando().pasos.separacion
  separando.pistas = null
  const incompleta = f.lista()
  const textoIncompleta = [
    'Piedras de sal',
    'Orilla de espuma',
    'Bajo las nubes',
    'Se pierde la luna',
    'Abre los ojos',
    'Enciende la vela',
    'Cuenta las olas',
    'Hasta que vuelva'
  ]
  incompleta.letra = letra(
    textoIncompleta.map((texto, i) => linea(`i${i + 1}`, texto, i === 3 ? null : 2000 + i * 3500))
  )
  const conAudio30s = (n: number, cancion: Cancion, titulo: string, audio: () => Buffer): Plan => {
    cancion.metadatos.duracion_ms = 30_000
    return { ...con(n, cancion, titulo, 'Shinobi Pruebas', n), audio }
  }
  const textoConPalabras = 'Suben las barcas al puerto'
  const listaReproductor = {
    ...f.lista(),
    letra: letra([
      linea('r1', 'Primera luz sobre el tejado', 2000),
      linea('r2', textoConPalabras, 5000, {
        palabras: textoConPalabras.split(' ').map((texto, i) => ({
          texto,
          inicio_ms: 5000 + 500 * i,
          fin_ms: 5500 + 500 * i
        }))
      }),
      linea('r3', 'Nadie sabe la canción', 8000),
      pausa('rp', 12000),
      linea('r4', 'Vuelve el coro a la plaza', 16000),
      linea('r5', 'Y la noche se despierta', 19000),
      linea('r6', 'Fin de la prueba', 22000)
    ])
  }
  const incompletaReproductor = {
    ...f.lista(),
    letra: letra([
      linea('i1', 'Al pie de la montaña', 8000),
      linea('i2', 'Cruje el sendero', 11000),
      linea('i3', 'Nadie cuenta los pasos', null),
      linea('i4', 'Nos espera la aurora', 17000),
      linea('i5', 'Tras el último cerro', 20000)
    ])
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
    youtube(13, 'Desde YouTube con estilo propio', 'Artista Trece', 'sEeD0000013', true),
    // Paso Letra: separando y sin letra; letra de LRCLIB sincronizada; letra pegada sin sincronizar.
    con(14, f.separando(), 'Separando, sin letra', 'Artista Catorce', 14),
    con(15, conLetra(sincronizadaLrclib()), 'Letra de LRCLIB sincronizada', 'Artista Quince', 15),
    con(
      16,
      conLetra(pegadaSinSincronizar()),
      'Letra pegada sin sincronizar',
      'Artista Dieciséis',
      16
    ),
    conAudio30s(17, clics, 'Editor: pista de clics', () =>
      pulsosFlac({ segundos: 30, periodoMs: 2000, desfaseMs: 2000 })
    ),
    conAudio30s(18, separando, 'Editor: separación interrumpida', () => silencioFlacSegundos(30)),
    conAudio30s(19, incompleta, 'Editor: lista incompleta', () => silencioFlacSegundos(30)),
    conAudio30s(20, listaReproductor, 'Reproductor: lista', () =>
      pulsosFlac({ segundos: 30, periodoMs: 2000, desfaseMs: 2000 })
    ),
    conAudio30s(21, incompletaReproductor, 'Reproductor: lista incompleta', () =>
      silencioFlacSegundos(30)
    )
  ]
}

// ---- Temas (fase 3): conjunto de revision-fase-3/README.md#datos-de-prueba ----

const idTema = (n: number): string => `7e3a0000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const TEMA_NEON = idTema(1)
export const TEMA_NOCHE_NINJA = idTema(2)
export const TEMA_SOL = idTema(3)
/** Tema que no existe en el catálogo: la canción que lo referencia resuelve `respaldo`. */
export const TEMA_INEXISTENTE = idTema(99)

const estiloNeon = (): Estilo => estiloVariado(2)
const estiloNoche = (): Estilo => estiloVariado(0)
const estiloSol = (): Estilo => estiloVariado(1)

/** Catálogo de la semilla: «Neón», «Noche ninja» (predeterminado) y «Sol»; Queen → Neón, su álbum → Sol. */
export function catalogoDeSemilla(): Catalogo {
  const marca = '2026-11-03T10:00:00.000Z'
  const tema = (id: string, nombre: string, estilo: Estilo): Catalogo['temas'][number] => ({
    id,
    nombre,
    creado: marca,
    modificado: marca,
    revision: 1,
    estilo
  })
  return {
    esquema: VERSION_ESQUEMA_CATALOGO,
    claves: VERSION_CLAVES,
    predeterminado: TEMA_NOCHE_NINJA,
    temas: [
      tema(TEMA_NEON, 'Neón', estiloNeon()),
      tema(TEMA_NOCHE_NINJA, 'Noche ninja', estiloNoche()),
      tema(TEMA_SOL, 'Sol', estiloSol())
    ],
    asignaciones: {
      artistas: [{ artista: 'queen', nombre_artista: 'Queen', tema_id: TEMA_NEON }],
      albumes: [
        {
          artista: 'queen',
          album: 'a night at the opera',
          nombre_artista: 'Queen',
          nombre_album: 'A Night at the Opera',
          tema_id: TEMA_SOL
        }
      ]
    },
    borrado_pendiente: null,
    apartado: null
  }
}

/** Canciones de la semilla de temas; la instantánea `estilo` es la que daría la resolución. */
function planTemas(): Plan[] {
  const catalogo = catalogoDeSemilla()
  const indice = crearIndiceCatalogo(catalogo)
  const f = FIXTURES
  const cancion = (
    n: number,
    titulo: string,
    artista: string,
    album: string | null,
    apariencia: Apariencia | undefined,
    propio?: Estilo
  ): Plan => {
    const base = f.lista()
    const fecha = new Date(Date.UTC(2026, 10, 3, 9, 59 - (n - 30))).toISOString()
    const metadatos = { ...base.metadatos, titulo, artista, album }
    const estilo =
      propio ??
      resolverApariencia({ metadatos, estilo: estiloPredeterminado(), apariencia }, indice).estilo
    return {
      id: idN(n),
      cancion: {
        ...base,
        id: idN(n),
        modificada: fecha,
        metadatos,
        ...(apariencia ? { apariencia } : {}),
        estilo
      }
    }
  }
  const heredar: Apariencia = { modo: 'heredar' }
  const anterior = { tipo: 'predeterminado_anterior' as const, tema_id: TEMA_SOL }
  const yt = youtube(37, 'Temas: YouTube con miniatura', 'Artista Youtube', 'sEeD0000037', false)
  yt.cancion.metadatos.album = 'Álbum Youtube'
  yt.cancion.apariencia = heredar
  yt.cancion.estilo = estiloNoche()
  return [
    cancion(30, 'Bohemian Rhapsody', 'Queen', 'A Night at the Opera', heredar),
    cancion(31, "Don't Stop Me Now", 'Queen', 'Jazz', heredar),
    cancion(32, 'We Will Rock You', 'Queen', 'Greatest Hits', heredar),
    cancion(33, 'Dancing Queen', 'ABBA', 'Greatest Hits', heredar),
    cancion(34, 'Sin artista ni álbum', '', null, heredar),
    cancion(35, 'Personalizada de 0.1.0', 'Artista Antiguo', null, undefined, estiloVariado(3)),
    cancion(
      36,
      'Tema que ya no existe',
      'Artista Perdido',
      null,
      { modo: 'tema', tema_id: TEMA_INEXISTENTE, tema_nombre: 'Tema perdido' },
      estiloVariado(2)
    ),
    { ...yt, id: idN(37) },
    cancion(38, 'Predeterminado anterior', 'Artista Anterior', null, {
      modo: 'heredar',
      base: anterior,
      tema_nombre: 'Sol'
    }),
    cancion(39, 'Neón con base anterior', 'Artista Anterior', null, {
      modo: 'tema',
      tema_id: TEMA_NEON,
      base: anterior,
      tema_nombre: 'Neón'
    }),
    cancion(40, 'Doble uno', 'Artista Doble', 'Álbum Doble', heredar),
    cancion(41, 'Doble dos', 'Artista Doble', 'Álbum Doble', heredar)
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
  opciones: { limpiar?: boolean; temas?: boolean } = {}
): Promise<ResultadoSemilla> {
  const biblioteca = join(datos, 'biblioteca')
  if (opciones.limpiar) {
    await rm(biblioteca, { recursive: true, force: true })
    await rm(join(datos, 'config.json'), { force: true })
  }
  const conTemas = opciones.temas === true
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
      separacion: { modelos_descargados: ['calidad'] }
    })
    await writeFile(rutaConfig, JSON.stringify(config, null, 2) + '\n')
  }

  const silencio = silencioFlac()
  if (conTemas) {
    // Sin `.bak` ni sobrescritura: si el catálogo ya existe, se respeta.
    const rutaTemas = join(biblioteca, 'temas.json')
    if (!(await existe(rutaTemas))) {
      await writeFile(rutaTemas, JSON.stringify(catalogoDeSemilla(), null, 2) + '\n')
    }
  }
  for (const p of conTemas ? [...plan(), ...planTemas()] : plan()) {
    const carpeta = join(biblioteca, p.id)
    if (await existe(carpeta)) {
      resultado.existentes.push(p.id)
      continue
    }
    await mkdir(join(carpeta, 'fuente'), { recursive: true })
    await mkdir(join(carpeta, 'pistas'), { recursive: true })
    const audio = p.audio?.() ?? silencio
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
