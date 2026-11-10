import { useEffect, useRef, useState } from 'react'
import { Boton } from '../componentes/Boton'
import { Dialogo } from '../componentes/Dialogo'
import type { Vista } from './estado'
import { confirmarBorradorAlCerrar, vaciarAlCerrar } from './salida'
import { cuerpoCierre, TEXTO_CIERRE } from './textosCierre'

interface Datos {
  n: number
  titulos: string[]
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
    return api.app.alSolicitudCierre(() => {
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
        if (trabajos.length === 0) {
          await vaciarAlCerrar()
          await api.app.confirmarCierre()
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
        setDatos({ n: trabajos.length, titulos })
      })()
    })
  }, [])

  return (
    <Dialogo
      abierto={datos !== null}
      titulo={TEXTO_CIERRE.titulo}
      onCancelar={() => setDatos(null)}
      enfoqueInicial="[data-seguir]"
      acciones={
        <>
          <Boton variante="primario" data-seguir onClick={() => setDatos(null)}>
            {TEXTO_CIERRE.seguir}
          </Boton>
          <Boton variante="destructivo" onClick={() => void alCerrar()}>
            {TEXTO_CIERRE.cerrar}
          </Boton>
        </>
      }
    >
      {datos && <p>{cuerpoCierre(datos.n, datos.titulos)}</p>}
    </Dialogo>
  )

  async function alCerrar(): Promise<void> {
    setDatos(null)
    await vaciarAlCerrar()
    await window.shinobi.app.confirmarCierre()
  }
}
