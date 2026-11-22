import { useRef } from 'react'
import { Film, ListPlus, Palette, Pencil, Play, TriangleAlert } from 'lucide-react'
import { estiloPredeterminado } from '@shared/estilo'
import type { ResumenCancionIpc } from '@shared/ipc'
import { useExportaciones } from '../../exportacion/contexto'
import { EXP_MENU } from '../../exportacion/dialogo/textosProgreso'
import { lineaDeExportacion } from '../../exportacion/lineas'
import { fondoCss } from '../../karaoke/estiloCss'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { InsigniaEstado } from '../../componentes/InsigniaEstado'
import { MenuContextual, type ItemMenu } from '../../componentes/MenuContextual'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useSesion } from '../../sesion/ProveedorSesion'
import { BIB_COLA, EDI_BLOQUEO, SES } from '../../sesion/textos'
import { useAccionBloqueable } from '../../sesion/useAccionBloqueable'
import { useCuentaAtras } from '../../trabajos/useCuentaAtras'
import { LineaPaso } from './LineaPaso'
import { SEL } from './textosSeleccion'
import {
  continuaHaciaEdicion,
  datosDeTarjeta,
  formatearDuracion,
  lineaDeCola,
  textoAriaTarjeta,
  temaDeTarjeta,
  tituloDeTarjeta,
  usaMiniatura,
  type TrabajoVivo
} from './tarjeta'
import estilos from './biblioteca.module.css'

export interface AccionesTarjeta {
  reproducir(id: string): void
  continuar(id: string): void
  editar(id: string): void
  editarDatos(id: string): void
  volverABorrador(id: string): void
  /** Relanza el paso con error o interrumpido sin salir de la Biblioteca (0070). */
  reintentar(id: string): void
  /** Cancela el trabajo vivo: en cola sin diálogo, en curso con el diálogo del paso. */
  cancelarTrabajo(id: string): void
  /** Vuelve a separar una canción dañada por falta de pistas. */
  resepararPistas(id: string): void
  mostrarEnCarpeta(id: string): void
  eliminar(id: string): void
  /** «A la cola» / «Agregar al final»: `cola.agregar` al final. */
  agregarAlFinal(id: string): void
  /** «Reproducir a continuación»: `cola.agregar` al frente de las pendientes. */
  agregarSiguiente(id: string): void
  /** «Reproducir en otra pantalla…» (solo sin sesión): abre el diálogo de pantallas con esa canción. */
  reproducirEnOtraPantalla(id: string): void
  /** «Aplicar tema…» del menú ⋯: la cablea 0173; sin ella, el menú no ofrece la opción. */
  aplicarTema?(id: string): void
}

const ETIQUETA_ACCION = {
  reproducir: 'Reproducir',
  continuar: 'Continuar',
  reintentar: 'Reintentar',
  ver: 'Ver'
} as const

interface TarjetaProps {
  resumen: ResumenCancionIpc
  acciones: AccionesTarjeta
  /** Tarjeta que tiene el *roving tabindex* (única parada de tabulación de la rejilla). */
  activa: boolean
  alEnfocar(id: string): void
  /** Trabajo activo de la canción (en cola o en curso), con su progreso en vivo. */
  vivo?: TrabajoVivo | null
  /**
   * Modo selección (0173): la tarjeta muestra su casilla, no tiene acción principal ni ⋯ y el clic,
   * Espacio e Intro alternan la casilla. Sin él, la tarjeta es la de siempre.
   */
  seleccion?: SeleccionTarjeta
}

export interface SeleccionTarjeta {
  marcada: boolean
  /** `false` en las Dañadas con `cancion.json` ilegible: la casilla es `aria-disabled`. */
  editable: boolean
  /** `rango`: Mayús + clic (o Mayús + Espacio). */
  alAlternar(rango: boolean): void
}

function Portada({ resumen, accion }: { resumen: ResumenCancionIpc; accion: () => void }) {
  const titulo = tituloDeTarjeta(resumen)
  const miniatura = usaMiniatura(resumen)
  const estilo = resumen.estilo ?? estiloPredeterminado()
  const fondo = resumen.danada ? undefined : fondoCss(estilo.fondo)
  const clases = [
    estilos.portada,
    resumen.danada && estilos.portadaDanada,
    miniatura && estilos.portadaMiniatura
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      className={clases}
      style={{
        background: fondo,
        ...(miniatura ? { backgroundImage: `url("${resumen.miniatura}")` } : null)
      }}
    >
      {miniatura && <div className={estilos.velo} />}
      <button
        type="button"
        tabIndex={-1}
        className={estilos.portadaBoton}
        onClick={accion}
        aria-label={resumen.danada ? `Abrir el menú de «${titulo}»` : titulo}
      >
        {resumen.danada ? (
          <Icono icono={TriangleAlert} tamano={32} />
        ) : (
          <span
            className={estilos.tituloPortada}
            style={{
              fontFamily: `'${estilo.letra.fuente.familia}', var(--fuente-interfaz)`,
              color: miniatura ? 'var(--texto-1)' : estilo.letra.color
            }}
          >
            {titulo}
          </span>
        )}
      </button>
    </div>
  )
}

export function TarjetaCancion({
  resumen,
  acciones,
  activa,
  alEnfocar,
  vivo,
  seleccion
}: TarjetaProps) {
  const titulo = tituloDeTarjeta(resumen)
  const raiz = useRef<HTMLElement>(null)
  const { estado, haySesion } = useSesion()
  const bloqueo = useAccionBloqueable()
  const exportacion = useExportaciones()
  const exportando = exportacion.activaDe(resumen.id)
  const lineaExportacion = lineaDeExportacion(exportando)
  const esperaS = useCuentaAtras(vivo?.progreso ?? vivo?.trabajo.progreso, vivo?.trabajo.id)
  const d = datosDeTarjeta(resumen, vivo ? { ...vivo, esperaS } : vivo)
  const lista = resumen.estado === 'lista' && !resumen.danada
  // En un borrador sin otro trabajo activo, la línea de exportación sustituye a «Falta…».
  const lineaPaso = lineaExportacion && resumen.estado !== 'lista' && !vivo ? null : d.linea
  const duracion = formatearDuracion(resumen.duracionMs)
  const id = resumen.id
  const tema = temaDeTarjeta(resumen)
  const lineaCola = lineaDeCola(estado, id)
  // La canción de la entrada activa no se puede eliminar ni volver a borrador (spec 02).
  const esActiva = haySesion && estado?.activa?.cancionId === id
  const continuaBloqueado = bloqueo.bloqueada && continuaHaciaEdicion(resumen)
  const textoBloqueo = (nombre: string) => ({
    bloqueado: true,
    ariaEtiqueta: `${nombre}${EDI_BLOQUEO.aria}`
  })
  // Con sesión, la acción principal de una Lista es agregarla al final de la cola.
  const principalEsCola = lista && haySesion

  const abrirMenu = () =>
    raiz.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.click()
  const alPortada = () => {
    // En el modo selección el clic llega a la tarjeta y alterna la casilla.
    if (seleccion) return
    if (resumen.danada) abrirMenu()
    else if (lista) alReproducir()
    else alContinuar()
  }
  const alReproducir = () =>
    principalEsCola ? acciones.agregarAlFinal(id) : acciones.reproducir(id)
  const alEditar = () => bloqueo.intentar(() => acciones.editar(id))
  const alContinuar = () =>
    continuaBloqueado ? bloqueo.intentar(() => acciones.continuar(id)) : acciones.continuar(id)
  const alPrincipal = () => {
    if (d.accion === 'reproducir') alReproducir()
    else if (d.accion === 'reintentar') acciones.reintentar(id)
    else if (d.accion) alContinuar()
  }
  const alEliminar = () => {
    if (esActiva) mostrarToast({ tipo: 'info', mensaje: BIB_COLA.activaBloqueada })
    else acciones.eliminar(id)
  }

  const items: ItemMenu[] = []
  if (lista) {
    if (!haySesion) {
      items.push({
        id: 'reproducir',
        etiqueta: 'Reproducir',
        alSeleccionar: () => acciones.reproducir(id)
      })
      items.push({
        id: 'otraPantalla',
        etiqueta: SES.menuOtraPantalla,
        alSeleccionar: () => acciones.reproducirEnOtraPantalla(id)
      })
    }
    items.push({
      id: 'siguiente',
      etiqueta: BIB_COLA.menu.siguiente,
      alSeleccionar: () => acciones.agregarSiguiente(id)
    })
    items.push({
      id: 'final',
      etiqueta: BIB_COLA.menu.final,
      alSeleccionar: () => acciones.agregarAlFinal(id)
    })
    items.push({
      id: 'editar',
      etiqueta: 'Editar',
      ...(bloqueo.bloqueada ? textoBloqueo('Editar') : null),
      alSeleccionar: alEditar
    })
  } else if (!resumen.danada) {
    items.push({
      id: 'continuar',
      etiqueta: 'Continuar',
      ...(continuaBloqueado ? textoBloqueo('Continuar') : null),
      alSeleccionar: alContinuar
    })
  }
  if (!resumen.danada) {
    items.push({
      id: 'datos',
      etiqueta: 'Editar datos',
      alSeleccionar: () => acciones.editarDatos(id)
    })
  }
  // Fase 6: «Exportar video…» en las Listas; «Ver exportación» si esa canción se está exportando.
  if (!resumen.danada && (lista || exportando)) {
    items.push({
      id: 'exportar',
      etiqueta: exportando ? EXP_MENU.ver : EXP_MENU.exportar,
      icono: Film,
      alSeleccionar: () =>
        exportacion.abrir({
          cancionId: id,
          ...(exportando ? { trabajoId: exportando.trabajoId } : null)
        })
    })
  }
  if (!resumen.danada && acciones.aplicarTema) {
    items.push({
      id: 'aplicarTema',
      etiqueta: 'Aplicar tema…',
      alSeleccionar: () => acciones.aplicarTema?.(id)
    })
  }
  if (lista) {
    items.push({
      id: 'borrador',
      etiqueta: 'Volver a borrador',
      noDisponible: esActiva ? BIB_COLA.activaBloqueada : undefined,
      alSeleccionar: () => acciones.volverABorrador(id)
    })
  }
  if (vivo) {
    items.push({
      id: 'cancelar-trabajo',
      etiqueta: 'Cancelar trabajo',
      alSeleccionar: () => acciones.cancelarTrabajo(id)
    })
  } else if (resumen.danada && resumen.motivo === 'pistas' && !resumen.sinMezcla) {
    items.push({
      id: 'resepararPistas',
      etiqueta: 'Re-separar pistas',
      alSeleccionar: () => acciones.resepararPistas(id)
    })
  }
  items.push({
    id: 'carpeta',
    etiqueta: 'Mostrar en la carpeta',
    alSeleccionar: () => acciones.mostrarEnCarpeta(id)
  })
  if (exportando) {
    items.push({
      id: 'cancelar-exportacion',
      etiqueta: EXP_MENU.cancelar,
      alSeleccionar: () => exportacion.pedirCancelar(exportando.trabajoId)
    })
  }
  items.push({
    id: 'eliminar',
    etiqueta: 'Eliminar…',
    separadorAntes: true,
    destructivo: true,
    noDisponible: esActiva ? BIB_COLA.activaBloqueada : undefined,
    alSeleccionar: () => acciones.eliminar(id)
  })

  return (
    // La tarjeta es el elemento del *roving tabindex*: Intro, Espacio y Menú actúan sobre ella.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <article
      ref={raiz}
      className={estilos.tarjeta}
      data-tarjeta={id}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={activa ? 0 : -1}
      aria-label={`${textoAriaTarjeta(resumen, d)}${lineaExportacion ? ` ${lineaExportacion.texto}.` : ''}${lineaCola ? ` ${lineaCola.replace(/^▶ /, '')}.` : ''}${seleccion?.marcada ? ' Seleccionada.' : ''}`}
      data-seleccionada={seleccion?.marcada || undefined}
      onFocus={(e) => {
        if (e.target === e.currentTarget) alEnfocar(id)
      }}
      onClick={(e) => {
        if (seleccion) seleccion.alAlternar(e.shiftKey)
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (seleccion) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            seleccion.alAlternar(e.shiftKey)
          }
          return
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          alPortada()
        } else if (e.key === ' ') {
          e.preventDefault()
          alPrincipal()
        } else if (
          lista &&
          (e.key === 'e' || e.key === 'E') &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey
        ) {
          e.preventDefault()
          alEditar()
        } else if (e.key === 'Delete') {
          e.preventDefault()
          alEliminar()
        } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
          e.preventDefault()
          abrirMenu()
        }
      }}
    >
      <div className={estilos.portadaEnvoltorio}>
        <Portada resumen={resumen} accion={alPortada} />
        {seleccion && (
          <input
            type="checkbox"
            tabIndex={-1}
            className={estilos.casillaTarjeta}
            aria-label={SEL.casilla(titulo)}
            aria-disabled={!seleccion.editable || undefined}
            title={seleccion.editable ? undefined : SEL.noEditable}
            checked={seleccion.marcada}
            onChange={() => undefined}
          />
        )}
        {lista && !seleccion && (
          <button
            type="button"
            tabIndex={-1}
            className={estilos.botonRedondo}
            data-boton-redondo
            // Duplica la acción principal (y la portada): no se anuncia dos veces.
            aria-hidden="true"
            onClick={alReproducir}
          >
            <Icono icono={principalEsCola ? ListPlus : Play} tamano={24} />
          </button>
        )}
      </div>
      <div className={estilos.cuerpo}>
        <h2 className={`t-subtitulo ${estilos.titulo}`} title={titulo}>
          {titulo}
        </h2>
        {(resumen.artista !== '' || duracion) && (
          <p className={`t-pequeno ${estilos.artista}`}>
            {resumen.artista !== '' && duracion
              ? `${resumen.artista} · ${duracion}`
              : resumen.artista || duracion}
          </p>
        )}
        {tema && (
          <p className={`t-pequeno ${estilos.tema}`} title={tema.texto} data-linea-tema>
            <Icono icono={tema.aviso ? TriangleAlert : Palette} tamano={14} />
            <span>{tema.texto}</span>
          </p>
        )}
        {lineaCola && (
          <p className={`t-pequeno ${estilos.lineaCola}`} data-linea-cola>
            {lineaCola}
          </p>
        )}
        <div className={estilos.filaEstado}>
          <InsigniaEstado estado={d.insignia} ayuda={d.ayudaEstado} />
          {!seleccion && (
            <MenuContextual
              etiqueta={`Más acciones de «${titulo}»`}
              items={items}
              tabIndexDisparador={-1}
            />
          )}
        </div>
        {lineaPaso && <LineaPaso linea={lineaPaso} />}
        {lineaExportacion && <LineaPaso linea={lineaExportacion} />}
        {d.accion && !seleccion && (
          <div className={estilos.accion}>
            <Boton
              variante="secundario"
              tabIndex={-1}
              onClick={alPrincipal}
              aria-label={
                principalEsCola && d.accion === 'reproducir'
                  ? BIB_COLA.botonAria(titulo)
                  : `${ETIQUETA_ACCION[d.accion]} «${titulo}»${
                      d.accion === 'continuar' && continuaBloqueado ? EDI_BLOQUEO.aria : ''
                    }`
              }
              aria-disabled={d.accion === 'continuar' && continuaBloqueado ? true : undefined}
            >
              {d.accion === 'reproducir' && (
                <Icono icono={principalEsCola ? ListPlus : Play} tamano={16} />
              )}
              {principalEsCola && d.accion === 'reproducir'
                ? BIB_COLA.boton
                : ETIQUETA_ACCION[d.accion]}
              {d.accion === 'continuar' && continuaBloqueado && bloqueo.candado}
            </Boton>
            {lista && (
              <Boton
                variante="fantasma"
                tabIndex={-1}
                onClick={alEditar}
                aria-keyshortcuts="E"
                aria-label={`Editar «${titulo}»${bloqueo.bloqueada ? EDI_BLOQUEO.aria : ''}`}
                aria-disabled={bloqueo.bloqueada ? true : undefined}
              >
                <Icono icono={Pencil} tamano={16} />
                Editar
                {bloqueo.candado}
              </Boton>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
