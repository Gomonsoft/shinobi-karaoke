import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Minus } from 'lucide-react'
import type { ResumenCancionIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../../componentes/AvisoEnLinea'
import { BarraProgreso } from '../../../componentes/BarraProgreso'
import { Boton } from '../../../componentes/Boton'
import { Dialogo } from '../../../componentes/Dialogo'
import { Icono } from '../../../componentes/Icono'
import { mostrarToast } from '../../../componentes/gestorToasts'
import estilosComponentes from '../../../componentes/componentes.module.css'
import { codigoDeError, formatearTamano } from '../../../exportacion/dialogo/textos'
import { copiarDetalles } from '../../../soporte/detalles'
import { detallesDeError } from '../errores'
import {
  cerrarExportarPaquete,
  eleccion,
  iniciarSeguimiento,
  marcarCancelando,
  reintentarExportarPaquete,
  textoErrorCrear,
  usePaquetes,
  type PeticionExportar,
  type SeguimientoCopia
} from './almacen'
import { notaDeExportar } from './modelo'
import estilos from './paquete.module.css'
import { AJCOPIA, PAQ } from './textos'
import { estaProcesando, estaSeparando, sinAudio, textoEstado, useResumenes } from './useResumenes'

type DestinoCopia = Awaited<ReturnType<typeof window.shinobi.copias.destinoPropuesto>>

const menosDe1Mb = (bytes: number): string =>
  bytes < 1_000_000 ? PAQ.exp.tamanoMenosDe1 : PAQ.exp.tamano(formatearTamano(bytes))

/**
 * «Exportar paquete» y «Crear copia de seguridad» (docs/ux/02 y 08 · Feature 9): el formulario, «Creando
 * el paquete» y el final, en el mismo diálogo. El trabajo sigue en segundo plano si se cierra.
 */
export function DialogoExportarPaquete({ peticion }: { peticion: PeticionExportar }) {
  const { seguimiento } = usePaquetes()
  const s = seguimiento?.tipo === 'exportar' ? seguimiento : null
  // Cancelado con el diálogo abierto: se cierra y se avisa (con el cerrado lo avisa el almacén).
  const estadoS = s?.estado
  useEffect(() => {
    if (estadoS === 'cancelada') {
      mostrarToast({
        tipo: 'info',
        mensaje: s?.esCopia ? AJCOPIA.toastCancelada : PAQ.ok.toastCancelado
      })
      cerrarExportarPaquete()
    }
  }, [estadoS, s?.esCopia])
  if (s && s.estado !== 'cancelada') return <Seguimiento s={s} />
  return <Formulario peticion={peticion} />
}

// --- Formulario -----------------------------------------------------------------------------------------

function Formulario({ peticion }: { peticion: PeticionExportar }) {
  const esCopia = peticion.tipo === 'biblioteca'
  const resumenes = useResumenes()
  const [completo, setCompleto] = useState(eleccion.completo)
  const [ajustes, setAjustes] = useState(eleccion.ajustes)
  const [destino, setDestino] = useState<DestinoCopia | null>(null)
  const [errorDestino, setErrorDestino] = useState<string | null>(null)
  const [errorGeneral, setErrorGeneral] = useState<unknown>(null)
  const [enviando, setEnviando] = useState(false)
  const [verCuales, setVerCuales] = useState(false)
  const [temas, setTemas] = useState<number | null>(null)
  const idDestino = useId()
  const idDerechos = useId()
  const idLista = useId()
  const idError = useId()
  const idsPeticion = peticion.tipo === 'canciones' ? peticion.ids : null

  useEffect(() => {
    let vivo = true
    window.shinobi.copias
      .destinoPropuesto(
        idsPeticion ? { tipo: 'canciones', ids: idsPeticion } : { tipo: 'biblioteca' }
      )
      .then(
        (d) => vivo && setDestino(d),
        (e: unknown) => {
          if (vivo)
            setErrorDestino(PAQ.error[codigoDeError(e) as 'SIN_ESPACIO'] ?? PAQ.error.generico)
        }
      )
    return () => {
      vivo = false
    }
  }, [idsPeticion])

  useEffect(() => {
    if (!esCopia || typeof window.shinobi.temas?.catalogo !== 'function') return
    let vivo = true
    window.shinobi.temas.catalogo().then(
      (c) => vivo && setTemas(c.temas.length),
      () => undefined
    )
    return () => {
      vivo = false
    }
  }, [esCopia])

  const canciones = useMemo<ResumenCancionIpc[]>(() => {
    if (!resumenes) return []
    if (idsPeticion) {
      const porId = new Map(resumenes.map((c) => [c.id, c]))
      return idsPeticion.map((id) => porId.get(id)).filter((c): c is ResumenCancionIpc => !!c)
    }
    // Una copia lleva todas las que se pueden leer; las de `cancion.json` ilegible se omiten.
    return resumenes.filter((c) => !(c.danada && c.motivo === 'json'))
  }, [resumenes, idsPeticion])
  const enCurso = esCopia ? canciones.filter(estaProcesando).length : 0

  const estimado = destino?.estimacion
    ? completo
      ? destino.estimacion.completoBytes
      : destino.estimacion.ligeroBytes
    : null
  const libre = destino?.libreBytes ?? null
  const noCabe = estimado !== null && libre !== null && estimado > libre

  const elegir = (valor: boolean) => {
    eleccion.completo = valor
    setCompleto(valor)
  }

  const cambiarDestino = async () => {
    if (!destino) return
    setErrorDestino(null)
    try {
      const nuevo = await window.shinobi.copias.elegirDestino(destino.destinoId)
      if (nuevo) setDestino(nuevo)
    } catch (e) {
      setErrorDestino(
        PAQ.error[codigoDeError(e) as 'SIN_ESPACIO'] ?? PAQ.error.DESTINO_NO_DISPONIBLE
      )
    }
  }

  const exportar = async () => {
    if (!destino || enviando) return
    setEnviando(true)
    setErrorDestino(null)
    setErrorGeneral(null)
    eleccion.ajustes = ajustes
    try {
      const { trabajoId } = idsPeticion
        ? await window.shinobi.copias.exportarCanciones({
            ids: idsPeticion,
            conAudio: completo,
            destinoId: destino.destinoId
          })
        : await window.shinobi.copias.exportarBiblioteca({
            conAudio: completo,
            ajustes,
            destinoId: destino.destinoId
          })
      iniciarSeguimiento({
        tipo: 'exportar',
        trabajoId,
        completo,
        esCopia,
        n: canciones.length,
        carpeta: destino.carpeta,
        peticion,
        titulos: Object.fromEntries(
          canciones.map((c) => [c.id, { titulo: c.titulo, artista: c.artista }])
        )
      })
    } catch (e) {
      setEnviando(false)
      const codigo = codigoDeError(e)
      if (codigo === 'DESTINO_NO_DISPONIBLE') setErrorDestino(PAQ.error.DESTINO_NO_DISPONIBLE)
      else setErrorGeneral(e)
    }
  }

  const titulo = esCopia ? AJCOPIA.dialogoTitulo : PAQ.exp.titulo
  const una = canciones.length === 1 ? canciones[0] : undefined
  const ayudaCompleto = esCopia ? AJCOPIA.completaAyuda : PAQ.exp.completoAyuda
  const ayudaLigero = esCopia ? AJCOPIA.ligeraAyuda : PAQ.exp.ligeroAyuda
  const botonNombre = destino?.existe
    ? PAQ.exp.botonSustituir
    : esCopia
      ? AJCOPIA.boton
      : PAQ.exp.boton

  return (
    <Dialogo
      abierto
      titulo={titulo}
      ancho="36rem"
      onCancelar={cerrarExportarPaquete}
      enfoqueInicial="input[type='radio'][data-elegida]"
      acciones={
        <>
          <Boton variante="fantasma" onClick={cerrarExportarPaquete}>
            {PAQ.creando.cancelar}
          </Boton>
          <Boton
            variante="primario"
            onClick={() => void exportar()}
            cargando={enviando}
            textoCargando="Exportando…"
            noDisponible={destino ? undefined : PAQ.exp.tamanoCalculando}
            aria-describedby={idDerechos}
          >
            {botonNombre}
          </Boton>
        </>
      }
    >
      <div className={estilos.cuerpo}>
        <div className={estilos.cabecera}>
          <span>
            {esCopia
              ? AJCOPIA.dialogoCabecera(canciones.length, temas ?? 0)
              : una
                ? PAQ.exp.cabeceraUna(una.titulo, una.artista || 'Sin artista')
                : PAQ.exp.cabeceraVarias(canciones.length)}
          </span>
          {!esCopia && canciones.length > 1 && (
            <Boton
              variante="fantasma"
              aria-expanded={verCuales}
              aria-controls={idLista}
              onClick={() => setVerCuales((v) => !v)}
            >
              {verCuales ? PAQ.exp.ocultarCuales : PAQ.exp.verCuales}
            </Boton>
          )}
        </div>
        {!esCopia && verCuales && (
          <ul id={idLista} className={`${estilos.lista} ${estilos.listaCorta}`}>
            {canciones.map((c) => {
              const nota = notaDeExportar({
                sinAudio: sinAudio(c),
                enCurso: estaProcesando(c),
                separando: estaSeparando(c)
              })
              return (
                <li key={c.id} className={estilos.filaLista}>
                  <span />
                  <span className={estilos.filaTexto}>
                    <span className={estilos.filaTitulo}>
                      {c.titulo} — {c.artista || 'Sin artista'} · {textoEstado(c)}
                    </span>
                    {nota && <span className={`t-pequeno ${estilos.filaNota}`}>{nota}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        <fieldset className={estilos.opciones}>
          <legend>{PAQ.exp.incluye}</legend>
          <Opcion
            nombre="incluye"
            elegida={completo}
            alElegir={() => elegir(true)}
            titulo={esCopia ? AJCOPIA.completaTitulo : PAQ.exp.completoTitulo}
            ayuda={ayudaCompleto}
            tamano={destino?.estimacion ? menosDe1Mb(destino.estimacion.completoBytes) : null}
          />
          <Opcion
            nombre="incluye"
            elegida={!completo}
            alElegir={() => elegir(false)}
            titulo={esCopia ? AJCOPIA.ligeraTitulo : PAQ.exp.ligeroTitulo}
            ayuda={ayudaLigero}
            tamano={destino?.estimacion ? menosDe1Mb(destino.estimacion.ligeroBytes) : null}
          />
        </fieldset>

        {esCopia && (
          <label className={estilos.casilla}>
            <input
              type="checkbox"
              checked={ajustes}
              onChange={(e) => setAjustes(e.target.checked)}
            />
            {AJCOPIA.ajustes}
          </label>
        )}
        {enCurso > 0 && <AvisoEnLinea tipo="info">{AJCOPIA.notaEnCurso(enCurso)}</AvisoEnLinea>}

        <div className={estilos.fila}>
          <label htmlFor={idDestino} className={estilos.etiqueta}>
            {PAQ.exp.guardar}
          </label>
          <div className={estilos.filaDestino}>
            <input
              id={idDestino}
              readOnly
              value={
                destino ? `${destino.carpeta}${separador(destino.carpeta)}${destino.nombre}` : ''
              }
              title={
                destino ? `${destino.carpeta}${separador(destino.carpeta)}${destino.nombre}` : ''
              }
              aria-invalid={errorDestino ? true : undefined}
              aria-describedby={errorDestino ? idError : undefined}
              className={`${estilosComponentes.entrada} ${estilos.ruta} ${errorDestino ? estilos.rutaError : ''}`}
            />
            <Boton onClick={() => void cambiarDestino()}>{PAQ.exp.cambiar}</Boton>
          </div>
          {errorDestino && (
            <div id={idError}>
              <AvisoEnLinea tipo="error">{errorDestino}</AvisoEnLinea>
            </div>
          )}
        </div>

        {errorGeneral !== null && (
          <AvisoEnLinea
            tipo="error"
            accion={
              <Boton
                variante="fantasma"
                onClick={() => void copiarDetalles(detallesDeError(errorGeneral))}
              >
                {PAQ.error.copiar}
              </Boton>
            }
          >
            {textoErrorCrear(codigoDeError(errorGeneral))}
          </AvisoEnLinea>
        )}
        {destino?.existe && <AvisoEnLinea tipo="info">{PAQ.exp.existe}</AvisoEnLinea>}
        {noCabe && estimado !== null && libre !== null && (
          <AvisoEnLinea tipo="aviso">
            {PAQ.exp.espacio(formatearTamano(estimado), formatearTamano(libre))}
          </AvisoEnLinea>
        )}
        <div id={idDerechos}>
          <AvisoEnLinea tipo="aviso">{completo ? PAQ.derechos : PAQ.derechosLigero}</AvisoEnLinea>
        </div>
      </div>
    </Dialogo>
  )
}

/** Separador de la ruta que muestra el campo (la de Windows lleva `\`). */
const separador = (carpeta: string): string => (carpeta.includes('\\') ? '\\' : '/')

function Opcion(p: {
  nombre: string
  elegida: boolean
  alElegir: () => void
  titulo: string
  ayuda: string
  tamano: string | null
}) {
  const id = useId()
  return (
    <label htmlFor={id} className={estilos.opcion} data-elegida={p.elegida ? '' : undefined}>
      <input
        id={id}
        type="radio"
        name={p.nombre}
        checked={p.elegida}
        data-elegida={p.elegida ? '' : undefined}
        aria-describedby={`${id}-ayuda`}
        onChange={p.alElegir}
      />
      <span className={estilos.opcionTitulo}>{p.titulo}</span>
      <span className={`t-pequeno ${estilos.tamano}`}>{p.tamano ?? PAQ.exp.tamanoCalculando}</span>
      <span id={`${id}-ayuda`} className={`t-pequeno ${estilos.opcionAyuda}`}>
        {p.ayuda}
      </span>
    </label>
  )
}

// --- Creando y final ---------------------------------------------------------------------------------------

function Seguimiento({ s }: { s: SeguimientoCopia }) {
  const hito = useRef(0)
  const [anuncio, setAnuncio] = useState('')
  const pct = Math.round(s.fraccion * 100)
  // Hitos anunciados: inicio, 25/50/75 % y fin (nunca cada porcentaje).
  useEffect(() => {
    if (s.estado !== 'en_curso') return
    const actual = pct >= 75 ? 75 : pct >= 50 ? 50 : pct >= 25 ? 25 : 0
    if (actual > hito.current) {
      hito.current = actual
      setAnuncio(`${actual} %`)
    }
  }, [pct, s.estado])

  const cancelar = async () => {
    marcarCancelando()
    try {
      await window.shinobi.copias.cancelar(s.trabajoId)
    } catch {
      /* el estado final llega por `copias:cambio` */
    }
  }

  if (s.estado === 'en_curso') {
    const c = s.cancion
    return (
      <Dialogo
        abierto
        titulo={s.esCopia ? AJCOPIA.creandoTitulo : PAQ.creando.titulo}
        ancho="32.5rem"
        onCancelar={cerrarExportarPaquete}
        enfoqueInicial="[data-seguir]"
        acciones={
          <>
            <Boton
              variante="fantasma"
              onClick={() => void cancelar()}
              noDisponible={s.cancelando ? PAQ.creando.cancelando : undefined}
            >
              {PAQ.creando.cancelar}
            </Boton>
            <Boton variante="primario" data-seguir onClick={cerrarExportarPaquete}>
              {PAQ.creando.seguir}
            </Boton>
          </>
        }
      >
        <div className={estilos.cuerpo}>
          <p className={estilos.suave}>{PAQ.creando.resumen(s.n, s.completo)}</p>
          <p>{c ? PAQ.creando.progreso(c.titulo, c.hechas, c.total) : PAQ.creando.preparando}</p>
          <BarraProgreso
            etiqueta={PAQ.creando.titulo}
            valor={pct}
            indeterminada={s.fraccion === 0 && !c}
          />
          <p className={`t-pequeno ${estilos.segundoPlano}`}>
            {s.esCopia ? AJCOPIA.segundoPlano : PAQ.creando.segundoPlano}
          </p>
          <p role="status" className={estilosComponentes.soloLector}>
            {anuncio}
          </p>
        </div>
      </Dialogo>
    )
  }

  if (s.estado === 'terminada' && s.resultadoExp) {
    const r = s.resultadoExp
    return (
      <Dialogo
        abierto
        titulo={PAQ.ok.titulo}
        ancho="32.5rem"
        onCancelar={cerrarExportarPaquete}
        enfoqueInicial="[data-mostrar]"
        acciones={
          <>
            <Boton variante="fantasma" onClick={cerrarExportarPaquete}>
              {PAQ.ok.cerrar}
            </Boton>
            <Boton
              variante="primario"
              data-mostrar
              onClick={() =>
                void window.shinobi.letras.mostrarEnCarpeta(r.ubicacionId).catch(() => undefined)
              }
            >
              {PAQ.ok.mostrar}
            </Boton>
          </>
        }
      >
        <div className={estilos.cuerpo}>
          <p role="status">{PAQ.ok.resumen(r.nombre, r.canciones, formatearTamano(r.bytes))}</p>
          {s.carpeta && (
            <p className={estilos.carpetaLinea} title={s.carpeta}>
              {PAQ.ok.carpeta(s.carpeta)}
            </p>
          )}
          {r.omitidas.length > 0 && (
            <>
              <p>{PAQ.ok.omitidas(r.omitidas.length)}</p>
              <ul className={`${estilos.lista} ${estilos.listaCorta}`}>
                {r.omitidas.map((o) => (
                  <li key={o.id} className={estilos.filaLista}>
                    <Icono icono={Minus} tamano={16} className={estilos.icono} />
                    <span className={estilos.filaTexto}>
                      <span className={estilos.filaTitulo}>{s.titulos[o.id]?.titulo ?? o.id}</span>
                      <span className={`t-pequeno ${estilos.filaNota}`}>
                        {PAQ.motivo[o.motivo] ?? PAQ.fallo.guardar}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Dialogo>
    )
  }

  // Error al crear (también una terminada sin resultado, que no debería ocurrir).
  const peticion = s.peticion
  return (
    <Dialogo
      abierto
      titulo={s.esCopia ? AJCOPIA.dialogoTitulo : PAQ.exp.titulo}
      ancho="32.5rem"
      onCancelar={cerrarExportarPaquete}
      acciones={
        <>
          <Boton variante="fantasma" onClick={cerrarExportarPaquete}>
            {PAQ.ok.cerrar}
          </Boton>
          {peticion && (
            <Boton variante="primario" onClick={() => reintentarExportarPaquete(peticion)}>
              {PAQ.error.reintentar}
            </Boton>
          )}
        </>
      }
    >
      <div className={estilos.cuerpo}>
        <AvisoEnLinea
          tipo="error"
          accion={
            <Boton
              variante="fantasma"
              onClick={() =>
                void copiarDetalles(detallesDeError({ codigo: s.codigo, mensaje: s.mensaje ?? '' }))
              }
            >
              {PAQ.error.copiar}
            </Boton>
          }
        >
          {textoErrorCrear(s.codigo)}
        </AvisoEnLinea>
      </div>
    </Dialogo>
  )
}
