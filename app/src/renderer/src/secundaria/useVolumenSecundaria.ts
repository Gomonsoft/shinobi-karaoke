import { useCallback, useEffect, useRef, useState } from 'react'
import type { PreferenciasSecundaria } from '@shared/config'
import type { ApiReproductor } from '@shared/ipc'
import type { useVolumenCompartido } from '../karaoke/useVolumenCompartido'

type Volumen = Required<PreferenciasSecundaria>
export type VolumenSesion = ReturnType<typeof useVolumenCompartido>

const ESCRITURA_MS = 500

function soloSonido(r: Volumen): Volumen {
  return {
    volumen: r.volumen,
    silenciado: r.silenciado,
    voz_guia: r.voz_guia,
    voz_guia_silenciada: r.voz_guia_silenciada
  }
}

/**
 * Misma lógica que `useVolumenCompartido` (escritura diferida, como mucho cada 500 ms), pero sin
 * `config.*`: la secundaria lee `sesion.preferencias()` y escribe con `sesion.guardarPreferencias`.
 * Devuelve `null` hasta tener las preferencias, para no arrancar el motor con valores ajenos.
 */
export function useVolumenSecundaria(api: ApiReproductor): VolumenSesion | null {
  const [valores, setValores] = useState<Volumen | null>(null)
  const actual = useRef<Volumen | null>(null)
  const pendiente = useRef(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const escribir = useCallback(() => {
    temporizador.current = undefined
    if (!pendiente.current || !actual.current) return
    pendiente.current = false
    void api.sesion.guardarPreferencias(actual.current).catch(() => undefined)
  }, [api])

  useEffect(() => {
    let vivo = true
    const recibir = (r: Volumen) => {
      // Un cambio propio todavía sin escribir manda sobre lo que llegue de fuera.
      if (!vivo || pendiente.current) return
      actual.current = soloSonido(r)
      setValores(actual.current)
    }
    const baja = api.alPreferencias(recibir)
    void api.sesion
      .preferencias()
      .then((r) => {
        if (actual.current === null) recibir(r)
      })
      .catch(() => undefined)
    return () => {
      vivo = false
      baja()
      clearTimeout(temporizador.current)
      escribir()
    }
  }, [api, escribir])

  const cambiar = useCallback(
    (cambio: Partial<Volumen>) => {
      if (!actual.current) return
      actual.current = { ...actual.current, ...cambio }
      pendiente.current = true
      setValores(actual.current)
      temporizador.current ??= setTimeout(escribir, ESCRITURA_MS)
    },
    [escribir]
  )

  if (!valores) return null
  return {
    volumen: valores.volumen,
    silenciado: valores.silenciado,
    volumenVoz: valores.voz_guia,
    vozSilenciada: valores.voz_guia_silenciada,
    cambiar
  }
}
