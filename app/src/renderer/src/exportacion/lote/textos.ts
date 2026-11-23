/** Textos del lote de exportación (docs/ux/10 · 0.2.2 · Feature 8, claves `exp.lote.*` y `act.exp.lote`). */

const plural = (n: number, uno: string, varios: string): string => (n === 1 ? uno : varios)

export const EXP_LOTE = {
  titulo: (n: number): string => `Exportar ${n} videos`,
  cabecera: (n: number, duracion: string): string => `${n} canciones · ${duracion} en total`,
  verCuales: 'Ver cuáles',
  ocultarCuales: 'Ocultar la lista',
  listaAria: 'Canciones del lote',
  nota: {
    sinVoz: 'Sin pista de voz: se exporta solo con instrumental',
    existe: 'Ya hay un video con este nombre',
    letraLista: 'Letra lista: sin barrido',
    incompleta: 'Tiene líneas sin sincronizar que no saldrán'
  },
  carpeta: 'Guardar en la carpeta',
  carpetaAria: (ruta: string): string => `Guardar en la carpeta, ${ruta}`,
  cambiar: 'Cambiar…',
  existe: 'Si ya existe un video con el mismo nombre',
  existeOpciones: {
    numerar: 'Conservar los dos',
    sustituir: 'Sustituir',
    omitir: 'Omitir esa canción'
  },
  estimacion: (tamano: string | null, tiempo: string | null): string | null => {
    if (!tamano && !tiempo) return null
    if (tamano && tiempo) return `Ocuparán unos ${tamano} · tardarán ${tiempo}`
    return tamano ? `Ocuparán unos ${tamano}` : `Tardarán ${tiempo}`
  },
  avisoExiste: (k: number, siExiste: 'numerar' | 'sustituir' | 'omitir'): string =>
    siExiste === 'sustituir'
      ? `${k} videos de esta carpeta se sustituirán cuando los nuevos estén terminados.`
      : siExiste === 'omitir'
        ? `${k} canciones no se exportarán porque ya tienen un video en esta carpeta.`
        : `${k} de estas canciones ya tienen un video en esta carpeta: se guardarán con « (2)» en el nombre.`,
  avisoEspacio: (tamano: string, libre: string): string =>
    `Puede que no quepan: ocuparán unos ${tamano} y quedan ${libre} libres en ese disco.`,
  muestra: 'Cada video usa el estilo de su canción.',
  boton: (n: number): string => `Exportar ${n} ${plural(n, 'video', 'videos')}`,
  progresoTitulo: (n: number): string => `Exportando ${n} videos`,
  progreso: (i: number, n: number): string => `${i} de ${n} terminados`,
  restante: (minutos: number): string =>
    minutos <= 1 ? 'queda menos de 1 minuto' : `quedan unos ${minutos} minutos`,
  fila: {
    creando: (p: number): string => `Creando el video… ${p} %`,
    preparando: 'Preparando el video…',
    enCola: 'En cola',
    cancelada: 'Cancelada',
    noIntentada: 'No se intentó: el lote se detuvo.',
    yaExiste: 'Omitida: ya había un video con ese nombre',
    yaEnCola: 'Omitida: ya se estaba exportando',
    omitida: 'Omitida',
    canciones: 'Canciones del lote'
  },
  quitar: (titulo: string): string => `Quitar «${titulo}» de este lote`,
  cancelarBoton: 'Cancelar las que faltan',
  cancelar: (k: number, i: number): string =>
    `¿Cancelar las ${k} que faltan? Los ${i} videos ya terminados se conservan.`,
  seguirExportando: 'Seguir exportando',
  segundoPlano: 'Seguir en segundo plano',
  ayudaSegundoPlano: 'Puedes cerrar este cuadro: la exportación continúa.',
  resultadoTitulo: 'Videos exportados',
  resultadoNinguno: 'No se pudo exportar ningún video',
  resultado: (a: number, n: number, tamano: string, tiempo: string): string =>
    a === n
      ? `Se exportaron ${n} videos · ${tamano} · tardó ${tiempo}`
      : `Se exportaron ${a} de ${n} videos · ${tamano} · tardó ${tiempo}`,
  enCarpeta: (carpeta: string): string => `En ${carpeta}`,
  detenido: (titulo: string, explicacion: string): string =>
    `El lote se detuvo: ${titulo}. ${explicacion}`,
  reintentar: 'Reintentar las fallidas',
  cambiarOpciones: 'Cambiar opciones',
  mostrar: 'Mostrar la carpeta',
  /** Sin texto en la spec (pregunta 0316): toast cuando la carpeta del lote ya no está. */
  carpetaNoExiste: 'La carpeta ya no está disponible.',
  cerrar: 'Cerrar',
  copiarDetalles: 'Copiar detalles',
  toast: (a: number, n: number): string =>
    a === 0
      ? 'No se pudo exportar ningún video.'
      : a === n
        ? `${n} videos exportados.`
        : `Se exportaron ${a} de ${n} videos.`,
  verResultado: 'Ver resultado',
  actividad: (n: number, i: number): string => `Exportando ${n} videos · ${i} de ${n}`,
  anuncio: {
    inicio: (n: number): string => `Exportando ${n} videos.`,
    cancion: (i: number, n: number, titulo: string, ok: boolean): string =>
      `${i} de ${n}: «${titulo}» ${ok ? 'exportada' : 'no se pudo exportar'}`,
    fin: (a: number, n: number): string => `Fin del lote: ${a} de ${n} videos exportados.`
  },
  /** No hay texto en la spec para el error al iniciar sin carpeta propuesta. */
  sinCarpeta: 'No se pudo proponer una carpeta. Elige una con «Cambiar…».'
} as const
