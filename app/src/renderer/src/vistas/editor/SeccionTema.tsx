import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Pencil, TriangleAlert, X } from 'lucide-react'
import type { CatalogoIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { Icono } from '../../componentes/Icono'
import { MenuContextual, type ItemMenu } from '../../componentes/MenuContextual'
import base from '../../componentes/componentes.module.css'
import { SelectorTema } from '../../temas/SelectorTema'
import { TEMA, procedenciaLarga } from '../../temas/textos'
import type { VistaTema } from './aparienciaVista'
import { E } from './textos'
import estilos from './panelEstilo.module.css'

type TemaCatalogo = CatalogoIpc['temas'][number]

/** Dónde queda el foco tras una acción (spec 06, «Componentes e interacciones»). */
export type DestinoFocoTema =
  'selector' | 'radioPersonalizado' | 'radioDefinidos' | 'usarNuevo' | 'editar' | 'banner'

export interface AccionesTema {
  elegir(temaId: string): void
  heredar(): void
  personalizar(): void
  pasarADefinidos(): void
  editar(): void
  guardarEn(): void
  descartar(): void
  guardarNuevo(): void
  usarNuevo(): void
  cerrarNuevoCreado(): void
  renombrar(): void
  duplicar(): void
  temaDelAlbum(): void
  temaDelArtista(): void
  administrar(): void
  eliminar(): void
}

export interface ControlTema {
  vista: VistaTema
  ofrecibles: TemaCatalogo[]
  predeterminadoId: string | null
  /** Álbum y artista visibles de la canción (como en la Biblioteca). */
  grupo: { album: string | null; artista: string | null }
  /** Canciones que usan el tema efectivo (o el que se edita). */
  usos: number
  /** Nombre del tema que se edita en D3. */
  nombreBorrador: string | null
  borradorModificado: boolean
  nuevoCreado: { id: string; nombre: string; tema: string | null; personalizada: boolean } | null
  foco: { destino: DestinoFocoTema; n: number } | null
  acciones: AccionesTema
}

const MARCADOR_INCLUIDO = 'Estilo incluido'

/** ¿Se puede entrar en D3 desde esta vista? */
export function puedeEditarTema(v: VistaTema): boolean {
  return v.estado === 'd1' && v.tema !== null && v.bloqueo === null
}

/** «Editar tema» se ofrece (activo o inactivo con su motivo) salvo con «Estilo incluido» o en D4. */
export function ofreceEditarTema(v: VistaTema): boolean {
  return v.estado !== 'd4' && v.procedencia !== 'incluido' && (v.tema !== null || v.soloLectura)
}

function motivoBloqueo(v: VistaTema): string | undefined {
  if (v.bloqueo === 'solo_lectura') return E.tema.bloqueoSoloLectura
  if (v.bloqueo === 'borrado') return E.tema.bloqueoBorrado
  return undefined
}

/** Sección «Tema» del panel Estilo: modo, selector, procedencia y acciones (D1, D2 y D4; D3 inerte). */
export function SeccionTema({ control, inactivo }: { control: ControlTema; inactivo: boolean }) {
  const { vista, acciones, grupo, foco } = control
  const raiz = useRef<HTMLElement>(null)
  const idProcedencia = useId()
  const idDefinidos = useId()
  const idPersonalizado = useId()
  const editando = vista.estado === 'd3'
  const personalizado = vista.seleccion.modo === 'propio'

  // Efecto pasivo: el diálogo que se cierra devuelve el foco a su disparador en su limpieza, antes.
  useEffect(() => {
    if (!foco) return
    const selector =
      foco.destino === 'selector'
        ? '[aria-haspopup="listbox"]'
        : `[data-foco-tema="${foco.destino}"]`
    raiz.current?.querySelector<HTMLElement>(selector)?.focus()
    // Solo reacciona a una petición nueva de foco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco?.n])

  const contexto = { album: grupo.album, artista: grupo.artista }
  const bloqueo = motivoBloqueo(vista)
  const puedeEditar = puedeEditarTema(vista)

  const procedencia = personalizado
    ? procedenciaLarga('propio')
    : procedenciaLarga(vista.procedencia, contexto)

  // ---------------------------------------------------------------- aviso «tema creado»
  const creado = control.nuevoCreado
  const avisoCreado = creado && (
    <AvisoEnLinea
      tipo="exito"
      accion={
        <BotonIcono icono={X} etiqueta={E.tema.cerrarAviso} onClick={acciones.cerrarNuevoCreado} />
      }
    >
      <p>{E.tema.nuevoCreado(creado.nombre, creado)}</p>
      <Boton data-foco-tema="usarNuevo" onClick={acciones.usarNuevo}>
        {E.tema.usarNuevo(creado.nombre)}
      </Boton>
    </AvisoEnLinea>
  )

  // ---------------------------------------------------------------- menú ⋯ (D1)
  const sinAlbum = !grupo.album
    ? E.tema.sinAlbum
    : !grupo.artista
      ? E.tema.albumSinArtista
      : undefined
  const sinArtista = !grupo.artista ? E.tema.sinArtista : undefined
  const itemsMenu: ItemMenu[] = [
    ...(vista.tema
      ? [
          {
            id: 'renombrar',
            etiqueta: E.tema.renombrar,
            noDisponible: bloqueo,
            alSeleccionar: acciones.renombrar
          },
          {
            id: 'duplicar',
            etiqueta: E.tema.duplicar,
            noDisponible: bloqueo,
            alSeleccionar: acciones.duplicar
          }
        ]
      : []),
    {
      id: 'album',
      etiqueta: E.tema.album,
      separadorAntes: vista.tema !== null,
      noDisponible: vista.soloLectura ? E.tema.bloqueoSoloLectura : sinAlbum,
      alSeleccionar: acciones.temaDelAlbum
    },
    {
      id: 'artista',
      etiqueta: E.tema.artista,
      noDisponible: vista.soloLectura ? E.tema.bloqueoSoloLectura : sinArtista,
      alSeleccionar: acciones.temaDelArtista
    },
    {
      id: 'administrar',
      etiqueta: E.tema.administrar,
      separadorAntes: true,
      alSeleccionar: acciones.administrar
    },
    ...(vista.tema
      ? [
          {
            id: 'eliminar',
            etiqueta: E.tema.eliminar,
            destructivo: true,
            separadorAntes: true,
            noDisponible: bloqueo,
            alSeleccionar: acciones.eliminar
          }
        ]
      : [])
  ]

  // ---------------------------------------------------------------- selector
  const sinNombre = vista.temaNombre
  const marcador =
    vista.estado === 'd4'
      ? E.tema.noDisponibleOpcion(sinNombre)
      : vista.procedencia === 'incluido'
        ? MARCADOR_INCLUIDO
        : vista.tema?.enBorrado
          ? vista.tema.nombre
          : undefined
  const selector = (
    <SelectorTema
      etiqueta={E.tema.selector}
      temas={control.ofrecibles}
      valor={vista.tema && !vista.tema.enBorrado ? vista.tema.id : null}
      predeterminadoId={control.predeterminadoId}
      marcador={marcador}
      descripcionId={idProcedencia}
      alElegir={(id) => {
        if (id) acciones.elegir(id)
      }}
    />
  )

  const bloqueSelector = vista.soloLectura ? (
    <AvisoEnLinea tipo="aviso">{TEMA.soloLectura}</AvisoEnLinea>
  ) : vista.catalogoVacio ? (
    <p className={estilos.ayuda}>{E.tema.catalogoVacio}</p>
  ) : (
    <div inert={editando || inactivo}>{selector}</div>
  )

  // ---------------------------------------------------------------- destino de «Volver a heredar»
  const destino = vista.alHeredar
  const lineaDestino =
    destino.procedencia === 'respaldo' ? (
      <p className={estilos.destino}>
        <span className={estilos.avisoSimbolo} aria-hidden="true">
          ⚠
        </span>{' '}
        {E.tema.destinoRespaldo}
      </p>
    ) : (
      <p className={estilos.destino}>{E.tema.destino(destino, contexto)}</p>
    )

  let cuerpo: ReactNode = null
  if (vista.estado === 'd4') {
    cuerpo = (
      <>
        <div className={`${base.banner} ${base.aviso}`} data-d4="">
          <Icono icono={TriangleAlert} className={base.bannerIcono} />
          <div className={base.bannerTexto}>
            <h4 className={estilos.tituloBanner}>{E.tema.noDisponibleTitulo}</h4>
            <p>{E.tema.noDisponibleCuerpo(vista.temaNombre)}</p>
            <div className={estilos.acciones}>
              <Boton
                noDisponible={vista.soloLectura ? E.tema.bloqueoSoloLectura : undefined}
                onClick={acciones.guardarNuevo}
              >
                {E.tema.guardarNuevo}
              </Boton>
              <Boton data-foco-tema="personalizar" onClick={acciones.personalizar}>
                {E.tema.noDisponiblePersonalizar}
              </Boton>
            </div>
          </div>
        </div>
        {bloqueSelector}
      </>
    )
  } else if (!personalizado) {
    cuerpo = (
      <>
        {bloqueSelector}
        <p id={idProcedencia} className={estilos.procedencia}>
          {procedencia}
        </p>
        {vista.tema && <p className={estilos.usos}>{TEMA.usos(vista.tema.usos.total)}</p>}
        {vista.tema?.enBorrado && !vista.soloLectura && (
          <AvisoEnLinea
            tipo="aviso"
            accion={<Boton onClick={acciones.administrar}>{E.tema.administrar}</Boton>}
          >
            {TEMA.borradoPendiente}
          </AvisoEnLinea>
        )}
        {vista.procedencia === 'cancion' && !editando && (
          <div className={estilos.heredar}>
            <Boton onClick={acciones.heredar}>{E.tema.heredar}</Boton>
            {lineaDestino}
          </div>
        )}
        <div className={estilos.filaAcciones} inert={editando || inactivo}>
          <Boton data-foco-tema="personalizar" onClick={acciones.personalizar}>
            {E.tema.personalizar}
          </Boton>
          {ofreceEditarTema(vista) && (
            <Boton
              data-foco-tema="editar"
              noDisponible={puedeEditar ? undefined : (bloqueo ?? E.tema.sinTemaQueEditar)}
              onClick={acciones.editar}
            >
              {E.tema.editar}
            </Boton>
          )}
          {vista.estado === 'd1' && !vista.catalogoVacio && (
            <MenuContextual etiqueta={E.tema.mas} items={itemsMenu} />
          )}
        </div>
      </>
    )
  } else {
    cuerpo = (
      <>
        <p id={idProcedencia} className={estilos.procedencia}>
          {procedencia}
        </p>
        <div>
          <Boton
            noDisponible={vista.soloLectura ? E.tema.bloqueoSoloLectura : undefined}
            onClick={acciones.guardarNuevo}
          >
            {E.tema.guardarNuevo}
          </Boton>
        </div>
      </>
    )
  }

  return (
    <section ref={raiz} className={estilos.bloque} aria-labelledby={`${idProcedencia}-titulo`}>
      <h3 id={`${idProcedencia}-titulo`}>{E.tema.titulo}</h3>
      {avisoCreado}
      {editando && (
        <div className={`${base.banner} ${base.info}`}>
          <Icono icono={Pencil} className={base.bannerIcono} />
          <div
            className={base.bannerTexto}
            tabIndex={-1}
            data-foco-tema="banner"
            aria-label={E.tema.editandoTitulo(control.nombreBorrador ?? '')}
          >
            <h4 className={estilos.tituloBanner}>
              {E.tema.editandoTitulo(control.nombreBorrador ?? '')}
            </h4>
            <p>{E.tema.editandoCuerpo(control.usos)}</p>
          </div>
        </div>
      )}
      <div
        role="radiogroup"
        aria-label={E.tema.modo}
        className={estilos.modos}
        inert={editando || inactivo}
      >
        <label className={estilos.modo}>
          <input
            type="radio"
            name={`modo-${idProcedencia}`}
            data-foco-tema="radioDefinidos"
            checked={!personalizado}
            aria-describedby={idDefinidos}
            onChange={() => {
              if (personalizado) acciones.pasarADefinidos()
            }}
          />
          <span>{E.tema.definidos}</span>
        </label>
        <p id={idDefinidos} className={estilos.ayuda}>
          {E.tema.definidosDesc}
        </p>
        <label className={estilos.modo}>
          <input
            type="radio"
            name={`modo-${idProcedencia}`}
            data-foco-tema="radioPersonalizado"
            checked={personalizado}
            aria-describedby={idPersonalizado}
            onChange={() => {
              if (!personalizado) acciones.personalizar()
            }}
          />
          <span>{E.tema.personalizado}</span>
        </label>
        <p id={idPersonalizado} className={estilos.ayuda}>
          {E.tema.personalizadoDesc}
        </p>
      </div>
      {cuerpo}
    </section>
  )
}
