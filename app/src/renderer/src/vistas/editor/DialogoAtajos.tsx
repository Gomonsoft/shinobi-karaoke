import { Dialogo } from '../../componentes/Dialogo'
import { Boton } from '../../componentes/Boton'
import { E } from './textos'
import estilos from './editor.module.css'

const ATAJOS = [
  ['Espacio', 'Reproducir / pausa'],
  ['Inicio', 'Ir al principio'],
  ['← / → en la barra de tiempo', '−/+ 5 s'],
  ['S', E.botonSync],
  ['Intro', 'Marcar inicio. Mantener 300 ms para marcar también el fin.'],
  ['Retroceso', 'Deshacer la última marca o borrar tiempos de la línea.'],
  ['Supr', E.borrarTiempos],
  ['Esc', 'Cancelar la cuenta atrás, terminar el modo, cerrar la capa o volver a la Biblioteca.'],
  ['↑ / ↓', 'Línea anterior / siguiente'],
  ['Alt + ← / →', 'Inicio −/+ 10 ms (con Mayús, 100 ms)'],
  ['Ctrl/Cmd + ← / →', 'Fin −/+ 10 ms (con Mayús, 100 ms)'],
  ['I / O', 'Fijar inicio / fin en la posición actual'],
  ['L', E.escucharLinea],
  [', / .', 'Desplazamiento de toda la letra −/+ 100 ms'],
  ['1 / 2 / 3', 'Escuchar Original / Voz / Instrumental'],
  ['Ctrl/Cmd + Z', 'Deshacer'],
  ['Ctrl/Cmd + Mayús + Z (Ctrl + Y)', 'Rehacer'],
  ['F1 / ?', E.atajos]
] as const

export function DialogoAtajos({ abierto, cerrar }: { abierto: boolean; cerrar: () => void }) {
  return (
    <Dialogo
      abierto={abierto}
      titulo={E.atajos}
      onCancelar={cerrar}
      acciones={<Boton onClick={cerrar}>Cerrar</Boton>}
      ancho="42rem"
    >
      <table className={estilos.atajos}>
        <thead>
          <tr>
            <th scope="col">Tecla</th>
            <th scope="col">Acción</th>
          </tr>
        </thead>
        <tbody>
          {ATAJOS.map(([tecla, accion]) => (
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
