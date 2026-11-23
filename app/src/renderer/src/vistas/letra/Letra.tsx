import { useEffect, useRef, useState } from 'react'
import type { Cancion } from '@shared/cancion'
import { contarLineas } from '@shared/letra'
import type { ResumenCancionIpc } from '@shared/ipc'
import type { ElementoLetra, Letra as LetraGuardada } from '@shared/letra'
import { AvisoEnLinea } from '../../componentes/AvisoEnLinea'
import { Boton } from '../../componentes/Boton'
import { useNavegacion } from '../../navegacion/estado'
import { CabeceraCancion } from '../cancion/CabeceraCancion'
import { BusquedaLetra } from './BusquedaLetra'
import { AvisoEleccion } from './AvisoEleccion'
import { LetraElegida } from './LetraElegida'
import { LP } from './preparacion'
import { segundosDe } from './textosComprobacion'
import { useImportarArchivo } from './importar'
import { PegarLetra } from './PegarLetra'
import { existenteDe, useConfirmarSustituir, type LetraExistente } from './sustituir'
import { TEXTO_IMPORTAR } from './textosPegar'
import { TEXTO } from './textos'
import estilos from './letra.module.css'

interface Carga {
  estado: 'cargando' | 'listo' | 'error'
  resumen: ResumenCancionIpc | null
  cancion: Cancion | null
}

/** Paso 3 de una canción: buscar la letra (A), y la letra elegida (C, `LetraElegida`). */
export function Letra({ id }: { id: string }) {
  const { vista, ir } = useNavegacion()
  // «Buscar otra letra» desde el editor: se abre en A, sin caché, aunque ya haya letra.
  const [abrirEnBusqueda] = useState(() => vista.tipo === 'cancion' && vista.buscarOtra === true)
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando', resumen: null, cancion: null })
  // Número de líneas de la letra elegida; `null` = se muestra la búsqueda (A).
  const [elegida, setElegida] = useState<number | null>(null)
  // Vista B (pegar) en lugar de A; el texto vive aquí para conservarse al ir a A y volver.
  const [pegando, setPegando] = useState(false)
  const [textoPegado, setTextoPegado] = useState('')
  // Lo que la canción tiene ahora (para confirmar la sustitución) y renglones ignorados al importar.
  const [existente, setExistente] = useState<LetraExistente>({ lineas: 0, conSincronia: false })
  const [ignoradasImportadas, setIgnoradasImportadas] = useState(0)
  // Letra que muestra C (la clave la remonta al sustituirla) y si A busca sin caché ("Buscar otra letra").
  const [letraC, setLetraC] = useState<{ letra: LetraGuardada; clave: number } | null>(null)
  const [sinCache, setSinCache] = useState(abrirEnBusqueda)
  // «Ver otras candidatas» del aviso de la preparación: A con la lista ya cargada y la letra actual marcada.
  const [letraActualId, setLetraActualId] = useState<number | null>(null)
  const [avisoCerrado, setAvisoCerrado] = useState(false)
  const raiz = useRef<HTMLElement>(null)
  const refEditor = useRef<HTMLButtonElement>(null)
  const enfocarEditor = useRef(false)

  useEffect(() => {
    let activo = true
    const baja = window.shinobi.alCambiarCancion((ev) => {
      if (!activo || ev.id !== id || ev.eliminada) return
      setCarga((c) => (c.estado === 'listo' ? { ...c, resumen: ev.resumen } : c))
    })
    Promise.all([window.shinobi.biblioteca.listar(), window.shinobi.biblioteca.obtener(id)]).then(
      ([lista, cancion]) => {
        if (!activo) return
        const resumen = lista.find((c) => c.id === id) ?? null
        if (!resumen || !cancion) {
          setCarga({ estado: 'error', resumen: null, cancion: null })
          return
        }
        const n = contarLineas(cancion.letra)
        setElegida(n >= 1 && !abrirEnBusqueda ? n : null)
        setLetraC(cancion.letra && n >= 1 ? { letra: cancion.letra, clave: 0 } : null)
        setExistente(existenteDe(cancion.letra?.lineas))
        setCarga({ estado: 'listo', resumen, cancion })
      },
      () => activo && setCarga({ estado: 'error', resumen: null, cancion: null })
    )
    return () => {
      activo = false
      baja()
    }
  }, [id, abrirEnBusqueda])

  useEffect(() => {
    if (elegida !== null && enfocarEditor.current) {
      enfocarEditor.current = false
      refEditor.current?.focus()
    }
  }, [elegida])

  const { confirmar, dialogo } = useConfirmarSustituir(existente)
  const guardada = (
    nuevo: ResumenCancionIpc,
    lineas: ElementoLetra[],
    ignoradas = 0,
    origen: LetraGuardada['origen'] = 'manual',
    correccion?: Pick<LetraGuardada, 'offset_ms' | 'desfase_corregido_ms'>
  ): void => {
    enfocarEditor.current = true
    setLetraC((c) => ({
      letra: { origen, lrclib_id: null, offset_ms: 0, ...correccion, lineas },
      clave: (c?.clave ?? 0) + 1
    }))
    setCarga((c) => ({ ...c, resumen: nuevo }))
    setExistente(existenteDe(lineas))
    setTextoPegado('')
    setPegando(false)
    setIgnoradasImportadas(ignoradas)
    setElegida(lineas.filter((e) => e.tipo === 'linea').length)
  }
  const { importar, errorArchivo } = useImportarArchivo(id, confirmar, (n, l, ig) =>
    guardada(n, l, ig, 'archivo')
  )

  const { resumen, cancion } = carga
  // Preparación desatendida (docs/ux/05 · Feature 5): qué encuentra el usuario al entrar.
  const prep = resumen?.preparacion
  const estadoPrep = resumen?.estadoPreparacion
  const previo = !abrirEnBusqueda
    ? estadoPrep === 'sin_letra'
      ? 'sin_letra'
      : estadoPrep === 'instrumental'
        ? 'instrumental'
        : undefined
    : undefined
  const esperando =
    estadoPrep === 'preparando' && prep?.paso === 'buscando_letra' && !abrirEnBusqueda
  const desfaseMs = cancion?.letra?.desfase_corregido_ms ?? 0
  const textoEleccion =
    prep?.eleccionAutomatica && !prep.revisada && !avisoCerrado
      ? desfaseMs !== 0
        ? LP.elegidaCorregida(segundosDe(desfaseMs), desfaseMs > 0)
        : LP.elegida
      : null
  const cerrarAviso = () => {
    setAvisoCerrado(true)
    void window.shinobi.biblioteca.marcarPreparacionRevisada(id).catch(() => undefined)
  }
  const separada = resumen?.pasos?.separacion.estado === 'completado' && !resumen.danada
  const duracionMs = cancion?.metadatos.duracion_ms ?? 0
  return (
    <section ref={raiz} className={estilos.vista} aria-labelledby="titulo-vista">
      <CabeceraCancion resumen={resumen} actual="letra" />
      <h1 id="titulo-vista" className="t-titulo" tabIndex={-1}>
        {TEXTO.titulo}
      </h1>

      {carga.estado === 'error' && (
        <>
          <AvisoEnLinea tipo="error">{TEXTO.errorAbrir}</AvisoEnLinea>
          <Boton data-foco-inicial onClick={() => ir({ tipo: 'biblioteca' })}>
            ‹ Biblioteca
          </Boton>
        </>
      )}

      {carga.estado === 'listo' && cancion && elegida === null && pegando && (
        <PegarLetra
          cancionId={id}
          texto={textoPegado}
          onTexto={setTextoPegado}
          confirmar={confirmar}
          onVolver={() => setPegando(false)}
          onImportar={() => void importar()}
          onUsada={(n, l) => guardada(n, l, 0, 'manual')}
        />
      )}

      {carga.estado === 'listo' && cancion && elegida === null && !pegando && (
        <BusquedaLetra
          cancionId={id}
          tituloInicial={cancion.metadatos.titulo}
          artistaInicial={cancion.metadatos.artista}
          confirmar={confirmar}
          onPegar={() => setPegando(true)}
          onImportar={() => void importar()}
          sinCacheInicial={sinCache}
          separada={separada}
          duracionMs={duracionMs}
          preparacion={{
            previo,
            esperando,
            elige: estadoPrep === 'elige_letra',
            noElige: prep?.busqueda?.noElige ?? null,
            letraActualId:
              letraActualId ??
              (abrirEnBusqueda && prep?.eleccionAutomatica
                ? (cancion.letra?.lrclib_id ?? null)
                : null)
          }}
          onUsada={(nuevo, _n, lineas, correccion) => {
            guardada(nuevo, lineas, 0, 'lrclib', correccion)
            // «Elige la letra»: al elegir, la preparación sigue sola con los fines (spec 05 · Feature 5).
            if (prep && estadoPrep === 'elige_letra') {
              void window.shinobi.preparacion?.preparar([id]).catch(() => undefined)
            }
          }}
        />
      )}

      {carga.estado === 'listo' && elegida !== null && textoEleccion && (
        <AvisoEleccion
          texto={textoEleccion}
          alCerrar={cerrarAviso}
          alVerOtras={() => {
            setLetraActualId(letraC?.letra.lrclib_id ?? null)
            setSinCache(false)
            setIgnoradasImportadas(0)
            setElegida(null)
          }}
        />
      )}
      {carga.estado === 'listo' && elegida !== null && estadoPrep === 'preparando' && (
        <p role="status">{LP.continuando}</p>
      )}
      {carga.estado === 'listo' && elegida !== null && letraC && (
        <LetraElegida
          key={letraC.clave}
          cancionId={id}
          letraInicial={letraC.letra}
          estado={resumen?.estado ?? 'borrador'}
          separada={separada}
          duracionMs={duracionMs}
          fuenteLista={resumen?.pasos?.fuente.estado === 'completado'}
          esperandoFuente={resumen?.pasos?.fuente.estado === 'en_curso'}
          ignoradas={ignoradasImportadas}
          onCerrarIgnoradas={() => setIgnoradasImportadas(0)}
          onResumen={(nuevo) => setCarga((c) => ({ ...c, resumen: nuevo }))}
          onOtra={() => {
            setSinCache(true)
            setIgnoradasImportadas(0)
            setElegida(null)
          }}
          onImportar={() => void importar()}
          onIrAlEditor={() => ir({ tipo: 'cancion', id, paso: 'editor' })}
          refEditor={refEditor}
        />
      )}
      {carga.estado === 'listo' && errorArchivo && (
        <AvisoEnLinea tipo="error">{TEXTO_IMPORTAR.errorArchivo}</AvisoEnLinea>
      )}
      {dialogo}
    </section>
  )
}
