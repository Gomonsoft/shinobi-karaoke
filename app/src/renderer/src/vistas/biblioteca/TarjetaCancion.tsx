import { useRef } from 'react'
import { Play, TriangleAlert } from 'lucide-react'
import { estiloPredeterminado, type Estilo } from '@shared/estilo'
import type { ResumenCancionIpc } from '@shared/ipc'
import { fondoCss } from '../../karaoke/estiloCss'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { InsigniaEstado } from '../../componentes/InsigniaEstado'
import { MenuContextual, type ItemMenu } from '../../componentes/MenuContextual'
import { useCuentaAtras } from '../../trabajos/useCuentaAtras'
import { LineaPaso } from './LineaPaso'
import {
  datosDeTarjeta,
  formatearDuracion,
  textoAriaTarjeta,
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
  /** `config.estilo_predeterminado` vigente (para decidir la miniatura). */
  estiloUsuario?: Estilo | null
}

function Portada({
  resumen,
  accion,
  estiloUsuario
}: {
  resumen: ResumenCancionIpc
  accion: () => void
  estiloUsuario?: Estilo | null
}) {
  const titulo = tituloDeTarjeta(resumen)
  const miniatura = usaMiniatura(resumen, estiloUsuario)
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
  estiloUsuario
}: TarjetaProps) {
  const titulo = tituloDeTarjeta(resumen)
  const raiz = useRef<HTMLElement>(null)
  const esperaS = useCuentaAtras(vivo?.progreso ?? vivo?.trabajo.progreso, vivo?.trabajo.id)
  const d = datosDeTarjeta(resumen, vivo ? { ...vivo, esperaS } : vivo)
  const lista = resumen.estado === 'lista' && !resumen.danada
  const duracion = formatearDuracion(resumen.duracionMs)
  const id = resumen.id

  const abrirMenu = () =>
    raiz.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.click()
  const alPortada = () => {
    if (resumen.danada) abrirMenu()
    else if (lista) acciones.reproducir(id)
    else acciones.continuar(id)
  }
  const alPrincipal = () => {
    if (d.accion === 'reproducir') acciones.reproducir(id)
    else if (d.accion === 'reintentar') acciones.reintentar(id)
    else if (d.accion) acciones.continuar(id)
  }

  const items: ItemMenu[] = []
  if (lista) {
    items.push({
      id: 'reproducir',
      etiqueta: 'Reproducir',
      alSeleccionar: () => acciones.reproducir(id)
    })
    items.push({ id: 'editar', etiqueta: 'Editar', alSeleccionar: () => acciones.editar(id) })
  } else if (!resumen.danada) {
    items.push({
      id: 'continuar',
      etiqueta: 'Continuar',
      alSeleccionar: () => acciones.continuar(id)
    })
  }
  if (!resumen.danada) {
    items.push({
      id: 'datos',
      etiqueta: 'Editar datos',
      alSeleccionar: () => acciones.editarDatos(id)
    })
  }
  if (lista) {
    items.push({
      id: 'borrador',
      etiqueta: 'Volver a borrador',
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
  items.push({
    id: 'eliminar',
    etiqueta: 'Eliminar…',
    separadorAntes: true,
    destructivo: true,
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
      aria-label={textoAriaTarjeta(resumen, d)}
      onFocus={(e) => {
        if (e.target === e.currentTarget) alEnfocar(id)
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter') {
          e.preventDefault()
          alPortada()
        } else if (e.key === ' ') {
          e.preventDefault()
          alPrincipal()
        } else if (e.key === 'Delete') {
          e.preventDefault()
          acciones.eliminar(id)
        } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
          e.preventDefault()
          abrirMenu()
        }
      }}
    >
      <div className={estilos.portadaEnvoltorio}>
        <Portada resumen={resumen} accion={alPortada} estiloUsuario={estiloUsuario} />
        {lista && (
          <button
            type="button"
            tabIndex={-1}
            className={estilos.botonRedondo}
            data-boton-redondo
            // Duplica la acción principal (y la portada): no se anuncia dos veces.
            aria-hidden="true"
            onClick={() => acciones.reproducir(id)}
          >
            <Icono icono={Play} tamano={24} />
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
        <div className={estilos.filaEstado}>
          <InsigniaEstado estado={d.insignia} />
          <MenuContextual
            etiqueta={`Más acciones de «${titulo}»`}
            items={items}
            tabIndexDisparador={-1}
          />
        </div>
        {d.linea && <LineaPaso linea={d.linea} />}
        {d.accion && (
          <div className={estilos.accion}>
            <Boton
              variante="secundario"
              tabIndex={-1}
              onClick={alPrincipal}
              aria-label={`${ETIQUETA_ACCION[d.accion]} «${titulo}»`}
            >
              {d.accion === 'reproducir' && <Icono icono={Play} tamano={16} />}
              {ETIQUETA_ACCION[d.accion]}
            </Boton>
          </div>
        )}
      </div>
    </article>
  )
}
