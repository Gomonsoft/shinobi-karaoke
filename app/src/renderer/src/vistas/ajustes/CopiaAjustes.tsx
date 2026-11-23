import { useEffect, useId, useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import type { Config } from '@shared/config'
import { BarraProgreso } from '../../componentes/BarraProgreso'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import { formatearTamano } from '../../exportacion/dialogo/textos'
import {
  abrirExportarPaquete,
  abrirImportarPaquete,
  usePaquetes
} from '../biblioteca/paquete/almacen'
import { fechaCorta } from '../biblioteca/paquete/modelo'
import { AJCOPIA } from '../biblioteca/paquete/textos'
import { useResumenes } from '../biblioteca/paquete/useResumenes'
import estilos from './ajustes.module.css'

/** Desde cuántas canciones nuevas o cambiadas se recuerda la copia, y cuántas Listas sin ninguna copia. */
const UMBRAL_CAMBIADAS = 5
const UMBRAL_LISTAS = 3

type Ultima = NonNullable<Config['copias']>['ultima']

/**
 * Sección «Copia de seguridad» (docs/ux/08 · Feature 9): la última copia, el recordatorio (solo aquí, sin
 * toasts ni insignias) y los dos botones. El diálogo de crear y el de restaurar son los de los paquetes.
 */
export function CopiaAjustes() {
  const idTitulo = useId()
  const resumenes = useResumenes()
  const { seguimiento } = usePaquetes()
  const [ultima, setUltima] = useState<Ultima | null>(null)
  const copiando = seguimiento?.tipo === 'exportar' && seguimiento.esCopia ? seguimiento : null
  const enCurso = copiando?.estado === 'en_curso'
  const estadoCopia = copiando?.estado

  // La línea «Última copia» se vuelve a leer al terminar una copia (la escribe main).
  useEffect(() => {
    let vivo = true
    window.shinobi.config.obtener().then(
      (c) => vivo && setUltima(c.copias?.ultima ?? null),
      () => undefined
    )
    return () => {
      vivo = false
    }
  }, [estadoCopia])

  const canciones = resumenes?.filter((c) => !(c.danada && c.motivo === 'json')) ?? []
  const recordatorio = useMemo(() => {
    if (!resumenes) return null
    if (ultima) {
      const k = resumenes.filter((c) => c.modificada > ultima.fecha).length
      return k >= UMBRAL_CAMBIADAS ? AJCOPIA.recordatorio(k) : null
    }
    const k = resumenes.filter((c) => c.estado === 'lista' && !c.danada).length
    return k >= UMBRAL_LISTAS ? AJCOPIA.recordatorioNunca(k) : null
  }, [resumenes, ultima])

  const vacia = resumenes !== null && canciones.length === 0
  const c = copiando?.cancion
  return (
    <div className={estilos.seccion} role="group" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className={estilos.subtitulo}>
        {AJCOPIA.titulo}
      </h2>
      <p className={estilos.suave}>{AJCOPIA.ayuda}</p>
      <p>
        {ultima
          ? AJCOPIA.ultima(
              fechaCorta(ultima.fecha) ?? '',
              ultima.canciones,
              formatearTamano(ultima.bytes),
              ultima.tipo === 'completa'
            )
          : AJCOPIA.nunca}
      </p>
      {recordatorio && (
        <p className={estilos.suave} data-recordatorio>
          <Icono icono={Info} tamano={16} /> {recordatorio}
        </p>
      )}
      {enCurso && (
        <>
          <p role="status">{AJCOPIA.creando(c?.hechas ?? 0, c?.total ?? copiando.n)}</p>
          <BarraProgreso
            etiqueta={AJCOPIA.creandoTitulo}
            valor={Math.round(copiando.fraccion * 100)}
            indeterminada={copiando.fraccion === 0 && !c}
          />
        </>
      )}
      <div className={estilos.acciones}>
        <Boton
          variante="secundario"
          onClick={() => abrirExportarPaquete({ tipo: 'biblioteca' })}
          noDisponible={!enCurso && vacia ? AJCOPIA.vacia : undefined}
        >
          {enCurso ? AJCOPIA.crearEnCurso : AJCOPIA.crear}
        </Boton>
        <Boton variante="secundario" onClick={() => abrirImportarPaquete()}>
          {AJCOPIA.restaurar}
        </Boton>
      </div>
    </div>
  )
}
