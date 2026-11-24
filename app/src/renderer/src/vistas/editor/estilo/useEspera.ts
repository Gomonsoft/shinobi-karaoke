import { useCallback, useEffect, useMemo, useRef, useState, type ActionDispatch } from 'react'
import { ESPERA_LEGADA, type Espera } from '@shared/espera'
import type { Estilo } from '@shared/estilo'
import type { Letra } from '@shared/letra'
import type { ResumenCancionIpc } from '@shared/ipc'
import type { VistaTema } from '../aparienciaVista'
import { esperaEfectiva } from '../esperaEfectiva'
import type { AccionEditor, AparienciaEditor } from '../estado'
import { crearEjemploEspera, type EjemploEspera } from './ejemploEspera'
import type { ControlEspera } from './SeccionEspera'
import { T_ESPERA as T } from './textosEspera'

interface OpcionesControl {
  vista: VistaTema
  resumen: ResumenCancionIpc
  apariencia: AparienciaEditor
  /** Estilo visible: el propio (D2), el borrador (D3) o el del tema (D1, D4). */
  estilo: Estilo
  despachar: ActionDispatch<[AccionEditor]>
  anunciar(texto: string): void
  ejemploActivo: boolean
  alternarEjemplo(): void
}

/** La espera que ve el público: en D3 la del borrador del tema; en los demás modos, la efectiva. */
export function esperaVisible(
  vista: Pick<VistaTema, 'estado'>,
  apariencia: AparienciaEditor,
  estilo: Estilo
): Espera {
  return vista.estado === 'd3'
    ? (estilo.espera ?? ESPERA_LEGADA)
    : esperaEfectiva(apariencia, estilo)
}

const ahora = (): number => Date.now()

/** Une la lectura de la espera con las acciones del historial para `SeccionEspera`. */
export function useControlEspera(o: OpcionesControl): ControlEspera {
  const { vista, apariencia, estilo, despachar, anunciar } = o
  const espera = esperaVisible(vista, apariencia, estilo)
  const reemplazo =
    apariencia.seleccion.modo === 'propio' ? undefined : apariencia.reemplazos?.espera
  const vinculado = vista.estado === 'd1' || vista.estado === 'd4'
  const propios = vinculado && reemplazo !== undefined

  return {
    resumen: vinculado && !propios,
    propios,
    d3Propios: vista.estado === 'd3' && reemplazo !== undefined,
    espera,
    procedencia: vista.procedencia,
    temaNombre: vista.temaNombre,
    ejemploActivo: o.ejemploActivo,
    cambiar: (nueva, clave) => {
      if (vista.estado === 'd3') {
        despachar({
          tipo: 'estilo_borrador',
          estilo: { ...estilo, espera: nueva },
          clave,
          ahora: ahora()
        })
      } else despachar({ tipo: 'espera', espera: nueva, clave, ahora: ahora() })
    },
    cambiarSoloCancion: () => {
      despachar({ tipo: 'espera', espera, clave: 'espera.propios', ahora: ahora() })
      anunciar(T.anuncio.propios)
    },
    usarLosDelTema: () => {
      despachar({ tipo: 'espera', espera: null, clave: 'espera.usarTema', ahora: ahora() })
      anunciar(T.anuncio.usarTema)
    },
    alternarEjemplo: o.alternarEjemplo
  }
}

/** Teclas de transporte que detienen el ejemplo sin consumirlas. */
const TECLAS_TRANSPORTE = new Set([' ', 'Home', '1', '2', '3', 'ArrowLeft', 'ArrowRight'])

interface OpcionesEjemplo {
  letra: Letra
  seleccion: string | null
  espera: Espera
  sonando: boolean
  pausar(): void
  anunciar(texto: string): void
  /** Otra fuente de ejemplo (Letra en pantalla): por defecto, el hueco de espera. */
  crear?: (letra: Letra, seleccion: string | null, espera: Espera) => EjemploEspera
  anuncios?: { inicio: string; fin: string }
}

/**
 * «Ver un ejemplo»: un hueco simulado de 6 s en la vista previa con un reloj local. No suena
 * audio, no mueve el cabezal y no entra en el historial.
 */
export function useEjemploEspera({
  letra,
  seleccion,
  espera,
  sonando,
  pausar,
  anunciar,
  crear = crearEjemploEspera,
  anuncios = { inicio: T.anuncio.ejemploInicio, fin: T.anuncio.ejemploFin }
}: OpcionesEjemplo) {
  const [ejemplo, setEjemplo] = useState<EjemploEspera | null>(null)
  const origen = useRef(0)
  const anuncio = useRef(anunciar)
  useEffect(() => {
    anuncio.current = anunciar
  })

  const detener = useCallback(
    (avisar = true) => {
      setEjemplo((actual) => {
        if (actual && avisar) anuncio.current(anuncios.fin)
        return null
      })
    },
    [anuncios.fin]
  )

  const alternar = useCallback(() => {
    if (ejemplo) return detener()
    if (sonando) pausar()
    origen.current = performance.now()
    setEjemplo(crear(letra, seleccion, espera))
    anunciar(anuncios.inicio)
  }, [
    ejemplo,
    sonando,
    pausar,
    letra,
    seleccion,
    espera,
    anunciar,
    detener,
    crear,
    anuncios.inicio
  ])

  // Termina solo al recorrer el hueco; Esc, el transporte o cambiar la selección lo detienen.
  useEffect(() => {
    if (!ejemplo) return
    const fin = setTimeout(detener, ejemplo.finMs - ejemplo.inicioMs)
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        detener()
      } else if (TECLAS_TRANSPORTE.has(e.key) && !e.repeat) detener()
    }
    window.addEventListener('keydown', alTeclear, true)
    return () => {
      clearTimeout(fin)
      window.removeEventListener('keydown', alTeclear, true)
    }
  }, [ejemplo, detener])

  const seleccionAnterior = useRef(seleccion)
  useEffect(() => {
    if (seleccionAnterior.current !== seleccion) detener()
    seleccionAnterior.current = seleccion
  }, [seleccion, detener])
  const sonabaAntes = useRef(sonando)
  useEffect(() => {
    // Solo al empezar a sonar: al abrir el ejemplo desde la reproducción, primero se pausa.
    if (sonando && !sonabaAntes.current) detener()
    sonabaAntes.current = sonando
  }, [sonando, detener])

  const obtenerTiempo = useCallback(
    () => (ejemplo ? ejemplo.inicioMs + (performance.now() - origen.current) : 0),
    [ejemplo]
  )
  return useMemo(
    () => ({ ejemplo, alternar, obtenerTiempo, etiqueta: T.ejemploEtiqueta }),
    [ejemplo, alternar, obtenerTiempo]
  )
}
