import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { Estilo } from '@shared/estilo'
import type { Letra } from '@shared/letra'
import { Icono } from '../componentes/Icono'
import estilosComponentes from '../componentes/componentes.module.css'
import { variablesEstilo } from './estiloCss'
import { fotogramaEn, fotogramaEstatico, type FotogramaLetra, type LineaRender } from './render'
import estilos from './pantallaLetra.module.css'

export interface PantallaLetraProps {
  letra: Letra
  estilo: Estilo
  duracionMs: number
  titulo: string
  artista: string
  obtenerTiempoAudio?: () => number
  idEstatico?: string | null
  reproduciendo: boolean
  cuentaAtras?: 3 | 2 | 1 | null
  etiqueta?: string
  /** Texto del aviso de la pantalla de título. El componente añade el icono. */
  avisoTitulo?: string
  cargando?: boolean
  textoCargando?: string
  className?: string
}

const proporcion = (p: number): string => `${p * 100}%`
const MEDIA_REDUCIDA = '(prefers-reduced-motion: reduce)'

function aplicarProgreso(nodo: HTMLElement | null, linea: LineaRender | null): void {
  if (!nodo || !linea || nodo.dataset.linea !== linea.id) return
  nodo.style.setProperty('--progreso', proporcion(linea.progreso))
  nodo.querySelectorAll<HTMLElement>('[data-palabra]').forEach((palabra, i) => {
    palabra.style.setProperty('--progreso', proporcion(linea.palabras?.[i]?.progreso ?? 0))
  })
}

function Barrido({
  texto,
  progreso,
  palabra
}: {
  texto: string
  progreso: number
  palabra?: boolean
}) {
  return (
    <span
      className={estilos.barrido}
      data-palabra={palabra || undefined}
      style={palabra ? ({ '--progreso': proporcion(progreso) } as CSSProperties) : undefined}
    >
      {texto}
      <span className={estilos.resaltado}>{texto}</span>
    </span>
  )
}

function TextoActual({ linea }: { linea: LineaRender }) {
  if (!linea.palabras) return <Barrido texto={linea.texto} progreso={linea.progreso} />
  return linea.palabras.map((palabra, i) => (
    <span key={i} className={estilos.palabra}>
      {i > 0 && ' '}
      <Barrido texto={palabra.texto} progreso={palabra.progreso} palabra />
    </span>
  ))
}

export function PantallaLetra({
  letra,
  estilo,
  duracionMs,
  titulo,
  artista,
  obtenerTiempoAudio,
  idEstatico = null,
  reproduciendo,
  cuentaAtras,
  etiqueta,
  avisoTitulo,
  cargando,
  textoCargando,
  className
}: PantallaLetraProps) {
  const raiz = useRef<HTMLDivElement>(null)
  const nodoActual = useRef<HTMLDivElement>(null)
  const nodoSiguiente = useRef<HTMLDivElement>(null)
  const [reducido, setReducido] = useState(
    () => window.matchMedia?.(MEDIA_REDUCIDA).matches ?? false
  )
  const [vivo, setVivo] = useState<{ fotograma: FotogramaLetra; sube: boolean } | null>(null)
  const fotograma = reproduciendo
    ? (vivo?.fotograma ?? fotogramaEn(letra, -letra.offset_ms, { duracionMs, titulo, artista }))
    : fotogramaEstatico(letra, idEstatico)
  const { actual, siguiente } = fotograma

  useEffect(() => {
    const media = window.matchMedia?.(MEDIA_REDUCIDA)
    const cambio = () => setReducido(media?.matches ?? false)
    media?.addEventListener?.('change', cambio)
    return () => media?.removeEventListener?.('change', cambio)
  }, [])

  useLayoutEffect(() => {
    aplicarProgreso(nodoActual.current, actual)
  }, [actual])

  useEffect(() => {
    if (!reproduciendo || !obtenerTiempoAudio) return
    let raf: number
    let anterior: FotogramaLetra | null = null
    const avanzar = () => {
      const f = fotogramaEn(letra, obtenerTiempoAudio() - letra.offset_ms, {
        duracionMs,
        titulo,
        artista
      })
      if (f.claveTransicion !== anterior?.claveTransicion || f.puntos !== anterior.puntos) {
        const sube = f.actual !== null && f.actual.id === anterior?.siguiente?.id
        setVivo({ fotograma: f, sube })
      }
      aplicarProgreso(nodoActual.current, f.actual)
      anterior = f
      raf = requestAnimationFrame(avanzar)
    }
    raf = requestAnimationFrame(avanzar)
    return () => cancelAnimationFrame(raf)
  }, [reproduciendo, obtenerTiempoAudio, letra, duracionMs, titulo, artista])

  useLayoutEffect(() => {
    const contenedor = raiz.current!
    const actual = nodoActual.current
    const siguiente = nodoSiguiente.current
    function ajustar(nodo: HTMLElement | null): void {
      if (!nodo) return
      for (const escala of [1, 0.95, 0.9, 0.85, 0.8, 0.75]) {
        nodo.style.setProperty('--escala', String(escala))
        const altoLinea = parseFloat(getComputedStyle(nodo).lineHeight)
        if (nodo.scrollHeight <= altoLinea * 2 + 1) break
      }
    }
    function medir(): void {
      ajustar(actual)
      ajustar(siguiente)
      contenedor.style.setProperty('--actual-mitad', actual ? `${actual.offsetHeight / 2}px` : '')
    }
    medir()
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    observador?.observe(contenedor)
    return () => observador?.disconnect()
  }, [
    actual?.texto,
    siguiente?.texto,
    estilo.letra.fuente.familia,
    cuentaAtras,
    fotograma.claveTransicion
  ])

  return (
    <div
      ref={raiz}
      aria-hidden="true"
      className={`${estilos.raiz} foco-doble ${className ?? ''}`}
      style={variablesEstilo(estilo) as CSSProperties}
    >
      {cuentaAtras ? (
        <div className={estilos.cuenta}>{cuentaAtras}</div>
      ) : fotograma.titulo ? (
        <div className={estilos.titulo}>
          <div>{fotograma.titulo.titulo}</div>
          <div className={estilos.artista}>{fotograma.titulo.artista}</div>
          {avisoTitulo && (
            <div className={estilos.pildoraTitulo}>
              <span className={estilos.iconoAviso}>⚠</span> {avisoTitulo}
            </div>
          )}
          {cargando && (
            <div className={estilos.pildoraTitulo}>
              <Icono icono={LoaderCircle} tamano={24} className={estilosComponentes.girando} />
              {textoCargando}
            </div>
          )}
        </div>
      ) : (
        <>
          {actual && (
            <div
              key={actual.id}
              ref={nodoActual}
              data-linea={actual.id}
              className={`${estilos.actual} ${reproduciendo && vivo?.sube && !reducido ? estilos.transicion : ''}`}
            >
              <TextoActual linea={actual} />
            </div>
          )}
          {siguiente && (
            <div ref={nodoSiguiente} className={estilos.siguiente}>
              {fotograma.puntos > 0 && (
                <div className={estilos.puntos}>{'●'.repeat(fotograma.puntos)}</div>
              )}
              <span>{siguiente.texto}</span>
            </div>
          )}
        </>
      )}
      {etiqueta && <span className={estilos.etiqueta}>{etiqueta}</span>}
    </div>
  )
}
