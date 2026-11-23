import { useEffect, useRef, useState } from 'react'
import type { TandaPreparacionIpc } from '@shared/ipc'
import { COLA, pausaDelUsuario, textoResultado } from './cola'

/** Como mucho un anuncio de progreso cada 10 s (docs/ux/04 · «Lectores de pantalla»). */
export const INTERVALO_ANUNCIO_MS = 10_000

/**
 * Texto para la región `role="status"` de la cola: cada canción que termina (agrupadas cada 10 s) y, siempre
 * y al momento, la pausa, la reanudación, las paradas automáticas y el resumen final.
 */
export function useAnuncioCola(
  tanda: TandaPreparacionIpc | null,
  nombreDe: (id: string) => string,
  busquedaAutomatica: boolean
): string {
  const [texto, setTexto] = useState('')
  const vistos = useRef(new Set<string>())
  const ultimo = useRef(0)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const antes = useRef<{ pausa: boolean; parada: string | null; fin: boolean } | null>(null)
  const nombre = useRef(nombreDe)
  useEffect(() => {
    nombre.current = nombreDe
  })

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    },
    []
  )

  useEffect(() => {
    if (!tanda || tanda.total < 2) {
      vistos.current.clear()
      antes.current = null
      return
    }
    const pausa = pausaDelUsuario(tanda)
    const parada = tanda.motivoPausa ?? tanda.descargasParadas
    const fin = tanda.terminadas >= tanda.total
    const previo = antes.current
    antes.current = { pausa, parada, fin }
    const ahora = (t: string): void => {
      ultimo.current = Date.now()
      setTexto(t)
    }
    if (previo && !previo.fin && fin) {
      vistos.current = new Set(tanda.canciones.filter((c) => c.resultado !== null).map((c) => c.id))
      ahora(COLA.tituloFin(tanda.total))
      return
    }
    if (previo && previo.pausa !== pausa) {
      ahora(pausa ? COLA.anuncioPausa : COLA.anuncioReanudada)
      return
    }
    if (previo && parada !== null && previo.parada !== parada) {
      ahora(COLA.botonParada(Math.max(0, tanda.total - tanda.terminadas)))
      return
    }
    const nuevas = tanda.canciones.filter((c) => c.resultado !== null && !vistos.current.has(c.id))
    if (nuevas.length === 0) return
    for (const c of nuevas) vistos.current.add(c.id)
    if (!previo) return // la primera lectura no anuncia lo que ya estaba hecho
    const c = nuevas[nuevas.length - 1]!
    const anunciar = (): void => {
      ahora(
        COLA.anuncio(
          tanda.terminadas,
          tanda.total,
          nombre.current(c.id),
          textoResultado(c, busquedaAutomatica)
        )
      )
    }
    const espera = INTERVALO_ANUNCIO_MS - (Date.now() - ultimo.current)
    if (temporizador.current) clearTimeout(temporizador.current)
    if (espera <= 0) anunciar()
    else temporizador.current = setTimeout(anunciar, espera)
  }, [tanda, busquedaAutomatica])

  return texto
}
