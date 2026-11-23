/** Textos de la feature 9 (docs/ux/02-biblioteca.md · Feature 9; claves `paq.*` y `lrc.*`, literales). */

const plural = (n: number, uno: string, varios: string): string => (n === 1 ? uno : varios)

export const PAQ = {
  menuExportar: 'Exportar paquete…',
  /** `add.paquete.enlace` en «Añadir canción» (spec 03, F7-N15). */
  anadir: { pregunta: '¿Tienes un paquete de Shinobi Karaoke?', enlace: 'Importar paquete…' },
  vacioEnlace: 'Restaurar una copia o importar un paquete…',
  arrastrarVarios: 'Los paquetes se importan de uno en uno. Se abrirá el primero.',
  // --- Exportar
  exp: {
    titulo: 'Exportar paquete',
    cabeceraUna: (titulo: string, artista: string) => `«${titulo}» · ${artista}`,
    cabeceraVarias: (n: number) => `${n} canciones`,
    verCuales: 'Ver cuáles',
    ocultarCuales: 'Ocultar la lista',
    incluye: 'Qué incluye',
    completoTitulo: 'Completo, con el audio',
    completoAyuda:
      'Letra, tiempos, estilo, temas y las pistas de cada canción. Al importarlo se puede cantar al momento.',
    ligeroTitulo: 'Ligero, sin audio',
    ligeroAyuda:
      'Letra, tiempos, estilo y temas. Al importarlo en otro equipo habrá que volver a añadir el audio de cada canción.',
    tamanoCalculando: 'calculando…',
    tamanoMenosDe1: 'menos de 1 MB',
    tamano: (t: string) => `unos ${t}`,
    guardar: 'Guardar como',
    cambiar: 'Cambiar…',
    existe:
      'Ya hay un archivo con este nombre. Se sustituirá solo cuando el paquete nuevo esté terminado; si cancelas o falla, se conserva.',
    espacio: (tamano: string, libre: string) =>
      `Puede que no quepa: ocupará unos ${tamano} y quedan ${libre} libres en ese disco.`,
    boton: 'Exportar paquete',
    botonSustituir: 'Exportar y sustituir',
    notaSinAudio: 'Sin pistas todavía: se guarda sin audio',
    notaEnCurso: 'Se está procesando: se guarda como está ahora',
    notaEnCursoSeparando: 'Se está separando: se guarda sin pistas'
  },
  derechos:
    'Es una copia para ti. El audio y la letra de las canciones tienen derechos de autor: úsala para guardar tu trabajo o llevarlo a otro equipo tuyo. Pasarla a otras personas puede infringir esos derechos y queda bajo tu responsabilidad.',
  derechosLigero:
    'Es una copia para ti. La letra de las canciones tiene derechos de autor: úsala para guardar tu trabajo o llevarlo a otro equipo tuyo. Pasarla a otras personas puede infringir esos derechos y queda bajo tu responsabilidad.',
  // --- Creando
  creando: {
    titulo: 'Creando el paquete',
    resumen: (n: number, completo: boolean) =>
      `${plural(n, '1 canción', `${n} canciones`)} · ${completo ? 'completo' : 'ligero'}`,
    progreso: (titulo: string, i: number, n: number) =>
      n === 1 ? `Guardando «${titulo}»…` : `Guardando «${titulo}»… ${i} de ${n}`,
    preparando: 'Preparando el paquete…',
    segundoPlano: 'Puedes cerrar este cuadro: el paquete se sigue creando.',
    cancelar: 'Cancelar',
    seguir: 'Seguir en segundo plano',
    cancelando: 'Cancelando…'
  },
  ok: {
    titulo: 'Paquete creado',
    resumen: (nombre: string, n: number, tamano: string, carpeta: string) =>
      `${nombre} · ${plural(n, '1 canción', `${n} canciones`)} · ${tamano} · En ${carpeta}`,
    cerrar: 'Cerrar',
    mostrar: 'Mostrar en la carpeta',
    omitidas: (k: number) =>
      k === 1 ? '1 canción no se pudo guardar:' : `${k} canciones no se pudieron guardar:`,
    toast: (n: number, tamano: string) =>
      `Paquete creado: ${plural(n, '1 canción', `${n} canciones`)}, ${tamano}.`,
    toastCancelado: 'Paquete cancelado. No se ha guardado nada.'
  },
  error: {
    SIN_ESPACIO:
      'No queda espacio en el disco. Libera espacio o guarda el paquete en otra carpeta.',
    DESTINO_NO_DISPONIBLE:
      'No se puede guardar en esa carpeta. No tienes permiso para escribir en ella o el disco no está disponible. Elige otra con «Cambiar…».',
    generico: 'Algo salió mal al crear el paquete. Vuelve a intentarlo.',
    reintentar: 'Reintentar',
    copiar: 'Copiar detalles'
  },
  /** `act.paq` */
  actividad: {
    crear: (i: number, n: number) => `Creando paquete · ${i} de ${n}`,
    importar: (i: number, n: number) => `Importando paquete · ${i} de ${n}`
  },
  // --- Importar
  imp: {
    titulo: 'Importar paquete',
    tituloCopia: 'Restaurar copia de seguridad',
    leyendo: 'Leyendo el paquete…',
    leido: 'Paquete leído.',
    cancelar: 'Cancelar',
    resumen: (
      fecha: string | null,
      version: string | null,
      completo: boolean,
      n: number,
      t: number,
      tamano: string | null
    ) =>
      [
        fecha
          ? `Creado el ${fecha}${version ? ` con Shinobi Karaoke ${version}` : ''}`
          : version
            ? `Creado con Shinobi Karaoke ${version}`
            : null,
        completo ? 'completo' : 'ligero',
        plural(n, '1 canción', `${n} canciones`),
        plural(t, '1 tema', `${t} temas`),
        tamano
      ]
        .filter(Boolean)
        .join(' · '),
    estadoNueva: 'Nueva',
    estadoExiste: (masReciente: boolean, fechaPaquete: string, fechaLocal: string) =>
      `Ya la tienes. La del paquete es ${masReciente ? 'más reciente' : 'más antigua'} (${fechaPaquete}; la tuya, ${fechaLocal}).`,
    estadoIgual: 'Ya la tienes igual: se omite',
    paraExistentes: 'Para las que ya tienes:',
    omitir: 'Omitir',
    sustituir: 'Sustituir',
    conservar: 'Conservar las dos',
    mixto: 'Mixto',
    ariaDecision: (titulo: string) => `Qué hacer con «${titulo}»`,
    notaSustituir: 'La tuya irá a la papelera de tu sistema.',
    notaLigeroSustituir:
      'Se sustituyen la letra, los tiempos y el estilo. Tu audio se conserva y la versión anterior se guarda como copia de la canción.',
    notaLigeroNueva: 'Sin audio: entrará como borrador y habrá que volver a añadir su audio.',
    notaParecida:
      'Tienes otra canción con el mismo título y artista. Se importará como una canción aparte.',
    activaBloqueada: 'No se sustituye: se está reproduciendo en la otra pantalla',
    temas: (a: number, b: number, c: number) =>
      `Temas: ${plural(a, '1 nuevo', `${a} nuevos`)} · ${plural(b, '1 ya lo tienes', `${b} ya los tienes`)}${c > 0 ? ` · ${c} entran como copia` : ''}`,
    verTemas: 'Ver los temas',
    temasSoloLectura:
      'Tus temas son de una versión más nueva y no se pueden cambiar: las canciones entrarán con su aspecto guardado.',
    espacio: (tamano: string, libre: string) => `Hacen falta ${tamano}; tienes ${libre} libres.`,
    espacioNoCabe: (tamano: string, libre: string) =>
      `⚠ Hacen falta ${tamano} y solo tienes ${libre} libres.`,
    boton: (n: number, copia: boolean) =>
      copia
        ? `Restaurar ${plural(n, '1 canción', `${n} canciones`)}`
        : `Importar ${plural(n, '1 canción', `${n} canciones`)}`,
    nada: 'No hay nada que importar: ya tienes todas estas canciones.',
    progreso: (titulo: string, i: number, n: number) => `Importando «${titulo}»… ${i} de ${n}`,
    preparando: 'Preparando la importación…',
    segundoPlano: 'Puedes cerrar este cuadro: la importación sigue.',
    seguir: 'Seguir en segundo plano',
    resultado: (a: number, n: number) =>
      a === n ? `Se importaron ${n} canciones.` : `Se importaron ${a} de ${n} canciones.`,
    resultadoUna: 'Se importó 1 canción.',
    toast: (n: number, titulo?: string) =>
      n === 1 && titulo ? `«${titulo}» importada.` : `${n} canciones importadas.`,
    toastParcial: (a: number, n: number) => `Se importaron ${a} de ${n} canciones.`,
    verResultado: 'Ver resultado',
    toastCancelada: 'Importación cancelada.',
    errorGenerico: 'Algo salió mal al importar el paquete. No se ha cambiado nada.',
    temasResultado: (importados: string[]) =>
      importados.length === 0
        ? null
        : `Temas: ${plural(importados.length, '1 importado', `${importados.length} importados`)} («${importados.join('», «')}»).`,
    cerrar: 'Cerrar',
    otroArchivo: 'Elegir otro archivo',
    copiar: 'Copiar detalles',
    ariaFila: (titulo: string, artista: string, estado: string, decision?: string) =>
      `${titulo}, ${artista}: ${estado}${decision ? `, ${decision}` : ''}`
  },
  /** Resultado por canción (tabla «Motivos del resultado por canción»). */
  fila: {
    importada: 'Importada',
    sustituida: 'Sustituida (la anterior está en la papelera)',
    sustituidaLigera: 'Sustituidas la letra, los tiempos y el estilo; tu audio se conserva',
    copia: (titulo: string) => `Importada como «${titulo} (importada)»`
  },
  motivo: {
    IGUAL: 'Omitida: ya la tenías igual',
    OMITIDA: 'Omitida: conservaste la tuya',
    CANCION_MAS_NUEVA: 'Omitida: es de una versión más nueva de Shinobi Karaoke',
    EN_CURSO: 'Omitida: la tuya tenía un trabajo en curso. Vuelve a importarla cuando termine',
    CANCION_EN_REPRODUCCION: 'Omitida: la tuya estaba sonando. Vuelve a importarla cuando termine',
    CANCELADO: 'No importada: cancelaste la importación'
  } as Record<string, string>,
  fallo: {
    PAQUETE_INCOMPLETO: 'Sus archivos están dañados en el paquete. No se ha importado.',
    PAQUETE_NO_VALIDO: 'Sus datos no son válidos. No se ha importado.',
    SIN_ESPACIO: 'No quedaba espacio en el disco. Libera espacio y vuelve a importarla.',
    guardar: 'No se pudo guardar.'
  } as Record<string, string>,
  /** Errores de lectura (paso 1). */
  lectura: {
    PAQUETE_NO_VALIDO: {
      titulo: 'Este archivo no es un paquete de Shinobi Karaoke.',
      explicacion:
        'Elige un archivo .shinobi creado con «Exportar paquete» o «Crear copia de seguridad».'
    },
    PAQUETE_VERSION_NUEVA: {
      titulo: 'Este paquete es de una versión más nueva de Shinobi Karaoke.',
      explicacion: 'Actualiza la aplicación para poder importarlo. No se ha cambiado nada.'
    },
    PAQUETE_INCOMPLETO: {
      titulo: 'El paquete está dañado o incompleto.',
      explicacion:
        'Puede que la copia se interrumpiera o que el archivo se cortara al copiarlo. No se puede abrir y no se ha cambiado nada. Si tienes otra copia de este paquete, prueba con ella.'
    },
    SIN_ESPACIO: {
      titulo: 'No queda espacio en el disco.',
      explicacion: 'Libera espacio y vuelve a intentarlo. Las canciones ya importadas se conservan.'
    },
    generico: {
      titulo: 'No se pudo abrir el paquete.',
      explicacion: 'No se ha cambiado nada. Vuelve a intentarlo o elige otro archivo.'
    }
  } as Record<string, { titulo: string; explicacion: string }>
} as const

/** Exportar la letra a `.lrc`. */
export const LRC = {
  menu: 'Exportar la letra (.lrc)…',
  sinTiempos: 'Esta canción aún no tiene ninguna línea sincronizada.',
  ok: 'Letra exportada.',
  omitidas: (k: number) => `Letra exportada sin ${k} líneas que aún no tienen tiempo.`,
  omitidasUna: 'Letra exportada sin 1 línea que aún no tiene tiempo.',
  mostrar: 'Mostrar en la carpeta',
  mostrarCarpeta: 'Mostrar la carpeta',
  varias: (n: number, carpeta: string) => `${n} letras exportadas a «${carpeta}».`,
  variasUna: (carpeta: string) => `1 letra exportada a «${carpeta}».`,
  /** Sin el nombre de la carpeta: el resultado de main solo trae el `ubicacionId` (pregunta 0291). */
  variasSinCarpeta: (n: number) => `${n} letras exportadas.`,
  variasOmitidas: (a: number, n: number) => `${a} de ${n} letras exportadas.`,
  error: 'No se pudo guardar la letra en esa carpeta.',
  copiar: 'Copiar detalles',
  resultadoTitulo: 'Letras exportadas',
  motivo: {
    SIN_TIEMPOS: 'Esta canción aún no tiene ninguna línea sincronizada.',
    CANCION_NO_DISPONIBLE: 'La canción ya no está disponible.',
    SIN_ESPACIO: 'No queda espacio en el disco.',
    DESTINO_NO_DISPONIBLE: 'No se puede guardar en esa carpeta.'
  } as Record<string, string>,
  cerrar: 'Cerrar'
} as const

/** Ajustes › Copia de seguridad (docs/ux/08 · Feature 9). */
export const AJCOPIA = {
  titulo: 'Copia de seguridad',
  ayuda:
    'Guarda todas tus canciones, tus temas y tus ajustes en un archivo, para no perder tu trabajo o para llevarlo a otro equipo tuyo.',
  nunca: 'Aún no has hecho ninguna copia de seguridad.',
  ultima: (fecha: string, n: number, tamano: string, completa: boolean) =>
    `Última copia: ${fecha} · ${plural(n, '1 canción', `${n} canciones`)} · ${tamano} · ${completa ? 'completa' : 'ligera'}`,
  recordatorio: (k: number) => `Desde entonces has añadido o cambiado ${k} canciones.`,
  recordatorioNunca: (k: number) =>
    `Tienes ${k} canciones listas. Una copia las protege si se estropea el disco o cambias de equipo.`,
  crear: 'Crear copia de seguridad…',
  crearEnCurso: 'Ver la copia en curso',
  restaurar: 'Restaurar o importar…',
  vacia: 'Aún no hay canciones que guardar.',
  dialogoTitulo: 'Crear copia de seguridad',
  dialogoCabecera: (n: number, t: number) =>
    `Toda tu biblioteca: ${plural(n, '1 canción', `${n} canciones`)} y ${plural(t, '1 tema', `${t} temas`)}`,
  completaTitulo: 'Completa, con el audio',
  completaAyuda:
    'Todo lo necesario para cantar en otro equipo sin volver a descargar ni separar nada.',
  ligeraTitulo: 'Ligera, sin audio',
  ligeraAyuda:
    'Letras, tiempos, estilos y temas. El audio habría que volver a añadirlo canción a canción.',
  ajustes: 'Incluir mis ajustes',
  notaEnCurso: (k: number) =>
    k === 1
      ? '1 canción se está procesando: se guardará como está ahora (si se está separando, sin pistas).'
      : `${k} canciones se están procesando: se guardarán como están ahora (las que se están separando, sin pistas).`,
  boton: 'Crear copia de seguridad',
  creandoTitulo: 'Creando la copia de seguridad',
  creando: (i: number, n: number) => `Creando la copia de seguridad… ${i} de ${n} canciones`,
  toastOk: (n: number, tamano: string) =>
    `Copia de seguridad creada: ${plural(n, '1 canción', `${n} canciones`)}, ${tamano}.`,
  restNoBorra:
    'Restaurar añade lo que falta. No elimina ninguna canción ni ningún tema de tu biblioteca.',
  restAsignaciones: (a: number, b: number) =>
    `Temas de artistas y álbumes: se restauran ${a}; ${b} no, porque aquí ya tienen otro.`,
  restAsignacionesPredeterminado:
    'El tema predeterminado de la copia no se aplica: aquí ya tienes uno.',
  verCuales: 'Ver cuáles',
  restAjustes: 'Restaurar también mis ajustes',
  restAjustesAyuda:
    'Agrupación de la biblioteca, reproductor, opciones de exportación y distribución del editor. Sustituyen a los de este equipo.',
  restAjustesAplicados: 'Ajustes restaurados.'
} as const
