import { open, realpath } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import type { PeticionPicos } from '../../shared/ipc'

const CABECERA = 24
const BYTES_PAR = 4

interface Nivel {
  offset: number
  bloques: number
  pasoMs: number
}

interface FormatoPicos {
  duracionMs: number
  niveles: Nivel[]
}

async function validar(archivo: FileHandle): Promise<FormatoPicos | null> {
  const cabecera = Buffer.alloc(CABECERA)
  if ((await archivo.read(cabecera, 0, CABECERA, 0)).bytesRead !== CABECERA) return null
  if (cabecera.toString('ascii', 0, 4) !== 'SKPV' || cabecera.readUInt32LE(4) !== 1) return null
  const frecuencia = cabecera.readUInt32LE(8)
  const muestras = cabecera.readBigUInt64LE(12)
  let bloques = cabecera.readUInt32LE(20)
  if (!bloques || frecuencia < 100) return null
  const frecuenciaBig = BigInt(frecuencia)
  if (
    muestras <= (BigInt(bloques - 1) * frecuenciaBig) / 100n ||
    muestras > (BigInt(bloques) * frecuenciaBig) / 100n
  ) return null

  let offset = CABECERA
  let pasoMs = 10
  const niveles: Nivel[] = []
  while (true) {
    niveles.push({ offset, bloques, pasoMs })
    offset += bloques * BYTES_PAR
    if (bloques === 1) break
    bloques = Math.ceil(bloques / 2)
    pasoMs *= 2
  }
  const datos = await archivo.stat()
  if (!datos.isFile() || datos.size !== offset) return null
  return { duracionMs: (Number(muestras) / frecuencia) * 1000, niveles }
}

export async function conPicos<T>(
  ruta: string,
  usar: (archivo: FileHandle, formato: FormatoPicos) => Promise<T>
): Promise<T | null> {
  try {
    if ((await realpath(ruta)) !== ruta) return null
    const archivo = await open(ruta, 'r')
    try {
      const formato = await validar(archivo)
      return formato ? await usar(archivo, formato) : null
    } finally {
      await archivo.close()
    }
  } catch {
    return null
  }
}

/** Lee únicamente los pares del nivel más detallado que entra en el presupuesto. */
export async function leerVentana(
  archivo: FileHandle,
  formato: FormatoPicos,
  { inicioMs, finMs, presupuesto }: PeticionPicos
): Promise<{ primerBloque: number; pasoMs: number; bytes: Uint8Array } | null> {
  if (inicioMs >= formato.duracionMs) return null
  const fin = Math.min(finMs, formato.duracionMs)
  for (const { offset, bloques, pasoMs } of formato.niveles) {
    const primerBloque = Math.floor(inicioMs / pasoMs)
    const ultimo = Math.min(bloques, Math.ceil(fin / pasoMs))
    const cantidad = ultimo - primerBloque
    if (cantidad < 1) return null
    if (cantidad > presupuesto) continue
    const bytes = new Uint8Array(cantidad * BYTES_PAR)
    const { bytesRead } = await archivo.read(
      bytes, 0, bytes.length, offset + primerBloque * BYTES_PAR
    )
    return bytesRead === bytes.length ? { primerBloque, pasoMs, bytes } : null
  }
  return null
}
