import { useEffect, useState } from 'react'
import type { ResumenCancionIpc } from '@shared/ipc'
import { useBibliotecaCompartida } from '../useBiblioteca'

/**
 * Las canciones de la biblioteca: la lectura compartida de `App` o, fuera de ella (pruebas sueltas), una
 * propia con `biblioteca.listar()`. `null` mientras carga.
 */
export function useResumenes(): ResumenCancionIpc[] | null {
  const compartida = useBibliotecaCompartida()
  const [propias, setPropias] = useState<ResumenCancionIpc[] | null>(null)
  useEffect(() => {
    if (compartida || typeof window.shinobi.biblioteca?.listar !== 'function') return
    let vivo = true
    window.shinobi.biblioteca.listar().then(
      (l) => vivo && setPropias(l),
      () => vivo && setPropias([])
    )
    return () => {
      vivo = false
    }
  }, [compartida])
  if (compartida) return compartida.estado === 'listo' ? compartida.canciones : null
  return propias
}

/** `Lista`, `Letra lista`, `Borrador` o `Dañada` (estado de la lista de «Exportar paquete»). */
export function textoEstado(c: ResumenCancionIpc): string {
  if (c.danada) return 'Dañada'
  if (c.estado === 'lista') return c.modalidad === 'letra_lista' ? 'Letra lista' : 'Lista'
  return 'Borrador'
}

/** Pasos con un trabajo en curso: la canción entra «como está ahora» (`paq.nota.enCurso`). */
export const estaProcesando = (c: ResumenCancionIpc): boolean =>
  c.pasos !== null && Object.values(c.pasos).some((p) => p.estado === 'en_curso')

export const estaSeparando = (c: ResumenCancionIpc): boolean =>
  c.pasos?.separacion.estado === 'en_curso'

/** Sin pistas todavía (`paq.nota.sinAudio`). */
export const sinAudio = (c: ResumenCancionIpc): boolean =>
  !c.danada && c.pasos !== null && c.pasos.separacion.estado !== 'completado'
