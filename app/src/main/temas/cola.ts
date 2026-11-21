/**
 * Cola única de apariencia (ADR 0016 §5): ejecuta una a una, en orden de llegada, las mutaciones
 * que pueden cambiar una resolución. Un fallo rechaza solo la promesa de esa tarea; la cola sigue.
 */
export class ColaApariencia {
  private cadena: Promise<unknown> = Promise.resolve()

  enCola<T>(tarea: () => Promise<T> | T): Promise<T> {
    const resultado = this.cadena.then(tarea)
    this.cadena = resultado.then(
      () => undefined,
      () => undefined
    )
    return resultado
  }

  /** Se resuelve cuando termina todo lo encolado hasta ahora. */
  vaciada(): Promise<void> {
    return this.cadena.then(() => undefined)
  }
}
