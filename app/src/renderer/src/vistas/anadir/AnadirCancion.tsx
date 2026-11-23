import { useEffect, useState } from 'react'
import { ControlSegmentado, type OpcionSegmentada } from '../../componentes/ControlSegmentado'
import type { DatosInicialesAnadir } from '../../navegacion/estado'
import { CabeceraCancion } from '../cancion/CabeceraCancion'
import { PanelArchivo } from './PanelArchivo'
import { leerBorrador, olvidarBorrador } from './borrador'
import { PanelYoutube } from './PanelYoutube'
import { TablaLote } from './lote/TablaLote'
import type { TablaLote as DatosTabla } from './lote/modelo'
import { TEXTO } from './textos'
import estilos from './anadir.module.css'

export type OrigenAnadir = 'archivo' | 'youtube'

const ORIGEN_ARCHIVO: OpcionSegmentada<OrigenAnadir> = {
  valor: 'archivo',
  etiqueta: TEXTO.origenArchivo
}
const ORIGEN_YOUTUBE: OpcionSegmentada<OrigenAnadir> = {
  valor: 'youtube',
  etiqueta: TEXTO.origenYoutube
}

/** Último origen elegido en la sesión (docs/ux/03: "recuerda la última elección"). */
let origenRecordado: OrigenAnadir = 'archivo'

interface AnadirCancionProps {
  /** Archivo arrastrado sobre la Biblioteca. */
  archivo?: string
  /** Varios archivos o una carpeta arrastrados sobre la Biblioteca (modo lote). */
  archivos?: string[]
  /** Sustituir la fuente de una canción existente conservando sus metadatos. */
  iniciales?: DatosInicialesAnadir
  /** Vuelve de Ajustes con «Cambiar en Ajustes»: recupera lo escrito (spec 03 · F6-N8). */
  restaurar?: boolean
}

/** Vista 03 en modo "Nueva canción" (y "otra fuente para una canción sin audio"). */
export function AnadirCancion({ archivo, archivos, iniciales, restaurar }: AnadirCancionProps) {
  const [tabla, setTabla] = useState<DatosTabla | null>(null)
  const [aceptadoYoutube, setAceptadoYoutube] = useState<string | null>(null)
  useEffect(() => {
    if (!tabla?.youtube) return
    void Promise.resolve(window.shinobi.config.obtener()).then(
      (c) => setAceptadoYoutube(c.aviso_youtube_aceptado ?? null),
      () => undefined
    )
  }, [tabla])
  // Un borrador de una vuelta anterior solo vale al volver de Ajustes; en cualquier otra entrada se olvida.
  const borrador = restaurar ? leerBorrador() : null
  useEffect(() => {
    if (!restaurar) olvidarBorrador()
  }, [restaurar])
  // El módulo de YouTube puede estar desactivado en la build (ADR 0003, mitigación 5).
  const [youtube, setYoutube] = useState<boolean | null>(null)
  const [origenElegido, setOrigen] = useState<OrigenAnadir>(
    borrador?.origen ?? iniciales?.origen ?? (archivo || archivos ? 'archivo' : origenRecordado)
  )
  useEffect(() => {
    let activo = true
    window.shinobi.sistema.info().then(
      (i) => activo && setYoutube(i.youtube),
      () => activo && setYoutube(false)
    )
    return () => {
      activo = false
    }
  }, [])
  // Mientras no se sabe si hay YouTube, solo se muestra el panel de Archivo (el de siempre).
  const origen: OrigenAnadir | null = youtube
    ? origenElegido
    : youtube === null && origenElegido === 'youtube'
      ? null
      : 'archivo'
  const ORIGENES = youtube ? [ORIGEN_ARCHIVO, ORIGEN_YOUTUBE] : [ORIGEN_ARCHIVO]
  const cambiarOrigen = (o: OrigenAnadir) => {
    origenRecordado = o
    setOrigen(o)
  }
  if (tabla) return <TablaLote inicial={tabla} aceptadoYoutube={aceptadoYoutube} />
  return (
    <section className={estilos.vista} aria-labelledby="titulo-vista" data-panel-anadir>
      <CabeceraCancion resumen={null} actual="fuente" />
      <h1 id="titulo-vista" className="t-titulo" tabIndex={-1}>
        {TEXTO.titulo}
      </h1>
      {ORIGENES.length > 1 && (
        <>
          <h2 className="t-subtitulo">{TEXTO.pregunta}</h2>
          <ControlSegmentado
            etiqueta={TEXTO.origen}
            opciones={ORIGENES}
            valor={origenElegido}
            onCambio={cambiarOrigen}
          />
        </>
      )}
      {origen === 'archivo' && (
        <PanelArchivo
          archivoInicial={archivo}
          rutasIniciales={archivos}
          iniciales={iniciales}
          restaurar={restaurar}
          alLote={setTabla}
        />
      )}
      {origen === 'youtube' && (
        <PanelYoutube
          iniciales={iniciales}
          restaurar={restaurar}
          alLote={setTabla}
          alUsarArchivo={() => cambiarOrigen('archivo')}
        />
      )}
    </section>
  )
}
