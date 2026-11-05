import { useCallback, useEffect, useRef, useState } from 'react'
import type { EstadoRuntimeIpc, EstimacionSeparacion, RequisitosRuntimeIpc } from '@shared/ipc'
import { mostrarToast } from '../../componentes/gestorToasts'
import { useNavegacion } from '../../navegacion/estado'
import {
  acumuladoVacio,
  acumular,
  decidirPantalla,
  mensajeModo,
  nombreModoFinal,
  NOMBRE_FASE,
  textoDeError,
  textoTiempoListo,
  type Pantalla
} from './modelo'
import {
  Bienvenida,
  Comprobando,
  Logotipo,
  NoCompatible,
  Reanudar,
  useLicencias
} from './PantallasInicio'
import { DialogoPausar, ErrorInstalacion, Instalando, TodoListo } from './PantallasInstalacion'
import { PA } from './textos'
import estilos from './primerArranque.module.css'

/** Resaltado `aviso` del mensaje de rebaja de modo (ux/01). */
export const DURACION_REBAJA_MS = 4000

type OrigenPausa = 'local' | 'solicitud'

/**
 * Vista Primer arranque (0037): decide entre B0–B6b según el estado del runtime (0036) y conduce
 * la instalación. Al terminar, "Empezar" abre la Biblioteca; si la instalación ya estaba completa
 * (B0 correcto), se abre directamente.
 */
export function PrimerArranque() {
  const { ir } = useNavegacion()
  const api = window.shinobi
  const [estado, setEstado] = useState<EstadoRuntimeIpc | null>(null)
  const [requisitos, setRequisitos] = useState<RequisitosRuntimeIpc | null>(null)
  const [comprobando, setComprobando] = useState(false)
  const [sesion, setSesion] = useState(false)
  const [iniciando, setIniciando] = useState(false)
  const [acumulado, setAcumulado] = useState(acumuladoVacio)
  const [pausa, setPausa] = useState<OrigenPausa | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const [rebajaResaltada, setRebajaResaltada] = useState(false)
  const [estimacion, setEstimacion] = useState<EstimacionSeparacion>(null)
  const licencias = useLicencias()

  const pantalla: Pantalla = decidirPantalla({ estado, requisitos, sesion, iniciando })
  const pantallaRef = useRef(pantalla)
  const pausaRef = useRef(pausa)
  useEffect(() => {
    pantallaRef.current = pantalla
    pausaRef.current = pausa
  })

  // Estado del runtime: se suscribe antes de leer, y una lectura tardía no pisa un evento más nuevo.
  useEffect(() => {
    let activo = true
    let hayEvento = false
    const baja = api.runtime.alCambiar((e) => {
      hayEvento = true
      setEstado(e)
      if (e.estado === 'en_curso' || e.estado === 'completa') setIniciando(false)
    })
    api.runtime.estado().then(
      (e) => activo && !hayEvento && setEstado(e),
      () => undefined
    )
    api.runtime.requisitos({ recalcularEspacio: false }).then(
      (r) => activo && setRequisitos(r),
      () => undefined
    )
    return () => {
      activo = false
      baja()
    }
  }, [api])

  // Progreso: solo se acumula mientras se muestra B2.
  useEffect(
    () =>
      api.runtime.alProgreso((p) => {
        if (pantallaRef.current === 'b2') setAcumulado((a) => acumular(a, p, Date.now()))
      }),
    [api]
  )

  // La instalación ya estaba completa y verificada: directamente a la Biblioteca (sin B3).
  useEffect(() => {
    if (pantalla === 'biblioteca') ir({ tipo: 'biblioteca' })
  }, [pantalla, ir])

  // Solicitud de cierre de main (0036): con instalación en curso abre el diálogo; si no, se cierra.
  useEffect(
    () =>
      api.app.alSolicitudCierre(() => {
        if (pantallaRef.current === 'b2') setPausa('solicitud')
        else void api.app.confirmarCierre()
      }),
    [api]
  )

  // Esc en B2 = "Pausar y salir"; en B0 no hace nada.
  useEffect(() => {
    if (pantalla !== 'b2') return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pausaRef.current === null) setPausa('local')
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [pantalla])

  // Rebaja de modo: se resalta 4 s cuando aparece durante la instalación y se anuncia.
  const rebaja = acumulado.ultimo?.motivoRebaja ?? estado?.motivoRebaja ?? null
  const rebajaPrevia = useRef<typeof rebaja | undefined>(undefined)
  useEffect(() => {
    const previa = rebajaPrevia.current
    rebajaPrevia.current = rebaja
    if (previa === undefined || previa !== null || rebaja === null || pantalla !== 'b2') return
    setRebajaResaltada(true)
    setAnuncio(mensajeModo('rapido', null, rebaja) ?? '')
    const id = setTimeout(() => setRebajaResaltada(false), DURACION_REBAJA_MS)
    return () => clearTimeout(id)
  }, [rebaja, pantalla])

  // Anuncios a lectores de pantalla: cambio de fase, cada 25 % del total, error y fin.
  // Cada efecto sincroniza la región `aria-live` (sistema externo) con un hito concreto.
  /* eslint-disable react-hooks/set-state-in-effect */
  const faseVisible = pantalla === 'b2' ? (acumulado.ultimo?.faseVisible ?? null) : null
  useEffect(() => {
    if (faseVisible) setAnuncio(NOMBRE_FASE[faseVisible])
  }, [faseVisible])
  const hito = pantalla === 'b2' ? Math.min(3, Math.floor(acumulado.total / 25)) : 0
  useEffect(() => {
    if (hito > 0) setAnuncio(PA.anuncioPorcentaje(hito * 25))
  }, [hito])
  const codigoError = pantalla === 'b4' ? (estado?.error?.codigo ?? 'GENERICO') : null
  useEffect(() => {
    if (codigoError === null) return
    const t = textoDeError(codigoError, requisitos?.espacioRequerido ?? null)
    setAnuncio(`${t.titulo} ${t.cuerpo}`)
  }, [codigoError, requisitos])
  useEffect(() => {
    if (pantalla === 'b3') setAnuncio(PA.listoTitulo)
  }, [pantalla])

  /* eslint-enable react-hooks/set-state-in-effect */

  // B3: tiempo estimado de una canción de 4 minutos.
  useEffect(() => {
    if (pantalla !== 'b3') return
    let activo = true
    api.runtime.estimarSeparacion(240_000).then(
      (e) => activo && setEstimacion(e),
      () => undefined
    )
    return () => {
      activo = false
    }
  }, [pantalla, api])

  const lanzar = useCallback(() => {
    setSesion(true)
    setIniciando(true)
    setAcumulado((a) => ({ ...a, inicio: null }))
    api.runtime.instalar().catch(() => {
      setIniciando(false)
      mostrarToast({ tipo: 'error', mensaje: PA.errorGenerico.titulo })
    })
  }, [api])

  const comprobar = useCallback(() => {
    setComprobando(true)
    api.runtime
      .requisitos({ recalcularEspacio: true })
      .then(setRequisitos, () => undefined)
      .finally(() => setComprobando(false))
  }, [api])

  const confirmarPausa = useCallback(() => {
    const origen = pausaRef.current
    setPausa(null)
    if (origen === 'solicitud') {
      void api.app.confirmarCierre()
    } else {
      // Pausa lo descargado; sin nada en curso, cerrar la ventana no pregunta (0036).
      void api.runtime.pausar().finally(() => void api.app.salir().catch(() => undefined))
    }
  }, [api])

  const perfil = estado?.perfil ?? estado?.perfilPrevisto ?? null
  const progreso = acumulado.ultimo
  const modo = progreso?.modo ?? estado?.modo ?? requisitos?.modoPrevisto ?? null

  let contenido
  switch (pantalla) {
    case 'b0':
      contenido = <Comprobando />
      break
    case 'b1':
      contenido = requisitos && (
        <Bienvenida
          requisitos={requisitos}
          alPreparar={lanzar}
          alComprobar={comprobar}
          comprobando={comprobando}
          alLicencias={licencias.abrir}
        />
      )
      break
    case 'b5continuar':
    case 'b5reparar':
      contenido = (
        <Reanudar
          reparar={pantalla === 'b5reparar'}
          bytesRestantes={estado?.bytesRestantes ?? null}
          alAccion={lanzar}
          alLicencias={licencias.abrir}
        />
      )
      break
    case 'b6':
    case 'b6b':
      contenido = requisitos && (
        <NoCompatible
          requisitos={requisitos}
          macosAntiguo={pantalla === 'b6b'}
          alLicencias={licencias.abrir}
        />
      )
      break
    case 'b2':
      contenido = estado && (
        <Instalando
          fases={progreso ? progreso.estados : estado.fases}
          acumulado={acumulado}
          mensajeModo={mensajeModo(modo, perfil, rebaja)}
          rebajaResaltada={rebajaResaltada}
          alPausar={() => setPausa('local')}
        />
      )
      break
    case 'b3':
      contenido = (
        <TodoListo
          modo={nombreModoFinal(modo, perfil)}
          tiempo={textoTiempoListo(estimacion)}
          alEmpezar={() => ir({ tipo: 'biblioteca' })}
        />
      )
      break
    case 'b4': {
      const t = textoDeError(estado?.error?.codigo ?? '', requisitos?.espacioRequerido ?? null)
      contenido = estado && (
        <ErrorInstalacion
          fases={estado.fases}
          acumulado={acumulado}
          titulo={t.titulo}
          cuerpo={t.cuerpo}
          alReintentar={lanzar}
          alSalir={() => void api.app.salir().catch(() => undefined)}
        />
      )
      break
    }
    default:
      // Mientras se lee el estado solo se ven el fondo y el logotipo.
      contenido = (
        <section className={estilos.pantalla}>
          <Logotipo />
        </section>
      )
  }

  return (
    <>
      {contenido}
      <div role="status" aria-live="polite" className={estilos.soloLector}>
        {anuncio}
      </div>
      <DialogoPausar
        abierto={pausa !== null}
        alSeguir={() => setPausa(null)}
        alPausar={confirmarPausa}
      />
      {licencias.dialogo}
    </>
  )
}
