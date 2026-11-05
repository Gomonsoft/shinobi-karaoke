import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { ElementoLetra } from '@shared/letra'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { TEXTO_SUSTITUIR } from './textosPegar'

/** Lo que la canción tiene ahora, para decidir si hay que confirmar la sustitución. */
export interface LetraExistente {
  lineas: number
  conSincronia: boolean
}

export function existenteDe(
  elementos: readonly ElementoLetra[] | null | undefined
): LetraExistente {
  const lineas = (elementos ?? []).filter((e) => e.tipo === 'linea')
  return { lineas: lineas.length, conSincronia: lineas.some((e) => e.inicio_ms !== null) }
}

export type ConfirmarSustituir = () => Promise<boolean>

/**
 * Confirmación de sustituir (spec 05, criterio 16): sin diálogo con 0 líneas; con ≥ 1 línea,
 * `let.dialogo.sustituir` si alguna tiene inicio y `let.dialogo.sustituirTexto` si no.
 */
export function useConfirmarSustituir(existente: LetraExistente): {
  confirmar: ConfirmarSustituir
  dialogo: ReactNode
} {
  const idDescripcion = useId()
  const [abierto, setAbierto] = useState(false)
  const resolver = useRef<((ok: boolean) => void) | null>(null)
  const actual = useRef(existente)
  useEffect(() => {
    actual.current = existente
  })

  const confirmar = useCallback<ConfirmarSustituir>(() => {
    if (actual.current.lineas < 1) return Promise.resolve(true)
    return new Promise<boolean>((resolve) => {
      resolver.current?.(false)
      resolver.current = resolve
      setAbierto(true)
    })
  }, [])

  const cerrar = (ok: boolean): void => {
    setAbierto(false)
    resolver.current?.(ok)
    resolver.current = null
  }

  const dialogo = (
    <Dialogo
      abierto={abierto}
      titulo={TEXTO_SUSTITUIR.titulo}
      descripcionId={idDescripcion}
      enfoqueInicial="[data-cancelar]"
      onCancelar={() => cerrar(false)}
      acciones={
        <>
          <Boton variante="fantasma" data-cancelar onClick={() => cerrar(false)}>
            {TEXTO_SUSTITUIR.cancelar}
          </Boton>
          <Boton variante="destructivo" onClick={() => cerrar(true)}>
            {TEXTO_SUSTITUIR.sustituir}
          </Boton>
        </>
      }
    >
      <p id={idDescripcion}>
        {existente.conSincronia ? TEXTO_SUSTITUIR.conSincronia : TEXTO_SUSTITUIR.sinSincronia}
      </p>
    </Dialogo>
  )
  return { confirmar, dialogo }
}
