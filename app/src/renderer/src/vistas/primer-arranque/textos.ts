/** Textos de Primer arranque (docs/ux/01, claves `pa.*`, literales). */

export const PA = {
  bienvenidaTitulo: 'Hola. Vamos a preparar tu estudio de karaoke.',
  bienvenidaCuerpo:
    'Antes de empezar, Shinobi Karaoke necesita descargar su motor de audio (lo que separa la voz de la música). Solo se hace una vez.',
  reqDescarga: (n: string) => `Descarga: unos ${n} GB para tu equipo`,
  reqDescargaGenerica: (a: string, b: string) => `Descarga: entre ${a} y ${b} GB según tu equipo`,
  reqTiempo: 'Tiempo: de 5 a 25 minutos, según tu conexión',
  reqEspacio: (n: string, m: string) =>
    `Espacio: necesitas al menos ${n} GB libres (tienes ${m} GB)`,
  reqEspacioInsuficiente: (n: string, m: string) =>
    `Necesitas ${n} GB libres y tienes ${m} GB. Libera espacio y pulsa "Comprobar de nuevo".`,
  reqConexion: 'Conexión: necesaria solo durante esta preparación',
  bienvenidaNota:
    'Puedes seguir usando el ordenador mientras tanto. Si se corta, continuará donde lo dejó.',
  botonComprobar: 'Comprobar de nuevo',
  botonPreparar: 'Preparar Shinobi Karaoke',

  instalandoTitulo: 'Preparando Shinobi Karaoke',
  faseMotor: 'Preparando el motor de audio',
  faseComponentes: 'Instalando componentes',
  faseDiagnostico: 'Comprobando tu equipo…',
  faseModelo: 'Descargando el modelo de separación',
  modoCalidadNvidia:
    'Separaremos las pistas con el modelo Calidad usando tu tarjeta gráfica NVIDIA.',
  modoCalidadApple: 'Separaremos las pistas con el modelo Calidad usando el chip Apple de tu Mac.',
  modoCalidadCpu: (tiempo: string) =>
    `Tu equipo no tiene una tarjeta gráfica compatible: separaremos las pistas con el modelo Calidad usando el procesador. Es más lento${tiempo}`,
  modoRebajadoMemoria: (tiempo: string) =>
    `Tu tarjeta gráfica no tiene memoria suficiente: separaremos las pistas con el modelo Calidad usando el procesador. Es más lento${tiempo}`,
  modoRebajadoGenerico: (tiempo: string) =>
    `No hemos podido usar tu tarjeta gráfica: separaremos las pistas con el modelo Calidad usando el procesador. Es más lento${tiempo}`,
  modoRapidoAceptado: 'Separaremos las pistas con el modelo Rápido usando el procesador.',
  faseModeloRapido: 'Descargando el modelo de separación (Rápido)',
  botonPausar: 'Pausar y salir',
  total: 'Total',
  calculandoTiempo: 'Calculando tiempo…',
  etaMenosDeUno: 'menos de 1 minuto',
  etaMinutos: (n: number) => `quedan unos ${n} minutos`,
  etaMasDe30: 'más de 30 minutos',
  verDetalles: 'Ver detalles',
  ocultarDetalles: 'Ocultar detalles',
  detallesCopiados: 'Detalles copiados',
  detallesNoCopiados: 'No se pudieron copiar los detalles.',
  detallesCargando: 'Cargando…',

  listoTitulo: 'Todo listo',
  listoCuerpo: 'Shinobi Karaoke ya puede separar la voz de tus canciones.',
  listoModelo: (modelo: string) => `Modelo de separación: ${modelo}.`,
  listoTiempo: (a: number, b: number) =>
    `Una canción de 4 minutos tardará entre ${a} y ${b} minutos.`,
  listoTiempoIgual: (a: number) => `Una canción de 4 minutos tardará unos ${a} minutos.`,
  listoTiempoAprox: (a: number, b: number) =>
    `Una canción de 4 minutos tardará entre ${a} y ${b} minutos, aproximadamente. Lo ajustaremos tras tu primera canción.`,
  listoRapido:
    'Usas el modelo Rápido bajo tu responsabilidad. Cuando quieras, puedes volver al modelo Calidad desde Ajustes.',
  botonEmpezar: 'Empezar',

  reanudarTitulo: 'Continuamos donde lo dejamos',
  reanudarFaltan: (n: number) => `Faltan unos ${n} MB por descargar.`,
  botonContinuar: 'Continuar la preparación',
  repararTitulo: 'Hay que reparar el motor de audio',
  repararCuerpo:
    'Falta una parte de lo que se descargó la primera vez. Vamos a descargarla de nuevo.',
  botonReparar: 'Reparar',

  errorSinConexion: {
    titulo: 'Sin conexión a internet.',
    cuerpo: 'Comprueba tu conexión y vuelve a intentarlo. No perderás lo que ya se ha descargado.'
  },
  errorSinEspacio: (n: string) => ({
    titulo: 'No queda espacio en el disco.',
    cuerpo: `Necesitas ${n} GB libres. Libera espacio (por ejemplo, vaciando la papelera) y vuelve a intentarlo.`
  }),
  errorServidor: {
    titulo: 'Uno de los servidores de descarga no responde.',
    cuerpo: 'Suele ser temporal. Vuelve a intentarlo en unos minutos.'
  },
  errorServidorTodos: {
    titulo: 'Los servidores de descarga no responden.',
    cuerpo: 'Suele ser temporal. Vuelve a intentarlo en unos minutos.'
  },
  errorVerificacion: {
    titulo: 'El archivo descargado no es correcto.',
    cuerpo:
      'Lo hemos descargado dos veces y no coincide con el original. Vuelve a intentarlo más tarde; si se repite, copia los detalles y abre una incidencia en la web del proyecto.'
  },
  errorGenerico: {
    titulo: 'Algo salió mal durante la preparación.',
    cuerpo:
      'Vuelve a intentarlo. Si se repite, copia los detalles y abre una incidencia en la web del proyecto.'
  },
  botonReintentar: 'Reintentar',
  botonSalir: 'Salir',

  pausarTitulo: '¿Pausar la preparación?',
  pausarCuerpo: 'Se guardará lo descargado y continuará la próxima vez que abras Shinobi Karaoke.',
  pausarSeguir: 'Seguir preparando',

  comprobandoTitulo: 'Comprobando tu instalación…',
  comprobandoCuerpo: 'Solo tardará unos segundos.',
  comprobandoLento: 'Está tardando un poco más de lo normal. No cierres la aplicación.',

  nocompatTitulo: 'Tu equipo no es compatible todavía',
  nocompatCuerpo:
    'Shinobi Karaoke necesita instalar un motor de audio que, por ahora, solo existe para Windows 10/11 y Linux con procesador de 64 bits (x64) y para Mac con chip Apple y macOS 14 o posterior.',
  nocompatEquipo: (so: string, procesador: string) => `Tu equipo: ${so} · ${procesador}`,
  nocompatNota:
    'Si quieres que lo soportemos, cuéntanoslo: copia los detalles y ábrenos una incidencia en la web del proyecto.',
  nocompatSoporte: 'Pedir soporte para mi equipo',

  macosTitulo: 'Necesitas actualizar macOS',
  macosCuerpo: (min: string, version: string) =>
    `Shinobi Karaoke necesita macOS ${min} o posterior y tu Mac tiene macOS ${version}.`,
  macosGratis: 'Todos los Mac con chip Apple pueden actualizar gratis.',
  macosPasos:
    'Para actualizar: menú Apple (la manzana de la esquina de la pantalla) → Ajustes del Sistema (o Configuración del Sistema) → General → Actualización de Software. Antes, conviene hacer una copia de seguridad. Cuando termines, vuelve a abrir Shinobi Karaoke.',
  macosAyuda: 'Cómo actualizar macOS',

  botonCopiar: 'Copiar detalles',
  pie: 'Shinobi Karaoke es software libre (GPL-3.0)',
  licencias: 'Licencias',
  nombreApp: 'Shinobi Karaoke',

  anuncioPorcentaje: (n: number) => `${n} % completado`
} as const

/** Página de Apple sobre cómo actualizar macOS (en español; en la lista blanca de la IPC). */
export const ENLACE_ACTUALIZAR_MACOS = 'https://support.apple.com/es-es/108382'
