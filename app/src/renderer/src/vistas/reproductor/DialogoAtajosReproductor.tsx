import { Boton } from '../../componentes/Boton'
import { Dialogo } from '../../componentes/Dialogo'
import { R } from './textos'
import estilos from './reproductor.module.css'

const ATAJOS = [
  ['Espacio / K', 'Reproducir / pausa'],
  ['← / →', 'Retroceder / avanzar 5 s'],
  ['J / L', 'Retroceder / avanzar 10 s'],
  ['↑ / ↓', 'Volumen +10 % / −10 %'],
  ['M', 'Silenciar / activar sonido'],
  ['V', 'Silenciar / reactivar la voz guía', 'voz'],
  ['Mayús + ↑ / ↓', 'Voz guía +10 % / −10 %', 'voz'],
  ['Inicio / 0', 'Volver al principio'],
  ['F', 'Pantalla completa / ventana'],
  ['Esc', 'Cerrar el diálogo o salir del reproductor'],
  [', / .', 'Desplazamiento de toda la letra −/+ 100 ms', 'editor'],
  ['F1 / ?', R.atajos.titulo]
] as const

export function DialogoAtajosReproductor({
  abierto,
  vozDisponible,
  puedeDesplazar,
  alCerrar
}: {
  abierto: boolean
  vozDisponible: boolean
  puedeDesplazar: boolean
  alCerrar(): void
}) {
  return (
    <Dialogo
      abierto={abierto}
      titulo={R.atajos.titulo}
      onCancelar={alCerrar}
      acciones={<Boton onClick={alCerrar}>Cerrar</Boton>}
      ancho="38rem"
    >
      <table className={estilos.tablaAtajos}>
        <thead>
          <tr>
            <th scope="col">Tecla</th>
            <th scope="col">Acción</th>
          </tr>
        </thead>
        <tbody>
          {ATAJOS.filter(([, , modo]) =>
            modo === 'voz' ? vozDisponible : modo !== 'editor' || puedeDesplazar
          ).map(([tecla, accion]) => (
            <tr key={tecla}>
              <th scope="row">{tecla}</th>
              <td>{accion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialogo>
  )
}
