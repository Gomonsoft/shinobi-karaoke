import { StringDecoder } from 'node:string_decoder'

/**
 * Trocea un flujo de bytes en líneas de texto UTF-8. Tolera líneas partidas
 * entre *chunks*, varias líneas por *chunk*, caracteres multibyte partidos y
 * finales de línea `\r\n`. Las líneas vacías se descartan.
 */
export class LectorLineas {
  private readonly decoder = new StringDecoder('utf8')
  private resto = ''

  empujar(chunk: Buffer | string): string[] {
    this.resto += typeof chunk === 'string' ? chunk : this.decoder.write(chunk)
    const partes = this.resto.split('\n')
    this.resto = partes.pop() ?? ''
    return partes.map(limpiar).filter((l) => l.length > 0)
  }

  /** Devuelve la última línea sin terminar (si la hay). */
  terminar(): string[] {
    const ultima = limpiar(this.resto + this.decoder.end())
    this.resto = ''
    return ultima.length > 0 ? [ultima] : []
  }
}

function limpiar(linea: string): string {
  return linea.endsWith('\r') ? linea.slice(0, -1) : linea
}
