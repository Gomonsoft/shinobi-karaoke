import { describe, expect, it } from 'vitest'
import { errorRendererSchema } from '../../shared/ipc'
import {
  crearRegistroErroresRenderer,
  MAX_POR_VENTANA,
  MAX_TOTAL,
  VENTANA_MS,
  vigilarContenidoParaRegistro
} from './erroresRenderer'

function montar() {
  const lineas: string[] = []
  let t = 1_000_000
  const reg = crearRegistroErroresRenderer(
    { escribir: (n, m, msg) => lineas.push(`${n}|${m}|${msg}`) },
    () => t
  )
  return { reg, lineas, avanzar: (ms: number) => (t += ms) }
}

describe('errores del renderer en app.log', () => {
  it('escribe origen, mensaje, contexto y pila en una línea', () => {
    const { reg, lineas } = montar()
    reg.registrar({
      origen: 'react',
      mensaje: 'TypeError: x is undefined',
      pila: 'TypeError\n    at Editor',
      componentes: '\n    at PistaSincronia',
      vista: 'cancion/editor',
      cancionId: 'abc'
    })
    expect(lineas).toHaveLength(1)
    expect(lineas[0]).toBe(
      'error|renderer|react: TypeError: x is undefined | vista=cancion/editor cancion=abc | pila: TypeError\n    at Editor | componentes: \n    at PistaSincronia'
    )
  })

  it('un bucle de errores se limita por ventana y se anota lo omitido una vez', () => {
    const { reg, lineas, avanzar } = montar()
    for (let i = 0; i < 100; i++) reg.registrar({ origen: 'onerror', mensaje: `e${i}` })
    expect(lineas).toHaveLength(MAX_POR_VENTANA)
    avanzar(VENTANA_MS)
    reg.registrar({ origen: 'onerror', mensaje: 'otra' })
    expect(lineas).toHaveLength(MAX_POR_VENTANA + 2)
    expect(lineas[MAX_POR_VENTANA]).toContain('se omitieron 90 errores')
  })

  it('tope por sesión', () => {
    const { reg, lineas, avanzar } = montar()
    for (let i = 0; i < MAX_TOTAL + 50; i++) {
      reg.registrar({ origen: 'onerror', mensaje: `e${i}` })
      if (i % MAX_POR_VENTANA === MAX_POR_VENTANA - 1) avanzar(VENTANA_MS)
    }
    expect(lineas.filter((l) => l.includes('no se registran más'))).toHaveLength(1)
    expect(lineas.filter((l) => l.startsWith('error|')).length).toBe(MAX_TOTAL)
  })

  it('el contrato rechaza mensajes enormes y orígenes desconocidos', () => {
    expect(
      errorRendererSchema.safeParse({ origen: 'onerror', mensaje: 'x'.repeat(501) }).success
    ).toBe(false)
    expect(errorRendererSchema.safeParse({ origen: 'otro', mensaje: 'x' }).success).toBe(false)
    expect(errorRendererSchema.safeParse({ origen: 'react', mensaje: 'x' }).success).toBe(true)
  })

  it('el webContents: proceso caído, sin respuesta, preload y solo consola de nivel error', () => {
    const { reg, lineas } = montar()
    const oyentes: Record<string, (...a: never[]) => void> = {}
    vigilarContenidoParaRegistro(
      { on: (ev: string, cb: (...a: never[]) => void) => void (oyentes[ev] = cb) } as never,
      reg
    )
    const l = (ev: string, ...a: unknown[]) => (oyentes[ev] as (...a: unknown[]) => void)(...a)
    l('render-process-gone', {}, { reason: 'crashed', exitCode: 7 })
    l('unresponsive')
    l('preload-error', {}, 'C:\\p\\index.js', new Error('boom'))
    l('console-message', { level: 'warning', message: 'no', lineNumber: 1, sourceId: '' })
    l('console-message', {
      level: 'error',
      message: 'malo',
      lineNumber: 3,
      sourceId: 'file:///a/b.js'
    })
    expect(lineas.map((x) => x.split('|')[2])).toEqual([
      'el proceso de la interfaz se perdió: motivo=crashed codigo=7',
      'la interfaz no responde',
      expect.stringContaining('error del preload (C:\\p\\index.js): Error: boom'),
      'consola: malo (b.js:3)'
    ])
  })
})
