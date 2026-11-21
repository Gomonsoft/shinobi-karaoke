import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { LoaderCircle } from 'lucide-react'
import { normalizarEstilo, type Estilo } from '@shared/estilo'
import type { Letra } from '@shared/letra'
import { Icono } from '../componentes/Icono'
import estilosComponentes from '../componentes/componentes.module.css'
import { recorteBarrido } from './barrido'
import { fondoCss, fondoCssEn, variablesEstilo } from './estiloCss'
import { fotogramaEn, fotogramaEstatico, type FotogramaLetra, type LineaRender } from './render'
import { useMovimientoReducido } from './useMovimientoReducido'
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
  /** `false`: sin capa de resaltado ni resaltado por palabra (modo Letra lista). */
  barrido?: boolean
  /** `true`: el fondo se queda en la fase 0 aunque el estilo tenga movimiento. */
  fondoEstatico?: boolean
  /**
   * Se llama una vez al empezar (o al buscar dentro de) un hueco con indicadores de 2 s o más,
   * con los segundos que faltan. El contenedor lo anuncia en su región `aria-live`.
   */
  alAnunciarEspera?: (segundos: number) => void
}

type MedicionBarrido = { capa: HTMLElement; cajas: DOMRectReadOnly[] }

function medirBarridos(nodo: HTMLElement | null): MedicionBarrido[] {
  return Array.from(nodo?.querySelectorAll<HTMLElement>('[data-barrido]') ?? [], (barrido) => {
    const capa = barrido.lastElementChild as HTMLElement
    const rango = document.createRange()
    rango.selectNodeContents(barrido.firstChild!)
    const origen = capa.getBoundingClientRect()
    // Tanto el rango como la capa incluyen la transformación de entrada de la línea.
    const escala = origen.width / parseFloat(getComputedStyle(capa).width)
    const cajas =
      escala > 0 && Number.isFinite(escala) && rango.getClientRects
        ? Array.from(rango.getClientRects())
            .filter((caja) => caja.width > 0)
            .sort((a, b) => a.top - b.top)
            .map(
              (caja) =>
                new DOMRect(
                  (caja.left - origen.left) / escala,
                  (caja.top - origen.top) / escala,
                  caja.width / escala,
                  caja.height / escala
                )
            )
        : []
    return { capa, cajas }
  })
}

function aplicarProgreso(barridos: readonly MedicionBarrido[], linea: LineaRender): void {
  barridos.forEach(({ capa, cajas }, i) => {
    const progreso = linea.palabras ? (linea.palabras[i]?.progreso ?? 0) : linea.progreso
    capa.style.clipPath = recorteBarrido(cajas, progreso)
  })
}

function Barrido({ texto, barrido }: { texto: string; barrido: boolean }) {
  if (!barrido) return <>{texto}</>
  return (
    <span className={estilos.barrido} data-barrido="">
      {texto}
      <span className={estilos.resaltado} aria-hidden="true">
        {texto}
      </span>
    </span>
  )
}

function TextoActual({ linea, barrido }: { linea: LineaRender; barrido: boolean }) {
  if (!barrido || !linea.palabras) return <Barrido texto={linea.texto} barrido={barrido} />
  return linea.palabras.map((palabra, i) => (
    <span key={i} className={estilos.palabra}>
      {i > 0 && ' '}
      <Barrido texto={palabra.texto} barrido />
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
  className,
  barrido = true,
  fondoEstatico = false,
  alAnunciarEspera
}: PantallaLetraProps) {
  const raiz = useRef<HTMLDivElement>(null)
  const nodoActual = useRef<HTMLDivElement>(null)
  const barridos = useRef<MedicionBarrido[]>([])
  const ultimaLinea = useRef<LineaRender | null>(null)
  const nodoSiguiente = useRef<HTMLDivElement>(null)
  const reducido = useMovimientoReducido()
  const anunciada = useRef<string | null>(null)
  const anunciar = useRef(alAnunciarEspera)
  const fondo = useMemo(() => normalizarEstilo(estilo).fondo, [estilo])
  const animarFondo =
    fondo.tipo === 'degradado' && !!fondo.movimiento && !fondoEstatico && !reducido
  const [vivo, setVivo] = useState<{ fotograma: FotogramaLetra; sube: boolean } | null>(null)
  const fotograma = reproduciendo
    ? (vivo?.fotograma ??
      fotogramaEn(letra, -letra.offset_ms, {
        duracionMs,
        titulo,
        artista,
        espera: estilo.espera
      }))
    : fotogramaEstatico(letra, idEstatico)
  const { actual, siguiente, espera } = fotograma

  useLayoutEffect(() => {
    anunciar.current = alAnunciarEspera
  })

  useLayoutEffect(() => {
    ultimaLinea.current = actual
  }, [actual])

  useEffect(() => {
    if (!obtenerTiempoAudio) return
    const pintarFondo = (tAudioMs: number) => {
      if (animarFondo && !document.hidden) {
        raiz.current?.style.setProperty('--k-fondo', fondoCssEn(fondo, tAudioMs))
      }
    }
    // La fase 0 vuelve en la limpieza; se pinta ya para no mostrarla ni un fotograma.
    const restaurar = () => {
      if (animarFondo) raiz.current?.style.setProperty('--k-fondo', fondoCss(fondo))
    }
    pintarFondo(obtenerTiempoAudio())
    if (!reproduciendo) {
      // En pausa el fondo sigue las búsquedas: se repinta solo cuando cambia el tiempo.
      if (!animarFondo) return restaurar
      let rafPausa = 0
      let ultimo = obtenerTiempoAudio()
      const vigilar = () => {
        const t = obtenerTiempoAudio()
        if (t !== ultimo) {
          ultimo = t
          pintarFondo(t)
        }
        rafPausa = requestAnimationFrame(vigilar)
      }
      rafPausa = requestAnimationFrame(vigilar)
      return () => {
        cancelAnimationFrame(rafPausa)
        restaurar()
      }
    }
    let raf: number
    let anterior: FotogramaLetra | null = null
    const avanzar = () => {
      const tAudio = obtenerTiempoAudio()
      pintarFondo(tAudio)
      const f = fotogramaEn(letra, tAudio - letra.offset_ms, {
        duracionMs,
        titulo,
        artista,
        espera: estilo.espera
      })
      if (
        f.claveTransicion !== anterior?.claveTransicion ||
        f.espera?.puntos !== anterior.espera?.puntos ||
        f.espera?.cuenta !== anterior.espera?.cuenta
      ) {
        const sube = f.actual !== null && f.actual.id === anterior?.siguiente?.id
        setVivo({ fotograma: f, sube })
      }
      const hueco = f.espera
      if (!hueco) anunciada.current = null
      else if (hueco.clave !== anunciada.current) {
        anunciada.current = hueco.clave
        if (!hueco.primera && hueco.destinoMs - hueco.origenMs >= 2000) {
          anunciar.current?.(Math.round(hueco.restanteMs / 1000))
        }
      }
      if (hueco) raiz.current?.style.setProperty('--k-fraccion', String(hueco.fraccion))
      if (f.actual && nodoActual.current?.dataset.linea === f.actual.id) {
        ultimaLinea.current = f.actual
        aplicarProgreso(barridos.current, f.actual)
      }
      anterior = f
      raf = requestAnimationFrame(avanzar)
    }
    raf = requestAnimationFrame(avanzar)
    return () => {
      cancelAnimationFrame(raf)
      restaurar()
    }
  }, [
    reproduciendo,
    obtenerTiempoAudio,
    letra,
    duracionMs,
    titulo,
    artista,
    estilo.espera,
    fondo,
    animarFondo
  ])

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
      barridos.current = medirBarridos(actual)
      if (ultimaLinea.current) aplicarProgreso(barridos.current, ultimaLinea.current)
      contenedor.style.setProperty('--actual-mitad', actual ? `${actual.offsetHeight / 2}px` : '')
    }
    medir()
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    observador?.observe(contenedor)
    if (actual) observador?.observe(actual)
    const fuentes = document.fonts
    fuentes?.addEventListener('loadingdone', medir)
    fuentes?.addEventListener('loadingerror', medir)
    return () => {
      observador?.disconnect()
      fuentes?.removeEventListener('loadingdone', medir)
      fuentes?.removeEventListener('loadingerror', medir)
    }
  }, [actual, siguiente, estilo.letra.fuente.familia, cuentaAtras, fotograma.claveTransicion])

  return (
    <div
      ref={raiz}
      aria-hidden="true"
      className={`${estilos.raiz} ${barrido ? '' : estilos.sinBarrido} foco-doble ${className ?? ''}`}
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
          {espera?.barra && (
            <div
              className={estilos.barra}
              data-indicador="barra"
              aria-hidden="true"
              style={{ '--k-fraccion': espera.fraccion } as CSSProperties}
            />
          )}
          {espera?.cuenta && (
            <div
              key={espera.cuenta}
              className={`${estilos.cuentaEspera} ${reducido ? '' : estilos.entraNumero}`}
              data-indicador="cuenta"
              aria-hidden="true"
            >
              {espera.cuenta}
            </div>
          )}
          {actual && (
            <div
              key={actual.id}
              ref={nodoActual}
              data-linea={actual.id}
              className={`${estilos.actual} ${reproduciendo && vivo?.sube && !reducido ? estilos.transicion : ''}`}
            >
              <TextoActual linea={actual} barrido={barrido} />
            </div>
          )}
          {siguiente && (
            <div ref={nodoSiguiente} className={estilos.siguiente}>
              {(fotograma.espera?.puntos ?? 0) > 0 && (
                <div className={estilos.puntos}>{'●'.repeat(fotograma.espera?.puntos ?? 0)}</div>
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
