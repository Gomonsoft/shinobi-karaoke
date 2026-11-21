import { useContext, useEffect, useId, useRef, useState } from 'react'
import { causaSinPerfiles, sinPerfiles, type OpcionesExportacion } from './modelo'
import type { CodigoError } from '@shared/errores'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { mostrarToast } from '../../componentes/gestorToasts'
import { NavegacionContexto } from '../../navegacion/estado'
import { useSesion } from '../../sesion/ProveedorSesion'
import { Formulario } from './Formulario'
import { EXP, ERRORES_EXP, formatearPosicion, textoErrorExp } from './textos'
import { useFormulario } from './useFormulario'
import estilos from './exportacion.module.css'

/** Tiempo sin perfiles a partir del cual se explica la espera (`exp.cargando`). */
export const RETARDO_CARGANDO_MS = 300

interface Props {
  cancionId: string
  /** Hay un borrador de tema sin guardar en el editor. */
  temaBorrador?: boolean
  /** «Cambiar opciones» (D): parte de estas opciones en lugar de las recordadas. */
  opcionesIniciales?: OpcionesExportacion
  /** «Cambiar opciones» (D): el destino parte del de esa exportación (0133). */
  desdeTrabajoId?: string
  /** `iniciar` fue aceptado: el diálogo pasa a seguir la exportación. */
  alIniciada(trabajoId: string): void
  alCerrar(): void
}

/** Causa que se muestra en el estado F según el código o los motivos de los perfiles. */
function textoSinPerfiles(codigo: CodigoError | 'no_comprobado'): string {
  if (codigo === 'SIN_CODIFICADOR') return EXP.sinPerfilesCodificador
  if (codigo === 'no_comprobado') return EXP.sinPerfilesNoComprobado
  return textoErrorExp(codigo).explicacion
}

function copiarDetalles(texto: string): void {
  void navigator.clipboard?.writeText(texto)
  mostrarToast({ tipo: 'exito', mensaje: EXP.copiados })
}

/**
 * Estados A (formulario), E (archivo existente), «Cargando perfiles», «Validando» y F (sin
 * perfiles) del diálogo «Exportar video» (docs/ux/10).
 */
export function DialogoFormulario({
  cancionId,
  temaBorrador,
  opcionesIniciales,
  desdeTrabajoId,
  alIniciada,
  alCerrar
}: Props) {
  const f = useFormulario(cancionId, opcionesIniciales, desdeTrabajoId)
  const { haySesion } = useSesion()
  const navegacion = useContext(NavegacionContexto)
  const idCabecera = useId()
  const raiz = useRef<HTMLDivElement>(null)
  const [lento, setLento] = useState(false)

  const cargando = f.carga.tipo === 'cargando'
  useEffect(() => {
    if (!cargando) return
    const t = setTimeout(() => setLento(true), RETARDO_CARGANDO_MS)
    return () => clearTimeout(t)
  }, [cargando])

  // Fase F: la comprobación inicial falló o ningún perfil está soportado.
  let sinCapacidad: {
    codigo: CodigoError
    causa: string
    reparar: boolean
    detalles: string
  } | null = null
  if (f.carga.tipo === 'error' && f.carga.codigo !== 'CANCION_NO_DISPONIBLE') {
    const codigo = f.carga.codigo
    sinCapacidad = {
      codigo,
      causa: textoSinPerfiles(codigo),
      reparar: codigo === 'RUNTIME_NO_DISPONIBLE',
      detalles: `${codigo}: ${f.carga.mensaje}`.trim()
    }
  } else if (f.carga.tipo === 'listo' && f.perfiles && sinPerfiles(f.perfiles)) {
    const causa = causaSinPerfiles(f.perfiles)
    sinCapacidad = {
      codigo: causa === 'codificador' ? 'SIN_CODIFICADOR' : 'ERROR_INTERNO',
      causa: textoSinPerfiles(causa === 'codificador' ? 'SIN_CODIFICADOR' : 'no_comprobado'),
      reparar: false,
      detalles: `${causa === 'codificador' ? 'SIN_CODIFICADOR' : 'ERROR_INTERNO'}: ${causa}`
    }
  }
  const sinCancion = f.carga.tipo === 'error' && f.carga.codigo === 'CANCION_NO_DISPONIBLE'
  const fase = sinCapacidad ? 'F' : sinCancion ? 'cancion' : 'A'

  // Foco inicial: A → «Audio» (opción elegida); F y errores → la acción principal.
  const enfocado = useRef<string | null>(null)
  useEffect(() => {
    const clave = fase === 'A' ? (f.carga.tipo === 'listo' ? 'A' : null) : fase
    if (!clave || enfocado.current === clave) return
    enfocado.current = clave
    const destino =
      clave === 'A'
        ? raiz.current?.querySelector<HTMLElement>('[data-foco-audio] [aria-checked="true"]')
        : (raiz.current?.querySelector<HTMLElement>('[data-reparar]') ??
          raiz.current?.parentElement?.querySelector<HTMLElement>('[data-cerrar]'))
    destino?.focus()
  }, [fase, f.carga.tipo])

  const reparar = () => {
    alCerrar()
    navegacion?.ir({ tipo: 'primer-arranque' })
  }

  const cancion = f.cancion
  const cabecera = cancion
    ? `«${cancion.titulo}»${cancion.artista ? ` · ${cancion.artista}` : ''} · ${formatearPosicion(cancion.duracionMs)}`
    : ''

  if (fase === 'F') {
    const info = sinCapacidad!
    return (
      <Dialogo
        abierto
        titulo={EXP.titulo}
        onCancelar={alCerrar}
        ancho="36rem"
        acciones={
          <>
            <Boton onClick={() => copiarDetalles(info.detalles)}>{EXP.botonCopiar}</Boton>
            <Boton
              data-cerrar
              variante={info.reparar ? 'secundario' : 'primario'}
              onClick={alCerrar}
            >
              {EXP.botonCerrar}
            </Boton>
          </>
        }
      >
        <div ref={raiz} data-estado="sin-perfiles">
          <AvisoEnLinea
            tipo="error"
            accion={
              info.reparar ? (
                <Boton data-reparar onClick={reparar}>
                  {EXP.reparar}
                </Boton>
              ) : undefined
            }
          >
            <strong>{EXP.sinPerfilesTitulo}</strong> {info.causa}
          </AvisoEnLinea>
        </div>
      </Dialogo>
    )
  }

  if (fase === 'cancion') {
    const t = ERRORES_EXP.CANCION_NO_DISPONIBLE!
    return (
      <Dialogo
        abierto
        titulo={EXP.titulo}
        onCancelar={alCerrar}
        ancho="36rem"
        acciones={
          <Boton data-cerrar variante="primario" onClick={alCerrar}>
            {EXP.botonCerrar}
          </Boton>
        }
      >
        <div ref={raiz} data-estado="sin-cancion">
          <AvisoEnLinea tipo="error">
            <strong>{t.titulo}</strong> {t.explicacion}
          </AvisoEnLinea>
        </div>
      </Dialogo>
    )
  }

  const listo = f.carga.tipo === 'listo'
  const sustituye = f.destino?.existe === true
  const exportar = async () => {
    const trabajoId = await f.iniciar()
    if (trabajoId) alIniciada(trabajoId)
  }
  return (
    <Dialogo
      abierto
      titulo={EXP.titulo}
      onCancelar={alCerrar}
      ancho="45rem"
      descripcionId={idCabecera}
      acciones={
        <>
          <Boton onClick={alCerrar}>{EXP.botonCancelar}</Boton>
          <Boton
            variante="primario"
            disabled={!listo}
            cargando={f.iniciando}
            textoCargando={EXP.botonValidando}
            onClick={() => void exportar()}
          >
            {sustituye ? EXP.botonSustituir : EXP.botonExportar}
          </Boton>
        </>
      }
    >
      <div
        ref={raiz}
        className={estilos.contenedor}
        data-estado={listo ? 'formulario' : 'cargando'}
      >
        <div className={estilos.cuerpo}>
          <p id={idCabecera} className={estilos.cabecera}>
            {cabecera || (lento ? EXP.cargandoCancion : ' ')}
          </p>
          <div data-foco-audio>
            <Formulario
              cancion={f.cancion}
              perfiles={f.perfiles}
              opciones={f.opciones}
              destino={f.destino}
              estimacion={f.estimacion}
              anuncios={f.anuncios}
              error={f.error}
              haySesion={haySesion}
              temaBorrador={temaBorrador === true}
              mostrarCargando={lento}
              alCambiarAudio={f.cambiarAudio}
              alCambiarProporcion={f.cambiarProporcion}
              alCambiarResolucion={f.cambiarResolucion}
              alCambiarFps={f.cambiarFps}
              alCambiarFormato={f.cambiarFormato}
              alCambiarDestino={() => void f.cambiarDestino()}
            />
          </div>
        </div>
      </div>
    </Dialogo>
  )
}
