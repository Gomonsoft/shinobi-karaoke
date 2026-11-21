/**
 * Textos `ses.cierre*` de la spec 02, fase 4.
 *
 * PROVISIONAL: duplicados de `renderer/src/sesion/textos.ts` (tarea 0183). Al integrar, importar de
 * allí y borrar este archivo. El cuerpo no lleva el número de pendientes porque
 * `EstadoSecundariaIpc` solo informa de `hayPendientes` (pregunta 0068).
 */
export const SES = {
  cierre: {
    titulo: 'Hay canciones en cola',
    cuerpo:
      'Quedan canciones pendientes. Si conservas la cola, podrás seguir donde lo dejaste al volver a abrir el reproductor. La cola se pierde al salir de Shinobi Karaoke.',
    cancelar: 'Cancelar',
    eliminar: 'Cerrar y eliminar cola',
    conservar: 'Cerrar y conservar cola',
    obsoleto:
      'La cola cambió mientras confirmabas. Revisa cuántas canciones quedan y elige otra vez.'
  }
}
