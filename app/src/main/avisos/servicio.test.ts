import { describe, expect, it, vi } from 'vitest'
import type { AbrirCancionIpc, AvisoTrabajoIpc, Cancion, TrabajoIpc } from '../../shared'
import { lista, sinLetra } from '../../shared/__fixtures__'
import { avisoDeTrabajo, ServicioAvisos, type Ventana } from './servicio'

interface Arg {
  titulo: string
  cuerpo: string
  alClic: () => void
  alFallar: () => void
}

const trabajo = (extra: Partial<TrabajoIpc> = {}): TrabajoIpc => ({
  id: 't1',
  cancionId: 'c1',
  paso: 'separacion',
  cola: 'pesada',
  comando: 'separar',
  estado: 'terminado',
  posicion: null,
  resultado: 'completado',
  error: null,
  progreso: null,
  ...extra
})

function montar(opciones: {
  plataforma: NodeJS.Platform
  enfocada?: boolean
  soportado?: boolean
  cancion?: Cancion | null
  lanza?: boolean
  enTanda?: () => boolean
  abrirResultado?: () => void
}) {
  let enfocada = opciones.enfocada ?? false
  const ventana: Ventana & {
    traer: ReturnType<typeof vi.fn>
    parpadear: ReturnType<typeof vi.fn>
  } = {
    enfocada: () => enfocada,
    parpadear: vi.fn<(activo: boolean) => void>(),
    traer: vi.fn<() => void>()
  } satisfies Ventana
  const avisos: AvisoTrabajoIpc[] = []
  const abrir: AbrirCancionIpc[] = []
  let notificacion: Arg | null = null
  const dock = { rebotar: vi.fn(), fijarInsignia: vi.fn() }
  const mostrar = vi.fn((n: Arg) => {
    if (opciones.lanza) throw new Error('boom')
    notificacion = n
  })
  const registrar = vi.fn()
  const servicio = new ServicioAvisos({
    plataforma: opciones.plataforma,
    ventana: () => ventana,
    notificador: { soportado: () => opciones.soportado ?? true, mostrar },
    dock,
    difundirAviso: (a) => avisos.push(a),
    difundirAbrir: (e) => abrir.push(e),
    obtenerCancion: () => (opciones.cancion === undefined ? sinLetra() : opciones.cancion),
    ...(opciones.abrirResultado ? { difundirAbrirResultado: opciones.abrirResultado } : {}),
    ...(opciones.enTanda ? { enTandaDeVarias: opciones.enTanda } : {}),
    registrar
  })
  return {
    servicio,
    ventana,
    avisos,
    abrir,
    dock,
    mostrar,
    registrar,
    enfocar: () => (enfocada = true),
    notificacion: () => notificacion
  }
}

describe('avisoDeTrabajo', () => {
  const obtener = (c: Cancion | null) => () => c
  it('separación completada: ok; lista si cumple las condiciones', () => {
    const t = sinLetra().metadatos.titulo
    expect(avisoDeTrabajo(trabajo(), obtener(sinLetra()))).toEqual({
      cancionId: 'c1',
      tipo: 'ok',
      texto: `«${t}»: voz e instrumental separadas.`,
      etiqueta: 'Abrir',
      destino: 'progreso'
    })
    const l = avisoDeTrabajo(trabajo(), obtener(lista()))
    expect(l).toMatchObject({ tipo: 'lista', etiqueta: 'Abrir editor', destino: 'editor' })
    expect(l?.texto).toBe(`«${lista().metadatos.titulo}» ya se puede marcar como lista.`)
  })
  it('D7: con la preparación en marcha no avisa «ya se puede marcar como lista» (la preparación avisa)', () => {
    const c = { ...lista(), preparacion: { estado: 'en_curso' } } as unknown as Cancion
    expect(avisoDeTrabajo(trabajo(), obtener(c))).toBeNull()
    // Sin letra completa no es «lista»: la separación avisa «voz e instrumental separadas» como siempre.
    const sinLetraEnCurso = {
      ...sinLetra(),
      preparacion: { estado: 'en_curso' }
    } as unknown as Cancion
    expect(avisoDeTrabajo(trabajo(), obtener(sinLetraEnCurso))).toMatchObject({ tipo: 'ok' })
    expect(avisoDeTrabajo(trabajo(), obtener(lista()))).toMatchObject({ tipo: 'lista' })
  })

  it('error: título del error sin oferta de Rápido', () => {
    const a = avisoDeTrabajo(
      trabajo({
        resultado: 'error',
        error: { codigo: 'MEMORIA_INSUFICIENTE', mensaje: 'x' },
        modo: 'calidad'
      }),
      obtener(sinLetra())
    )
    expect(a).toMatchObject({ tipo: 'error', etiqueta: 'Ver', destino: 'progreso' })
    expect(a?.texto).toContain('Tu equipo no tiene memoria suficiente para el modelo Calidad.')
    expect(a?.texto).not.toMatch(/Rápido|rapido/)
  })
  it('error de descarga usa los títulos de la descarga', () => {
    const a = avisoDeTrabajo(
      trabajo({
        paso: 'fuente',
        resultado: 'error',
        error: { codigo: 'SIN_CONEXION', mensaje: 'x' }
      }),
      obtener(sinLetra())
    )
    expect(a?.texto).toMatch(/: Sin conexión a internet\.$/)
  })
  it('cancelado, interrumpido, descarga completada, en curso o canción borrada: nada', () => {
    const o = obtener(sinLetra())
    expect(avisoDeTrabajo(trabajo({ resultado: 'cancelado' }), o)).toBeNull()
    expect(avisoDeTrabajo(trabajo({ resultado: 'interrumpido' }), o)).toBeNull()
    expect(avisoDeTrabajo(trabajo({ paso: 'fuente' }), o)).toBeNull()
    expect(avisoDeTrabajo(trabajo({ estado: 'en_curso', resultado: null }), o)).toBeNull()
    expect(avisoDeTrabajo(trabajo(), obtener(null))).toBeNull()
  })
})

describe('ServicioAvisos', () => {
  it('con foco: solo avisa al renderer (toast), sin notificación ni Dock', () => {
    const m = montar({ plataforma: 'win32', enfocada: true })
    m.servicio.alCambiarTrabajo(trabajo())
    expect(m.avisos).toHaveLength(1)
    expect(m.mostrar).not.toHaveBeenCalled()
    expect(m.ventana.parpadear).not.toHaveBeenCalled()
    expect(m.dock.rebotar).not.toHaveBeenCalled()
  })

  it.each(['win32', 'linux'] as const)(
    '%s sin foco: notificación con el mismo texto y parpadeo',
    (so) => {
      const m = montar({ plataforma: so })
      m.servicio.alCambiarTrabajo(trabajo())
      expect(m.mostrar.mock.calls[0]![0]).toMatchObject({ cuerpo: m.avisos[0]!.texto })
      expect(m.ventana.parpadear).toHaveBeenCalledWith(true)
      expect(m.dock.rebotar).not.toHaveBeenCalled()
    }
  )

  it('el clic trae la ventana y abre la canción', () => {
    const m = montar({ plataforma: 'linux', cancion: lista() })
    m.servicio.alCambiarTrabajo(trabajo())
    m.notificacion()!.alClic()
    expect(m.ventana.traer).toHaveBeenCalled()
    expect(m.abrir).toEqual([{ cancionId: 'c1', destino: 'editor' }])
  })

  it('sin servicio de notificaciones o con `failed` o con excepción: solo parpadeo, sin error visible', () => {
    const a = montar({ plataforma: 'linux', soportado: false })
    a.servicio.alCambiarTrabajo(trabajo())
    expect(a.mostrar).not.toHaveBeenCalled()
    expect(a.ventana.parpadear).toHaveBeenCalledWith(true)

    const b = montar({ plataforma: 'win32' })
    b.servicio.alCambiarTrabajo(trabajo())
    expect(() => b.notificacion()!.alFallar()).not.toThrow()
    expect(b.registrar).toHaveBeenCalled()

    const c = montar({ plataforma: 'win32', lanza: true })
    expect(() => c.servicio.alCambiarTrabajo(trabajo())).not.toThrow()
    expect(c.ventana.parpadear).toHaveBeenCalledWith(true)
  })

  it('macOS sin foco: rebote e insignia con el número de avisos, sin notificación nativa', () => {
    const m = montar({ plataforma: 'darwin' })
    m.servicio.alCambiarTrabajo(trabajo())
    m.servicio.alCambiarTrabajo(
      trabajo({ resultado: 'error', error: { codigo: 'X', mensaje: 'x' } })
    )
    expect(m.dock.rebotar).toHaveBeenCalledTimes(2)
    expect(m.dock.fijarInsignia.mock.calls.map((c) => c[0])).toEqual(['1', '2'])
    expect(m.mostrar).not.toHaveBeenCalled()
    expect(m.ventana.parpadear).not.toHaveBeenCalled()
  })

  it('recuperar el foco borra insignia y parpadeo', () => {
    const mac = montar({ plataforma: 'darwin' })
    mac.servicio.alCambiarTrabajo(trabajo())
    mac.servicio.alRecuperarFoco()
    expect(mac.dock.fijarInsignia).toHaveBeenLastCalledWith('')

    const win = montar({ plataforma: 'win32' })
    win.servicio.alCambiarTrabajo(trabajo())
    win.servicio.alRecuperarFoco()
    expect(win.ventana.parpadear).toHaveBeenLastCalledWith(false)
    // Sin avisos pendientes no hay nada que limpiar.
    win.ventana.parpadear.mockClear()
    win.servicio.alRecuperarFoco()
    expect(win.ventana.parpadear).not.toHaveBeenCalled()
  })

  it('los trabajos cancelados no avisan', () => {
    const m = montar({ plataforma: 'darwin' })
    m.servicio.alCambiarTrabajo(trabajo({ resultado: 'cancelado' }))
    expect(m.avisos).toHaveLength(0)
    expect(m.dock.rebotar).not.toHaveBeenCalled()
  })
})

describe('tanda de varias canciones (0309)', () => {
  it('no avisa por canción dentro de una tanda y avisa una sola vez al terminar', () => {
    let enTanda = true
    const m = montar({ plataforma: 'win32', enTanda: () => enTanda })
    m.servicio.alCambiarTrabajo(trabajo())
    m.servicio.alCambiarTrabajo(
      trabajo({ resultado: 'error', error: { codigo: 'SIN_ESPACIO', mensaje: '' } })
    )
    expect(m.avisos).toHaveLength(0)
    expect(m.mostrar).not.toHaveBeenCalled()
    enTanda = false
    m.servicio.avisarTanda({ total: 12, listas: 9, esperanLetra: 2, conError: 1 })
    expect(m.avisos).toEqual([
      expect.objectContaining({
        tipo: 'tanda',
        destino: 'biblioteca',
        texto: '12 canciones preparadas: 9 listas para revisar · 2 esperan letra · 1 con error.'
      })
    ])
    expect(m.mostrar).toHaveBeenCalledTimes(1)
    // Fuera de una tanda, el aviso por canción de siempre.
    m.servicio.alCambiarTrabajo(trabajo())
    expect(m.avisos).toHaveLength(2)
  })

  it('el clic en la notificación de una tanda abre el resultado y no una canción', () => {
    const abrirResultado = vi.fn()
    const m = montar({ plataforma: 'win32', abrirResultado })
    m.servicio.avisarTanda({ total: 2, listas: 1, esperanLetra: 1, conError: 0 })
    m.notificacion()!.alClic()
    expect(m.ventana.traer).toHaveBeenCalled()
    expect(abrirResultado).toHaveBeenCalledOnce()
    expect(m.abrir).toEqual([])
  })

  it('si todas están listas, el texto lo dice así', () => {
    const m = montar({ plataforma: 'win32', enfocada: true })
    m.servicio.avisarTanda({ total: 3, listas: 3, esperanLetra: 0, conError: 0 })
    expect(m.avisos[0]!.texto).toBe('3 canciones listas para revisar.')
  })
})

describe('fin de la preparación de una canción', () => {
  const cambio = (estado: string) => ({
    id: 'c1',
    resumen: { titulo: 'Eco de Plata', estadoPreparacion: estado }
  })

  it('sin foco notifica con el texto del toast y el clic abre la canción; sin toast propio', () => {
    const m = montar({ plataforma: 'win32' })
    m.servicio.alCambiarCancion(cambio('preparando'))
    expect(m.mostrar).not.toHaveBeenCalled()
    m.servicio.alCambiarCancion(cambio('lista_para_revisar'))
    expect(m.notificacion()!.cuerpo).toBe('«Eco de Plata» está lista para revisar.')
    expect(m.avisos).toHaveLength(0)
    m.notificacion()!.alClic()
    expect(m.abrir).toEqual([{ cancionId: 'c1', destino: 'editor' }])
  })

  it('con foco, dentro de una tanda o sin haber estado preparando no notifica', () => {
    const enfocada = montar({ plataforma: 'win32', enfocada: true })
    enfocada.servicio.alCambiarCancion(cambio('preparando'))
    enfocada.servicio.alCambiarCancion(cambio('lista_para_revisar'))
    expect(enfocada.mostrar).not.toHaveBeenCalled()
    const tanda = montar({ plataforma: 'win32', enTanda: () => true })
    tanda.servicio.alCambiarCancion(cambio('preparando'))
    tanda.servicio.alCambiarCancion(cambio('lista_para_revisar'))
    expect(tanda.mostrar).not.toHaveBeenCalled()
    const suelta = montar({ plataforma: 'win32' })
    suelta.servicio.alCambiarCancion(cambio('lista_para_revisar'))
    expect(suelta.mostrar).not.toHaveBeenCalled()
  })
})

describe('avisarSistema (0237)', () => {
  it('sin foco notifica y parpadea, sin evento al renderer', () => {
    const m = montar({ plataforma: 'win32' })
    m.servicio.avisarSistema('«Mi canción»: video exportado.')
    expect(m.avisos).toEqual([])
    expect(m.ventana.parpadear).toHaveBeenCalledWith(true)
    expect(m.notificacion()?.cuerpo).toBe('«Mi canción»: video exportado.')
    m.notificacion()?.alClic()
    expect(m.ventana.traer).toHaveBeenCalled()
    expect(m.abrir).toEqual([])
  })

  it('con foco no hace nada; en macOS rebota el Dock', () => {
    const con = montar({ plataforma: 'linux', enfocada: true })
    con.servicio.avisarSistema('x')
    expect(con.mostrar).not.toHaveBeenCalled()
    const mac = montar({ plataforma: 'darwin' })
    mac.servicio.avisarSistema('x')
    expect(mac.dock.rebotar).toHaveBeenCalled()
    expect(mac.dock.fijarInsignia).toHaveBeenCalledWith('1')
  })
})
