/**
 * Textos de la fase 4 (docs/ux/02 «Microcopy (fase 4, biblioteca)» y docs/ux/06 «Microcopy
 * (fase 4, editor)»). Una clave por constante; las que llevan datos son funciones.
 * Los textos de «Ajustes» (`aj.rep.*`) viven en `vistas/ajustes/`.
 */

/** `mm:ss` de una posición en milisegundos. */
export function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const cancionesPendientes = (n: number): string =>
  n === 1 ? 'Queda 1 canción pendiente.' : `Quedan ${n} canciones pendientes.`

// --- Edición bloqueada (spec 06) -------------------------------------------

export const EDI_BLOQUEO = {
  titulo: 'No se puede editar mientras el reproductor está abierto en otra ventana',
  cuerpo:
    'Puedes seguir usando la biblioteca y la cola. Cuando cierres el reproductor podrás editar de nuevo.',
  cerrar: 'Cerrar el reproductor…',
  entendido: 'Entendido',
  /** Se añade al nombre accesible del elemento bloqueado. */
  aria: ', no disponible mientras el reproductor está abierto en otra ventana',
  escucha: 'No se puede escuchar mientras el reproductor está abierto en otra ventana.'
} as const

/** `paso.motivo.sesion`: tooltip de los pasos 3 y 4 del stepper. */
export const PASO_MOTIVO_SESION =
  'No se puede editar mientras el reproductor está abierto en otra ventana'

// --- Sesión: diálogo de apertura, cierre y recuperación ---------------------

export const SES = {
  abrir: 'Abrir en otra pantalla…',
  abrirAria: 'Abrir el reproductor en otra pantalla…',
  dialogoTitulo: 'Abrir el reproductor en otra pantalla',
  dialogoPantalla: 'Pantalla',
  /** `ses.pantalla.opcion`: «Pantalla {n} · {nombre} · {ancho} × {alto}» (sin nombre, sin ese tramo). */
  pantallaOpcion: (n: number, nombre: string | null, ancho: number, alto: number): string =>
    nombre
      ? `Pantalla ${n} · ${nombre} · ${ancho} × ${alto}`
      : `Pantalla ${n} · ${ancho} × ${alto}`,
  pantallaPrincipal: 'Principal',
  pantallaAqui: 'Aquí está esta ventana',
  pantallaDesaparecida: 'La pantalla que habías elegido se desconectó. Elige otra.',
  unaPantalla:
    'Solo hay una pantalla conectada. El reproductor se abrirá en una ventana aparte; si conectas otra pantalla, aparecerá en esta lista.',
  completa: 'Pantalla completa',
  completaMisma:
    'Cubrirá esta ventana. Para volver a ella usa Alt + Tab (Cmd + Tab en macOS), o pulsa F en el reproductor para verlo en una ventana.',
  audio: 'El sonido sale por la salida de audio de tu equipo, no por la pantalla elegida.',
  empieza: {
    conCola: (titulo: string, artista: string): string => `Empezará con «${titulo}» — ${artista}.`,
    vacia: 'La cola está vacía. Añade canciones con «A la cola» y empieza cuando quieras.',
    interrumpida: (titulo: string, ms: number): string => `Seguirá «${titulo}» desde ${mmss(ms)}.`,
    terminada: (titulo: string, siguiente: string): string =>
      `La última fue «${titulo}». Podrás empezar «${siguiente}» cuando quieras.`,
    terminadaSinPendientes: (titulo: string): string =>
      `La última fue «${titulo}». La cola está vacía.`,
    conCancion: (
      titulo: string,
      artista: string,
      pendientes: number,
      interrumpida: { titulo: string; ms: number } | null
    ): string =>
      `Empezará con «${titulo}» — ${artista}.` +
      (pendientes > 0 ? ` Después seguirán las ${pendientes} canciones de la cola.` : '') +
      (interrumpida
        ? ` «${interrumpida.titulo}» ya no seguirá desde ${mmss(interrumpida.ms)}.`
        : '')
  },
  wayland:
    'En este escritorio el sistema decide dónde se abre el reproductor. Arrástralo a la pantalla del público y pulsa F para verlo a pantalla completa.',
  pantallaDesconocida: 'En otra ventana',
  errorGuardando:
    'Aún se están guardando cambios de una canción. Espera un momento y vuelve a intentarlo.',
  reintentar: 'Reintentar',
  errorNoDisponible: (titulo: string): string =>
    `«${titulo}» ya no se puede reproducir. Elige otra canción.`,
  menuOtraPantalla: 'Reproducir en otra pantalla…',
  mover: 'Mover a…',
  bloqueoNota: 'Mientras el reproductor esté abierto no se podrán editar canciones.',
  boton: { cancelar: 'Cancelar', abrir: 'Abrir reproductor', abriendo: 'Abriendo…' },
  errorAbrir: 'No se pudo abrir el reproductor en esa pantalla. Vuelve a intentarlo o elige otra.',
  mostrar: 'Mostrar',
  menu: 'Más opciones del reproductor',
  cambiar: 'Cambiar de pantalla…',
  ventana: { completa: 'Pantalla completa', ventana: 'Ver en una ventana' },
  cerrar: 'Cerrar reproductor',
  ind: {
    enOtraPantalla: 'En otra pantalla',
    enPausa: 'En pausa',
    siguienteEn: (n: number): string => `Siguiente en ${n} s`,
    enEspera: 'En espera',
    atencion: 'Requiere atención',
    cola: (n: number): string => `Cola ${n}`,
    /** `ses.ind.aria`: nombre accesible del botón de la barra superior. */
    aria: (estado: string): string => `Reproductor en otra pantalla: ${estado}. Ir a la cola.`,
    ariaSinSesion: (n: number): string => `Cola: ${n} pendientes. Ir a la cola.`
  },
  cierre: {
    titulo: 'Hay canciones en cola',
    cuerpo: (n: number): string =>
      `${cancionesPendientes(n)} Si conservas la cola, podrás seguir donde lo dejaste al volver a abrir el reproductor. La cola se pierde al salir de Shinobi Karaoke.`,
    cancelar: 'Cancelar',
    eliminar: 'Cerrar y eliminar cola',
    conservar: 'Cerrar y conservar cola',
    esperando: 'Esperando tu respuesta en la otra pantalla para cerrar el reproductor…',
    obsoleto:
      'La cola cambió mientras confirmabas. Revisa cuántas canciones quedan y elige otra vez.'
  },
  anuncioConservada: 'Reproductor cerrado. La cola se ha conservado.',
  toastEliminada: 'Reproductor cerrado. Cola eliminada.',
  salir: {
    titulo: '¿Salir de Shinobi Karaoke?',
    cuerpo: 'El reproductor de la otra pantalla se cerrará y la cola se perderá.',
    cuerpoSinSesion: 'La cola se perderá.',
    cancelar: 'Cancelar',
    salir: 'Salir',
    tituloMac: '¿Cerrar la ventana?',
    cuerpoMac:
      'El reproductor de la otra pantalla se cerrará. La cola se conservará mientras Shinobi Karaoke siga abierto.',
    cerrar: 'Cerrar',
    /** `ses.salir.extra`: se añade a `cierre.cuerpo`. */
    extra: 'El reproductor de la otra pantalla se cerrará y la cola se perderá.'
  },
  rec: {
    monitor: (pantalla: string, nueva: string): string =>
      `Se desconectó «${pantalla}». El reproductor sigue sonando en una ventana en «${nueva}».`,
    vuelve: (pantalla: string): string => `«${pantalla}» vuelve a estar conectada.`,
    llevar: 'Llevar el reproductor allí',
    caida: (interrumpida: { titulo: string; ms: number } | null): string =>
      interrumpida
        ? `El reproductor se cerró de forma inesperada. Se conservó la cola y «${interrumpida.titulo}» seguirá desde ${mmss(interrumpida.ms)}.`
        : 'El reproductor se cerró de forma inesperada. Se conservó la cola.',
    volverAbrir: 'Volver a abrir',
    noResponde: 'El reproductor no responde. Si lo cierras, la cola se conserva.',
    esperar: 'Esperar',
    cerrarYAbrir: 'Cerrar y volver a abrir'
  }
} as const

// --- Cola (panel y toasts) --------------------------------------------------

const CAUSAS: Record<string, string> = {
  no_encontrada: 'Ya no está en la biblioteca.',
  no_lista: 'Ya no está lista: volvió a borrador.',
  sin_pistas: 'Faltan sus pistas separadas.',
  ilegible: 'No se puede abrir la canción.',
  lectura: 'No se ha podido leer su audio.',
  decodificacion: 'No se ha podido leer su audio.',
  otro: 'Algo salió mal.'
}

/** `cola.causa`: motivo (`MotivoFallo`) de una entrada que no se puede reproducir. */
export function causaCola(motivo: string): string {
  return CAUSAS[motivo] ?? CAUSAS.otro!
}

const minuscula = (t: string): string => t.charAt(0).toLowerCase() + t.slice(1)

export const COLA = {
  titulo: 'Cola de reproducción',
  boton: (n: number): string => (n === 0 ? 'Cola' : `Cola ${n}`),
  botonAria: (n: number, abierto: boolean): string =>
    abierto ? 'Ocultar la cola' : `Mostrar la cola (${n} pendientes)`,
  ocultar: 'Ocultar',
  pantalla: (n: number, nombre: string | null): string =>
    nombre ? `Pantalla ${n} · ${nombre}` : `Pantalla ${n}`,
  modo: { completa: 'Pantalla completa', ventana: 'En una ventana' },
  activa: 'En reproducción',
  pendientes: (n: number): string => `A continuación (${n})`,
  ultima: 'Última reproducida',
  ultimaInterrumpida: (ms: number): string =>
    `Se detuvo en ${mmss(ms)}. Al abrir el reproductor, seguirá desde ahí.`,
  ultimaTerminada: 'Terminó. Al abrir el reproductor podrás empezar la siguiente.',
  cerrado: 'Reproductor cerrado',
  pausa: 'Pausa',
  reanudar: 'Reanudar',
  siguiente: 'Siguiente',
  siguienteNo: 'No hay canciones a continuación.',
  reiniciar: 'Reiniciar canción',
  otraVez: 'Agregar otra vez al final',
  termino: (titulo: string): string => `Terminó «${titulo}»`,
  cuenta: (n: number, titulo: string): string => `Empieza en ${n} s: «${titulo}»`,
  empezarYa: 'Empezar ya',
  detener: 'Detener cuenta',
  espera: 'En espera',
  iniciar: (titulo: string): string => `Iniciar «${titulo}»`,
  esperaVacia: 'Añade una canción con «A la cola» para empezar.',
  fin: 'La cola terminó. Si añades una canción, empezará tras la cuenta. O cierra el reproductor.',
  finUltima: (titulo: string, artista: string): string => `Última: ${titulo} — ${artista}`,
  finOtraVez: 'Otra vez',
  etiquetaSiguiente: 'Siguiente',
  falloTitulo: (titulo: string): string => `No se puede reproducir «${titulo}»`,
  causa: causaCola,
  falloSinSiguiente: 'No hay más canciones en la cola.',
  pasar: 'Pasar a la siguiente canción',
  descartar: 'Descartar',
  quitar: 'Quitar de la cola',
  llena: 'La cola está llena. Quita alguna canción para añadir más.',
  noDisponible: (causa: string): string => `⚠ No disponible: ${minuscula(causa)}`,
  menu: {
    siguiente: 'Reproducir a continuación',
    subir: 'Subir',
    bajar: 'Bajar',
    alFinal: 'Mover al final',
    otraVez: 'Agregar otra vez al final',
    quitar: 'Quitar de la cola'
  },
  vaciar: 'Vaciar…',
  vaciarAria: 'Vaciar las pendientes…',
  dialogoVaciar: {
    titulo: (n: number): string => `¿Quitar las ${n} canciones pendientes?`,
    cuerpo: 'La canción que suena no se interrumpe.',
    cancelar: 'Cancelar',
    quitar: 'Quitar pendientes'
  },
  eliminar: 'Eliminar cola…',
  dialogoEliminar: {
    titulo: '¿Eliminar la cola?',
    cuerpo: (n: number, interrumpida: { titulo: string; ms: number } | null): string =>
      `Se quitarán las ${n} canciones pendientes` +
      (interrumpida
        ? ` y ya no se podrá seguir «${interrumpida.titulo}» desde ${mmss(interrumpida.ms)}`
        : '') +
      '.',
    cancelar: 'Cancelar',
    eliminar: 'Eliminar cola'
  },
  vacia: 'No hay canciones pendientes. Usa «A la cola» en una canción lista para añadirla.',
  vaciaSinSesion:
    'La cola está vacía. Puedes prepararla antes de abrir el reproductor: usa «Agregar al final» en el menú ⋯ de una canción lista.',
  toast: {
    final: (titulo: string, posicion: number): string =>
      `«${titulo}» se agregó al final de la cola (posición ${posicion}).`,
    siguiente: (titulo: string): string => `«${titulo}» sonará a continuación.`,
    cuenta: (titulo: string, n: number): string => `«${titulo}» empieza en ${n} s.`,
    quitada: (titulo: string): string => `«${titulo}» se quitó de la cola.`,
    deshacer: 'Deshacer',
    iniciarAhora: 'Iniciar ahora',
    detener: 'Detener cuenta'
  },
  anuncio: {
    movida: (titulo: string, posicion: number, total: number): string =>
      `«${titulo}», posición ${posicion} de ${total}.`,
    empieza: (titulo: string, artista: string): string => `Suena «${titulo}», de ${artista}.`
  },
  ariaFila: (
    posicion: number,
    total: number,
    titulo: string,
    artista: string,
    duracion: string,
    opciones: { siguiente?: boolean; causa?: string } = {}
  ): string =>
    `${posicion} de ${total}: ${titulo}, de ${artista}, ${duracion}` +
    (opciones.siguiente ? ', siguiente' : '') +
    (opciones.causa ? `, no disponible: ${opciones.causa}` : '')
} as const

// --- Biblioteca: tarjetas y menús durante la sesión -------------------------

export const BIB_COLA = {
  boton: 'A la cola',
  botonAria: (titulo: string): string => `Agregar «${titulo}» al final de la cola`,
  menu: { siguiente: 'Reproducir a continuación', final: 'Agregar al final' },
  sonando: '▶ Sonando en la otra pantalla',
  enCola: 'En la cola',
  activaBloqueada: 'Se está reproduciendo en la otra pantalla.',
  dialogoEliminar: 'También se quitará de la cola.',
  dialogoBorrador:
    'Está en la cola: no se podrá reproducir hasta que la marques como lista otra vez.'
} as const
