import { useEffect, useRef, useState } from 'react'
import { Maximize, Minimize, MonitorUp, X } from 'lucide-react'
import type { ResumenCancionIpc } from '@shared/ipc'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { Icono } from '../../../componentes/Icono'
import { MenuContextual, type ItemMenu } from '../../../componentes/MenuContextual'
import { ATRIBUTO_BOTON_COLA, ATRIBUTO_PANEL_COLA } from '../../../sesion/foco'
import { useSesion } from '../../../sesion/ProveedorSesion'
import { COLA, SES } from '../../../sesion/textos'
import { interrumpidaDe } from '../sesion/empieza'
import { BannersRecuperacion } from './BannersRecuperacion'
import { BloqueActiva } from './BloqueActiva'
import { ATRIBUTO_ABRIR_PANEL } from './DialogoCierreSesion'
import { ListaPendientes } from './ListaPendientes'
import estilos from './panelCola.module.css'
import { enfocarCuando } from './tiempo'

export const ID_PANEL_COLA = 'panel-cola'

const sinAccion = (): void => undefined

/** Panel «Cola de reproducción» (spec 02, fase 4): P1–P6, controles de la sesión y recuperación. */
export function PanelCola({ canciones }: { canciones: readonly ResumenCancionIpc[] }) {
  const { estado, haySesion, pantallas, acciones, cerrarPanel, abrirDialogoPantallas } = useSesion()
  const raiz = useRef<HTMLElement>(null)
  const focoDentro = useRef(false)
  const [eliminando, setEliminando] = useState(false)
  const sesion = estado?.sesion ?? null
  const wayland = pantallas?.colocacion === 'sistema'
  const esperandoCierre = sesion?.cierrePendiente?.origen === 'secundaria'
  const inactivo = esperandoCierre ? SES.cierre.esperando : undefined

  // El foco nunca se queda en `body` cuando cambia el bloque de la activa: si estaba dentro del
  // panel, pasa al primer control del bloque nuevo.
  const clave = `${sesion?.fase ?? 'sin'}|${sesion?.error ? 'e' : ''}|${sesion?.transicion ? 't' : ''}|${estado?.activa?.entradaId ?? ''}`
  useEffect(() => {
    const a = document.activeElement
    if (!focoDentro.current || (a && a !== document.body)) return
    const destino =
      raiz.current?.querySelector<HTMLElement>('[data-bloque-activa] button') ??
      raiz.current?.querySelector<HTMLElement>('h2')
    destino?.focus()
  }, [clave])

  const ocultar = () => {
    cerrarPanel()
    enfocarCuando(`[${ATRIBUTO_BOTON_COLA}]`)
  }

  const cerrarReproductor = () => {
    void acciones
      .solicitarCierre()
      .then((e) => {
        // Sin pendientes se cierra al momento (sin diálogo): el foco va a «Abrir en otra pantalla…».
        if ('sesion' in e && e.sesion === null) enfocarCuando(`[${ATRIBUTO_ABRIR_PANEL}]`)
      })
      .catch(sinAccion)
  }

  const numPantalla = sesion?.pantalla
    ? (pantallas?.pantallas.findIndex((p) => p.id === sesion.pantalla?.id) ?? -1) + 1
    : 0
  const itemsMenu: ItemMenu[] = [
    { id: 'mostrar', etiqueta: SES.mostrar, alSeleccionar: () => void acciones.mostrar() },
    ...(wayland
      ? []
      : [
          {
            id: 'cambiar',
            etiqueta: SES.cambiar,
            alSeleccionar: () => abrirDialogoPantallas({ inicio: 'mover' })
          }
        ])
  ]

  return (
    <aside
      ref={raiz}
      id={ID_PANEL_COLA}
      className={estilos.panel}
      aria-label={COLA.titulo}
      {...{ [ATRIBUTO_PANEL_COLA]: '' }}
      onFocus={() => {
        focoDentro.current = true
      }}
      onBlur={(e) => {
        if (e.relatedTarget instanceof Node && !e.currentTarget.contains(e.relatedTarget)) {
          focoDentro.current = false
        }
      }}
    >
      <div className={estilos.cabeceraPanel}>
        <h2 className="t-subtitulo" tabIndex={-1}>
          {COLA.titulo}
        </h2>
        <Boton variante="fantasma" onClick={ocultar}>
          {COLA.ocultar}
        </Boton>
      </div>

      {haySesion && sesion && (
        <>
          <p className={`t-pequeno ${estilos.estadoPantalla}`}>
            <span>
              <span className={estilos.punto} aria-hidden="true" />
              {sesion.pantalla
                ? numPantalla > 0
                  ? COLA.pantalla(numPantalla, sesion.pantalla.etiqueta || null)
                  : sesion.pantalla.etiqueta
                : SES.pantallaDesconocida}
            </span>
            {sesion.pantalla && (
              <span>{sesion.pantallaCompleta ? COLA.modo.completa : COLA.modo.ventana}</span>
            )}
          </p>
          <BannersRecuperacion />
          <div className={estilos.controles}>
            {!wayland && (
              <Boton
                noDisponible={inactivo}
                onClick={() =>
                  void acciones.fijarPantallaCompleta(!sesion.pantallaCompleta).catch(sinAccion)
                }
              >
                <Icono icono={sesion.pantallaCompleta ? Minimize : Maximize} tamano={16} />
                {sesion.pantallaCompleta ? SES.ventana.ventana : SES.ventana.completa}
              </Boton>
            )}
            <MenuContextual etiqueta={SES.menu} items={itemsMenu} />
            <Boton noDisponible={inactivo} onClick={cerrarReproductor}>
              <Icono icono={X} tamano={16} />
              {SES.cerrar}
            </Boton>
          </div>
          {wayland && <p className={`t-pequeno ${estilos.nota}`}>{SES.wayland}</p>}
          {esperandoCierre && (
            <p role="status" className={estilos.nota}>
              {SES.cierre.esperando}
            </p>
          )}
          <section className={estilos.seccion}>
            <h3 className="t-pequeno">{COLA.activa}</h3>
            <BloqueActiva canciones={canciones} />
          </section>
          <ListaPendientes
            etiquetarSiguiente={sesion.fase === 'transicion' || sesion.fase === 'espera'}
            duracionDe={(id) => canciones.find((c) => c.id === id)?.duracionMs ?? null}
            lineasSinSincronizarDe={(id) => {
              const c = canciones.find((x) => x.id === id)
              return c && c.incompleta && c.lineasSinSincronizar > 0 ? c.lineasSinSincronizar : null
            }}
          />
        </>
      )}

      {!haySesion && (
        <>
          <div className={estilos.sinSesion}>
            <BannersRecuperacion />
            <p className="t-cuerpo-fuerte">{COLA.cerrado}</p>
            <div className={estilos.acciones}>
              <Boton
                variante="primario"
                {...{ [ATRIBUTO_ABRIR_PANEL]: '' }}
                onClick={() =>
                  abrirDialogoPantallas({ inicio: estado?.contexto ? 'reanudar' : 'cola' })
                }
              >
                <Icono icono={MonitorUp} tamano={16} />
                {SES.abrir}
              </Boton>
              {estado && (estado.pendientes.length > 0 || estado.contexto) && (
                <Boton onClick={() => setEliminando(true)}>{COLA.eliminar}</Boton>
              )}
            </div>
          </div>
          {estado?.contexto && (
            <section className={estilos.seccion}>
              <h3 className="t-pequeno">{COLA.ultima}</h3>
              <div className={estilos.bloque}>
                <p className="t-cuerpo-fuerte">
                  {estado.contexto.entrada.titulo} — {estado.contexto.entrada.artista}
                </p>
                <p className={estilos.nota}>
                  {estado.contexto.terminada || estado.contexto.posicionMs === null
                    ? COLA.ultimaTerminada
                    : COLA.ultimaInterrumpida(estado.contexto.posicionMs)}
                </p>
              </div>
            </section>
          )}
          <ListaPendientes
            duracionDe={(id) => canciones.find((c) => c.id === id)?.duracionMs ?? null}
            lineasSinSincronizarDe={(id) => {
              const c = canciones.find((x) => x.id === id)
              return c && c.incompleta && c.lineasSinSincronizar > 0 ? c.lineasSinSincronizar : null
            }}
          />
        </>
      )}

      {eliminando && estado && (
        <Dialogo
          abierto
          titulo={COLA.dialogoEliminar.titulo}
          ancho="30rem"
          onCancelar={() => setEliminando(false)}
          enfoqueInicial="[data-cancelar]"
          acciones={
            <>
              <Boton data-cancelar onClick={() => setEliminando(false)}>
                {COLA.dialogoEliminar.cancelar}
              </Boton>
              <Boton
                variante="destructivo"
                onClick={() => {
                  setEliminando(false)
                  void acciones.cola.vaciar(true).catch(sinAccion)
                  enfocarCuando(`[${ATRIBUTO_ABRIR_PANEL}]`)
                }}
              >
                {COLA.dialogoEliminar.eliminar}
              </Boton>
            </>
          }
        >
          <p>{COLA.dialogoEliminar.cuerpo(estado.pendientes.length, interrumpidaDe(estado))}</p>
        </Dialogo>
      )}
    </aside>
  )
}
