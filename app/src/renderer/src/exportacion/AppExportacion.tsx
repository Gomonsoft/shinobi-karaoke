import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { InicialExportacionIpc, FotogramaExportacionIpc } from '@shared/exportacion'
import type { ApiExportacion } from '@shared/ipc'
import { normalizarEstilo } from '@shared/estilo'
import { buscarFuente } from '@shared/fuentes'
import { fijarAnimaciones } from '../karaoke/animacionesPorFotograma'
import { PantallaLetra } from '../karaoke/PantallaLetra'
import type { FotogramaLetra } from '../karaoke/render'
import { fotogramasDeZonas, zonasDeLetra } from '../karaoke/zonas'
import { MarcaDeAgua } from './MarcaDeAgua'
import estilos from './exportacion.module.css'

export interface PropsAppExportacion {
  /** Por defecto, la API del preload (`window.shinobiExportacion`). */
  api?: ApiExportacion
}

declare global {
  interface Window {
    /** Solo en desarrollo: modelo del último fotograma pintado, para las pruebas (0241). */
    __fotogramaExportacion?: { n: number; fotograma: FotogramaLetra; fotogramas: FotogramaLetra[] }
  }
}

const dosFotogramas = (): Promise<void> =>
  new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver())))

const FAMILIA_MARCA = 'Atkinson Hyperlegible Next'

/**
 * Anfitrión de la ventana offscreen (ADR 0019 §2): main pide el fotograma `n`, se pinta con el
 * mismo `PantallaLetra` del reproductor en el instante `n × 1000 / fps` y se confirma con
 * `listo({ n })` tras dos `requestAnimationFrame`.
 */
export function AppExportacion({ api = window.shinobiExportacion }: PropsAppExportacion) {
  const [inicial, setInicial] = useState<InicialExportacionIpc | null>(null)
  const [n, setN] = useState(0)
  // Se cumple cuando el primer `inicial` ya está montado: los fotogramas que lleguen antes esperan.
  const [montado] = useState(() => {
    let resolver = (): void => undefined
    const promesa = new Promise<void>((res) => {
      resolver = res
    })
    return { promesa, resolver }
  })
  const datos = useRef<InicialExportacionIpc | null>(null)

  useEffect(() => {
    let activo = true
    // Primero se escucha y luego se pide `inicial`: main solo envía fotogramas tras esa llamada.
    const baja = api.alFotograma((peticion: FotogramaExportacionIpc) => {
      void (async () => {
        await montado.promesa
        const d = datos.current
        if (!activo || !d || peticion.trabajoId !== d.trabajoId) return
        flushSync(() => setN(peticion.n))
        const tAudioMs = (peticion.n * 1000) / d.fps
        fijarAnimaciones(tAudioMs)
        await dosFotogramas()
        if (import.meta.env.DEV) {
          const { instantanea } = d
          const pantalla = normalizarEstilo(instantanea.estilo).pantalla
          const letra = instantanea.letra
          const fotogramas = fotogramasDeZonas(
            zonasDeLetra(letra, { zonas: pantalla.zonas, duracionMs: instantanea.duracionMs }),
            letra,
            tAudioMs - letra.offset_ms,
            {
              duracionMs: instantanea.duracionMs,
              titulo: instantanea.titulo,
              artista: instantanea.artista,
              espera: instantanea.estilo.espera,
              pantalla,
              movimiento: 'completo'
            }
          )
          // `fotograma` es el de la primera zona (el único sin reparto); `fotogramas`, el de todas.
          window.__fotogramaExportacion = { n: peticion.n, fotograma: fotogramas[0]!, fotogramas }
        }
        await api.listo(peticion.trabajoId, peticion.n)
      })().catch(() => undefined)
    })
    void (async () => {
      const recibido = await api.inicial()
      const { estilo } = recibido.instantanea
      const familia = buscarFuente(estilo.letra.fuente.familia)
      await Promise.all(
        [
          `${familia?.peso ?? 700} 32px "${estilo.letra.fuente.familia}"`,
          `700 32px "${FAMILIA_MARCA}"`
        ].map((fuente) => document.fonts.load(fuente))
      )
      await document.fonts.ready
      if (!activo) return
      datos.current = recibido
      setInicial(recibido)
    })().catch(() => undefined)
    return () => {
      activo = false
      baja()
    }
  }, [api, montado.promesa])

  useEffect(() => {
    if (inicial) montado.resolver()
  }, [inicial, montado])

  if (!inicial) return null
  const { instantanea, fps } = inicial
  return (
    <div className={estilos.lienzo}>
      <PantallaLetra
        letra={instantanea.letra}
        estilo={instantanea.estilo}
        duracionMs={instantanea.duracionMs}
        titulo={instantanea.titulo}
        artista={instantanea.artista}
        reproduciendo
        barrido={instantanea.modalidad !== 'letra_lista'}
        movimiento="completo"
        tiempoFijoMs={(n * 1000) / fps}
      />
      <MarcaDeAgua />
    </div>
  )
}
