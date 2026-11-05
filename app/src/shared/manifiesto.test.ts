import { describe, expect, it } from 'vitest'
import {
  bytesTotalesInstalacion,
  estimarMinutosSeparacion,
  manifiestoSchema,
  MODELO_POR_DEFECTO,
  requisitosDe,
  type Manifiesto
} from './manifiesto'

const sha = (c: string): string => c.repeat(64)

function crearManifiesto(): Manifiesto {
  return manifiestoSchema.parse({
    version: 1,
    python: { version: '3.12.16', bytes_descarga: { 'darwin-arm64': 24e6, 'win32-x64': 30e6 } },
    runtime: {
      'darwin-arm64': {
        mps: {
          requisitos: 'requisitos/darwin-arm64-mps.txt',
          sha256_requisitos: sha('a'),
          bytes_descarga: 296e6,
          bytes_disco: 1.28e9,
          espacio_requerido: 4e9,
          medido: true
        }
      },
      'win32-x64': {
        cpu: {
          requisitos: 'requisitos/win32-x64-cpu.txt',
          sha256_requisitos: sha('b'),
          bytes_descarga: 283e6,
          bytes_disco: null,
          espacio_requerido: 3e9,
          medido: false
        }
      }
    },
    modelos: [
      {
        id: 'rapido',
        archivo: 'rapido.onnx',
        urls: ['https://example.com/rapido.onnx'],
        bytes: 59e6,
        sha256: sha('c'),
        licencia: 'no declarada',
        provisional: true
      },
      {
        id: 'calidad',
        archivo: 'calidad.ckpt',
        urls: ['https://example.com/calidad.ckpt'],
        bytes: 913e6,
        sha256: sha('d'),
        extra: [
          {
            archivo: 'calidad.yaml',
            urls: ['https://example.com/c.yaml'],
            bytes: 944,
            sha256: sha('e')
          }
        ],
        licencia: 'MIT'
      }
    ],
    factores: {
      mps: { calidad: [1.08, 1.27], rapido: [0.7, 0.79] },
      cpu: { rapido: null, calidad: null }
    },
    estimacion: { cpu: { rapido: [0.75, 1.75], calidad: [1.5, 4] } }
  })
}

describe('manifiestoSchema', () => {
  it('valida el manifiesto de prueba y aplica valores por defecto', () => {
    const m = crearManifiesto()
    expect(m.modelos[0]?.extra).toEqual([])
    expect(m.modelos[1]?.provisional).toBe(false)
  })
  it('rechaza SHA-256 mal formados, plataformas desconocidas y modelos vacíos', () => {
    const base = JSON.parse(JSON.stringify(crearManifiesto()))
    expect(
      manifiestoSchema.safeParse({
        ...base,
        modelos: [{ ...base.modelos[0], sha256: 'XYZ' }]
      }).success
    ).toBe(false)
    expect(manifiestoSchema.safeParse({ ...base, runtime: { 'sunos-x64': {} } }).success).toBe(
      false
    )
    expect(manifiestoSchema.safeParse({ ...base, modelos: [] }).success).toBe(false)
    expect(manifiestoSchema.safeParse({ ...base, version: 0 }).success).toBe(false)
  })
  it('licencia solo MIT o "no declarada"', () => {
    const base = JSON.parse(JSON.stringify(crearManifiesto()))
    base.modelos[0].licencia = 'GPL'
    expect(manifiestoSchema.safeParse(base).success).toBe(false)
  })
})

describe('MODELO_POR_DEFECTO', () => {
  it('es Calidad para todos los perfiles, también cpu', () => {
    expect(MODELO_POR_DEFECTO).toBe('calidad')
  })
})

describe('requisitosDe', () => {
  const m = crearManifiesto()
  it('devuelve los requisitos de una combinación soportada', () => {
    expect(requisitosDe(m, 'darwin-arm64', 'mps')?.espacio_requerido).toBe(4e9)
  })
  it('null si la plataforma o el perfil no están soportados', () => {
    expect(requisitosDe(m, 'darwin-arm64', 'cuda')).toBeNull()
    expect(requisitosDe(m, 'linux-x64', 'cpu')).toBeNull()
    expect(requisitosDe(m, 'freebsd-x64', 'cpu')).toBeNull()
    expect(requisitosDe(m, 'constructor', 'cpu')).toBeNull()
  })
})

describe('bytesTotalesInstalacion', () => {
  const m = crearManifiesto()
  it('Python + dependencias + modelo Calidad (con extras), también en cpu', () => {
    expect(bytesTotalesInstalacion(m, 'darwin-arm64', 'mps')).toBe(24e6 + 296e6 + 913e6 + 944)
    expect(bytesTotalesInstalacion(m, 'win32-x64', 'cpu')).toBe(30e6 + 283e6 + 913e6 + 944)
  })
  it('null si no está soportado', () => {
    expect(bytesTotalesInstalacion(m, 'linux-x64', 'cpu')).toBeNull()
  })
})

describe('estimarMinutosSeparacion', () => {
  const m = crearManifiesto()
  const cuatroMin = 4 * 60000
  it('usa el factor medido si existe', () => {
    expect(estimarMinutosSeparacion(cuatroMin, 'mps', 'calidad', { calidad: 1.5 }, m)).toEqual({
      min: 6,
      max: 6
    })
  })
  it('sin medido, usa el factor de referencia', () => {
    const r = estimarMinutosSeparacion(cuatroMin, 'mps', 'calidad', {}, m)
    expect(r?.min).toBeCloseTo(4.32)
    expect(r?.max).toBeCloseTo(5.08)
  })
  it('el factor medido de otro modelo no se usa', () => {
    const r = estimarMinutosSeparacion(cuatroMin, 'mps', 'rapido', { calidad: 9 }, m)
    expect(r?.min).toBeCloseTo(2.8)
  })
  it('factor null → estimación del manifiesto', () => {
    const r = estimarMinutosSeparacion(cuatroMin, 'cpu', 'rapido', {}, m)
    expect(r?.min).toBeCloseTo(3)
    expect(r?.max).toBeCloseTo(7)
  })
  it('sin ningún dato → null; duración 0 → 0', () => {
    expect(estimarMinutosSeparacion(cuatroMin, 'cuda', 'calidad', {}, m)).toBeNull()
    expect(estimarMinutosSeparacion(0, 'mps', 'calidad', {}, m)).toEqual({ min: 0, max: 0 })
  })
})
