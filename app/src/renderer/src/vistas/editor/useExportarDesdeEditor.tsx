import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Film } from 'lucide-react'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import type { ItemMenu } from '../../componentes/MenuContextual'
import { useExportaciones } from '../../exportacion/contexto'
import type { ExportacionVista } from '../../exportacion/estado'
import { EXP_GUARDADO, EXP_MENU } from '../../exportacion/dialogo/textosProgreso'

interface Opciones {
  cancionId: string
  /** Separación completada (existe el instrumental). */
  hayPistas: boolean
  /** Líneas con inicio. */
  lineasConInicio: number
  /** Modo «Sincronizar al ritmo» o «Error de audio»: el editor está inactivo. */
  inactivo: boolean
  /** Hay un borrador de tema sin guardar (`edi.exp.temaBorrador`). */
  temaBorrador: boolean
  pausar(): void
  /** Vacía el guardado pendiente; `false` si falló. */
  vaciar(): Promise<boolean>
}

/**
 * «Exportar video…» del editor (spec 06 · Fase 6 y 8.6): botón de la pestaña «Funciones», Ctrl/Cmd + E y su secuencia de
 * apertura (pausa, vaciado del guardado, diálogo `edi.exp.guardado` si falla). La instantánea
 * es de lo guardado, así que se exporta después de vaciar.
 */
export function useExportarDesdeEditor({
  cancionId,
  hayPistas,
  lineasConInicio,
  inactivo,
  temaBorrador,
  pausar,
  vaciar
}: Opciones): {
  exportar(): void
  /** Exportación de esta canción en curso o en cola (el botón pasa a «Ver exportación»). */
  activa: ExportacionVista | undefined
  /** Por qué no se puede exportar ahora (`exp.motivo.*`); `undefined` si se puede. */
  motivo: string | undefined
  /** Ítem equivalente de menú; ya no se usa en el ⋯ del editor (lo conserva la prueba de puntos de entrada). */
  item: ItemMenu
  dialogo: ReactNode
} {
  const { abrir, activaDe } = useExportaciones()
  const activa = activaDe(cancionId)
  const [preguntando, setPreguntando] = useState(false)
  const respuesta = useRef<((exportar: boolean) => void) | null>(null)
  const enCurso = useRef(false)
  useEffect(
    () => () => {
      respuesta.current?.(false)
      respuesta.current = null
    },
    []
  )

  const motivo = activa
    ? undefined
    : !hayPistas
      ? EXP_MENU.sinPistas
      : lineasConInicio === 0
        ? EXP_MENU.sinLineas
        : inactivo
          ? EXP_MENU.noDisponible
          : undefined

  const exportar = useCallback(() => {
    if (activa) {
      abrir({ cancionId, trabajoId: activa.trabajoId })
      return
    }
    if (motivo || enCurso.current) return
    enCurso.current = true
    void (async () => {
      try {
        pausar()
        if (!(await vaciar())) {
          const seguir = await new Promise<boolean>((resolver) => {
            respuesta.current = resolver
            setPreguntando(true)
          })
          if (!seguir) return
        }
        abrir({ cancionId, temaBorrador })
      } finally {
        enCurso.current = false
      }
    })()
  }, [activa, abrir, cancionId, motivo, pausar, vaciar, temaBorrador])

  const responder = (exportarIgualmente: boolean) => {
    setPreguntando(false)
    respuesta.current?.(exportarIgualmente)
    respuesta.current = null
  }

  return {
    exportar,
    activa,
    motivo,
    item: {
      id: 'exportar',
      etiqueta: activa ? EXP_MENU.ver : EXP_MENU.exportarEditor,
      icono: Film,
      noDisponible: motivo,
      alSeleccionar: exportar
    },
    dialogo: (
      <Dialogo
        abierto={preguntando}
        titulo={EXP_GUARDADO.titulo}
        onCancelar={() => responder(false)}
        enfoqueInicial="[data-quedarme]"
        acciones={
          <>
            <Boton data-quedarme onClick={() => responder(false)}>
              {EXP_GUARDADO.quedarme}
            </Boton>
            <Boton variante="primario" onClick={() => responder(true)}>
              {EXP_GUARDADO.igualmente}
            </Boton>
          </>
        }
      >
        <p>{EXP_GUARDADO.cuerpo}</p>
      </Dialogo>
    )
  }
}
