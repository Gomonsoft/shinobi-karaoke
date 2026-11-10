import { useState, type ActionDispatch } from 'react'
import { claveTexto } from '@shared/identidad'
import type { ResumenCancionIpc } from '@shared/ipc'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion, vistaAjustesDesde } from '../../navegacion/estado'
import { DialogoEliminarTema } from '../../temas/DialogoEliminarTema'
import { DialogoNombreTema, type ModoNombreTema } from '../../temas/DialogoNombreTema'
import { DialogoTemaGrupo } from '../../temas/DialogoTemaGrupo'
import { BIB_GRUPO, TEMA } from '../../temas/textos'
import { useCatalogoTemas } from '../../temas/useCatalogoTemas'
import { estiloVisible, vistaTema, type EntradaVista } from './aparienciaVista'
import { type AccionEditor, type AparienciaEditor, type EstadoEditor } from './estado'
import type { ControlTema, DestinoFocoTema } from './SeccionTema'
import { E } from './textos'
import { useBorradorTema } from './useBorradorTema'

interface Opciones {
  resumen: ResumenCancionIpc
  edicion: EstadoEditor
  despachar: ActionDispatch<[AccionEditor]>
  anunciar(texto: string): void
  refrescarResumen(): Promise<void>
}

type DialogoNombre = { modo: ModoNombreTema } | null

const ahora = (): number => Date.now()

function copiar(err: unknown): void {
  const e = err as { codigo?: string; mensaje?: string } | null
  void navigator.clipboard
    ?.writeText(`${e?.codigo ?? 'ERROR_INTERNO'}: ${e?.mensaje ?? ''}`)
    .catch(() => undefined)
}

function avisarError(err: unknown): void {
  mostrarToast({
    tipo: 'error',
    mensaje: TEMA.toastError,
    accion: { etiqueta: TEMA.copiarDetalles, alAccionar: () => copiar(err) }
  })
}

/**
 * Sección «Tema» del panel Estilo (0170) y edición del tema (0171): reúne la lectura de la
 * apariencia, las acciones y los diálogos. El historial y el estado viven en el reducer del editor.
 */
export function useTemaEditor({
  resumen,
  edicion,
  despachar,
  anunciar,
  refrescarResumen
}: Opciones) {
  const { vista: vistaNavegacion, ir } = useNavegacion()
  const catalogo = useCatalogoTemas()
  const { apariencia, borrador } = edicion.actual
  const [foco, setFoco] = useState<{ destino: DestinoFocoTema; n: number } | null>(null)
  const [nombre, setNombre] = useState<DialogoNombre>(null)
  const [eliminar, setEliminar] = useState<{ id: string; nombre: string } | null>(null)
  const [grupoNivel, setGrupoNivel] = useState<'artista' | 'album' | null>(null)
  const [creado, setCreado] = useState<{
    id: string
    nombre: string
    tema: string | null
    personalizada: boolean
    clave: string
  } | null>(null)

  const entrada: EntradaVista = {
    seleccion: apariencia.seleccion,
    estiloPropio: apariencia.estilo,
    resumen,
    catalogo: catalogo.catalogo,
    borrador
  }
  const vista = vistaTema(entrada)
  const visible = estiloVisible(entrada)
  const claveSeleccion = JSON.stringify(apariencia.seleccion)

  function pedirFoco(destino: DestinoFocoTema): void {
    setFoco((f) => ({ destino, n: (f?.n ?? 0) + 1 }))
  }

  const bd = useBorradorTema({
    borrador,
    despachar,
    anunciar,
    refrescarResumen,
    alFoco: pedirFoco,
    alGuardarNuevo: () => setNombre({ modo: 'nuevo' })
  })

  function aplicar(nueva: AparienciaEditor, clave: string): void {
    despachar({ tipo: 'apariencia', apariencia: nueva, clave, ahora: ahora() })
  }

  const acciones: ControlTema['acciones'] = {
    elegir(temaId) {
      const tema = catalogo.catalogo?.temas.find((t) => t.id === temaId)
      aplicar({ seleccion: { modo: 'tema', temaId }, estilo: apariencia.estilo }, 'tema')
      setCreado(null)
      if (tema) anunciar(E.tema.anuncioAsignado(tema.nombre))
    },
    heredar() {
      aplicar({ seleccion: { modo: 'heredar' }, estilo: apariencia.estilo }, 'heredar')
      setCreado(null)
      anunciar(E.tema.anuncioHeredar(vista.alHeredar))
      pedirFoco('selector')
    },
    personalizar() {
      aplicar({ seleccion: { modo: 'propio' }, estilo: visible }, 'personalizar')
      setCreado(null)
      anunciar(E.tema.anuncioPersonalizado)
      pedirFoco('radioPersonalizado')
    },
    pasarADefinidos() {
      const destino = vista.alHeredar
      aplicar({ seleccion: { modo: 'heredar' }, estilo: apariencia.estilo }, 'definidos')
      setCreado(null)
      mostrarToast({
        tipo: 'info',
        mensaje: E.tema.toastDefinidos(destino),
        accion: {
          etiqueta: E.tema.deshacerToast,
          alAccionar: () => despachar({ tipo: 'deshacer' })
        }
      })
    },
    editar() {
      if (vista.tema) bd.entrar(vista.tema)
    },
    guardarEn: bd.guardarEn,
    descartar: bd.descartar,
    guardarNuevo: () => setNombre({ modo: 'nuevo' }),
    usarNuevo() {
      if (!creado) return
      aplicar({ seleccion: { modo: 'tema', temaId: creado.id }, estilo: apariencia.estilo }, 'tema')
      anunciar(E.tema.anuncioAsignado(creado.nombre))
      setCreado(null)
      pedirFoco('selector')
    },
    cerrarNuevoCreado() {
      setCreado(null)
      pedirFoco('selector')
    },
    renombrar: () => setNombre({ modo: 'renombrar' }),
    duplicar: () => setNombre({ modo: 'duplicar' }),
    temaDelAlbum: () => setGrupoNivel('album'),
    temaDelArtista: () => setGrupoNivel('artista'),
    administrar: () => ir(vistaAjustesDesde(vistaNavegacion, 'temas')),
    eliminar: () => {
      if (vista.tema) setEliminar({ id: vista.tema.id, nombre: vista.tema.nombre })
    }
  }

  // ------------------------------------------------------------------ diálogo de nombre
  const tituloCancion = resumen.titulo
  const todos = catalogo.catalogo?.temas ?? []
  const modoNombre = nombre?.modo
  const propuesta =
    modoNombre === 'duplicar'
      ? TEMA.nombre.copia(vista.tema?.nombre ?? '')
      : modoNombre === 'renombrar'
        ? (vista.tema?.nombre ?? '')
        : borrador
          ? TEMA.nombre.copia(borrador.nombre)
          : vista.estado === 'd4' && vista.temaNombre
            ? vista.temaNombre
            : TEMA.nombre.cancion(tituloCancion)
  const ayudaNombre =
    modoNombre === 'duplicar'
      ? TEMA.nombre.ayudaDuplicar(vista.tema?.nombre ?? '')
      : modoNombre === 'nuevo'
        ? borrador
          ? TEMA.nombre.ayudaNuevoTema(borrador.nombre)
          : TEMA.nombre.ayudaNuevoCancion
        : undefined

  async function confirmarNombre(texto: string): Promise<void> {
    if (!nombre) return
    if (nombre.modo === 'renombrar') {
      const tema = vista.tema
      if (!tema) return
      const nuevo = await window.shinobi.temas.renombrar({
        temaId: tema.id,
        revisionTema: tema.revision,
        nombre: texto
      })
      setNombre(null)
      mostrarToast({ tipo: 'exito', mensaje: TEMA.toastRenombrado(nuevo.nombre) })
      pedirFoco('selector')
      return
    }
    const nuevo =
      nombre.modo === 'duplicar' && vista.tema
        ? await window.shinobi.temas.duplicar({ temaId: vista.tema.id, nombre: texto })
        : await window.shinobi.temas.crear({ nombre: texto, estilo: visible })
    await catalogo.recargar()
    if (borrador) bd.salir()
    setNombre(null)
    setCreado({
      id: nuevo.id,
      nombre: nuevo.nombre,
      tema: vista.tema?.nombre ?? vista.temaNombre,
      personalizada: apariencia.seleccion.modo === 'propio',
      clave: claveSeleccion
    })
    anunciar(TEMA.toastCreado(nuevo.nombre))
    pedirFoco('usarNuevo')
  }

  // ------------------------------------------------------------------ grupo
  const grupoArtista = resumen.artista.trim() === '' ? null : resumen.artista
  const grupoAlbum = resumen.album && resumen.album.trim() !== '' ? resumen.album : null
  const asign = catalogo.catalogo?.asignaciones
  const temaActualGrupo =
    grupoNivel === 'artista'
      ? (asign?.artistas.find((a) => claveTexto(a.artista) === claveTexto(grupoArtista))?.temaId ??
        null)
      : grupoNivel === 'album'
        ? (asign?.albumes.find(
            (a) =>
              claveTexto(a.artista) === claveTexto(grupoArtista) &&
              claveTexto(a.album) === claveTexto(grupoAlbum)
          )?.temaId ?? null)
        : null

  const control: ControlTema = {
    vista,
    ofrecibles: catalogo.ofrecibles,
    predeterminadoId: catalogo.catalogo?.predeterminado ?? null,
    grupo: { album: grupoAlbum, artista: grupoArtista },
    usos: (borrador ? todos.find((t) => t.id === borrador.temaId) : vista.tema)?.usos.total ?? 0,
    nombreBorrador: borrador?.nombre ?? null,
    borradorModificado: bd.modificado,
    nuevoCreado: creado && creado.clave === claveSeleccion ? creado : null,
    foco,
    acciones
  }

  const dialogos = (
    <>
      {bd.dialogos}
      <DialogoNombreTema
        abierto={nombre !== null}
        modo={modoNombre ?? 'nuevo'}
        propuesta={propuesta}
        existentes={todos}
        excluirId={modoNombre === 'renombrar' ? vista.tema?.id : undefined}
        ayuda={ayudaNombre}
        onCancelar={() => {
          setNombre(null)
          pedirFoco(
            borrador ? 'banner' : modoNombre === 'nuevo' ? 'radioPersonalizado' : 'selector'
          )
        }}
        onConfirmar={confirmarNombre}
        onError={avisarError}
      />
      {eliminar && (
        <DialogoEliminarTema
          abierto
          temaId={eliminar.id}
          temaNombre={eliminar.nombre}
          onCancelar={() => {
            setEliminar(null)
            pedirFoco('selector')
          }}
          onEliminado={(_r, convertidas) => {
            const afectada = vista.temaId === eliminar.id
            setEliminar(null)
            mostrarToast({
              tipo: 'exito',
              mensaje: TEMA.toastEliminado(eliminar.nombre, convertidas)
            })
            despachar({
              tipo: 'tema_eliminado',
              temaId: eliminar.id,
              estilo: afectada ? visible : null
            })
            void refrescarResumen()
            if (afectada) {
              anunciar(E.tema.anuncioEliminadoEsta)
              pedirFoco('radioPersonalizado')
            } else pedirFoco('selector')
          }}
          onBorradoCancelado={(k) => {
            mostrarToast({ tipo: 'info', mensaje: TEMA.toastBorradoCancelado(eliminar.nombre, k) })
            setEliminar(null)
            pedirFoco('selector')
          }}
          onError={avisarError}
        />
      )}
      {grupoNivel && grupoArtista && (
        <DialogoTemaGrupo
          abierto
          nivel={grupoNivel}
          artista={grupoArtista}
          album={grupoNivel === 'album' ? (grupoAlbum ?? undefined) : undefined}
          temaActualId={temaActualGrupo}
          temas={catalogo.ofrecibles}
          predeterminadoId={catalogo.catalogo?.predeterminado ?? null}
          onCancelar={() => {
            setGrupoNivel(null)
            pedirFoco('selector')
          }}
          onAplicado={(_r, tema) => {
            const nivel = grupoNivel
            setGrupoNivel(null)
            mostrarToast({
              tipo: 'exito',
              mensaje: BIB_GRUPO.toast(
                nivel,
                nivel === 'album' ? (grupoAlbum ?? '') : grupoArtista,
                tema?.nombre ?? null
              )
            })
            void refrescarResumen()
            pedirFoco('selector')
          }}
          onError={avisarError}
        />
      )}
    </>
  )

  return {
    control,
    estiloVisible: visible,
    editando: borrador !== null,
    borradorModificado: bd.modificado,
    pedirSalida: bd.pedirSalida,
    dialogos
  }
}
