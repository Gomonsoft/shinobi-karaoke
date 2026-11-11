/**
 * Nombres de los canales IPC (0011). Archivo sin dependencias: el preload (con
 * sandbox) solo importa este módulo. El contrato completo está en `ipc.ts`.
 */
export const CANALES = {
  biblioteca: {
    listar: 'biblioteca:listar',
    obtener: 'biblioteca:obtener',
    actualizarMetadatos: 'biblioteca:actualizarMetadatos',
    // Guardado y estado de la canción desde el editor (0090). Sustituye a `guardarEstilo` (0164).
    guardarApariencia: 'biblioteca:guardarApariencia',
    marcarLista: 'biblioteca:marcarLista',
    comprobarPistas: 'biblioteca:comprobarPistas',
    volverABorrador: 'biblioteca:volverABorrador',
    eliminar: 'biblioteca:eliminar',
    mostrarEnCarpeta: 'biblioteca:mostrarEnCarpeta'
  },
  /** Catálogo de temas y operaciones sobre la apariencia (ADR 0016, 0164). */
  temas: {
    catalogo: 'temas:catalogo',
    previsualizar: 'temas:previsualizar',
    ejecutar: 'temas:ejecutar',
    crear: 'temas:crear',
    renombrar: 'temas:renombrar',
    duplicar: 'temas:duplicar',
    reanudarBorrado: 'temas:reanudarBorrado',
    cancelarBorrado: 'temas:cancelarBorrado',
    descartarAvisoApartado: 'temas:descartarAvisoApartado'
  },
  /** Pantallas del sistema para la ventana secundaria (ADR 0017 §2). */
  pantallas: {
    listar: 'pantallas:listar'
  },
  /** Sesión en vivo en la ventana secundaria (ADR 0017 §7, §8 y §11). */
  sesion: {
    estado: 'sesion:estado',
    abrir: 'sesion:abrir',
    mostrar: 'sesion:mostrar',
    moverAPantalla: 'sesion:moverAPantalla',
    fijarPantallaCompleta: 'sesion:fijarPantallaCompleta',
    transporte: 'sesion:transporte',
    siguiente: 'sesion:siguiente',
    empezar: 'sesion:empezar',
    detenerTransicion: 'sesion:detenerTransicion',
    repetir: 'sesion:repetir',
    forzarCierre: 'sesion:forzarCierre',
    solicitarCierre: 'sesion:solicitarCierre',
    confirmarCierre: 'sesion:confirmarCierre',
    cancelarCierre: 'sesion:cancelarCierre',
    /** Solo secundaria. */
    inicial: 'sesion:inicial',
    informar: 'sesion:informar',
    preferencias: 'sesion:preferencias',
    guardarPreferencias: 'sesion:guardarPreferencias'
  },
  /** Cola de reproducción (ADR 0017 §6). */
  cola: {
    agregar: 'cola:agregar',
    mover: 'cola:mover',
    quitar: 'cola:quitar',
    vaciar: 'cola:vaciar'
  },
  ventana: {
    modoReproductor: 'ventana:modoReproductor',
    fijarPantallaCompleta: 'ventana:fijarPantallaCompleta',
    estaEnPantallaCompleta: 'ventana:estaEnPantallaCompleta',
    evitarReposo: 'ventana:evitarReposo'
  },
  config: {
    obtener: 'config:obtener',
    actualizar: 'config:actualizar'
  },
  sistema: {
    info: 'sistema:info',
    abrirEnlace: 'sistema:abrirEnlace',
    textoLegal: 'sistema:textoLegal',
    abrirCarpetaDatos: 'sistema:abrirCarpetaDatos',
    elegirArchivoAudio: 'sistema:elegirArchivoAudio'
  },
  fuente: {
    importarArchivo: 'fuente:importarArchivo',
    cancelarImportacion: 'fuente:cancelarImportacion',
    confirmarArchivo: 'fuente:confirmarArchivo',
    descartarImportacion: 'fuente:descartarImportacion',
    infoYoutube: 'fuente:infoYoutube',
    cancelarInfo: 'fuente:cancelarInfo',
    confirmarYoutube: 'fuente:confirmarYoutube',
    reintentar: 'fuente:reintentar'
  },
  runtime: {
    estado: 'runtime:estado',
    requisitos: 'runtime:requisitos',
    instalar: 'runtime:instalar',
    pausar: 'runtime:pausar',
    detalles: 'runtime:detalles',
    estimarSeparacion: 'runtime:estimarSeparacion',
    /** Consentimiento y descarga del modelo Rápido (0057): la única vía que lo descarga. */
    aceptarYUsarRapido: 'runtime:aceptarYUsarRapido',
    volverACalidad: 'runtime:volverACalidad',
    cancelarVolverACalidad: 'runtime:cancelarVolverACalidad'
  },
  app: {
    // El editor tiene cambios sin escribir (0090).
    guardadoPendiente: 'app:guardadoPendiente',
    /** El renderer confirma el cierre pedido por `eventos.solicitudCierre` (0036). */
    confirmarCierre: 'app:confirmarCierre',
    /** Sale de la aplicación (`app.quit()`), también en macOS donde cerrar la ventana no basta. */
    salir: 'app:salir'
  },
  trabajos: {
    listar: 'trabajos:listar',
    cancelar: 'trabajos:cancelar',
    hayPendientes: 'trabajos:hayPendientes'
  },
  separacion: {
    /** "Separar ahora", "Reintentar" y "Re-separar pistas" (0059; reglas de aceptación en 0065). */
    separar: 'separacion:separar',
    /** Estimación previa en minutos de una canción (0067). */
    estimar: 'separacion:estimar'
  },
  picos: {
    solicitar: 'picos:solicitar',
    leer: 'picos:leer'
  },
  letras: {
    // Cambia los tiempos y el desplazamiento sin cambiar el texto (0090).
    guardarTiempos: 'letras:guardarTiempos',
    // Referencia de visita para restaurar tiempos (0091, 0027).
    abrirEdicion: 'letras:abrirEdicion',
    cerrarEdicion: 'letras:cerrarEdicion',
    /** Búsqueda en LRCLIB (0082). */
    buscar: 'letras:buscar',
    /** Sustituye la letra entera (0083). */
    guardar: 'letras:guardar',
    /** Aplica el diff del texto sobre la letra guardada (0083). */
    editarTexto: 'letras:editarTexto',
    /** Diálogo nativo `.lrc`/`.txt`; no guarda (0083). */
    leerArchivo: 'letras:leerArchivo'
  },
  eventos: {
    cancion: 'evento:cancion',
    /** El catálogo de temas cambió; lleva el catálogo completo (0164). */
    temasCambiado: 'temas:cambiado',
    /** Progreso de una operación de varias canciones, ≤ 10 por segundo (0164). */
    temasProgreso: 'temas:progreso',
    config: 'evento:config',
    pantallaCompleta: 'ventana:pantallaCompleta',
    /** Cambio de estado o de posición en la cola de un trabajo (0014). */
    trabajo: 'trabajo:cambio',
    /** Progreso de un trabajo, ≤ 4 por segundo y trabajo (0014). */
    trabajoProgreso: 'trabajo:progreso',
    menu: 'evento:menu',
    /** Progreso de la instalación del runtime, ≤ 4 por segundo (0036). */
    runtimeProgreso: 'runtime:progreso',
    /** Cambio de fase, estado o error del runtime (0036). */
    runtimeCambio: 'runtime:cambio',
    /** Main pide confirmar el cierre con una instalación en curso (0036). */
    solicitudCierre: 'app:solicitudCierre',
    /** La consulta de YouTube espera o provoca una actualización de yt-dlp (0050). */
    estadoInfo: 'fuente:estadoInfo',
    /** Un trabajo terminó o falló: el renderer decide si muestra el toast (0072). */
    avisoTrabajo: 'trabajo:aviso',
    /** Clic en la notificación del sistema: abrir la canción (0072). */
    abrirCancion: 'app:abrirCancion',
    /** Estado de la sesión y la cola, solo a la principal (ADR 0017 §11). */
    sesionEstado: 'sesion:estado',
    /** Posición de la canción activa, ≤ 1 por segundo, solo a la principal. */
    sesionPosicion: 'sesion:posicion',
    /** Cambió la lista de pantallas, solo a la principal. */
    pantallasCambiadas: 'pantallas:cambiadas',
    /** Comando dirigido a la secundaria. */
    sesionComando: 'sesion:comando',
    /** Estado reducido, solo a la secundaria. */
    sesionEstadoSecundaria: 'sesion:estadoSecundaria',
    /** Cambió `config.reproductor`, solo a la secundaria. */
    sesionPreferencias: 'sesion:preferencias'
  }
} as const

/** Rol de una ventana de la app (ADR 0017 §1); lo asigna main, nunca el renderer. */
export type RolVentana = 'principal' | 'secundaria'

type Valores<T> = T[keyof T]
/** Nombres de todos los canales invocables (todos los grupos de `CANALES` salvo `eventos`). */
export type NombreCanalInvocable = Valores<{
  [K in Exclude<keyof typeof CANALES, 'eventos'>]: Valores<(typeof CANALES)[K]>
}>

const PRINCIPAL: readonly RolVentana[] = ['principal']
const SECUNDARIA: readonly RolVentana[] = ['secundaria']
const AMBAS: readonly RolVentana[] = ['principal', 'secundaria']

/**
 * Roles permitidos en cada canal invocable (ADR 0017 §11). El tipo obliga a declarar todos; una prueba
 * comprueba además que coincide con `CONTRATO`.
 */
export const ROLES_POR_CANAL: Record<NombreCanalInvocable, readonly RolVentana[]> = {
  [CANALES.biblioteca.listar]: PRINCIPAL,
  [CANALES.biblioteca.obtener]: PRINCIPAL,
  [CANALES.biblioteca.actualizarMetadatos]: PRINCIPAL,
  [CANALES.biblioteca.guardarApariencia]: PRINCIPAL,
  [CANALES.biblioteca.marcarLista]: PRINCIPAL,
  [CANALES.biblioteca.comprobarPistas]: PRINCIPAL,
  [CANALES.biblioteca.volverABorrador]: PRINCIPAL,
  [CANALES.biblioteca.eliminar]: PRINCIPAL,
  [CANALES.biblioteca.mostrarEnCarpeta]: PRINCIPAL,
  [CANALES.temas.catalogo]: PRINCIPAL,
  [CANALES.temas.previsualizar]: PRINCIPAL,
  [CANALES.temas.ejecutar]: PRINCIPAL,
  [CANALES.temas.crear]: PRINCIPAL,
  [CANALES.temas.renombrar]: PRINCIPAL,
  [CANALES.temas.duplicar]: PRINCIPAL,
  [CANALES.temas.reanudarBorrado]: PRINCIPAL,
  [CANALES.temas.cancelarBorrado]: PRINCIPAL,
  [CANALES.temas.descartarAvisoApartado]: PRINCIPAL,
  [CANALES.ventana.modoReproductor]: PRINCIPAL,
  [CANALES.ventana.fijarPantallaCompleta]: AMBAS,
  [CANALES.ventana.estaEnPantallaCompleta]: AMBAS,
  [CANALES.ventana.evitarReposo]: PRINCIPAL,
  [CANALES.config.obtener]: PRINCIPAL,
  [CANALES.config.actualizar]: PRINCIPAL,
  [CANALES.sistema.info]: PRINCIPAL,
  [CANALES.sistema.abrirEnlace]: PRINCIPAL,
  [CANALES.sistema.textoLegal]: PRINCIPAL,
  [CANALES.sistema.abrirCarpetaDatos]: PRINCIPAL,
  [CANALES.sistema.elegirArchivoAudio]: PRINCIPAL,
  [CANALES.fuente.importarArchivo]: PRINCIPAL,
  [CANALES.fuente.cancelarImportacion]: PRINCIPAL,
  [CANALES.fuente.confirmarArchivo]: PRINCIPAL,
  [CANALES.fuente.descartarImportacion]: PRINCIPAL,
  [CANALES.fuente.infoYoutube]: PRINCIPAL,
  [CANALES.fuente.cancelarInfo]: PRINCIPAL,
  [CANALES.fuente.confirmarYoutube]: PRINCIPAL,
  [CANALES.fuente.reintentar]: PRINCIPAL,
  [CANALES.runtime.estado]: PRINCIPAL,
  [CANALES.runtime.requisitos]: PRINCIPAL,
  [CANALES.runtime.instalar]: PRINCIPAL,
  [CANALES.runtime.pausar]: PRINCIPAL,
  [CANALES.runtime.detalles]: PRINCIPAL,
  [CANALES.runtime.estimarSeparacion]: PRINCIPAL,
  [CANALES.runtime.aceptarYUsarRapido]: PRINCIPAL,
  [CANALES.runtime.volverACalidad]: PRINCIPAL,
  [CANALES.runtime.cancelarVolverACalidad]: PRINCIPAL,
  [CANALES.app.guardadoPendiente]: PRINCIPAL,
  [CANALES.app.confirmarCierre]: PRINCIPAL,
  [CANALES.app.salir]: PRINCIPAL,
  [CANALES.trabajos.listar]: PRINCIPAL,
  [CANALES.trabajos.cancelar]: PRINCIPAL,
  [CANALES.trabajos.hayPendientes]: PRINCIPAL,
  [CANALES.separacion.separar]: PRINCIPAL,
  [CANALES.separacion.estimar]: PRINCIPAL,
  [CANALES.picos.solicitar]: PRINCIPAL,
  [CANALES.picos.leer]: PRINCIPAL,
  [CANALES.letras.guardarTiempos]: PRINCIPAL,
  [CANALES.letras.abrirEdicion]: PRINCIPAL,
  [CANALES.letras.cerrarEdicion]: PRINCIPAL,
  [CANALES.letras.buscar]: PRINCIPAL,
  [CANALES.letras.guardar]: PRINCIPAL,
  [CANALES.letras.editarTexto]: PRINCIPAL,
  [CANALES.letras.leerArchivo]: PRINCIPAL,
  [CANALES.pantallas.listar]: PRINCIPAL,
  [CANALES.sesion.estado]: PRINCIPAL,
  [CANALES.sesion.abrir]: PRINCIPAL,
  [CANALES.sesion.mostrar]: PRINCIPAL,
  [CANALES.sesion.moverAPantalla]: PRINCIPAL,
  [CANALES.sesion.fijarPantallaCompleta]: PRINCIPAL,
  [CANALES.sesion.transporte]: PRINCIPAL,
  [CANALES.sesion.siguiente]: AMBAS,
  [CANALES.sesion.empezar]: AMBAS,
  [CANALES.sesion.detenerTransicion]: AMBAS,
  [CANALES.sesion.repetir]: AMBAS,
  [CANALES.sesion.forzarCierre]: PRINCIPAL,
  [CANALES.sesion.solicitarCierre]: AMBAS,
  [CANALES.sesion.confirmarCierre]: AMBAS,
  [CANALES.sesion.cancelarCierre]: AMBAS,
  [CANALES.sesion.inicial]: SECUNDARIA,
  [CANALES.sesion.informar]: SECUNDARIA,
  [CANALES.sesion.preferencias]: SECUNDARIA,
  [CANALES.sesion.guardarPreferencias]: SECUNDARIA,
  [CANALES.cola.agregar]: PRINCIPAL,
  [CANALES.cola.mover]: PRINCIPAL,
  [CANALES.cola.quitar]: PRINCIPAL,
  [CANALES.cola.vaciar]: PRINCIPAL
}
