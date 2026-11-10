/** Textos de Ajustes (docs/ux/08, claves `aj.*`, literales). */
export const AJ = {
  titulo: 'Ajustes',
  volver: '‹ Biblioteca',
  volverEditor: '‹ Volver al editor',
  sepTitulo: 'Separación de voz',
  equipo: (d: string) => `Tu equipo: ${d}`,
  equipoNvidia: 'tarjeta gráfica NVIDIA',
  equipoNvidiaVram: (n: number) => `tarjeta gráfica NVIDIA (${String(n)} GB)`,
  equipoNvidiaRebajada: 'tarjeta gráfica NVIDIA (no se puede usar: se usa el procesador)',
  equipoApple: 'Mac con chip Apple',
  equipoCpu: 'sin tarjeta gráfica compatible (se usa el procesador)',
  modelo: { calidad: 'Modelo en uso: Calidad', rapido: 'Modelo en uso: Rápido' },
  descCalidad: 'Deja poca voz de fondo.',
  descRapido: 'Más ligero; puede dejar algo de voz de fondo.',
  tiempo: (a: number, b: number) =>
    `Una canción de 4 minutos tarda entre ${String(a)} y ${String(b)} minutos en tu equipo.`,
  tiempoAprox: (a: number, b: number) =>
    `Una canción de 4 minutos tarda entre ${String(a)} y ${String(b)} minutos en tu equipo, aproximadamente.`,
  tiempoIgual: (a: number) =>
    `Una canción de 4 minutos tarda unos ${String(a)} minutos en tu equipo.`,
  tiempoIgualAprox: (a: number) =>
    `Una canción de 4 minutos tarda unos ${String(a)} minutos en tu equipo, aproximadamente.`,
  rapidoAviso: (fecha: string) =>
    `Lo usas bajo tu responsabilidad desde el ${fecha}: sus autores no han declarado licencia.`,
  creditos: 'Créditos y licencias',
  calidadInfo: (a: number, b: number) =>
    `Modelo Calidad: deja menos voz de fondo. En tu equipo, una canción de 4 minutos tardaría entre ${String(a)} y ${String(b)} minutos.`,
  calidadInfoSinTiempo: 'Modelo Calidad: deja menos voz de fondo.',
  descarga: (n: string) => `Hay que descargar ${n}.`,
  botonCalidad: 'Volver a Calidad…',
  nota: 'El cambio se aplica a las próximas separaciones. Las canciones ya separadas no cambian.',
  dialogoTitulo: '¿Volver al modelo Calidad?',
  dialogoTiempo: (a: number, b: number) =>
    `Deja menos voz de fondo, pero en tu equipo cada canción de 4 minutos tardará entre ${String(a)} y ${String(b)} minutos en separarse.`,
  dialogoSinTiempo: 'Deja menos voz de fondo, pero cada canción tardará más en separarse.',
  dialogoSinRapido:
    'Desde Ajustes no podrás volver al modelo Rápido: solo se ofrece si el modelo Calidad falla.',
  cancelar: 'Cancelar',
  confirmar: 'Volver a Calidad',
  descargando: (p: number, x: number, y: number) =>
    `Descargando el modelo Calidad… ${String(p)} % · ${String(x)} MB de ${String(y)} MB`,
  mientras: 'Mientras tanto se sigue usando el modelo Rápido.',
  errorSigue: 'Sigues usando el modelo Rápido.',
  reintentar: 'Reintentar',
  toastCalidad: 'Ya usas el modelo Calidad.'
} as const

const plural = (n: number, uno: string, varios: string): string => (n === 1 ? uno : varios)

/** Sección Temas de Ajustes (docs/ux/08 «Microcopy (fase 3, Ajustes)», claves `aj.temas.*`). */
export const AJT = {
  titulo: 'Temas',
  predetTitulo: 'Tema predeterminado',
  predetAyuda: 'Lo usan las canciones que no tienen tema propio, ni de su álbum ni de su artista.',
  selector: 'Tema predeterminado',
  /** `aj.temas.predet.usos`. */
  predetUsos: (n: number): string =>
    n === 0
      ? 'Ahora no lo usa ninguna canción; lo usarán las nuevas.'
      : n === 1
        ? 'Ahora lo usa 1 canción.'
        : `Ahora lo usan ${String(n)} canciones.`,
  predetAzar:
    'Cada canción nueva recibe al crearse un tema al azar de tus temas, si su álbum o su artista no tienen tema. La elección se mantiene al reabrirla.',
  /** `aj.temas.toast.predet`; `null` = variante «ninguno». */
  toastPredet: (tema: string | null): string =>
    tema === null
      ? 'Sin tema predeterminado: las canciones nuevas recibirán un tema al azar.'
      : `Tema predeterminado: «${tema}».`,
  listaTitulo: (n: number): string => `Tus temas (${String(n)})`,
  /** `aj.temas.usos`. */
  usos: (n: number): string =>
    n === 0 ? 'Sin usar' : n === 1 ? '1 canción' : `${String(n)} canciones`,
  /** `aj.temas.grupos`; `null` si el tema no está asignado a ningún grupo. */
  grupos: (artistas: readonly string[], albumes: number): string | null => {
    const partes: string[] = []
    if (artistas.length === 1) partes.push(`artista ${artistas[0] ?? ''}`)
    else if (artistas.length > 1) partes.push(`${String(artistas.length)} artistas`)
    if (albumes > 0) partes.push(plural(albumes, '1 álbum', `${String(albumes)} álbumes`))
    return partes.length > 0 ? partes.join(', ') : null
  },
  etiquetaPredet: 'Predeterminado',
  menu: {
    etiqueta: (tema: string): string => `Más acciones de «${tema}»`,
    usar: 'Usar como predeterminado',
    renombrar: 'Renombrar…',
    duplicar: 'Duplicar…',
    eliminar: 'Eliminar…'
  },
  /** `aj.temas.aria.fila`. */
  ariaFila: (tema: string, predet: boolean, usos: string, grupos: string | null): string =>
    [tema + (predet ? ', predeterminado' : ''), usos, grupos].filter(Boolean).join(', '),
  editarNota:
    'Para cambiar el aspecto de un tema, abre una canción que lo use: Editor › Estilo › Editar tema.',
  vacioPredet:
    'Las canciones nuevas usan el estilo incluido de Shinobi Karaoke hasta que crees un tema.',
  vacioLista:
    'Aún no tienes temas. Crea uno desde el editor de una canción: Estilo › Tema personalizado › Guardar como tema nuevo…',
  apartado:
    'No se pudieron leer tus temas y se empezó una lista nueva. El archivo dañado se guardó como «temas.json.danado» en la carpeta de datos. Las canciones que los usaban se ven con el aspecto guardado en cada una.',
  apartadoCarpeta: 'Abrir carpeta de datos',
  apartadoCerrar: 'Cerrar aviso',
  soloLectura:
    'Tus temas se guardaron con una versión más nueva de Shinobi Karaoke. Aquí no se pueden usar ni cambiar; las canciones se ven con el aspecto guardado en cada una. Actualiza la app para usarlos.',
  /** `aj.temas.pendiente`. */
  pendiente: (k: number, n: number): string =>
    `La eliminación de este tema quedó a medias: faltan ${String(k)} de ${String(n)} canciones por guardar su aspecto.`,
  terminar: 'Terminar de eliminar',
  /** `aj.temas.faltan`. */
  faltan: (n: number): string =>
    n === 1
      ? '1 canción usa un tema que no está en tu lista (por ejemplo, al restaurar una copia). Se ve con el aspecto guardado en ella.'
      : `${String(n)} canciones usan temas que no están en tu lista (por ejemplo, al restaurar una copia). Se ven con el aspecto guardado en cada una.`,
  anuncioPredetBorrado:
    'Ya no hay tema predeterminado. Las canciones nuevas recibirán un tema al azar.',
  cargando: 'Cargando tus temas…',
  errorCarga: 'No se pudieron cargar tus temas.'
} as const
