/*
 * Textos de las acciones por lotes de la Biblioteca (docs/ux/02 · 0.2.2 · Feature 8,
 * «Microcopy (feature 8)»: claves `bib.acc.*`).
 */

const plural = (n: number, uno: string, varios: string): string => (n === 1 ? uno : varios)
const canciones = (n: number): string => `${n} ${plural(n, 'canción', 'canciones')}`

/** Código de motivo de main (o de la regla de la barra) → texto de la lista. */
export const MOTIVO: Record<string, string> = {
  yaLista: 'Ya está lista: no se prepara',
  yaPreparada: 'Ya está lista para revisar',
  enCurso: 'Ya se está preparando',
  danada: 'Está dañada',
  noLista: 'Aún no está lista',
  exportando: 'Ya se está exportando',
  sinTiempos: 'No tiene letra sincronizada',
  activa: 'No se elimina: se está reproduciendo en la otra pantalla',
  // Códigos de main
  YA_LISTA: 'Ya está lista: no se prepara',
  EN_CURSO: 'Ya se está preparando',
  SIN_FUENTE: 'Aún no está lista',
  NADA_QUE_HACER: 'Ya tiene esos datos',
  CANCION_NO_DISPONIBLE: 'Está dañada o ya no está en la biblioteca',
  CANCION_EN_REPRODUCCION: 'No se elimina: se está reproduciendo en la otra pantalla',
  EDICION_BLOQUEADA: 'No se ha cambiado: está sonando en la otra pantalla. Edítala cuando termine.',
  COLA_LLENA: 'La cola está llena',
  ERROR_INTERNO: 'No se pudo completar'
}

export const motivoDe = (codigo: string | undefined): string =>
  (codigo && MOTIVO[codigo]) || MOTIVO.ERROR_INTERNO!

export const ACC = {
  barra: 'Acciones para las canciones seleccionadas',
  preparar: 'Preparar',
  prepararParte: (a: number, n: number): string => `Preparar (${a} de ${n})`,
  prepararAria: (a: number, n: number): string => `Preparar, ${a} de ${n} seleccionadas`,
  mas: 'Más acciones',
  menu: {
    cola: 'A la cola',
    exportar: 'Exportar video…',
    paquete: 'Exportar paquete…',
    letra: 'Exportar la letra (.lrc)…',
    datos: 'Editar datos…',
    eliminar: 'Eliminar…',
    parte: (accion: string, a: number, n: number): string => `${accion} (${a} de ${n})`
  },
  ninguna: {
    preparar: 'Ninguna de las seleccionadas necesita preparación.',
    cola: 'Solo las canciones listas se pueden poner en la cola.',
    exportar: 'Solo las canciones listas se pueden exportar desde aquí.',
    letra: 'Ninguna de las seleccionadas tiene letra sincronizada.'
  },
  calculando: 'Comprobando las canciones…',
  cancelar: 'Cancelar',
  cerrar: 'Cerrar',
  copiarDetalles: 'Copiar detalles',
  canciones: 'Canciones',
  /** Fila de la lista: «{título}, {artista}: {nota}». */
  verCanciones: 'Ver las canciones',
  ocultarCanciones: 'Ocultar las canciones',
  reintentarFaltan: 'Reintentar las que faltan',
  reintentarFallidas: 'Reintentar las fallidas',
  resultado: {
    hecho: 'Hecho',
    omitida: (motivo: string): string => `Omitida: ${motivo}`
  },

  prep: {
    titulo: (n: number): string => `Preparar ${canciones(n)}`,
    explicacion:
      'Shinobi Karaoke hará sola lo que falta en cada una: separar las pistas, buscar la letra, comprobarla con la voz y ajustar los fines. Quedarán como «Lista para revisar».',
    privacidad: 'Para buscar la letra se envían el título y el artista de cada canción a LRCLIB.',
    boton: (n: number): string => `Preparar ${canciones(n)}`,
    toast: (n: number, titulo: string): string =>
      n === 1
        ? `«${titulo}» está en cola para preparar. Puedes seguir usando Shinobi Karaoke.`
        : `${n} canciones en cola para preparar. Puedes seguir usando Shinobi Karaoke.`,
    verActividad: 'Ver actividad',
    notaBuscara: 'Buscará la letra',
    notaSeparaBuscara: 'Separará las pistas y buscará la letra',
    notaConLetra: 'Ya tiene letra: comprobará la letra y ajustará los fines',
    notaFines: 'Ya tiene letra: ajustará los fines',
    notaFinesSinMarca:
      'Ya tiene letra (puede tener cambios tuyos): solo pondrá los fines que faltan',
    avisoFinesSinMarca: (k: number): string =>
      k === 1
        ? '1 de estas canciones tiene una letra de una versión anterior, que puede tener cambios tuyos. En ella solo pondremos fin a las líneas que no lo tienen, donde la voz se para claramente. No moveremos ningún inicio ni la letra entera, y podrás quitar esos fines desde el editor.'
        : `${k} de estas canciones tienen una letra de una versión anterior, que puede tener cambios tuyos. En ellas solo pondremos fin a las líneas que no lo tienen, donde la voz se para claramente. No moveremos ningún inicio ni la letra entera, y podrás quitar esos fines desde el editor.`
  },

  cola: {
    toast: (n: number): string =>
      `${canciones(n)} se ${plural(n, 'agregó', 'agregaron')} al final de la cola.`,
    toastParcial: (a: number, n: number): string =>
      `Se agregaron ${a} de ${n} canciones: la cola está llena.`,
    deshacer: 'Deshacer',
    iniciarAhora: 'Iniciar ahora'
  },

  datos: {
    titulo: (n: number): string => `Editar datos de ${canciones(n)}`,
    artista: 'Artista',
    album: 'Álbum',
    cambiarArtista: 'Cambiar el artista',
    cambiarAlbum: 'Cambiar el álbum',
    varios: '(varios)',
    ayuda: 'Solo cambian los campos marcados. El título se cambia canción a canción.',
    vaciarArtista: 'Quedarán sin artista.',
    vaciarAlbum: 'Quedarán sin álbum.',
    impacto: (campo: 'artista' | 'album' | 'los dos', a: number, b: number): string => {
      if (a === 0) return 'Todas tienen ya esos datos.'
      if (campo === 'los dos') return `Cambiará el artista o el álbum de ${canciones(a)}.`
      const nombre = campo === 'artista' ? 'artista' : 'álbum'
      return `Cambiará el ${nombre} de ${canciones(a)}${b > 0 ? `; ${b} ya ${plural(b, 'lo tiene', 'lo tienen')}` : ''}.`
    },
    aspecto: (k: number, campo: 'artista' | 'album' | 'los dos'): string => {
      const de = campo === 'artista' ? 'artista' : campo === 'album' ? 'álbum' : 'artista o álbum'
      return k === 1
        ? `⚠ 1 cambiará de aspecto: usará el tema de su nuevo ${de}.`
        : `⚠ ${k} cambiarán de aspecto: usarán el tema de su nuevo ${de}.`
    },
    nada: 'Marca el artista o el álbum para cambiarlo.',
    boton: (n: number): string => `Cambiar ${canciones(n)}`,
    cambiando: (i: number, n: number): string => `Cambiando… ${i} de ${n}`,
    toast: (n: number): string => `Datos cambiados en ${canciones(n)}.`,
    fallo: 'No se pudo guardar.'
  },

  eliminar: {
    titulo: (n: number): string => `¿Eliminar ${canciones(n)}?`,
    cuerpo:
      'Se moverán a la papelera de tu sistema, con sus pistas y su letra. Podrás recuperarlas desde allí.',
    nota: {
      cola: 'También se quitará de la cola',
      trabajo: 'Se cancelará su trabajo en curso'
    },
    listas: (k: number, n: number): string =>
      k === n && n > 1
        ? '⚠ Todas están listas para cantar.'
        : k === 1
          ? '⚠ 1 de ellas está lista para cantar.'
          : `⚠ ${k} de ellas están listas para cantar.`,
    entiendo: (n: number): string => `Entiendo que se eliminarán ${n} canciones.`,
    boton: (n: number): string => `Eliminar ${canciones(n)}`,
    eliminando: (i: number, n: number): string => `Eliminando… ${i} de ${n}`,
    toast: (n: number): string =>
      n === 1 ? '1 canción se movió a la papelera.' : `${n} canciones se movieron a la papelera.`,
    fallo: 'No se pudo mover a la papelera.',
    nada: 'Ninguna de las seleccionadas se puede eliminar.',
    /** Casilla obligatoria a partir de este número (decisión provisional de la spec). */
    umbralCasilla: 10
  },
  errorGenerico: 'No se pudo completar la acción.'
} as const

export { canciones as textoCanciones }
