import { useEffect, useState } from 'react'
import type { EstadoPicos } from '@shared/ipc'
import { leerPicosBase, type ResultadoPicosBase } from '../editor/picosBase'

const ESPERA_GENERACION_MS = 1000

/**
 * Estado de los picos de voz de la canción (spec 05, feature 4): `null` mientras se pregunta. Si se están
 * generando, vuelve a preguntar hasta que terminen. Vuelve a preguntar al cambiar `separada` (la
 * separación acaba con la vista abierta) o al llegar `letras:encaje`.
 */
export function useEstadoPicos(cancionId: string, separada: boolean): EstadoPicos['estado'] | null {
  const [respuesta, setRespuesta] = useState<{
    clave: string
    estado: EstadoPicos['estado']
  } | null>(null)
  const [revision, setRevision] = useState(0)
  const clave = `${cancionId}:${separada}:${revision}`
  useEffect(() => window.shinobi.letras?.alEncaje?.(() => setRevision((n) => n + 1)), [])
  useEffect(() => {
    let vigente = true
    let espera: ReturnType<typeof setTimeout> | undefined
    const preguntar = async (): Promise<void> => {
      let estado: EstadoPicos['estado']
      try {
        estado = (await window.shinobi.picos.solicitar(cancionId)).estado
      } catch {
        estado = 'error'
      }
      if (!vigente) return
      setRespuesta({ clave, estado })
      if (estado === 'generando') espera = setTimeout(() => void preguntar(), ESPERA_GENERACION_MS)
    }
    void preguntar()
    return () => {
      vigente = false
      clearTimeout(espera)
    }
  }, [cancionId, clave])
  return respuesta?.estado ?? null
}

/**
 * Nivel base de los picos (bloques de 10 ms) de la canción para evaluar el encaje en el renderer.
 * `null` mientras se lee o si no está habilitado. Con picos en preparación vuelve a leer hasta que acaben.
 */
export function usePicosBase(
  cancionId: string,
  duracionMs: number,
  habilitada: boolean,
  separada: boolean
): ResultadoPicosBase | null {
  const [respuesta, setRespuesta] = useState<{
    clave: string
    picos: ResultadoPicosBase
  } | null>(null)
  const [revision, setRevision] = useState(0)
  const clave = `${cancionId}:${duracionMs}:${separada}:${revision}`
  useEffect(() => window.shinobi.letras?.alEncaje?.(() => setRevision((n) => n + 1)), [])
  useEffect(() => {
    if (!habilitada || duracionMs <= 0) return
    const control = new AbortController()
    let espera: ReturnType<typeof setTimeout> | undefined
    const leer = async (): Promise<void> => {
      let picos: ResultadoPicosBase
      try {
        picos = await leerPicosBase(window.shinobi, cancionId, duracionMs, {
          signal: control.signal
        })
      } catch {
        picos = { estado: 'error' }
      }
      if (control.signal.aborted) return
      setRespuesta({ clave, picos })
      if (picos.estado === 'generando') espera = setTimeout(() => void leer(), ESPERA_GENERACION_MS)
    }
    void leer()
    return () => {
      control.abort()
      clearTimeout(espera)
    }
  }, [cancionId, duracionMs, habilitada, clave])
  return habilitada ? (respuesta?.picos ?? null) : null
}
