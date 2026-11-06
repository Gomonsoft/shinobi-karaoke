import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ContenedorToasts } from './componentes/Toasts'
import { DialogoCierre } from './navegacion/DialogoCierre'
import { Marco } from './navegacion/Marco'
import { NavegacionContexto, vistaInicial, type Navegacion, type Vista } from './navegacion/estado'
import { crearNavegacionGuardada } from './navegacion/salida'
import { CapaReproductor, ProveedorReproductor } from './navegacion/reproductor'
import { useArrastrarArchivo } from './navegacion/useArrastrarArchivo'
import { useAtajosGlobales } from './navegacion/useAtajosGlobales'
import { useAvisosTrabajos } from './navegacion/useAvisosTrabajos'
import { TrabajosContexto, useEstadoTrabajos } from './trabajos/useTrabajos'
import { Biblioteca } from './vistas/biblioteca/Biblioteca'
import { BibliotecaContexto, useBiblioteca } from './vistas/biblioteca/useBiblioteca'
import { Ajustes } from './vistas/ajustes/Ajustes'
import { AnadirCancion } from './vistas/anadir/AnadirCancion'
import { ResumenFuente } from './vistas/anadir/ResumenFuente'
import { Progreso } from './vistas/progreso/Progreso'
import { Letra } from './vistas/letra/Letra'
import { Editor } from './vistas/editor/Editor'
import { PrimerArranque } from './vistas/primer-arranque/PrimerArranque'

// El Muestrario solo existe en `npm run dev`: en producción el bloque se elimina del bundle.
const Muestrario = import.meta.env.DEV
  ? lazy(() => import('./vistas/Muestrario').then((m) => ({ default: m.Muestrario })))
  : null

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
      if (vista.paso === 'letra') return <Letra key={vista.id} id={vista.id} />
      return <Editor key={vista.id} id={vista.id} />
    case 'ajustes':
      return <Ajustes />
  }
}

function Aplicacion({ inicial }: { inicial: Vista }) {
  const [vista, ir] = useState<Vista>(inicial)
  // Una sola lectura de `listar()` para la barra superior, el panel de actividad y la Biblioteca.
  const biblioteca = useBiblioteca()
  // Conservador: mientras carga o ante un error se mantiene el botón de la barra.
  const vacia = biblioteca.estado === 'listo' && biblioteca.canciones.length === 0
  const trabajos = useEstadoTrabajos()
  const [salida] = useState(() => crearNavegacionGuardada(ir))
  const navegar = salida.ir
  const navegacion = useMemo<Navegacion>(() => ({ vista, ...salida }), [vista, salida])
  useAtajosGlobales(vista, navegar)
  useArrastrarArchivo(vista, navegar)
  useAvisosTrabajos(vista, navegar)

  return (
    <NavegacionContexto.Provider value={navegacion}>
      <TrabajosContexto.Provider value={trabajos}>
        <BibliotecaContexto.Provider value={biblioteca}>
          <ProveedorReproductor>
            <Marco bibliotecaVacia={vacia}>
              <Contenido vista={vista} />
            </Marco>
            <CapaReproductor />
          </ProveedorReproductor>
          <DialogoCierre vista={vista} />
        </BibliotecaContexto.Provider>
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
