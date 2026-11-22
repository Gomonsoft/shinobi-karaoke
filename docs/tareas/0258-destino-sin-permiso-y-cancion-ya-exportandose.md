# 0258 — Exportación: carpeta sin permiso detectada al empezar y código propio para «canción ya exportándose»

- Estado: Hecha
- Paso del pipeline: 6 (exportación)
- Fase: 7 de 0.2.1 · Lote A (exportación)
- Depende de: 0257 (mismo lote), 0283 (código `CANCION_EXPORTANDOSE` y `detalle` en `shared/errores.ts` y `shared/ipc.ts`)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md#revisión-para-021--fase-7-correcciones-pendientes-de-alpha1) §4 de la revisión para 0.2.1; respuesta a [0146](../preguntas/0146-captura-reintentar-y-errores-tempranos-de-la-exportacion.md) §3 y §4
- Spec UX: [10 · Fase 7](../ux/10-exportacion.md#fase-7-de-021--perfiles-capturables-reintentar-y-errores-tempranos), secciones «Carpeta sin permiso: error al empezar» y «Esta canción ya se está exportando»; criterios **V35** y **V36**; claves `exp.error.destino.titulo`, `exp.error.destino.permiso`, `exp.error.cancionExportandose`
- Tamaño: M

## Objetivo

QA encontró dos discrepancias ([informe](../Test-manuales/0.2.0/ejecucion-2026-11-21-windows.md) I-6 e I-7): una carpeta con `icacls /deny` falla con el codificador ya en marcha, porque `fsp.access(W_OK)` (`destinos.ts:65`) no consulta las ACL en Windows; y la segunda exportación de la misma canción sale con el genérico `ARGUMENTOS_NO_VALIDOS`.

## Archivos (solo estos)

- `app/src/main/exportacion/destinos.ts`, `servicio.ts` y sus tests
- `app/src/renderer/src/exportacion/dialogo/**` (formulario A: error bajo «Guardar como» y aviso de canción exportándose) y sus tests
- Los textos de exportación del renderer (`exportacion/textos.ts` o el módulo donde vivan las claves `exp.*`)

## Criterios de aceptación

- [ ] `destinos.ts` tiene `probarEscritura(carpeta)`: crea con `open(…, "wx")` `.<nombre>.<8 hex>.shinobi-prueba`, lo cierra y lo borra; `EACCES`, `EPERM`, `EROFS`, `ENOENT`, `ENOTDIR` → no escribible. Un fallo al borrar se registra y no cuenta como error.
- [ ] `destinoPropuesto` usa esa prueba (no `fs.access`) para decidir si reutiliza la carpeta recordada.
- [ ] `consumir` la ejecuta: `iniciar` rechaza con `DESTINO_NO_DISPONIBLE` y `detalle: { campo: "destino" }` **antes** de lanzar el worker, crear la ventana o escribir el diario, y sin gastar el `destinoId` (V35: el doble del worker no recibe ninguna llamada y la carpeta no tiene temporales).
- [ ] Con ese error, el formulario sigue en A con `exp.error.destino.titulo` y `exp.error.destino.permiso` bajo «Guardar como», borde `error`, `role="alert"`, `aria-describedby` y el foco en [Cambiar…]; elegir otro destino o cambiar de formato lo quita; «Exportar» sigue disponible.
- [ ] Una segunda `iniciar` de una canción con exportación en curso o en cola responde `CANCION_EXPORTANDOSE` con `detalle: { trabajoId }` (V36). `DESTINO_OCUPADO` solo con dos canciones distintas al mismo archivo.
- [ ] En A, `exp.error.cancionExportandose` se muestra como aviso `error` encima de las acciones con `role="alert"` y [Ver exportación] (lleva al estado de ese trabajo con el foco en su acción inicial); «Exportar» queda `aria-disabled` con ese texto en el tooltip mientras ese trabajo siga; al terminar o cancelarse, el aviso desaparece.

## Pruebas de feedback

- Unitarias: `destinos.test.ts` (prueba de escritura con un doble de `fs` que falla con cada código), `servicio.test.ts` (rechazo temprano sin worker; dos `iniciar` de la misma canción), pruebas del formulario (V35, V36).
- E2E: ninguna.
- Críticos: sí (`main/`).
- Manual: guía de la fase 7 — carpeta con `icacls <carpeta> /deny %USERNAME%:(W)` en Windows (casos 6.3 y 17.3 de la guía de la fase 6).

## Notas de implementación

- `main/exportacion/destinos.ts`: `probarEscritura(carpeta, { fs, uuid, registrar })` crea con `open(…, "wx")` `.exportacion.<8 hex>.shinobi-prueba`, lo cierra y lo borra (fallo al borrar: se registra y no cuenta). `EACCES`, `EPERM`, `EROFS`, `ENOENT`, `ENOTDIR` = no escribible; otro código (p. ej. `ENOSPC`) no declara la carpeta inservible (decisión mía: eso lo dirá `SIN_ESPACIO`). `discoReal.esCarpetaEscribible` (stat + `probarEscritura`) sustituye a `fs.access(W_OK)` y lo usan `destinoPropuesto`, `destinoDesdeRuta`, `carpetaInicial`, `elegirDestino` y `consumir`; `consumir` valida antes de gastar el `destinoId`. `ErrorDestino` lleva `detalle: { campo: "destino" }` en los `DESTINO_NO_DISPONIBLE` de destino.
- `servicio.ts`: `iniciar` responde `CANCION_EXPORTANDOSE` con `detalle: { trabajoId }` (trabajo activo o `iniciar` en vuelo; el id del trabajo se reserva antes). `DESTINO_OCUPADO` solo con dos canciones distintas.
- Transporte provisional del `detalle` en rechazos (viaja serializado en `detalles`): ver [0151](../preguntas/0151-detalle-del-error-en-los-rechazos-de-la-ipc.md).
- Renderer: `Formulario.tsx` (error `exp.error.destino.*` bajo «Guardar como» con `aria-invalid`, `aria-describedby`, borde `error` y foco en [Cambiar…]; aviso `exp.error.cancionExportandose` con [Ver exportación] encima de las acciones), `DialogoFormulario.tsx` («Exportar» `aria-disabled` con el texto en el tooltip mientras el trabajo siga; [Ver exportación] usa `alIniciada(trabajoId)`), `useFormulario.ts` y `textos.ts`.
- Pruebas: `destinos.test.ts`, `servicio.test.ts` (V35 sin worker, ventana ni diario; V36), `DialogoExportacion.test.tsx` (V35 y V36).
- Manual (guía de la fase 7): carpeta con `icacls <carpeta> /deny %USERNAME%:(W)` en Windows (casos 6.3 y 17.3 de la guía de la fase 6); dos exportaciones de la misma canción.
- Deuda: si se aprueba la 0151, quitar la serialización en `detalles` y el parseo del renderer.
