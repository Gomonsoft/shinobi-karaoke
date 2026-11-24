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
    coros: (n: number): string => `Con la voz de los coros al ${n} %`,
    existe: 'Ya hay un video con este nombre',
    letraLista: 'Letra lista: sin barrido',
    incompleta: 'Tiene líneas sin sincronizar que no saldrán'
  },
  coros: (k: number): string =>
    `Incluir la voz en los coros (en ${k === 1 ? 'la canción que los tiene' : `las ${k} canciones que los tienen`}, cada una a su volumen)`,
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
  avisoExiste: (k: number, siExiste: 'numerar' | 'sustituir' | 'omitir'): string => {
    const uno = k === 1
    if (siExiste === 'sustituir') {
      return uno
        ? '1 video de esta carpeta se sustituirá cuando el nuevo esté terminado.'
        : `${k} videos de esta carpeta se sustituirán cuando los nuevos estén terminados.`
    }
    if (siExiste === 'omitir') {
      return uno
        ? '1 canción no se exportará porque ya tiene un video en esta carpeta.'
        : `${k} canciones no se exportarán porque ya tienen un video en esta carpeta.`
    }
    return uno
      ? '1 de estas canciones ya tiene un video en esta carpeta: se guardará con « (2)» en el nombre.'
      : `${k} de estas canciones ya tienen un video en esta carpeta: se guardarán con « (2)» en el nombre.`
  },
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
  /** El título del error llega con inicial mayúscula y su punto: aquí va tras los dos puntos, en minúscula y sin él. */
  detenido: (titulo: string, explicacion: string): string =>
    `El lote se detuvo: ${titulo.replace(/\.+$/, '').replace(/^\p{Lu}/u, (c) => c.toLowerCase())}. ${explicacion}`,
  reintentar: 'Reintentar las fallidas',
  cambiarOpciones: 'Cambiar opciones',
  mostrar: 'Mostrar la carpeta',
  /** Toast cuando la carpeta del lote ya no está (spec 10, respuesta a la pregunta 0316). */
  carpetaNoExiste: (carpeta: string): string =>
    `La carpeta «${carpeta}» ya no está disponible. Puede que se haya movido o que el disco esté desconectado.`,
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
