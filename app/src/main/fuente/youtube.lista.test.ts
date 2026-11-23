import { describe, expect, it, vi } from 'vitest'
import { configPredeterminada } from '../../shared'
import { ServicioYoutube, type DependenciasYoutube } from './youtube'

/** El álbum propuesto sale de la lista del `list=` de la URL, no de «la última lista leída» (0375). */
const LISTA_A = 'OLAK5uy_inventadoAA'
const LISTA_B = 'OLAK5uy_inventadoBB'
const lista = (titulo: string) => ({
  titulo,
  tipo: 'album',
  recortada: false,
  entradas: [{ id: 'aaaaaaaaaaa', titulo: 'x', canal: '', duracion_s: 10, disponible: true }]
})
const video = (id: string) => ({
  id_video: id,
  titulo_original: 'Tema',
  canal: 'Grupo Inventado',
  duracion_s: 10,
  metadatos: { titulo: 'Tema', artista: 'Grupo Inventado', album: '' }
})

describe('álbum de una lista por su id', () => {
  it('con dos listas leídas, cada vídeo toma el álbum de la suya', async () => {
    const ejecutar = vi.fn((comando: string, args: Record<string, unknown>) => {
      if (comando === 'info-lista-youtube') {
        return Promise.resolve(
          String(args.url).includes(LISTA_A) ? lista('Album - Disco A') : lista('Album - Disco B')
        )
      }
      return Promise.resolve(video('aaaaaaaaaaa'))
    }) as unknown as DependenciasYoutube['ejecutar']
    const servicio = new ServicioYoutube({
      biblioteca: {},
      gestor: { encolar: vi.fn(), listar: () => [] },
      ejecutar,
      config: {
        obtener: () => ({
          ...configPredeterminada(),
          aviso_youtube_aceptado: '2026-01-01T00:00:00Z',
          aviso_youtube_listas_aceptado: '2026-01-01T00:00:00Z'
        })
      },
      dirDatos: '/nada'
    } as unknown as DependenciasYoutube)
    await servicio.leerLista(`https://www.youtube.com/playlist?list=${LISTA_A}`)
    await servicio.leerLista(`https://www.youtube.com/playlist?list=${LISTA_B}`)
    const deA = await servicio.info(`https://www.youtube.com/watch?v=aaaaaaaaaaa&list=${LISTA_A}`)
    expect(deA.datos.album).toMatchObject({ valor: 'Disco A', origen: 'lista' })
    const deB = await servicio.info(`https://www.youtube.com/watch?v=aaaaaaaaaaa&list=${LISTA_B}`)
    expect(deB.datos.album.valor).toBe('Disco B')
    // Sin `list=` (o de una lista no leída) no se propone álbum.
    const sin = await servicio.info('https://www.youtube.com/watch?v=aaaaaaaaaaa')
    expect(sin.datos.album.valor).toBe('')
    const otra = await servicio.info(
      'https://www.youtube.com/watch?v=aaaaaaaaaaa&list=OLAK5uy_noLeidaCC'
    )
    expect(otra.datos.album.valor).toBe('')
  })
})
