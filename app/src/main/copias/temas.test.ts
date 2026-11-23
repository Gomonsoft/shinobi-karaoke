import { describe, expect, it } from 'vitest'
import { estiloPredeterminado, type Catalogo, type Estilo, type Tema } from '../../shared'
import { idDePrueba } from '../../shared/__fixtures__'
import { buscarTema } from './temas'

const estilo: Estilo = { ...estiloPredeterminado(), fondo: { tipo: 'solido', color: '#445566' } }
const tema = (n: number, nombre: string, creado: string, e: Estilo = estilo): Tema => ({
  id: idDePrueba(n),
  nombre,
  creado,
  modificado: creado,
  revision: 1,
  estilo: e
})
const catalogo = (temas: Tema[], borrando: string | null = null): Catalogo => ({
  esquema: 1,
  claves: 1,
  predeterminado: null,
  temas,
  asignaciones: { artistas: [], albumes: [] },
  borrado_pendiente: borrando
    ? { tema_id: borrando, iniciado: '2026-11-01T00:00:00.000Z', canciones: [] }
    : null,
  apartado: null
})

describe('buscarTema', () => {
  it('mismo nombre y estilo con otro id: se reutiliza el local', () => {
    const local = tema(2, 'Neón', '2026-11-01T00:00:00.000Z')
    expect(buscarTema(tema(1, 'neón', '2026-11-05T00:00:00.000Z'), catalogo([local]))).toEqual({
      existe: 'igual',
      destino: local
    })
  })
  it('con dos iguales (por id y por nombre) gana el más antiguo', () => {
    const porNombre = tema(2, 'Neón', '2026-10-01T00:00:00.000Z')
    const porId = tema(1, 'Otro nombre', '2026-11-01T00:00:00.000Z')
    expect(
      buscarTema(tema(1, 'Neón', '2026-11-05T00:00:00.000Z'), catalogo([porId, porNombre])).destino
    ).toBe(porNombre)
  })
  it('nunca uno que se está borrando: cuenta como distinto', () => {
    const local = tema(2, 'Neón', '2026-11-01T00:00:00.000Z')
    expect(
      buscarTema(tema(1, 'Neón', '2026-11-05T00:00:00.000Z'), catalogo([local], local.id))
    ).toEqual({ existe: 'distinto', destino: null })
  })
  it('mismo nombre con otro estilo: distinto; sin nada parecido: no', () => {
    const otro: Estilo = { ...estilo, fondo: { tipo: 'solido', color: '#000000' } }
    const local = tema(2, 'Neón', '2026-11-01T00:00:00.000Z', otro)
    expect(buscarTema(tema(1, 'Neón', '2026-11-05T00:00:00.000Z'), catalogo([local])).existe).toBe(
      'distinto'
    )
    expect(buscarTema(tema(1, 'Sol', '2026-11-05T00:00:00.000Z'), catalogo([local])).existe).toBe(
      'no'
    )
  })
})
