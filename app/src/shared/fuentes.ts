/**
 * Registro único de las fuentes de karaoke incluidas (ADR 0006, respuesta a
 * docs/preguntas/0004). Es la fuente de verdad de: el esquema de estilo (0006),
 * las `@font-face` del renderer y el test de archivos/licencias.
 *
 * Los archivos viven en `app/resources/fonts/` y se incluyen SIN modificar
 * (solo reempaquetados a WOFF2), todos con licencia SIL OFL 1.1.
 */
export type EscrituraFuente = 'latina' | 'cirilica' | 'griega' | 'vietnamita'

export interface FuenteIncluida {
  /** Nombre de la familia CSS; es el valor de `estilo.letra.fuente.familia`. */
  readonly familia: string
  /** Peso con el que se usa la familia para la letra. */
  readonly peso: number
  /** Escrituras cubiertas (además de latín extendido con á é í ó ú ü ñ ¿ ¡). */
  readonly escrituras: readonly EscrituraFuente[]
  /** Ruta relativa a `app/resources/fonts/`; la licencia es `OFL.txt` en su carpeta. */
  readonly archivo: string
  /** Solo en fuentes variables: rango de pesos que contiene el archivo. */
  readonly rangoPesos?: readonly [number, number]
}

export const FUENTES_REGISTRO: readonly FuenteIncluida[] = [
  {
    familia: 'Atkinson Hyperlegible Next',
    peso: 700,
    escrituras: ['latina'],
    archivo: 'atkinson-hyperlegible-next/AtkinsonHyperlegibleNext-Bold.woff2'
  },
  {
    familia: 'Nunito',
    peso: 800,
    escrituras: ['latina', 'cirilica', 'vietnamita'],
    archivo: 'nunito/Nunito-Variable.woff2',
    rangoPesos: [200, 1000]
  },
  {
    familia: 'Montserrat',
    peso: 700,
    escrituras: ['latina', 'cirilica', 'vietnamita'],
    archivo: 'montserrat/Montserrat-Bold.woff2'
  },
  {
    familia: 'Oswald',
    peso: 600,
    escrituras: ['latina', 'cirilica', 'vietnamita'],
    archivo: 'oswald/Oswald-SemiBold.woff2'
  },
  {
    familia: 'Lora',
    peso: 700,
    escrituras: ['latina', 'cirilica', 'vietnamita'],
    archivo: 'lora/Lora-Bold.woff2'
  },
  {
    familia: 'Playfair Display',
    peso: 800,
    escrituras: ['latina', 'cirilica', 'vietnamita'],
    archivo: 'playfair-display/PlayfairDisplay-Variable.woff2',
    rangoPesos: [400, 900]
  },
  {
    familia: 'Bangers',
    peso: 400,
    escrituras: ['latina', 'vietnamita'],
    archivo: 'bangers/Bangers-Regular.woff2'
  },
  {
    familia: 'Noto Sans',
    peso: 700,
    escrituras: ['latina', 'griega', 'cirilica', 'vietnamita'],
    archivo: 'noto-sans/NotoSans-Bold.woff2'
  }
]

/** Familia predeterminada (la primera del registro). */
export const FUENTE_PREDETERMINADA = 'Atkinson Hyperlegible Next'

export const FUENTES_INCLUIDAS: readonly string[] = FUENTES_REGISTRO.map((f) => f.familia)

export function buscarFuente(familia: string): FuenteIncluida | undefined {
  return FUENTES_REGISTRO.find((f) => f.familia === familia)
}

/** Familia válida o, si es desconocida, la predeterminada. */
export function familiaValida(familia: string): string {
  return buscarFuente(familia) ? familia : FUENTE_PREDETERMINADA
}

const comillas = (s: string) => `'${s.replace(/'/g, "\\'")}'`

/**
 * Genera las reglas `@font-face` de todo el registro. `resolverUrl` convierte
 * `archivo` en la URL final (en el renderer, la URL empaquetada por Vite: sin red).
 */
export function generarFontFace(resolverUrl: (archivo: string) => string): string {
  return FUENTES_REGISTRO.map((f) => {
    const peso = f.rangoPesos ? `${f.rangoPesos[0]} ${f.rangoPesos[1]}` : String(f.peso)
    return (
      `@font-face{font-family:${comillas(f.familia)};font-weight:${peso};font-style:normal;` +
      `font-display:block;src:url(${comillas(resolverUrl(f.archivo))}) format('woff2');}`
    )
  }).join('\n')
}
