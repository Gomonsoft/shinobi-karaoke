import { lazy, Suspense, useEffect, useCallback, useMemo, useState } from 'react'
import { ContenedorToasts } from './componentes/Toasts'
import { ProveedorExportacion } from './exportacion/ProveedorExportacion'
import { DialogoCierre } from './navegacion/DialogoCierre'
import { Marco } from './navegacion/Marco'
import {
  claveVista,
  esVistaDeEdicion,
  NavegacionContexto,
  vistaInicial,
  type Navegacion,
  type Vista
} from './navegacion/estado'
import { ProvocadorDeError } from './soporte/ProvocadorDeError'
import { fijarContextoError } from './soporte/erroresInterfaz'
import { LimiteErrores } from './navegacion/LimiteErrores'
import { crearNavegacionGuardada } from './navegacion/salida'
import { CapaReproductor, ProveedorReproductor } from './navegacion/reproductor'
import { useArrastrarArchivo } from './navegacion/useArrastrarArchivo'
import { useAtajosGlobales } from './navegacion/useAtajosGlobales'
import { useAvisosPreparacion } from './navegacion/useAvisosPreparacion'
import { useAvisosTrabajos } from './navegacion/useAvisosTrabajos'
import { ProveedorSesion, useSesion } from './sesion/ProveedorSesion'
import { TrabajosContexto, useEstadoTrabajos } from './trabajos/useTrabajos'
import { Biblioteca } from './vistas/biblioteca/Biblioteca'
import { ControladorPaquetes } from './vistas/biblioteca/paquete/ControladorPaquetes'
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
          key={vista.iniciales?.cancionId ?? vista.archivo ?? vista.archivos?.join('|') ?? 'nueva'}
          archivo={vista.archivo}
          archivos={vista.archivos}
          iniciales={vista.iniciales}
          restaurar={vista.restaurar}
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
  // Defensa (spec 06): con sesión no se navega a Letra ni al Editor, aunque la vista lo intente.
  const { edicionBloqueada, abrirBloqueo } = useSesion()
  const navegar = useCallback<Navegacion['ir']>(
    (destino, alNavegar) => {
      if (edicionBloqueada && esVistaDeEdicion(destino)) abrirBloqueo()
      else salida.ir(destino, alNavegar)
    },
    [salida, edicionBloqueada, abrirBloqueo]
  )
  const navegacion = useMemo<Navegacion>(
    () => ({ vista, ...salida, ir: navegar }),
    [vista, salida, navegar]
  )
  // Contexto barato para app.log si algo falla (I-1): la vista y, en una canción, su id.
  useEffect(() => {
    fijarContextoError(
      vista.tipo === 'cancion'
        ? { vista: `cancion/${vista.paso}`, cancionId: vista.id }
        : { vista: vista.tipo }
    )
  }, [vista])
  useAtajosGlobales(vista, navegar)
  useArrastrarArchivo(vista, navegar)
  useAvisosTrabajos(vista, navegar)
  useAvisosPreparacion(vista, navegar)

  return (
    <NavegacionContexto.Provider value={navegacion}>
      <TrabajosContexto.Provider value={trabajos}>
        <BibliotecaContexto.Provider value={biblioteca}>
          <ProveedorExportacion>
            <ProveedorReproductor>
              <Marco bibliotecaVacia={vacia}>
                <LimiteErrores
                  variante="vista"
                  clave={claveVista(vista)}
                  vista={vista.tipo === 'cancion' ? `cancion/${vista.paso}` : vista.tipo}
                  cancionId={vista.tipo === 'cancion' ? vista.id : undefined}
                  esEditor={vista.tipo === 'cancion' && vista.paso === 'editor'}
                  alBiblioteca={
                    vista.tipo === 'biblioteca' ? undefined : () => navegar({ tipo: 'biblioteca' })
                  }
                >
                  <ProvocadorDeError />
                  <Contenido vista={vista} />
                </LimiteErrores>
              </Marco>
              <CapaReproductor />
            </ProveedorReproductor>
            <DialogoCierre vista={vista} />
            <ControladorPaquetes />
          </ProveedorExportacion>
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
      {inicial && (
        <ProveedorSesion>
          <Aplicacion inicial={inicial} />
        </ProveedorSesion>
      )}
      <ContenedorToasts />
    </>
  )
}
