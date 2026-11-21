import estilos from './exportacion.module.css'

/** Atribución del programa en todos los fotogramas (spec 10): literal, fija y sin traducir. */
export function MarcaDeAgua() {
  return (
    <div className={estilos.marca} data-marca-agua="">
      Shinobi Karaoke
    </div>
  )
}
