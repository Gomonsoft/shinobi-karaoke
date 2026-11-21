import { useEffect, useId, useState } from 'react'
import { TRANSICION_S } from '@shared/config'
import { mostrarToast } from '../../componentes/gestorToasts'
import { detallesDeError } from '../biblioteca/errores'
import estilos from './ajustes.module.css'
import { AJREP, OPCIONES_CUENTA_S } from './textos'
import { copiarDetalles } from '../../soporte/detalles'

/** Valores del selector: la lista fija más el valor guardado si es válido y no está en ella. */
export function opcionesCuenta(valor: number): number[] {
  const lista: number[] = [...OPCIONES_CUENTA_S]
  if (!lista.includes(valor) && valor >= TRANSICION_S.min && valor <= TRANSICION_S.max) {
    lista.push(valor)
    lista.sort((a, b) => a - b)
  }
  return lista
}

/**
 * Sección «Reproductor» (`ux/08`, fase 4): duración de la cuenta entre canciones de la cola. Se
 * guarda al elegir; si falla, vuelve al valor anterior y avisa con un toast.
 */
export function ReproductorAjustes() {
  const [valor, setValor] = useState<number>(TRANSICION_S.defecto)
  const idTitulo = useId()
  const idSelector = useId()
  const idAyuda = useId()

  useEffect(() => {
    let activo = true
    window.shinobi.config.obtener().then(
      (c) => activo && setValor(c.reproductor.transicion_s),
      () => undefined
    )
    return () => {
      activo = false
    }
  }, [])

  const elegir = async (nuevo: number) => {
    const anterior = valor
    setValor(nuevo)
    try {
      await window.shinobi.config.actualizar({ reproductor: { transicion_s: nuevo } })
    } catch (err) {
      setValor(anterior)
      mostrarToast({
        tipo: 'error',
        mensaje: AJREP.errorGuardar,
        accion: {
          etiqueta: AJREP.copiar,
          alAccionar: () => void copiarDetalles(detallesDeError(err))
        }
      })
    }
  }

  return (
    <div className={estilos.seccion} role="group" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className={estilos.subtitulo}>
        {AJREP.titulo}
      </h2>
      <label htmlFor={idSelector}>{AJREP.cuenta}</label>
      <select
        id={idSelector}
        className={estilos.selector}
        aria-describedby={idAyuda}
        value={valor}
        onChange={(e) => void elegir(Number(e.target.value))}
      >
        {opcionesCuenta(valor).map((n) => (
          <option key={n} value={n}>
            {n === TRANSICION_S.defecto ? AJREP.opcionPredeterminada(n) : AJREP.opcion(n)}
          </option>
        ))}
      </select>
      <p id={idAyuda} className={estilos.suave}>
        {AJREP.ayuda}
      </p>
    </div>
  )
}
