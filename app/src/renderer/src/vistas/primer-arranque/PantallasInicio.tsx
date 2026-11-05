import { useEffect, useState, type ReactNode } from 'react'
import {
  ArrowUpRight,
  CircleAlert,
  Clock,
  Download,
  HardDrive,
  Mic,
  Wifi,
  type LucideIcon
} from 'lucide-react'
import type { RequisitosRuntimeIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { BarraProgreso } from '../../componentes/BarraProgreso'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { mostrarToast } from '../../componentes/gestorToasts'
import { infoSoporte } from '../acerca/AcercaDe'
import { DialogoAcercaDe } from '../acerca/DialogoAcercaDe'
import { WEB_PROYECTO } from '../acerca/textos'
import {
  detallesEquipo,
  enfocar,
  espacioInsuficiente,
  formatearGb,
  formatearGbLibre,
  minimoMacos,
  nombreProcesador,
  nombreSo
} from './modelo'
import { ENLACE_ACTUALIZAR_MACOS, PA } from './textos'
import estilos from './primerArranque.module.css'

/** Logotipo: fondo + marca, lo único que se ve en los primeros 300 ms de B0. */
export function Logotipo() {
  return (
    <div className={estilos.logo}>
      <Icono icono={Mic} />
      {PA.nombreApp}
    </div>
  )
}

function PiePagina({ alLicencias }: { alLicencias: () => void }) {
  return (
    <p className={estilos.pie}>
      {PA.pie} ·{' '}
      <button type="button" className={estilos.enlace} onClick={alLicencias}>
        {PA.licencias}
      </button>
    </p>
  )
}

function Fila({
  icono,
  error,
  children
}: {
  icono: LucideIcon
  error?: boolean
  children: ReactNode
}) {
  return (
    <li className={`${estilos.filaReq} ${error ? estilos.filaError : ''}`}>
      <Icono icono={error ? CircleAlert : icono} tamano={18} />
      <span>{children}</span>
    </li>
  )
}

/** Sale de la aplicación (`app.salir`: en macOS cerrar la ventana la deja en el Dock). */
const salir = (): void => void window.shinobi.app.salir().catch(() => undefined)

// --- B0 ------------------------------------------------------------------------

export const RETARDO_TEXTO_B0_MS = 300
export const RETARDO_LENTO_B0_MS = 15_000

/** B0: sin botones ni enlaces; Esc no hace nada y la X cierra sin diálogo. */
export function Comprobando() {
  const [textoVisible, setTextoVisible] = useState(false)
  const [lento, setLento] = useState(false)
  useEffect(() => {
    const a = setTimeout(() => setTextoVisible(true), RETARDO_TEXTO_B0_MS)
    const b = setTimeout(() => setLento(true), RETARDO_LENTO_B0_MS)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])
  return (
    <section className={estilos.pantalla} aria-labelledby={textoVisible ? 'pa-titulo' : undefined}>
      <Logotipo />
      {/* El anuncio es único: el título se lee una sola vez desde el principio. */}
      <p role="status" className={estilos.soloLector}>
        {PA.comprobandoTitulo}
      </p>
      {textoVisible && (
        <>
          <h1 id="pa-titulo" className={`t-titulo ${estilos.titulo}`}>
            {PA.comprobandoTitulo}
          </h1>
          <p className={estilos.texto}>{lento ? PA.comprobandoLento : PA.comprobandoCuerpo}</p>
          <div className={estilos.barraIndeterminada}>
            <BarraProgreso etiqueta={PA.comprobandoTitulo} indeterminada />
          </div>
        </>
      )}
    </section>
  )
}

// --- B1 / B5 ----------------------------------------------------------------------

interface BienvenidaProps {
  requisitos: RequisitosRuntimeIpc
  alPreparar: () => void
  alComprobar: () => void
  comprobando: boolean
  alLicencias: () => void
}

export function Bienvenida({
  requisitos,
  alPreparar,
  alComprobar,
  comprobando,
  alLicencias
}: BienvenidaProps) {
  const insuficiente = espacioInsuficiente(requisitos)
  const req = formatearGb(requisitos.espacioRequerido)
  const libre = formatearGbLibre(requisitos.espacioLibre)
  return (
    <section className={estilos.pantalla} aria-labelledby="pa-titulo">
      <Logotipo />
      <h1 id="pa-titulo" className={`t-titulo ${estilos.titulo}`}>
        {PA.bienvenidaTitulo}
      </h1>
      <p className={estilos.texto}>{PA.bienvenidaCuerpo}</p>
      <ul className={estilos.caja}>
        <Fila icono={Download}>
          {requisitos.bytesDescarga === null
            ? PA.reqDescargaGenerica
            : PA.reqDescarga(formatearGb(requisitos.bytesDescarga))}
        </Fila>
        <Fila icono={Clock}>{PA.reqTiempo}</Fila>
        <Fila icono={HardDrive} error={insuficiente}>
          {insuficiente ? PA.reqEspacioInsuficiente(req, libre) : PA.reqEspacio(req, libre)}
        </Fila>
        <Fila icono={Wifi}>{PA.reqConexion}</Fila>
      </ul>
      <p className={estilos.texto}>{PA.bienvenidaNota}</p>
      <Boton
        variante="primario"
        tamano="grande"
        ref={enfocar}
        cargando={comprobando}
        onClick={insuficiente ? alComprobar : alPreparar}
      >
        {insuficiente ? PA.botonComprobar : PA.botonPreparar}
      </Boton>
      <PiePagina alLicencias={alLicencias} />
    </section>
  )
}

interface ReanudarProps {
  /** `true` = instalación dañada (B5 "Reparar"); `false` = continuar. */
  reparar: boolean
  bytesRestantes: number | null
  alAccion: () => void
  alLicencias: () => void
}

export function Reanudar({ reparar, bytesRestantes, alAccion, alLicencias }: ReanudarProps) {
  return (
    <section className={estilos.pantalla} aria-labelledby="pa-titulo">
      <Logotipo />
      <h1 id="pa-titulo" className={`t-titulo ${estilos.titulo}`}>
        {reparar ? PA.repararTitulo : PA.reanudarTitulo}
      </h1>
      {reparar ? (
        <p className={estilos.texto}>{PA.repararCuerpo}</p>
      ) : (
        bytesRestantes !== null &&
        bytesRestantes > 0 && (
          <p className={estilos.texto}>
            {PA.reanudarFaltan(Math.max(1, Math.round(bytesRestantes / 1e6)))}
          </p>
        )
      )}
      <p className={estilos.texto}>{PA.bienvenidaNota}</p>
      <Boton variante="primario" tamano="grande" ref={enfocar} onClick={alAccion}>
        {reparar ? PA.botonReparar : PA.botonContinuar}
      </Boton>
      <PiePagina alLicencias={alLicencias} />
    </section>
  )
}

// --- B6 / B6b ---------------------------------------------------------------------

async function copiarDetallesEquipo(r: RequisitosRuntimeIpc): Promise<void> {
  try {
    const [info, config] = await Promise.all([
      window.shinobi.sistema.info(),
      window.shinobi.config.obtener()
    ]).catch(() => [null, null] as const)
    const soporte = info && config ? infoSoporte(info, config) : null
    await navigator.clipboard.writeText(detallesEquipo(r, soporte))
    mostrarToast({ tipo: 'exito', mensaje: PA.detallesCopiados })
  } catch {
    mostrarToast({ tipo: 'error', mensaje: PA.detallesNoCopiados })
  }
}

const abrir = (url: string): void => {
  void window.shinobi.sistema.abrirEnlace(url).catch(() => undefined)
}

/** B6 (arquitectura sin motor) y B6b (macOS por debajo del mínimo). Sin "Preparar". */
export function NoCompatible({
  requisitos,
  macosAntiguo,
  alLicencias
}: {
  requisitos: RequisitosRuntimeIpc
  macosAntiguo: boolean
  alLicencias: () => void
}) {
  const minimo = minimoMacos(requisitos)
  return (
    <section className={estilos.pantalla} aria-labelledby="pa-titulo">
      <Logotipo />
      <h1 id="pa-titulo" className={`t-titulo ${estilos.titulo}`}>
        {macosAntiguo ? PA.macosTitulo : PA.nocompatTitulo}
      </h1>
      <div className={estilos.ancho}>
        {macosAntiguo ? (
          <AvisoEnLinea tipo="aviso">
            <p>{PA.macosCuerpo(minimo.texto, requisitos.equipo.versionSo)}</p>
            <p>{PA.macosGratis}</p>
          </AvisoEnLinea>
        ) : (
          <AvisoEnLinea tipo="error">
            <p>{PA.nocompatCuerpo}</p>
            <p>
              {PA.nocompatEquipo(nombreSo(requisitos.equipo), nombreProcesador(requisitos.equipo))}
            </p>
          </AvisoEnLinea>
        )}
      </div>
      <p className={estilos.texto}>{macosAntiguo ? PA.macosPasos : PA.nocompatNota}</p>
      <div className={estilos.acciones}>
        {macosAntiguo ? (
          <Boton onClick={() => abrir(ENLACE_ACTUALIZAR_MACOS)}>
            {PA.macosAyuda}
            <Icono icono={ArrowUpRight} tamano={16} />
          </Boton>
        ) : (
          <Boton onClick={() => abrir(`${WEB_PROYECTO}/issues`)}>
            {PA.nocompatSoporte}
            <Icono icono={ArrowUpRight} tamano={16} />
          </Boton>
        )}
        <Boton onClick={() => void copiarDetallesEquipo(requisitos)}>{PA.botonCopiar}</Boton>
        <Boton variante="primario" ref={enfocar} onClick={salir}>
          {PA.botonSalir}
        </Boton>
      </div>
      <PiePagina alLicencias={alLicencias} />
    </section>
  )
}

/** Dialogo de Licencias común a las pantallas con enlace. */
export function useLicencias(): { dialogo: ReactNode; abrir: () => void } {
  const [abierto, setAbierto] = useState(false)
  return {
    abrir: () => setAbierto(true),
    dialogo: <DialogoAcercaDe abierto={abierto} alCerrar={() => setAbierto(false)} />
  }
}
