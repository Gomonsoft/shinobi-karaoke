import { describe, expect, it } from 'vitest'
import { AJCOPIA, PAQ, recortarPorElCentro } from './textos'
import type { ResultadoImportacionIpc, ResumenPaqueteIpc } from '@shared/ipc'
import {
  bytesAImportar,
  contarAImportar,
  contarImportadas,
  DECISIONES_INICIALES,
  decisionEfectiva,
  decisionGeneral,
  estadoDe,
  fechaCorta,
  filaDeResultado,
  idsImportadas,
  porCancionParaEnviar,
  type CancionPaquete
} from './modelo'

const c = (id: string, extra: Partial<CancionPaquete> = {}): CancionPaquete => ({
  id,
  titulo: `Canción ${id}`,
  artista: 'Artista',
  existe: false,
  bytes: 100,
  ...extra
})

const nueva = c('n')
const existe = c('e', { existe: true, modificada: '2026-11-20', modificadaLocal: '2026-11-21' })
const otra = c('o', { existe: true, modificada: '2026-11-22', modificadaLocal: '2026-11-21' })
const igual = c('i', { existe: true, igual: true })
const todas = [nueva, existe, otra, igual]

describe('decisiones de la importación', () => {
  it('clasifica nueva, ya la tienes y ya la tienes igual', () => {
    expect(todas.map(estadoDe)).toEqual(['nueva', 'existe', 'existe', 'igual'])
  })

  it('por defecto omite las existentes: solo entra la nueva (F9-6)', () => {
    expect(contarAImportar(todas, DECISIONES_INICIALES)).toBe(1)
    expect(bytesAImportar(todas, DECISIONES_INICIALES)).toBe(100)
  })

  it('«Sustituir» y «Conservar las dos» suman las existentes; la igual no entra nunca', () => {
    expect(contarAImportar(todas, { general: 'sustituir', porCancion: {} })).toBe(3)
    expect(contarAImportar(todas, { general: 'conservar_ambas', porCancion: {} })).toBe(3)
    expect(decisionEfectiva(igual, { general: 'sustituir', porCancion: {} })).toBeNull()
  })

  it('el control general muestra «Mixto» cuando una fila se aparta y vuelve al fijarlo', () => {
    const d = { general: 'omitir', porCancion: { e: 'sustituir' } } as const
    expect(decisionGeneral(todas, d)).toBe('mixto')
    expect(decisionGeneral(todas, { general: 'sustituir', porCancion: {} })).toBe('sustituir')
    // Si todas las filas coinciden en otra respuesta, el control la refleja.
    expect(
      decisionGeneral(todas, { general: 'omitir', porCancion: { e: 'sustituir', o: 'sustituir' } })
    ).toBe('sustituir')
  })

  it('la canción que suena no se sustituye: queda en «Omitir»', () => {
    const bloqueadas = new Set(['e'])
    expect(decisionEfectiva(existe, { general: 'sustituir', porCancion: {} }, bloqueadas)).toBe(
      'omitir'
    )
    expect(contarAImportar(todas, { general: 'sustituir', porCancion: {} }, bloqueadas)).toBe(2)
    expect(decisionGeneral(todas, { general: 'sustituir', porCancion: {} }, bloqueadas)).toBe(
      'sustituir'
    )
  })

  it('solo se envía lo que se aparta de la respuesta general', () => {
    const d = {
      general: 'omitir',
      porCancion: { e: 'sustituir', o: 'omitir', n: 'sustituir' }
    } as const
    expect(porCancionParaEnviar(todas, d)).toEqual({ e: 'sustituir' })
  })
})

describe('resultado por canción (F9-17)', () => {
  const r = (x: Partial<ResultadoImportacionIpc['resultados'][number]>) =>
    filaDeResultado({ id: 'x', resultado: 'importada', ...x }, 'Mi título')

  it.each([
    [{ resultado: 'importada' }, 'ok', 'Importada'],
    [{ resultado: 'importada', idLocal: 'otra' }, 'ok', 'Importada como «Mi título (importada)»'],
    [{ resultado: 'sustituida' }, 'ok', 'Sustituida (la anterior está en la papelera)'],
    [
      { resultado: 'sustituida', ligera: true },
      'ok',
      'Sustituidas la letra, los tiempos y el estilo; tu audio se conserva'
    ],
    [{ resultado: 'omitida', motivo: 'IGUAL' }, 'omitida', 'Omitida: ya la tenías igual'],
    [{ resultado: 'omitida', motivo: 'OMITIDA' }, 'omitida', 'Omitida: conservaste la tuya'],
    [
      { resultado: 'omitida', motivo: 'CANCION_MAS_NUEVA' },
      'omitida',
      'Omitida: es de una versión más nueva de Shinobi Karaoke'
    ],
    [
      { resultado: 'omitida', motivo: 'EN_CURSO' },
      'omitida',
      'Omitida: la tuya tenía un trabajo en curso. Vuelve a importarla cuando termine'
    ],
    [
      { resultado: 'omitida', motivo: 'CANCION_EN_REPRODUCCION' },
      'omitida',
      'Omitida: la tuya estaba sonando. Vuelve a importarla cuando termine'
    ],
    [
      { resultado: 'omitida', motivo: 'CANCELADO' },
      'omitida',
      'No importada: cancelaste la importación'
    ],
    [
      { resultado: 'error', motivo: 'PAQUETE_INCOMPLETO' },
      'error',
      'Sus archivos están dañados en el paquete. No se ha importado.'
    ],
    [
      { resultado: 'error', motivo: 'PAQUETE_NO_VALIDO' },
      'error',
      'Sus datos no son válidos. No se ha importado.'
    ],
    [
      { resultado: 'error', motivo: 'SIN_ESPACIO' },
      'error',
      'No quedaba espacio en el disco. Libera espacio y vuelve a importarla.'
    ],
    [{ resultado: 'error', motivo: 'ERROR_INTERNO' }, 'error', 'No se pudo guardar.'],
    // Un código que no está en la tabla usa `paq.imp.fallo.guardar`.
    [{ resultado: 'error', motivo: 'ALGO_RARO' }, 'error', PAQ.fallo.guardar]
  ] as const)('%o → %s «%s»', (entrada, tipo, texto) => {
    const fila = r(entrada)
    expect(fila).toMatchObject({ tipo, texto })
    // Solo el error lleva detalles para [Copiar detalles].
    expect(fila.detalles !== undefined).toBe(tipo === 'error')
  })

  it('cuenta como importadas las ✓ y devuelve sus ids de la biblioteca', () => {
    const resultado: ResultadoImportacionIpc = {
      resultados: [
        { id: 'a', resultado: 'importada' },
        { id: 'b', resultado: 'sustituida', ligera: true },
        { id: 'c', resultado: 'importada', idLocal: 'c2' },
        { id: 'd', resultado: 'omitida', motivo: 'IGUAL' },
        { id: 'e', resultado: 'error', motivo: 'ERROR_INTERNO' }
      ]
    }
    expect(contarImportadas(resultado)).toBe(3)
    expect(idsImportadas(resultado)).toEqual(['a', 'b', 'c2'])
  })
})

describe('fechas', () => {
  it('«21 nov 2026» y nada con una fecha ilegible', () => {
    expect(fechaCorta('2026-11-21T12:00:00.000Z')).toMatch(/^21 nov 2026$/)
    expect(fechaCorta('no es una fecha')).toBeNull()
    expect(fechaCorta(undefined)).toBeNull()
  })

  it('el tipo de resumen sigue siendo el del contrato', () => {
    const resumen: ResumenPaqueteIpc = { tipo: 'paquete', conAudio: true, canciones: [], temas: [] }
    expect(resumen.canciones).toEqual([])
  })
})

describe('textos del paquete terminado y de la copia', () => {
  it('recorta la ruta por el centro y deja intactas las cortas', () => {
    expect(recortarPorElCentro('/Documentos')).toBe('/Documentos')
    const larga = '/Users/persona/Documentos/Karaoke/Copias de seguridad/2026/noviembre/Videos'
    const corta = recortarPorElCentro(larga)
    expect(corta).toContain('…')
    expect(corta.length).toBeLessThanOrEqual(44)
    expect(corta.startsWith('/Users')).toBe(true)
    expect(corta.endsWith('Videos')).toBe(true)
  })
  it('cifra y unidad del tamaño no se separan; la copia tiene sus propios textos', () => {
    expect(PAQ.ok.resumen('a.shinobi', 1, '290 MB')).toBe('a.shinobi · 1 canción · 290\u00a0MB')
    expect(AJCOPIA.segundoPlano).toBe('Puedes cerrar este cuadro: la copia se sigue creando.')
    expect(AJCOPIA.toastCancelada).toBe('Copia cancelada. No se ha guardado nada.')
  })
})
