import { useEffect, useRef, useState } from 'react'
import type { ResumenCancionIpc } from '@shared/ipc'
import { AvisoEnLinea } from '../../../componentes/AvisoEnLinea'
import { Boton } from '../../../componentes/Boton'
import { CampoTexto } from '../../../componentes/Campos'
import { Dialogo } from '../../../componentes/Dialogo'
import { mostrarToast } from '../../../componentes/gestorToasts'
import comunes from '../../../componentes/componentes.module.css'
import temas from '../../../temas/temas.module.css'
import { TEMA, tituloYArtista } from '../../../temas/textos'
import { copiarDetalles } from '../../../soporte/detalles'
import { tituloDeError } from '../textosError'
import { ListaCanciones, type FilaCancion } from './ListaCanciones'
import type { SalidaAccion } from './DialogoPreparar'
import { esProblema, falladas, filaDeResultado, hechas } from './resultado'
import { ACC, motivoDe } from './textos'
import { useAccionVarias } from './useAccionVarias'
import estilos from '../biblioteca.module.css'

/** Espera tras la última tecla antes de recalcular el impacto (spec 02, «Editar datos…»). */
export const RETRASO_IMPACTO_MS = 300

interface Campo {
  marcado: boolean
  valor: string
}

/** El valor común si todas lo comparten; `null` si difieren (marcador «(varios)»). */
export function valorComun(valores: readonly string[]): string | null {
  const primero = valores[0]
  return primero !== undefined && valores.every((v) => v === primero) ? primero : null
}

interface Peticion {
  artista?: string
  album?: string | null
}

const peticionDe = (artista: Campo, album: Campo): Peticion => ({
  ...(artista.marcado ? { artista: artista.valor.trim() } : {}),
  ...(album.marcado ? { album: album.valor.trim() === '' ? null : album.valor.trim() } : {})
})

interface Props {
  canciones: ResumenCancionIpc[]
  alCerrar(salida: SalidaAccion): void
}

/** «Editar datos…» de varias (docs/ux/02 · Feature 8): artista y álbum con casilla; el título nunca. */
export function DialogoDatos({ canciones, alCerrar }: Props) {
  const [ids, setIds] = useState(() => canciones.map((c) => c.id))
  const seleccion = canciones.filter((c) => ids.includes(c.id))
  const comunArtista = valorComun(seleccion.map((c) => c.artista))
  const comunAlbum = valorComun(seleccion.map((c) => c.album ?? ''))
  const [artista, setArtista] = useState<Campo>({ marcado: false, valor: comunArtista ?? '' })
  const [album, setAlbum] = useState<Campo>({ marcado: false, valor: comunAlbum ?? '' })
  const [verCanciones, setVerCanciones] = useState(false)
  const escrita = peticionDe(artista, album)
  const claveEscrita = JSON.stringify(escrita)
  // La petición que se previsualiza va 300 ms por detrás de lo escrito.
  const [claveCalculada, setClaveCalculada] = useState(claveEscrita)
  const peticion = useRef<Peticion>(escrita)
  useEffect(() => {
    const t = setTimeout(() => {
      peticion.current = JSON.parse(claveEscrita) as Peticion
      setClaveCalculada(claveEscrita)
    }, RETRASO_IMPACTO_MS)
    return () => clearTimeout(t)
  }, [claveEscrita])
  const pendiente = claveCalculada !== claveEscrita

  const hayCampos = artista.marcado || album.marcado
  const a = useAccionVarias(
    {
      previsualizar: (i) =>
        window.shinobi.biblioteca.editarDatosVarias.previsualizar({ ids: i, ...peticion.current }),
      ejecutar: (i, version) =>
        window.shinobi.biblioteca.editarDatosVarias.ejecutar({
          ids: i,
          ...peticion.current,
          version
        })
    },
    ids,
    claveCalculada
  )
  const porId = new Map(canciones.map((c) => [c.id, c]))
  const ocupado = a.fase === 'ejecutando'
  // Un resultado sin problemas no se pinta: el diálogo se cierra solo con su toast.
  const hecha =
    a.fase === 'hecha' && a.resultado !== null && a.resultado.resultados.some(esProblema)
  const previa = a.previa
  const cambian = previa?.canciones.filter((c) => c.aplica).length ?? 0
  const yaLo = previa?.canciones.filter((c) => c.motivo === 'NADA_QUE_HACER').length ?? 0
  const aspecto = previa?.canciones.filter((c) => c.aplica && c.cambiaTema).length ?? 0
  const campo = artista.marcado && album.marcado ? 'los dos' : artista.marcado ? 'artista' : 'album'

  const resultado = a.resultado
  useEffect(() => {
    if (!resultado || resultado.resultados.some(esProblema)) return
    mostrarToast({ tipo: 'exito', mensaje: ACC.datos.toast(hechas(resultado)) })
    alCerrar({ tipo: 'hecho' })
    // Solo al llegar un resultado nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado])

  const nombre = (id: string): { texto: string; aria: string } => {
    const r = porId.get(id)
    return {
      texto: tituloYArtista(r?.titulo ?? '', r?.artista ?? ''),
      aria: `${r?.titulo ?? ''}, ${r?.artista ?? ''}`
    }
  }

  let filas: FilaCancion[] = []
  if (hecha) {
    filas = a.resultado!.resultados.map((r) => ({
      ...filaDeResultado(r, nombre(r.id), ACC.datos.fallo),
      extra:
        r.resultado === 'error' ? (
          <Boton variante="fantasma" onClick={() => void copiarDetalles(r.motivo ?? '')}>
            {ACC.copiarDetalles}
          </Boton>
        ) : undefined
    }))
  } else if (previa && verCanciones) {
    filas = previa.canciones.map((c) => {
      const n = nombre(c.id)
      const nota = !c.aplica ? motivoDe(c.motivo) : c.cambiaTema ? 'Cambiará de aspecto' : undefined
      return {
        id: c.id,
        texto: n.texto,
        nota,
        atenuada: !c.aplica,
        aviso: c.aplica && c.cambiaTema,
        aria: nota ? `${n.aria}: ${nota}` : n.aria
      }
    })
  }

  const cerrar = (): void => {
    if (a.resultado) {
      alCerrar(
        a.resultado.resultados.some(esProblema)
          ? { tipo: 'faltan', ids: falladas(a.resultado) }
          : { tipo: 'hecho' }
      )
    } else alCerrar({ tipo: 'cancelado' })
  }
  const reintentar = (): void => {
    if (a.resultado) setIds(falladas(a.resultado))
  }
  const reintentables = hecha ? falladas(a.resultado!).length : 0
  const motivoInactivo = !hayCampos
    ? ACC.datos.nada
    : a.fase === 'calculando' || pendiente
      ? ACC.calculando
      : cambian === 0
        ? ACC.datos.impacto(campo, 0, 0)
        : undefined
  const titulo = hecha
    ? `Datos cambiados en ${hechas(a.resultado!)} de ${a.resultado!.resultados.length} canciones.`
    : ACC.datos.titulo(ids.length)

  const fila = (
    clave: 'artista' | 'album',
    estado: Campo,
    poner: (c: Campo) => void,
    comun: string | null
  ) => {
    const etiqueta = clave === 'artista' ? ACC.datos.artista : ACC.datos.album
    return (
      <div className={estilos.campoDatosLote}>
        <label className={estilos.casillaDatosLote}>
          <input
            type="checkbox"
            checked={estado.marcado}
            disabled={ocupado}
            data-foco-inicial={clave === 'artista' ? '' : undefined}
            aria-label={clave === 'artista' ? ACC.datos.cambiarArtista : ACC.datos.cambiarAlbum}
            onChange={(e) =>
              // Desmarcar restaura el valor mostrado.
              poner(
                e.target.checked
                  ? { ...estado, marcado: true }
                  : { marcado: false, valor: comun ?? '' }
              )
            }
          />
        </label>
        <div className={estilos.campoDatosTexto}>
          <CampoTexto
            etiqueta={etiqueta}
            value={estado.valor}
            placeholder={comun === null ? ACC.datos.varios : undefined}
            disabled={ocupado}
            onChange={(e) => poner({ marcado: true, valor: e.target.value })}
            ayuda={
              estado.marcado && estado.valor.trim() === ''
                ? clave === 'artista'
                  ? ACC.datos.vaciarArtista
                  : ACC.datos.vaciarAlbum
                : undefined
            }
          />
        </div>
      </div>
    )
  }

  return (
    <Dialogo
      abierto
      titulo={titulo}
      ancho="35rem"
      enfoqueInicial="[data-foco-inicial]"
      onCancelar={() => !ocupado && cerrar()}
      acciones={
        hecha ? (
          <>
            {reintentables > 0 && (
              <Boton variante="primario" onClick={reintentar}>
                {ACC.reintentarFallidas}
              </Boton>
            )}
            <Boton variante={reintentables > 0 ? 'secundario' : 'primario'} onClick={cerrar}>
              {ACC.cerrar}
            </Boton>
          </>
        ) : (
          <>
            {!ocupado && <Boton onClick={cerrar}>{ACC.cancelar}</Boton>}
            <Boton
              variante="primario"
              cargando={ocupado}
              textoCargando={ACC.datos.cambiando(
                a.progreso?.hechas ?? 0,
                a.progreso?.total ?? cambian
              )}
              noDisponible={motivoInactivo}
              onClick={() => void a.ejecutar()}
            >
              {ACC.datos.boton(cambian)}
            </Boton>
          </>
        )
      }
    >
      <div className={temas.ancho}>
        <p role="status" className={comunes.soloLector}>
          {hecha ? titulo : ''}
        </p>
        {!hecha && (
          <>
            {fila('artista', artista, setArtista, comunArtista)}
            {fila('album', album, setAlbum, comunAlbum)}
            <p className={temas.texto}>{ACC.datos.ayuda}</p>
            {a.obsoleta && <AvisoEnLinea tipo="error">{TEMA.obsoleto}</AvisoEnLinea>}
            {a.fase === 'error' && (
              <AvisoEnLinea
                tipo="error"
                accion={<Boton onClick={() => void a.reintentar()}>{TEMA.reintentar}</Boton>}
              >
                {tituloDeError(a.error ?? '')}
              </AvisoEnLinea>
            )}
            {hayCampos && previa && !pendiente && (
              <p className={temas.texto} data-impacto>
                {ACC.datos.impacto(campo, cambian, yaLo)}
              </p>
            )}
            {hayCampos && previa && !pendiente && aspecto > 0 && (
              <p className={`${temas.texto} ${temas.aviso}`}>{ACC.datos.aspecto(aspecto, campo)}</p>
            )}
            {hayCampos && previa && aspecto > 0 && (
              <Boton
                variante="fantasma"
                className={temas.revelador}
                aria-expanded={verCanciones}
                onClick={() => setVerCanciones((v) => !v)}
              >
                {verCanciones ? ACC.ocultarCanciones : ACC.verCanciones}
              </Boton>
            )}
          </>
        )}
        {(hecha || verCanciones) && (
          <ListaCanciones
            filas={filas}
            calculando={a.fase === 'calculando'}
            etiqueta={ACC.canciones}
          />
        )}
      </div>
    </Dialogo>
  )
}
