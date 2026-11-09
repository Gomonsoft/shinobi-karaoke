import { useState } from 'react'
import {
  Check,
  ChevronLeft,
  Circle,
  CircleX,
  RefreshCw,
  RotateCcw,
  RotateCw,
  TriangleAlert
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ResumenCancionIpc } from '@shared/ipc'
import { Boton } from '../../componentes/Boton'
import { BotonIcono } from '../../componentes/BotonIcono'
import { MenuContextual, type ItemMenu } from '../../componentes/MenuContextual'
import { Icono } from '../../componentes/Icono'
import { InsigniaEstado } from '../../componentes/InsigniaEstado'
import { Tooltip } from '../../componentes/Tooltip'
import { useNavegacion, type PasoCancion } from '../../navegacion/estado'
import { marcarProgresoVisto } from '../../navegacion/progresoVisto'
import { useTrabajosVivos } from '../../trabajos/useTrabajos'
import type { TrabajoVivo } from '../biblioteca/tarjeta'
import { pasosDeCancion, pasosDeNueva, type DatosPaso, type IndicadorPaso } from './pasos'
import estilos from './cabecera.module.css'

const ICONOS: Record<IndicadorPaso, LucideIcon> = {
  completado: Check,
  curso: RefreshCw,
  error: CircleX,
  interrumpido: TriangleAlert,
  actual: Circle,
  pendiente: Circle
}

interface CabeceraCancionProps {
  /** `null` = modo "Nueva canción" (aún no existe la canción). */
  resumen: ResumenCancionIpc | null
  /** Paso de la vista que muestra la cabecera. */
  actual: PasoCancion
  guardado?: 'guardado' | 'guardando' | 'error'
  incompleta?: number
  historial?: {
    puedeDeshacer: boolean
    puedeRehacer: boolean
    alDeshacer(): void
    alRehacer(): void
  }
  menu?: ItemMenu[]
  /**
   * `vista` (por defecto): cabecera de las vistas del espacio de canción. `editor`: sin margen
   * inferior (lo da la rejilla). `editor-compacta`: una fila de 48 px con el stepper compacto.
   */
  variante?: 'vista' | 'editor' | 'editor-compacta'
}

const ESTADO_GUARDADO = {
  guardado: { texto: 'Guardado', icono: Check },
  guardando: { texto: 'Guardando…', icono: RefreshCw },
  error: { texto: 'No se pudo guardar', icono: TriangleAlert }
}

function Paso({
  datos,
  onIr,
  compacta
}: {
  datos: DatosPaso
  onIr: () => void
  compacta: boolean
}) {
  const [forzar, setForzar] = useState(false)
  const Ic = ICONOS[datos.indicador]
  const boton = (
    <button
      type="button"
      className={`${estilos.paso} ${estilos[`ind_${datos.indicador}`]}`}
      aria-current={datos.actual ? 'step' : undefined}
      aria-disabled={datos.navegable ? undefined : true}
      aria-label={`Paso ${datos.numero}, ${datos.etiqueta}, ${datos.descripcion}${datos.actual && datos.indicador !== 'actual' ? ', paso actual' : ''}`}
      onBlur={() => setForzar(false)}
      onClick={() => {
        if (datos.navegable) onIr()
        else setForzar(true)
      }}
    >
      <span className={estilos.circulo} aria-hidden="true">
        <Icono icono={Ic} tamano={datos.indicador === 'actual' ? 10 : 14} />
      </span>
      <span className={estilos.etiqueta} aria-hidden="true">
        {datos.etiqueta}
        {datos.detalle && <span className={estilos.detalle}> {datos.detalle}</span>}
      </span>
    </button>
  )
  // En la cabecera compacta solo el paso actual muestra su etiqueta: las demás van en un tooltip.
  const tooltip =
    compacta && !datos.actual
      ? datos.motivo
        ? `${datos.etiqueta}. ${datos.motivo}`
        : datos.etiqueta
      : datos.motivo
  return (
    <li className={estilos.item}>
      {tooltip ? (
        <Tooltip contenido={tooltip} forzar={forzar}>
          {boton}
        </Tooltip>
      ) : (
        boton
      )}
    </li>
  )
}

/**
 * Cabecera compartida del espacio de canción (docs/ux/00 §2): "‹ Biblioteca", título · artista,
 * estado de guardado y stepper de 4 pasos.
 */
export function CabeceraCancion({
  resumen,
  actual,
  guardado,
  incompleta = 0,
  historial,
  menu,
  variante = 'vista'
}: CabeceraCancionProps) {
  const { ir } = useNavegacion()
  const { trabajos, progreso } = useTrabajosVivos()

  let pasos: DatosPaso[]
  if (resumen === null) {
    pasos = pasosDeNueva()
  } else {
    const vivo = (paso: 'fuente' | 'separacion'): TrabajoVivo | null => {
      const t = trabajos.find((x) => x.cancionId === resumen.id && x.paso === paso)
      return t ? { trabajo: t, progreso: progreso[t.id] ?? null } : null
    }
    pasos = pasosDeCancion(resumen, actual, {
      fuente: vivo('fuente'),
      separacion: vivo('separacion')
    })
  }

  const estado = guardado ? ESTADO_GUARDADO[guardado] : null
  const mac = /Mac/i.test(navigator.platform)
  const compacta = variante === 'editor-compacta'
  const pasosNav = (
    <nav aria-label="Pasos de la canción" className={compacta ? estilos.navCompacta : undefined}>
      <ol className={estilos.pasos}>
        {pasos.map((p) => (
          <Paso
            key={p.paso}
            datos={p}
            compacta={compacta}
            onIr={() => {
              if (!resumen) return
              if (actual === 'progreso' && p.paso === 'letra') marcarProgresoVisto(resumen.id)
              ir({ tipo: 'cancion', id: resumen.id, paso: p.paso })
            }}
          />
        ))}
      </ol>
    </nav>
  )
  const textoTitulo =
    resumen === null
      ? 'Nueva canción'
      : resumen.artista !== ''
        ? `«${resumen.titulo}» · ${resumen.artista}`
        : `«${resumen.titulo}»`
  return (
    <div
      className={[
        estilos.cabecera,
        variante === 'editor' && estilos.cabeceraEditor,
        compacta && estilos.cabeceraCompacta
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={estilos.fila}>
        <Boton variante="fantasma" onClick={() => ir({ tipo: 'biblioteca' })}>
          <Icono icono={ChevronLeft} tamano={16} />
          Biblioteca
        </Boton>
        <p className={estilos.titulo} title={compacta ? textoTitulo : undefined}>
          {resumen === null ? (
            'Nueva canción'
          ) : (
            <>
              «{resumen.titulo}»
              {resumen.artista !== '' && (
                <span className={estilos.artista}> · {resumen.artista}</span>
              )}
            </>
          )}
        </p>
        {resumen !== null &&
          (resumen.estado === 'lista' ? (
            <span className={estilos.insigniaLista}>
              <InsigniaEstado estado="lista" />
              {incompleta > 0 && (
                <span className={estilos.incompleta}>
                  <span aria-hidden="true">·</span>
                  <Icono icono={TriangleAlert} tamano={14} />
                  {incompleta === 1 ? 'Falta 1 línea' : `Faltan ${incompleta} líneas`}
                </span>
              )}
            </span>
          ) : (
            <InsigniaEstado
              estado="borrador"
              texto={guardado ? undefined : 'Borrador · guardado ✓'}
            />
          ))}
        {estado && (
          <span
            role="status"
            className={`${estilos.guardado} ${guardado ? estilos[guardado] : ''}`}
          >
            <Icono icono={estado.icono} tamano={14} />
            {estado.texto}
          </span>
        )}
        {compacta && pasosNav}
        {historial && (
          <div className={estilos.historial}>
            <BotonIcono
              icono={RotateCcw}
              etiqueta={mac ? 'Deshacer (⌘Z)' : 'Deshacer (Ctrl+Z)'}
              disabled={!historial.puedeDeshacer}
              onClick={historial.alDeshacer}
            />
            <BotonIcono
              icono={RotateCw}
              etiqueta={mac ? 'Rehacer (⌘⇧Z)' : 'Rehacer (Ctrl+Mayús+Z)'}
              disabled={!historial.puedeRehacer}
              onClick={historial.alRehacer}
            />
          </div>
        )}
        {menu && menu.length > 0 && (
          <MenuContextual etiqueta="Más acciones del editor" items={menu} />
        )}
      </div>
      {!compacta && pasosNav}
    </div>
  )
}
