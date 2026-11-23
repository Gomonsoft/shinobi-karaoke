import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { FileMusic, Film, Flag, Info, MoveHorizontal } from 'lucide-react'
import type { ExportacionVista } from '../../exportacion/estado'
import { lineaDeExportacion } from '../../exportacion/lineas'
import { Boton } from '../../componentes/Boton'
import { Icono } from '../../componentes/Icono'
import type { MotivoComprobar } from './comprobar/calcular'
import { BotonAjustarSilencios, textoMotivo } from './silencios/BotonAjustarSilencios'
import { FilaConIcono } from '../letra/FilaConIcono'
import { K } from './comprobar/textos'
import { esMac, S } from './silencios/textos'
import type { Motivo } from './silencios/useAjustarSilencios'
import { E } from './textos'
import { R } from './revision/textos'
import type { BloquePreparacion } from './preparacion/modelo'
import { EP } from './preparacion/textos'
import estilos from './editor.module.css'

export type EstadoCancion = 'borrador' | 'lista' | 'letra_lista'

interface Props {
  estado: EstadoCancion
  exportacion: {
    activa: ExportacionVista | undefined
    /** Por qué no se puede exportar (`exp.motivo.*`). */
    motivo: string | undefined
    exportar(): void
  }
  /** «Exportar la letra» (0.2.2 · feature 9, F9-E1): sigue a «Exportar video». */
  letra: {
    /** Por qué no se puede (`lrc.motivo.sinTiempos`); `undefined` si se puede. */
    motivo: string | undefined
    exportar(): void
  }
  /** «Preparación automática» (feature 5): primera sección, solo si queda algo que contar. */
  preparacion?: {
    datos: BloquePreparacion | null
    verOtras(): void
    quitarFines(): void
    /** Recibe el foco con «Ver qué hicimos» del banner. */
    tituloRef: RefObject<HTMLHeadingElement | null>
  }
  /** «Revisar la sincronía» (feature 11): sigue a la preparación automática. */
  revision: {
    /** Líneas pendientes; `null` mientras se prepara la forma de onda. */
    pendientes: number | null
    buenas: number
    /** Sin la voz separada solo actúan los motivos que no la necesitan. */
    sinVoz: boolean
    calculando: boolean
    /** Motivo por el que no se puede empezar (modo al ritmo, error de audio). */
    noDisponible?: string
    empezar(): void
    reiniciar(): void
  }
  /** «Comprobar la letra con la voz» (feature 4): va justo antes de «Ajustar los silencios». */
  comprobar: {
    motivos: MotivoComprobar[]
    calculando: boolean
    pedir(): void
    reintentar(): void
    /** `letra.desfase_corregido_ms` si la canción recuerda una corrección. */
    desfaseCorregidoMs: number | null
    quitar(): void
  }
  silencios: {
    motivos: Motivo[]
    buscando: boolean
    pedir(): void
    reintentar(): void
    irAPrimera(): void
  }
  /** Cambia la modalidad sin salir del editor (la lógica del aviso y el toast es del editor). */
  cambiarModalidad(destino: 'karaoke' | 'letra_lista'): void
  volverABorrador(): void
  /** Título de «Estado de la canción»: recibe el foco al volver a borrador (el botón desaparece). */
  tituloEstado: RefObject<HTMLHeadingElement | null>
}

function Seccion({
  titulo,
  idTitulo,
  refTitulo,
  children
}: {
  titulo: string
  idTitulo: string
  refTitulo?: RefObject<HTMLHeadingElement | null>
  children: ReactNode
}) {
  return (
    <section className={estilos.funcion} aria-labelledby={idTitulo}>
      <h3 id={idTitulo} ref={refTitulo} tabIndex={refTitulo ? -1 : undefined}>
        {titulo}
      </h3>
      {children}
    </section>
  )
}

function MotivoVisible({ id, texto }: { id: string; texto: string }) {
  return (
    <p id={id} className={estilos.funcionMotivo}>
      <Icono icono={Info} tamano={14} /> {texto}
    </p>
  )
}

/**
 * Pestaña «Funciones» (spec 06, 8.6): exportar, ajustar los silencios, modo de reproducción y
 * estado de la canción. Cada acción hace lo mismo que su antigua entrada del menú ⋯. Todos los
 * botones son secundarios; lo que no está disponible lo explica siempre a la vista.
 */
const textoMotivoComprobar = (m: MotivoComprobar): string =>
  m.tipo === 'lineas' ? K.falta.lineas : S.falta[m.tipo]

export function PanelFunciones({
  estado,
  exportacion,
  letra,
  preparacion,
  revision,
  comprobar,
  silencios,
  cambiarModalidad,
  volverABorrador,
  tituloEstado
}: Props) {
  const id = useId()
  const F = E.funciones
  const atajo = esMac() ? '⌘ E' : 'Ctrl + E'
  const lineaExp = lineaDeExportacion(exportacion.activa)
  const motivoComp = comprobar.motivos[0]
  const textoComp = motivoComp ? textoMotivoComprobar(motivoComp) : undefined
  const motivoSilencios = silencios.motivos[0]
  const textoSilencios = motivoSilencios ? textoMotivo(motivoSilencios) : undefined

  // El foco sigue al botón que sustituye al que se pulsó («Cambiar a «Lista»» tras el otro).
  const modoAnterior = useRef(estado)
  const enfocarModo = useRef(false)
  useEffect(() => {
    if (modoAnterior.current === estado) return
    modoAnterior.current = estado
    if (enfocarModo.current) {
      enfocarModo.current = false
      document.querySelector<HTMLElement>('[data-funcion="modo"]')?.focus()
    }
  }, [estado])

  return (
    <div className={estilos.funciones}>
      {preparacion?.datos && (
        <Seccion
          titulo={EP.titulo}
          idTitulo={`${id}-preparacion`}
          refTitulo={preparacion.tituloRef}
        >
          <p>
            {preparacion.datos.soloFines
              ? EP.introFines(preparacion.datos.fecha)
              : EP.intro(preparacion.datos.fecha)}
          </p>
          {preparacion.datos.letra && (
            <>
              <p data-prep-letra="">
                · {preparacion.datos.letra === 'app' ? EP.letraApp : EP.letraUsuario}
              </p>
              <div className={estilos.funcionFila}>
                <Boton variante="fantasma" onClick={preparacion.verOtras}>
                  {EP.verOtras}
                </Boton>
              </div>
            </>
          )}
          {preparacion.datos.desfaseMs !== null && (
            <>
              <p data-prep-desfase="">· {K.desfase.corregido(preparacion.datos.desfaseMs)}</p>
              <div className={estilos.funcionFila}>
                <Boton
                  data-funcion="quitar-correccion"
                  variante="fantasma"
                  onClick={comprobar.quitar}
                >
                  {K.desfase.quitar}
                </Boton>
              </div>
            </>
          )}
          {preparacion.datos.fines > 0 && (
            <>
              <p data-prep-fines="">· {EP.fines(preparacion.datos.fines)}</p>
              <div className={estilos.funcionFila}>
                <Boton
                  data-funcion="quitar-fines"
                  variante="fantasma"
                  onClick={preparacion.quitarFines}
                >
                  {EP.quitarFines}
                </Boton>
              </div>
            </>
          )}
        </Seccion>
      )}

      <Seccion titulo={R.funciones.titulo} idTitulo={`${id}-revision`}>
        <p>{R.funciones.ayuda}</p>
        <div className={estilos.funcionFila}>
          <Boton
            data-funcion="revisar"
            aria-disabled={revision.pendientes === 0 || undefined}
            aria-describedby={revision.pendientes === 0 ? `${id}-nada-revision` : undefined}
            noDisponible={revision.noDisponible}
            cargando={revision.calculando}
            textoCargando={R.funciones.boton(null)}
            onClick={() => {
              if (revision.pendientes !== 0) revision.empezar()
            }}
          >
            <Icono icono={Flag} />
            {R.funciones.boton(revision.pendientes)}
          </Boton>
        </div>
        {revision.calculando && (
          <MotivoVisible id={`${id}-motivo-revision`} texto={S.falta.preparando} />
        )}
        {revision.pendientes === 0 && !revision.noDisponible ? (
          <p id={`${id}-nada-revision`}>{R.nada}</p>
        ) : (
          revision.pendientes !== null &&
          revision.pendientes + revision.buenas > 0 && (
            <p>{R.resumen(revision.pendientes, revision.buenas)}</p>
          )
        )}
        {revision.buenas > 0 && (
          <div className={estilos.funcionFila}>
            <Boton variante="fantasma" onClick={revision.reiniciar}>
              {R.reiniciar}
            </Boton>
          </div>
        )}
        {revision.sinVoz && <p>{R.sinVoz}</p>}
      </Seccion>

      <Seccion titulo={K.funciones.titulo} idTitulo={`${id}-comprobar`}>
        <p>{K.funciones.ayuda}</p>
        <div className={estilos.funcionFila}>
          <Boton
            data-comprobar-boton=""
            aria-disabled={motivoComp ? true : undefined}
            aria-describedby={textoComp ? `${id}-motivo-comprobar` : undefined}
            cargando={comprobar.calculando}
            textoCargando={K.calculando}
            onClick={() => {
              if (!motivoComp) comprobar.pedir()
            }}
          >
            <Icono icono={MoveHorizontal} />
            {K.funciones.boton}
          </Boton>
        </div>
        {textoComp && <MotivoVisible id={`${id}-motivo-comprobar`} texto={textoComp} />}
        {motivoComp?.tipo === 'error' && (
          <div className={estilos.funcionFila}>
            <Boton variante="fantasma" onClick={comprobar.reintentar}>
              {S.falta.reintentar}
            </Boton>
          </div>
        )}
        {comprobar.desfaseCorregidoMs && preparacion?.datos?.desfaseMs == null ? (
          <>
            <p data-desfase-corregido="">
              <FilaConIcono icono={Info}>
                {K.desfase.corregido(comprobar.desfaseCorregidoMs)}
              </FilaConIcono>
            </p>
            <div className={estilos.funcionFila}>
              <Boton
                data-funcion="quitar-correccion"
                variante="fantasma"
                onClick={comprobar.quitar}
              >
                {K.desfase.quitar}
              </Boton>
            </div>
          </>
        ) : null}
      </Seccion>

      <Seccion titulo={F.silencios.titulo} idTitulo={`${id}-silencios`}>
        <p>{F.silencios.ayuda}</p>
        <div className={estilos.funcionFila}>
          <BotonAjustarSilencios
            variante="funciones"
            describedBy={textoSilencios ? `${id}-motivo-silencios` : undefined}
            motivos={silencios.motivos}
            ritmo={false}
            buscando={silencios.buscando}
            alPulsar={silencios.pedir}
            alReintentar={silencios.reintentar}
            alIrAPrimera={silencios.irAPrimera}
          />
        </div>
        {textoSilencios && <MotivoVisible id={`${id}-motivo-silencios`} texto={textoSilencios} />}
      </Seccion>

      <Seccion titulo={F.exportar.titulo} idTitulo={`${id}-exportar`}>
        <p>{F.exportar.ayuda}</p>
        <div className={estilos.funcionFila}>
          <Boton
            data-funcion="exportar"
            aria-disabled={exportacion.motivo ? true : undefined}
            aria-describedby={exportacion.motivo ? `${id}-motivo-exportar` : undefined}
            aria-keyshortcuts="Control+E Meta+E"
            onClick={exportacion.exportar}
          >
            <Icono icono={Film} />
            {exportacion.activa ? F.exportar.ver : F.exportar.boton}
          </Boton>
          <span className={estilos.funcionAtajo}>{atajo}</span>
        </div>
        {exportacion.motivo && (
          <MotivoVisible id={`${id}-motivo-exportar`} texto={exportacion.motivo} />
        )}
        {lineaExp && <p>{lineaExp.texto}</p>}
      </Seccion>

      <Seccion titulo={F.letra.titulo} idTitulo={`${id}-letra`}>
        <p>{F.letra.ayuda}</p>
        <div className={estilos.funcionFila}>
          <Boton
            data-funcion="letra"
            aria-disabled={letra.motivo ? true : undefined}
            aria-describedby={letra.motivo ? `${id}-motivo-letra` : undefined}
            onClick={() => {
              if (!letra.motivo) letra.exportar()
            }}
          >
            <Icono icono={FileMusic} />
            {F.letra.boton}
          </Boton>
        </div>
        {letra.motivo && <MotivoVisible id={`${id}-motivo-letra`} texto={letra.motivo} />}
      </Seccion>

      <Seccion titulo={F.modo.titulo} idTitulo={`${id}-modo`}>
        <p>
          {estado === 'borrador'
            ? F.modo.borrador
            : estado === 'lista'
              ? F.modo.lista
              : F.modo.letraLista}
        </p>
        {estado !== 'borrador' && (
          <div className={estilos.funcionFila}>
            <Boton
              data-funcion="modo"
              onClick={() => {
                enfocarModo.current = true
                cambiarModalidad(estado === 'lista' ? 'letra_lista' : 'karaoke')
              }}
            >
              {estado === 'lista' ? F.modo.aLetraLista : F.modo.aLista}
            </Boton>
          </div>
        )}
      </Seccion>

      <Seccion titulo={F.estado.titulo} idTitulo={`${id}-estado`} refTitulo={tituloEstado}>
        <p>
          {estado === 'borrador'
            ? F.estado.borrador
            : estado === 'lista'
              ? F.estado.lista
              : F.estado.letraLista}
        </p>
        {estado !== 'borrador' && (
          <div className={estilos.funcionFila}>
            <Boton data-funcion="estado" onClick={volverABorrador}>
              {F.estado.volver}
            </Boton>
          </div>
        )}
      </Seccion>
    </div>
  )
}
