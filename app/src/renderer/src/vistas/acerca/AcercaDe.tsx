import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import type { InfoSistema, TextoLegal } from '@shared/ipc'
import { hashCorto, identificador, numeroVisible } from '@shared/compilacion'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { mostrarToast } from '../../componentes/gestorToasts'
import estilos from './acerca.module.css'
import { BloqueActualizaciones } from './BloqueActualizaciones'
import { DialogoAvisoYoutube } from './DialogoAvisoYoutube'
import { DialogoTextoLegal } from './DialogoTextoLegal'
import { modeloEfectivo } from '../ajustes/modelo'
import { TEXTOS_ACERCA as T, WEB_PROYECTO } from './textos'

type Config = Awaited<ReturnType<typeof window.shinobi.config.obtener>>

const NOMBRE_PERFIL = {
  cpu: 'solo CPU',
  cuda: 'GPU NVIDIA (CUDA)',
  mps: 'GPU Apple (MPS)'
} as const

const SIN_INSTALAR = 'sin instalar'
const NOMBRE_SO: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }

/** `macOS 14.5 · arm64`, con "(emulada)" si procede; sin datos nuevos, el SO del núcleo. */
function lineaSo(info: InfoSistema): string {
  const nombre = NOMBRE_SO[info.plataforma]
  if (!nombre || !info.versionSo) return info.so
  const arq = info.arquitectura ? ` · ${info.arquitectura}${info.emulada ? ' (emulada)' : ''}` : ''
  return `${nombre} ${info.versionSo}${arq}`
}

/** `calidad` o `rapido (aceptado el AAAA-MM-DD)`; `sin instalar` si aún no hay motor. */
function lineaModelo(config: Config): string {
  if (config.instalacion.perfil_hardware === null) return SIN_INSTALAR
  if (modeloEfectivo(config) === 'calidad') return 'calidad'
  const fecha = config.separacion.rapido_aceptado?.slice(0, 10)
  return fecha ? `rapido (aceptado el ${fecha})` : 'rapido'
}

/** Línea que copia [Copiar versión] y que encabeza la información para soporte. */
export function textoVersion(info: InfoSistema): string {
  return `Shinobi Karaoke ${identificador(info.version, info.compilacion)}`
}

const VERSION_PREVIA = /-(alpha|beta|rc)\./

/** Línea de canal bajo la versión (`aj.acerca.canal.*`); el texto sale de `shared/compilacion`. */
function LineaCanal({ info, alCopiar }: { info: InfoSistema; alCopiar: () => void }) {
  const c = info.compilacion
  const hash = hashCorto(c)
  const texto =
    c.canal === 'desarrollo'
      ? T.canalDesarrollo
      : c.canal === 'local'
        ? T.canalLocal
        : VERSION_PREVIA.test(info.version)
          ? T.canalPrevia
          : T.canalPublicada
  const clase = `${estilos.canal} ${c.canal === 'desarrollo' ? estilos.canalAviso : c.canal === 'local' ? estilos.canalLocal : ''}`
  return (
    <div className={estilos.lineaCanal}>
      <p className={clase}>
        {c.canal === 'desarrollo' && <Icono icono={TriangleAlert} tamano={16} />}
        {texto}
        {hash && (
          <>
            {` · ${T.commit} `}
            <span className={estilos.hash}>{hash}</span>
          </>
        )}
      </p>
      <Boton
        variante="fantasma"
        className={estilos.copiarVersion}
        aria-label={T.copiarVersionAria(numeroVisible(info.version, c))}
        onClick={alCopiar}
      >
        {T.copiarVersion}
      </Boton>
    </div>
  )
}

/**
 * Texto que se copia con "Copiar información para soporte" (`ux/08`, criterio 9): siempre las
 * mismas líneas y en el mismo orden; lo que aún no existe se copia como `sin instalar`.
 */
export function infoSoporte(info: InfoSistema, config: Config): string {
  const perfil = config.instalacion.perfil_hardware
  const comprobacion = info.ytdlp?.ultimaComprobacion ?? config.ultima_comprobacion_ytdlp
  return [
    textoVersion(info),
    `Sistema: ${lineaSo(info)}`,
    `Perfil de hardware: ${perfil ? NOMBRE_PERFIL[perfil] : SIN_INSTALAR}`,
    `Modelo de separación: ${lineaModelo(config)}`,
    `Dispositivo: ${perfil === 'cuda' || perfil === 'cpu' ? perfil : (perfil ?? SIN_INSTALAR)}`,
    `yt-dlp: ${info.ytdlp?.version ?? SIN_INSTALAR}`,
    `Última comprobación de yt-dlp: ${comprobacion ?? SIN_INSTALAR}`,
    // `aj.soporte.busqueda` (0.2.2 · feature 5): activada salvo que el usuario la apagara.
    `Búsqueda automática de letra: ${config.preparacion?.automatica === false ? 'desactivada' : 'activada'}`
  ].join('\n')
}

/** Bloque "Acerca de" de `ux/08`. Lo reutilizan el diálogo de B1 y la vista Ajustes (Fase 3). */
export function AcercaDe() {
  const [info, setInfo] = useState<InfoSistema | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [legal, setLegal] = useState<TextoLegal | null>(null)
  const [verAviso, setVerAviso] = useState(false)

  useEffect(() => {
    let activo = true
    window.shinobi.sistema.info().then(
      (i) => activo && setInfo(i),
      () => undefined
    )
    const leer = (c: Config) => activo && setAviso(c.aviso_youtube_aceptado)
    window.shinobi.config.obtener().then(leer, () => undefined)
    const baja = window.shinobi.alCambiarConfig(leer)
    return () => {
      activo = false
      baja()
    }
  }, [])

  const copiar = async () => {
    try {
      const [i, c] = await Promise.all([
        window.shinobi.sistema.info(),
        window.shinobi.config.obtener()
      ])
      await navigator.clipboard.writeText(infoSoporte(i, c))
      mostrarToast({ tipo: 'exito', mensaje: T.infoCopiada })
    } catch {
      mostrarToast({ tipo: 'error', mensaje: 'No se pudo copiar la información.' })
    }
  }

  const copiarVersion = async () => {
    try {
      if (!info) return
      await navigator.clipboard.writeText(textoVersion(info))
      mostrarToast({ tipo: 'exito', mensaje: T.versionCopiada })
    } catch {
      mostrarToast({ tipo: 'error', mensaje: T.versionError })
    }
  }

  // Sin API de actualizaciones (pruebas de otras vistas) no se muestra el bloque.
  const conActualizaciones = typeof window.shinobi.actualizaciones?.estado === 'function'

  const abrirCarpeta = () =>
    window.shinobi.sistema
      .abrirCarpetaDatos()
      .catch(() => mostrarToast({ tipo: 'error', mensaje: T.errorCarpeta }))

  return (
    <section className={estilos.bloque} aria-labelledby="acerca-titulo">
      <h2 id="acerca-titulo" className={estilos.titulo}>
        {T.titulo}
      </h2>
      {info && (
        <>
          <p className={estilos.version}>
            {T.version(numeroVisible(info.version, info.compilacion))}
          </p>
          <LineaCanal info={info} alCopiar={() => void copiarVersion()} />
          {conActualizaciones && <BloqueActualizaciones info={info} />}
        </>
      )}
      <div className={estilos.botones}>
        <Boton onClick={() => setLegal('gpl')}>{T.verLicencia}</Boton>
        <Boton onClick={() => setLegal('terceros')}>{T.verTerceros}</Boton>
        <Boton onClick={() => void window.shinobi.sistema.abrirEnlace(WEB_PROYECTO)}>{T.web}</Boton>
        <Boton onClick={() => setVerAviso(true)}>{T.avisoYoutube}</Boton>
        <Boton onClick={abrirCarpeta}>{T.abrirCarpeta}</Boton>
        <Boton onClick={() => void copiar()}>{T.copiarInfo}</Boton>
      </div>
      <p className={estilos.creditos}>{T.creditos}</p>
      {legal && <DialogoTextoLegal tipo={legal} alCerrar={() => setLegal(null)} />}
      {verAviso && <DialogoAvisoYoutube aceptadoEn={aviso} alCerrar={() => setVerAviso(false)} />}
    </section>
  )
}
