import { useEffect, useRef, type ReactNode } from 'react'
import { Check, Flag, X } from 'lucide-react'
import type { LineaDudosa } from '@shared/dudosas'
import { tienePalabrasManuales, type Letra } from '@shared/letra'
import { E } from '../textos'
import { Boton } from '../../../componentes/Boton'
import { BotonIcono } from '../../../componentes/BotonIcono'
import { Icono } from '../../../componentes/Icono'
import type { EstadoCancion } from '../PanelFunciones'
import { R, minuscula, motivoPrincipal } from './textos'
import type { Revision } from './useRevision'
import css from './revision.module.css'

/** El arreglo rápido de una línea dudosa: «Fijar inicio», «Fin al final de la voz» o ninguno. */
export function arregloDe(d: LineaDudosa, hayVoz: boolean): 'inicio' | 'fin' | null {
  if (d.motivos.includes('sinInicio')) return 'inicio'
  return hayVoz && (d.motivos.includes('finCorta') || d.motivos.includes('finTarde')) ? 'fin' : null
}

interface PropsArreglo {
  revision: Revision
  d: LineaDudosa
  fijarInicio(): void
  /** La línea tiene tiempos por palabra hechos a mano: el arreglo los quita (se puede deshacer). */
  conPalabras?: boolean
}

function BotonArreglo({ revision, d, fijarInicio, conPalabras }: PropsArreglo) {
  const arreglo = arregloDe(d, revision.voz !== null)
  if (arreglo === 'inicio') {
    return <Boton onClick={fijarInicio}>{R.fijarInicio}</Boton>
  }
  if (arreglo === 'fin') {
    return (
      <>
        <Boton onClick={revision.finAlFinalDeLaVoz}>{R.finVoz}</Boton>
        {conPalabras && <span className={css.nota}>{E.preciso.avisoTirador}</span>}
        <span role="status" className={css.nota}>
          {revision.mensajeSinSilencio ? R.sinSilencio : ''}
        </span>
      </>
    )
  }
  return null
}

interface PropsTarjeta {
  revision: Revision
  letra: Letra
  seleccion: string | null
  estado: EstadoCancion
  fijarInicio(): void
  /** «Escuchar otra vez» (= Mayús + L). */
  escuchar(): void
  probar(): void
  probarInactivo: boolean
  /** Chip de la parte de la línea (0.2.3), solo lectura; solo con reparto. */
  chipParte?: ReactNode
}

/** La tarjeta del recorrido, sobre los controles de siempre del panel Sincronía. */
export function TarjetaRevision({
  revision,
  letra,
  seleccion,
  estado,
  fijarInicio,
  escuchar,
  probar,
  probarInactivo,
  chipParte
}: PropsTarjeta) {
  const { vista } = revision
  const principal = useRef<HTMLButtonElement>(null)
  const montada = useRef(false)

  // Al empezar el foco va a «Está bien» (o al arreglo si no hay inicio); al terminar, a «Probar».
  // Con otro cambio de tarjeta solo se recupera si el botón que lo tenía desapareció.
  useEffect(() => {
    const perdido = !document.activeElement || document.activeElement === document.body
    const alTerminar = vista === 'fin' || vista === 'nada'
    if (!montada.current || alTerminar || perdido) principal.current?.focus({ preventScroll: true })
    montada.current = true
  }, [vista, revision.foco])

  const d = seleccion === null ? undefined : revision.porId.get(seleccion)
  const el = letra.lineas.find((l) => l.id === seleccion)
  const sinInicio = d?.motivos.includes('sinInicio') ?? false
  const idTitulo = 'revision-titulo'

  if (vista === 'fin' || vista === 'nada') {
    return (
      <section className={css.tarjeta} aria-labelledby={idTitulo} data-fin data-revision-tarjeta>
        <div className={css.cabecera}>
          <h3 id={idTitulo}>{R.finTitulo}</h3>
          <BotonIcono icono={X} etiqueta={R.salir} onClick={revision.terminar} />
        </div>
        <p className={vista === 'fin' ? css.finTexto : undefined}>
          {vista === 'fin' && <Icono icono={Check} tamano={16} />}
          {vista === 'nada'
            ? R.nadaFin
            : revision.sinInicioPendientes > 0
              ? R.faltaInicio(revision.sinInicioPendientes)
              : R.fin(revision.total)}
        </p>
        <div className={css.filas}>
          <Boton
            ref={principal}
            noDisponible={probarInactivo ? R.probar : undefined}
            onClick={probar}
          >
            {R.probar}
          </Boton>
        </div>
        {vista === 'fin' && (
          <p className={css.nota}>{estado === 'borrador' ? R.finMarcar : R.finHecho}</p>
        )}
      </section>
    )
  }

  const titulo = R.titulo(revision.quedan, revision.total)
  const cabecera = (
    <div className={css.cabecera}>
      <h3 id={idTitulo}>{titulo}</h3>
      {chipParte}
      <BotonIcono icono={X} etiqueta={R.salir} onClick={revision.terminar} />
    </div>
  )

  if (vista === 'fuera') {
    return (
      <section className={css.tarjeta} aria-labelledby={idTitulo} data-revision-tarjeta>
        {cabecera}
        <p>{R.fuera}</p>
        <div className={css.filas}>
          <Boton ref={principal} onClick={revision.volver}>
            {R.volver}
          </Boton>
        </div>
      </section>
    )
  }

  const corregida = vista === 'corregida'
  const motivos = d?.motivos ?? []
  const secundarios = motivos
    .slice(1)
    .map((m) => minuscula(R.motivo(m, d?.detalles[m], d?.finAutomatico)))
  const soloSinInicio =
    revision.sinInicioPendientes > 0 && revision.sinInicioPendientes === revision.quedan

  return (
    <section className={css.tarjeta} aria-labelledby={idTitulo} data-revision-tarjeta>
      {cabecera}
      {corregida ? (
        <p className={css.corregida}>{R.corregida}</p>
      ) : (
        d && (
          <>
            <p className={css.motivo}>
              <Icono icono={Flag} tamano={14} /> {motivoPrincipal(d)}
            </p>
            {secundarios.length > 0 && (
              <p className={css.tambien}>{R.tambien(secundarios.join('; '))}</p>
            )}
          </>
        )
      )}
      {soloSinInicio && <p className={css.nota}>{R.faltaInicio(revision.sinInicioPendientes)}</p>}
      <Boton
        ref={principal}
        className={css.bien}
        aria-label={corregida ? R.bienCorregida : R.bienNombre}
        noDisponible={!corregida && sinInicio ? R.noSinInicio : undefined}
        aria-keyshortcuts="N"
        onClick={revision.estaBien}
      >
        <span aria-hidden="true">{corregida ? R.bienCorregida : `✓ ${R.bienNombre}`}</span>
        <kbd aria-hidden="true" className={css.tecla}>
          N
        </kbd>
      </Boton>
      <div className={css.filas}>
        <Boton aria-label={R.anteriorAtajo} onClick={revision.anterior}>
          ‹ {R.anterior}
        </Boton>
        {!corregida && (
          <Boton aria-label={R.siguienteAtajo} onClick={revision.siguiente}>
            {R.siguiente} ›
          </Boton>
        )}
      </div>
      <div className={css.filas}>
        <Boton aria-label={R.escucharNombre} onClick={escuchar} disabled={el?.inicio_ms == null}>
          ▶ {R.escuchar}
        </Boton>
        {!corregida && d && (
          <BotonArreglo
            revision={revision}
            d={d}
            fijarInicio={fijarInicio}
            conPalabras={el ? tienePalabrasManuales(el) : false}
          />
        )}
      </div>
      <label className={css.filas}>
        <input
          type="checkbox"
          checked={revision.autoescucha}
          onChange={(e) => revision.fijarAutoescucha(e.currentTarget.checked)}
        />
        {R.autoescucha}
      </label>
    </section>
  )
}

interface PropsMarca {
  revision: Revision
  d: LineaDudosa
  fijarInicio(): void
  conPalabras?: boolean
}

/** La marca de una línea pendiente en el panel Sincronía cuando no hay recorrido. */
export function MarcaPanel({ revision, d, fijarInicio, conPalabras }: PropsMarca) {
  const sinInicio = d.motivos.includes('sinInicio')
  return (
    <div className={css.marcaPanel} data-revision-marca>
      <p className={css.motivo}>
        <Icono icono={Flag} tamano={14} /> {motivoPrincipal(d)}
      </p>
      <div className={css.filas}>
        <Boton
          noDisponible={sinInicio ? R.noSinInicio : undefined}
          onClick={revision.marcarSeleccionada}
        >
          {R.bienPanel}
        </Boton>
        <BotonArreglo
          revision={revision}
          d={d}
          fijarInicio={fijarInicio}
          conPalabras={conPalabras}
        />
      </div>
    </div>
  )
}
