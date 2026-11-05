import { useRef, useState } from 'react'
import type { ElementoLetra } from '@shared/letra'
import type { ResumenCancionIpc } from '@shared/ipc'
import { mostrarToast } from '../../componentes/gestorToasts'
import type { ConfirmarSustituir } from './sustituir'
import { TEXTO } from './textos'
import { TEXTO_IMPORTAR } from './textosPegar'

/**
 * "Importar archivo .lrc o .txt" (A, B y C): `leerArchivo` → confirmar → `guardar`. Si el
 * archivo trae renglones ignorados, `onGuardada` los recibe para que C los avise.
 */
export function useImportarArchivo(
  cancionId: string,
  confirmar: ConfirmarSustituir,
  onGuardada: (resumen: ResumenCancionIpc, lineas: ElementoLetra[], ignoradas: number) => void
): { importar: () => Promise<void>; errorArchivo: boolean } {
  const [errorArchivo, setErrorArchivo] = useState(false)
  const ocupado = useRef(false)

  const importar = async (): Promise<void> => {
    if (ocupado.current) return
    ocupado.current = true
    setErrorArchivo(false)
    try {
      const archivo = await window.shinobi.letras.leerArchivo().catch((err: unknown) => {
        const codigo = (err as { codigo?: unknown } | null)?.codigo
        if (codigo === 'ARCHIVO_SIN_LETRA') setErrorArchivo(true)
        else mostrarToast({ tipo: 'error', mensaje: TEXTO_IMPORTAR.errorLeer })
        return null
      })
      if (!archivo || archivo.cancelado) return
      if (!(await confirmar())) return
      const resumen = await window.shinobi.letras.guardar({
        cancionId,
        origen: 'archivo',
        lrclib_id: null,
        lineas: archivo.lineas
      })
      onGuardada(resumen, archivo.lineas, archivo.ignoradas)
    } catch {
      mostrarToast({ tipo: 'error', mensaje: TEXTO.errorGuardar })
    } finally {
      ocupado.current = false
    }
  }
  return { importar, errorArchivo }
}
