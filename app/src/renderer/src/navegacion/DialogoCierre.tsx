import { useEffect, useRef, useState } from 'react'
import { Boton } from '../componentes/Boton'
import { Dialogo } from '../componentes/Dialogo'
import type { Vista } from './estado'
import { confirmarBorradorAlCerrar, vaciarAlCerrar } from './salida'
import type { SolicitudCierreIpc } from '../../../shared/sesion'
import { estadoPaquetes } from '../vistas/biblioteca/paquete/almacen'
import { COLA } from './cola'
import { cuerpoCierre, TEXTO_CIERRE, textosSalirConSesion } from './textosCierre'

interface Datos {
  n: number
  titulos: string[]
  /** Canciones que se están exportando o esperan en cola (`exp.cierre.item`). */
  exportando: string[]
  /** Canciones que faltan en una tanda de 2 o más (`cierre.cuerpo.cola`). */
  faltan: number
  motivo: Pick<SolicitudCierreIpc, 'sesion' | 'cola' | 'variante'>
}

interface Props {
  vista: Vista
}

/**
 * Diálogo de cierre con trabajos en curso o en cola (0073, docs/ux/04 §3). Atiende
 * `app:solicitudCierre`: sin trabajos responde al instante; con ellos pregunta. Durante el
 * primer arranque lo gestiona `PrimerArranque` (diálogo de la instalación).
 */
export function DialogoCierre({ vista }: Props) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const tipoVista = useRef(vista.tipo)
  useEffect(() => {
    tipoVista.current = vista.tipo
  })

  useEffect(() => {
    const api = window.shinobi
    const atender = (solicitud: SolicitudCierreIpc | null): void => {
      const motivo = {
        sesion: solicitud?.sesion ?? false,
        cola: solicitud?.cola ?? false,
        variante: solicitud?.variante ?? 'salir'
      } as const
      if (tipoVista.current === 'primer-arranque') return
      void (async () => {
        // Un borrador de tema sin guardar pregunta primero (tema.dialogo.salir, 0171).
        if (!(await confirmarBorradorAlCerrar())) return
        let trabajos: Awaited<ReturnType<typeof api.trabajos.listar>> = []
        try {
          trabajos = await api.trabajos.listar()
        } catch {
          // Sin lista no se puede nombrar nada, pero main ya sabe que hay algo en curso.
        }
        let exportando: string[] = []
        try {
          exportando = ((await api.exportacion?.estado()) ?? [])
            .filter((e) => e.estado !== 'terminada')
            .map((e) => e.titulo)
        } catch {
          // Sin la lista de exportaciones se pregunta igualmente si main sabe que hay algo.
        }
        // Un paquete o una copia en curso cuenta como un trabajo más (spec 02 · Feature 9).
        const paquetes = estadoPaquetes().seguimiento?.estado === 'en_curso' ? 1 : 0
        let faltan = 0
        try {
          const tanda = await api.preparacion?.tanda()
          if (tanda && tanda.total >= 2) faltan = Math.max(0, tanda.total - tanda.terminadas)
        } catch {
          // Sin la tanda se usa el texto de siempre.
        }
        if (
          trabajos.length === 0 &&
          exportando.length === 0 &&
          paquetes === 0 &&
          !motivo.sesion &&
          !motivo.cola
        ) {
          await vaciarAlCerrar()
          await api.app.confirmarCierre()
          return
        }
        if (trabajos.length === 0 && exportando.length === 0 && paquetes === 0) {
          setDatos({ n: 0, titulos: [], exportando, faltan: 0, motivo })
          return
        }
        const ids = [...new Set(trabajos.map((t) => t.cancionId))]
        const nombres = new Map<string, string>()
        try {
          for (const c of await api.biblioteca.listar()) nombres.set(c.id, c.titulo)
        } catch {
          // Se muestra el diálogo sin lista.
        }
        const titulos = ids.flatMap((id) => nombres.get(id) ?? [])
        setDatos({
          n: trabajos.length + exportando.length + paquetes,
          titulos,
          exportando,
          faltan,
          motivo
        })
      })()
    }
    const baja = api.app.alSolicitudCierre(atender)
    // Una solicitud enviada antes de suscribirse (cerrar nada más abrir) no se pierde: se pregunta a main.
    // (los dobles de prueba sin este método simplemente no la tienen)
    void Promise.resolve(api.app.solicitudCierrePendiente?.())
      .then((pendiente) => {
        if (pendiente) atender(pendiente)
      })
      .catch(() => undefined)
    return baja
  }, [])

  const sesion = datos !== null && datos.n === 0 ? textosSalirConSesion(datos.motivo) : null
  return (
    <Dialogo
      abierto={datos !== null}
      titulo={sesion?.titulo ?? TEXTO_CIERRE.titulo}
      onCancelar={() => setDatos(null)}
      enfoqueInicial="[data-seguir]"
      acciones={
        <>
          <Boton
            variante={sesion ? 'secundario' : 'primario'}
            data-seguir
            onClick={() => setDatos(null)}
          >
            {sesion?.cancelar ?? TEXTO_CIERRE.seguir}
          </Boton>
          <Boton variante="destructivo" onClick={() => void alCerrar()}>
            {sesion?.confirmar ?? TEXTO_CIERRE.cerrar}
          </Boton>
        </>
      }
    >
      {datos && (
        <p>
          {sesion
            ? sesion.cuerpo
            : datos.faltan > 0 && datos.exportando.length === 0
              ? COLA.cierre(datos.faltan)
              : cuerpoCierre(datos.n, datos.titulos, datos.motivo, datos.exportando)}
        </p>
      )}
    </Dialogo>
  )

  async function alCerrar(): Promise<void> {
    setDatos(null)
    const copia = estadoPaquetes().seguimiento
    if (copia?.estado === 'en_curso') {
      await window.shinobi.copias.cancelar(copia.trabajoId).catch(() => undefined)
    }
    await vaciarAlCerrar()
    await window.shinobi.app.confirmarCierre()
  }
}
