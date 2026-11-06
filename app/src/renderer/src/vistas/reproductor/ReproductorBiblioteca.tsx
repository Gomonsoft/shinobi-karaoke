import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { Cancion } from '@shared/cancion'
import type { Config } from '@shared/config'
import { estiloPredeterminado } from '@shared/estilo'
import type { ResumenCancionIpc } from '@shared/ipc'
import { numerosLineasSinInicio, type Letra } from '@shared/letra'
import { Icono } from '../../componentes/Icono'
import { mostrarToast, retenerToasts } from '../../componentes/gestorToasts'
import { PantallaLetra } from '../../karaoke/PantallaLetra'
import { useVolumenCompartido } from '../../karaoke/useVolumenCompartido'
import { tituloDeTarjeta } from '../biblioteca/tarjeta'
import { useBibliotecaCompartida } from '../biblioteca/useBiblioteca'
import { Reproductor } from './Reproductor'
import estilos from './reproductor.module.css'
import { R } from './textos'

const LETRA_VACIA: Letra = { origen: 'manual', lrclib_id: null, offset_ms: 0, lineas: [] }

function Preparando({
  resumen,
  alCerrar
}: {
  resumen: ResumenCancionIpc | undefined
  alCerrar(): void
}) {
  const raiz = useRef<HTMLDivElement>(null)
  const [cargaLarga, setCargaLarga] = useState(false)
  const titulo = resumen ? tituloDeTarjeta(resumen) : ''

  useLayoutEffect(() => {
    const superficie = raiz.current!
    const inertes = Array.from(document.body.children).filter(
      (nodo) => nodo !== superficie && !nodo.hasAttribute('inert')
    )
    for (const nodo of inertes) nodo.setAttribute('inert', '')
    superficie.focus({ preventScroll: true })
    const alTeclear = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.key !== 'Escape') return
      e.preventDefault()
      alCerrar()
    }
    window.addEventListener('keydown', alTeclear, true)
    return () => {
      window.removeEventListener('keydown', alTeclear, true)
      for (const nodo of inertes) nodo.removeAttribute('inert')
    }
  }, [alCerrar])

  useEffect(() => {
    const espera = setTimeout(() => setCargaLarga(true), 1000)
    return () => clearTimeout(espera)
  }, [])

  return createPortal(
    <div
      ref={raiz}
      role="dialog"
      aria-modal="true"
      aria-label={titulo ? R.aria.region(titulo) : R.cargando}
      tabIndex={-1}
      className={estilos.raiz}
    >
      <PantallaLetra
        letra={LETRA_VACIA}
        estilo={resumen?.estilo ?? estiloPredeterminado()}
        duracionMs={resumen?.duracionMs ?? 0}
        titulo={titulo}
        artista={resumen?.artista ?? ''}
        reproduciendo
        cargando={cargaLarga}
        textoCargando={R.cargando}
        className={estilos.letra}
      />
      <div className={`${estilos.franja} ${estilos.superior}`}>
        <button
          type="button"
          className={`${estilos.control} ${estilos.salir}`}
          aria-keyshortcuts="Escape"
          onClick={alCerrar}
        >
          <Icono icono={X} /> {R.salir}
        </button>
      </div>
    </div>,
    document.body
  )
}

function CancionCargada({
  cancion,
  config,
  lineasSinSincronizar,
  alCerrar
}: {
  cancion: Cancion
  config: Config
  lineasSinSincronizar: number
  alCerrar(): void
}) {
  const volumen = useVolumenCompartido(config.reproductor)
  const { titulo, artista, duracion_ms } = cancion.metadatos
  return (
    <Reproductor
      cancion={{
        id: cancion.id,
        titulo,
        artista,
        duracionMs: duracion_ms,
        gananciaDb: cancion.fuente.ganancia_db,
        letra: cancion.letra ?? LETRA_VACIA,
        estilo: cancion.estilo,
        lineasSinSincronizar
      }}
      origen="biblioteca"
      modo="karaoke"
      desdeMs={0}
      volumen={volumen}
      alSalir={alCerrar}
      alFallarPista={({ tipo }) => {
        if (tipo === 'no_encontrada')
          void window.shinobi.biblioteca.comprobarPistas(cancion.id).catch(() => undefined)
      }}
    />
  )
}

export function ReproductorBiblioteca({ id, alCerrar }: { id: string; alCerrar(): void }) {
  const resumen = useBibliotecaCompartida()?.canciones.find((cancion) => cancion.id === id)
  const [datos, setDatos] = useState<{ cancion: Cancion; config: Config } | null>(null)

  useLayoutEffect(() => {
    retenerToasts(true)
    return () => retenerToasts(false)
  }, [])

  useEffect(() => {
    let activo = true
    const api = window.shinobi
    const noSePudoAbrir = () => {
      if (!activo) return
      alCerrar()
      mostrarToast({ tipo: 'error', mensaje: 'No se pudo abrir la canción.' })
    }
    void Promise.all([api.biblioteca.obtener(id), api.config.obtener()]).then(
      ([cancion, config]) => {
        if (!activo) return
        if (cancion?.estado !== 'lista') noSePudoAbrir()
        else setDatos({ cancion, config })
      },
      noSePudoAbrir
    )
    return () => {
      activo = false
    }
  }, [id, alCerrar])

  if (!datos) return <Preparando resumen={resumen} alCerrar={alCerrar} />
  return (
    <CancionCargada
      {...datos}
      lineasSinSincronizar={
        resumen?.lineasSinSincronizar ?? numerosLineasSinInicio(datos.cancion.letra).length
      }
      alCerrar={alCerrar}
    />
  )
}
