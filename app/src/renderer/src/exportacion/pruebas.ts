import { estiloPredeterminado } from '@shared/estilo'
import { DESTINO_HEREDAR_PROVISIONAL, type ApiShinobi, type CancionIpc } from '@shared/ipc'
import {
  crearApiExportacionFalsa,
  type ApiExportacionFalsa
} from '@shared/__fixtures__/exportacion'
import { lista } from '@shared/__fixtures__'

/** Solo pruebas: `biblioteca.obtener` con la apariencia resuelta añadida. */
export function cancionIpcDePrueba(sobrescribir: Partial<CancionIpc> = {}): CancionIpc {
  return {
    ...lista(),
    resuelta: {
      estilo: estiloPredeterminado(),
      procedencia: 'incluido',
      temaId: null,
      temaNombre: null,
      alHeredar: DESTINO_HEREDAR_PROVISIONAL,
      procedenciaEspera: 'incluido'
    },
    ...sobrescribir
  } as CancionIpc
}

interface Opciones {
  exportacion?: ApiExportacionFalsa
  cancion?: CancionIpc | null
  /** `config.exportacion` guardado (opciones recordadas). */
  config?: Record<string, unknown>
  /** Resto de `window.shinobi` (se mezcla). */
  extra?: Record<string, unknown>
}

/** Solo pruebas: instala `window.shinobi` con la API falsa de exportación y una canción. */
export function instalarApiExportacion({
  exportacion = crearApiExportacionFalsa(),
  cancion = cancionIpcDePrueba(),
  config = {},
  extra = {}
}: Opciones = {}): ApiExportacionFalsa {
  ;(window as unknown as { shinobi: Partial<ApiShinobi> }).shinobi = {
    biblioteca: { obtener: () => Promise.resolve(cancion) },
    config: { obtener: () => Promise.resolve({ exportacion: config }) },
    exportacion: exportacion.api,
    ...extra
  } as unknown as Partial<ApiShinobi>
  return exportacion
}
