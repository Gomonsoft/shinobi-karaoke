import { formatearTiempo } from '@shared/letras/tiempos'

/** Microcopy de ux/06, fase 9 (claves `edi.preciso.*` y `edi.timeline.voz.*`). */
export const T = {
  voz: {
    pendiente: 'Disponible cuando termine la separación.',
    generando: 'Preparando forma de onda…',
    error: 'Forma de onda no disponible.',
    reintentar: 'Reintentar'
  },
  titulo: (n: number, total: number) => `Editor preciso · Línea ${n} de ${total}`,
  anterior: 'Línea anterior',
  siguiente: 'Línea siguiente',
  extremo: 'No hay más líneas con inicio en esa dirección.',
  cerrar: 'Cerrar y aplicar (Esc)',
  texto: 'Texto',
  textoVacio: 'La línea no puede quedar vacía. Para quitarla, usa «Corregir la letra».',
  textoRepartidas: (k: number) =>
    k === 1
      ? '1 palabra nueva sin marcar: márcala o revisa su reparto.'
      : `${k} palabras nuevas sin marcar: márcalas o revisa su reparto.`,
  palabraTitulo: (k: number, m: number, texto: string) => `Palabra ${k} de ${m} · «${texto}»`,
  recuento: (a: number, m: number) => `${a} de ${m} palabras marcadas a mano`,
  inicio: 'Inicio',
  fin: 'Fin',
  fijarInicio: 'Fijar inicio (I)',
  fijarFin: 'Fijar fin (O)',
  bucle: 'Bucle de la línea (Espacio)',
  palabraEscuchar: 'Palabra',
  palabraEscucharNombre: 'Escuchar la palabra seleccionada (Mayús + Espacio)',
  margen: 'Margen',
  margenAyuda: 'Silencio que suena antes y después de la línea en el bucle.',
  velocidad: 'Velocidad',
  tono: 'A menor velocidad, el tono también baja. Los tiempos que marques valen igual a cualquier velocidad.',
  marcar: 'MARCAR (Intro)',
  vueloAyuda:
    'Pulsa Intro cuando empiece cada palabra; mantenla pulsada mientras suena para marcar también su final. Retroceso deshace la última marca.',
  pronto: 'Demasiado pronto: aún no ha empezado la palabra anterior.',
  fuera: 'Fuera de la línea: marca mientras suena la letra.',
  repartir: 'Repartir de nuevo',
  quitar: 'Quitar los tiempos por palabra',
  quitarAviso: 'Al aplicar, esta línea volverá al barrido progresivo.',
  cancelar: 'Cancelar',
  aplicar: 'Aplicar (Ctrl+Intro)',
  descartar: '¿Descartar los cambios de esta línea?',
  seguirEditando: 'Seguir editando',
  descartarCambios: 'Descartar cambios',
  sinInicio: 'Esta línea aún no tiene inicio. Fíjalo para marcar sus palabras.',
  fijarInicioAqui: 'Fijar inicio aquí (I)',
  demasiadoCorta:
    'Esta línea es demasiado corta para repartir sus palabras. Alarga su fin en la línea de tiempo.',
  cargadasInvalidas:
    'Los tiempos por palabra guardados de esta línea no eran válidos: se han repartido de nuevo. Revísalos antes de aplicar.',
  anuncioAbrir: (n: number, texto: string, a: number, m: number) =>
    `Editor preciso de la línea ${n}: ${texto}. ${a} de ${m} palabras marcadas.`,
  anuncioAplicado: (n: number, quitadas: boolean) =>
    quitadas
      ? `La línea ${n} vuelve al barrido progresivo.`
      : `Palabras de la línea ${n} aplicadas.`,
  anuncioCancelado: (n: number) => `Cambios de la línea ${n} descartados.`,
  tira: 'Palabras de la línea',
  regla: 'Posición en la ventana',
  linea: {
    inicio: 'Inicio de la línea',
    fin: 'Fin de la línea',
    finAuto: 'Fin de la línea (automático)'
  },
  palabra: { inicio: 'Inicio de la palabra', fin: 'Fin de la palabra' },
  ariaPalabra: (
    k: number,
    m: number,
    texto: string,
    inicioMs: number,
    finMs: number,
    marcada: boolean
  ) =>
    `Palabra ${k} de ${m}, ${texto}, de ${formatearTiempo(inicioMs)} a ${formatearTiempo(finMs)}, ${marcada ? 'marcada a mano' : 'sin marcar'}`,
  limite: {
    anterior: 'No puede ir antes de la palabra anterior.',
    anteriorPrimera: 'No puede ir antes del inicio de la línea.',
    siguiente: 'No puede pasar de la palabra siguiente.',
    siguienteUltima: 'No puede pasar del fin de la línea.',
    minimo: 'Cada palabra dura al menos 0,02 s.',
    linea: 'La línea no puede cortar una palabra marcada.',
    editor: 'Fuera de lo que permiten las líneas vecinas o la canción.'
  }
} as const
