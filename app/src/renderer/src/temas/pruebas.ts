import type { ApiShinobi, ImpactoIpc, OrigenAparienciaIpc } from '@shared/ipc'
import { ID_TEMA_PRUEBA, impactoPrueba, type TemasFalsos } from '../vistas/biblioteca/temasFalsos'

/** Ayudas de las pruebas de `temas/` (no se empaquetan: solo las importan los `*.test.*`). */

export function instalar(t: TemasFalsos): void {
  window.shinobi = {
    temas: t.api.temas,
    alCambiarTemas: t.api.alCambiarTemas
  } as unknown as ApiShinobi
}

export const origen = (
  procedencia: OrigenAparienciaIpc['procedencia'],
  temaNombre: string | null = null,
  temaId: string | null = temaNombre ? ID_TEMA_PRUEBA : null
): OrigenAparienciaIpc => ({ procedencia, temaId, temaNombre })

type Afectada = ImpactoIpc['afectadas'][number]

export function afectada(id: string, cambios: Partial<Afectada> = {}): Afectada {
  return {
    id,
    titulo: `Canción ${id}`,
    artista: 'Queen',
    antes: origen('cancion', 'Noche ninja'),
    despues: origen('cancion', 'Noche ninja'),
    efecto: 'cambia',
    ...cambios
  }
}

export function impactoCon(n: number, cambios: Partial<ImpactoIpc> = {}): ImpactoIpc {
  return impactoPrueba({
    afectadas: Array.from({ length: n }, (_, i) => afectada(String(i + 1))),
    ...cambios
  })
}
