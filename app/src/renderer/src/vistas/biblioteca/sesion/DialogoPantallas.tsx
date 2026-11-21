import { useEffect, useRef, useState } from 'react'
import type { AbrirSesion, ListaPantallasIpc } from '@shared/sesion'
import { AvisoEnLinea } from '../../../componentes/AvisoEnLinea'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { enfocarPanelColaCuandoEste } from '../../../sesion/foco'
import {
  useSesion,
  type InicioDialogoPantallas,
  type PeticionDialogoPantallas
} from '../../../sesion/ProveedorSesion'
import { SES } from '../../../sesion/textos'
import { textoEmpieza, type CancionDeInicio } from './empieza'
import { completaPorDefecto, preseleccionarPantalla, type PantallaGuardada } from './preseleccion'
import estilos from './sesion.module.css'

type ErrorApertura = 'abrir' | 'guardando' | 'noDisponible'

const codigoDe = (err: unknown): string =>
  err && typeof err === 'object' && 'codigo' in err && typeof err.codigo === 'string'
    ? err.codigo
    : ''

const SIN_PANTALLAS: ListaPantallasIpc = { pantallas: [], colocacion: 'libre' }

interface DialogoPantallasProps {
  inicio: InicioDialogoPantallas
  /** Datos de la canción pedida con «Reproducir en otra pantalla…»; el diálogo no los busca. */
  cancion?: { titulo: string; artista: string }
  alCerrar(): void
}

/**
 * «Abrir el reproductor en otra pantalla» (spec 02, fase 4): elige pantalla y modo, y abre la
 * sesión (`sesion.abrir`) o, con `inicio: 'mover'`, mueve la ventana (`sesion.moverAPantalla`).
 */
export function DialogoPantallas({ inicio, cancion, alCerrar }: DialogoPantallasProps) {
  const { estado, pantallas: deContexto, acciones, abrirPanel } = useSesion()
  const mover = inicio === 'mover'
  // Recarga local (PANTALLA_NO_DISPONIBLE o sin lista inicial): vale hasta el siguiente evento.
  const [recarga, setRecarga] = useState<{
    base: ListaPantallasIpc | null
    lista: ListaPantallasIpc
  } | null>(null)
  const recargada = recarga && recarga.base === deContexto ? recarga.lista : null
  const lista = recargada ?? deContexto ?? SIN_PANTALLAS
  const [guardada, setGuardada] = useState<PantallaGuardada | null>(null)
  const [elegidaId, setElegidaId] = useState<number | null>(null)
  const [completaManual, setCompletaManual] = useState<boolean | null>(null)
  const [desaparecida, setDesaparecida] = useState(false)
  const [error, setError] = useState<ErrorApertura | null>(null)
  const [abriendo, setAbriendo] = useState(false)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  // Sin lista inicial (aún no ha llegado), se pide aquí.
  useEffect(() => {
    if (deContexto) return
    let activo = true
    void Promise.resolve()
      .then(() => window.shinobi.pantallas.listar())
      .then((l) => activo && setRecarga({ base: null, lista: l }))
      .catch(() => undefined)
    return () => {
      activo = false
    }
  }, [deContexto])

  useEffect(() => {
    let activo = true
    void Promise.resolve()
      .then(() => window.shinobi.config.obtener())
      .then((c) => activo && setGuardada(c.reproductor.secundaria))
      .catch(() => undefined)
    return () => {
      activo = false
    }
  }, [])

  const wayland = lista.colocacion === 'sistema'
  // Al mover, la inicial es la pantalla donde está ahora la sesión, si se conoce.
  const actualId = mover ? (estado?.sesion?.pantalla?.id ?? null) : null
  const inicial =
    lista.pantallas.find((p) => p.id === actualId) ?? preseleccionarPantalla(lista, guardada)

  // Si desaparece la elegida (también la preseleccionada), se vuelve a la inicial y se avisa.
  const ultimaElegida = useRef<number | null>(null)
  useEffect(() => {
    const id = ultimaElegida.current
    if (id !== null && !lista.pantallas.some((p) => p.id === id)) {
      setElegidaId(null)
      setCompletaManual(null)
      setDesaparecida(true)
    }
  }, [lista])

  const elegida = lista.pantallas.find((p) => p.id === elegidaId) ?? inicial
  useEffect(() => {
    ultimaElegida.current = elegida?.id ?? null
  })
  const completa = completaManual ?? completaPorDefecto(lista, elegida, guardada)
  const hayVarias = lista.pantallas.length > 1

  const titulo = cancion ?? null
  const cancionDeInicio: CancionDeInicio | null =
    typeof inicio === 'object' && titulo ? { cancionId: inicio.cancionId, ...titulo } : null

  const elegir = (id: number) => {
    setElegidaId(id)
    setCompletaManual(null)
    setDesaparecida(false)
    setError(null)
  }

  const exito = () => {
    abrirPanel()
    alCerrar()
    enfocarPanelColaCuandoEste()
  }

  const abrir = async () => {
    if (abriendo) return
    setAbriendo(true)
    setError(null)
    // Wayland: el sistema decide la posición; main ignora la pantalla y abre en ventana.
    const pantallaId = elegida?.id ?? lista.pantallas[0]?.id ?? 0
    try {
      if (mover) {
        await acciones.moverAPantalla(pantallaId)
      } else {
        const peticion: AbrirSesion = {
          pantallaId,
          pantallaCompleta: wayland ? false : completa,
          inicio:
            typeof inicio === 'object'
              ? { tipo: 'cancion', cancionId: inicio.cancionId, donde: 'ahora' }
              : { tipo: inicio }
        }
        await acciones.abrir(peticion)
      }
      exito()
    } catch (err) {
      const codigo = codigoDe(err)
      if (codigo === 'SESION_EN_CURSO') {
        exito()
        return
      }
      if (!montado.current) return
      if (codigo === 'PANTALLA_NO_DISPONIBLE') {
        void Promise.resolve()
          .then(() => window.shinobi.pantallas.listar())
          .then((l) => montado.current && setRecarga({ base: deContexto, lista: l }))
          .catch(() => undefined)
      }
      setError(
        codigo === 'GUARDADO_PENDIENTE'
          ? 'guardando'
          : codigo === 'CANCION_NO_DISPONIBLE'
            ? 'noDisponible'
            : 'abrir'
      )
      setAbriendo(false)
    }
  }

  return (
    <Dialogo
      abierto
      titulo={mover ? SES.cambiar : SES.dialogoTitulo}
      ancho="35rem"
      onCancelar={alCerrar}
      enfoqueInicial="input[type='radio']:checked"
      acciones={
        <>
          <Boton onClick={alCerrar}>{SES.boton.cancelar}</Boton>
          <Boton
            variante="primario"
            cargando={abriendo}
            textoCargando={SES.boton.abriendo}
            onClick={() => void abrir()}
          >
            {mover ? SES.mover : SES.boton.abrir}
          </Boton>
        </>
      }
    >
      <div className={estilos.cuerpo}>
        {wayland ? (
          <AvisoEnLinea tipo="info">{SES.wayland}</AvisoEnLinea>
        ) : (
          <>
            <fieldset className={estilos.grupo}>
              <legend className="t-cuerpo-fuerte">{SES.dialogoPantalla}</legend>
              {lista.pantallas.map((p, i) => {
                const notas = [
                  p.principal ? SES.pantallaPrincipal : null,
                  p.conVentanaPrincipal ? SES.pantallaAqui : null
                ].filter(Boolean)
                return (
                  <label key={p.id} className={estilos.opcion}>
                    <input
                      type="radio"
                      name="pantalla-reproductor"
                      checked={elegida?.id === p.id}
                      onChange={() => elegir(p.id)}
                    />
                    <span className={estilos.opcionTexto}>
                      <span>{SES.pantallaOpcion(i + 1, p.etiqueta || null, p.ancho, p.alto)}</span>
                      {notas.length > 0 && (
                        <span className={`t-pequeno ${estilos.opcionNota}`}>
                          {notas.join(' · ')}
                        </span>
                      )}
                    </span>
                  </label>
                )
              })}
            </fieldset>
            {desaparecida && (
              <div role="alert">
                <AvisoEnLinea tipo="aviso">{SES.pantallaDesaparecida}</AvisoEnLinea>
              </div>
            )}
            {!hayVarias && lista.pantallas.length > 0 && (
              <AvisoEnLinea tipo="info">{SES.unaPantalla}</AvisoEnLinea>
            )}
            {!mover && (
              <label className={estilos.casilla}>
                <input
                  type="checkbox"
                  checked={completa}
                  onChange={(e) => setCompletaManual(e.target.checked)}
                />
                <span>{SES.completa}</span>
              </label>
            )}
            {!mover && elegida?.conVentanaPrincipal && (
              <AvisoEnLinea tipo="info">{SES.completaMisma}</AvisoEnLinea>
            )}
          </>
        )}
        {!mover && <p className={`t-pequeno ${estilos.nota}`}>{SES.audio}</p>}
        {!mover && <p className={estilos.empieza}>{textoEmpieza(estado, cancionDeInicio)}</p>}
        {!mover && <p className={`t-pequeno ${estilos.nota}`}>{SES.bloqueoNota}</p>}
        {error === 'abrir' && (
          <AvisoEnLinea
            tipo="error"
            accion={<Boton onClick={() => void abrir()}>{SES.reintentar}</Boton>}
          >
            {SES.errorAbrir}
          </AvisoEnLinea>
        )}
        {error === 'guardando' && (
          <AvisoEnLinea
            tipo="error"
            accion={<Boton onClick={() => void abrir()}>{SES.reintentar}</Boton>}
          >
            {SES.errorGuardando}
          </AvisoEnLinea>
        )}
        {error === 'noDisponible' && (
          <AvisoEnLinea tipo="error">{SES.errorNoDisponible(cancion?.titulo ?? '')}</AvisoEnLinea>
        )}
      </div>
    </Dialogo>
  )
}

/**
 * Pinta el diálogo cuando alguien lo ha pedido con `abrirDialogoPantallas` (panel, tarjeta o
 * cabecera). Lo monta la Biblioteca. `buscar` resuelve el título y el artista de la canción pedida.
 */
export function DialogoPantallasPedido({
  buscar
}: {
  buscar(cancionId: string): { titulo: string; artista: string } | undefined
}) {
  const { dialogoPantallas, cerrarDialogoPantallas } = useSesion()
  if (!dialogoPantallas) return null
  return (
    <DialogoPantallasAbierto
      peticion={dialogoPantallas}
      buscar={buscar}
      alCerrar={cerrarDialogoPantallas}
    />
  )
}

function DialogoPantallasAbierto({
  peticion,
  buscar,
  alCerrar
}: {
  peticion: PeticionDialogoPantallas
  buscar(cancionId: string): { titulo: string; artista: string } | undefined
  alCerrar(): void
}) {
  const { inicio } = peticion
  const cancion = typeof inicio === 'object' ? buscar(inicio.cancionId) : undefined
  return <DialogoPantallas inicio={inicio} cancion={cancion} alCerrar={alCerrar} />
}
