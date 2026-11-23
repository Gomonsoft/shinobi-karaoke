import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { DiarioPendientes } from './diario'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'diario-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

const escribir = async (datos: unknown): Promise<void> => {
  await mkdir(join(dir, 'trabajos'), { recursive: true })
  await writeFile(join(dir, 'trabajos', 'pendientes.json'), JSON.stringify(datos))
}

it('lee tolerante `finesSinMarca`: ausente o con otro tipo es false', async () => {
  const base = { tipo: 'preparacion', orden: 0, interrupciones: 0, enCurso: false }
  await escribir([
    { ...base, cancionId: 'a' },
    { ...base, cancionId: 'b', orden: 1, finesSinMarca: 'sí' },
    { ...base, cancionId: 'c', orden: 2, finesSinMarca: true }
  ])
  const diario = new DiarioPendientes(dir)
  await diario.cargar()
  expect(diario.tomarHeredadas().map((e) => [e.cancionId, e.finesSinMarca])).toStrictEqual([
    ['a', false],
    ['b', false],
    ['c', true]
  ])
})

it('alta guarda `finesSinMarca` y lo escribe en el archivo', async () => {
  const diario = new DiarioPendientes(dir)
  diario.alta('a', 'preparacion', { finesSinMarca: true })
  diario.alta('b', 'preparacion')
  await diario.vaciar()
  const siguiente = new DiarioPendientes(dir)
  await siguiente.cargar()
  expect(siguiente.tomarHeredadas().map((e) => [e.cancionId, e.finesSinMarca])).toStrictEqual([
    ['a', true],
    ['b', false]
  ])
})
