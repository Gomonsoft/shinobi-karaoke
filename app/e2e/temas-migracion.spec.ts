import type { ApiShinobi } from '../src/shared/ipc'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { estiloPredeterminado } from '../src/shared/estilo'
import { abrirEditor } from './fixtures/editor'
import {
  conTemas,
  hashesCanciones,
  idsCanciones,
  leerCatalogo,
  rutaCancion
} from './fixtures/temas'
import { leerCancion, tarjeta } from './fixtures/separacion'

/**
 * Biblioteca de esquema 1 (0.1.0) en Electron real (tarea 0176, ADR 0006 y 0016 §«Migración»): el
 * catálogo se crea al arrancar, nada se reescribe y cada canción conserva tiempos y estilo.
 */

/** Estilo de usuario distinto del de fábrica, guardado en `config.estilo_predeterminado`. */
const estiloMio = () => {
  const e = estiloPredeterminado()
  return { ...e, fondo: { tipo: 'solido', color: '#123456' } }
}

/** Ids cuyo `cancion.json` tiene algún paso `en_curso`: 0.1.0 lo pasa a `interrumpido` al arrancar. */
const enCurso = (datos: string): Set<string> =>
  new Set(
    idsCanciones(datos).filter((id) => {
      try {
        const pasos = Object.values(leerCancion(datos, id).pasos ?? {}) as { estado: string }[]
        return pasos.some((p) => p.estado === 'en_curso')
      } catch {
        return false // cancion.json ilegible
      }
    })
  )

const estilosVivos = (v: Page): Promise<Record<string, unknown>> =>
  v.evaluate(async () => {
    const lista = await (window as unknown as { shinobi: ApiShinobi }).shinobi.biblioteca.listar()
    return Object.fromEntries(lista.filter((c) => c.estilo).map((c) => [c.id, c.estilo]))
  })

test.describe('migración de una biblioteca de esquema 1', () => {
  test.describe.configure({ timeout: 120_000 })

  for (const caso of [
    { nombre: 'con estilo predeterminado cambiado', estilo: 'mio', tema: 'Mi estilo' },
    { nombre: 'con el estilo de fábrica', estilo: 'fabrica', tema: 'Shinobi' }
  ] as const) {
    test(`${caso.nombre}: tema «${caso.tema}» predeterminado, mismo aspecto y archivos sin reescribir`, async () => {
      let antes: Record<string, string> = {}
      let antesEnCurso = new Set<string>()
      const estilosEnDisco: Record<string, unknown> = {}
      await conTemas(
        `migracion-${caso.estilo}`,
        async (v, datos) => {
          // Al arrancar: catálogo creado con el estilo heredado como predeterminado.
          const catalogo = leerCatalogo(datos)
          expect(catalogo.temas).toHaveLength(1)
          expect(catalogo.temas[0].nombre).toBe(caso.tema)
          expect(catalogo.predeterminado).toBe(catalogo.temas[0].id)

          // Cada canción sigue con su aspecto y con procedencia «Tema personalizado».
          await expect(v.getByRole('article')).toHaveCount(20)
          for (const t of await v.getByRole('article').all()) {
            await expect(t).toHaveAccessibleName(
              /Tema: Tema personalizado\.$|Dañada\. No se puede abrir/
            )
          }
          expect(await estilosVivos(v)).toEqual(estilosEnDisco)

          // Las de YouTube con estilo igual al heredado conservan la miniatura; la de estilo propio no.
          await expect(
            tarjeta(v, 'Desde YouTube con portada').locator('[style*="url("]')
          ).toHaveCount(1)
          await expect(
            tarjeta(v, 'Desde YouTube con estilo propio').locator('[style*="url("]')
          ).toHaveCount(0)

          // Abrir el editor sin tocar nada y el reproductor tampoco reescribe nada.
          await abrirEditor(v, 'Canción lista')
          await v.getByRole('button', { name: 'Biblioteca', exact: true }).click()
          await tarjeta(v, 'Lista con palabras')
            .getByRole('button', { name: /^Reproducir/ })
            .click()
          const capa = v.getByRole('dialog', { name: 'Reproductor de «Lista con palabras»' })
          await expect(capa).toBeVisible({ timeout: 15_000 })
          await v.keyboard.press('Escape')
          await expect(capa).toHaveCount(0)

          const despues = hashesCanciones(datos)
          const distintos = Object.keys(antes).filter((id) => antes[id] !== despues[id])
          // Única excepción heredada de 0.1.0: un paso `en_curso` pasa a `interrumpido`.
          for (const id of distintos) expect(antesEnCurso.has(id), `se reescribió ${id}`).toBe(true)
          for (const id of Object.keys(antes)) {
            if (antesEnCurso.has(id) || !(id in estilosEnDisco)) continue
            // Tiempos y estilo idénticos, ya sin hash: se comparan los campos del archivo.
            const c = leerCancion(datos, id)
            expect(c.estilo).toEqual(estilosEnDisco[id])
            expect(c.apariencia).toBeUndefined()
          }
        },
        {
          temas: false,
          preparar: (datos) => {
            // Una biblioteca de 0.1.0: sin `temas.json` y sin `apariencia`; solo el config cambia.
            const rutaConfig = join(datos, 'config.json')
            const config = JSON.parse(readFileSync(rutaConfig, 'utf8'))
            config.estilo_predeterminado =
              caso.estilo === 'mio' ? estiloMio() : estiloPredeterminado()
            writeFileSync(rutaConfig, JSON.stringify(config, null, 2) + '\n')
            antes = hashesCanciones(datos)
            antesEnCurso = enCurso(datos)
            for (const id of idsCanciones(datos)) {
              try {
                estilosEnDisco[id] = leerCancion(datos, id).estilo
              } catch {
                // cancion.json ilegible
              }
            }
            expect(() => readFileSync(join(datos, 'biblioteca', 'temas.json'))).toThrow()
            void rutaCancion
          }
        }
      )
    })
  }
})
