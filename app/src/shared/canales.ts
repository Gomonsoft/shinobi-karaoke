/**
 * Nombres de los canales IPC (0011). Archivo sin dependencias: el preload (con
 * sandbox) solo importa este módulo. El contrato completo está en `ipc.ts`.
 */
export const CANALES = {
  biblioteca: {
    listar: 'biblioteca:listar',
    obtener: 'biblioteca:obtener',
    actualizarMetadatos: 'biblioteca:actualizarMetadatos',
    // Guardado y estado de la canción desde el editor (0090).
    guardarEstilo: 'biblioteca:guardarEstilo',
    marcarLista: 'biblioteca:marcarLista',
    comprobarPistas: 'biblioteca:comprobarPistas',
    volverABorrador: 'biblioteca:volverABorrador',
    eliminar: 'biblioteca:eliminar',
    mostrarEnCarpeta: 'biblioteca:mostrarEnCarpeta'
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
    abrirCancion: 'app:abrirCancion'
  }
} as const
