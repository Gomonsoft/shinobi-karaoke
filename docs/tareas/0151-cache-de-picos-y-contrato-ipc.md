# 0151 — Caché de picos y contrato IPC

- Estado: En curso
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

- [ ] Pruebas de caché anterior ausente, válida, truncada y formato desconocido, y de generación fallida/reintento.
- [ ] Dos solicitudes de la misma generación comparten trabajo, el cambio de pista durante generación descarta el resultado viejo y borrar no recrea carpeta ni deja publicación.
- [ ] La lectura escoge nivel dentro del presupuesto de 4096 bloques y lee solo la ventana de bytes. Probar intervalos fuera de rango, extremos de archivo y argumentos inválidos.
- [ ] Respeta la validación de origen/frame del ADR 0008. Ni argumentos ni respuestas del renderer contienen rutas absolutas.
- [ ] No afecta a importación, estado de la canción ni separación si se cancela, falta runtime o falla la caché.

## Verificación

Desde `app/`, `npm test -- src/main src/shared`, `npm run lint` y `npm run typecheck`.

## Notas de implementación

Pendientes.
