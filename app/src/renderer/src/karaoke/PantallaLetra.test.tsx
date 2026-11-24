import { readFileSync } from 'node:fs'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { letra, linea } from '@shared/__fixtures__'
import { estiloPredeterminado, normalizarEstilo } from '@shared/estilo'
import { fondoCssEn } from './estiloCss'
import { PantallaLetra } from './PantallaLetra'
import estilos from './pantallaLetra.module.css'

const l = letra([linea('a', 'Nubes de sal', 2000), linea('b', 'Cantan al viento', 6000)])
const props = {
  letra: l,
  estilo: estiloPredeterminado(),
  titulo: 'Inventada',
  artista: 'Shinobi',
  duracionMs: 30_000
}

let cajas: DOMRect[]

beforeEach(() => {
  cajas = [new DOMRect(0, 0, 120, 20), new DOMRect(30, 24, 60, 20)]
  vi.spyOn(document, 'createRange').mockImplementation(
    () =>
      ({
        selectNodeContents: vi.fn(),
        getClientRects: () => cajas
      }) as unknown as Range
  )
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, 0, 120, 44)
  )
  const obtenerEstilo = window.getComputedStyle
  vi.stubGlobal('getComputedStyle', (nodo: Element) => {
    const estilo = obtenerEstilo(nodo)
    estilo.width = '120px'
    return estilo
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function recorte(nodo: ParentNode | null): string | undefined {
  return nodo?.querySelector<HTMLElement>(`.${estilos.resaltado}`)?.style.clipPath
}

it('muestra la línea seleccionada a la mitad y aplica el estilo', () => {
  const { container } = render(<PantallaLetra {...props} reproduciendo={false} idEstatico="b" />)
  const pantalla = container.firstElementChild as HTMLElement
  expect(pantalla).toHaveAttribute('aria-hidden', 'true')
  expect(pantalla.style.getPropertyValue('--k-resaltado')).toBe('#FFD400')
  expect(pantalla.style.getPropertyValue('--k-fuente')).toBe('"Atkinson Hyperlegible Next"')
  const linea = container.querySelector<HTMLElement>('[data-linea=b]')
  expect(linea).toHaveTextContent('Cantan al viento')
  expect(recorte(linea)).toContain('90px 0px')
  expect(recorte(linea)).not.toContain('24px')
})

it('muestra el aviso y el spinner de 24 px solo junto al título', () => {
  const aviso = 'Falta 1 línea por sincronizar: no se verá.'
  const textoCargando = 'Cargando…'
  const letraConTitulo = letra([linea('a', 'Nubes de sal', 8000)])
  const { container, rerender, getByText, queryByText } = render(
    <PantallaLetra
      {...props}
      letra={letraConTitulo}
      reproduciendo
      avisoTitulo={aviso}
      textoCargando={textoCargando}
    />
  )
  expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  expect(getByText(aviso)).toHaveTextContent(`⚠ ${aviso}`)
  expect(queryByText(textoCargando)).not.toBeInTheDocument()

  rerender(
    <PantallaLetra
      {...props}
      letra={letraConTitulo}
      reproduciendo
      avisoTitulo={aviso}
      cargando
      textoCargando={textoCargando}
    />
  )
  const spinner = getByText(textoCargando).querySelector('svg')
  expect(spinner).toHaveAttribute('width', '24')
  expect(spinner).toHaveAttribute('height', '24')

  rerender(
    <PantallaLetra
      {...props}
      reproduciendo
      avisoTitulo={aviso}
      cargando
      textoCargando={textoCargando}
    />
  )
  expect(queryByText(aviso)).not.toBeInTheDocument()
  expect(queryByText(textoCargando)).not.toBeInTheDocument()
})

it.each([false, true])(
  'actualiza texto y barrido al ritmo del audio (movimiento reducido %s)',
  (reducido) => {
    vi.stubGlobal('matchMedia', () => ({ matches: reducido }))
    const fuentes = new EventTarget()
    const observar = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(medir: () => void) {
          redimensionar = medir
        }
        observe = observar
        disconnect(): void {}
      }
    )
    let redimensionar: () => void
    Object.defineProperty(document, 'fonts', { configurable: true, value: fuentes })
    const pendientes = new Map<number, FrameRequestCallback>()
    let id = 0
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
      pendientes.set(++id, fn)
      return id
    })
    const cancelar = vi.fn((id: number) => pendientes.delete(id))
    vi.stubGlobal('cancelAnimationFrame', cancelar)
    let ms = 2000
    const reloj = () => ms
    const siguiente = () => {
      const [id, fn] = [...pendientes][0]!
      pendientes.delete(id)
      act(() => fn(ms))
    }
    const { container, unmount } = render(
      <PantallaLetra {...props} reproduciendo obtenerTiempoAudio={reloj} />
    )
    siguiente()
    const nodoA = container.querySelector<HTMLElement>('[data-linea=a]')
    expect(recorte(nodoA)).toBe('inset(100%)')
    ms = 4000
    siguiente()
    expect(container.querySelector('[data-linea=a]')).toBe(nodoA)
    expect(recorte(nodoA)).toContain('90px 0px')
    expect(recorte(nodoA)).not.toContain('24px')

    // El texto puede cambiar de disposición con el mismo tamaño exterior de la pantalla.
    expect(observar).toHaveBeenCalledWith(nodoA)
    cajas = [new DOMRect(0, 0, 80, 20), new DOMRect(0, 24, 120, 20)]
    redimensionar!()
    expect(recorte(nodoA)).toContain('20px 24px')
    cajas = [new DOMRect(0, 0, 100, 20)]
    fuentes.dispatchEvent(new Event('loadingdone'))
    expect(recorte(nodoA)).toContain('50px 0px')
    expect(recorte(nodoA)).not.toContain('24px')

    ms = 6100
    siguiente()
    const nodoB = container.querySelector<HTMLElement>('[data-linea=b]')
    expect(nodoB).toHaveTextContent('Cantan al viento')
    // La entrada ya no es una animación CSS de la línea: la dan las variables del puesto.
    expect(nodoB?.classList.contains(estilos.transicion ?? '#')).toBe(false)
    expect(nodoB?.style.getPropertyValue('--k-escala')).not.toBe('')
    unmount()
    expect(cancelar).toHaveBeenCalledOnce()
    expect(pendientes.size).toBe(0)
    Reflect.deleteProperty(document, 'fonts')
  }
)

it('reparte el avance de una palabra partida dentro de su propia ventana', () => {
  const lineaPorPalabras = {
    ...linea('a', 'Larguísima una palabra', 2000),
    origen_palabras: 'manual' as const,
    palabras: [
      { texto: 'Larguísima', inicio_ms: 2000, fin_ms: 3000 },
      { texto: 'una', inicio_ms: 3000, fin_ms: 4000 },
      { texto: 'palabra', inicio_ms: 4000, fin_ms: 5000 }
    ]
  }
  const { container } = render(
    <PantallaLetra {...props} letra={letra([lineaPorPalabras])} reproduciendo={false} />
  )
  const [primera, segunda, tercera] = container.querySelectorAll('[data-barrido]')
  expect(recorte(primera!)).toContain('90px 24px')
  expect(recorte(segunda!)).toContain('90px 0px')
  expect(recorte(segunda!)).not.toContain('24px')
  expect(recorte(tercera!)).toBe('inset(100%)')
})

// --- Fase 5: fondo en movimiento, indicadores de espera y modo sin barrido ---

const conHueco = letra([
  linea('a', 'Nubes de sal', 2000, { fin_ms: 4000 }),
  linea('b', 'Cantan al viento', 12_000)
])

function estiloFase5(movimiento = false) {
  const estilo = estiloPredeterminado()
  if (movimiento && estilo.fondo.tipo === 'degradado') {
    estilo.fondo.movimiento = { periodo_s: 30, sentido: 'horario' }
  }
  estilo.espera = {
    puntos: true,
    barra: true,
    cuenta: true,
    primera_entrada: true,
    umbral_ms: 4000
  }
  return estilo
}

function montar(ui: (reloj: () => number) => React.ReactElement) {
  const pendientes: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => pendientes.push(fn))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  const t = { ms: 0 }
  const vista = render(ui(() => t.ms))
  return {
    ...vista,
    en(ms: number) {
      t.ms = ms
      act(() => pendientes.shift()!(ms))
    }
  }
}

it('R6, R7, R10 y R11: barra, cuenta y un único anuncio por hueco', () => {
  const anuncios: number[] = []
  const pantalla = montar((reloj) => (
    <PantallaLetra
      {...props}
      letra={conHueco}
      estilo={estiloFase5()}
      reproduciendo
      obtenerTiempoAudio={reloj}
      alAnunciarEspera={(n) => anuncios.push(n)}
    />
  ))
  const raiz = pantalla.container.firstElementChild as HTMLElement
  pantalla.en(3000)
  expect(anuncios).toEqual([])
  pantalla.en(4000)
  expect(anuncios).toEqual([8])
  expect(raiz.style.getPropertyValue('--k-fraccion')).toBe('0')
  expect(pantalla.container.querySelector('[data-indicador=barra]')).toHaveAttribute(
    'aria-hidden',
    'true'
  )
  expect(pantalla.container.querySelector('[data-indicador=cuenta]')).toBeNull()
  pantalla.en(8000)
  expect(raiz.style.getPropertyValue('--k-fraccion')).toBe('0.5')
  pantalla.en(9500)
  expect(pantalla.container.querySelector('[data-indicador=cuenta]')).toHaveTextContent('3')
  pantalla.en(10_500)
  expect(pantalla.container.querySelector('[data-indicador=cuenta]')).toHaveTextContent('2')
  expect(anuncios).toEqual([8])
  pantalla.en(12_000)
  expect(pantalla.container.querySelector('[data-indicador]')).toBeNull()
})

it('R10: con movimiento reducido el número no lleva animación', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const pantalla = montar((reloj) => (
    <PantallaLetra
      {...props}
      letra={conHueco}
      estilo={estiloFase5()}
      reproduciendo
      obtenerTiempoAudio={reloj}
    />
  ))
  pantalla.en(10_500)
  const cuenta = pantalla.container.querySelector('[data-indicador=cuenta]')!
  expect(cuenta).toHaveTextContent('2')
  expect(cuenta.classList.contains(estilos.entraNumero!)).toBe(false)
})

it('R5: los indicadores no son hijos de ninguna línea', () => {
  const pantalla = montar((reloj) => (
    <PantallaLetra
      {...props}
      letra={conHueco}
      estilo={estiloFase5()}
      reproduciendo
      obtenerTiempoAudio={reloj}
    />
  ))
  pantalla.en(10_500)
  const barra = pantalla.container.querySelector('[data-indicador=barra]')!
  const cuenta = pantalla.container.querySelector('[data-indicador=cuenta]')!
  expect(barra.parentElement).toBe(pantalla.container.firstElementChild)
  expect(cuenta.parentElement).toBe(pantalla.container.firstElementChild)
})

it('R12: sin barrido no hay capa de resaltado y los indicadores usan el color de la letra', () => {
  const lineaPorPalabras = {
    ...linea('a', 'Una dos', 2000, { fin_ms: 4000 }),
    origen_palabras: 'manual' as const,
    palabras: [
      { texto: 'Una', inicio_ms: 2000, fin_ms: 3000 },
      { texto: 'dos', inicio_ms: 3000, fin_ms: 4000 }
    ]
  }
  const pantalla = montar((reloj) => (
    <PantallaLetra
      {...props}
      letra={letra([lineaPorPalabras, linea('b', 'Cantan', 12_000)])}
      estilo={estiloFase5()}
      barrido={false}
      reproduciendo
      obtenerTiempoAudio={reloj}
    />
  ))
  pantalla.en(3000)
  expect(pantalla.container.querySelector(`.${estilos.resaltado}`)).toBeNull()
  expect(pantalla.container.querySelector('[data-barrido]')).toBeNull()
  expect(pantalla.container.querySelector('[data-linea=a]')).toHaveTextContent('Una dos')
  expect(pantalla.container.firstElementChild!.classList.contains(estilos.sinBarrido!)).toBe(true)
  const fija = render(<PantallaLetra {...props} barrido={false} reproduciendo={false} />)
  expect(fija.container.querySelector(`.${estilos.resaltado}`)).toBeNull()
})

it('R2, R3 y G2: el fondo se mueve con el reloj de audio, y no con movimiento reducido', () => {
  const montarFondo = (extra = {}) =>
    montar((reloj) => (
      <PantallaLetra
        {...props}
        letra={conHueco}
        estilo={estiloFase5(true)}
        reproduciendo
        obtenerTiempoAudio={reloj}
        {...extra}
      />
    ))
  const fondo = (c: HTMLElement) =>
    (c.firstElementChild as HTMLElement).style.getPropertyValue('--k-fondo')
  const cero = fondo(render(<PantallaLetra {...props} reproduciendo={false} />).container)
  const base = montarFondo()
  base.en(0)
  const a = fondo(base.container)
  base.en(7500)
  const b = fondo(base.container)
  expect(b).not.toBe(a)
  expect(b).toContain('225deg')
  base.unmount()

  const fijo = montarFondo({ fondoEstatico: true })
  fijo.en(7500)
  expect(fondo(fijo.container)).toContain('135deg')
  fijo.unmount()

  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const reducido = montarFondo()
  reducido.en(7500)
  expect(fondo(reducido.container)).toContain('135deg')
  // Sin movimiento (estilo de 0.1.0) el CSS es el de siempre.
  expect(cero).toContain('135deg')
})

// --- Fase 6: tiempo fijo para la exportación ---

const fijoEn = (t: number, extra = {}) => (
  <PantallaLetra
    {...props}
    letra={conHueco}
    estilo={estiloFase5(true)}
    reproduciendo
    tiempoFijoMs={t}
    movimiento="completo"
    {...extra}
  />
)
const fondoDe = (c: HTMLElement) =>
  (c.firstElementChild as HTMLElement).style.getPropertyValue('--k-fondo')

it('E1: con tiempo fijo no usa requestAnimationFrame y pinta fondo, barrido y entrada del instante', () => {
  const raf = vi.fn()
  vi.stubGlobal('requestAnimationFrame', raf)
  const { container } = render(fijoEn(3000))
  expect(raf).not.toHaveBeenCalled()
  const actual = container.querySelector<HTMLElement>('[data-linea=a]')!
  expect(actual).toHaveTextContent('Nubes de sal')
  expect(recorte(actual)).toContain('90px')
  // Sin animación CSS en la línea: nada que fijar por fotograma (la cuenta conserva el suyo).
  expect(actual.dataset.naceMs).toBeUndefined()
  expect(container.querySelectorAll('[data-nace-ms]')).toHaveLength(0)
  expect(fondoDe(container)).toBe(
    fondoCssEn(normalizarEstilo(estiloFase5(true)).fondo, 3000, { estatico: false })
  )
})

it('E2: el mismo instante da el mismo DOM, vengas de donde vengas', () => {
  const directo = render(fijoEn(10_500))
  const html = directo.container.innerHTML
  directo.unmount()
  const viaje = render(fijoEn(2100))
  viaje.rerender(fijoEn(3000))
  viaje.rerender(fijoEn(10_500))
  expect(viaje.container.innerHTML).toBe(html)
  viaje.rerender(fijoEn(10_500))
  expect(viaje.container.innerHTML).toBe(html)
})

it('R8-3 a R8-6: barra de carga con pista y relleno, también sin barrido y con movimiento reducido', () => {
  const fraccion = (c: HTMLElement) =>
    c.querySelector<HTMLElement>('[data-indicador=barra]')!.style.getPropertyValue('--k-fraccion')
  const barraEn = (t: number, extra = {}) => {
    const v = render(fijoEn(t, extra))
    const f = fraccion(v.container)
    const barra = v.container.querySelector('[data-indicador=barra]')!
    const relleno = barra.querySelector(`.${estilos.relleno}`)
    v.unmount()
    return { f, relleno }
  }
  expect([4000, 8000, 12_000 - 1].map((t) => Number(barraEn(t).f).toFixed(2))).toEqual([
    '0.00',
    '0.50',
    '1.00'
  ])
  expect(barraEn(8000).relleno).not.toBeNull()
  // Movimiento reducido: la fracción no cambia.
  expect(barraEn(8000, { movimiento: 'reducido' }).f).toBe('0.5')
  // Sin barrido: el contenedor lleva la clase que recolorea pista y relleno.
  const sin = render(fijoEn(8000, { barrido: false }))
  expect(sin.container.firstElementChild!.classList.contains(estilos.sinBarrido!)).toBe(true)
  expect(fraccion(sin.container)).toBe('0.5')
})

it('E3: el movimiento es el pedido aunque el sistema pida reducido', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const completo = render(fijoEn(10_500))
  const pantalla = completo.container.firstElementChild as HTMLElement
  expect(pantalla.dataset.movimiento).toBe('completo')
  expect(pantalla.querySelector(`.${estilos.entraNumero}`)).not.toBeNull()
  expect(fondoDe(completo.container)).toContain('261deg')
  completo.unmount()
  const reducido = render(fijoEn(10_500, { movimiento: 'reducido' }))
  expect((reducido.container.firstElementChild as HTMLElement).dataset.movimiento).toBe('reducido')
  expect(reducido.container.querySelector(`.${estilos.entraNumero}`)).toBeNull()
})

it('E4: con barrido=false no hay capa de resaltado', () => {
  const { container } = render(fijoEn(3000, { barrido: false }))
  expect(container.querySelector(`.${estilos.resaltado}`)).toBeNull()
})

// --- 0.2.2 · Feature 1: varias líneas, puestos y cambios por tiempo ---

import { anclaDeBloque, tamanoActiva } from './pantalla'
import { PANTALLA_PREDETERMINADA, type Pantalla } from '@shared/pantalla'

const ALTO = 720
const seis = (n: number) => `${Math.round(n * 1e6) / 1e6}`

const cinco = letra([
  linea('a', 'Nubes de sal', 2000, { fin_ms: 4900 }),
  linea('b', 'Cantan al viento', 5000, { fin_ms: 7900 }),
  linea('c', 'Sobre la ceniza', 8000, { fin_ms: 10_900 }),
  linea('d', 'Vuelve la marea', 11_000, { fin_ms: 13_900 }),
  linea('e', 'Se apaga la luz', 14_000, { fin_ms: 16_900 }),
  linea('f', 'Duerme la costa', 17_000, { fin_ms: 19_900 })
])

function estiloCon(pantalla: Partial<Pantalla>) {
  const e = estiloPredeterminado()
  e.pantalla = { ...PANTALLA_PREDETERMINADA, ...pantalla }
  return e
}

function vars(c: HTMLElement) {
  return Array.from(c.querySelectorAll<HTMLElement>('[data-linea]'), (n) => ({
    id: n.dataset.linea,
    copia: n.dataset.copia,
    y: n.style.getPropertyValue('--k-y'),
    escala: n.style.getPropertyValue('--k-escala'),
    opacidad: n.style.getPropertyValue('--k-opacidad'),
    gris: n.style.getPropertyValue('--k-gris')
  }))
}

describe('Feature 1: puestos', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(ALTO)
  })

  const fijoCon = (t: number, extra = {}) => (
    <PantallaLetra
      {...props}
      letra={cinco}
      estilo={estiloCon({})}
      reproduciendo
      tiempoFijoMs={t}
      movimiento="completo"
      {...extra}
    />
  )

  it('R23: el instante fijo y el reproductor pintan lo mismo, también a mitad de un cambio', () => {
    for (const transicion of ['desplazamiento', 'fundido'] as const) {
      const estilo = estiloCon({ transicion })
      const fijo = render(fijoCon(5150, { estilo }))
      const esperado = vars(fijo.container)
      fijo.unmount()
      const vivo = montar((reloj) => (
        <PantallaLetra
          {...props}
          letra={cinco}
          estilo={estilo}
          reproduciendo
          obtenerTiempoAudio={reloj}
        />
      ))
      vivo.en(2000)
      vivo.en(5150)
      expect(vars(vivo.container)).toEqual(esperado)
      vivo.unmount()
    }
  })

  it('«Fundido»: las copias solo existen mientras dura el cambio', () => {
    const estilo = estiloCon({ transicion: 'fundido' })
    const copias = (t: number) => {
      const v = render(fijoCon(t, { estilo }))
      const n = v.container.querySelectorAll('[data-copia=saliente]').length
      const entrantes = v.container.querySelectorAll('[data-copia=entrante]').length
      v.unmount()
      return [n, entrantes]
    }
    const [salientes, entrantes] = copias(5100)
    expect(salientes).toBeGreaterThan(0)
    expect(entrantes).toBe(salientes)
    expect(copias(5400)).toEqual([0, 0])
    expect(copias(6500)).toEqual([0, 0])
  })

  it('R16: con movimiento reducido cada línea está siempre en un puesto entero', () => {
    const escalas = new Set(
      [4950, 5000, 5100, 5200, 5300, 5600].flatMap((t) => {
        const v = render(fijoCon(t, { movimiento: 'reducido' }))
        const lista = vars(v.container).map((x) => x.escala)
        v.unmount()
        return lista
      })
    )
    expect([...escalas].sort()).toEqual(['0.6', '0.7', '1'])
  })

  it('R17: una línea conserva su reducción por longitud y su nodo en todos los puestos', () => {
    // La línea larga no cabe en dos renglones hasta el 85 %; las demás sí.
    const conAltura = window.getComputedStyle
    vi.stubGlobal('getComputedStyle', (nodo: Element) => {
      const estilo = conAltura(nodo)
      estilo.width = '120px'
      estilo.lineHeight = '20px'
      return estilo
    })
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
      this: HTMLElement
    ) {
      const reduccion = Number(this.style.getPropertyValue('--k-reduccion') || 1)
      return this.textContent!.length > 20 && reduccion > 0.85 ? 100 : 40
    })
    const lineaLarga = linea('b', 'Cantan al viento sobre los techos de la ciudad', 5000, {
      fin_ms: 7900
    })
    const larga = letra([cinco.lineas[0]!, lineaLarga, cinco.lineas[2]!, cinco.lineas[3]!])
    const pantalla = montar((reloj) => (
      <PantallaLetra
        {...props}
        letra={larga}
        estilo={estiloCon({})}
        reproduciendo
        obtenerTiempoAudio={reloj}
      />
    ))
    pantalla.en(2000)
    const nodo = pantalla.container.querySelector<HTMLElement>('[data-linea=b]')!
    const reduccion = () => nodo.style.getPropertyValue('--k-reduccion')
    expect(reduccion()).toBe('0.85')
    const escalas: string[] = []
    for (const t of [2500, 5400, 8400]) {
      pantalla.en(t)
      expect(pantalla.container.querySelector('[data-linea=b]')).toBe(nodo)
      expect(reduccion()).toBe('0.85')
      escalas.push(nodo.style.getPropertyValue('--k-escala'))
    }
    // +1 (70 %), activa (100 %) y ya cantada (60 %): la forma es la misma, solo cambia la escala.
    expect(escalas).toEqual(['0.7', '1', '0.6'])
    pantalla.unmount()
  })

  it('R22: el barrido palabra a palabra avanza igual mientras la línea entra', () => {
    const conPalabras = {
      ...linea('a', 'Una dos', 2000, { fin_ms: 4000 }),
      origen_palabras: 'manual' as const,
      palabras: [
        { texto: 'Una', inicio_ms: 2000, fin_ms: 3000 },
        { texto: 'dos', inicio_ms: 3000, fin_ms: 4000 }
      ]
    }
    const v = render(
      <PantallaLetra
        {...props}
        letra={letra([conPalabras, linea('b', 'Cantan', 6000)])}
        reproduciendo
        tiempoFijoMs={2100}
        movimiento="completo"
      />
    )
    const [primera, segunda] = v.container.querySelectorAll('[data-linea=a] [data-barrido]')
    // 10 % de la primera palabra: 18 px de 180 (la medición simulada).
    expect(recorte(primera!)).toContain('18px 0px')
    expect(recorte(segunda!)).toBe('inset(100%)')
  })

  it('R21: Letra lista no tiene capa de resaltado ni a mitad de un cambio', () => {
    for (const transicion of ['desplazamiento', 'fundido'] as const) {
      const v = render(fijoCon(5150, { barrido: false, estilo: estiloCon({ transicion }) }))
      expect(v.container.querySelector(`.${estilos.resaltado}`)).toBeNull()
      expect(v.container.querySelector('[data-barrido]')).toBeNull()
      v.unmount()
    }
  })

  it('R19: barra, cuenta y puntos salen del ancla y no dependen de N ni de P', () => {
    const conEspera = letra([
      linea('a', 'Nubes de sal', 2000, { fin_ms: 4000 }),
      linea('b', 'Cantan al viento', 14_000),
      linea('c', 'Sobre la ceniza', 17_000)
    ])
    const S = tamanoActiva(ALTO)
    for (const pantalla of [
      { lineas: 2, pasadas: 0 },
      { lineas: 5, pasadas: 1 },
      { lineas: 7, pasadas: 2 }
    ]) {
      const estilo = estiloFase5()
      estilo.pantalla = { ...PANTALLA_PREDETERMINADA, ...pantalla }
      const ancla = anclaDeBloque(estilo.pantalla, { y0Px: 0, altoPx: ALTO }, S)
      const v = render(
        <PantallaLetra
          {...props}
          letra={conEspera}
          estilo={estilo}
          reproduciendo
          tiempoFijoMs={12_000}
          movimiento="completo"
        />
      )
      const y = (indicador: string) =>
        v.container
          .querySelector<HTMLElement>(`[data-indicador=${indicador}]`)!
          .style.getPropertyValue('--k-y')
      expect(y('barra')).toBe(`${ancla - 0.9 * S}px`)
      expect(y('cuenta')).toBe(`${ancla}px`)
      expect(y('puntos')).toBe(`${ancla + 0.9 * S}px`)
      // El color lo da la línea que viene, en la zona que la contiene.
      expect(
        v.container
          .querySelector<HTMLElement>('[data-indicador=barra]')!
          .style.getPropertyValue('--k-indicador')
      ).toBe('#FFD400')
      expect(seis(Number(y('barra').replace('px', '')))).toBe(seis(ancla - 0.9 * S))
      v.unmount()
    }
  })

  it('cada nodo lleva su zona y el color del barrido de su línea', () => {
    const v = render(fijoCon(3000))
    const nodo = v.container.querySelector<HTMLElement>('[data-linea=a]')!
    expect(nodo.dataset.zona).toBe('todas')
    expect(nodo.style.getPropertyValue('--k-resaltado-linea')).toBe('#FFD400')
  })

  it('la biblioteca de 0.2.1 (sin pantalla) se ve con 5 líneas', () => {
    const v = render(fijoCon(3000, { estilo: estiloPredeterminado() }))
    // Activa, una ya cantada que aún no existe y las futuras hasta completar 5 puestos.
    expect(v.container.querySelectorAll('[data-linea]').length).toBeLessThanOrEqual(5 + 1)
    expect(v.container.querySelectorAll('[data-linea]').length).toBeGreaterThanOrEqual(4)
  })
})

// --- 0.2.2 · Feature 2: subrayado de lo ya cantado ---

describe('Feature 2: subrayado', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(ALTO)
    const conTamano = window.getComputedStyle
    vi.stubGlobal('getComputedStyle', (nodo: Element) => {
      const estilo = conTamano(nodo)
      estilo.width = '120px'
      estilo.fontSize = '20px'
      return estilo
    })
  })
  const fijo = (extra = {}) => (
    <PantallaLetra
      {...props}
      letra={cinco}
      reproduciendo
      tiempoFijoMs={3500}
      movimiento="completo"
      {...extra}
    />
  )
  const raizDe = (c: HTMLElement) => c.firstElementChild as HTMLElement

  it('R7/R8: la raíz lo anuncia si lo pide el estilo o quien resuelve, y nunca en Letra lista', () => {
    const con = estiloPredeterminado()
    con.letra.subrayar_cantado = true
    const tiene = (extra: object) =>
      raizDe(render(fijo(extra)).container).classList.contains(estilos.subrayado!)
    expect(tiene({})).toBe(false)
    expect(tiene({ estilo: con })).toBe(true)
    expect(tiene({ subrayado: true })).toBe(true)
    expect(tiene({ estilo: con, subrayado: false })).toBe(false)
    expect(tiene({ estilo: con, barrido: false })).toBe(false)
  })

  it('R4: activarlo no cambia ninguna posición, tamaño ni opacidad', () => {
    const sin = render(fijo())
    const a = vars(sin.container)
    sin.unmount()
    const con = render(fijo({ subrayado: true }))
    expect(vars(con.container)).toEqual(a)
  })

  it('R1/R2: el recorte llega al frente del barrido y baja lo que ocupa el subrayado', () => {
    // 20 px de cuerpo: 0,19 × 20 = 3,8 px por debajo, sin pasar del renglón siguiente (4 px de hueco).
    const sin = render(fijo())
    const nodoSin = sin.container.querySelector<HTMLElement>('[data-linea=a]')!
    expect(recorte(nodoSin)).toContain('px 20px')
    sin.unmount()
    const con = render(fijo({ subrayado: true }))
    const nodo = con.container.querySelector<HTMLElement>('[data-linea=a]')!
    expect(recorte(nodo)).toContain('px 23.8px')
    // El ancho pintado es el mismo con y sin subrayado (a 3,5 s: 1500/2900 del recorrido).
    const ancho = (t: string | undefined) => t!.match(/(\d+(\.\d+)?)px 0px/g)
    expect(ancho(recorte(nodo))).toEqual(ancho(recorte(nodoSin)))
  })

  it('el subrayado toma el color del nodo de su línea', () => {
    const v = render(fijo({ subrayado: true }))
    const nodo = v.container.querySelector<HTMLElement>('[data-linea=a]')!
    expect(nodo.style.getPropertyValue('--k-resaltado-linea')).toBe('#FFD400')
  })
})

it('F2-R5: la sombra de la capa subrayada se desvanece con el gris (0205: sin raya oscura en la ya cantada)', () => {
  // jsdom no aplica CSS Modules: se vigila la regla en el propio archivo (captura: capturas-022).
  const css = readFileSync('src/renderer/src/karaoke/pantallaLetra.module.css', 'utf8')
  const regla =
    css.match(/\.subrayado \.linea\[data-activa='true'\] \.resaltado \{[^}]*\}/s)?.[0] ?? ''
  expect(regla).toMatch(/text-decoration-color:[^;]*--k-gris/s)
  expect(regla).toMatch(/text-shadow:[^;]*--k-gris/s)
})
