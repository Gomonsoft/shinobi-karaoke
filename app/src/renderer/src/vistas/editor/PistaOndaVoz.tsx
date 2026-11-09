import { memo, useEffect, useRef, useState } from 'react'
import { MAX_BLOQUES_PICOS, type EstadoPicos, type LecturaPicos } from '@shared/ipc'
import { Boton } from '../../componentes/Boton'
import { tiempoAPixel, type VistaLineaTiempo } from './lineaTiempo'
import css from './picosVoz.module.css'

const ESPERA_GENERACION_MS = 500
const ESPERA_VISTA_MS = 60

export function usePicosVoz(cancionId: string, habilitada: boolean) {
  const [revisionVoz, setRevisionVoz] = useState(0)
  useEffect(
    () =>
      window.shinobi?.trabajos?.alCambiar?.((trabajo) => {
        if (
          trabajo.cancionId === cancionId &&
          trabajo.paso === 'separacion' &&
          trabajo.estado === 'terminado' &&
          trabajo.resultado === 'completado'
        ) {
          setRevisionVoz((revision) => revision + 1)
        }
      }),
    [cancionId]
  )
  const [intento, setIntento] = useState({ clave: '', numero: 0 })
  const clave = JSON.stringify([cancionId, revisionVoz])
  const numero = intento.clave === clave ? intento.numero : 0
  const [respuesta, setRespuesta] = useState<{
    clave: string
    numero: number
    estado: EstadoPicos
  } | null>(null)

  useEffect(() => {
    if (!habilitada) return
    let vigente = true
    let espera: ReturnType<typeof setTimeout> | undefined
    const solicitar = async (reintentar = false): Promise<void> => {
      let estado: EstadoPicos
      try {
        estado = (await window.shinobi?.picos?.solicitar(cancionId, reintentar)) ?? {
          estado: 'no_disponible'
        }
      } catch {
        estado = { estado: 'error' }
      }
      if (!vigente) return
      setRespuesta({ clave, numero, estado })
      if (estado.estado === 'generando')
        espera = setTimeout(() => void solicitar(), ESPERA_GENERACION_MS)
    }
    void solicitar(numero > 0)
    return () => {
      vigente = false
      clearTimeout(espera)
    }
  }, [cancionId, clave, habilitada, numero])

  const estado: EstadoPicos = !habilitada
    ? { estado: 'no_disponible' }
    : respuesta?.clave === clave && respuesta.numero === numero
      ? respuesta.estado
      : { estado: 'generando' }
  return { estado, reintentar: () => setIntento({ clave, numero: numero + 1 }) }
}

interface LienzoProps {
  cancionId: string
  generacion: string
  inicioMs: number
  finMs: number
  general?: boolean
}

export interface TamanoLienzo {
  ancho: number
  alto: number
  presupuesto: number
}

type CajaObservada = { inlineSize: number; blockSize: number }
type EntradaTamano = {
  contentRect: { width: number; height: number }
  contentBoxSize?: readonly CajaObservada[] | CajaObservada
  devicePixelContentBoxSize?: readonly CajaObservada[] | CajaObservada
}

const primera = (caja?: readonly CajaObservada[] | CajaObservada): CajaObservada | undefined =>
  caja && 'length' in caja ? caja[0] : caja

/**
 * Tamaño del bitmap (px físicos) y presupuesto de picos (px CSS) a partir de una entrada del
 * ResizeObserver. Los atributos del canvas nunca intervienen en la medición.
 */
export function tamanoLienzo(entrada: EntradaTamano, dpr: number): TamanoLienzo {
  const css = primera(entrada.contentBoxSize) ?? {
    inlineSize: entrada.contentRect.width,
    blockSize: entrada.contentRect.height
  }
  const fisico = primera(entrada.devicePixelContentBoxSize)
  return {
    ancho: Math.round(fisico?.inlineSize ?? css.inlineSize * dpr),
    alto: Math.round(fisico?.blockSize ?? css.blockSize * dpr),
    presupuesto: Math.min(MAX_BLOQUES_PICOS, Math.ceil(css.inlineSize))
  }
}

function pintar(
  canvas: HTMLCanvasElement,
  lectura: LecturaPicos | null,
  vista: VistaLineaTiempo,
  ancho: number,
  alto: number
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, ancho, alto)
  if (!lectura) return
  const bytes = lectura.bytes
  const datos = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const centro = alto / 2
  ctx.fillStyle = getComputedStyle(canvas).color
  for (let i = 0; i < datos.byteLength; i += 4) {
    const bloque = lectura.primerBloque + i / 4
    const x = Math.max(0, tiempoAPixel(vista, ancho, bloque * lectura.pasoMs))
    const fin = Math.min(ancho, tiempoAPixel(vista, ancho, (bloque + 1) * lectura.pasoMs))
    if (fin <= x) continue
    const max = datos.getInt16(i + 2, true) / 32768
    const min = datos.getInt16(i, true) / 32768
    ctx.fillRect(x, centro * (1 - max), fin - x, Math.max(1, centro * (max - min)))
  }
}

export const LienzoPicosVoz = memo(function LienzoPicosVoz({
  cancionId,
  generacion,
  inicioMs,
  finMs,
  general
}: LienzoProps) {
  const marco = useRef<HTMLDivElement>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)
  const [tamano, setTamano] = useState<TamanoLienzo>({ ancho: 0, alto: 0, presupuesto: 0 })
  const [datos, setDatos] = useState<{ clave: string; lectura: LecturaPicos } | null>(null)
  const { ancho, alto, presupuesto } = tamano
  const clave = JSON.stringify([cancionId, generacion, inicioMs, finMs, presupuesto])

  useEffect(() => {
    const contenedor = marco.current
    if (!contenedor) return
    const aplicar = (siguiente: TamanoLienzo): void =>
      setTamano((previo) =>
        previo.ancho === siguiente.ancho &&
        previo.alto === siguiente.alto &&
        previo.presupuesto === siguiente.presupuesto
          ? previo
          : siguiente
      )
    if (typeof ResizeObserver === 'undefined') {
      // Respaldo sin ResizeObserver: se mide el contenedor, nunca el canvas.
      const medir = (): void => {
        const { width, height } = contenedor.getBoundingClientRect()
        aplicar(tamanoLienzo({ contentRect: { width, height } }, window.devicePixelRatio || 1))
      }
      window.addEventListener('resize', medir)
      medir()
      return () => window.removeEventListener('resize', medir)
    }
    const observador = new ResizeObserver((entradas) => {
      const entrada = entradas[entradas.length - 1]
      if (entrada) aplicar(tamanoLienzo(entrada, window.devicePixelRatio || 1))
    })
    try {
      // Este box también notifica cuando cambia la densidad del monitor sin variar el ancho CSS.
      observador.observe(contenedor, { box: 'device-pixel-content-box' })
    } catch {
      observador.observe(contenedor, { box: 'content-box' })
    }
    return () => observador.disconnect()
  }, [])

  useEffect(() => {
    if (presupuesto < 1 || inicioMs >= finMs) return
    let vigente = true
    const espera = setTimeout(() => {
      void window.shinobi?.picos
        ?.leer({ cancionId, inicioMs, finMs, presupuesto })
        .then((lectura) => {
          if (!vigente) return
          setDatos(lectura?.generacion === generacion ? { clave, lectura } : null)
        })
        .catch(() => {
          if (vigente) setDatos(null)
        })
    }, ESPERA_VISTA_MS)
    return () => {
      vigente = false
      clearTimeout(espera)
    }
  }, [cancionId, clave, finMs, generacion, inicioMs, presupuesto])

  useEffect(() => {
    if (!lienzo.current || !ancho || !alto || inicioMs >= finMs) return
    pintar(
      lienzo.current,
      datos?.clave === clave ? datos.lectura : null,
      { inicioMs, finMs },
      ancho,
      alto
    )
  }, [alto, ancho, clave, datos, finMs, inicioMs])

  return (
    <div ref={marco} className={general ? css.marcoGeneral : css.marco}>
      <canvas ref={lienzo} className={css.canvas} aria-hidden="true" width={ancho} height={alto} />
    </div>
  )
})

export function PistaOndaVoz({
  cancionId,
  vista,
  estado,
  separada,
  reintentar
}: {
  cancionId: string
  vista: VistaLineaTiempo
  estado: EstadoPicos
  separada: boolean
  reintentar: () => void
}) {
  return (
    <div className={css.pista}>
      <span className={css.etiqueta}>Forma de onda de la voz</span>
      {estado.estado === 'lista' ? (
        <LienzoPicosVoz cancionId={cancionId} generacion={estado.generacion} {...vista} />
      ) : (
        <div className={css.estado}>
          <span role="status">
            {!separada
              ? 'Disponible cuando termine la separación.'
              : estado.estado === 'generando'
                ? 'Preparando forma de onda…'
                : 'Forma de onda no disponible.'}
          </span>
          {estado.estado === 'error' && (
            <Boton variante="fantasma" onClick={reintentar}>
              Reintentar
            </Boton>
          )}
        </div>
      )}
    </div>
  )
}
