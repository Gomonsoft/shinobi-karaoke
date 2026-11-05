import { z } from 'zod'
import { BLOQUES_SEPARACION, DISPOSITIVOS_SEPARACION, ERRORES_SEPARAR } from './protocolo'

/**
 * Doble del separador (tarea 0059; lo implementa 0060).
 *
 * `SHINOBI_SEPARADOR_FALSO=<ruta a escenario.json>`: el comando `separar` del worker no carga
 * audio-separator ni el modelo: sigue el escenario y escribe `voz.flac` e `instrumental.flac`
 * sintéticos. Misma regla que `SHINOBI_YTDLP_FALSO`: el main solo pasa la variable sin empaquetar
 * (empaquetada la elimina del entorno). Junto a ella el main pasa `SHINOBI_INTENTO=<n>` (1, 2 o 3), solo
 * con el doble, para que el escenario pueda fallar en un intento concreto.
 *
 * Ejemplo: separa en 3 s con 30 pasos y falla con falta de memoria en el primer intento con CUDA:
 *
 *   {
 *     "segundos": 3,
 *     "pasos": 30,
 *     "fallos": [
 *       { "cuando": { "dispositivo": "cuda", "intento": 1 }, "codigo": "MEMORIA_INSUFICIENTE", "reintentable": true }
 *     ]
 *   }
 *
 * - `segundos`: duración total simulada de la fase `separando`; `pasos`: eventos `detalle.paso`.
 * - `fallos`: el primero cuyo `cuando` coincide (todas las claves presentes) hace fallar el comando
 *   con ese código. Sin `cuando` o con `{}` coincide siempre.
 * - `morir_con_sigkill`: el proceso se mata con SIGKILL a mitad, sin línea de error (`PROCESO_TERMINADO`).
 */
export const ENV_SEPARADOR_FALSO = 'SHINOBI_SEPARADOR_FALSO'
export const ENV_INTENTO = 'SHINOBI_INTENTO'

export const intentoSchema = z.number().int().min(1).max(3)

export const escenarioSeparadorSchema = z.strictObject({
  segundos: z.number().nonnegative(),
  pasos: z.number().int().positive(),
  fallos: z
    .array(
      z.strictObject({
        cuando: z.strictObject({
          bloques: z.enum(BLOQUES_SEPARACION).optional(),
          dispositivo: z.enum(DISPOSITIVOS_SEPARACION).optional(),
          intento: intentoSchema.optional()
        }),
        codigo: z.enum(ERRORES_SEPARAR),
        reintentable: z.boolean()
      })
    )
    .optional(),
  morir_con_sigkill: z.boolean().optional()
})

export type EscenarioSeparador = z.infer<typeof escenarioSeparadorSchema>
