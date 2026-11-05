import { useEffect, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleX,
  RefreshCw
} from 'lucide-react'
import type { EstadoRuntimeIpc, FaseRuntime } from '@shared/ipc'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { BarraProgreso } from '../../componentes/BarraProgreso'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { Icono } from '../../componentes/Icono'
import { mostrarToast } from '../../componentes/gestorToasts'
import { aMb, enfocar, FASES, NOMBRE_FASE, textoEta, type AcumuladoProgreso } from './modelo'
import { Logotipo } from './PantallasInicio'
import { PA } from './textos'
import estilos from './primerArranque.module.css'

type EstadoFase = EstadoRuntimeIpc['fases'][FaseRuntime]

const ICONOS = { pendiente: Circle, en_curso: RefreshCw, completada: Check, error: CircleX }
const NOMBRE_ESTADO: Record<EstadoFase, string> = {
  pendiente: 'pendiente',
  en_curso: 'en curso',
  completada: 'completada',
  error: 'con error'
}

/** Ver detalles / Copiar detalles (B2 y B4): `runtime.detalles()` es el texto de soporte. */
function Detalles({ clave }: { clave: string }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState<string | null>(null)
  useEffect(() => {
    if (!abierto) return
    let activo = true
    window.shinobi.runtime.detalles().then(
      (t) => activo && setTexto(t),
      () => activo && setTexto('')
    )
    return () => {
      activo = false
    }
  }, [abierto, clave])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(await window.shinobi.runtime.detalles())
      mostrarToast({ tipo: 'exito', mensaje: PA.detallesCopiados })
    } catch {
      mostrarToast({ tipo: 'error', mensaje: PA.detallesNoCopiados })
    }
  }
  return (
    <div className={estilos.detalles}>
      <button
        type="button"
        className={estilos.enlace}
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        <Icono icono={abierto ? ChevronDown : ChevronRight} tamano={14} />{' '}
        {abierto ? PA.ocultarDetalles : PA.verDetalles}
      </button>
      {abierto && (
        <>
          {/* Región desplazable: debe poder recibir el foco para leerla con teclado. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <pre className={estilos.detallesCaja} tabIndex={0} aria-label={PA.verDetalles}>
            {texto ?? PA.detallesCargando}
          </pre>
          <Boton onClick={() => void copiar()}>{PA.botonCopiar}</Boton>
        </>
      )}
    </div>
  )
}

interface ListaFasesProps {
  fases: Record<FaseRuntime, EstadoFase>
  acumulado: AcumuladoProgreso
  /** Solo en B4: sin barras ni cifras, el error va debajo. */
  sinProgreso?: boolean
}

function ListaFases({ fases, acumulado, sinProgreso }: ListaFasesProps) {
  const p = acumulado.ultimo
  return (
    <ol className={estilos.fases} aria-label={PA.instalandoTitulo}>
      {FASES.map((f) => {
        const estado = fases[f]
        const enCurso = estado === 'en_curso'
        const subestado = enCurso && f === 'componentes' && p?.comprobando
        const conCifra = !sinProgreso && enCurso && p?.faseVisible === f && p.total > 0
        return (
          <li key={f} className={`${estilos.fase} ${estilos[`fase_${estado}`] ?? ''}`}>
            <span className={estilos.icono}>
              <Icono icono={ICONOS[estado]} tamano={18} />
              <span className={estilos.soloLector}>{NOMBRE_ESTADO[estado]}:</span>
            </span>
            <div className={estilos.faseCuerpo}>
              <div className={estilos.faseCabeza}>
                <span>{NOMBRE_FASE[f]}</span>
                {conCifra && p && (
                  <span className={estilos.cifra}>
                    {aMb(p.bytes)} MB de {aMb(p.total)} MB
                  </span>
                )}
              </div>
              {subestado && <span className={estilos.sub}>{PA.faseDiagnostico}</span>}
              {!sinProgreso && enCurso && !subestado && (
                <BarraProgreso
                  etiqueta={NOMBRE_FASE[f]}
                  valor={acumulado.fases[f]}
                  indeterminada={!p || p.faseVisible !== f || p.total === 0}
                />
              )}
              {!sinProgreso && enCurso && subestado && (
                <BarraProgreso etiqueta={PA.faseDiagnostico} indeterminada />
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

interface InstalandoProps {
  fases: Record<FaseRuntime, EstadoFase>
  acumulado: AcumuladoProgreso
  mensajeModo: string | null
  rebajaResaltada: boolean
  alPausar: () => void
}

export function Instalando({
  fases,
  acumulado,
  mensajeModo,
  rebajaResaltada,
  alPausar
}: InstalandoProps) {
  // Un reloj de 1 s: el tiempo restante sale a los 10 s y se refresca como mucho una vez por segundo.
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const transcurrido = acumulado.inicio === null ? 0 : ahora - acumulado.inicio
  const eta = textoEta(acumulado.ultimo?.etaSegundos ?? null, transcurrido)
  return (
    <section className={estilos.pantalla} aria-labelledby="pa-titulo">
      <Logotipo />
      <h1 id="pa-titulo" className={`t-titulo ${estilos.titulo}`}>
        {PA.instalandoTitulo}
      </h1>
      <ListaFases fases={fases} acumulado={acumulado} />
      <div className={estilos.total}>
        <BarraProgreso
          etiqueta={PA.total}
          valor={acumulado.total}
          textoValor={`${acumulado.total} %`}
        />
        <span className={estilos.totalTexto}>
          {PA.total} {acumulado.total} % · {eta}
        </span>
      </div>
      {mensajeModo && (
        <div className={estilos.ancho}>
          <AvisoEnLinea tipo={rebajaResaltada ? 'aviso' : 'info'}>{mensajeModo}</AvisoEnLinea>
        </div>
      )}
      <Boton ref={enfocar} onClick={alPausar}>
        {PA.botonPausar}
      </Boton>
      <Detalles clave={`${acumulado.ultimo?.faseVisible ?? ''}`} />
    </section>
  )
}

export function ErrorInstalacion({
  fases,
  acumulado,
  titulo,
  cuerpo,
  alReintentar,
  alSalir
}: {
  fases: Record<FaseRuntime, EstadoFase>
  acumulado: AcumuladoProgreso
  titulo: string
  cuerpo: string
  alReintentar: () => void
  alSalir: () => void
}) {
  return (
    <section className={estilos.pantalla} aria-labelledby="pa-titulo">
      <Logotipo />
      <h1 id="pa-titulo" className={`t-titulo ${estilos.titulo}`}>
        {PA.instalandoTitulo}
      </h1>
      <ListaFases fases={fases} acumulado={acumulado} sinProgreso />
      <div className={estilos.ancho}>
        <AvisoEnLinea tipo="error">
          <strong>{titulo}</strong> {cuerpo}
        </AvisoEnLinea>
      </div>
      <div className={estilos.acciones}>
        <Boton variante="primario" ref={enfocar} onClick={alReintentar}>
          {PA.botonReintentar}
        </Boton>
        <Boton variante="fantasma" onClick={alSalir}>
          {PA.botonSalir}
        </Boton>
      </div>
      <Detalles clave="error" />
    </section>
  )
}

export function TodoListo({
  modo,
  tiempo,
  alEmpezar
}: {
  modo: string | null
  tiempo: string | null
  alEmpezar: () => void
}) {
  return (
    <section className={estilos.pantalla} aria-labelledby="pa-titulo">
      <Logotipo />
      <span className={estilos.listo}>
        <Icono icono={CircleCheck} tamano={48} />
      </span>
      <h1 id="pa-titulo" className={`t-titulo ${estilos.titulo}`}>
        {PA.listoTitulo}
      </h1>
      <p className={estilos.texto}>{PA.listoCuerpo}</p>
      {modo && <p className={estilos.texto}>{PA.listoModo(modo)}</p>}
      {tiempo && <p className={estilos.texto}>{tiempo}</p>}
      <Boton variante="primario" tamano="grande" ref={enfocar} onClick={alEmpezar}>
        {PA.botonEmpezar}
      </Boton>
    </section>
  )
}

export function DialogoPausar({
  abierto,
  alSeguir,
  alPausar
}: {
  abierto: boolean
  alSeguir: () => void
  alPausar: () => void
}) {
  return (
    <Dialogo
      abierto={abierto}
      titulo={PA.pausarTitulo}
      onCancelar={alSeguir}
      enfoqueInicial="[data-seguir]"
      acciones={
        <>
          <Boton data-seguir onClick={alSeguir}>
            {PA.pausarSeguir}
          </Boton>
          <Boton variante="primario" onClick={alPausar}>
            {PA.botonPausar}
          </Boton>
        </>
      }
    >
      <p>{PA.pausarCuerpo}</p>
    </Dialogo>
  )
}
