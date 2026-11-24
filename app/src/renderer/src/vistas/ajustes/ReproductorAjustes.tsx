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
  const [subrayar, setSubrayar] = useState(false)
  const idSubrayado = useId()
  const idAyudaSubrayado = useId()
  const idTitulo = useId()
  const idSelector = useId()
  const idAyuda = useId()

  useEffect(() => {
    let activo = true
    window.shinobi.config.obtener().then(
      (c) => {
        if (!activo) return
        setValor(c.reproductor.transicion_s)
        setSubrayar(c.reproductor.subrayar_cantado)
      },
      () => undefined
    )
    return () => {
      activo = false
    }
  }, [])

  const alternarSubrayado = async (nuevo: boolean) => {
    const anterior = subrayar
    setSubrayar(nuevo)
    try {
      await window.shinobi.config.actualizar({ reproductor: { subrayar_cantado: nuevo } })
    } catch (err) {
      setSubrayar(anterior)
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
      <label htmlFor={idSubrayado} className={estilos.casilla}>
        <input
          id={idSubrayado}
          type="checkbox"
          aria-describedby={idAyudaSubrayado}
          checked={subrayar}
          onChange={(e) => void alternarSubrayado(e.target.checked)}
        />
        {AJREP.subrayado}
      </label>
      <p id={idAyudaSubrayado} className={estilos.suave}>
        {AJREP.subrayadoAyuda}
      </p>
    </div>
  )
}
