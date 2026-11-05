import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { ContenedorToasts } from './componentes/Toasts'
import { Marco } from './navegacion/Marco'
import {
  NavegacionContexto,
  TITULOS_VISTA,
  vistaInicial,
  type Navegacion,
  type Vista
} from './navegacion/estado'
import { useArrastrarArchivo } from './navegacion/useArrastrarArchivo'
import { useAtajosGlobales } from './navegacion/useAtajosGlobales'
import { TrabajosContexto, useEstadoTrabajos } from './trabajos/useTrabajos'
import { Biblioteca } from './vistas/biblioteca/Biblioteca'
import { Marcador } from './vistas/Marcadores'
import { AnadirCancion } from './vistas/anadir/AnadirCancion'
import { ResumenFuente } from './vistas/anadir/ResumenFuente'
import { Progreso } from './vistas/progreso/Progreso'
import { PrimerArranque } from './vistas/primer-arranque/PrimerArranque'

// El Muestrario solo existe en `npm run dev`: en producción el bloque se elimina del bundle.
const Muestrario = import.meta.env.DEV
  ? lazy(() => import('./vistas/Muestrario').then((m) => ({ default: m.Muestrario })))
  : null

/** `true`/`false` cuando se sabe; `null` mientras carga. */
function useBibliotecaVacia(): boolean | null {
  const [vacia, setVacia] = useState<boolean | null>(null)
  useEffect(() => {
    let activo = true
    const actualizar = () => {
      window.shinobi.biblioteca.listar().then(
        (lista) => activo && setVacia(lista.length === 0),
        // Conservador: ante un error se mantiene el botón de la barra.
        () => activo && setVacia(false)
      )
    }
    actualizar()
    const baja = window.shinobi.alCambiarCancion(actualizar)
    return () => {
      activo = false
      baja()
    }
  }, [])
  return vacia
}

function Contenido({ vista }: { vista: Vista }) {
  switch (vista.tipo) {
    case 'biblioteca':
      return <Biblioteca />
    case 'primer-arranque':
      return <PrimerArranque />
    case 'anadir':
      return (
        <AnadirCancion
          key={vista.iniciales?.cancionId ?? vista.archivo ?? 'nueva'}
          archivo={vista.archivo}
          iniciales={vista.iniciales}
        />
      )
    case 'cancion':
      if (vista.paso === 'progreso') return <Progreso key={vista.id} id={vista.id} />
      if (vista.paso === 'fuente') return <ResumenFuente key={vista.id} id={vista.id} />
      return <Marcador titulo={`${TITULOS_VISTA.cancion}: ${vista.paso}`} />
    default:
      return <Marcador titulo={TITULOS_VISTA[vista.tipo]} />
  }
}

function Aplicacion({ inicial }: { inicial: Vista }) {
  const [vista, ir] = useState<Vista>(inicial)
  const vacia = useBibliotecaVacia()
  const trabajos = useEstadoTrabajos()
  const navegar = useCallback((v: Vista) => ir(v), [])
  const navegacion = useMemo<Navegacion>(() => ({ vista, ir: navegar }), [vista, navegar])
  useAtajosGlobales(vista, navegar)
  useArrastrarArchivo(vista, navegar)

  return (
    <NavegacionContexto.Provider value={navegacion}>
      <TrabajosContexto.Provider value={trabajos}>
        <Marco bibliotecaVacia={vacia === true}>
          <Contenido vista={vista} />
        </Marco>
      </TrabajosContexto.Provider>
    </NavegacionContexto.Provider>
  )
}

export function App() {
  const [inicial, setInicial] = useState<Vista | null>(null)

  useEffect(() => {
    if (Muestrario && window.location.hash === '#/muestrario') return
    let activo = true
    window.shinobi.config.obtener().then(
      (c) => activo && setInicial(vistaInicial(c.instalacion.estado)),
      // Sin configuración legible se parte del primer arranque (lo más conservador).
      () => activo && setInicial({ tipo: 'primer-arranque' })
    )
    return () => {
      activo = false
    }
  }, [])

  if (Muestrario && window.location.hash === '#/muestrario') {
    return (
      <>
        <a className="saltar-al-contenido" href="#contenido">
          Saltar al contenido
        </a>
        <Suspense fallback={null}>
          <Muestrario />
        </Suspense>
        <ContenedorToasts />
      </>
    )
  }

  return (
    <>
      {inicial && <Aplicacion inicial={inicial} />}
      <ContenedorToasts />
    </>
  )
}
