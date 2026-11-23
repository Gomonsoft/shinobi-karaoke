import { z } from 'zod'
export {
  analizarUrlLista,
  tipoDeLista,
  type ResultadoUrlLista,
  type TipoLista
} from '../../shared/listaYoutube'

/** Tope de entradas de una lista que se devuelven (como las filas de un lote, ADR 0026 §1). */
export const MAX_ENTRADAS_LISTA = 500

/** `info-lista-youtube` (worker, tarea 0313). */
export const resultadoInfoListaSchema = z.object({
  titulo: z.string(),
  tipo: z.enum(['lista', 'album']),
  entradas: z.array(
    z.object({
      id: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
      titulo: z.string(),
      canal: z.string(),
      duracion_s: z.number().nonnegative().nullable(),
      disponible: z.boolean(),
      problema: z.enum(['no_disponible', 'directo']).nullable().default(null)
    })
  ),
  recortada: z.boolean()
})
export type ResultadoInfoLista = z.infer<typeof resultadoInfoListaSchema>

/** `leer-etiquetas` (worker, tarea 0313): un archivo ilegible sale con `ok: false`, no hace fallar el comando. */
export const resultadoLeerEtiquetasSchema = z.object({
  archivos: z.array(
    z.discriminatedUnion('ok', [
      z.object({
        ruta: z.string(),
        ok: z.literal(true),
        duracion_ms: z.number().int().nonnegative().nullable(),
        etiquetas: z.object({
          title: z.string().default(''),
          artist: z.string().default(''),
          album: z.string().default(''),
          album_artist: z.string().default(''),
          track: z.string().default(''),
          date: z.string().default('')
        })
      }),
      z.object({ ruta: z.string(), ok: z.literal(false), codigo: z.string() })
    ])
  )
})
export type ResultadoLeerEtiquetas = z.infer<typeof resultadoLeerEtiquetasSchema>
