# 0151 — Caché de picos y contrato IPC

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: [0150](0150-generar-picos-multinivel-en-worker.md)
- ADRs: [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md)
- Specs: [Editor](../ux/06-editor.md), [Sistema visual](../ux/sistema-visual.md)
- Plan: [Fase 2](../versiones/0.2.0/plan-2.md#fase-2--línea-de-tiempo)

## Objetivo

Orquestar generación, invalidación y lectura acotada desde main.

## Archivos y contrato

Añadir servicio en `app/src/main/` y los cambios aditivos necesarios en `app/src/shared/ipc.ts`, `canales.ts`, `app/src/main/ipc/handlers.ts`, `app/src/preload/index.ts` y `app/src/main/index.ts`. Main resuelve voz con confinamiento de canción y rutas, usa el cliente worker existente y revalida huella antes de publicar el temporal por renombrado. Deduplicar por generación, limitar a una generación activa y acotar espera. Reutilizar cancelación y cierre. Integrar invalidación al sustituir la pista y cancelar al borrar, sin modificar el estado de separación. Exponer solicitud/estado, reintento y lectura por id, rango y presupuesto. La respuesta incluye generación, primer bloque, paso y bytes. Comunicar contrato a 0152 antes de cablear.

## Criterios de aceptación

- [x] Pruebas de caché anterior ausente, válida, truncada y formato desconocido, y de generación fallida/reintento.
- [x] Dos solicitudes de la misma generación comparten trabajo, el cambio de pista durante generación descarta el resultado viejo y borrar no recrea carpeta ni deja publicación.
- [x] La lectura escoge nivel dentro del presupuesto de 4096 bloques y lee solo la ventana de bytes. Probar intervalos fuera de rango, extremos de archivo y argumentos inválidos.
- [x] Respeta la validación de origen/frame del ADR 0008. Ni argumentos ni respuestas del renderer contienen rutas absolutas.
- [x] No afecta a importación, estado de la canción ni separación si se cancela, falta runtime o falla la caché.

## Verificación

Desde `app/`, `npm test -- src/main src/shared`, `npm run lint` y `npm run typecheck`.

## Notas de implementación

- `app/src/main/picos/` valida el archivo SKPV y lee por posición los pares del nivel más detallado que entra en el presupuesto. La huella de la voz se verifica antes de publicar y antes de entregar la ventana al renderer.
- Main resuelve `pistas/voz.flac` dentro de una canción de la biblioteca. Genera por demanda con el worker existente, con un trabajo activo, deduplicación y reintento explícito tras fallo. Sustituir pistas y mover una canción a la papelera cancela y espera ese trabajo antes de modificar los archivos. El cierre también lo cancela.
- `window.shinobi.picos.solicitar(cancionId, reintentar?)` entrega el estado y `leer({ cancionId, inicioMs, finMs, presupuesto })` entrega la generación y los datos binarios acotados. Los dos canales usan la validación común de remitente y argumentos. La vista puede detectar la publicación de una voz nueva con el evento existente de separación terminada.
- Verificación dirigida en Windows: 420 pruebas correctas y 5 omitidas en picos, IPC, separación, biblioteca y esquemas compartidos. La suite completa de main y shared registró 979 pruebas correctas, 13 omitidas y 10 fallos también observados en la fase 1 en el equipo local. Ocho corresponden a permisos de enlaces simbólicos y dos a recuento de procesos del worker tras cancelar.
