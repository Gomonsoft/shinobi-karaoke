import { Dialogo } from '../../componentes/Dialogo'
import { Boton } from '../../componentes/Boton'
import { E } from './textos'
import estilos from './editor.module.css'

const ATAJOS = [
  ['Espacio', 'Reproducir / pausa'],
  ['Inicio', 'Ir al principio'],
  ['← / → en la barra de tiempo', '−/+ 5 s'],
  ['F', E.botonProbar],
  ['Intro', 'Marcar inicio. Mantener 300 ms para marcar también el fin.'],
  ['Retroceso', 'Deshacer la última marca o borrar tiempos de la línea.'],
  ['Supr', E.borrarTiempos],
  ['Esc', 'Cancelar la cuenta atrás, terminar el modo, cerrar la capa o volver a la Biblioteca.'],
  ['↑ / ↓', 'Línea anterior / siguiente'],
  ['Alt + ← / →', 'Inicio −/+ 10 ms (con Mayús, 100 ms)'],
  ['Ctrl/Cmd + ← / →', 'Fin −/+ 10 ms (con Mayús, 100 ms)'],
  ['I / O', 'Fijar inicio / fin en la posición actual'],
  ['L', E.escucharLinea],
  ['Mayús + L', 'Escuchar la línea seleccionada (de 0,5 s antes a 0,5 s después)'],
  ['P', 'Abrir el editor preciso de la línea seleccionada'],
  ['F6 / Mayús + F6', 'Pasar el foco entre el editor preciso y el resto del editor'],
  ['1 / 2 / 3', 'Escuchar Original / Voz / Instrumental'],
  ['Ctrl/Cmd + Z', 'Deshacer'],
  ['Ctrl/Cmd + Mayús + Z (Ctrl + Y)', 'Rehacer'],
  ['Ctrl/Cmd + E', 'Exportar video'],
  ['F1 / ?', E.atajos]
] as const

const ATAJOS_PRECISO = [
  ['Espacio', 'Reproducir / pausar el bucle de la línea'],
  ['Mayús + Espacio', 'Escuchar la palabra seleccionada'],
  ['Intro', 'Marcar el inicio de la palabra; mantener, marcar también su fin'],
  ['Retroceso', 'Deshacer la última marca de la pasada'],
  ['← / → (en la tira)', 'Palabra anterior / siguiente'],
  ['Alt + ← / →', 'Inicio de la palabra −/+ 10 ms (con Mayús, 100 ms)'],
  ['Ctrl/Cmd + ← / →', 'Fin de la palabra −/+ 10 ms (con Mayús, 100 ms)'],
  ['I / O', 'Fijar inicio / fin de la palabra en el cabezal'],
  ['↑ / ↓', 'Línea anterior / siguiente (aplicando)'],
  ['1 / 2 / 3', 'Escuchar Original / Voz / Instrumental'],
  ['Ctrl/Cmd + Z', 'Deshacer en el borrador'],
  ['Ctrl/Cmd + Intro', 'Aplicar'],
  ['Esc', 'Cancelar el arrastre o el campo; si no, cerrar aplicando'],
  ['F6 / Mayús + F6', 'Pasar el foco al editor']
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
      <h3>{E.preciso.atajosTitulo}</h3>
      <table className={estilos.atajos}>
        <tbody>
          {ATAJOS_PRECISO.map(([tecla, accion]) => (
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
