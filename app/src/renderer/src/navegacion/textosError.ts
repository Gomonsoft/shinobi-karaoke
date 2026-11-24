/** Microcopy de ux/00 · «Pantalla de error de la interfaz» (claves `err.*`). */
export const ERR = {
  vista: {
    titulo: 'Esta pantalla ha tenido un problema',
    texto:
      'Algo falló al dibujarla. Tus canciones están a salvo y el resto de la app sigue funcionando.',
    repetido:
      'Ha vuelto a fallar. Ve a la Biblioteca y abre la canción de nuevo. Si sigue pasando, cierra y vuelve a abrir Shinobi Karaoke.',
    recargar: 'Volver a cargar esta pantalla',
    biblioteca: 'Ir a la Biblioteca'
  },
  global: {
    titulo: 'Shinobi Karaoke ha tenido un problema',
    texto: 'Algo falló al dibujar la ventana. Tus canciones están a salvo en el disco.',
    recargar: 'Volver a cargar la ventana'
  },
  rep: {
    titulo: 'El reproductor ha tenido un problema',
    salir: 'Salir del reproductor (Esc)'
  },
  publico: 'El reproductor se ha detenido.',
  editor: {
    guardado: 'Tus cambios del editor están guardados.',
    guardando: 'Guardando tus últimos cambios…',
    noGuardado:
      'No se pudieron guardar los cambios de los últimos segundos. Lo anterior sí está guardado.',
    historial: 'Se ha perdido el historial para deshacer de esta visita.'
  },
  detalles: 'Detalles para informar del fallo',
  copiar: 'Copiar detalles',
  copiado: 'Detalles copiados. Pégalos en tu informe del fallo.',
  guardandoBoton: 'Guardando…'
} as const
