import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { configPredeterminada, manifiestoSchema, type Config, type Manifiesto } from '../../shared'
import { FIXTURES } from '../../shared/__fixtures__'
import { ServicioBiblioteca } from '../biblioteca'
import type { ConfigParcial } from '../configuracion'

export const manifiesto: Manifiesto = manifiestoSchema.parse(
  JSON.parse(
    readFileSync(resolve(__dirname, '..', '..', '..', 'resources', 'runtime-manifest.json'), 'utf8')
  )
)

/** Configuración en memoria con la instalación completa (perfil `cpu`). */
export function configEnMemoria(parcial: ConfigParcial = {}) {
  let c: Config = configPredeterminada()
  c.instalacion = { ...c.instalacion, estado: 'completa', perfil_hardware: 'cpu' }
  const aplicar = (
    base: Record<string, unknown>,
    p: Record<string, unknown>
  ): Record<string, unknown> => {
    const s = { ...base }
    for (const [k, v] of Object.entries(p)) {
      s[k] =
        v && typeof v === 'object' && !Array.isArray(v)
          ? aplicar((base[k] ?? {}) as Record<string, unknown>, v as Record<string, unknown>)
          : v
    }
    return s
  }
  c = aplicar(c as never, parcial as never) as unknown as Config
  return {
    obtener: (): Config => c,
    actualizar: (p: ConfigParcial): Promise<void> => {
      c = aplicar(c as never, p as never) as unknown as Config
      return Promise.resolve()
    }
  }
}

/** Datos temporales con una canción con la fuente completada (y la mezcla si `conMezcla`). */
export async function cancionConFuente(
  biblioteca: ServicioBiblioteca,
  datos: string,
  opciones: { duracionMs?: number; mezcla?: Buffer | null } = {}
): Promise<string> {
  const b = FIXTURES.borradorRecienCreado()
  const { id } = await biblioteca.crear({
    metadatos: { ...b.metadatos, duracion_ms: opciones.duracionMs ?? 60_000 },
    fuente: b.fuente,
    pasos: { fuente: { estado: 'completado', actualizado: new Date().toISOString(), error: null } }
  })
  if (opciones.mezcla !== null) {
    await mkdir(join(datos, 'biblioteca', id, 'fuente'), { recursive: true })
    await writeFile(join(datos, 'biblioteca', id, 'fuente', 'mezcla.flac'), opciones.mezcla ?? 'x')
  }
  return id
}

export const nuevoDirDatos = async (): Promise<string> => {
  const d = await mkdtemp(join(tmpdir(), 'shinobi-sep-'))
  await mkdir(join(d, 'biblioteca'), { recursive: true })
  return d
}
