# 0242 — Captura de 3840 × 2160 con un píxel de menos en Linux

- Estado: Pendiente · **0.2.1: no se investiga más; se cierra con la [0260](0260-sondeo-de-perfiles-con-captura-real.md)** (decisión del arquitecto, [ADR 0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md#revisión-para-021--fase-7-correcciones-pendientes-de-alpha1) §2 de la revisión para 0.2.1, provisional en [0148](../preguntas/0148-decisiones-provisionales-del-arquitecto-de-0-2-1.md) §4): el sondeo con captura real marca esos perfiles como no disponibles antes de elegirlos, que es el criterio de respaldo de abajo. La 0260 cambia la E2E y la pasa a `Hecha`. Antes: condicionada a que el paso 8.10 de la guía manual de la fase 6 falle en Linux con GPU real. **2026-11-21:** probablemente es el mismo recorte por pantalla que la tarea [0244](0244-tamano-exacto-de-la-ventana-offscreen-de-exportacion.md) corrige en Windows. La tarea [0246](0246-e2e-de-captura-en-windows-y-cierre-de-0242.md) comprueba en el CI de Linux si `setContentSize` la resuelve, y la cierra o anota aquí el resultado.
- Paso del pipeline: 6
- Depende de: [0234](0234-ventana-offscreen-de-exportacion-y-rol.md), [0237](0237-servicio-de-exportacion-e-ipc.md)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §2 («Tamaño», riesgo abierto)
- Spec UX: [10](../ux/10-exportacion.md) (perfil no soportado)

## Objetivo
En el CI de Linux (Xvfb, sin GPU), `capturePage()` de una ventana offscreen de 3840 × 2160 devuelve 3839 × 2159, y la exportación 4K se rechaza con `PERFIL_NO_SOPORTADO`. Si en Linux con GPU real también pasa, hay que encontrar la causa y hacer que la captura tenga el tamaño exacto. Si no se consigue, hay que marcar esos perfiles como no soportados **antes** de que el usuario los elija.

## Contrato
1. **Diagnóstico**, con Electron en Linux X11 y Wayland:
   - si depende del tamaño de la pantalla virtual (por ejemplo, un Xvfb de 1920 × 1080 frente a uno de 3840 × 2160 o mayor);
   - si depende de `enableLargerThanScreen`, de `setContentSize`/`setSize` después de crear la ventana o de `useContentSize`;
   - si depende del modo software (`--disable-gpu`) frente al de GPU.
2. **Corrección, en este orden de preferencia**:
   - dar a la ventana el tamaño que produce una captura exacta (por ejemplo, ajustar el tamaño tras `ready-to-show` o crear la ventana con el tamaño de contenido);
   - si no, capturar un rectángulo explícito (`capturePage({ x: 0, y: 0, width, height })`) de una ventana algo mayor.
   - Nunca escalar.
3. **Si no hay corrección**: el sondeo de perfiles (`ServicioExportacion`) prueba una captura de 2160 líneas al abrir el diálogo por primera vez y, si el tamaño no coincide, marca esos perfiles con `soportado: false` y el motivo `codificador` (o uno nuevo, `captura`, acordado con el diseñador). Así el usuario lo ve en el selector y no descubre el fallo al terminar.

## Criterios de aceptación
- [ ] En Linux con GPU real, la exportación a 3840 × 2160 y a 2880 × 2160 completa con la resolución exacta. Si no es posible, esos perfiles aparecen como no disponibles en el diálogo, con motivo.
- [ ] En el CI (Xvfb) la prueba `exportacion-captura.spec.ts` de 3840 × 2160 pasa o comprueba el marcado como no soportado. Deja de omitirse en silencio.

## Pruebas de feedback
- Unitarias: si se añade el sondeo de captura, `servicio.test.ts` con una ventana doble que devuelve un tamaño incorrecto.
- E2E: `exportacion-captura.spec.ts` en Linux (CI).
- Críticos: sí, si toca `main/`.
- Manual: repetir el paso 8.10 de la guía de la fase 6.

## Notas de implementación
