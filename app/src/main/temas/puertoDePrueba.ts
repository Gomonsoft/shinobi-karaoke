import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  estiloPredeterminado,
  type Apariencia,
  type Cancion,
  type Catalogo,
  type Estilo
} from '../../shared'
import { borradorRecienCreado, idDePrueba } from '../../shared/__fixtures__'
import { flush } from '../persistencia'
import { rutaCatalogo } from './catalogo'
import { ServicioTemas, type OpcionesServicioTemas, type PuertoCanciones } from './servicio'
import type { CancionIndice } from './usos'

/** Solo pruebas: biblioteca en memoria que cumple `PuertoCanciones`, con fallos inyectables. */
export class PuertoDePrueba implements PuertoCanciones {
  readonly canciones = new Map<string, Cancion>()
  /** Ids cuya próxima escritura falla (con `codigo` de error). */
  readonly fallan = new Set<string>()
  /** Ids escritos con éxito, en orden. */
  readonly escritas: string[] = []
  /** Efecto lateral entre escrituras (p. ej. modificar otra canción a mitad de un lote). */
  alEscribir: ((id: string) => void) | null = null
  /** Ids dañados (cancion.json ilegible): salen del índice como tales. */
  readonly danadas = new Set<string>()

  añadir(
    id: string,
    datos: {
      titulo?: string
      artista?: string
      album?: string | null
      apariencia?: Apariencia | undefined
      estilo?: Estilo
    } = {}
  ): void {
    const b = borradorRecienCreado()
    this.canciones.set(id, {
      ...b,
      id,
      metadatos: {
        ...b.metadatos,
        titulo: datos.titulo ?? id,
        artista: datos.artista ?? 'Nadie',
        album: datos.album ?? null
      },
      estilo: datos.estilo ?? estiloPredeterminado(),
      ...(datos.apariencia ? { apariencia: datos.apariencia } : {})
    })
  }

  indice(): readonly CancionIndice[] {
    return [...this.canciones.values()].map((c) => ({
      id: c.id,
      metadatos: c.metadatos,
      modificada: c.modificada,
      estilo: this.danadas.has(c.id) ? null : c.estilo,
      apariencia: c.apariencia,
      danada: this.danadas.has(c.id) ? 'json' : null
    }))
  }

  leer(id: string): Cancion | null {
    return this.canciones.get(id) ?? null
  }

  actualizar(id: string, mutador: (cancion: Cancion) => Cancion): Promise<void> {
    const c = this.canciones.get(id)
    if (!c)
      return Promise.reject(Object.assign(new Error('no existe'), { codigo: 'ERROR_INTERNO' }))
    if (this.fallan.has(id)) {
      return Promise.reject(Object.assign(new Error('fallo inyectado'), { codigo: 'SIN_ESPACIO' }))
    }
    this.canciones.set(id, mutador(structuredClone(c)))
    this.escritas.push(id)
    this.alEscribir?.(id)
    return Promise.resolve()
  }
}

export interface Montaje {
  servicio: ServicioTemas
  ruta: string
  /** Abre otro servicio sobre los mismos archivos (proceso nuevo). */
  reabrir(extra?: Partial<OpcionesServicioTemas>): Promise<ServicioTemas>
  limpiar(): Promise<void>
}

/** Solo pruebas: carpeta temporal con `temas.json` ya escrito y un `ServicioTemas` abierto. */
export async function montarServicio(
  catalogo: Catalogo,
  puerto: PuertoCanciones,
  extra: Partial<OpcionesServicioTemas> = {}
): Promise<Montaje> {
  const dir = await mkdtemp(join(tmpdir(), 'shinobi-operaciones-temas-'))
  const ruta = rutaCatalogo(dir)
  await writeFile(ruta, JSON.stringify(catalogo), 'utf8')
  let n = 0
  const abrir = (e: Partial<OpcionesServicioTemas>): Promise<ServicioTemas> =>
    ServicioTemas.abrir({
      dirBiblioteca: dir,
      puerto,
      estiloInicial: estiloPredeterminado(),
      ahora: () => '2026-11-09T12:00:00.000Z',
      nuevoId: () => idDePrueba(500 + ++n),
      ...e
    })
  return {
    servicio: await abrir(extra),
    ruta,
    reabrir: (e = {}) => abrir({ ...extra, ...e }),
    limpiar: async () => {
      await flush()
      await rm(dir, { recursive: true, force: true })
    }
  }
}

export const leerCatalogoEnDisco = async (ruta: string): Promise<Catalogo> =>
  JSON.parse(await readFile(ruta, 'utf8')) as Catalogo
