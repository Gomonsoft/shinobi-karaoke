import type { Procedencia } from '@shared/temas'
import { TEMA, destinoHeredar, procedenciaCorta } from '../../temas/textos'

/** Microcopy de ux/06. */
export const E = {
  timeline: {
    titulo: 'Línea de tiempo',
    regla: 'Posición en la línea de tiempo',
    inicio: 'Inicio de la línea',
    fin: 'Fin de la línea',
    finAuto: 'Fin de la línea (automático)',
    bucle: 'Bloquear enunciado',
    sinInicio: 'Fija primero el inicio de la línea.',
    fuera: 'Esta línea queda fuera del audio.',
    escuchaOcupada: 'Disponible al salir del bucle.',
    mas: 'Acercar',
    menos: 'Alejar',
    linea: 'Zoom a la línea',
    zoomSinInicio: 'Fija el inicio para acercar esta línea.',
    todo: 'Ver canción completa',
    cabezal: 'Centrar en el cabezal',
    general: 'Vista general',
    intervalo: (inicio: string, fin: string) => `De ${inicio} a ${fin} visibles`
  },
  lineas: 'Líneas',
  contador: (a: number, b: number) => `${a}/${b} sincronizadas`,
  pausa: '♪ pausa',
  pausaTiempo: 'Esta pausa viene con tiempo en la letra importada.',
  palabrasTooltip:
    'Esta línea trae tiempos por palabra: se resaltará palabra a palabra. Si mueves la línea, sus palabras se mueven con ella.',
  faltaTooltip: 'Sin sincronizar',
  corregir: 'Corregir la letra',
  sinSeleccion: 'Elige una línea de la lista para ajustar sus tiempos.',
  escuchar: 'Escuchar',
  original: 'Original',
  voz: 'Voz',
  instrumental: 'Instrumental',
  noDisponiblePista: (n: number) => `Disponible cuando termine la separación (${n} %)`,
  noDisponibleCola: 'Disponible cuando termine la separación (en cola)',
  noDisponibleSeparar: 'Disponible cuando se separen las pistas',
  velocidad: 'Velocidad',
  velocidadTooltip:
    'A menor velocidad, el tono también baja. Los tiempos que marques valen igual a cualquier velocidad.',
  volumen: 'Volumen',
  silenciar: 'Silenciar',
  activarSonido: 'Activar sonido',
  cargando: 'Cargando audio…',
  botonSync: 'Sincronizar al ritmo',
  botonProbar: 'Probar a pantalla completa',
  probarTooltip: 'Probar a pantalla completa (F)',
  probarSinLineas: 'Sincroniza al menos una línea para probarla.',
  syncTitulo: 'Sincronizando al ritmo',
  syncAyuda:
    'Pulsa Intro cuando empiece cada línea. Mantenla pulsada mientras se canta si quieres marcar también el final.',
  syncSiguiente: (texto: string, n: number, total: number) =>
    `Siguiente: «${texto}» · línea ${n} de ${total}`,
  syncMarcar: 'Marcar (Intro)',
  syncDeshacer: 'Deshacer (Retroceso)',
  syncPausa: 'Pausa (Espacio)',
  syncSeguir: 'Seguir (Espacio)',
  syncTerminar: 'Terminar (Esc)',
  syncPronto: 'Demasiado pronto: aún no ha empezado la línea anterior.',
  syncFin: '¡Todas las líneas tienen tiempo! Revisa con ▶ y ajusta lo que haga falta.',
  sinSync:
    'Empieza por sincronizar: pulsa Sincronizar al ritmo (o la tecla S) y marca cada línea al oírla.',
  yaSync:
    'Esta letra ya viene sincronizada. Escúchala y, si va adelantada o atrasada, usa el desplazamiento de toda la letra.',
  lineaN: (n: number, total: number) => `Línea ${n} de ${total}`,
  palabrasEtiqueta: 'por palabra',
  inicio: 'Inicio',
  fin: 'Fin',
  finAuto: 'Fin automático',
  finAyuda: 'Fija el fin para dejar un silencio antes de la siguiente línea',
  usarFinAuto: 'Usar fin automático',
  finSinInicio: 'Fija primero el inicio',
  formatoTiempo: 'Usa el formato mm:ss.cc, por ejemplo 01:04.20.',
  fijarInicio: 'Fijar inicio aquí',
  fijarFin: 'Fijar fin aquí',
  escucharLinea: 'Escuchar desde esta línea',
  borrarTiempos: 'Borrar tiempos de esta línea',
  limiteAnterior: (pausa: boolean) =>
    `No puede ir antes de la ${pausa ? 'pausa' : 'línea'} anterior`,
  limiteSiguiente: (pausa: boolean) =>
    `No puede pasar de la ${pausa ? 'pausa' : 'línea'} siguiente`,
  limiteFinInicio: 'El fin tiene que ir después del inicio.',
  limiteFinSiguiente: 'El fin no puede pasar del inicio de la línea siguiente.',
  escucharAjustar: 'Escuchar al ajustar',
  toastPalabras: (n: number) =>
    `La línea ${n} ya no se resaltará palabra a palabra: sus tiempos no cabían.`,
  toastFinAuto: (n: number) => `El fin de la línea ${n} vuelve a ser automático.`,
  offsetTitulo: 'Desplazamiento de toda la letra',
  offsetAyuda:
    'Úsalo si toda la letra va adelantada o atrasada respecto a la música. Con + la letra sale más tarde.',
  offsetRango: 'Máximo 30 segundos hacia cada lado.',
  restablecer: 'Restablecer',
  // edi.offset.campo / edi.offset.restablecer (spec 06-editor, subfase 2.1)
  offsetCampo: 'Segundos de desplazamiento',
  offsetRestablecer: 'Restablecer desplazamiento (0,00 s)',
  bluetooth:
    '¿Usas auriculares o altavoces Bluetooth? Si toda la letra queda atrasada, usa el desplazamiento de toda la letra.',
  fondo: 'Fondo',
  solido: 'Sólido',
  degradado: 'Degradado',
  angulo: 'Ángulo',
  color: 'Color',
  colores: 'Colores',
  anadirColor: 'Añadir color',
  quitarColor: 'Quitar este color',
  errorHex: 'Usa el formato #RRGGBB.',
  letra: 'Letra',
  fuente: 'Fuente',
  colorLetra: 'Color de la letra',
  colorResaltado: 'Color de lo ya cantado',
  sugeridos: 'Sugeridos',
  muestraFuente: '¿Cantamos? Ñandú',
  contrasteOk: 'Buen contraste',
  contrasteJusto: 'Legible en pantallas grandes; puede costar en proyectores o con mucha luz.',
  contrasteLetra: 'Difícil de leer: la letra y el fondo se parecen demasiado.',
  contrasteResaltado: 'Difícil de leer: lo ya cantado se confunde con el fondo.',
  contrasteDiferencia:
    'El resaltado apenas se distingue de la letra: no se notará qué parte ya se ha cantado.',
  contrasteFondo: 'Prueba también con un fondo más oscuro o más claro.',
  usarBlanca: 'Usar letra blanca',
  usarNegra: 'Usar letra negra',
  sugerirResaltado: 'Sugerir un color de resaltado',
  previa: 'Vista previa',
  previaAria: 'Vista previa de la letra con el estilo actual.',
  deshacer: (mac: boolean) => (mac ? 'Deshacer (⌘Z)' : 'Deshacer (Ctrl+Z)'),
  rehacer: (mac: boolean) => (mac ? 'Rehacer (⌘⇧Z)' : 'Rehacer (Ctrl+Mayús+Z)'),
  menuAtajos: 'Atajos de teclado (F1)',
  menuBorrador: 'Volver a borrador…',
  guardado: 'Guardado',
  guardando: 'Guardando…',
  errorGuardado: 'No se pudo guardar',
  toastErrorGuardar: (titulo: string) =>
    `No se pudieron guardar los cambios de «${titulo}». Lo seguimos intentando.`,
  dialogoSalirTitulo: 'No se pudieron guardar los últimos cambios.',
  dialogoSalir: 'Si sales ahora, perderás lo que has cambiado en los últimos segundos.',
  quedarme: 'Quedarme en el editor',
  salirSinGuardar: 'Salir sin guardarlos',
  recargada:
    'La letra ha cambiado fuera del editor y la hemos vuelto a cargar. Puede que tus últimos ajustes de tiempos no se hayan guardado: revísalos.',
  borradorGuardado: 'Borrador guardado.',
  marcarLista: 'Marcar como lista',
  hecho: 'Hecho',
  faltaTitulo: 'Para marcarla como lista falta:',
  faltaSeparando: (n: number, min?: number) =>
    `La separación de pistas (${n} %${min === undefined ? '' : `, quedan unos ${min} min`})`,
  faltaCola: 'La separación de pistas (en cola)',
  faltaSeparar: 'Separar las pistas',
  irSeparacion: 'Ir a Separación',
  faltaLineas: (n: number) => (n === 1 ? 'Sincronizar 1 línea' : `Sincronizar ${n} líneas`),
  irPrimera: (n: number) => (n === 1 ? 'Ir a ella' : 'Ir a la primera'),
  listaIncompleta: (n: number) => (n === 1 ? 'Falta 1 línea' : `Faltan ${n} líneas`),
  hechoIncompleta: (n: number) =>
    n === 1
      ? 'Esta canción está lista, pero falta 1 línea por sincronizar. Al cantarla no aparecerá.'
      : `Esta canción está lista, pero faltan ${n} líneas por sincronizar. Al cantarla no aparecerán.`,
  sincronizarAhora: 'Sincronizar ahora',
  salirIgualmente: 'Salir igualmente',
  probar: 'Probar a pantalla completa',
  probarOriginal: 'Vista previa con la canción original (la separación aún no ha terminado)',
  errorAudio: 'No se puede reproducir el audio de esta canción.',
  verBiblioteca: 'Ver en Biblioteca',
  sinLetra: 'Esta canción aún no tiene letra.',
  buscarLetra: 'Buscar la letra',
  ariaLinea: (n: number, tiempo: string | null, texto: string) =>
    `Línea ${n}, ${tiempo ?? 'sin sincronizar'}, ${texto}`,
  atajos: 'Atajos de teclado',
  /** Fase 3 (spec 06, «Microcopy (fase 3, editor)»). Claves `tema.*`; las compartidas viven en `temas/textos`. */
  tema: {
    titulo: 'Tema',
    modo: 'Modo del tema',
    definidos: 'Temas definidos',
    definidosDesc: 'Usa un tema y recibe sus cambios.',
    personalizado: 'Tema personalizado',
    personalizadoDesc: 'Estilo propio solo para esta canción.',
    selector: 'Tema',
    heredar: 'Volver a heredar',
    /** `tema.heredar.destino` (sin `respaldo`, que tiene su propia línea). */
    destino: (
      destino: { procedencia: Procedencia; temaNombre: string | null },
      ctx: { album?: string | null; artista?: string | null }
    ): string => destinoHeredar(destino, ctx),
    /** `tema.heredar.destino.respaldo` sin el ⚠ (se pinta aparte, `aria-hidden`). */
    destinoRespaldo:
      'Su tema de origen no está en tus temas. Se verá con el último aspecto guardado en esta canción («Tema no disponible»).',
    personalizar: 'Personalizar',
    editar: 'Editar tema',
    mas: 'Más acciones del tema',
    editandoTitulo: (tema: string): string => `Editando el tema «${tema}»`,
    editandoCuerpo: (n: number): string =>
      `${TEMA.usos(n)} Los cambios se ven en esta vista previa y no se aplican hasta que los guardes.`,
    guardarEn: 'Guardar en el tema…',
    descartar: 'Descartar cambios',
    guardarNuevo: 'Guardar como tema nuevo…',
    renombrar: 'Renombrar tema…',
    duplicar: 'Duplicar tema…',
    eliminar: 'Eliminar tema…',
    album: 'Tema del álbum…',
    artista: 'Tema del artista…',
    administrar: 'Administrar temas…',
    sinAlbum: 'Esta canción no tiene álbum. Puedes añadirlo con «Editar datos» en la Biblioteca.',
    sinArtista:
      'Esta canción no tiene artista. Puedes añadirlo con «Editar datos» en la Biblioteca.',
    albumSinArtista: 'Para dar un tema a este álbum, añade antes su artista.',
    catalogoVacio:
      'Aún no tienes temas. Personaliza esta canción y usa «Guardar como tema nuevo…» para crear el primero.',
    noDisponibleTitulo: 'Tema no disponible',
    noDisponibleCuerpo: (tema: string | null): string =>
      tema
        ? `Esta canción usaba «${tema}», que no está en tus temas (quizá viene de otro equipo o de una copia). Se ve con el aspecto que tenía.`
        : 'Esta canción usaba un tema que no está en tus temas (quizá viene de otro equipo o de una copia). Se ve con el aspecto que tenía.',
    noDisponibleOpcion: (tema: string | null): string =>
      tema ? `«${tema}» (no disponible)` : 'Tema no disponible',
    noDisponiblePersonalizar: 'Usar como tema personalizado',
    bloqueoSoloLectura: TEMA.soloLectura,
    bloqueoBorrado: TEMA.borradoPendiente,
    sinTemaQueEditar: 'Esta canción no usa ningún tema del catálogo.',
    contrasteAyuda: (conEditar: boolean): string =>
      conEditar
        ? 'Para corregirlo, personaliza esta canción o edita el tema.'
        : 'Para corregirlo, personaliza esta canción.',
    /** `tema.nuevo.creado` (variantes: tema vinculado, personalizada y sin tema). */
    nuevoCreado: (nuevo: string, esta: { tema: string | null; personalizada: boolean }): string =>
      esta.personalizada
        ? `Tema «${nuevo}» creado. Esta canción sigue con su tema personalizado.`
        : esta.tema
          ? `Tema «${nuevo}» creado. Esta canción sigue usando «${esta.tema}».`
          : `Tema «${nuevo}» creado. Esta canción sigue igual.`,
    usarNuevo: (nuevo: string): string => `Usar «${nuevo}» en esta canción`,
    cerrarAviso: 'Cerrar aviso',
    usarComoTemaEnCancion: 'Usar',
    dialogoDescartar: {
      titulo: '¿Descartar los cambios del tema?',
      cuerpo: (tema: string): string =>
        `Los cambios que has hecho en «${tema}» no se guardarán. El tema y las canciones que lo usan no cambian.`,
      seguir: 'Seguir editando',
      descartar: 'Descartar cambios'
    },
    dialogoSalir: {
      titulo: (tema: string): string => `Tienes cambios sin guardar en el tema «${tema}»`,
      cuerpo: 'Si sales ahora se perderán. Las canciones que usan el tema no cambian.',
      seguir: 'Seguir editando',
      descartar: 'Descartar cambios del tema',
      guardar: 'Guardar en el tema…'
    },
    /** `tema.toast.definidos`: genérica, «estilo incluido» y `respaldo` (sin nombre de tema, 0056). */
    toastDefinidos: (destino: { procedencia: Procedencia; temaNombre: string | null }): string => {
      if (destino.procedencia === 'respaldo') {
        return 'Su tema de origen no está en tus temas: esta canción se ve con el último aspecto guardado en ella.'
      }
      if (destino.procedencia === 'incluido') {
        return 'Esta canción usa ahora el estilo incluido de Shinobi Karaoke.'
      }
      return `Esta canción usa ahora «${destino.temaNombre ?? ''}» (${procedenciaCorta(destino.procedencia)}).`
    },
    deshacerToast: 'Deshacer',
    anuncioAsignado: (tema: string): string => `Tema «${tema}» asignado a esta canción.`,
    /** `tema.anuncio.heredar` (genérica y «estilo incluido») y `tema.anuncio.heredar.respaldo`. */
    anuncioHeredar: (destino: { procedencia: Procedencia; temaNombre: string | null }): string => {
      if (destino.procedencia === 'respaldo') {
        return 'Esta canción vuelve a heredar, pero su tema de origen no está en tus temas. Se ve con el último aspecto guardado.'
      }
      if (destino.procedencia === 'incluido') {
        return 'Esta canción vuelve a heredar: usa el estilo incluido de Shinobi Karaoke.'
      }
      return `Esta canción vuelve a heredar: usa «${destino.temaNombre ?? ''}».`
    },
    anuncioPersonalizado: 'Tema personalizado. Los cambios solo afectan a esta canción.',
    anuncioEditando: (tema: string): string =>
      `Editando el tema «${tema}». Los cambios no se aplican hasta que los guardes.`,
    anuncioSaleDeEditar: 'Has salido de la edición del tema.',
    anuncioEliminadoEsta:
      'Tema eliminado. Esta canción conserva su aspecto como tema personalizado.',
    pestanaEditando: 'Estilo (editando un tema sin guardar)',
    expandirEditando: 'Expandir panel (editando un tema sin guardar)',
    resumen: {
      fondo: 'Fondo',
      letra: 'Letra',
      solido: 'Sólido',
      degradado: (angulo: number): string => `Degradado · ${angulo}°`
    }
  },
  /** Subfase 2.1 (spec 06-editor, «Microcopy añadido»). Claves `edi.layout.*`. */
  layout: {
    divisor: {
      lista: 'Ancho de la lista de líneas',
      panel: 'Ancho del panel',
      dock: 'Alto de la línea de tiempo',
      tooltip: 'Arrastra para cambiar el tamaño. Doble clic: tamaño original.'
    },
    valor: (n: number) => `${n} píxeles`,
    /** `edi.layout.valor.minimizado`: femenino para lista y línea de tiempo. */
    valorMinimizado: (femenino: boolean) => (femenino ? 'Minimizada' : 'Minimizado'),
    lista: {
      nombre: 'Lista de líneas',
      minimizar: 'Minimizar lista de líneas',
      expandir: 'Expandir lista de líneas'
    },
    panel: {
      nombre: 'Panel',
      minimizar: 'Minimizar panel',
      expandir: 'Expandir panel',
      expandirAviso: 'Expandir panel (hay avisos de contraste)'
    },
    timeline: {
      nombre: 'Línea de tiempo',
      minimizar: 'Minimizar línea de tiempo',
      expandir: 'Expandir línea de tiempo',
      sinEspacio: 'No cabe en esta ventana. Agrándala para ver la línea de tiempo completa.'
    },
    riel: {
      linea: (n: number, total: number, tiempo: string | null, texto: string) =>
        tiempo === null
          ? `Línea ${n} de ${total}, sin sincronizar: ${texto}`
          : `Línea ${n} de ${total}, ${tiempo}: ${texto}`,
      anterior: 'Línea anterior (↑)',
      siguiente: 'Línea siguiente (↓)',
      fijarInicio: 'Fijar inicio aquí (I)',
      fijarFin: 'Fijar fin (O)',
      fijarFinNombre: 'Fijar fin aquí (O)',
      auto: 'automático'
    },
    restablecer: 'Restablecer distribución de paneles',
    anuncio: {
      minimizado: (panel: string, femenino: boolean) =>
        `${panel} ${femenino ? 'minimizada' : 'minimizado'}`,
      expandido: (panel: string, femenino: boolean) =>
        `${panel} ${femenino ? 'expandida' : 'expandido'}`,
      sinEspacio: 'La línea de tiempo se ha minimizado porque no cabe en la ventana.',
      restablecida: 'Distribución de paneles restablecida.'
    },
    region: (nombre: string, femenino: boolean) =>
      `${nombre}, ${femenino ? 'minimizada' : 'minimizado'}`
  }
} as const
