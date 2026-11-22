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
    mostrarEnCarpeta: 'biblioteca:mostrarEnCarpeta',
    /** 0.2.2 (ADR 0025 §6): artistas y álbumes existentes con su clave, del índice en memoria. */
    valoresDatos: 'biblioteca:valoresDatos',
    /** 0.2.2 (ADR 0026 §4): acciones por lotes con el patrón previsualizar / ejecutar. */
    editarDatosVariasPrevisualizar: 'biblioteca:editarDatosVariasPrevisualizar',
    editarDatosVariasEjecutar: 'biblioteca:editarDatosVariasEjecutar',
    eliminarVariasPrevisualizar: 'biblioteca:eliminarVariasPrevisualizar',
    eliminarVariasEjecutar: 'biblioteca:eliminarVariasEjecutar'
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
    guardarPreferencias: 'sesion:guardarPreferencias',
    /** 0.2.2 (ADR 0026 §4): «A la cola» de varias canciones y su deshacer. */
    colaAnadirVarias: 'sesion:colaAnadirVarias',
    colaQuitarVarias: 'sesion:colaQuitarVarias'
  },
  /** Cola de reproducción (ADR 0017 §6). */
  cola: {
    agregar: 'cola:agregar',
    mover: 'cola:mover',
    quitar: 'cola:quitar',
    vaciar: 'cola:vaciar'
  },
  /** Exportación de video (ADR 0019 §10). `inicial` y `listo` son solo de la ventana de exportación. */
  exportacion: {
    perfiles: 'exportacion:perfiles',
    estimar: 'exportacion:estimar',
    destinoPropuesto: 'exportacion:destinoPropuesto',
    elegirDestino: 'exportacion:elegirDestino',
    iniciar: 'exportacion:iniciar',
    cancelar: 'exportacion:cancelar',
    estado: 'exportacion:estado',
    mostrarEnCarpeta: 'exportacion:mostrarEnCarpeta',
    avisosPendientes: 'exportacion:avisosPendientes',
    /** Solo ventana de exportación. */
    inicial: 'exportacion:inicial',
    listo: 'exportacion:listo',
    /** 0.2.2 (ADR 0026 §5): exportar varias canciones a una carpeta. */
    destinoCarpeta: 'exportacion:destinoCarpeta',
    iniciarLote: 'exportacion:iniciarLote',
    cancelarLote: 'exportacion:cancelarLote',
    reintentarLote: 'exportacion:reintentarLote'
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
    reintentar: 'fuente:reintentar',
    /** 0.2.2 (ADR 0026 §1 y §2): lectura del lote (sin ruta: diálogo del sistema) y su confirmación. */
    leerArchivos: 'fuente:leerArchivos',
    leerCarpeta: 'fuente:leerCarpeta',
    infoLista: 'fuente:infoLista',
    lote: 'fuente:lote'
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
    /** Solo el texto de una línea, conservando id y tiempos (0283, ADR 0021 §7). */
    editarTextoLinea: 'letras:editarTextoLinea',
    /** Diálogo nativo `.lrc`/`.txt`; no guarda (0083). */
    leerArchivo: 'letras:leerArchivo',
    /** 0.2.2 (ADR 0025 §7): texto de un candidato guardado por su id de LRCLIB. */
    candidatoPorId: 'letras:candidatoPorId',
    /** 0.2.2 (ADR 0027 §4): exportar la letra a `.lrc`. */
    exportarLrc: 'letras:exportarLrc',
    exportarLrcVarias: 'letras:exportarLrcVarias'
  },
  /** Aviso de versión nueva (ADR 0023 §4). */
  actualizaciones: {
    estado: 'actualizaciones:estado',
    comprobar: 'actualizaciones:comprobar',
    marcarVista: 'actualizaciones:marcarVista'
  },
  /** Preparación desatendida y su cola (ADR 0025 §5 y §7). */
  preparacion: {
    previsualizar: 'preparacion:previsualizar',
    preparar: 'preparacion:preparar',
    pausar: 'preparacion:pausar',
    reanudar: 'preparacion:reanudar',
    reintentarFallidas: 'preparacion:reintentarFallidas',
    tanda: 'preparacion:tanda',
    cancelar: 'preparacion:cancelar'
  },
  /** Paquetes de canción, copia de seguridad y restauración (ADR 0027 §6). */
  copias: {
    exportarCanciones: 'copias:exportarCanciones',
    exportarBiblioteca: 'copias:exportarBiblioteca',
    destinoPropuesto: 'copias:destinoPropuesto',
    elegirDestino: 'copias:elegirDestino',
    elegirOrigen: 'copias:elegirOrigen',
    leer: 'copias:leer',
    importar: 'copias:importar',
    cancelar: 'copias:cancelar'
  },
  /**
   * Sincronía con la voz (ADR 0028 §3). El ADR no fija los nombres de estos canales: propuestos en la
   * pregunta 0166, a confirmar por el arquitecto.
   */
  alineacion: {
    estado: 'alineacion:estado',
    descargarModelo: 'alineacion:descargarModelo',
    cancelarDescarga: 'alineacion:cancelarDescarga',
    quitarModelo: 'alineacion:quitarModelo',
    previsualizar: 'alineacion:previsualizar',
    alinear: 'alineacion:alinear',
    cancelar: 'alineacion:cancelar'
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
    sesionPreferencias: 'sesion:preferencias',
    /** Alta, posición, estado y resultado de una exportación, solo a la principal (ADR 0019 §10). */
    exportacionCambio: 'exportacion:cambio',
    /** Progreso de la exportación, ≤ 4 por segundo, solo a la principal. */
    exportacionProgreso: 'exportacion:progreso',
    /** Aviso de arranque (interrumpida, limpieza fallida), solo a la principal (0132). */
    exportacionAviso: 'exportacion:aviso',
    /** Pide pintar el fotograma `n`, solo a la ventana de exportación. */
    exportacionFotograma: 'exportacion:fotograma',
    /** El aviso de versión cambió (ADR 0023 §4), solo a la principal. */
    actualizacionesCambio: 'actualizaciones:cambio',
    /** Cambio de estado o paso de la preparación de una canción (ADR 0025 §7). */
    preparacionCambio: 'preparacion:cambio',
    /** Estado de la tanda de la cola de preparación (ADR 0025 §5). */
    preparacionTanda: 'preparacion:tanda',
    /** Se reanudó trabajo pendiente al abrir (ADR 0025 §5). */
    preparacionReanudada: 'preparacion:reanudada',
    /** Encajes de los candidatos cuando los picos terminan (ADR 0024 §2). */
    letrasEncaje: 'letras:encaje',
    /** Avance `{ hechas, total }` de una acción por lotes de la Biblioteca (ADR 0026 §4). */
    bibliotecaProgresoLote: 'biblioteca:progresoLote',
    /** Alta, estado y resultado de un paquete o una copia (ADR 0027 §2). */
    copiasCambio: 'copias:cambio',
    /** Progreso de un paquete o una copia (ADR 0027 §2). */
    copiasProgreso: 'copias:progreso',
    /** Progreso de la alineación y de la descarga de modelos (ADR 0028 §3.2). */
    alineacionProgreso: 'alineacion:progreso'
  }
} as const

/** Rol de una ventana de la app (ADR 0017 §1); lo asigna main, nunca el renderer. */
export type RolVentana = 'principal' | 'secundaria' | 'exportacion'

type Valores<T> = T[keyof T]
/** Nombres de todos los canales invocables (todos los grupos de `CANALES` salvo `eventos`). */
export type NombreCanalInvocable = Valores<{
  [K in Exclude<keyof typeof CANALES, 'eventos'>]: Valores<(typeof CANALES)[K]>
}>

const PRINCIPAL: readonly RolVentana[] = ['principal']
const SECUNDARIA: readonly RolVentana[] = ['secundaria']
const EXPORTACION: readonly RolVentana[] = ['exportacion']
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
  [CANALES.exportacion.perfiles]: PRINCIPAL,
  [CANALES.exportacion.estimar]: PRINCIPAL,
  [CANALES.exportacion.destinoPropuesto]: PRINCIPAL,
  [CANALES.exportacion.elegirDestino]: PRINCIPAL,
  [CANALES.exportacion.iniciar]: PRINCIPAL,
  [CANALES.exportacion.cancelar]: PRINCIPAL,
  [CANALES.exportacion.estado]: PRINCIPAL,
  [CANALES.exportacion.mostrarEnCarpeta]: PRINCIPAL,
  [CANALES.exportacion.avisosPendientes]: PRINCIPAL,
  [CANALES.exportacion.inicial]: EXPORTACION,
  [CANALES.exportacion.listo]: EXPORTACION,
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
  [CANALES.letras.editarTextoLinea]: PRINCIPAL,
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
  [CANALES.cola.vaciar]: PRINCIPAL,
  [CANALES.biblioteca.valoresDatos]: PRINCIPAL,
  [CANALES.biblioteca.editarDatosVariasPrevisualizar]: PRINCIPAL,
  [CANALES.biblioteca.editarDatosVariasEjecutar]: PRINCIPAL,
  [CANALES.biblioteca.eliminarVariasPrevisualizar]: PRINCIPAL,
  [CANALES.biblioteca.eliminarVariasEjecutar]: PRINCIPAL,
  [CANALES.sesion.colaAnadirVarias]: PRINCIPAL,
  [CANALES.sesion.colaQuitarVarias]: PRINCIPAL,
  [CANALES.exportacion.destinoCarpeta]: PRINCIPAL,
  [CANALES.exportacion.iniciarLote]: PRINCIPAL,
  [CANALES.exportacion.cancelarLote]: PRINCIPAL,
  [CANALES.exportacion.reintentarLote]: PRINCIPAL,
  [CANALES.fuente.leerArchivos]: PRINCIPAL,
  [CANALES.fuente.leerCarpeta]: PRINCIPAL,
  [CANALES.fuente.infoLista]: PRINCIPAL,
  [CANALES.fuente.lote]: PRINCIPAL,
  [CANALES.letras.candidatoPorId]: PRINCIPAL,
  [CANALES.letras.exportarLrc]: PRINCIPAL,
  [CANALES.letras.exportarLrcVarias]: PRINCIPAL,
  [CANALES.actualizaciones.estado]: PRINCIPAL,
  [CANALES.actualizaciones.comprobar]: PRINCIPAL,
  [CANALES.actualizaciones.marcarVista]: PRINCIPAL,
  [CANALES.preparacion.previsualizar]: PRINCIPAL,
  [CANALES.preparacion.preparar]: PRINCIPAL,
  [CANALES.preparacion.pausar]: PRINCIPAL,
  [CANALES.preparacion.reanudar]: PRINCIPAL,
  [CANALES.preparacion.reintentarFallidas]: PRINCIPAL,
  [CANALES.preparacion.tanda]: PRINCIPAL,
  [CANALES.preparacion.cancelar]: PRINCIPAL,
  [CANALES.copias.exportarCanciones]: PRINCIPAL,
  [CANALES.copias.exportarBiblioteca]: PRINCIPAL,
  [CANALES.copias.destinoPropuesto]: PRINCIPAL,
  [CANALES.copias.elegirDestino]: PRINCIPAL,
  [CANALES.copias.elegirOrigen]: PRINCIPAL,
  [CANALES.copias.leer]: PRINCIPAL,
  [CANALES.copias.importar]: PRINCIPAL,
  [CANALES.copias.cancelar]: PRINCIPAL,
  [CANALES.alineacion.estado]: PRINCIPAL,
  [CANALES.alineacion.descargarModelo]: PRINCIPAL,
  [CANALES.alineacion.cancelarDescarga]: PRINCIPAL,
  [CANALES.alineacion.quitarModelo]: PRINCIPAL,
  [CANALES.alineacion.previsualizar]: PRINCIPAL,
  [CANALES.alineacion.alinear]: PRINCIPAL,
  [CANALES.alineacion.cancelar]: PRINCIPAL
}
