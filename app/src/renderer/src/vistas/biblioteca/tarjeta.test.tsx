import { render, screen } from '@testing-library/react'
import type { TrabajoIpc } from '@shared/ipc'
import { LineaPaso } from './LineaPaso'
import { aparienciaResumenPrueba, paso, resumenPrueba } from './resumenPrueba'
import { lineaDeTema } from './textosTema'
import {
  datosDeTarjeta,
  esReintentable,
  formatearDuracion,
  textoAriaTarjeta,
  textoEta,
  textoSincronia,
  tituloDeTarjeta,
  usaMiniatura
} from './tarjeta'

const TEMA = ' Tema: Tema personalizado.'

describe('textoSincronia', () => {
  it.each([
    [1, 'Falta 1 línea por sincronizar'],
    [2, 'Faltan 2 líneas por sincronizar'],
    [3, 'Faltan 3 líneas por sincronizar']
  ])('n = %i', (n, texto) => {
    expect(textoSincronia(n)).toBe(texto)
  })
})

describe('formatearDuracion', () => {
  it('formatea m:ss', () => {
    expect(formatearDuracion(355_000)).toBe('5:55')
    expect(formatearDuracion(61_000)).toBe('1:01')
    expect(formatearDuracion(0)).toBe('0:00')
  })
  it('usa horas si hace falta y tolera null', () => {
    expect(formatearDuracion(3_725_000)).toBe('1:02:05')
    expect(formatearDuracion(null)).toBeNull()
  })
})

describe('línea de una canción Lista', () => {
  it('sin líneas pendientes no muestra línea', () => {
    const d = datosDeTarjeta(resumenPrueba({ estado: 'lista' }))
    expect(d.insignia).toBe('lista')
    expect(d.accion).toBe('reproducir')
    expect(d.linea).toBeNull()
  })

  it('incompleta con n = 1 usa el singular y sigue siendo Lista', () => {
    const d = datosDeTarjeta(
      resumenPrueba({ estado: 'lista', incompleta: true, lineasSinSincronizar: 1 })
    )
    expect(d.insignia).toBe('lista')
    expect(d.accion).toBe('reproducir')
    expect(d.linea).toEqual({ tipo: 'aviso', texto: 'Falta 1 línea por sincronizar' })
  })

  it('incompleta con n = 2 usa el plural', () => {
    const d = datosDeTarjeta(
      resumenPrueba({ estado: 'lista', incompleta: true, lineasSinSincronizar: 2 })
    )
    expect(d.linea?.texto).toBe('Faltan 2 líneas por sincronizar')
  })

  it('con n = 0 (las pausas no cuentan) no hay aviso aunque la letra tenga pausas', () => {
    // `lineasSinSincronizar` ya excluye las pausas (derivados.ts): 0 -> sin línea.
    const d = datosDeTarjeta(
      resumenPrueba({ estado: 'lista', incompleta: false, lineasSinSincronizar: 0 })
    )
    expect(d.linea).toBeNull()
  })

  it('el aviso se muestra con icono (no solo color) y como texto', () => {
    const d = datosDeTarjeta(
      resumenPrueba({ estado: 'lista', incompleta: true, lineasSinSincronizar: 1 })
    )
    const { container } = render(<LineaPaso linea={d.linea!} />)
    expect(screen.getByText('Falta 1 línea por sincronizar')).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeNull()
  })
})

describe('línea de un Borrador', () => {
  const letraPendiente = (cambios = {}) => resumenPrueba(cambios)

  it('sin letra', () => {
    const d = datosDeTarjeta(letraPendiente())
    expect(d.insignia).toBe('borrador')
    expect(d.linea?.texto).toBe('Falta la letra')
    expect(d.accion).toBe('continuar')
  })

  it.each([
    [1, 'Falta 1 línea por sincronizar'],
    [2, 'Faltan 2 líneas por sincronizar']
  ])('letra a medias con n = %i', (n, texto) => {
    const d = datosDeTarjeta(
      resumenPrueba({
        lineasSinSincronizar: n,
        pasos: {
          fuente: paso('completado'),
          separacion: paso('completado'),
          letra: paso('completado'),
          edicion: paso('pendiente')
        }
      })
    )
    expect(d.linea?.texto).toBe(texto)
  })

  it('con n = 0 y letra hecha: Lista para revisar', () => {
    const d = datosDeTarjeta(
      resumenPrueba({
        pasos: {
          fuente: paso('completado'),
          separacion: paso('completado'),
          letra: paso('completado'),
          edicion: paso('pendiente')
        }
      })
    )
    expect(d.linea?.texto).toBe('Lista para revisar')
  })

  it('un trabajo activo tiene prioridad sobre la letra', () => {
    const d = datosDeTarjeta(
      resumenPrueba({
        lineasSinSincronizar: 2,
        pasos: {
          fuente: paso('completado'),
          separacion: paso('en_curso', { progreso: 0.42 }),
          letra: paso('completado'),
          edicion: paso('pendiente')
        }
      })
    )
    expect(d.linea).toEqual({ tipo: 'curso', texto: 'Separando 42 %', barra: 42 })
  })

  it('separación en curso sin progreso es indeterminada', () => {
    const d = datosDeTarjeta(
      resumenPrueba({
        pasos: {
          fuente: paso('completado'),
          separacion: paso('en_curso'),
          letra: paso('pendiente'),
          edicion: paso('pendiente')
        }
      })
    )
    expect(d.linea).toEqual({ tipo: 'curso', texto: 'Preparando la separación…', barra: null })
  })

  it('error: título del error, insignia Error y Reintentar', () => {
    const d = datosDeTarjeta(
      resumenPrueba({
        pasos: {
          fuente: paso('completado'),
          separacion: paso('error', { error: { codigo: 'MEMORIA_INSUFICIENTE', mensaje: 'x' } }),
          letra: paso('pendiente'),
          edicion: paso('pendiente')
        }
      })
    )
    expect(d.insignia).toBe('error')
    expect(d.linea).toEqual({ tipo: 'error', texto: 'Tu equipo se quedó sin memoria' })
    expect(d.accion).toBe('reintentar')
  })

  it('código de error desconocido: Algo salió mal', () => {
    const d = datosDeTarjeta(
      resumenPrueba({
        pasos: {
          fuente: paso('error', { error: { codigo: 'RARO', mensaje: 'x' } }),
          separacion: paso('pendiente'),
          letra: paso('pendiente'),
          edicion: paso('pendiente')
        }
      })
    )
    expect(d.linea?.texto).toBe('Algo salió mal')
  })

  it('interrumpido: insignia Borrador, aviso y Reintentar', () => {
    const d = datosDeTarjeta(
      resumenPrueba({
        pasos: {
          fuente: paso('completado'),
          separacion: paso('interrumpido', { progreso: 0.4 }),
          letra: paso('pendiente'),
          edicion: paso('pendiente')
        }
      })
    )
    expect(d.insignia).toBe('borrador')
    expect(d.linea).toEqual({ tipo: 'aviso', texto: 'Interrumpido' })
    expect(d.accion).toBe('reintentar')
  })
})

describe('Dañada', () => {
  it.each([
    ['json', 'No se puede abrir esta canción'],
    ['pistas', 'Faltan las pistas separadas']
  ] as const)('motivo %s', (motivo, texto) => {
    const d = datosDeTarjeta(resumenPrueba({ danada: true, motivo, pasos: null }))
    expect(d.insignia).toBe('danada')
    expect(d.linea?.texto).toBe(texto)
    expect(d.accion).toBeNull()
  })
})

describe('aria y portada', () => {
  it('bib.aria.tarjeta incluye el aviso de la lista incompleta', () => {
    const r = resumenPrueba({ estado: 'lista', incompleta: true, lineasSinSincronizar: 3 })
    expect(textoAriaTarjeta(r, datosDeTarjeta(r))).toBe(
      'Canción de prueba, Artista, Lista. Faltan 3 líneas por sincronizar.' + TEMA
    )
  })

  it('sin línea no deja un punto suelto', () => {
    const r = resumenPrueba({ estado: 'lista' })
    expect(textoAriaTarjeta(r, datosDeTarjeta(r))).toBe('Canción de prueba, Artista, Lista.' + TEMA)
  })

  it('I1: dañada por JSON usa «Canción sin nombre» en el título y en el aria', () => {
    const r = resumenPrueba({
      titulo: 'carpeta-123',
      artista: '',
      danada: true,
      motivo: 'json',
      pasos: null
    })
    expect(tituloDeTarjeta(r)).toBe('Canción sin nombre')
    expect(textoAriaTarjeta(r, datosDeTarjeta(r))).toBe(
      'Canción sin nombre, Dañada. No se puede abrir esta canción.'
    )
    const pistas = resumenPrueba({ danada: true, motivo: 'pistas', pasos: null })
    expect(tituloDeTarjeta(pistas)).toBe('Canción de prueba')
  })

  it('miniatura solo con apariencia neutra y miniatura, sin comparar estilos', () => {
    const url = 'shinobi-media://x/fuente/miniatura.jpg'
    const neutra = aparienciaResumenPrueba({ procedencia: 'predeterminado', neutra: true })
    const asignada = aparienciaResumenPrueba({ procedencia: 'album', neutra: false })
    expect(usaMiniatura(resumenPrueba({ miniatura: url, apariencia: neutra }))).toBe(true)
    // Mismo estilo en ambos casos: solo manda `neutra`.
    expect(usaMiniatura(resumenPrueba({ miniatura: url, apariencia: asignada }))).toBe(false)
    expect(usaMiniatura(resumenPrueba({ miniatura: null, apariencia: neutra }))).toBe(false)
    expect(usaMiniatura(resumenPrueba({ miniatura: url, apariencia: neutra, danada: true }))).toBe(
      false
    )
  })

  it('línea de tema en los cuatro niveles y en los casos especiales', () => {
    const l = (cambios: Parameters<typeof aparienciaResumenPrueba>[0]) =>
      lineaDeTema(aparienciaResumenPrueba({ temaNombre: 'Noche ninja', ...cambios })).texto
    expect(l({ procedencia: 'cancion' })).toBe('Noche ninja · propio')
    expect(l({ procedencia: 'album' })).toBe('Noche ninja · del álbum')
    expect(l({ procedencia: 'artista' })).toBe('Noche ninja · del artista')
    expect(l({ procedencia: 'predeterminado' })).toBe('Noche ninja · predeterminado')
    expect(l({ procedencia: 'aleatorio' })).toBe('Noche ninja · al azar')
    expect(l({ procedencia: 'predeterminado_anterior' })).toBe(
      'Noche ninja · predeterminado anterior'
    )
    expect(l({ procedencia: 'propio' })).toBe('Tema personalizado')
    expect(l({ procedencia: 'incluido' })).toBe('Estilo incluido')
    expect(l({ procedencia: 'respaldo' })).toBe('Tema no disponible')
  })

  it('el nombre accesible termina con el tema', () => {
    const r = resumenPrueba({
      apariencia: aparienciaResumenPrueba({ procedencia: 'artista', temaNombre: 'Neón' })
    })
    expect(textoAriaTarjeta(r, datosDeTarjeta(r))).toMatch(/ Tema: Neón · del artista\.$/)
    const rota = resumenPrueba({ danada: true, motivo: 'json', pasos: null })
    expect(textoAriaTarjeta(rota, datosDeTarjeta(rota))).not.toContain('Tema:')
  })
})

describe('trabajo en vivo (0014)', () => {
  const trabajo = (extra: Partial<TrabajoIpc> = {}): TrabajoIpc => ({
    id: 't',
    cancionId: 'c1',
    paso: 'separacion',
    cola: 'pesada',
    comando: 'demo',
    estado: 'en_curso',
    posicion: null,
    resultado: null,
    error: null,
    progreso: null,
    ...extra
  })
  const progreso = (valor: number | null, etaSegundos: number | null) => ({
    id: 't',
    cancionId: 'c1',
    paso: 'separacion' as const,
    fase: 'x',
    valor,
    etaSegundos
  })
  const linea = (vivo: Parameters<typeof datosDeTarjeta>[1]) =>
    datosDeTarjeta(resumenPrueba(), vivo).linea

  it('textoEta redondea como prog.eta', () => {
    expect(textoEta(null)).toBeNull()
    expect(textoEta(30)).toBe('queda menos de 1 min')
    expect(textoEta(70)).toBe('queda alrededor de 1 min')
    expect(textoEta(180)).toBe('quedan unos 3 min')
  })

  it('separando con y sin tiempo, descargando y fases indeterminadas', () => {
    expect(linea({ trabajo: trabajo(), progreso: progreso(0.42, 180) })).toEqual({
      tipo: 'curso',
      texto: 'Separando 42 % · quedan unos 3 min',
      barra: 42
    })
    expect(linea({ trabajo: trabajo(), progreso: progreso(0.1, null) })?.texto).toBe(
      'Separando 10 %'
    )
    expect(
      linea({ trabajo: trabajo({ paso: 'fuente' }), progreso: progreso(0.63, 30) })?.texto
    ).toBe('Descargando 63 % · queda menos de 1 min')
    expect(linea({ trabajo: trabajo(), progreso: progreso(null, null) })).toEqual({
      tipo: 'curso',
      texto: 'Preparando la separación…',
      barra: null
    })
    expect(linea({ trabajo: trabajo({ paso: 'fuente' }), progreso: null })?.texto).toBe(
      'Preparando el audio…'
    )
  })

  it('espera de un reintento de red (bib.paso.reintento.red): sin barra y sin error', () => {
    const d = datosDeTarjeta(resumenPrueba(), {
      trabajo: trabajo({ paso: 'fuente' }),
      progreso: { ...progreso(null, null), fase: 'reintentando' },
      esperaS: 12
    })
    expect(d.linea).toEqual({ tipo: 'curso', texto: 'Reintentando en 12 s…' })
    expect(d.textoEstado).not.toBe('Error')
  })

  it('en cola (trabajo vivo): para separar y para descargar', () => {
    expect(linea({ trabajo: trabajo({ estado: 'en_cola', posicion: 1 }), progreso: null })).toEqual(
      { tipo: 'cola', texto: 'En cola para separar' }
    )
    expect(
      linea({
        trabajo: trabajo({ estado: 'en_cola', paso: 'fuente', posicion: 1 }),
        progreso: null
      })
    ).toEqual({ tipo: 'cola', texto: 'En cola para descargar' })
  })

  it('paso pendiente sin trabajo vivo: «Falta …» sin icono y con Continuar', () => {
    const sep = datosDeTarjeta(
      resumenPrueba({
        pasos: { ...resumenPrueba().pasos!, separacion: paso('pendiente') }
      })
    )
    expect(sep.linea).toEqual({ tipo: 'texto', texto: 'Falta separar las pistas' })
    expect(sep.accion).toBe('continuar')
    const fuente = datosDeTarjeta(
      resumenPrueba({
        pasos: {
          ...resumenPrueba().pasos!,
          fuente: paso('pendiente'),
          separacion: paso('pendiente')
        }
      })
    )
    expect(fuente.linea).toEqual({ tipo: 'texto', texto: 'Falta descargar el audio' })
    expect(fuente.accion).toBe('continuar')
    // Con trabajo vivo, la línea es la del trabajo.
    expect(
      datosDeTarjeta(
        resumenPrueba({ pasos: { ...resumenPrueba().pasos!, separacion: paso('pendiente') } }),
        { trabajo: trabajo({ estado: 'en_cola', posicion: 1 }), progreso: null }
      ).linea?.tipo
    ).toBe('cola')
  })

  it('textoEta: los tres tramos de bib.eta', () => {
    expect(textoEta(10)).toBe('queda menos de 1 min')
    expect(textoEta(75)).toBe('queda alrededor de 1 min')
    expect(textoEta(300)).toBe('quedan unos 5 min')
  })

  it('el trabajo vivo prevalece sobre lo persistido y no afecta a las listas', () => {
    const interrumpida = resumenPrueba({
      pasos: { ...resumenPrueba().pasos!, separacion: paso('interrumpido') }
    })
    expect(datosDeTarjeta(interrumpida).linea?.texto).toBe('Interrumpido')
    expect(
      datosDeTarjeta(interrumpida, { trabajo: trabajo(), progreso: progreso(0.5, null) }).linea
        ?.texto
    ).toBe('Separando 50 %')
    const lista = resumenPrueba({ estado: 'lista' })
    expect(datosDeTarjeta(lista, { trabajo: trabajo(), progreso: null }).linea).toBeNull()
  })
})

describe('línea de paso de la separación y reintentos (0070, ux/02 criterio 18)', () => {
  const trabajo: TrabajoIpc = {
    id: 't',
    cancionId: 'c1',
    paso: 'separacion',
    cola: 'pesada',
    comando: 'demo',
    estado: 'en_curso',
    posicion: null,
    resultado: null,
    error: null,
    progreso: null
  }
  const evento = (extra: Record<string, unknown>) => ({
    id: 't',
    cancionId: 'c1',
    paso: 'separacion' as const,
    fase: 'x',
    valor: null,
    etaSegundos: null,
    ...extra
  })

  it('descargando_modelo: bib.paso.modelo con barra determinada y sin tiempo restante', () => {
    const d = datosDeTarjeta(resumenPrueba(), {
      trabajo,
      progreso: evento({ fase: 'descargando_modelo', valor: 0.42, etaSegundos: 90 })
    })
    expect(d.linea).toEqual({ tipo: 'curso', texto: 'Descargando el modelo 42 %', barra: 42 })
    expect(d.insignia).toBe('borrador')
  })

  it.each(['memoria', 'memoria_cpu'])('reintentando por %s: sin error', (motivo) => {
    const d = datosDeTarjeta(resumenPrueba(), {
      trabajo,
      progreso: evento({ fase: 'reintentando', detalle: { motivo } })
    })
    expect(d.linea?.texto).toBe('Reintentando la separación…')
    expect(d.linea?.tipo).toBe('curso')
    expect(d.insignia).toBe('borrador')
  })

  it('reintentando por red (descarga): bib.paso.reintento.red con la cuenta atrás', () => {
    const d = datosDeTarjeta(resumenPrueba(), {
      trabajo: { ...trabajo, paso: 'fuente' },
      progreso: evento({ paso: 'fuente', fase: 'reintentando', detalle: { motivo: 'red' } }),
      esperaS: 5
    })
    expect(d.linea?.texto).toBe('Reintentando en 5 s…')
    expect(d.linea?.barra).toBeUndefined()
  })

  it('una dañada por pistas con la separación en cola muestra "En cola para separar"', () => {
    const danada = resumenPrueba({ danada: true, motivo: 'pistas' })
    const d = datosDeTarjeta(danada, { trabajo: { ...trabajo, estado: 'en_cola' }, progreso: null })
    expect(d.insignia).toBe('danada')
    expect(d.linea?.texto).toBe('En cola para separar')
  })

  it('error reintentable → Reintentar; error de fuente no reintentable → Ver', () => {
    const error = (codigo: string) =>
      resumenPrueba({
        pasos: {
          fuente: paso('error', { error: { codigo, mensaje: '' } }),
          separacion: paso('pendiente'),
          letra: paso('pendiente'),
          edicion: paso('pendiente')
        }
      })
    expect(datosDeTarjeta(error('SIN_CONEXION')).accion).toBe('reintentar')
    expect(datosDeTarjeta(error('VIDEO_NO_DISPONIBLE')).accion).toBe('ver')
    expect(esReintentable(error('VIDEO_NO_DISPONIBLE'))).toBe(false)
    const sep = resumenPrueba({
      pasos: {
        fuente: paso('completado'),
        separacion: paso('error', { error: { codigo: 'MEMORIA_INSUFICIENTE', mensaje: '' } }),
        letra: paso('pendiente'),
        edicion: paso('pendiente')
      }
    })
    expect(datosDeTarjeta(sep).accion).toBe('reintentar')
  })

  it.each(['fuente', 'separacion'] as const)('motor incompleto en %s: ofrece Ver', (nombrePaso) => {
    const resumen = resumenPrueba({
      pasos: {
        fuente: paso('completado'),
        separacion: paso('pendiente'),
        letra: paso('pendiente'),
        edicion: paso('pendiente'),
        [nombrePaso]: paso('error', { error: { codigo: 'RUNTIME_NO_DISPONIBLE', mensaje: '' } })
      }
    })
    expect(esReintentable(resumen)).toBe(false)
    expect(datosDeTarjeta(resumen)).toMatchObject({
      accion: 'ver',
      linea: { tipo: 'error', texto: 'Hay que reparar el motor de audio' }
    })
  })
})
