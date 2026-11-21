import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode
} from 'react'
import { Boton } from '../componentes/Boton'
import { Dialogo } from '../componentes/Dialogo'
import { mostrarToast } from '../componentes/gestorToasts'
import estilosComponentes from '../componentes/componentes.module.css'
import type { AvisoExportacionIpc } from '@shared/exportacion'
import { ExportacionContexto, type ContextoExportacion, type PeticionExportacion } from './contexto'
import { DialogoExportacion } from './dialogo/DialogoExportacion'
import { EXP_ANUNCIO, EXP_PROGRESO, EXP_TOAST } from './dialogo/textosProgreso'
import {
  clasificarAviso,
  crearAlmacenExportaciones,
  hitoDe,
  type AvisoExportacion,
  type ExportacionVista
} from './estado'

const DURACION_ANUNCIO_MS = 4000

/** Confirmación de `exp.dialogo.cancelar` para el panel de actividad y el ⋯ de la tarjeta. */
function DialogoCancelarExportacion({
  existia,
  alSeguir,
  alConfirmar
}: {
  existia: boolean
  alSeguir(): void
  alConfirmar(): void
}) {
  return (
    <Dialogo
      abierto
      titulo={EXP_PROGRESO.cancelarPregunta}
      onCancelar={alSeguir}
      enfoqueInicial="[data-seguir]"
      acciones={
        <>
          <Boton data-seguir onClick={alSeguir}>
            {EXP_PROGRESO.seguirExportando}
          </Boton>
          <Boton variante="destructivo" onClick={alConfirmar}>
            {EXP_PROGRESO.cancelarExportacion}
          </Boton>
        </>
      }
    >
      <p>{EXP_PROGRESO.cancelarCuerpo}</p>
      {existia && <p>{EXP_PROGRESO.cancelarConservado}</p>}
    </Dialogo>
  )
}

/**
 * Estado de las exportaciones de la principal y host del diálogo «Exportar video» (0239 y 0240):
 * alimenta el almacén con `exportacion.estado()` y los eventos, muestra los toasts de resultado
 * (también con el diálogo cerrado), anuncia los hitos y abre el diálogo desde cualquier vista.
 */
export function ProveedorExportacion({ children }: { children: ReactNode }) {
  const [almacen] = useState(() => crearAlmacenExportaciones())
  const exportaciones = useSyncExternalStore(almacen.suscribir, almacen.obtener)
  const [dialogo, setDialogo] = useState<PeticionExportacion | null>(null)
  const [cancelar, setCancelar] = useState<string | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const avisados = useRef(new Set<string>())
  const dialogoRef = useRef(dialogo)
  const exportacionesRef = useRef(exportaciones)
  useEffect(() => {
    dialogoRef.current = dialogo
    exportacionesRef.current = exportaciones
  })

  const abrir = useCallback((peticion: PeticionExportacion) => {
    const activa = peticion.opciones
      ? undefined
      : exportacionesRef.current.find(
          (e) => e.cancionId === peticion.cancionId && e.estado !== 'terminada'
        )
    setDialogo({ ...peticion, trabajoId: peticion.trabajoId ?? activa?.trabajoId })
  }, [])

  const mostrarEnCarpeta = useCallback(async (ref: { trabajoId: string } | { avisoId: string }) => {
    try {
      await window.shinobi.exportacion.mostrarEnCarpeta(ref)
    } catch {
      mostrarToast({ tipo: 'aviso', mensaje: EXP_TOAST.noExiste })
    }
  }, [])

  const avisar = useCallback(
    (aviso: AvisoExportacion, e: ExportacionVista) => {
      const abierto = dialogoRef.current?.trabajoId === e.trabajoId
      switch (aviso.tipo) {
        case 'ok':
          if (abierto) return
          mostrarToast({
            tipo: 'exito',
            mensaje: EXP_TOAST.ok(e.titulo),
            accion: {
              etiqueta: EXP_PROGRESO.mostrar,
              alAccionar: () => void mostrarEnCarpeta({ trabajoId: e.trabajoId })
            }
          })
          break
        case 'error':
          if (abierto) return
          mostrarToast({
            tipo: 'error',
            mensaje: EXP_TOAST.error(e.titulo),
            persistente: true,
            accion: {
              etiqueta: EXP_TOAST.ver,
              alAccionar: () => abrir({ cancionId: e.cancionId, trabajoId: e.trabajoId })
            }
          })
          break
        case 'cancelada':
          mostrarToast({ tipo: 'info', mensaje: EXP_TOAST.cancelada })
          break
        case 'quitada':
          mostrarToast({ tipo: 'info', mensaje: EXP_TOAST.quitada(e.titulo) })
          break
        case 'limpieza':
          mostrarToast({
            tipo: 'aviso',
            mensaje: EXP_TOAST.limpieza,
            accion: {
              etiqueta: EXP_PROGRESO.mostrar,
              alAccionar: () => void mostrarEnCarpeta({ trabajoId: e.trabajoId })
            }
          })
          break
      }
    },
    [abrir, mostrarEnCarpeta]
  )

  /** Avisos de arranque (0132): no son trabajos. Cada `avisoId` se muestra una sola vez. */
  const avisarDeArranque = useCallback(
    (a: AvisoExportacionIpc) => {
      if (avisados.current.has(a.avisoId)) return
      avisados.current.add(a.avisoId)
      if (a.tipo === 'interrumpida') {
        mostrarToast({
          tipo: 'aviso',
          mensaje: EXP_TOAST.interrumpida(a.titulo),
          accion: {
            etiqueta: EXP_TOAST.exportar,
            alAccionar: () => abrir({ cancionId: a.cancionId })
          }
        })
        return
      }
      mostrarToast({
        tipo: 'aviso',
        mensaje: EXP_TOAST.limpieza,
        accion: {
          etiqueta: EXP_PROGRESO.mostrar,
          alAccionar: () => void mostrarEnCarpeta({ avisoId: a.avisoId })
        }
      })
    },
    [abrir, mostrarEnCarpeta]
  )

  useEffect(() => {
    const api = window.shinobi?.exportacion
    if (!api) return
    let pendientes: { aviso: AvisoExportacion; e: ExportacionVista }[] = []
    let temporizador: ReturnType<typeof setTimeout> | undefined
    const anunciar = (texto: string | null) => {
      if (!texto) return
      setAnuncio(texto)
      clearTimeout(temporizador)
      temporizador = setTimeout(() => setAnuncio(''), DURACION_ANUNCIO_MS)
    }
    const buscar = (id: string) => almacen.obtener().find((x) => x.trabajoId === id)
    const textosHito = {
      inicio: EXP_ANUNCIO.inicio,
      fase: EXP_ANUNCIO.fase,
      porcentaje: EXP_ANUNCIO.porcentaje,
      ok: EXP_ANUNCIO.ok,
      cancelada: EXP_ANUNCIO.cancelada
    }
    const alCambiar: Parameters<typeof api.alCambiar>[0] = (nueva) => {
      const previa = almacen.cambio(nueva)
      const actual = buscar(nueva.trabajoId)
      if (!actual) return
      anunciar(hitoDe(previa, actual, textosHito))
      // Con la ventana sin foco los toasts esperan a que vuelva (como los de la spec 04).
      for (const aviso of clasificarAviso(previa, nueva)) {
        if (document.hasFocus()) avisar(aviso, actual)
        else pendientes.push({ aviso, e: actual })
      }
    }
    const alProgreso: Parameters<typeof api.alProgreso>[0] = (p) => {
      const antes = buscar(p.trabajoId)
      almacen.progreso(p)
      const despues = buscar(p.trabajoId)
      if (antes && despues && antes !== despues) anunciar(hitoDe(antes, despues, textosHito))
    }
    const alFoco = () => {
      const lista = pendientes
      pendientes = []
      lista.forEach(({ aviso, e }) => avisar(aviso, e))
    }
    const bajas = [
      api.alCambiar(alCambiar),
      api.alProgreso(alProgreso),
      api.alAviso(avisarDeArranque)
    ]
    window.addEventListener('focus', alFoco)
    void api.estado().then(
      (lista) => almacen.inicial(lista),
      () => undefined
    )
    // Un aviso emitido antes de suscribirse no se pierde: main lo guarda hasta que se pide.
    void Promise.resolve()
      .then(() => api.avisosPendientes())
      .then(
        (lista) => lista.forEach(avisarDeArranque),
        () => undefined
      )
    return () => {
      bajas.forEach((baja) => baja())
      window.removeEventListener('focus', alFoco)
      clearTimeout(temporizador)
    }
  }, [almacen, avisar, avisarDeArranque])

  const valor = useMemo<ContextoExportacion>(
    () => ({
      exportaciones,
      activaDe: (cancionId) =>
        exportaciones.find((e) => e.cancionId === cancionId && e.estado !== 'terminada'),
      abrir,
      cerrar: () => setDialogo(null),
      iniciada: (trabajoId, cancionId) => {
        setDialogo({ cancionId, trabajoId })
        // El evento de cambio puede llegar después de la respuesta de `iniciar`.
        void window.shinobi.exportacion.estado().then(
          (lista) => almacen.inicial(lista),
          () => undefined
        )
      },
      pedirCancelar: (trabajoId) => {
        const e = exportacionesRef.current.find((x) => x.trabajoId === trabajoId)
        if (!e || e.estado === 'terminada') return
        if (e.estado === 'en_cola') {
          void window.shinobi.exportacion
            .cancelar(trabajoId)
            .catch(() => mostrarToast({ tipo: 'error', mensaje: EXP_PROGRESO.noSeCancelo }))
        } else setCancelar(trabajoId)
      }
    }),
    [exportaciones, abrir, almacen]
  )

  const cancelando = cancelar ? exportaciones.find((e) => e.trabajoId === cancelar) : undefined
  return (
    <ExportacionContexto.Provider value={valor}>
      {children}
      <div
        className={estilosComponentes.soloLector}
        role="status"
        aria-live="polite"
        data-anuncios-exportacion
      >
        {anuncio}
      </div>
      {dialogo && <DialogoExportacion peticion={dialogo} alCerrar={() => setDialogo(null)} />}
      {cancelando && (
        <DialogoCancelarExportacion
          existia={cancelando.destinoExistia}
          alSeguir={() => setCancelar(null)}
          alConfirmar={() => {
            setCancelar(null)
            void window.shinobi.exportacion
              .cancelar(cancelando.trabajoId)
              .catch(() => mostrarToast({ tipo: 'error', mensaje: EXP_PROGRESO.noSeCancelo }))
          }}
        />
      )}
    </ExportacionContexto.Provider>
  )
}
