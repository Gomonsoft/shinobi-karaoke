import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { estiloPredeterminado, type Cancion, type Catalogo, type Estilo } from '../../shared'
import { FIXTURES, idDePrueba } from '../../shared/__fixtures__'
import type { CambioCopiaIpc, ProgresoCopiaIpc, ResultadoImportacionIpc } from '../../shared/ipc'
import { ServicioBiblioteca } from '../biblioteca'
import { silencioFlac } from '../biblioteca/flac'
import { ServicioConfig } from '../configuracion'
import { flush } from '../persistencia'
import { ServicioTemas } from '../temas'
import { ServicioCopias } from './servicio'

/**
 * Solo pruebas: un «equipo» con su carpeta de datos temporal, biblioteca real (índice en memoria),
 * catálogo de temas y configuración reales. Nunca toca la carpeta de datos del usuario; las canciones
 * son sintéticas, con títulos y letras inventados.
 */

export interface Equipo {
  /** Carpeta temporal que lo contiene todo (datos, salida y papelera): nada debe aparecer fuera de ella. */
  raiz: string
  datos: string
  biblio: string
  /** Carpeta donde se guardan y desde donde se abren los paquetes. */
  salida: string
  papelera: string
  biblioteca: ServicioBiblioteca
  temas: ServicioTemas
  config: ServicioConfig
  copias: ServicioCopias
  eventos: CambioCopiaIpc[]
  progresos: ProgresoCopiaIpc[]
  /** Sustituye lo que devuelve `dialogoAbrir`. */
  elegirAbrir: { ruta: string | null }
  sonando: Set<string>
  libre: { bytes: number | null }
  limpiar(): Promise<void>
}

export const ID_A = idDePrueba(11)
export const ID_B = idDePrueba(12)
export const ID_C = idDePrueba(13)
export const TEMA_NEON = idDePrueba(701)
export const TEMA_SOL = idDePrueba(702)

let secuencia = 0

export async function montarEquipo(
  opciones: { temasSoloLectura?: boolean; baseIdTemas?: number } = {}
): Promise<Equipo> {
  const raiz = await mkdtemp(join(tmpdir(), 'shinobi-copias-'))
  const datos = join(raiz, 'datos')
  const biblio = join(datos, 'biblioteca')
  const salida = join(raiz, 'salida')
  const papelera = join(raiz, 'papelera')
  await mkdir(biblio, { recursive: true })
  await mkdir(salida, { recursive: true })
  await mkdir(papelera, { recursive: true })
  if (opciones.temasSoloLectura) {
    await writeFile(join(biblio, 'temas.json'), JSON.stringify({ esquema: 99, claves: 1 }))
  }
  const biblioteca = new ServicioBiblioteca(datos, {
    shell: {
      trashItem: (ruta) => rename(ruta, join(papelera, `${Date.now()}-${secuencia++}`)),
      openPath: () => Promise.resolve('')
    }
  })
  let n = 0
  const temas = await ServicioTemas.abrir({
    dirBiblioteca: biblio,
    puerto: biblioteca.puerto(),
    estiloInicial: estiloPredeterminado(),
    esperaIndiceMs: 5,
    nuevoId: () => idDePrueba((opciones.baseIdTemas ?? 900) + ++n)
  })
  biblioteca.conectarTemas(temas)
  const config = await ServicioConfig.abrir(datos)
  const eventos: CambioCopiaIpc[] = []
  const progresos: ProgresoCopiaIpc[] = []
  const elegirAbrir = { ruta: null as string | null }
  const sonando = new Set<string>()
  const libre = { bytes: null as number | null }
  const copias = new ServicioCopias({
    dirBiblioteca: biblio,
    directorioDatos: datos,
    biblioteca,
    temas,
    config,
    libreBytes: () => Promise.resolve(libre.bytes),
    puedeSustituir: (id) => !sonando.has(id),
    version: '0.2.2-prueba',
    ventana: () => null,
    dialogoGuardar: () => Promise.resolve(null),
    dialogoAbrir: () => Promise.resolve(elegirAbrir.ruta),
    carpetaDocumentos: () => salida,
    carpetaHogar: () => salida,
    recordarUbicacion: (ruta) => `ubicacion:${ruta}`,
    emitirCambio: (e) => eventos.push(e),
    emitirProgreso: (e) => progresos.push(e)
  })
  await biblioteca.arrancar()
  return {
    raiz,
    datos,
    biblio,
    salida,
    papelera,
    biblioteca,
    temas,
    config,
    copias,
    eventos,
    progresos,
    elegirAbrir,
    sonando,
    libre,
    limpiar: async () => {
      await copias.cerrar()
      temas.cerrar()
      await flush()
      await rm(raiz, { recursive: true, force: true })
    }
  }
}

export interface OpcionesCancion {
  titulo?: string
  artista?: string
  album?: string | null
  /** Con pistas separadas y la mezcla (por defecto); `false`: borrador con solo la mezcla. */
  conPistas?: boolean
  miniatura?: boolean
  modificada?: string
  creada?: string
  estilo?: Estilo
  apariencia?: Cancion['apariencia']
  mutar?: (c: Cancion) => void
}

/** Escribe una canción sintética en `biblioteca/<id>/` (sin indexarla: llamar a `escanear`). */
export async function sembrarCancion(
  biblio: string,
  id: string,
  o: OpcionesCancion = {}
): Promise<Cancion> {
  const base = o.conPistas === false ? FIXTURES.borradorRecienCreado() : FIXTURES.lista()
  const c: Cancion = {
    ...base,
    id,
    creada: o.creada ?? '2026-11-03T10:00:00.000Z',
    modificada: o.modificada ?? '2026-11-10T10:00:00.000Z',
    metadatos: {
      ...base.metadatos,
      titulo: o.titulo ?? `Canción ${id.slice(-2)}`,
      artista: o.artista ?? 'Artista inventado',
      album: o.album ?? null
    },
    ...(o.estilo ? { estilo: o.estilo } : {}),
    ...(o.apariencia ? { apariencia: o.apariencia } : {})
  }
  if (o.miniatura) c.fuente = { ...c.fuente, miniatura: 'fuente/miniatura.jpg' }
  o.mutar?.(c)
  const carpeta = join(biblio, id)
  await mkdir(join(carpeta, 'fuente'), { recursive: true })
  await mkdir(join(carpeta, 'pistas'), { recursive: true })
  await writeFile(join(carpeta, 'cancion.json'), `${JSON.stringify(c, null, 2)}\n`)
  await writeFile(join(carpeta, 'cancion.json.bak'), '{}')
  await writeFile(join(carpeta, 'fuente', 'mezcla.flac'), silencioFlac(2))
  if (o.conPistas !== false) {
    await writeFile(join(carpeta, 'pistas', 'voz.flac'), silencioFlac(1))
    await writeFile(join(carpeta, 'pistas', 'instrumental.flac'), silencioFlac(1))
  }
  if (o.miniatura)
    await writeFile(join(carpeta, 'fuente', 'miniatura.jpg'), Buffer.from('jpg-de-prueba'))
  // Caché regenerable de picos: nunca viaja.
  await writeFile(join(carpeta, 'picos.bin'), Buffer.from('picos'))
  return c
}

/** Espera a que el trabajo termine y devuelve su evento final. */
export async function esperarFin(e: Equipo, trabajoId: string): Promise<CambioCopiaIpc> {
  for (let i = 0; i < 400; i++) {
    const fin = e.eventos.find(
      (x) => x.trabajoId === trabajoId && ['terminada', 'error', 'cancelada'].includes(x.estado)
    )
    if (fin) return fin
    await new Promise((r) => setTimeout(r, 25))
  }
  throw new Error('El trabajo no terminó a tiempo')
}

/** Exporta y devuelve la ruta del paquete y el evento final. */
export async function exportarA(
  e: Equipo,
  peticion:
    | { tipo: 'canciones'; ids: string[]; conAudio: boolean }
    | { tipo: 'biblioteca'; conAudio: boolean; ajustes?: boolean }
): Promise<{ ruta: string; fin: CambioCopiaIpc }> {
  const destino = await e.copias.destinoPropuesto(
    peticion.tipo === 'canciones'
      ? { tipo: 'canciones', ids: peticion.ids }
      : { tipo: 'biblioteca' }
  )
  const { trabajoId } =
    peticion.tipo === 'canciones'
      ? await e.copias.exportarCanciones({
          ids: peticion.ids,
          conAudio: peticion.conAudio,
          destinoId: destino.destinoId
        })
      : await e.copias.exportarBiblioteca({
          conAudio: peticion.conAudio,
          ajustes: peticion.ajustes ?? false,
          destinoId: destino.destinoId
        })
  const fin = await esperarFin(e, trabajoId)
  return { ruta: join(destino.carpeta, destino.nombre), fin }
}

export async function leerCancionDeDisco(biblio: string, id: string): Promise<Cancion> {
  return JSON.parse(await readFile(join(biblio, id, 'cancion.json'), 'utf8')) as Cancion
}

export const catalogoVacio = (c: Partial<Catalogo> = {}): Catalogo => ({
  esquema: 1,
  claves: 1,
  predeterminado: null,
  temas: [],
  asignaciones: { artistas: [], albumes: [] },
  borrado_pendiente: null,
  apartado: null,
  ...c
})

/** Importa y espera el evento final: devuelve el resultado, o lanza un error con el `codigo` del evento. */
export async function importarEsperando(
  e: Equipo,
  peticion: Parameters<Equipo['copias']['importar']>[0]
): Promise<ResultadoImportacionIpc> {
  const { trabajoId } = await e.copias.importar(peticion)
  const fin = await esperarFin(e, trabajoId)
  if (fin.estado === 'error') throw Object.assign(new Error(fin.codigo), { codigo: fin.codigo })
  return fin.resultado as ResultadoImportacionIpc
}
