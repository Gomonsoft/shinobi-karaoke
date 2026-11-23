import { useCallback, useReducer } from 'react'
import { MAX_LOTE, type InfoYoutubeIpc } from '@shared/ipc'
import { completarConInfo, sePuedeMarcar, type CampoFila, type FilaTabla } from './modelo'

interface Estado {
  filas: FilaTabla[]
  /** Instantáneas para Ctrl/Cmd + Z (la última edición de la tabla). */
  historial: FilaTabla[][]
  /** El usuario cambió algún campo o alguna casilla: salir pide confirmación. */
  editado: boolean
  /** Fila en la que se intentó marcar la 51.ª (`add.lote.limite.tope`). */
  tope: string | null
}

type Accion =
  | { tipo: 'editar'; clave: string; campo: CampoFila; valor: string; sesionNueva: boolean }
  | { tipo: 'marcar'; clave: string; marcada: boolean }
  | { tipo: 'marcarTodas'; marcada: boolean }
  | { tipo: 'aplicarATodas'; campo: Exclude<CampoFila, 'titulo'>; valor: string }
  | { tipo: 'completar'; clave: string; info: InfoYoutubeIpc | null }
  | { tipo: 'deshacer' }

const MAX_HISTORIAL = 50
const contarMarcadas = (filas: FilaTabla[]): number =>
  filas.filter((f) => f.marcada && f.problema === null).length

function conInstantanea(e: Estado): FilaTabla[][] {
  return [...e.historial, e.filas].slice(-MAX_HISTORIAL)
}

function reducir(e: Estado, a: Accion): Estado {
  switch (a.tipo) {
    case 'editar': {
      const filas = e.filas.map((f) =>
        f.clave !== a.clave || !sePuedeMarcar(f)
          ? f
          : {
              ...f,
              [a.campo]: a.valor,
              tocados: f.tocados.includes(a.campo) ? f.tocados : [...f.tocados, a.campo]
            }
      )
      return {
        ...e,
        filas,
        editado: true,
        tope: null,
        historial: a.sesionNueva ? conInstantanea(e) : e.historial
      }
    }
    case 'marcar': {
      const fila = e.filas.find((f) => f.clave === a.clave)
      if (!fila || !sePuedeMarcar(fila) || fila.marcada === a.marcada) return e
      if (a.marcada && contarMarcadas(e.filas) >= MAX_LOTE) return { ...e, tope: a.clave }
      return {
        ...e,
        filas: e.filas.map((f) => (f.clave === a.clave ? { ...f, marcada: a.marcada } : f)),
        historial: conInstantanea(e),
        editado: true,
        tope: null
      }
    }
    case 'marcarTodas': {
      let marcadas = a.marcada ? contarMarcadas(e.filas) : 0
      const filas = e.filas.map((f) => {
        if (!sePuedeMarcar(f)) return f
        if (!a.marcada) return { ...f, marcada: false }
        if (f.marcada) return f
        if (marcadas >= MAX_LOTE) return f
        marcadas++
        return { ...f, marcada: true }
      })
      return { ...e, filas, historial: conInstantanea(e), editado: true, tope: null }
    }
    case 'aplicarATodas': {
      const filas = e.filas.map((f) =>
        f.marcada && sePuedeMarcar(f)
          ? {
              ...f,
              [a.campo]: a.valor,
              tocados: f.tocados.includes(a.campo) ? f.tocados : [...f.tocados, a.campo]
            }
          : f
      )
      return { ...e, filas, historial: conInstantanea(e), editado: true, tope: null }
    }
    case 'completar': {
      const info = a.info
      const filas = e.filas.map((f) =>
        f.clave !== a.clave ? f : info ? completarConInfo(f, info) : { ...f, pendienteDatos: false }
      )
      // Completar no es una edición del usuario: ni historial ni «editado».
      return { ...e, filas }
    }
    case 'deshacer': {
      const anterior = e.historial.at(-1)
      if (!anterior) return e
      return { ...e, filas: anterior, historial: e.historial.slice(0, -1), tope: null }
    }
  }
}

/** Estado de la tabla de revisión: edición, casillas con tope de 50, «para todas», datos de YouTube y deshacer. */
export function useTablaLote(inicial: FilaTabla[]) {
  const [estado, despachar] = useReducer(reducir, {
    filas: inicial,
    historial: [],
    editado: false,
    tope: null
  })
  const editar = useCallback(
    (clave: string, campo: CampoFila, valor: string, sesionNueva: boolean) =>
      despachar({ tipo: 'editar', clave, campo, valor, sesionNueva }),
    []
  )
  const marcar = useCallback(
    (clave: string, marcada: boolean) => despachar({ tipo: 'marcar', clave, marcada }),
    []
  )
  const marcarTodas = useCallback(
    (marcada: boolean) => despachar({ tipo: 'marcarTodas', marcada }),
    []
  )
  const aplicarATodas = useCallback(
    (campo: 'artista' | 'album', valor: string) =>
      despachar({ tipo: 'aplicarATodas', campo, valor }),
    []
  )
  const completar = useCallback(
    (clave: string, info: InfoYoutubeIpc | null) => despachar({ tipo: 'completar', clave, info }),
    []
  )
  const deshacer = useCallback(() => despachar({ tipo: 'deshacer' }), [])
  return {
    filas: estado.filas,
    editado: estado.editado,
    tope: estado.tope,
    puedeDeshacer: estado.historial.length > 0,
    editar,
    marcar,
    marcarTodas,
    aplicarATodas,
    completar,
    deshacer
  }
}
