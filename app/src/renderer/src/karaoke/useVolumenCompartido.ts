import { useCallback, useEffect, useRef, useState } from 'react'
import type { Config } from '@shared/config'

type Volumen = Config['reproductor']

export function useVolumenCompartido(inicial: Volumen) {
  const [reproductor, setReproductor] = useState(inicial)
  const actual = useRef(inicial)
  const pendiente = useRef(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const escribir = useCallback(() => {
    temporizador.current = undefined
    if (!pendiente.current) return
    pendiente.current = false
    void window.shinobi.config.actualizar({ reproductor: actual.current }).catch(() => undefined)
  }, [])

  useEffect(
    () => () => {
      clearTimeout(temporizador.current)
      escribir()
    },
    [escribir]
  )

  const cambiar = useCallback(
    (cambio: Partial<Volumen>) => {
      const actualizado = { ...actual.current, ...cambio }
      actual.current = actualizado
      pendiente.current = true
      setReproductor(actualizado)
      temporizador.current ??= setTimeout(escribir, 500)
    },
    [escribir]
  )

  return {
    volumen: reproductor.volumen,
    silenciado: reproductor.silenciado,
    volumenVoz: reproductor.voz_guia,
    vozSilenciada: reproductor.voz_guia_silenciada,
    cambiar
  }
}
