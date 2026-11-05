/** Textos de Ajustes (docs/ux/08, claves `aj.*`, literales). */
export const AJ = {
  titulo: 'Ajustes',
  volver: '‹ Biblioteca',
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
