import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from 'react'
import { LoaderCircle } from 'lucide-react'
import { normalizarEstilo, type Estilo } from '@shared/estilo'
import { palabrasVisibles, type Letra } from '@shared/letra'
import { Icono } from '../componentes/Icono'
import estilosComponentes from '../componentes/componentes.module.css'
import { recorteBarrido } from './barrido'
import { suelosDeOpacidad } from './contraste'
import { colorDeLinea, fondoCss, fondoCssEn, variablesEstilo } from './estiloCss'
import { disponerBloque } from './pantalla'
import {
  fotogramaEn,
  fotogramaEstatico,
  type FotogramaLetra,
  type LineaEnPantalla,
  type LineaRender
} from './render'
import { useMovimientoReducido } from './useMovimientoReducido'
import { zonasDeLetra, type ZonaLetra } from './zonas'
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
   * Exportación (ADR 0019 §2): pinta el instante de audio indicado, sin `requestAnimationFrame`
   * ni reloj. Fondo, barrido y puestos dependen solo de este valor y de la letra.
   */
  tiempoFijoMs?: number
  /** `reducido` quita los cambios de puesto y el fondo en movimiento. Por defecto, el del sistema. */
  movimiento?: 'completo' | 'reducido'
  /**
   * Se llama una vez al empezar (o al buscar dentro de) un hueco con indicadores de 2 s o más,
   * con los segundos que faltan. El contenedor lo anuncia en su región `aria-live`.
   */
  alAnunciarEspera?: (segundos: number) => void
  /**
   * Subrayado de lo ya cantado en la línea activa (ADR 0022 §5). Lo resuelve quien toma la
   * instantánea; ausente = lo que diga el estilo. Sin barrido (Letra lista) nunca se dibuja.
   */
  subrayado?: boolean
  /**
   * Vista previa del editor: el fotograma del reproductor reducido, con S = 7,5 % del alto del
   * lienzo y sin el mínimo de 32 px de las pantallas reales (spec 06 · Feature 1).
   */
  vistaPrevia?: boolean
}

type MedicionBarrido = { capa: HTMLElement; cajas: DOMRectReadOnly[]; margen: number }

/** Separación (0,12) y grosor (0,07) del subrayado, en em: lo que el recorte debe dejar por debajo. */
const MARGEN_SUBRAYADO_EM = 0.19
type Rol = 'unica' | 'saliente' | 'entrante'

const claveNodo = (zona: string, id: string, rol: Rol): string => `${zona}:${id}:${rol}`
const claveIndicador = (zona: string, cual: 'barra' | 'cuenta' | 'puntos'): string =>
  `${zona}#${cual}`

function medirBarridos(nodo: HTMLElement | null, subrayar: boolean): MedicionBarrido[] {
  return Array.from(nodo?.querySelectorAll<HTMLElement>('[data-barrido]') ?? [], (barrido) => {
    const capa = barrido.lastElementChild as HTMLElement
    const rango = document.createRange()
    rango.selectNodeContents(barrido.firstChild!)
    const origen = capa.getBoundingClientRect()
    // Tanto el rango como la capa incluyen la transformación del puesto de la línea.
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
    const tamano = parseFloat(getComputedStyle(capa).fontSize)
    const margen = subrayar && Number.isFinite(tamano) ? MARGEN_SUBRAYADO_EM * tamano : 0
    return { capa, cajas, margen }
  })
}

function aplicarProgreso(barridos: readonly MedicionBarrido[], linea: LineaRender): void {
  barridos.forEach(({ capa, cajas, margen }, i) => {
    const progreso = linea.palabras ? (linea.palabras[i]?.progreso ?? 0) : linea.progreso
    capa.style.clipPath = recorteBarrido(cajas, progreso, { margenInferior: margen })
  })
}

/** Reduce la línea por longitud (1 → 0,75) hasta que quepa en dos renglones. Siempre a tamaño `S`. */
function ajustarReduccion(nodo: HTMLElement): void {
  for (const escala of [1, 0.95, 0.9, 0.85, 0.8, 0.75]) {
    nodo.style.setProperty('--k-reduccion', String(escala))
    const altoLinea = parseFloat(getComputedStyle(nodo).lineHeight)
    if (nodo.scrollHeight <= altoLinea * 2 + 1) break
  }
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

/** La estructura (palabra a palabra o línea entera) depende de la letra, no del instante. */
function TextoLinea({
  texto,
  palabras,
  barrido
}: {
  texto: string
  palabras: string[] | null
  barrido: boolean
}) {
  if (!barrido || !palabras) return <Barrido texto={texto} barrido={barrido} />
  return palabras.map((palabra, i) => (
    <span key={i} className={estilos.palabra}>
      {i > 0 && ' '}
      <Barrido texto={palabra} barrido />
    </span>
  ))
}

const copiasDe = (f: FotogramaLetra, l: LineaEnPantalla): Rol[] =>
  f.cambio?.tipo === 'fundido' && l.desde !== l.hacia ? ['saliente', 'entrante'] : ['unica']

/**
 * Lo que obliga a React a volver a renderizar: el conjunto de nodos y los indicadores. Todo lo
 * demás (posición, escala, opacidad, barrido) se escribe por fotograma sin pasar por React.
 */
function claveDe(fotogramas: readonly FotogramaLetra[]): string {
  return fotogramas
    .map((f) => {
      if (f.titulo) return 'titulo'
      const copias = f.lineas
        .filter((l) => copiasDe(f, l).length > 1)
        .map((l) => l.id)
        .join(',')
      const e = f.espera
      return `${f.claveLineas}~${copias}|${e ? `${e.clave}:${e.puntos}:${e.cuenta}:${e.barra}` : ''}`
    })
    .join('/')
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
  tiempoFijoMs,
  movimiento,
  alAnunciarEspera,
  subrayado,
  vistaPrevia = false
}: PantallaLetraProps) {
  const raiz = useRef<HTMLDivElement>(null)
  const nodos = useRef(new Map<string, HTMLElement>())
  const medidos = useRef(new WeakMap<HTMLElement, MedicionBarrido[]>())
  const alturas = useRef<Record<string, number>>({})
  const modelo = useRef<FotogramaLetra[] | null>(null)
  const pintarRef = useRef<() => void>(() => undefined)
  const medirRef = useRef<(todo: boolean) => void>(() => undefined)
  const observador = useRef<ResizeObserver | null>(null)
  const observados = useRef(new WeakSet<HTMLElement>())
  const reducidoSistema = useMovimientoReducido()
  const reducido = movimiento ? movimiento === 'reducido' : reducidoSistema
  const fijo = tiempoFijoMs !== undefined
  const anunciada = useRef<string | null>(null)
  const anunciar = useRef(alAnunciarEspera)
  const normalizado = useMemo(() => normalizarEstilo(estilo), [estilo])
  const { fondo, pantalla } = normalizado
  // Una vez por estilo resuelto, nunca por fotograma (ADR 0022 §4).
  const suelos = useMemo(() => suelosDeOpacidad(estilo, pantalla), [estilo, pantalla])
  const zonas = useMemo<ZonaLetra[]>(() => zonasDeLetra(letra), [letra])
  const lineasPorId = useMemo(
    () => new Map(letra.lineas.map((linea) => [linea.id, linea])),
    [letra.lineas]
  )
  const animarFondo =
    fondo.tipo === 'degradado' && !!fondo.movimiento && !fondoEstatico && !reducido
  const espera = estilo.espera
  const subrayar = barrido && (subrayado ?? !!estilo.letra.subrayar_cantado)

  const calcular = (tAudioMs: number): FotogramaLetra[] =>
    zonas.map((zona) =>
      fotogramaEn(zona, tAudioMs - letra.offset_ms, {
        duracionMs,
        titulo,
        artista,
        espera,
        pantalla,
        movimiento: reducido ? 'reducido' : 'completo'
      })
    )

  const [vivo, setVivo] = useState<FotogramaLetra[] | null>(null)
  const fotogramas: FotogramaLetra[] = fijo
    ? calcular(tiempoFijoMs)
    : reproduciendo
      ? (vivo ?? calcular(0))
      : zonas.map((zona) => fotogramaEstatico(zona, idEstatico, pantalla))
  const vivoConReloj = reproduciendo && !!obtenerTiempoAudio && !fijo
  const claveRender = claveDe(fotogramas)
  const enTitulo = fotogramas.length > 0 && fotogramas.every((f) => f.titulo)

  useLayoutEffect(() => {
    anunciar.current = alAnunciarEspera
  })

  // Geometría: se recalcula el bloque de cada zona con las alturas medidas y se escribe en los nodos.
  useLayoutEffect(() => {
    pintarRef.current = () => {
      const contenedor = raiz.current
      const actual = modelo.current
      if (!contenedor || !actual) return
      const alto = contenedor.clientHeight
      const escribir = (
        clave: string,
        valores: Record<string, string>
      ): HTMLElement | undefined => {
        const nodo = nodos.current.get(clave)
        for (const [nombre, valor] of Object.entries(valores))
          nodo?.style.setProperty(nombre, valor)
        return nodo
      }
      zonas.forEach((zona, i) => {
        const f = actual[i]
        if (!f || f.titulo) return
        const bloque = disponerBloque({
          lineas: f.lineas,
          alturas: alturas.current,
          pantalla,
          region: { y0Px: zona.region.y0 * alto, altoPx: zona.region.alto * alto },
          altoPantallaPx: alto,
          minimoTamanoPx: vistaPrevia ? 0 : undefined,
          cambio: f.cambio,
          aparicion: f.aparicion,
          suelos
        })
        const porId = new Map(f.lineas.map((l) => [l.id, l]))
        for (const disp of bloque.lineas) {
          for (const copia of disp.copias) {
            const nodo = escribir(claveNodo(zona.id, disp.id, copia.rol), {
              '--k-y': `${copia.centroY}px`,
              '--k-escala': String(copia.escala),
              '--k-opacidad': String(copia.dibujar ? copia.opacidad : 0),
              '--k-gris': String(copia.mezclaGris)
            })
            const linea = porId.get(disp.id)
            // El subrayado solo existe en la activa (al empezar o al terminar un cambio).
            if (nodo && linea) nodo.dataset.activa = String(linea.desde === 0 || linea.hacia === 0)
            const barridos = nodo && medidos.current.get(nodo)
            if (linea && barridos) aplicarProgreso(barridos, linea)
          }
        }
        const aparece = String(f.esperaAparicion)
        const { barraY, cuentaY, puntosY } = bloque.indicadores
        const fraccion = String(f.espera?.fraccion ?? 0)
        escribir(claveIndicador(zona.id, 'barra'), {
          '--k-y': `${barraY}px`,
          '--k-fraccion': fraccion,
          opacity: aparece
        })
        escribir(claveIndicador(zona.id, 'cuenta'), { '--k-y': `${cuentaY}px` })
        escribir(claveIndicador(zona.id, 'puntos'), { '--k-y': `${puntosY}px`, opacity: aparece })
      })
      const hueco = actual[zonaEsperaDe(actual)]?.espera
      if (hueco) contenedor.style.setProperty('--k-fraccion', String(hueco.fraccion))
      else contenedor.style.removeProperty('--k-fraccion')
    }
  })

  // Medición estable: una vez por línea y tamaño (ADR 0022 §3). `todo` la repite en todos los nodos.
  useLayoutEffect(() => {
    medirRef.current = (todo) => {
      nodos.current.forEach((nodo) => {
        if (nodo.dataset.linea === undefined) return
        if (!todo && medidos.current.has(nodo)) return
        ajustarReduccion(nodo)
        medidos.current.set(nodo, medirBarridos(nodo, subrayar))
        if (nodo.offsetHeight > 0) alturas.current[nodo.dataset.linea] = nodo.offsetHeight
      })
      if (todo) pintarRef.current()
    }
  })

  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const mirador = new ResizeObserver(() => medirRef.current(true))
    observador.current = mirador
    observados.current = new WeakSet()
    mirador.observe(raiz.current!)
    return () => {
      mirador.disconnect()
      observador.current = null
    }
  }, [])

  // Letra, fuente o cuenta distintas: se mide de nuevo todo. Si solo cambian los nodos, solo los nuevos.
  useLayoutEffect(() => {
    medirRef.current(true)
    const fuentes = document.fonts
    const volver = () => medirRef.current(true)
    fuentes?.addEventListener('loadingdone', volver)
    fuentes?.addEventListener('loadingerror', volver)
    return () => {
      fuentes?.removeEventListener('loadingdone', volver)
      fuentes?.removeEventListener('loadingerror', volver)
    }
  }, [letra.lineas, estilo.letra.fuente.familia, cuentaAtras, subrayar])

  useLayoutEffect(() => {
    medirRef.current(false)
    nodos.current.forEach((nodo) => {
      if (nodo.dataset.linea === undefined || observados.current.has(nodo)) return
      observados.current.add(nodo)
      observador.current?.observe(nodo)
    })
  }, [claveRender])

  // Con reloj en marcha el bucle manda sobre `modelo`; en el resto, el de este render.
  useLayoutEffect(() => {
    if (!vivoConReloj || !modelo.current) modelo.current = fotogramas
    pintarRef.current()
    // Tiempo fijo (exportación): en el mismo paso síncrono se escriben también fondo y hueco.
    if (tiempoFijoMs !== undefined) {
      raiz.current!.style.setProperty(
        '--k-fondo',
        fondoCssEn(fondo, tiempoFijoMs, { estatico: reducido || fondoEstatico })
      )
    }
  })

  useEffect(() => {
    if (!obtenerTiempoAudio || fijo) return
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
    let anterior: string | null = null
    const avanzar = () => {
      const tAudio = obtenerTiempoAudio()
      pintarFondo(tAudio)
      const f = zonas.map((zona) =>
        fotogramaEn(zona, tAudio - letra.offset_ms, {
          duracionMs,
          titulo,
          artista,
          espera,
          pantalla,
          movimiento: reducido ? 'reducido' : 'completo'
        })
      )
      modelo.current = f
      const clave = claveDe(f)
      if (clave !== anterior) setVivo(f)
      else pintarRef.current()
      anterior = clave
      const hueco = f[zonaEsperaDe(f)]?.espera
      if (!hueco) anunciada.current = null
      else if (hueco.clave !== anunciada.current) {
        anunciada.current = hueco.clave
        if (!hueco.primera && hueco.destinoMs - hueco.origenMs >= 2000) {
          anunciar.current?.(Math.round(hueco.restanteMs / 1000))
        }
      }
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
    letra.offset_ms,
    zonas,
    duracionMs,
    titulo,
    artista,
    espera,
    pantalla,
    reducido,
    fondo,
    animarFondo,
    fijo
  ])

  const registrar = (clave: string) => (nodo: HTMLElement | null) => {
    if (nodo) nodos.current.set(clave, nodo)
    else nodos.current.delete(clave)
  }

  return (
    <div
      ref={raiz}
      aria-hidden="true"
      className={`${estilos.raiz} ${barrido ? '' : estilos.sinBarrido} ${subrayar ? estilos.subrayado : ''} ${vistaPrevia ? estilos.vistaPrevia : ''} foco-doble ${className ?? ''}`}
      data-movimiento={reducido ? 'reducido' : 'completo'}
      style={variablesEstilo(estilo) as CSSProperties}
    >
      {cuentaAtras ? (
        <div className={estilos.cuenta}>{cuentaAtras}</div>
      ) : enTitulo ? (
        <div className={estilos.titulo}>
          <div>{fotogramas[0]!.titulo!.titulo}</div>
          <div className={estilos.artista}>{fotogramas[0]!.titulo!.artista}</div>
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
        zonas.map((zona, i) => {
          const f = fotogramas[i]!
          const hueco = f.espera
          // Los indicadores toman el color de la línea que viene (en 0.2.2, el de lo ya cantado).
          const colorIndicadores = barrido
            ? ({ '--k-indicador': colorDeLinea(f.siguiente, estilo) } as CSSProperties)
            : undefined
          return (
            <Fragment key={zona.id}>
              {hueco?.barra && (
                <div
                  ref={registrar(claveIndicador(zona.id, 'barra'))}
                  className={estilos.barra}
                  data-indicador="barra"
                  aria-hidden="true"
                  style={colorIndicadores}
                >
                  <div className={estilos.relleno} data-relleno="" />
                </div>
              )}
              {hueco?.cuenta && (
                <div
                  key={hueco.cuenta}
                  ref={registrar(claveIndicador(zona.id, 'cuenta'))}
                  className={`${estilos.cuentaEspera} ${reducido ? '' : estilos.entraNumero}`}
                  data-indicador="cuenta"
                  {...(fijo && {
                    'data-nace-ms': hueco.destinoMs - hueco.cuenta * 1000 + letra.offset_ms
                  })}
                  aria-hidden="true"
                  style={colorIndicadores}
                >
                  {hueco.cuenta}
                </div>
              )}
              {hueco && hueco.puntos > 0 && (
                <div
                  ref={registrar(claveIndicador(zona.id, 'puntos'))}
                  className={estilos.puntos}
                  data-indicador="puntos"
                  style={colorIndicadores}
                >
                  {'●'.repeat(hueco.puntos)}
                </div>
              )}
              {f.lineas.flatMap((linea) =>
                copiasDe(f, linea).map((rol) => {
                  const clave = claveNodo(zona.id, linea.id, rol)
                  const original = lineasPorId.get(linea.id)
                  return (
                    <div
                      key={clave}
                      ref={registrar(clave)}
                      data-linea={linea.id}
                      data-zona={zona.id}
                      data-copia={rol}
                      className={estilos.linea}
                      style={
                        { '--k-resaltado-linea': colorDeLinea(linea, estilo) } as CSSProperties
                      }
                    >
                      <TextoLinea
                        texto={linea.texto}
                        palabras={
                          (original && palabrasVisibles(original)?.map((p) => p.texto)) || null
                        }
                        barrido={barrido}
                      />
                    </div>
                  )
                })
              )}
            </Fragment>
          )
        })
      )}
      {etiqueta && <span className={estilos.etiqueta}>{etiqueta}</span>}
    </div>
  )
}

function zonaEsperaDe(fotogramas: readonly FotogramaLetra[]): number {
  return Math.max(
    0,
    fotogramas.findIndex((f) => f.espera)
  )
}
