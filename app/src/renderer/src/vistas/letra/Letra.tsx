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
import { LetraElegida } from './LetraElegida'
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
  const { ir } = useNavegacion()
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
  const [sinCache, setSinCache] = useState(false)
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
        setElegida(n >= 1 ? n : null)
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
  }, [id])

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
    origen: LetraGuardada['origen'] = 'manual'
  ): void => {
    enfocarEditor.current = true
    setLetraC((c) => ({
      letra: { origen, lrclib_id: null, offset_ms: 0, lineas },
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
          onUsada={(nuevo, _n, lineas) => guardada(nuevo, lineas, 0, 'lrclib')}
        />
      )}

      {carga.estado === 'listo' && elegida !== null && letraC && (
        <LetraElegida
          key={letraC.clave}
          cancionId={id}
          letraInicial={letraC.letra}
          estado={resumen?.estado ?? 'borrador'}
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
