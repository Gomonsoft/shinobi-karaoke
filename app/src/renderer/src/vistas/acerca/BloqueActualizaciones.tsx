import { useId, useState } from 'react'
import { Check, CircleArrowUp, TriangleAlert } from 'lucide-react'
import type { InfoSistema } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { mostrarToast } from '../../componentes/gestorToasts'
import { AJREP } from '../ajustes/textos'
import estilos from './acerca.module.css'
import { cuandoComprobado, esPreliminar } from './modeloActualizaciones'
import { AJACT as T, ENLACE_GUIA_ACTUALIZAR } from './textosActualizaciones'
import { useActualizaciones } from './useActualizaciones'

/** Id del `h3`: el aviso del principio de Ajustes ([Ver]) desplaza hasta él y le da el foco. */
export const ID_TITULO_ACTUALIZACIONES = 'acerca-actualizaciones'

const externo = (texto: string): string => T.externo(texto)

/**
 * Bloque «Actualizaciones» de Acerca de (`ux/08` · Feature 3). Solo informa y abre el navegador con
 * enlaces construidos por main: la app no descarga ni instala nada.
 */
export function BloqueActualizaciones({ info }: { info: InfoSistema }) {
  const { estado, refrescar } = useActualizaciones()
  const idAyuda = useId()
  const [buscando, setBuscando] = useState(false)
  const [fallo, setFallo] = useState(false)
  const [anuncio, setAnuncio] = useState('')
  const [descargada, setDescargada] = useState<string | null>(null)
  const [casilla, setCasilla] = useState<boolean | null>(null)

  if (!estado) return null
  const titulo = (
    <h3 id={ID_TITULO_ACTUALIZACIONES} tabIndex={-1} className={estilos.subtitulo}>
      {T.titulo}
    </h3>
  )
  if (estado.canal !== 'publicada') {
    return (
      <div className={estilos.actualizaciones}>
        {titulo}
        <p className={estilos.ayudaAct}>{estado.canal === 'desarrollo' ? T.desarrollo : T.local}</p>
      </div>
    )
  }

  const nueva = estado.disponible
  const enlaces = estado.enlaces
  const avisar = casilla ?? estado.avisar
  const ocupado = buscando || estado.comprobando

  const buscar = async () => {
    if (ocupado) return
    setBuscando(true)
    try {
      const r = await window.shinobi.actualizaciones.comprobar()
      setFallo(r.resultado === 'error')
      if (r.resultado === 'nueva' && r.disponible) setAnuncio(T.anuncioNueva(r.disponible.version))
      else if (r.resultado === 'al_dia') setAnuncio(T.anuncioAlDia)
      else setAnuncio('')
    } catch {
      setFallo(true)
      setAnuncio('')
    } finally {
      setBuscando(false)
      void refrescar()
    }
  }

  const cambiarAvisar = async (valor: boolean) => {
    setCasilla(valor)
    try {
      await window.shinobi.config.actualizar({ actualizaciones: { avisar: valor } })
      await refrescar()
      setCasilla(null)
    } catch {
      setCasilla(null)
      mostrarToast({ tipo: 'error', mensaje: AJREP.errorGuardar })
    }
  }

  const abrir = (url: string) => window.shinobi.sistema.abrirEnlace(url)
  const descargar = () => {
    if (!nueva || !enlaces) return
    abrir(enlaces.descargar).then(
      () => setDescargada(nueva.version),
      () => undefined
    )
  }

  const cuando = estado.ultimaComprobacion ? cuandoComprobado(estado.ultimaComprobacion) : null
  const previa = nueva ? esPreliminar(nueva.version) : false

  return (
    <div className={estilos.actualizaciones}>
      {titulo}
      {nueva ? (
        <>
          <p className={estilos.estadoAct}>
            <Icono icono={CircleArrowUp} tamano={16} className={estilos.iconoInfo} />
            <span>
              {T.nueva('')}
              <strong>{nueva.version}</strong>
              {previa && T.preliminar}
            </span>
          </p>
          <p className={estilos.ayudaAct}>{T.nuevaAyuda(info.version)}</p>
          {enlaces && (
            <div className={estilos.botones}>
              <Boton
                aria-label={externo(T.novedades)}
                onClick={() => void abrir(enlaces.novedades).catch(() => undefined)}
              >
                {T.novedades}
              </Boton>
              <Boton aria-label={externo(T.descargar)} onClick={descargar}>
                {T.descargar}
              </Boton>
            </div>
          )}
          {descargada === nueva.version && enlaces && (
            <AvisoEnLinea
              tipo="info"
              accion={
                <Boton
                  variante="fantasma"
                  aria-label={externo(T.guia)}
                  onClick={() => void abrir(ENLACE_GUIA_ACTUALIZAR).catch(() => undefined)}
                >
                  {T.guia}
                </Boton>
              }
            >
              {(enlaces.directa ? T.descargando : T.descargandoPagina)(nueva.version)}
              {previa && T.copiaPreliminar}
            </AvisoEnLinea>
          )}
        </>
      ) : cuando ? (
        <p className={estilos.estadoAct}>
          <Icono icono={Check} tamano={16} className={estilos.iconoExito} />
          {T.alDia}
        </p>
      ) : (
        <p className={estilos.ayudaAct}>{T.nunca}</p>
      )}
      {fallo && (
        <p className={estilos.estadoAct} role="status">
          <Icono icono={TriangleAlert} tamano={16} className={estilos.iconoAviso} />
          {T.error}
        </p>
      )}
      <div className={estilos.filaBuscar}>
        <p className={estilos.fechaAct}>
          {fallo
            ? cuando
              ? T.ultima(cuando)
              : T.ultimaNinguna
            : cuando
              ? T.comprobado(cuando)
              : null}
        </p>
        <Boton
          variante="fantasma"
          className={estilos.botonBuscar}
          cargando={ocupado}
          textoCargando={T.buscando}
          onClick={() => void buscar()}
        >
          {T.buscar}
        </Boton>
      </div>
      <label className={estilos.casilla}>
        <input
          type="checkbox"
          checked={avisar}
          aria-describedby={idAyuda}
          onChange={(e) => void cambiarAvisar(e.target.checked)}
        />
        {T.avisar}
      </label>
      <p id={idAyuda} className={estilos.privacidad}>
        {avisar ? T.privacidad : T.desactivado}
      </p>
      <span role="status" className={estilos.soloLector}>
        {anuncio}
      </span>
    </div>
  )
}
